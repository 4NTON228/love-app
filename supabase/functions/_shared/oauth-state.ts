// OAuth `state` против login-CSRF: случайное значение в HttpOnly-cookie,
// которое должно вернуться от провайдера в параметре ?state=.
import { timingSafeEqual } from './auth.ts'

export const STATE_COOKIE = 'vk_oauth_state'

export function newOAuthState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function readCookie(header: string | null, name: string): string {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return ''
}

export function checkOAuthState(stateParam: string | null, cookieHeader: string | null): boolean {
  return timingSafeEqual(stateParam ?? '', readCookie(cookieHeader, STATE_COOKIE))
}

export function stateCookie(value: string, path: string): string {
  const maxAge = value ? 600 : 0
  return `${STATE_COOKIE}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`
}
