// Тарифы и проверка платежа ЮKassa. Цены задаются только на сервере.

export const PLANS = {
  premium:        { amountRub: 299,  months: 1,  description: 'Love App Premium — 1 месяц' },
  premium_yearly: { amountRub: 2490, months: 12, description: 'Love App Premium — 1 год' },
} as const

export type PlanId = keyof typeof PLANS

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === 'string' && Object.hasOwn(PLANS, v)
}

/**
 * Проверяет объект платежа, полученный НАПРЯМУЮ из API ЮKassa
 * (GET /v3/payments/{id}), а не из тела вебхука.
 * Возвращает данные для активации подписки или null.
 */
// deno-lint-ignore no-explicit-any
export function verifyPaidPayment(p: any) {
  if (!p || p.status !== 'succeeded' || p.paid !== true) return null
  const userId = p.metadata?.user_id
  const plan = p.metadata?.plan
  if (typeof userId !== 'string' || !userId || !isPlanId(plan)) return null
  if (p.amount?.currency !== 'RUB') return null
  const amountRub = Number.parseFloat(p.amount?.value)
  if (!Number.isFinite(amountRub) || amountRub < PLANS[plan].amountRub) return null
  return {
    paymentId: String(p.id),
    userId,
    plan,
    months: PLANS[plan].months,
    amountRub: Math.round(amountRub),
    paymentMethodId: (p.payment_method?.id as string | undefined) ?? null,
  }
}
