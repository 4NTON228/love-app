import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { DateField } from '@/components/DateField';
import { Avatar, Button, Card, Field, Screen } from '@/components/ui';
import { success, warn } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { PENDING_INVITE, useAuth } from '@/providers/AuthProvider';
import { colors, radius, space, type } from '@/theme';

type Found = { id: string; name: string | null; avatar_url: string | null };

export default function Onboarding() {
  const { session, profile, refresh, signOut } = useAuth();
  const uid = session!.user.id;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.name ?? '');
  const [birthday, setBirthday] = useState<string | null>(profile?.birthday ?? null);
  const [start, setStart] = useState<string | null>(profile?.couple_start_date ?? null);
  const [code, setCode] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const linked = !!profile?.partner_id;
  const myCode = profile?.invite_code ?? '';

  // Код из ссылки-приглашения подставляем сам
  useEffect(() => {
    AsyncStorage.getItem(PENDING_INVITE).then((c) => { if (c) setCode(c); });
  }, []);

  async function saveProfile() {
    if (!name.trim()) { setError('Как тебя зовут?'); warn(); return; }
    setBusy(true); setError(null);
    await supabase.from('profiles').upsert({ id: uid, name: name.trim(), birthday }, { onConflict: 'id' });
    setBusy(false);
    setStep(1);
  }

  async function findPartner() {
    const c = code.trim().toLowerCase();
    if (c.length < 4) return;
    setBusy(true); setError(null); setFound(null);
    const { data, error: e } = await supabase.rpc('find_profile_by_invite_code', { code: c });
    const f = Array.isArray(data) ? (data[0] as Found | undefined) : undefined;
    if (e || !f) setError('Профиль не найден. Проверь код.');
    else if (f.id === uid) setError('Это твой собственный код.');
    else setFound(f);
    setBusy(false);
  }

  async function connect() {
    setBusy(true); setError(null);
    const { data, error: e } = await supabase.rpc('connect_partner_by_invite', { p_invite_code: code.trim().toLowerCase() });
    setBusy(false);
    if (e || data?.error) { setError(data?.error ?? 'Не получилось подключиться. Попробуй снова.'); warn(); return; }
    await AsyncStorage.removeItem(PENDING_INVITE);
    if (data?.couple_start_date) setStart(data.couple_start_date);
    success();
    await refresh();
    setStep(2);
  }

  async function finish() {
    setBusy(true);
    if (start) {
      if (linked) await supabase.rpc('set_couple_start_date', { p_date: start });
      else await supabase.from('profiles').update({ couple_start_date: start }).eq('id', uid);
    }
    await supabase.from('profiles').update({ onboarding_done: true }).eq('id', uid);
    success();
    await refresh();
    setBusy(false);
  }

  const shareInvite = () => Share.share({
    message: `Присоединяйся ко мне в Love App 💞\nМой код: ${myCode}\nИли открой: loveapp://invite?code=${myCode}`,
  });

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.dots} accessibilityLabel={`Шаг ${step + 1} из 3`}>
            {[0, 1, 2].map((i) => <View key={i} style={[styles.dot, i <= step && styles.dotOn]} />)}
          </View>

          {step === 0 ? (
            <>
              <Text style={type.title} accessibilityRole="header">Давай познакомимся</Text>
              <Text style={[type.small, styles.sub]}>Это увидит только твоя половинка.</Text>
              <Field label="Имя" value={name} onChangeText={setName} autoComplete="name" />
              <DateField label="День рождения (по желанию)" value={birthday} onChange={setBirthday} maximumDate={new Date()} />
              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              <Button label="Дальше" onPress={saveProfile} loading={busy} style={{ marginTop: space.md }} />
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Text style={type.title} accessibilityRole="header">Соединитесь</Text>
              <Text style={[type.small, styles.sub]}>Отправь свой код партнёру или введи его код.</Text>

              {linked ? (
                <Card style={{ alignItems: 'center', marginBottom: space.lg }}>
                  <Text style={type.heading}>Вы уже вместе 💞</Text>
                </Card>
              ) : (
                <>
                  <Card style={{ marginBottom: space.lg }}>
                    <Text style={type.caption}>ТВОЙ КОД</Text>
                    <Text selectable style={styles.code} accessibilityLabel={`Твой код: ${myCode.split('').join(' ')}`}>{myCode || '…'}</Text>
                    <View style={{ flexDirection: 'row', gap: space.sm }}>
                      <Button label="Поделиться" icon="share-outline" onPress={shareInvite} style={{ flex: 1 }} />
                      <Button label="Копировать" variant="ghost" icon="copy-outline"
                        onPress={() => { Clipboard.setStringAsync(myCode); success(); }} style={{ flex: 1 }} />
                    </View>
                  </Card>

                  <Field label="Код партнёра" value={code} onChangeText={(t) => { setCode(t); setFound(null); }}
                    autoCapitalize="none" autoCorrect={false} returnKeyType="search" onSubmitEditing={findPartner} />
                  {found ? (
                    <Card style={styles.found}>
                      <Avatar uri={found.avatar_url} name={found.name} size={44} />
                      <Text style={[type.heading, { flex: 1 }]}>{found.name ?? 'Партнёр'}</Text>
                    </Card>
                  ) : null}
                  {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
                  {found
                    ? <Button label="Соединиться" icon="heart" onPress={connect} loading={busy} />
                    : <Button label="Найти" variant="ghost" onPress={findPartner} loading={busy} disabled={code.trim().length < 4} />}
                </>
              )}
              <Button label={linked ? 'Дальше' : 'Позже'} variant={linked ? 'primary' : 'ghost'} onPress={() => setStep(2)} style={{ marginTop: space.md }} />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={type.title} accessibilityRole="header">С какого дня вы вместе?</Text>
              <Text style={[type.small, styles.sub]}>Будем считать дни и напоминать о годовщинах.</Text>
              <DateField label="Дата начала отношений" value={start} onChange={setStart} maximumDate={new Date()} />
              <Button label="Готово 💞" onPress={finish} loading={busy} style={{ marginTop: space.md }} />
            </>
          ) : null}

          <Button label="Выйти из аккаунта" variant="ghost" onPress={signOut} style={{ marginTop: space.xxl, borderWidth: 0 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: space.xl },
  sub: { marginTop: 6, marginBottom: space.xl },
  dots: { flexDirection: 'row', gap: 6, marginBottom: space.xl },
  dot: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.roseLight },
  code: { fontSize: 32, letterSpacing: 4, color: colors.text, fontWeight: '700', marginVertical: space.md },
  found: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  error: { color: colors.danger, marginBottom: space.md },
});
