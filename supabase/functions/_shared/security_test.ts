// Run: deno test supabase/functions/_shared/
import { assertEquals } from 'jsr:@std/assert@1'
import {
  bearerToken,
  isTrustedServiceCall,
  timingSafeEqual,
} from './auth.ts'
import { PLANS, verifyPaidPayment } from './yookassa.ts'
import { checkOAuthState, newOAuthState, readCookie } from './oauth-state.ts'
import { sanitizeAIMessages } from './ai.ts'

const env = (vars: Record<string, string>) => ({ get: (k: string) => vars[k] })
const req = (headers: Record<string, string>) =>
  new Request('https://x.test/fn', { method: 'POST', headers })

// ── auth ───────────────────────────────────────────────────────────────
Deno.test('timingSafeEqual', () => {
  assertEquals(timingSafeEqual('abc', 'abc'), true)
  assertEquals(timingSafeEqual('abc', 'abd'), false)
  assertEquals(timingSafeEqual('abc', 'abcd'), false)
  assertEquals(timingSafeEqual('', ''), false)
})

Deno.test('bearerToken', () => {
  assertEquals(bearerToken(req({ Authorization: 'Bearer t1' })), 't1')
  assertEquals(bearerToken(req({ authorization: 'bearer t2' })), 't2')
  assertEquals(bearerToken(req({})), '')
})

Deno.test('isTrustedServiceCall: service role bearer', () => {
  const e = env({ SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsSERVICE' })
  assertEquals(isTrustedServiceCall(req({ Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsSERVICE' }), e), true)
  // anon key shares the JWT header prefix — must NOT pass
  assertEquals(isTrustedServiceCall(req({ Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsANON' }), e), false)
  assertEquals(isTrustedServiceCall(req({}), e), false)
})

Deno.test('isTrustedServiceCall: cron secret header', () => {
  const e = env({ SUPABASE_SERVICE_ROLE_KEY: 'svc', CRON_SECRET: 's3cret-value' })
  assertEquals(isTrustedServiceCall(req({ 'x-cron-secret': 's3cret-value' }), e), true)
  assertEquals(isTrustedServiceCall(req({ 'x-cron-secret': 'wrong' }), e), false)
})

Deno.test('isTrustedServiceCall: unset secrets never match', () => {
  const e = env({})
  assertEquals(isTrustedServiceCall(req({ 'x-cron-secret': '' }), e), false)
  assertEquals(isTrustedServiceCall(req({ Authorization: 'Bearer ' }), e), false)
})

// ── yookassa ───────────────────────────────────────────────────────────
const paid = (over: Record<string, unknown> = {}) => ({
  id: 'pay_1',
  status: 'succeeded',
  paid: true,
  amount: { value: '299.00', currency: 'RUB' },
  metadata: { user_id: 'u1', plan: 'premium' },
  payment_method: { id: 'pm_1' },
  ...over,
})

Deno.test('verifyPaidPayment: accepts genuine payment', () => {
  assertEquals(verifyPaidPayment(paid()), {
    paymentId: 'pay_1', userId: 'u1', plan: 'premium',
    months: 1, amountRub: 299, paymentMethodId: 'pm_1',
  })
  const yearly = verifyPaidPayment(paid({
    amount: { value: '2490.00', currency: 'RUB' },
    metadata: { user_id: 'u1', plan: 'premium_yearly' },
  }))
  assertEquals(yearly?.months, 12)
})

Deno.test('verifyPaidPayment: rejects bad payments', () => {
  assertEquals(verifyPaidPayment(null), null)
  assertEquals(verifyPaidPayment(paid({ status: 'pending' })), null)
  assertEquals(verifyPaidPayment(paid({ paid: false })), null)
  assertEquals(verifyPaidPayment(paid({ metadata: { plan: 'premium' } })), null)
  assertEquals(verifyPaidPayment(paid({ metadata: { user_id: 'u1', plan: 'gold' } })), null)
  assertEquals(verifyPaidPayment(paid({ amount: { value: '1.00', currency: 'RUB' } })), null)
  assertEquals(verifyPaidPayment(paid({ amount: { value: '299.00', currency: 'USD' } })), null)
  // monthly price paid but yearly plan claimed
  assertEquals(verifyPaidPayment(paid({ metadata: { user_id: 'u1', plan: 'premium_yearly' } })), null)
})

Deno.test('PLANS prices', () => {
  assertEquals(PLANS.premium.amountRub, 299)
  assertEquals(PLANS.premium_yearly.amountRub, 2490)
})

// ── oauth state ────────────────────────────────────────────────────────
Deno.test('newOAuthState is random and url-safe', () => {
  const a = newOAuthState(), b = newOAuthState()
  assertEquals(a === b, false)
  assertEquals(/^[A-Za-z0-9_-]{32,}$/.test(a), true)
})

Deno.test('readCookie', () => {
  assertEquals(readCookie('a=1; vk_oauth_state=xyz; b=2', 'vk_oauth_state'), 'xyz')
  assertEquals(readCookie('', 'vk_oauth_state'), '')
  assertEquals(readCookie(null, 'vk_oauth_state'), '')
})

Deno.test('checkOAuthState', () => {
  assertEquals(checkOAuthState('abc123', 'vk_oauth_state=abc123'), true)
  assertEquals(checkOAuthState('abc123', 'vk_oauth_state=other'), false)
  assertEquals(checkOAuthState(null, 'vk_oauth_state=abc123'), false)
  assertEquals(checkOAuthState('abc123', null), false)
})

// ── ai ─────────────────────────────────────────────────────────────────
Deno.test('sanitizeAIMessages keeps valid roles and trims sizes', () => {
  const out = sanitizeAIMessages([
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'x'.repeat(10_000) },
    { role: 'tool', content: 'nope' },
    { role: 'assistant', content: 42 },
  ])
  assertEquals(out.length, 2)
  assertEquals(out[0], { role: 'system', content: 'sys' })
  assertEquals(out[1].content.length, 4000)
})

Deno.test('sanitizeAIMessages keeps only the last 20', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ role: 'user', content: String(i) }))
  const out = sanitizeAIMessages(many)
  assertEquals(out.length, 20)
  assertEquals(out[0].content, '10')
  assertEquals(sanitizeAIMessages('junk'), [])
})
