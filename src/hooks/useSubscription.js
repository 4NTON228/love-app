/**
 * useSubscription — хук для проверки статуса подписки
 *
 * Использование:
 *   const { isPremium, loading, subscription } = useSubscription()
 *
 *   if (!isPremium) return <Paywall />
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const CACHE_KEY = 'sub_cache'
const CACHE_TTL = 5 * 60 * 1000 // 5 минут

export function useSubscription() {
  const [isPremium, setIsPremium] = useState(() => {
    // Быстрый старт из кэша, чтобы не мигать Paywall при загрузке
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
      if (c.exp && c.exp > Date.now()) return c.active
    } catch (_e) { /* ignore invalid cache */ }
    return false
  })
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState(null)

  const check = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setIsPremium(false); setLoading(false); return }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yookassa?action=status`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      )
      const data = await res.json()
      const active = !!data.active
      setIsPremium(active)
      setSubscription(data.subscription)

      // Кэшируем результат
      localStorage.setItem(CACHE_KEY, JSON.stringify({ active, exp: Date.now() + CACHE_TTL }))
    } catch (_e) {
      // При ошибке сети — не блокируем пользователя
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { check() }, [check])

  // Слушаем возврат с платёжной страницы
  useEffect(() => {
    if (window.location.search.includes('payment=success')) {
      // Сбрасываем кэш и перепроверяем
      localStorage.removeItem(CACHE_KEY)
      setTimeout(check, 2000) // ждём 2с пока ЮKassa обработает вебхук
    }
  }, [check])

  return { isPremium, loading, subscription, refresh: check }
}
