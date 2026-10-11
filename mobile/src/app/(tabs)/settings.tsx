// Порт src/components/Settings.jsx (+ PartnerSection).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Animated, Easing, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Radials } from '@/components/Backgrounds';
import { DateTimeInput } from '@/components/DateTimeInput';
import { QRCode } from '@/components/QRCode';
import { chooseImage, compressImage, uploadToStorage, validateImageFile } from '@/lib/media';
import { isPushEnabled, pushPermissionDenied, registerForPush, unregisterPush } from '@/lib/push';
import { WEB_URL, supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import type { Profile } from '@/lib/types';
import { useAuth, useMe } from '@/providers/AuthProvider';
import { colors, cssLinear, fonts } from '@/theme';

const PINK = '#ff8da0';
const ROSE = colors.rose;
const Ico = ({ children }: { children: React.ReactNode }) => (
  <Svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke={ROSE} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{children}</Svg>
);
const IcoUser = () => <Ico><Circle cx="12" cy="8" r="4" /><Path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" /></Ico>;
const IcoBirthday = () => <Ico><Rect x="3" y="9" width="18" height="12" rx="2" /><Path d="M3 14h18" /><Path d="M8 9V7c0-1.1.9-2 2-2s2 .9 2 2v2" /><Path d="M14 9V7c0-1.1.9-2 2-2s2 .9 2 2v2" /></Ico>;
const IcoHeart = () => <Ico><Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></Ico>;
const IcoBell = () => <Svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke={ROSE} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><Path d="M13.73 21a2 2 0 01-3.46 0" /></Svg>;
const IcoCamera = () => <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><Circle cx="12" cy="13" r="4" /></Svg>;
const IcoSpinner = () => <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="white" strokeWidth={2} strokeLinecap="round"><Path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" /></Svg>;
const IcoPersonFill = () => <Svg viewBox="0 0 40 40" width={44} height={44} fill="none"><Circle cx="20" cy="16" r="8" fill="rgba(139,26,44,0.7)" /><Path d="M4 38c0-8.8 7.2-16 16-16s16 7.2 16 16" fill="rgba(139,26,44,0.5)" /></Svg>;

function getZodiac(dateStr: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr), m = d.getMonth() + 1, day = d.getDate();
  if ((m === 3 && day >= 21) || (m === 4 && day <= 19)) return 'Овен ♈';
  if ((m === 4 && day >= 20) || (m === 5 && day <= 20)) return 'Телец ♉';
  if ((m === 5 && day >= 21) || (m === 6 && day <= 20)) return 'Близнецы ♊';
  if ((m === 6 && day >= 21) || (m === 7 && day <= 22)) return 'Рак ♋';
  if ((m === 7 && day >= 23) || (m === 8 && day <= 22)) return 'Лев ♌';
  if ((m === 8 && day >= 23) || (m === 9 && day <= 22)) return 'Дева ♍';
  if ((m === 9 && day >= 23) || (m === 10 && day <= 22)) return 'Весы ♎';
  if ((m === 10 && day >= 23) || (m === 11 && day <= 21)) return 'Скорпион ♏';
  if ((m === 11 && day >= 22) || (m === 12 && day <= 21)) return 'Стрелец ♐';
  if ((m === 12 && day >= 22) || (m === 1 && day <= 19)) return 'Козерог ♑';
  if ((m === 1 && day >= 20) || (m === 2 && day <= 18)) return 'Водолей ♒';
  return 'Рыбы ♓';
}
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
function formatBirthday(s: string) { const d = new Date(s); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; }

/* ── Toggle (.settings-toggle) ── */
function Toggle({ on, onPress, disabled }: { on: boolean; onPress: () => void; disabled?: boolean }) {
  const [x] = useState(() => new Animated.Value(on ? 20 : 0));
  useEffect(() => { Animated.timing(x, { toValue: on ? 20 : 0, duration: 200, easing: Easing.bezier(0.34, 1.56, 0.64, 1), useNativeDriver: true }).start(); }, [on, x]);
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="switch" accessibilityState={{ checked: on, disabled }} style={[st.toggle, !on && { backgroundColor: 'rgba(255,255,255,0.16)' }, disabled && { opacity: 0.6 }]}>
      {on ? <LinearGradient {...cssLinear(135, [PINK, '#d8456b'])} style={[StyleSheet.absoluteFill, { borderRadius: 99 }]} /> : null}
      <Animated.View style={[st.thumb, { transform: [{ translateX: x }] }]} />
    </Pressable>
  );
}

