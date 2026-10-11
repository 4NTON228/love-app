// Run: deno test supabase/functions/_shared/
import { assertEquals } from 'jsr:@std/assert@1'
import { expoMessages, invalidExpoTokens, isExpoSubscription } from './push.ts'

Deno.test('isExpoSubscription', () => {
  assertEquals(isExpoSubscription({ expo_token: 'ExponentPushToken[abc]' }), true)
  assertEquals(isExpoSubscription({ expo_token: 'ExpoPushToken[abc]', platform: 'ios' }), true)
  assertEquals(isExpoSubscription({ endpoint: 'https://fcm.googleapis.com/x', keys: {} }), false)
  assertEquals(isExpoSubscription({ expo_token: 'not-a-token' }), false)
  assertEquals(isExpoSubscription(null), false)
})

Deno.test('expoMessages', () => {
  assertEquals(expoMessages(['ExponentPushToken[a]'], 'Т', 'Б'), [
    { to: 'ExponentPushToken[a]', title: 'Т', body: 'Б', sound: 'default', priority: 'high', channelId: 'default' },
  ])
})

Deno.test('invalidExpoTokens picks DeviceNotRegistered', () => {
  const tokens = ['ExponentPushToken[a]', 'ExponentPushToken[b]', 'ExponentPushToken[c]']
  const res = { data: [
    { status: 'ok', id: '1' },
    { status: 'error', message: 'x', details: { error: 'DeviceNotRegistered' } },
    { status: 'error', message: 'y', details: { error: 'MessageRateExceeded' } },
  ] }
  assertEquals(invalidExpoTokens(tokens, res), ['ExponentPushToken[b]'])
  assertEquals(invalidExpoTokens(tokens, null), [])
})
