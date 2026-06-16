/**
 * meeting-reminder — Edge Function (Supabase Cron)
 *
 * Runs on a schedule (e.g. every 5 minutes via pg_cron). When a couple's
 * next_meeting time has arrived it sends BOTH partners a push:
 *   "💕 Вы скоро увидитесь!"
 * and stamps meeting_notified_at so it fires exactly once per meeting.
 *
 * Schedule (Supabase → Database → Extensions → pg_cron):
 *   select cron.schedule('meeting-reminder', '*\/5 * * * *',
 *     $$select net.http_post(
 *       url := 'https://<project>.supabase.co/functions/v1/meeting-reminder',
 *       headers := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb
 *     )$$);
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!authHeader.includes(serviceKey.slice(0, 20))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const now = new Date().toISOString()
  let processed = 0

  try {
    // Meetings whose time has arrived and haven't been notified for THIS meeting yet
    const { data: rows } = await supabase
      .from('couple_settings')
      .select('id, user_id, couple_id, next_meeting, meeting_notified_at')
      .not('next_meeting', 'is', null)
      .lte('next_meeting', now)

    for (const row of rows ?? []) {
      // Skip if already notified for this exact meeting time
      if (row.meeting_notified_at && new Date(row.meeting_notified_at) >= new Date(row.next_meeting)) {
        continue
      }

      // Atomic claim — only proceed if still un-notified for this meeting
      const { data: claimed } = await supabase
        .from('couple_settings')
        .update({ meeting_notified_at: now })
        .eq('id', row.id)
        .or(`meeting_notified_at.is.null,meeting_notified_at.lt.${row.next_meeting}`)
        .select('id')

      if (!claimed || claimed.length === 0) continue

      // Resolve both partners
      const recipients = new Set<string>()
      if (row.user_id) recipients.add(row.user_id)
      const { data: prof } = await supabase
        .from('profiles')
        .select('partner_id')
        .eq('id', row.user_id)
        .maybeSingle()
      if (prof?.partner_id) recipients.add(prof.partner_id)

      for (const recipientId of recipients) {
        await sendPush(recipientId, '💕 Вы скоро увидитесь!', 'Время вашей встречи пришло — хорошего вечера вместе!')
      }
      processed++
    }

    return new Response(JSON.stringify({ ok: true, processed }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[meeting-reminder]', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

async function sendPush(recipientId: string, title: string, body: string) {
  const { data: sub } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', recipientId)
    .maybeSingle()
  if (!sub?.subscription) return

  const notifyUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  await fetch(notifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ recipientId, title, body }),
  }).catch(() => {})
}
