// Порт Onboarding.jsx — многошаговый мастер настройки профиля (светлая тема веба: рендерится вне .app.dark).
// 1. Приветствие  2. Имя + аватар  3. День рождения  4. Дата начала отношений  5. Подключение партнёра
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useEffect, useState } from 'react';
import {
  Alert, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Polyline, Stop } from 'react-native-svg';

import { Spin, useLoop } from '@/components/anim';
import { DateTimeInput } from '@/components/DateTimeInput';
import { QRCode } from '@/components/QRCode';
import { chooseImage, validateImageFile } from '@/lib/media';
import { supabase, WEB_URL } from '@/lib/supabase';
import { PENDING_INVITE, useAuth } from '@/providers/AuthProvider';
import { cssLinear, fonts } from '@/theme';

const TOTAL_STEPS = 5;

// :root (светлая тема): --text: #1A1714, --text-muted: #8A8480, --surface-2: #F2EEE6
const TEXT = '#1A1714';
const MUTED = '#8A8480';
const SURFACE2 = '#F2EEE6';
const ROSE = '#C8334A';
const BTN_GRADIENT = cssLinear(135, ['#C8334A', '#8B1A2C']);

const HEART = 'M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z';

const todayMax = () => new Date();

/* ── Компонент шага прогресса ── */
function StepDots({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 32 }}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View key={i} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 99, backgroundColor: i <= step ? ROSE : 'rgba(200,51,74,0.15)' }} />
      ))}
    </View>
  );
}

/* ── Кнопка «Далее» ── */
function NextBtn({ onPress, label = 'Далее', disabled = false, loading = false }: { onPress: () => void; label?: string; disabled?: boolean; loading?: boolean }) {
  const off = disabled || loading;
  return (
    <Pressable onPress={onPress} disabled={off} accessibilityRole="button" accessibilityState={{ disabled: off }}
      style={[s.nextBtn, disabled ? { backgroundColor: 'rgba(200,51,74,0.2)' } : s.nextShadow]}>
      {!disabled ? <LinearGradient {...BTN_GRADIENT} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} /> : null}
      <Text style={[s.nextText, { color: disabled ? 'rgba(200,51,74,0.5)' : 'white' }]}>{loading ? 'Сохраняем...' : label}</Text>
    </Pressable>
  );
}

function TextBtn({ label, onPress, style, textStyle }: { label: string; onPress: () => void; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle> }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[{ width: '100%', padding: 12, alignItems: 'center' }, style]}>
      <Text style={[{ fontFamily: fonts.body, color: MUTED, fontSize: 14 }, textStyle]}>{label}</Text>
    </Pressable>
  );
}

function H2({ children, size = 28 }: { children: ReactNode; size?: number }) {
  return <Text style={[s.h2, { fontSize: size }]} accessibilityRole="header">{children}</Text>;
}

function Sub({ children, mb = 28 }: { children: ReactNode; mb?: number }) {
  return <Text style={[s.sub, { marginBottom: mb }]}>{children}</Text>;
}

function HeartIcon({ w = 70, h = 65 }: { w?: number; h?: number }) {
  return <Svg viewBox="0 0 60 56" width={w} height={h} fill="none"><Path d={HEART} fill={ROSE} /></Svg>;
}

function Spinner({ size, border }: { size: number; border: number }) {
  return (
    <Spin duration={800}>
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: border, borderColor: 'rgba(200,51,74,0.2)', borderTopColor: ROSE }} />
    </Spin>
  );
}

