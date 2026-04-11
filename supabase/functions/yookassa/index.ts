/**
 * ЮKassa Edge Function
 *
 * POST /yookassa?action=create   — создать платёж
 * POST /yookassa?action=webhook  — вебхук от ЮKassa (настрой в ЛК ЮKassa)
 * GET  /yookassa?action=status   — получить статус подписки
 *
 * Секреты в Supabase Dashboard → Settings → Edge Functions:
 *   YK_SHOP_ID     — ID магазина из ЛК ЮKassa
 *   YK_SECRET_KEY  — Секретный ключ из ЛК ЮKassa
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const YK_URL = 'https://api.yookassa.ru/v3'

function ykHeaders() {
  const shopId = Deno.env.get('YK_SHOP_ID')!
  const secretKey = Deno.env.get('YK_SECRET_KEY')!
  return {
    'Authorization': 'Basic ' + btoa(`${shopId}:${secretKey}`),
    'Content-Type': 'application/json',
    'Idempotence-Key': crypto.randomUUID(),
  }
}

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  try {
    // ── Создать платёж ──────────────────────────────────────────────────
    if (action === 'create' && req.method === 'POST') {
      // Авторизация пользователя
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

      const supabase = supabaseAdmin()
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
      if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

      const body = await req.json()
      const plan = body.plan ?? 'premium'
      const amount = plan === 'premium_yearly' ? 2490 : 299  // руб.
      const description = plan === 'premium_yearly' ? 'Love App Premium — 1 год' : 'Love App Premium — 1 месяц'
      const returnUrl = body.returnUrl ?? Deno.env.get('SUPABASE_URL')!.replace('supabase.co', 'netlify.app')

      // Создаём платёж в ЮKassa
      const ykRes = await fetch(`${YK_URL}/payments`, {
        method: 'POST',
        headers: ykHeaders(),
        body: JSON.stringify({
          amount: { value: String(amount) + '.00', currency: 'RUB' },
          confirmation: {
            type: 'redirect',
            return_url: returnUrl + '/?payment=success',
          },
          capture: true,
          description,
          save_payment_method: true,   // сохраняем карту для автопродления
          metadata: { user_id: user.id, plan },
        }),
      })

      const ykData = await ykRes.json()
      if (!ykRes.ok) {
        console.error('ЮKassa error:', ykData)
        return new Response(JSON.stringify({ error: 'Ошибка создания платежа' }), { status: 500, headers: cors })
      }

      // Сохраняем pending-запись в БД
      await supabase.from('subscriptions').upsert({
        user_id: user.id,
        status: 'inactive',
        plan,
        price_rub: amount,
        yk_payment_id: ykData.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      return new Response(JSON.stringify({
        payment_id: ykData.id,
        confirmation_url: ykData.confirmation.confirmation_url,
      }), { headers: cors })
    }

    // ── Получить статус подписки ─────────────────────────────────────────
    if (action === 'status' && req.method === 'GET') {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return new Response(JSON.stringify({ active: false }), { headers: cors })

      const supabase = supabaseAdmin()
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
      if (!user) return new Response(JSON.stringify({ active: false }), { headers: cors })

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status, plan, expires_at, started_at')
        .eq('user_id', user.id)
        .single()

      const active = sub?.status === 'active' && sub?.expires_at && new Date(sub.expires_at) > new Date()
      return new Response(JSON.stringify({ active: !!active, subscription: sub }), { headers: cors })
    }

    // ── Вебхук от ЮKassa ─────────────────────────────────────────────────
    if (action === 'webhook' && req.method === 'POST') {
      const event = await req.json()
      console.log('ЮKassa webhook:', event.event, event.object?.id)

      const supabase = supabaseAdmin()
      const payment = event.object
      const userId = payment?.metadata?.user_id
      const plan = payment?.metadata?.plan ?? 'premium'

      if (!userId || !payment?.id) {
        return new Response('ok', { headers: cors })
      }

      // Логируем событие
      await supabase.from('payment_events').insert({
        user_id: userId,
        yk_payment_id: payment.id,
        event_type: event.event,
        amount_rub: payment.amount ? Math.round(parseFloat(payment.amount.value)) : null,
        raw: event,
      })

      if (event.event === 'payment.succeeded') {
        const months = plan === 'premium_yearly' ? 12 : 1
        const expiresAt = new Date()
        expiresAt.setMonth(expiresAt.getMonth() + months)

        await supabase.from('subscriptions').upsert({
          user_id: userId,
          status: 'active',
          plan,
          price_rub: Math.round(parseFloat(payment.amount.value)),
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          yk_payment_id: payment.id,
          yk_payment_method_id: payment.payment_method?.id ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      }

      if (event.event === 'payment.canceled') {
        await supabase.from('subscriptions')
          .update({ status: 'inactive', updated_at: new Date().toISOString() })
          .eq('user_id', userId)
      }

      return new Response('ok', { headers: cors })
    }

    // ── Отмена подписки ──────────────────────────────────────────────────
    if (action === 'cancel' && req.method === 'POST') {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

      const supabase = supabaseAdmin()
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
      if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

      // Помечаем как отменённую (продолжает работать до expires_at)
      await supabase.from('subscriptions').update({
        cancelled_at: new Date().toISOString(),
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id)

      return new Response(JSON.stringify({ ok: true, message: 'Подписка отменена. Доступ сохранится до конца периода.' }), { headers: cors })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: cors })

  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors })
  }
})
