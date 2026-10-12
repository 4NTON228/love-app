// Порт Auth.jsx (+ .auth-* из globals.css): вход, регистрация, сброс пароля, Google.
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type TextInputProps,
} from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { signInWithGoogle } from '@/lib/oauth';
import { supabase, WEB_URL } from '@/lib/supabase';
import { fonts } from '@/theme';

type Tab = 'login' | 'register' | 'reset';

const ROSE = 'hsl(349, 59%, 41%)';

function Glow({ size, color, style }: { size: number; color: string; style: object }) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="g" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="0.7" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={size} height={size} fill="url(#g)" />
      </Svg>
    </View>
  );
}

const GoogleIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 48 48">
    <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </Svg>
);

function AuthField({ label, ...props }: TextInputProps & { label: string }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label.toUpperCase()}</Text>
      <TextInput
        placeholderTextColor="rgba(255,255,255,0.22)" selectionColor={ROSE} autoCapitalize="none" autoCorrect={false}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        {...props}
        style={[s.input, focus && s.inputFocus]}
      />
    </View>
  );
}

function AuthBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [s.btn, disabled && { opacity: 0.5, shadowOpacity: 0, elevation: 0 }, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}>
      <Text style={s.btnText}>{label}</Text>
    </Pressable>
  );
}

function GoogleBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [s.google, pressed && { backgroundColor: 'rgba(255,255,255,0.12)', transform: [{ scale: 0.98 }] }]}>
      <GoogleIcon />
      <Text style={s.googleText}>{label}</Text>
    </Pressable>
  );
}

function Divider() {
  return (
    <View style={s.divider}>
      <View style={s.dividerLine} />
      <Text style={s.dividerText}>или</Text>
      <View style={s.dividerLine} />
    </View>
  );
}

function LinkBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ marginTop: 14, alignSelf: 'stretch' }}>
      {({ pressed }) => <Text style={[s.link, pressed && { color: 'rgba(255,255,255,0.65)' }]}>{label}</Text>}
    </Pressable>
  );
}