/* ── Шаг 1: Приветствие ── */
function StepWelcome({ onNext, onSignOut }: { onNext: () => void; onSignOut: () => void }) {
  const beat = useLoop(1500);
  return (
    <View style={{ alignItems: 'center', paddingTop: 40 }}>
      <Animated.View style={{ marginBottom: 24, transform: [{ scale: beat.interpolate({ inputRange: [0, 0.15, 0.3, 0.45, 1], outputRange: [1, 1.3, 1.05, 1.2, 1] }) }] }}>
        <Svg viewBox="0 0 60 56" width={90} height={84} fill="none">
          <Defs>
            <SvgLinearGradient id="wlcGrad" x1="0" y1="0" x2="60" y2="56" gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor="#E8556A" />
              <Stop offset="100%" stopColor="#C8334A" />
            </SvgLinearGradient>
          </Defs>
          <Path d={HEART} fill="url(#wlcGrad)" />
        </Svg>
      </Animated.View>
      <Text style={s.welcomeTitle} accessibilityRole="header">Добро пожаловать!</Text>
      <Text style={s.welcomeText}>
        Love App — личное пространство для вас двоих.{'\n'}
        Давай настроим всё за пару минут.
      </Text>
      <NextBtn onPress={onNext} label="Начать →" />
      <Pressable onPress={onSignOut} accessibilityRole="button" style={{ marginTop: 20, padding: 8 }}>
        <Text style={{ fontFamily: fonts.body, color: MUTED, fontSize: 13, textDecorationLine: 'underline' }}>Вернуться ко входу</Text>
      </Pressable>
    </View>
  );
}

/* ── Шаг 2: Имя + Аватар ── */
type ProfileData = { name: string; avatar_url: string | null };

function StepProfile({ value, onChange, onNext }: { value: ProfileData; onChange: (v: ProfileData) => void; onNext: () => void }) {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(value.avatar_url || null);
  const [uploading, setUploading] = useState(false);

  async function handleAvatar() {
    const file = await chooseImage();
    if (!file) return;
    const fileErr = validateImageFile(file);
    if (fileErr) { Alert.alert(fileErr); return; }
    setAvatarPreview(file.uri);
    setUploading(true);
    try {
      const type = file.mimeType || 'image/jpeg';
      const ext = type.split('/')[1] || 'jpg';
      const path = `avatars/${Date.now()}.${ext}`;
      const bytes = await new File(file.uri).arrayBuffer();
      const { error: upErr } = await supabase.storage.from('photos').upload(path, bytes, { upsert: true, contentType: type });
      if (!upErr) {
        const { data } = supabase.storage.from('photos').getPublicUrl(path);
        onChange({ ...value, avatar_url: data.publicUrl });
      }
    } catch { /* ignore upload errors */ } finally {
      setUploading(false);
    }
  }

  return (
    <View>
      <H2>Расскажи о себе</H2>
      <Sub>Партнёр увидит это в приложении</Sub>

      {/* Аватар */}
      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <Pressable onPress={handleAvatar} accessibilityRole="button" accessibilityLabel="Выбрать фото" style={s.avatar}>
          {avatarPreview ? (
            <Image source={{ uri: avatarPreview }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <>
              <LinearGradient {...cssLinear(135, ['#FBF0F2', '#F2D0D6'])} style={StyleSheet.absoluteFill} />
              <View style={{ alignItems: 'center' }}>
                <Svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke={ROSE} strokeWidth={1.5}>
                  <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <Circle cx="12" cy="13" r="4" />
                </Svg>
                <Text style={{ fontFamily: fonts.body, fontSize: 10, color: ROSE, marginTop: 2 }}>Фото</Text>
              </View>
            </>
          )}
          {uploading ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(200,51,74,0.5)', alignItems: 'center', justifyContent: 'center' }]}>
              <Spin duration={800}><View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'white', borderTopColor: 'transparent' }} /></Spin>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Имя */}
      <View style={{ marginBottom: 20 }}>
        <Text style={s.fieldLabel}>ТВОЁ ИМЯ</Text>
        <TextInput
          placeholder="Как тебя зовут?" placeholderTextColor="#A9A29C" selectionColor={ROSE}
          value={value.name || ''} onChangeText={(t) => onChange({ ...value, name: t })}
          style={s.input} autoComplete="given-name" textContentType="givenName"
        />
      </View>

      <NextBtn onPress={onNext} disabled={!value.name?.trim()} />
    </View>
  );
}

function DateBox({ value, onChange, style }: { value: string; onChange: (v: string) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <DateTimeInput value={value} onChange={onChange} maximumDate={todayMax()} themeVariant="light"
      style={[s.input, { minHeight: 52 }, style]} textStyle={{ fontFamily: fonts.body, fontSize: 16, color: TEXT }} placeholderColor="#A9A29C" />
  );
}

