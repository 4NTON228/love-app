import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Screen } from '@/components/ui';
import { success, warn } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { colors, gradients, space, type } from '@/theme';

type Mode = 'signin' | 'signup' | 'reset';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function humanize(msg: string): string {
  if (/invalid login/i.test(msg)) return 'Неверная почта или пароль';
  if (/already registered/i.test(msg)) return 'Эта почта уже зарегистрирована — войди';
  if (/email not confirmed/i.test(msg)) return 'Подтверди почту по ссылке из письма';
  if (/rate limit|too many/i.test(msg)) return 'Слишком много попыток. Подожди минуту';
  if (/network/i.test(msg)) return 'Нет соединения с интернетом';
  return 'Что-то пошло не так. Попробуй ещё раз';
}

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit() {
    setError(null); setInfo(null);
    const mail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(mail)) { setError('Введи корректную почту'); warn(); return; }
    if (mode !== 'reset' && password.length < 6) { setError('Пароль — минимум 6 символов'); warn(); return; }
    if (mode === 'signup' && !name.trim()) { setError('Как тебя зовут?'); warn(); return; }

    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error: e } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (e) throw e;
      } else if (mode === 'signup') {
        const { data, error: e } = await supabase.auth.signUp({ email: mail, password, options: { data: { name: name.trim() } } });
        if (e) throw e;
        if (!data.session) setInfo('Мы отправили письмо — подтверди почту и войди.');
      } else {
        const { error: e } = await supabase.auth.resetPasswordForEmail(mail);
        if (e) throw e;
        setInfo('Ссылка для сброса пароля отправлена на почту.');
      }
      success();
    } catch (e) {
      setError(humanize((e as Error).message ?? ''));
      warn();
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<Mode, string> = { signin: 'С возвращением', signup: 'Создай аккаунт', reset: 'Сброс пароля' };

  return (
    <Screen edges={['top', 'bottom']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.logo} accessibilityElementsHidden>💞</Text>
            <Text style={type.display}>Love App</Text>
            <Text style={[type.small, { marginTop: 6, textAlign: 'center' }]}>Приватное пространство только для двоих</Text>
          </View>

          <Text style={[type.heading, { marginBottom: space.lg }]} accessibilityRole="header">{titles[mode]}</Text>

          {mode === 'signup' ? (
            <Field label="Имя" value={name} onChangeText={setName} autoComplete="name" textContentType="givenName" returnKeyType="next" />
          ) : null}
          <Field label="Почта" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email"
            keyboardType="email-address" textContentType="emailAddress" returnKeyType="next" />
          {mode !== 'reset' ? (
            <Field label="Пароль" value={password} onChangeText={setPassword} secureTextEntry
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              textContentType={mode === 'signup' ? 'newPassword' : 'password'} returnKeyType="go" onSubmitEditing={submit} />
          ) : null}

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {info ? <Text accessibilityLiveRegion="polite" style={styles.info}>{info}</Text> : null}

          <Button label={mode === 'signin' ? 'Войти' : mode === 'signup' ? 'Зарегистрироваться' : 'Отправить ссылку'}
            onPress={submit} loading={loading} style={{ marginTop: space.sm }} />

          <View style={styles.links}>
            {mode === 'signin' ? (
              <>
                <Link label="Нет аккаунта? Зарегистрироваться" onPress={() => setMode('signup')} />
                <Link label="Забыли пароль?" onPress={() => setMode('reset')} />
              </>
            ) : (
              <Link label="У меня уже есть аккаунт" onPress={() => setMode('signin')} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={{ paddingVertical: 10 }}>
      <Text style={{ color: colors.roseLight, fontSize: 15, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: space.xl, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: space.xxl },
  logo: { fontSize: 56, marginBottom: space.md },
  error: { color: colors.danger, marginBottom: space.md, fontSize: 14 },
  info: { color: colors.success, marginBottom: space.md, fontSize: 14 },
  links: { marginTop: space.lg },
});
