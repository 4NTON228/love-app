// Сессия Supabase + профиль + партнёр. Единый источник для всех экранов.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { registerForPush } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

export const PENDING_INVITE = 'pendingInvite';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  partner: Profile | null;
  initializing: boolean;
  /** Условие из App.jsx: показывать онбординг */
  needsOnboarding: boolean;
  markOnboardingDone: () => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Для экранов внутри защищённой зоны: сессия и профиль гарантированно есть. */
export function useMe() {
  const { session, profile, partner, refresh } = useAuth();
  if (!session || !profile) throw new Error('useMe outside signed-in area');
  return { uid: session.user.id, profile, partner, refresh };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [obDoneLocal, setObDoneLocal] = useState(false);

  const loadProfile = useCallback(async (userId: string) => {
    setObDoneLocal(!!(await AsyncStorage.getItem(`ob_done_${userId}`)));
    let { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle<Profile>();

    // Приглашение по ссылке loveapp://invite?code=… — подключаем после входа
    const invite = await AsyncStorage.getItem(PENDING_INVITE);
    if (invite && data && !data.partner_id) {
      const { data: res, error } = await supabase.rpc('connect_partner_by_invite', { p_invite_code: invite.trim().toLowerCase() });
      if (!error && !res?.error) {
        await AsyncStorage.removeItem(PENDING_INVITE);
        ({ data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle<Profile>());
      }
    }

    setProfile(data ?? null);
    if (data?.partner_id) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.partner_id).maybeSingle<Profile>();
      setPartner(p ?? null);
    } else {
      setPartner(null);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id).catch(() => {});
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (!s) { setProfile(null); setPartner(null); return; }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') loadProfile(s.user.id).catch(() => {});
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  // Push-подписка после входа, если разрешение уже выдано (как в App.jsx)
  useEffect(() => {
    const id = session?.user.id;
    if (id) registerForPush(id).catch(() => {});
  }, [session?.user.id]);

  // Живые изменения партнёра (настроение, «в сети», новый ключ)
  useEffect(() => {
    const pid = profile?.partner_id;
    if (!pid) return;
    const ch = supabase
      .channel(`partner-profile-${pid}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${pid}` },
        (p) => setPartner((prev) => ({ ...(prev ?? {}), ...(p.new as Profile) })))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.partner_id]);

  const uid = session?.user.id;

  const refresh = useCallback(async () => {
    if (uid) await loadProfile(uid);
  }, [uid, loadProfile]);

  // Как handleLogout в вебе — только выход
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const markOnboardingDone = useCallback(async () => {
    if (!uid) return;
    await AsyncStorage.setItem(`ob_done_${uid}`, '1');
    setObDoneLocal(true);
  }, [uid]);

  // App.jsx: !onboardingDoneLocally && (!profile || onboarding_done === false || (!name && onboarding_done !== true))
  const needsOnboarding = !!session && !obDoneLocal && (
    !profile || profile.onboarding_done === false || (!profile.name && profile.onboarding_done !== true)
  );

  const value = useMemo(() => ({ session, profile, partner, initializing, needsOnboarding, markOnboardingDone, refresh, signOut }),
    [session, profile, partner, initializing, needsOnboarding, markOnboardingDone, refresh, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
