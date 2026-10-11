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
import { isPlanId, PLANS, verifyPaidPayment } from '../_shared/yookassa.ts'

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
      if (!isPlanId(plan)) return new Response(JSON.stringify({ error: 'Unknown plan' }), { status: 400, headers: cors })
      const amount = PLANS[plan].amountRub
      const description = PLANS[plan].description
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
    // Телу вебхука не доверяем: его может прислать кто угодно. Берём из него
    // только id платежа и перечитываем платёж напрямую из API ЮKassa.
    if (action === 'webhook' && req.method === 'POST') {
      const event = await req.json().catch(() => null)
      const paymentId = event?.object?.id
      if (typeof paymentId !== 'string' || !/^[\w-]{1,64}$/.test(paymentId)) {
        return new Response('ok', { headers: cors })
      }

      const ykRes = await fetch(`${YK_URL}/payments/${paymentId}`, { headers: ykHeaders() })
      if (ykRes.status === 404) return new Response('ok', { headers: cors })
      if (!ykRes.ok) {
        // 5xx → ЮKassa повторит вебхук позже
        console.error('ЮKassa payment fetch failed:', ykRes.status)
        return new Response(JSON.stringify({ error: 'upstream' }), { status: 502, headers: cors })
      }
      const payment = await ykRes.json()
      const userId = payment?.metadata?.user_id
      console.log('ЮKassa webhook:', event?.event, payment.id, payment.status)
      if (typeof userId !== 'string' || !userId) return new Response('ok', { headers: cors })

      const supabase = supabaseAdmin()

      await supabase.from('payment_events').insert({
        user_id: userId,
        yk_payment_id: payment.id,
        event_type: `payment.${payment.status}`,
        amount_rub: payment.amount ? Math.round(parseFloat(payment.amount.value)) : null,
        raw: payment,
      })

      const verified = verifyPaidPayment(payment)
      if (verified) {
        // Повторный вебхук того же платежа не продлевает подписку ещё раз
        const { data: current } = await supabase
          .from('subscriptions')
          .select('status, yk_payment_id')
          .eq('user_id', verified.userId)
          .maybeSingle()
        if (!(current?.status === 'active' && current?.yk_payment_id === verified.paymentId)) {
          const expiresAt = new Date()
          expiresAt.setMonth(expiresAt.getMonth() + verified.months)
          await supabase.from('subscriptions').upsert({
            user_id: verified.userId,
            status: 'active',
            plan: verified.plan,
            price_rub: verified.amountRub,
            started_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
            yk_payment_id: verified.paymentId,
            yk_payment_method_id: verified.paymentMethodId,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })
        }
      } else if (payment.status === 'canceled') {
        // Отменённый платёж гасит только «свою» неактивную запись,
        // а не уже оплаченную подписку.
        await supabase.from('subscriptions')
          .update({ status: 'inactive', updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('yk_payment_id', payment.id)
          .neq('status', 'active')
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
