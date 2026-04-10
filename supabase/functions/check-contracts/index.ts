// ══════════════════════════════════════════════════════════════
// check-contracts — Edge Function (cron: ежечасно)
//
// Задачи:
//   1. Активирует контракты, подписанные обеими сторонами
//   2. Проверяет истёкшие контракты → помечает как 'completed'
//   3. Отправляет push-напоминания за 3 дня до истечения
//   4. Напоминает об ожидающих подписи контрактах (раз в день)
//
// Запуск вручную: POST { "type": "check_contracts" }
// ══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const VAPID_PUBLIC  = 'BJZU7YGUVM4c0w-tCFGqOdUXqzOTQoYXMOKrn_EHDBUV_eKx9tQtzXf7rgfmLkAhkfh45bEmtGuis8b8m5-BHVs'
const VAPID_PRIVATE = 'Drbxv8iXT2ryLjkGGhhyy3-_2NZTJ31AARv1F7zaCVE'
const VAPID_SUBJECT = 'mailto:admin@example.com'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

async function pushToUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  title: string,
  body: string,
) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return 0

  const payload = JSON.stringify({ title, body })
  const results = await Promise.allSettled(
    subs.map((row: { subscription: PushSubscriptionJSON }) =>
      webpush.sendNotification(row.subscription, payload),
    ),
  )

  // Cleanup expired subscriptions
  const expired = results
    .map((r, i) => ({ r, sub: subs[i].subscription }))
    .filter(({ r }) => r.status === 'rejected' && (r as PromiseRejectedResult).reason?.statusCode === 410)

  if (expired.length > 0) {
    const endpoints = expired.map(({ sub }) => (sub as { endpoint: string }).endpoint)
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', endpoints)
      .eq('user_id', userId)
  }

  return results.filter(r => r.status === 'fulfilled').length
}

async function checkContracts(supabase: ReturnType<typeof createClient>) {
  const now = new Date()
  const nowISO = now.toISOString()
  const results = {
    activated: 0,
    completed: 0,
    expiringSoon: 0,
    pendingReminders: 0,
  }

  // ── 1. Activate pending contracts signed by both parties ──────
  const { data: pendingContracts } = await supabase
    .from('contracts')
    .select('id, creator_id, partner_id, title, period_days')
    .eq('status', 'pending')
    .eq('signed_by_creator', true)
    .eq('signed_by_partner', true)

  for (const contract of pendingContracts ?? []) {
    const expiresAt = new Date(now.getTime() + contract.period_days * 86400000).toISOString()

    await supabase
      .from('contracts')
      .update({
        status: 'active',
        expires_at: expiresAt,
        last_checked_at: nowISO,
      })
      .eq('id', contract.id)

    // Notify both partners
    await pushToUser(
      supabase,
      contract.creator_id,
      'Контракт активирован',
      `«${contract.title}» — оба подписали! Контракт начинает действовать.`,
    )
    await pushToUser(
      supabase,
      contract.partner_id,
      'Контракт активирован',
      `«${contract.title}» — оба подписали! Контракт начинает действовать.`,
    )

    results.activated++
  }

  // ── 2. Mark expired active contracts as completed ─────────────
  const { data: expiredContracts } = await supabase
    .from('contracts')
    .select('id, creator_id, partner_id, title')
    .eq('status', 'active')
    .lt('expires_at', nowISO)

  for (const contract of expiredContracts ?? []) {
    await supabase
      .from('contracts')
      .update({ status: 'completed', last_checked_at: nowISO })
      .eq('id', contract.id)

    await pushToUser(
      supabase,
      contract.creator_id,
      'Контракт завершён',
      `«${contract.title}» — срок действия истёк. Молодцы!`,
    )
    await pushToUser(
      supabase,
      contract.partner_id,
      'Контракт завершён',
      `«${contract.title}» — срок действия истёк. Молодцы!`,
    )

    results.completed++
  }

  // ── 3. Remind about contracts expiring in 3 days ─────────────
  const in3Days = new Date(now.getTime() + 3 * 86400000).toISOString()
  const in4Days = new Date(now.getTime() + 4 * 86400000).toISOString()

  const { data: expiringSoon } = await supabase
    .from('contracts')
    .select('id, creator_id, partner_id, title, expires_at')
    .eq('status', 'active')
    .gte('expires_at', in3Days)
    .lt('expires_at', in4Days)

  for (const contract of expiringSoon ?? []) {
    const expiresDate = new Date(contract.expires_at).toLocaleDateString('ru-RU')

    await pushToUser(
      supabase,
      contract.creator_id,
      'Контракт истекает скоро',
      `«${contract.title}» завершится ${expiresDate}`,
    )
    await pushToUser(
      supabase,
      contract.partner_id,
      'Контракт истекает скоро',
      `«${contract.title}» завершится ${expiresDate}`,
    )

    results.expiringSoon++
  }

  // ── 4. Daily reminder for pending signatures ──────────────────
  // Only run once per day (check if current hour is 10:00 UTC)
  if (now.getUTCHours() === 10) {
    const { data: awaitingSignature } = await supabase
      .from('contracts')
      .select('id, creator_id, partner_id, title, signed_by_creator, signed_by_partner')
      .eq('status', 'pending')

    for (const contract of awaitingSignature ?? []) {
      if (!contract.signed_by_partner) {
        // Partner hasn't signed yet
        await pushToUser(
          supabase,
          contract.partner_id,
          'Ждём твою подпись',
          `«${contract.title}» — партнёр ждёт твоего решения`,
        )
        results.pendingReminders++
      }
    }
  }

  // Update last_checked_at for active contracts
  await supabase
    .from('contracts')
    .update({ last_checked_at: nowISO })
    .eq('status', 'active')
    .is('last_checked_at', null)

  return results
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const results = await checkContracts(supabase)

    return new Response(
      JSON.stringify({ ok: true, ...results }),
      { status: 200, headers: cors },
    )
  } catch (err) {
    console.error('[check-contracts] error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: cors },
    )
  }
})
