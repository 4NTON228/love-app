// Нативные push мобильного приложения через Expo Push Service.
// В push_subscriptions.subscription мобильное приложение кладёт
// { expo_token: 'ExponentPushToken[…]', platform }, веб — web-push подписку.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const TOKEN_RE = /^Expo(nent)?PushToken\[.+\]$/

// deno-lint-ignore no-explicit-any
export function isExpoSubscription(sub: any): sub is { expo_token: string } {
  return typeof sub?.expo_token === 'string' && TOKEN_RE.test(sub.expo_token)
}

export function expoMessages(tokens: string[], title: string, body: string) {
  return tokens.map((to) => ({ to, title, body, sound: 'default', priority: 'high', channelId: 'default' }))
}

/** Токены, которые Expo пометил как DeviceNotRegistered (приложение удалено). */
// deno-lint-ignore no-explicit-any
export function invalidExpoTokens(tokens: string[], response: any): string[] {
  const tickets = Array.isArray(response?.data) ? response.data : []
  return tokens.filter((_, i) => tickets[i]?.status === 'error' && tickets[i]?.details?.error === 'DeviceNotRegistered')
}

/** Отправка; возвращает число успешных и протухшие токены. */
export async function sendExpoPush(tokens: string[], title: string, body: string) {
  if (!tokens.length) return { sent: 0, invalid: [] as string[] }
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(expoMessages(tokens, title, body)),
  })
  const json = await res.json().catch(() => null)
  const tickets = Array.isArray(json?.data) ? json.data : []
  // deno-lint-ignore no-explicit-any
  const sent = tickets.filter((t: any) => t?.status === 'ok').length
  return { sent, invalid: invalidExpoTokens(tokens, json) }
}
