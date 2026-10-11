// Общие проверки доступа для Edge Functions.

type Env = { get(key: string): string | undefined }

/** Сравнение строк за постоянное время (без утечки по таймингу). Пустые строки не равны. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b) return false
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  let diff = ea.length ^ eb.length
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ (eb[i % eb.length] ?? 0)
  return diff === 0
}

export function bearerToken(req: Request): string {
  return (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
}

/**
 * Вызов от cron / другой серверной функции:
 *   - заголовок `x-cron-secret` совпадает с секретом CRON_SECRET, или
 *   - Bearer-токен — это service_role ключ (полное совпадение, не префикс).
 */
export function isTrustedServiceCall(req: Request, env: Env = Deno.env): boolean {
  const cronSecret = env.get('CRON_SECRET') ?? ''
  if (timingSafeEqual(req.headers.get('x-cron-secret') ?? '', cronSecret)) return true
  return timingSafeEqual(bearerToken(req), env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
}

type AuthClient = {
  auth: { getUser(jwt: string): Promise<{ data: { user: { id: string } | null }; error: unknown }> }
}

/** Пользователь из JWT в заголовке Authorization или null. */
export async function getCaller(req: Request, supabase: AuthClient) {
  const jwt = bearerToken(req)
  if (!jwt) return null
  const { data, error } = await supabase.auth.getUser(jwt)
  return error ? null : data?.user ?? null
}