/* ── Шаг 3: День рождения ── */
function StepBirthday({ value, onChange, onNext, onSkip }: { value: string; onChange: (v: string) => void; onNext: () => void; onSkip: () => void }) {
  return (
    <View>
      <H2>День рождения</H2>
      <Sub>Партнёр сможет не забыть поздравить тебя</Sub>
      <View style={{ marginBottom: 28 }}><DateBox value={value} onChange={onChange} /></View>
      <NextBtn onPress={onNext} disabled={!value} />
      <TextBtn label="Пропустить" onPress={onSkip} style={{ marginTop: 10 }} />
    </View>
  );
}

/* ── Шаг 4: Дата начала отношений ── */
function StepRelationship({ value, onChange, onNext, onSkip }: { value: string; onChange: (v: string) => void; onNext: () => void; onSkip: () => void }) {
  const [now] = useState(() => Date.now());
  return (
    <View>
      <H2>Когда вы вместе?</H2>
      <Sub>Дата начала ваших отношений — приложение будет считать дни вместе</Sub>
      <View style={{ marginBottom: 28 }}><DateBox value={value} onChange={onChange} /></View>

      {value ? (
        <View style={s.daysBox}>
          {/* new Date('YYYY-MM-DD') в вебе — полночь UTC */}
          <Text style={s.daysText}>{Math.floor((now - Date.parse(value + 'T00:00:00Z')) / 86400000)} дней вместе</Text>
        </View>
      ) : null}

      <NextBtn onPress={onNext} disabled={!value} />
      <TextBtn label="Указать позже" onPress={onSkip} style={{ marginTop: 10 }} />
    </View>
  );
}

/* ── Шаг 5: Подключение партнёра ── */
type FoundPartner = { id: string; name: string | null; avatar_url: string | null };
type AutoResult = { couple_start_date?: string | null } | null;

