// Вход через Google в нативном приложении: Supabase OAuth во встроенном браузере,
// возврат по схеме loveapp:// и установка сессии из ответа.
// В Supabase → Authentication → URL Configuration нужно добавить loveapp://** в Redirect URLs.
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

function parseParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = [url.split('?')[1]?.split('#')[0], url.split('#')[1]].filter(Boolean) as string[];
  for (const part of parts) {
    for (const kv of part.split('&')) {
      const [k, v = ''] = kv.split('=');
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    }
  }
  return out;
}

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      // Всегда показывать выбор Google-аккаунта, а не входить молча
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) return { error: error.message };
  if (!data?.url) return { error: null };

  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return { error: null };

  const p = parseParams(res.url);
  if (p.error_description || p.error) return { error: p.error_description || p.error };
  if (p.code) {
    const { error: e } = await supabase.auth.exchangeCodeForSession(p.code);
    return { error: e?.message ?? null };
  }
  if (p.access_token && p.refresh_token) {
    const { error: e } = await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token });
    return { error: e?.message ?? null };
  }
  return { error: null };
}
