/**
 * daily-reminders — Edge Function (Supabase Cron, once a day ~06:00 UTC)
 *
 * Sends couples push reminders for important dates:
 *   - partner's birthday (today / tomorrow)
 *   - couple anniversary (today / tomorrow)
 *   - calendar events (today / tomorrow)
 *
 * Idempotent enough by running once per day. Safe to call with the public
 * anon key (no data is returned; it only pushes legitimately-due reminders).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function mmdd(d: Date) { return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function md(dateStr: string) { const x = new Date(dateStr); return `${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
function yearsWord(n: number) { const a = n % 10, b = n % 100; if (a === 1 && b !== 11) return 'год'; if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return 'года'; return 'лет' }

Deno.serve(async () => {
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 86400000)
  const todayMD = mmdd(now), tomMD = mmdd(tomorrow)
  const todayYMD = ymd(now), tomYMD = ymd(tomorrow)
  let sent = 0

  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id,name,birthday,partner_id,couple_start_date')
    const pmap = new Map<string, any>()
    ;(profiles || []).forEach(p => pmap.set(p.id, p))

    const when = (dStr: string) => md(dStr) === tomMD ? 'Завтра' : md(dStr) === todayMD ? 'Сегодня' : null

    // 1) Birthdays → notify the partner
    for (const p of profiles || []) {
      if (!p.birthday || !p.partner_id) continue
      const w = when(p.birthday)
      if (!w) continue
      await push(p.partner_id, `🎂 ${w} день рождения`, `У ${p.name || 'твоей половинки'} ${w.toLowerCase()} день рождения — не забудь поздравить!`) && sent++
    }

    // 2) Anniversary → notify both (from couples table, fallback to profile)
    const { data: couples } = await supabase
      .from('couples')
      .select('user_a,user_b,couple_start_date,status')
    const annivSeen = new Set<string>()
    const handleAnniv = async (startStr: string, a: string, b: string) => {
      const w = when(startStr)
      if (!w) return
      const years = (w === 'Завтра' ? tomorrow : now).getFullYear() - new Date(startStr).getFullYear()
      const txt = years > 0 ? `${w}: ${years} ${yearsWord(years)} вместе 💕` : `${w} — ваша годовщина 💕`
      for (const r of [a, b]) { if (r) { await push(r, '💍 Годовщина', txt) && sent++ } }
    }
    for (const c of couples || []) {
      if (c.status && c.status !== 'active') continue
      const start = c.couple_start_date || pmap.get(c.user_a)?.couple_start_date || pmap.get(c.user_b)?.couple_start_date
      if (!start) continue
      const key = `${c.user_a}-${c.user_b}`
      if (annivSeen.has(key)) continue
      annivSeen.add(key)
      await handleAnniv(start, c.user_a, c.user_b)
    }

    // 3) Calendar events for today/tomorrow → notify the couple
    const { data: events } = await supabase
      .from('calendar_events')
      .select('user_id,title,emoji,event_date')
      .in('event_date', [todayYMD, tomYMD])
    for (const ev of events || []) {
      const w = ev.event_date === tomYMD ? 'Завтра' : 'Сегодня'
      const recipients = new Set<string>([ev.user_id])
      const partner = pmap.get(ev.user_id)?.partner_id
      if (partner) recipients.add(partner)
      for (const r of recipients) { await push(r, `📅 ${w}: ${ev.title}`, `${ev.emoji || '📅'} Напоминание о событии`) && sent++ }
    }

    return new Response(JSON.stringify({ ok: true, sent }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('[daily-reminders]', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})

async function push(recipientId: string, title: string, body: string) {
  const { data: sub } = await supabase.from('push_subscriptions').select('subscription').eq('user_id', recipientId).maybeSingle()
  if (!sub?.subscription) return false
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ recipientId, title, body }),
  }).catch(() => {})
  return true
}