function StepPartner({ uid, inviteCode, partnerAlreadyLinked, pendingInvite, onFinish }: {
  uid: string; inviteCode: string | null; partnerAlreadyLinked: boolean; pendingInvite: string | null; onFinish: () => void;
}) {
  const [mode, setMode] = useState<'invite' | 'enter'>('invite');
  const [code, setCode] = useState('');
  const [foundPartner, setFoundPartner] = useState<FoundPartner | null>(null);
  const [searching, setSearching] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [autoPhase, setAutoPhase] = useState<'connecting' | 'success' | 'error' | null>(pendingInvite ? 'connecting' : null);
  const [autoRetry, setAutoRetry] = useState(0);
  const [autoResult, setAutoResult] = useState<AutoResult>(null);
  const [dateChoice, setDateChoice] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState(false);
  const [savingDate, setSavingDate] = useState(false);

  // Автоподключение при входе по ссылке-приглашению
  useEffect(() => {
    if (!pendingInvite) return;
    let cancelled = false;
    (async () => {
      setAutoPhase('connecting');
      const { data, error: rpcErr } = await supabase.rpc('connect_partner_by_invite', { p_invite_code: pendingInvite.trim().toLowerCase() });
      if (cancelled) return;
      if (!rpcErr && !data?.error) {
        await AsyncStorage.removeItem(PENDING_INVITE);
        setAutoResult(data);
        setDateChoice(data?.couple_start_date || null);
        setAutoPhase('success');
      } else {
        setAutoPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, [pendingInvite, autoRetry]);

  async function confirmDate() {
    if (!dateChoice) { onFinish(); return; }
    setSavingDate(true);
    await supabase.rpc('set_couple_start_date', { p_date: dateChoice }).then(() => {}, () => {});
    setSavingDate(false);
    onFinish();
  }

  const inviteLink = `${WEB_URL}/?invite=${inviteCode}`;

  async function copyLink() {
    await Clipboard.setStringAsync(inviteLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function searchPartner() {
    if (code.trim().length < 4) return;
    setSearching(true); setError(null); setFoundPartner(null);
    const { data, error: err } = await supabase.rpc('find_profile_by_invite_code', { code: code.trim().toLowerCase() });
    const found = Array.isArray(data) ? (data[0] as FoundPartner | undefined) : null;
    if (err || !found) setError('Профиль не найден. Проверь код.');
    else if (found.id === uid) setError('Это твой собственный код.');
    else setFoundPartner(found);
    setSearching(false);
  }

  async function connectPartner() {
    if (!foundPartner) return;
    setConnecting(true);
    const { data, error: rpcErr } = await supabase.rpc('connect_partner_by_invite', { p_invite_code: code.trim() });
    if (rpcErr || data?.error) {
      setError(data?.error ?? 'Ошибка подключения. Попробуй снова.');
      setConnecting(false);
      return;
    }
    onFinish();
  }

  if (pendingInvite && autoPhase === 'connecting') {
    return (
      <View style={{ alignItems: 'center', paddingTop: 60 }}>
        <View style={{ marginBottom: 24 }}><Spinner size={48} border={3} /></View>
        <H2 size={24}>Подключаем партнёра...</H2>
        <Text style={[s.sub, { textAlign: 'center' }]}>Устанавливаем связь</Text>
      </View>
    );
  }

  if (pendingInvite && autoPhase === 'success') {
    const proposed = autoResult?.couple_start_date;
    return (
      <View style={{ alignItems: 'center', paddingTop: 20 }}>
        <View style={{ marginBottom: 16 }}><HeartIcon /></View>
        <H2 size={26}>Партнёр подключён!</H2>

        {proposed ? (
          <View style={{ marginBottom: 28, alignSelf: 'stretch', alignItems: 'center' }}>
            <Text style={[s.sub, { marginBottom: 16, textAlign: 'center' }]}>Партнёр предложил дату начала отношений:</Text>
            <View style={s.proposed}>
              <Text style={s.proposedText}>
                {new Date(proposed + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>

            {editingDate ? (
              <View style={{ marginBottom: 12, alignSelf: 'stretch', alignItems: 'center' }}>
                <DateBox value={dateChoice || ''} onChange={setDateChoice} style={{ alignSelf: 'stretch', marginBottom: 10, borderRadius: 12, borderColor: 'rgba(200,51,74,0.2)' }} />
                <Pressable onPress={() => setEditingDate(false)} accessibilityRole="button" style={{ marginBottom: 8 }}>
                  <Text style={{ fontFamily: fonts.body, color: MUTED, fontSize: 13 }}>Использовать предложенную дату</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setEditingDate(true)} accessibilityRole="button" style={{ marginBottom: 16 }}>
                <Text style={{ fontFamily: fonts.body, color: 'rgba(200,51,74,0.7)', fontSize: 13, textDecorationLine: 'underline' }}>Изменить дату</Text>
              </Pressable>
            )}
            <View style={{ alignSelf: 'stretch' }}><NextBtn onPress={confirmDate} label="Подтвердить и открыть →" loading={savingDate} /></View>
          </View>
        ) : (
          <View style={{ marginBottom: 28, alignSelf: 'stretch' }}>
            <Text style={[s.sub, { marginBottom: 32, textAlign: 'center', fontSize: 15 }]}>Всё готово к использованию</Text>
            <NextBtn onPress={onFinish} label="Открыть приложение →" />
          </View>
        )}
      </View>
    );
  }

  if (pendingInvite && autoPhase === 'error') {
    return (
      <View style={{ alignItems: 'center', paddingTop: 40 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
        <H2 size={24}>Не удалось подключиться</H2>
        <Text style={[s.sub, { textAlign: 'center' }]}>Возможно, приглашение уже использовано или истекло</Text>
        <Pressable onPress={() => setAutoRetry((k) => k + 1)} accessibilityRole="button" style={[s.nextBtn, s.nextShadow, { padding: 13, marginBottom: 12 }]}>
          <LinearGradient {...BTN_GRADIENT} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
          <Text style={[s.nextText, { color: 'white' }]}>Попробовать снова</Text>
        </Pressable>
        <TextBtn label="Пропустить — подключу партнёра позже" onPress={onFinish} textStyle={{ fontSize: 13 }} />
      </View>
    );
  }

  if (partnerAlreadyLinked) {
    return (
      <View style={{ alignItems: 'center', paddingTop: 20 }}>
        <View style={{ marginBottom: 16 }}><HeartIcon /></View>
        <H2 size={26}>Партнёр уже подключён!</H2>
        <Text style={[s.sub, { marginBottom: 32, textAlign: 'center', fontSize: 15 }]}>Всё готово к использованию</Text>
        <View style={{ alignSelf: 'stretch' }}><NextBtn onPress={onFinish} label="Открыть приложение →" /></View>
      </View>
    );
  }

  const canSearch = code.length >= 4;

  return (
    <View>
      <H2>Пригласи партнёра</H2>
      <Sub mb={24}>Приложение работает только для пары — пригласи своего человека</Sub>

      {/* Переключатель */}
      <View style={s.switch}>
        {([['invite', 'Моя ссылка'], ['enter', 'Ввести код']] as const).map(([m, l]) => (
          <Pressable key={m} onPress={() => { setMode(m); setError(null); setFoundPartner(null); }} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}
            style={[s.switchBtn, mode === m && s.switchActive]}>
            <Text style={{ fontFamily: mode === m ? fonts.bodyBold : fonts.body, fontSize: 14, color: mode === m ? ROSE : MUTED }}>{l}</Text>
          </Pressable>
        ))}
      </View>

      {/* Режим: показать свою ссылку/QR */}
      {mode === 'invite' ? (
        <View>
          {inviteCode ? (
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{ borderRadius: 16, overflow: 'hidden' }}><QRCode value={inviteLink} size={180} /></View>
            </View>
          ) : null}

          <View style={s.linkBox}><Text style={s.linkText} selectable>{inviteLink}</Text></View>

          <Pressable onPress={copyLink} accessibilityRole="button" style={[s.copyBtn, { backgroundColor: copied ? 'rgba(200,51,74,0.08)' : 'white' }]}>
            <Text style={{ fontFamily: fonts.bodySemi, color: ROSE, fontSize: 15 }}>{copied ? '✓ Скопировано!' : 'Скопировать ссылку'}</Text>
          </Pressable>

          <Pressable onPress={() => Share.share({ title: 'Love App', message: inviteLink, url: inviteLink })} accessibilityRole="button" style={[s.nextBtn, { padding: 13, borderRadius: 14, marginBottom: 10 }]}>
            <LinearGradient {...BTN_GRADIENT} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} />
            <Text style={{ fontFamily: fonts.bodySemi, color: 'white', fontSize: 15 }}>Поделиться</Text>
          </Pressable>

          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: MUTED, textAlign: 'center', lineHeight: 18 }}>Партнёр откроет ссылку и вы будете связаны</Text>
        </View>
      ) : null}

      {/* Режим: ввести код партнёра */}
      {mode === 'enter' ? (
        <View>
          <View style={{ marginBottom: 12 }}>
            <TextInput
              placeholder="Введи 8-значный код партнёра" placeholderTextColor="#A9A29C" selectionColor={ROSE}
              value={code} maxLength={8} autoCapitalize="none" autoCorrect={false}
              onChangeText={(t) => { setCode(t.toLowerCase()); setFoundPartner(null); setError(null); }}
              onSubmitEditing={searchPartner} returnKeyType="search"
              style={[s.input, { borderColor: 'rgba(200,51,74,0.2)', fontSize: 18, letterSpacing: 3, textAlign: 'center', paddingVertical: 14 }]}
            />
          </View>

          <Pressable onPress={searchPartner} disabled={!canSearch || searching} accessibilityRole="button"
            style={[s.searchBtn, { backgroundColor: canSearch ? 'rgba(200,51,74,0.1)' : 'rgba(0,0,0,0.04)' }]}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: canSearch ? ROSE : MUTED }}>{searching ? 'Ищем...' : 'Найти партнёра'}</Text>
          </Pressable>

          {error ? <View style={s.error} accessibilityRole="alert"><Text style={{ fontFamily: fonts.body, color: '#C85050', fontSize: 13 }}>{error}</Text></View> : null}

          {foundPartner ? (
            <View style={s.found}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <View style={s.foundAvatar}>
                  {foundPartner.avatar_url ? (
                    <Image source={{ uri: foundPartner.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <>
                      <LinearGradient {...cssLinear(135, ['#FBF0F2', '#F2D0D6'])} style={StyleSheet.absoluteFill} />
                      <Svg viewBox="0 0 40 40" width={24} height={24} fill="none">
                        <Circle cx="20" cy="16" r="7" fill={ROSE} opacity={0.6} />
                        <Path d="M4 38c0-8.8 7.2-16 16-16s16 7.2 16 16" fill={ROSE} opacity={0.4} />
                      </Svg>
                    </>
                  )}
                </View>
                <View>
                  <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: TEXT }}>{foundPartner.name}</Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 12, color: ROSE }}>Найден!</Text>
                </View>
              </View>
              <NextBtn onPress={connectPartner} label={`Подключиться с ${foundPartner.name}`} loading={connecting} />
            </View>
          ) : null}
        </View>
      ) : null}

      <TextBtn label="Пропустить — подключу партнёра позже" onPress={onFinish} style={{ marginTop: 8 }} textStyle={{ fontSize: 13 }} />
    </View>
  );
}

