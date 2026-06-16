/**
 * meeting-reminder — Edge Function (Supabase Cron)
 *
 * Runs every 5 minutes (pg_cron job "meeting-reminder"). When a couple's
 * next_meeting time has arrived it pushes BOTH partners:
 *   "💕 Вы скоро увидитесь!"
 * and stamps couple_settings.meeting_notified_at so it fires exactly once
 * per meeting. Idempotent + low-risk, so it is safe to invoke with the
 * public anon key from the scheduled job.
 *
 * Cron is already configured in the database (see
 * supabase-meeting-reminder-cron.sql). It uses its own SERVICE_ROLE_KEY
 * env for DB access regardless of the caller.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async () => {
  const now = new Date().toISOString()
  let processed = 0

  try {
    const { data: rows } = await supabase
      .from('couple_settings')
      .select('id, user_id, couple_id, next_meeting, meeting_notified_at')
      .not('next_meeting', 'is', null)
      .lte('next_meeting', now)

    for (const row of rows ?? []) {
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
