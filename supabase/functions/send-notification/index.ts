import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { title, body, recipientId } = await req.json()

    if (!recipientId) {
      return new Response(JSON.stringify({ error: 'recipientId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── Авторизация: подтверждаем, кто вызывает функцию ──────────────────
    // Без этой проверки любой мог бы слать push-уведомления любому пользователю.
    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: userData, error: authErr } = await supabase.auth.getUser(jwt)
    const caller = userData?.user
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Получатель должен быть либо сам отправитель, либо его подтверждённый партнёр.
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('partner_id')
      .eq('id', caller.id)
      .single()

    const allowed =
      recipientId === caller.id || recipientId === callerProfile?.partner_id
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Берём подписки получателя
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', recipientId)

    if (error) throw error
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const vapidPublic  = Deno.env.get('VAPID_PUBLIC_KEY')!
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com'

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

    const payload = JSON.stringify({ title, body })
    const results = await Promise.allSettled(
      subs.map(row => webpush.sendNotification(row.subscription, payload))
    )

    // Удаляем протухшие подписки (410 Gone)
    const expiredEndpoints: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const statusCode = (r.reason as any)?.statusCode
        if (statusCode === 410 || statusCode === 404) {
          expiredEndpoints.push((subs[i].subscription as any).endpoint)
        }
      }
    })

    if (expiredEndpoints.length > 0) {
      // Удалить по endpoint нет прямого способа через supabase-js без raw SQL,
      // поэтому просто удаляем все подписки этого получателя если все протухли
      if (expiredEndpoints.length === subs.length) {
        await supabase.from('push_subscriptions').delete().eq('user_id', recipientId)
      }
    }

    const sent = results.filter(r => r.status === 'fulfilled').length
    return new Response(JSON.stringify({ sent, total: subs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('send-notification error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