/* .ob-step: slideInRight 0.3s */
function StepAnim({ children }: { children: ReactNode }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 300, easing: Easing.ease, useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View style={{ flex: 1, opacity: v, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

/* ── Главный компонент онбординга ── */
export default function Onboarding() {
  const { session, markOnboardingDone, refresh, signOut } = useAuth();
  const uid = session!.user.id;
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [profileData, setProfileData] = useState<ProfileData>({ name: '', avatar_url: null });
  const [birthday, setBirthday] = useState('');
  const [coupleStart, setCoupleStart] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [partnerLinked, setPartnerLinked] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PENDING_INVITE).then(setPendingInvite).catch(() => {});
  }, []);

  /* Загружаем текущий профиль (может быть частично заполнен) */
  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', uid).single().then(async ({ data }) => {
      if (!data) return;
      setProfileData({ name: data.name || '', avatar_url: data.avatar_url || null });
      setBirthday(data.birthday || '');
      setCoupleStart(data.couple_start_date || '');
      setPartnerLinked(!!data.partner_id);
      if (data.invite_code) {
        setInviteCode(data.invite_code);
      } else {
        // Резервная генерация (обычно код уже создан триггером БД). Нижний регистр — RPC ищут через lower().
        const code = Math.random().toString(36).slice(2, 10).toLowerCase();
        const { error } = await supabase.from('profiles').update({ invite_code: code }).eq('id', uid);
        if (!error) setInviteCode(code);
      }
    });
  }, [uid]);

  // Приглашённые не видят шаг 4 — дату предлагает пригласивший, она подтверждается на шаге 5
  const shownStep = step === 4 && pendingInvite ? 5 : step;

  // upsert везде — на случай если строки профиля ещё нет (новый OAuth-пользователь)
  async function saveStep2() {
    const { error } = await supabase.from('profiles').upsert(
      { id: uid, name: profileData.name.trim(), avatar_url: profileData.avatar_url }, { onConflict: 'id' },
    );
    if (error) {
      await supabase.from('profiles').upsert({ id: uid, name: profileData.name.trim() }, { onConflict: 'id' });
    }
    setStep(3);
  }

  async function saveStep3() {
    await supabase.from('profiles').upsert({ id: uid, birthday }, { onConflict: 'id' }).then(() => {}, () => {});
    setStep(pendingInvite ? 5 : 4);
  }

  async function saveStep4() {
    await supabase.from('profiles').upsert({ id: uid, couple_start_date: coupleStart || null }, { onConflict: 'id' }).then(() => {}, () => {});
    setStep(5);
  }

  function finish() {
    markOnboardingDone();
    refresh();
    supabase.from('profiles').upsert({ id: uid, onboarding_done: true }, { onConflict: 'id' }).then(({ error }) => {
      if (error) console.warn('onboarding save error:', error.code, error.message);
    });
  }

  return (
    <LinearGradient colors={['#FBF0F2', '#FFFFFF']} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 32, paddingHorizontal: 24, paddingBottom: insets.bottom + 32 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 12 }}>
            {shownStep > 1 ? (
              <Pressable onPress={() => setStep(shownStep - 1)} accessibilityRole="button" accessibilityLabel="Назад" style={{ paddingVertical: 4 }}>
                <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={MUTED} strokeWidth={2}><Polyline points="15 18 9 12 15 6" /></Svg>
              </Pressable>
            ) : null}
            <View style={{ flex: 1 }}><StepDots step={shownStep - 1} /></View>
          </View>

          <StepAnim key={shownStep}>
            {shownStep === 1 ? <StepWelcome onNext={() => setStep(2)} onSignOut={signOut} /> : null}
            {shownStep === 2 ? <StepProfile value={profileData} onChange={setProfileData} onNext={saveStep2} /> : null}
            {shownStep === 3 ? (
              <StepBirthday value={birthday} onChange={setBirthday} onNext={saveStep3} onSkip={() => setStep(pendingInvite ? 5 : 4)} />
            ) : null}
            {shownStep === 4 ? (
              <StepRelationship value={coupleStart} onChange={setCoupleStart} onNext={saveStep4} onSkip={() => setStep(5)} />
            ) : null}
            {shownStep === 5 ? (
              <StepPartner uid={uid} inviteCode={inviteCode} partnerAlreadyLinked={partnerLinked} pendingInvite={pendingInvite} onFinish={finish} />
            ) : null}
          </StepAnim>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  nextBtn: { width: '100%', padding: 15, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  nextShadow: { shadowColor: ROSE, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  nextText: { fontFamily: fonts.bodyBold, fontSize: 16 },
  h2: { fontFamily: fonts.displaySemi, color: TEXT, marginBottom: 8, textAlign: 'auto' },
  sub: { fontFamily: fonts.body, color: MUTED, fontSize: 14, lineHeight: 20 },
  welcomeTitle: { fontFamily: fonts.displaySemiItalic, fontSize: 36, color: ROSE, marginBottom: 12, textAlign: 'center' },
  welcomeText: { fontFamily: fonts.body, fontSize: 16, color: MUTED, lineHeight: 25.6, maxWidth: 280, textAlign: 'center', marginBottom: 40 },
  avatar: {
    width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: 'rgba(200,51,74,0.2)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#FBF0F2',
    shadowColor: ROSE, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  fieldLabel: { fontFamily: fonts.bodySemi, fontSize: 12, color: MUTED, letterSpacing: 0.5, marginBottom: 8 },
  input: {
    paddingVertical: 13, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(200,51,74,0.15)',
    backgroundColor: SURFACE2, fontSize: 16, color: TEXT, fontFamily: fonts.body,
  },
  daysBox: { backgroundColor: 'rgba(200,51,74,0.06)', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 20 },
  daysText: { fontFamily: fonts.body, fontSize: 14, color: ROSE, textAlign: 'center' },
  proposed: {
    backgroundColor: 'rgba(200,51,74,0.06)', borderWidth: 1, borderColor: 'rgba(200,51,74,0.15)', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 20, marginBottom: 16,
  },
  proposedText: { fontFamily: fonts.displaySemi, fontSize: 20, color: ROSE },
  switch: { flexDirection: 'row', backgroundColor: 'rgba(200,51,74,0.07)', borderRadius: 12, padding: 3, marginBottom: 24 },
  switchBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  switchActive: { backgroundColor: 'white', shadowColor: ROSE, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  linkBox: {
    backgroundColor: SURFACE2, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(200,51,74,0.1)',
  },
  linkText: { fontFamily: fonts.body, fontSize: 13, color: MUTED },
  copyBtn: { width: '100%', padding: 13, borderWidth: 1.5, borderColor: 'rgba(200,51,74,0.25)', borderRadius: 14, alignItems: 'center', marginBottom: 10 },
  searchBtn: { width: '100%', padding: 13, borderRadius: 14, alignItems: 'center', marginBottom: 16 },
  error: { backgroundColor: 'rgba(255,80,80,0.08)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12 },
  found: { backgroundColor: 'rgba(200,51,74,0.06)', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: 'rgba(200,51,74,0.15)', marginBottom: 16 },
  foundAvatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
