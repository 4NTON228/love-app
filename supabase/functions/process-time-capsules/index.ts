/**
 * process-time-capsules — Edge Function (Supabase Cron)
 *
 * Вызывается по расписанию (например, каждый час через pg_cron или
 * Supabase Dashboard → Edge Functions → Cron).
 *
 * Что делает:
 * 1. Находит капсулы trigger_type='date', у которых trigger_date <= now() и is_sent=false
 * 2. Находит капсулы trigger_type='days', у которых created_at + trigger_days*24h <= now()
 * 3. Находит капсулы trigger_type='fight', у которых пара молчит >= fight_silence_hours
 * 4. Для каждой: создаёт сообщение в таблице messages, ставит is_sent=true
 * 5. Отправляет push-уведомление партнёру (если есть подписка)
 *
 * Настройка расписания (в Supabase Dashboard → Database → Extensions → pg_cron):
 *   SELECT cron.schedule('process-capsules', '0 * * * *',
 *     $$SELECT net.http_post(
 *       url := 'https://<project>.supabase.co/functions/v1/process-time-capsules',
 *       headers := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb
 *     )$$
 *   );
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  // Only allow cron/service invocations
  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!authHeader.includes(serviceKey.slice(0, 20))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const now = new Date().toISOString()
  let processed = 0

  try {
    // ── 1. Date-triggered capsules ────────────────────────────────
    const { data: dateCapsules } = await supabase
      .from('time_capsules')
      .select('*')
      .eq('is_sent', false)
      .eq('trigger_type', 'date')
      .lte('trigger_date', now)

    for (const capsule of dateCapsules ?? []) {
      await deliverCapsule(capsule)
      processed++
    }

    // ── 2. Days-triggered capsules ────────────────────────────────
    const { data: daysCapsules } = await supabase
      .from('time_capsules')
      .select('*')
      .eq('is_sent', false)
      .eq('trigger_type', 'days')
      .not('trigger_days', 'is', null)

    for (const capsule of daysCapsules ?? []) {
      const deliverAt = new Date(capsule.created_at)
      deliverAt.setDate(deliverAt.getDate() + (capsule.trigger_days ?? 0))
      if (deliverAt <= new Date()) {
        await deliverCapsule(capsule)
        processed++
      }
    }

    // ── 3. Fight-triggered capsules ───────────────────────────────
    const { data: fightCapsules } = await supabase
      .from('time_capsules')
      .select('*')
      .eq('is_sent', false)
      .eq('trigger_type', 'fight')

    for (const capsule of fightCapsules ?? []) {
      const silenceHours = capsule.fight_silence_hours ?? 24
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('created_at')
        .or(`user_id.eq.${capsule.user_id},user_id.eq.${capsule.partner_id}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!lastMsg) {
        // No messages at all — check since capsule was created
        const silenceSince = new Date(capsule.created_at)
        silenceSince.setHours(silenceSince.getHours() + silenceHours)
        if (new Date() >= silenceSince) {
          await deliverCapsule(capsule)
          processed++
        }
      } else {
        const lastAt = new Date(lastMsg.created_at)
        const silenceSince = new Date(lastAt)
        silenceSince.setHours(silenceSince.getHours() + silenceHours)
        if (new Date() >= silenceSince) {
          await deliverCapsule(capsule)
          processed++
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, processed }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[process-time-capsules]', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

async function deliverCapsule(capsule: Record<string, unknown>) {
  // Insert as a special message (system type)
  const { error: msgErr } = await supabase.from('messages').insert({
    user_id: capsule.user_id,
    text: `💌 Капсула времени от ${new Date(capsule.created_at as string).toLocaleDateString('ru-RU')}: ${capsule.message}`,
  })

  if (msgErr) {
    console.error('Failed to deliver capsule', capsule.id, msgErr)
    return
  }

  // Mark as sent
  await supabase
    .from('time_capsules')
    .update({ is_sent: true, sent_at: new Date().toISOString() })
    .eq('id', capsule.id)

  // Send push to partner
  if (capsule.partner_id) {
    const { data: sub } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', capsule.partner_id)
      .single()

    if (sub?.subscription) {
      const notifyUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      await fetch(notifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          recipientId: capsule.partner_id,
          title: '💌 Капсула времени открылась',
          body: 'Тебе написали из прошлого — загляни в чат',
        }),
      }).catch(() => {})
    }
  }
}
