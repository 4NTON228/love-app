// Порт src/hooks/useSubscription.js: статус Premium через Edge Function yookassa?action=status,
// кэш на 5 минут, чтобы не мигал Paywall.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { SUPABASE_URL, supabase } from '@/lib/supabase';

const CACHE_KEY = 'sub_cache';
const CACHE_TTL = 5 * 60 * 1000;

export type Subscription = { status: string; plan: string; expires_at: string | null; started_at: string | null } | null;

export function useSubscription() {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription>(null);

  const check = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setIsPremium(false); setLoading(false); return; }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/yookassa?action=status`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json();
      const active = !!data.active;
      setIsPremium(active);
      setSubscription(data.subscription ?? null);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ active, exp: Date.now() + CACHE_TTL }));
    } catch {
      // при ошибке сети не блокируем пользователя
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // быстрый старт из кэша
    AsyncStorage.getItem(CACHE_KEY).then((raw) => {
      try {
        const c = JSON.parse(raw || '{}');
        if (c.exp && c.exp > Date.now()) setIsPremium(!!c.active);
      } catch { /* ignore invalid cache */ }
    });
    (async () => { await check(); })();
  }, [check]);

  /** Вернулись с платёжной страницы: сбросить кэш и перепроверить через 2 с (ждём вебхук ЮKassa) */
  const afterPayment = useCallback(async () => {
    await AsyncStorage.removeItem(CACHE_KEY);
    setTimeout(check, 2000);
  }, [check]);

  return { isPremium, loading, subscription, refresh: check, afterPayment };
}