export default function Auth() {
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [pop] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(pop, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, [pop]);

  function reset() { setError(null); setSuccess(null); }

  // В вебе поля required: пустую форму браузер не отправляет
  const filled = (...v: string[]) => v.every((x) => x.length > 0);

  async function handleLogin() {
    if (!filled(email, password)) return;
    reset(); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError(
      error.message === 'Invalid login credentials' ? 'Неверный email или пароль. Если вы новый пользователь — перейдите на вкладку «Регистрация».' :
      error.message === 'Email not confirmed' ? 'Подтвердите email — письмо отправлено при регистрации' :
      error.message,
    );
    setLoading(false);
  }

  async function handleRegister() {
    if (!filled(email, password, confirm)) return;
    reset();
    if (password !== confirm) { setError('Пароли не совпадают'); return; }
    if (password.length < 6) { setError('Пароль должен быть не менее 6 символов'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: WEB_URL ? { emailRedirectTo: WEB_URL } : undefined,
    });
    if (error) setError(error.message);
    else setSuccess('Письмо с подтверждением отправлено на ' + email.trim() + '. Проверьте почту (и папку «Спам»).');
    setLoading(false);
  }

  async function handleReset() {
    if (!filled(email)) return;
    reset(); setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), WEB_URL ? { redirectTo: WEB_URL + '/?reset=true' } : undefined);
    if (error) setError(error.message);
    else setSuccess('Письмо для сброса пароля отправлено на ' + email.trim());
    setLoading(false);
  }

  async function handleGoogle() {
    reset();
    const { error } = await signInWithGoogle();
    if (error) setError(error);
  }

  const openDoc = (path: string) => { if (WEB_URL) WebBrowser.openBrowserAsync(WEB_URL + path).catch(() => {}); };

  const emailProps: TextInputProps = {
    value: email, onChangeText: setEmail, placeholder: 'email@example.com',
    keyboardType: 'email-address', autoComplete: 'email', textContentType: 'emailAddress',
  };

  return (
    <View style={s.bg}>
      <Glow size={400} color="rgba(168,40,60,0.18)" style={{ top: -120, alignSelf: 'center' }} />
      <Glow size={300} color="rgba(110,20,36,0.12)" style={{ bottom: -80, right: -60 }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, alignSelf: 'stretch' }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Wordmark */}
          <View style={{ marginBottom: 28, alignItems: 'center' }}>
            <Text style={s.wordmark}>Love</Text>
            <Text style={s.wordmarkSub}>YOUR STORY</Text>
          </View>

          <Animated.View style={[s.card, {
            opacity: pop,
            transform: [{ scale: pop.interpolate({ inputRange: [0, 0.65, 1], outputRange: [0.88, 1.03, 1] }) }],
          }]}>
            <Text style={s.title} accessibilityRole="header">{tab === 'reset' ? 'Восстановление' : 'Добро пожаловать'}</Text>
            <Text style={s.subtitle}>{tab === 'reset' ? 'Укажите ваш email' : 'Ваша личная история'}</Text>

            {tab !== 'reset' ? (
              <View style={s.tabs}>
                {(['login', 'register'] as const).map((t) => (
                  <Pressable key={t} onPress={() => { setTab(t); reset(); }} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}
                    style={[s.tab, tab === t && s.tabActive]}>
                    <Text style={[s.tabText, tab === t && { color: 'rgba(237,233,226,0.92)' }]}>{t === 'login' ? 'Вход' : 'Регистрация'}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {error ? <View style={s.error} accessibilityRole="alert"><Text style={s.errorText}>{error}</Text></View> : null}
            {success ? <View style={s.success}><Text style={s.successText}>{success}</Text></View> : null}

            {/* LOGIN */}
            {tab === 'login' && !success ? (
              <View>
                <AuthField label="Email" {...emailProps} />
                <AuthField label="Пароль" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry
                  autoComplete="current-password" textContentType="password" onSubmitEditing={handleLogin} />
                <AuthBtn label={loading ? 'Входим…' : 'Войти'} onPress={handleLogin} disabled={loading} />
                <Divider />
                <GoogleBtn label="Войти через Google" onPress={handleGoogle} />
                <LinkBtn label="Забыли пароль?" onPress={() => { setTab('reset'); reset(); }} />
              </View>
            ) : null}

            {/* REGISTER */}
            {tab === 'register' && !success ? (
              <View>
                <AuthField label="Email" {...emailProps} />
                <AuthField label="Пароль" value={password} onChangeText={setPassword} placeholder="Минимум 6 символов" secureTextEntry
                  autoComplete="new-password" textContentType="newPassword" />
                <AuthField label="Повторите пароль" value={confirm} onChangeText={setConfirm} placeholder="••••••••" secureTextEntry
                  autoComplete="new-password" textContentType="newPassword" />
                <AuthBtn label={loading ? 'Создаём аккаунт…' : 'Создать аккаунт'} onPress={handleRegister} disabled={loading || !consent} />
                <Divider />
                <GoogleBtn label="Зарегистрироваться через Google" onPress={handleGoogle} />
                <Pressable onPress={() => setConsent((c) => !c)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }} style={s.consent}>
                  <View style={[s.checkbox, consent && { backgroundColor: ROSE, borderColor: ROSE }]}>
                    {consent ? <Svg width={10} height={10} viewBox="0 0 12 12"><Path d="M2 6.5l2.5 2.5L10 3.5" stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg> : null}
                  </View>
                  <Text style={s.consentText}>
                    Регистрируясь, я принимаю{' '}
                    <Text style={s.consentLink} onPress={() => openDoc('/privacy.html')}>Политику конфиденциальности</Text>{' '}
                    и <Text style={s.consentLink} onPress={() => openDoc('/terms.html')}>Условия использования</Text>,
                    и даю согласие на обработку персональных данных
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* RESET */}
            {tab === 'reset' && !success ? (
              <View>
                <AuthField label="Email" {...emailProps} onSubmitEditing={handleReset} />
                <AuthBtn label={loading ? 'Отправляем…' : 'Отправить письмо'} onPress={handleReset} disabled={loading} />
                <LinkBtn label="Вернуться ко входу" onPress={() => { setTab('login'); reset(); }} />
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0E0C0A', alignItems: 'center', overflow: 'hidden' },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  wordmark: {
    fontFamily: fonts.displayLightItalic, fontSize: 36, letterSpacing: 1, color: 'rgba(237,233,226,0.88)',
    lineHeight: 36, marginBottom: 6,
  },
  wordmarkSub: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 5, color: 'rgba(237,233,226,0.28)' },
  card: {
    width: '100%', maxWidth: 340, backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 24,
    paddingTop: 32, paddingHorizontal: 24, paddingBottom: 28,
    shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 48, shadowOffset: { width: 0, height: 32 }, elevation: 12,
  },
  title: { fontFamily: fonts.displayItalic, fontSize: 30, color: '#EDE9E2', textAlign: 'center', marginBottom: 4, letterSpacing: 0.5 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginBottom: 24 },
  tabs: { flexDirection: 'row', marginBottom: 24, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 3 },
  tab: { flex: 1, paddingVertical: 9, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center' },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  tabText: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.38)' },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.8, marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 13,
    paddingVertical: 13, paddingHorizontal: 16, fontSize: 15, color: '#EDE9E2', fontFamily: fonts.body,
  },
  inputFocus: { backgroundColor: 'rgba(255,255,255,0.09)', borderColor: 'hsl(349, 59%, 50%)' },
  error: {
    backgroundColor: 'rgba(200,40,60,0.1)', borderWidth: 0.5, borderColor: 'rgba(200,40,60,0.25)', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12,
  },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,160,170,0.9)', textAlign: 'center' },
  success: {
    backgroundColor: 'rgba(50,160,90,0.1)', borderWidth: 0.5, borderColor: 'rgba(50,160,90,0.28)', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 12,
  },
  successText: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(160,220,180,0.92)', textAlign: 'center', lineHeight: 20 },
  btn: {
    backgroundColor: ROSE, borderRadius: 13, padding: 14, marginTop: 8, alignItems: 'center',
    shadowColor: ROSE, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  btnText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: '#fff', letterSpacing: 0.2 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, marginBottom: 6 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: { fontFamily: fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.22)', letterSpacing: 0.6 },
  google: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 13,
    padding: 13, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  googleText: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(237,233,226,0.78)' },
  link: { fontFamily: fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12, marginBottom: 4 },
  checkbox: {
    width: 16, height: 16, marginTop: 2, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  consentText: { flex: 1, fontFamily: fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 17.6 },
  consentLink: { color: 'rgba(255,255,255,0.5)', textDecorationLine: 'underline' },
});
