import AsyncStorage from '@react-native-async-storage/async-storage';
import { processLock } from '@supabase/auth-js';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Нет EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — см. mobile/.env.example');
}

export const SUPABASE_URL = url;

export const supabase = createClient(url, anonKey, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

// Обновляем токен только пока приложение на экране (рекомендация Supabase для RN)
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Адрес веб-версии (window.location.origin в вебе) */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || '').replace(/\/$/, '');