/* ── PartnerSection ── */
function PartnerSection({ profile }: { profile: Profile }) {
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<{ name: string | null; avatar_url: string | null } | null>(null);
  const [inviteCode, setInviteCode] = useState(profile.invite_code || null);

  // Резервная генерация invite_code (обычно код создаёт триггер БД); нижний регистр — RPC ищут через lower()
  useEffect(() => {
    if (!profile.invite_code && profile.id) {
      const code = Math.random().toString(36).slice(2, 10).toLowerCase();
      supabase.from('profiles').update({ invite_code: code }).eq('id', profile.id).then(({ error }) => { if (!error) setInviteCode(code); });
    }
  }, [profile.id, profile.invite_code]);

  const inviteLink = inviteCode ? `${WEB_URL}/?invite=${inviteCode}` : null;

  useEffect(() => {
    if (profile.partner_id) {
      supabase.from('profiles').select('name, avatar_url').eq('id', profile.partner_id).single().then(({ data }) => setPartnerProfile(data));
    }
  }, [profile.partner_id]);

  async function copy() {
    if (inviteLink) await Clipboard.setStringAsync(inviteLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View style={st.section}>
      <Text style={st.sectionTitle}>ПАРТНЁР</Text>
      {profile.partner_id && partnerProfile ? (
        <View style={{ paddingTop: 12, paddingBottom: 16, paddingHorizontal: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <LinearGradient {...cssLinear(135, ['#FBF0F2', '#F2D0D6'])} style={st.partnerAv}>
              {partnerProfile.avatar_url
                ? <Image source={{ uri: partnerProfile.avatar_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                : <Svg viewBox="0 0 40 40" width={22} height={22} fill="none"><Circle cx="20" cy="15" r="7" fill="#C8334A" opacity={0.6} /><Path d="M4 38c0-8.8 7.2-16 16-16s16 7.2 16 16" fill="#C8334A" opacity={0.4} /></Svg>}
            </LinearGradient>
            <View>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text }}>{partnerProfile.name}</Text>
              <Text style={{ fontSize: 12, color: ROSE, fontFamily: fonts.body }}>Подключён</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={{ paddingTop: 8, paddingHorizontal: 18, paddingBottom: 16 }}>
          <Text style={st.partnerHint}>Партнёр ещё не подключён. Поделись ссылкой или QR-кодом.</Text>
          <Text selectable style={st.linkBox}>{inviteLink}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <Pressable onPress={copy} style={[st.outlineBtn, copied && { backgroundColor: 'rgba(168,40,60,0.07)' }]} accessibilityRole="button">
              <Text style={st.outlineText}>{copied ? '✓ Скопировано' : 'Скопировать'}</Text>
            </Pressable>
            <Pressable onPress={() => setShowQR((v) => !v)} style={[st.outlineBtn, showQR && { backgroundColor: 'rgba(168,40,60,0.07)' }]} accessibilityRole="button">
              <Text style={st.outlineText}>QR-код</Text>
            </Pressable>
            <Pressable onPress={() => inviteLink && Share.share({ title: 'Love App', message: inviteLink, url: inviteLink })} style={st.shareBtn} accessibilityRole="button">
              <Text style={{ color: 'white', fontSize: 13, fontFamily: fonts.bodyMedium }}>Поделиться</Text>
            </Pressable>
          </View>
          {showQR && inviteLink ? (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <View style={{ borderRadius: 12, overflow: 'hidden' }}><QRCode value={inviteLink} size={160} /></View>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

export default function Settings() {
  const { uid, profile, refresh } = useMe();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(profile.name || '');
  const [birthday, setBirthday] = useState(profile.birthday || '');
  const [coupleStart, setCoupleStart] = useState(profile.couple_start_date || '');
  const [loveMessage, setLoveMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar_url || null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // Общая дата пары из таблицы couples
  useEffect(() => {
    if (!profile.partner_id) return;
    supabase.from('couples').select('couple_start_date').or(`user_a.eq.${uid},user_b.eq.${uid}`).eq('status', 'active').maybeSingle()
      .then(({ data }) => { if (data?.couple_start_date) setCoupleStart(data.couple_start_date); });
  }, [uid, profile.partner_id]);

  useEffect(() => { isPushEnabled(uid).then(setPushEnabled); }, [uid]);

  async function togglePush() {
    if (pushLoading) return;
    setPushLoading(true);
    try {
      if (pushEnabled) {
        await unregisterPush(uid);
        setPushEnabled(false);
      } else {
        const token = await registerForPush(uid, { prompt: true });
        if (token) setPushEnabled(true);
        else if (await pushPermissionDenied()) toast.error('Уведомления заблокированы — разреши их в настройках телефона');
      }
    } catch (e) { console.error(e); }
    setPushLoading(false);
  }

  const loadLoveMessage = useCallback(async () => {
    const { data } = await supabase.from('couple_settings').select('love_message').eq('user_id', uid).maybeSingle();
    if (data) setLoveMessage(data.love_message || '');
  }, [uid]);
  useEffect(() => { loadLoveMessage(); }, [loadLoveMessage]);

  async function handleAvatarChange() {
    const asset = await chooseImage();
    if (!asset) return;
    const fileErr = validateImageFile(asset);
    if (fileErr) { toast.error(fileErr); return; }
    setSavingAvatar(true);
    try {
      const uri = await compressImage(asset.uri, asset.width, asset.height, 100000, 1);
      const url = (await uploadToStorageUpsert(uri, `avatars/${uid}.jpeg`)) + '?t=' + Date.now();
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', uid);
      setAvatarPreview(url);
      refresh();
      toast.success('Фото обновлено');
    } catch (err) {
      toast.error('Не удалось загрузить фото');
      console.error(err);
    }
    setSavingAvatar(false);
  }

  async function saveProfile() {
    if (!name.trim()) { toast.error('Введи своё имя'); return; }
    setSaving(true);
    const ok = () => { refresh(); setSaved(true); setTimeout(() => setSaved(false), 2000); };
    if (profile.partner_id) {
      // В паре: имя и ДР — в profiles, дата начала — в общую запись couples
      const [profRes, dateRes] = await Promise.all([
        supabase.from('profiles').update({ name: name.trim(), birthday: birthday || null }).eq('id', uid),
        supabase.rpc('set_couple_start_date', { p_date: coupleStart || null }),
      ]);
      if (profRes.error || dateRes.error) toast.error('Не удалось сохранить профиль'); else ok();
    } else {
      const { error } = await supabase.from('profiles').update({ name: name.trim(), birthday: birthday || null, couple_start_date: coupleStart || null }).eq('id', uid);
      if (error) toast.error('Не удалось сохранить профиль'); else ok();
    }
    setSaving(false);
  }

  async function saveLoveMsg() {
    setSaving(true);
    const { data: ex } = await supabase.from('couple_settings').select('id').eq('user_id', uid).maybeSingle();
    if (ex) await supabase.from('couple_settings').update({ love_message: loveMessage, updated_at: new Date().toISOString() }).eq('id', ex.id);
    else await supabase.from('couple_settings').insert({ user_id: uid, love_message: loveMessage });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  }

  function handleDeleteAccount() {
    Alert.alert('Удалить аккаунт?', 'Все ваши данные будут удалены безвозвратно. Это действие нельзя отменить.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'OK', style: 'destructive', onPress: () => {
        Alert.alert('Вы уверены?', 'Восстановить данные будет невозможно.', [
          { text: 'Отмена', style: 'cancel' },
          { text: 'OK', style: 'destructive', onPress: async () => {
            try {
              const { error } = await supabase.rpc('delete_user_account');
              if (error) throw error;
              await AsyncStorage.clear();
              await supabase.auth.signOut();
            } catch (err) {
              Alert.alert('Ошибка при удалении: ' + ((err as Error).message || JSON.stringify(err)));
            }
          } },
        ]);
      } },
    ]);
  }

  const myName = profile.name || 'Пользователь';
  const today = new Date();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 130 + 92 + insets.bottom }} keyboardShouldPersistTaps="handled">
      <View style={st.header}>
        <LinearGradient {...cssLinear(165, [['#3d1838', 0], ['#6a2747', 0.42], ['#9a3c50', 0.74], ['#bd5552', 1]])} style={StyleSheet.absoluteFill} />
        <View style={{ position: 'absolute', top: -40, right: -20, width: 280, height: 240 }}><Radials items={[{ x: 50, y: 50, color: 'rgba(255,210,150,0.28)', stop: 62 }]} /></View>
        <View style={{ paddingTop: insets.top + 52, paddingHorizontal: 20, paddingBottom: 34, alignItems: 'center' }}>
          <LinearGradient {...cssLinear(145, [['#ffd9a8', 0], [PINK, 0.45], ['#d8456b', 1]])} style={st.avRing}>
            <View style={st.avGap}>
              <Pressable onPress={handleAvatarChange} disabled={savingAvatar} accessibilityRole="button" accessibilityLabel="Сменить фото" style={{ flex: 1 }}>
                <LinearGradient {...cssLinear(160, ['#ff8d9e', '#d8456b'])} style={st.avatar}>
                  {avatarPreview ? <Image source={{ uri: avatarPreview }} style={{ width: '100%', height: '100%', borderRadius: 999 }} contentFit="cover" accessibilityLabel={myName} /> : <IcoPersonFill />}
                </LinearGradient>
              </Pressable>
            </View>
            <Pressable onPress={handleAvatarChange} disabled={savingAvatar} style={st.avBtn} accessibilityLabel="Сменить фото">
              <LinearGradient {...cssLinear(160, [PINK, '#d8456b'])} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
              {savingAvatar ? <IcoSpinner /> : <IcoCamera />}
            </Pressable>
          </LinearGradient>
          <Text style={st.headerName}>{myName}</Text>
          <Text style={st.headerSub}>Нажми на фото, чтобы изменить</Text>
          {birthday ? (
            <View style={st.chips}>
              <View style={st.chip}><Text style={st.chipText}>{getZodiac(birthday)}</Text></View>
              <View style={st.chip}><Text style={st.chipText}>{formatBirthday(birthday)}</Text></View>
            </View>
          ) : null}
        </View>
      </View>

      {/* Разделы */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>РАЗДЕЛЫ</Text>
        {([['advisor', 'Советник', '🧭'], ['mirror', 'Вопрос дня', '❓'], ['premium', 'Premium', '⭐']] as const).map(([id, label, ic], i) => (
          <Pressable key={id} onPress={() => router.navigate(`/${id}`)} accessibilityRole="button" accessibilityLabel={label}
            style={({ pressed }) => [st.link, i > 0 && st.rowBorder, pressed && { backgroundColor: 'rgba(255,255,255,0.04)' }]}>
            <LinearGradient {...cssLinear(160, ['rgba(255,141,160,0.20)', 'rgba(216,69,107,0.12)'])} style={st.rowIcon}><Text style={{ fontSize: 19 }}>{ic}</Text></LinearGradient>
            <Text style={st.linkLabel}>{label}</Text>
            <Text style={st.linkArrow}>›</Text>
          </Pressable>
        ))}
      </View>

      {/* Профиль */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>ПРОФИЛЬ</Text>
        <View style={st.row}>
          <LinearGradient {...cssLinear(160, ['rgba(255,141,160,0.20)', 'rgba(216,69,107,0.12)'])} style={st.rowIcon}><IcoUser /></LinearGradient>
          <Text style={st.rowLabel}>Имя</Text>
          <TextInput style={st.input} placeholder="Твоё имя" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} accessibilityLabel="Имя" />
        </View>
        <View style={[st.row, st.rowBorder]}>
          <LinearGradient {...cssLinear(160, ['rgba(255,141,160,0.20)', 'rgba(216,69,107,0.12)'])} style={st.rowIcon}><IcoBirthday /></LinearGradient>
          <Text style={st.rowLabel}>День рождения</Text>
          <DateTimeInput value={birthday} onChange={setBirthday} style={st.dateBox} textStyle={st.dateText} placeholderColor={colors.textMuted} label="День рождения" />
        </View>
        <View style={[st.row, st.rowBorder]}>
          <LinearGradient {...cssLinear(160, ['rgba(255,141,160,0.20)', 'rgba(216,69,107,0.12)'])} style={st.rowIcon}><IcoHeart /></LinearGradient>
          <Text style={st.rowLabel}>Вместе с</Text>
          <DateTimeInput value={coupleStart} onChange={setCoupleStart} maximumDate={today} style={st.dateBox} textStyle={st.dateText} placeholderColor={colors.textMuted} label="Вместе с" />
        </View>
      </View>
      <SaveBtn label={saved ? 'Сохранено!' : saving ? 'Сохраняем...' : 'Сохранить профиль'} saved={saved} disabled={saving} onPress={saveProfile} />

      {/* Любовное послание */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>ЛЮБОВНОЕ ПОСЛАНИЕ</Text>
        <View style={[st.row, { flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
          <TextInput value={loveMessage} onChangeText={setLoveMessage} multiline placeholder="Напиши что-то прекрасное для партнёра..." placeholderTextColor={colors.textMuted}
            style={st.textarea} accessibilityLabel="Любовное послание" />
        </View>
      </View>
      <SaveBtn label={saved ? 'Сохранено!' : saving ? 'Сохраняем...' : 'Сохранить послание'} saved={saved} disabled={saving} onPress={saveLoveMsg} />

      {/* Уведомления */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>УВЕДОМЛЕНИЯ</Text>
        <View style={st.row}>
          <LinearGradient {...cssLinear(160, ['rgba(255,141,160,0.20)', 'rgba(216,69,107,0.12)'])} style={st.rowIcon}><IcoBell /></LinearGradient>
          <Text style={st.rowLabel}>Пуш-уведомления</Text>
          <Toggle on={pushEnabled} onPress={togglePush} disabled={pushLoading} />
        </View>
      </View>

      <PartnerSection profile={profile} />

      <Pressable onPress={signOut} accessibilityRole="button" style={({ pressed }) => [st.logout, pressed && { backgroundColor: 'rgba(255,141,160,0.1)' }]}>
        <Text style={st.logoutText}>Выйти из аккаунта</Text>
      </Pressable>

      <View style={st.danger}>
        <Text style={st.dangerTitle}>ОПАСНАЯ ЗОНА</Text>
        <Pressable onPress={handleDeleteAccount} accessibilityRole="button" style={({ pressed }) => [st.deleteBtn, pressed && { backgroundColor: 'rgba(220,80,80,0.16)' }]}>
          <Text style={st.deleteText}>Удалить аккаунт навсегда</Text>
        </Pressable>
        <Text style={st.dangerHint}>Действие необратимо · потребуется подтверждение</Text>
      </View>
    </ScrollView>
  );
}

async function uploadToStorageUpsert(uri: string, path: string) {
  // как в вебе: avatars/<uid>.<ext>, upsert: true
  const { File } = await import('expo-file-system');
  const bytes = await new File(uri).arrayBuffer();
  const { error } = await supabase.storage.from('photos').upload(path, bytes, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw error;
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
}
void uploadToStorage;

function SaveBtn({ label, saved, disabled, onPress }: { label: string; saved: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={({ pressed }) => [st.saveBtn, saved && { shadowColor: 'rgb(42,122,74)' }, disabled && { opacity: 0.5, shadowOpacity: 0 }, pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 }]}>
      <LinearGradient {...cssLinear(135, saved ? ['#43d97a', '#1f9e54'] : [PINK, '#d8456b'])} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
      <Text style={st.saveText}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  header: { borderBottomLeftRadius: 34, borderBottomRightRadius: 34, marginBottom: 16, overflow: 'hidden', shadowColor: 'rgb(60,20,40)', shadowOpacity: 0.5, shadowRadius: 22, shadowOffset: { width: 0, height: 16 } },
  avRing: { width: 116, height: 116, borderRadius: 58, padding: 3, marginBottom: 14, shadowColor: 'rgb(40,12,28)', shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 14 } },
  avGap: { flex: 1, borderRadius: 999, backgroundColor: '#2a1620', padding: 3 },
  avatar: { flex: 1, borderRadius: 999, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avBtn: { position: 'absolute', bottom: 2, right: 2, borderWidth: 3, borderColor: '#2a1620', borderRadius: 16, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 2 },
  headerName: { fontFamily: fonts.displaySemi, fontSize: 30, color: '#fff', marginBottom: 3, letterSpacing: 0.3, textShadowColor: 'rgba(40,12,28,0.4)', textShadowRadius: 14, textShadowOffset: { width: 0, height: 2 } },
  headerSub: { fontFamily: fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 14 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  chip: { backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 14 },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: '#fff' },

  section: { backgroundColor: colors.surface, borderRadius: 20, marginHorizontal: 14, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.6, color: ROSE, paddingTop: 16, paddingHorizontal: 18, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, gap: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  rowLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  link: { flexDirection: 'row', alignItems: 'center', gap: 13, width: '100%', paddingVertical: 13, paddingHorizontal: 16 },
  linkLabel: { flex: 1, fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.text },
  linkArrow: { color: colors.textMuted, fontSize: 22, lineHeight: 24 },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text, textAlign: 'right', paddingVertical: 2 },
  dateBox: { minWidth: 120, alignItems: 'flex-end' },
  dateText: { fontFamily: fonts.body, fontSize: 15, color: colors.text, textAlign: 'right' },
  textarea: { width: '100%', fontFamily: fonts.body, fontSize: 14, color: colors.text, minHeight: 80, lineHeight: 22, textAlignVertical: 'top' },
  toggle: { width: 50, height: 30, borderRadius: 99, overflow: 'hidden' },
  thumb: { position: 'absolute', top: 3, left: 3, width: 24, height: 24, borderRadius: 12, backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },

  partnerAv: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  partnerHint: { fontSize: 13, color: colors.textMuted, marginBottom: 14, lineHeight: 20, fontFamily: fonts.body },
  linkBox: { backgroundColor: colors.surface, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 12, color: colors.textMuted, marginBottom: 12, borderWidth: 0.5, borderColor: colors.border, fontFamily: fonts.body, overflow: 'hidden' },
  outlineBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 0.5, borderColor: 'rgba(168,40,60,0.25)', alignItems: 'center' },
  outlineText: { color: ROSE, fontSize: 13, fontFamily: fonts.bodyMedium },
  shareBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: ROSE, alignItems: 'center' },

  saveBtn: { marginHorizontal: 14, marginBottom: 16, borderRadius: 16, padding: 15, alignItems: 'center', overflow: 'hidden', shadowColor: 'rgb(216,69,107)', shadowOpacity: 0.4, shadowRadius: 13, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  saveText: { color: 'white', fontFamily: fonts.bodySemi, fontSize: 15, letterSpacing: 0.2 },
  logout: { marginHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,141,160,0.3)', borderRadius: 16, padding: 15, alignItems: 'center' },
  logoutText: { color: PINK, fontFamily: fonts.bodySemi, fontSize: 15 },
  danger: { marginTop: 26, marginHorizontal: 14, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(220,80,80,0.28)', backgroundColor: 'rgba(220,80,80,0.07)' },
  dangerTitle: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.4, color: 'rgba(232,110,110,0.92)', marginBottom: 10 },
  deleteBtn: { width: '100%', borderWidth: 1, borderColor: 'rgba(220,80,80,0.45)', borderRadius: 14, padding: 13, alignItems: 'center' },
  deleteText: { color: 'rgba(235,120,120,0.95)', fontFamily: fonts.bodySemi, fontSize: 14 },
  dangerHint: { textAlign: 'center', fontSize: 11, color: colors.textMuted, marginTop: 9, fontFamily: fonts.body },
});
