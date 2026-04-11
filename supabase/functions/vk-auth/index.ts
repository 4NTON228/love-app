/**
 * VK OAuth Edge Function
 *
 * GET /vk-auth?action=login   — редирект на страницу VK OAuth
 * GET /vk-auth?code=CODE      — callback от VK (настрой в ЛК ВКонтакте)
 *
 * Секреты в Supabase Dashboard → Settings → Edge Functions:
 *   VK_APP_ID      — ID приложения ВКонтакте
 *   VK_APP_SECRET  — Защищённый ключ приложения ВКонтакте
 *   APP_URL        — URL твоего Vercel-приложения (https://yourapp.vercel.app)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VK_API   = 'https://api.vk.com/method'
const VK_OAUTH = 'https://oauth.vk.com'

Deno.serve(async (req) => {
  const url        = new URL(req.url)
  const code       = url.searchParams.get('code')
  const action     = url.searchParams.get('action')
  const errorParam = url.searchParams.get('error')

  const appUrl     = Deno.env.get('APP_URL') ?? 'https://localhost:5173'
  const vkAppId    = Deno.env.get('VK_APP_ID') ?? ''
  const vkSecret   = Deno.env.get('VK_APP_SECRET') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  // URL этой функции — используется как redirect_uri в VK
  const redirectUri = `${supabaseUrl}/functions/v1/vk-auth`

  // ── Шаг 1: Редирект на страницу авторизации VK ─────────────────────────
  if (action === 'login') {
    const vkUrl = new URL(`${VK_OAUTH}/authorize`)
    vkUrl.searchParams.set('client_id', vkAppId)
    vkUrl.searchParams.set('redirect_uri', redirectUri)
    vkUrl.searchParams.set('scope', 'email')          // просим email
    vkUrl.searchParams.set('response_type', 'code')
    vkUrl.searchParams.set('v', '5.131')
    vkUrl.searchParams.set('display', 'mobile')
    return Response.redirect(vkUrl.toString(), 302)
  }

  // ── Пользователь отклонил авторизацию ──────────────────────────────────
  if (errorParam) {
    return Response.redirect(`${appUrl}/?auth_error=vk_denied`, 302)
  }

  // ── Шаг 2: Получаем токен и создаём/находим Supabase-пользователя ──────
  if (code) {
    try {
      // Обмениваем code на access_token
      const tokenRes  = await fetch(
        `${VK_OAUTH}/access_token` +
        `?client_id=${vkAppId}` +
        `&client_secret=${encodeURIComponent(vkSecret)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&code=${code}`
      )
      const tokenData = await tokenRes.json()

      if (tokenData.error) {
        console.error('VK token error:', tokenData)
        return Response.redirect(`${appUrl}/?auth_error=vk_token`, 302)
      }

      const { access_token, user_id: vkId, email: vkEmail } = tokenData

      // Получаем профиль пользователя ВКонтакте
      const userRes  = await fetch(
        `${VK_API}/users.get` +
        `?user_ids=${vkId}` +
        `&fields=photo_200,first_name,last_name` +
        `&access_token=${access_token}` +
        `&v=5.131`
      )
      const userData = await userRes.json()
      const vkUser   = userData.response?.[0]

      if (!vkUser) {
        return Response.redirect(`${appUrl}/?auth_error=vk_user`, 302)
      }

      // Формируем данные пользователя
      const name      = `${vkUser.first_name} ${vkUser.last_name}`.trim()
      const avatarUrl = vkUser.photo_200 || null
      // Если VK не отдал email — создаём синтетический (детерминированный по vk_id)
      const email     = vkEmail || `vk_${vkId}@vkauth.love-app.internal`

      const supabase = createClient(supabaseUrl, serviceKey)

      // Ищем или создаём пользователя Supabase
      const userId = await findOrCreateUser(supabase, email, { name, avatar_url: avatarUrl, vk_id: vkId })

      if (!userId) {
        return Response.redirect(`${appUrl}/?auth_error=user_create`, 302)
      }

      // Создаём/обновляем профиль (не трогаем partner_id и invite_code)
      await supabase.from('profiles').upsert({
        id: userId,
        name,
        avatar_url: avatarUrl,
      }, { onConflict: 'id', ignoreDuplicates: false })

      // Генерируем одноразовую magic-ссылку → пользователь сразу войдёт
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: appUrl },
      })

      if (linkErr || !linkData?.properties?.action_link) {
        console.error('Magic link error:', linkErr)
        return Response.redirect(`${appUrl}/?auth_error=magic_link`, 302)
      }

      // Редиректим пользователя на magic link — он автоматически войдёт в приложение
      return Response.redirect(linkData.properties.action_link, 302)

    } catch (e) {
      console.error('VK auth exception:', e)
      return Response.redirect(`${appUrl}/?auth_error=exception`, 302)
    }
  }

  // Health check
  return new Response(JSON.stringify({ ok: true, service: 'vk-auth' }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

/* ── Найти или создать пользователя Supabase ── */
async function findOrCreateUser(
  supabase: ReturnType<typeof createClient>,
  email: string,
  metadata: Record<string, unknown>
): Promise<string | null> {
  // Пробуем создать
  const { data: { user }, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,   // без подтверждения — доверяем VK
    user_metadata: metadata,
  })

  if (!error && user) return user.id

  // Пользователь уже существует — ищем по email
  if (error?.message?.toLowerCase().includes('already')) {
    // Постранично ищем в списке пользователей
    for (let page = 1; page <= 20; page++) {
      const { data: { users } } = await supabase.auth.admin.listUsers({ page, perPage: 100 })
      if (!users?.length) break
      const found = users.find(u => u.email === email)
      if (found) {
        // Обновляем метаданные (имя/аватар могли измениться)
        await supabase.auth.admin.updateUserById(found.id, { user_metadata: metadata })
        return found.id
      }
      if (users.length < 100) break
    }
  }

  console.error('findOrCreateUser failed:', error)
  return null
}
