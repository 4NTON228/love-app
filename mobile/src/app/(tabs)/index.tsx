// Порт src/components/Home.jsx + Home.css («Bright sunset»).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { CssBackground, SUNSET_STOPS } from '@/components/Backgrounds';
import { DateTimeInput, toLocalDateTime } from '@/components/DateTimeInput';
import { Blob, Confetti, HeartsBackground, HeartWave, Shine } from '@/components/Effects';
import { LoveStory } from '@/components/LoveStory';
import { Reveal, beatScale, useLoop } from '@/components/anim';
import { ICamera, IChat, IPlay } from '@/components/icons';
import { sendPushNotification } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import type { Profile } from '@/lib/types';
import { useMe } from '@/providers/AuthProvider';
import { cssLinear, fonts } from '@/theme';

/* ── helpers (как в Home.jsx) ── */
function pad(v: number) { return String(v).padStart(2, '0'); }
function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
const yearsWord = (n: number) => plural(n, 'год', 'года', 'лет');
const dayWord = (n: number) => plural(n, 'день', 'дня', 'дней');
const hourWord = (n: number) => plural(n, 'час', 'часа', 'часов');

const STATUS_MOODS = [
  { e: '🥰', label: 'влюблён' }, { e: '😊', label: 'хорошо' }, { e: '🔥', label: 'огонь' },
  { e: '😴', label: 'устал' }, { e: '😔', label: 'грустно' }, { e: '🤔', label: 'скучаю' },
];

function relTime(ts: string | null | undefined) {
  if (!ts) return null;
  const min = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (min < 2) return 'онлайн';
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'вчера' : `${d} дн назад`;
}

function getRelTime(start: Date) {
  const diff = Date.now() - start.getTime();
  const totalDays = Math.max(0, Math.floor(diff / 86400000));
  return {
    totalDays,
    years: Math.floor(totalDays / 365),
    months: Math.floor((totalDays % 365) / 30),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

function getAnniversary(start: Date) {
  const now = new Date();
  const next = new Date(start);
  next.setFullYear(now.getFullYear());
  if (next <= now) next.setFullYear(now.getFullYear() + 1);
  const daysPassed = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
  return {
    daysUntil: Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86400000)),
    progress: Math.min(((daysPassed % 365) / 365) * 100, 100),
  };
}

function getTimeUntil(target: string | null | undefined) {
  if (!target) return null;
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

const localToUTC = (v: string) => (v ? new Date(v).toISOString() : null);
const utcToLocal = (v: string | null | undefined) => (v ? toLocalDateTime(new Date(v)) : '');
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
/** toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) */
function formatDayMonth(v: string | null | undefined) {
  if (!v) return '';
  const d = new Date(v.length <= 10 ? `${v}T00:00:00` : v);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}
function getInitials(name?: string | null) {
  if (!name) return 'L';
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'L';
}

const C = {
  textMain: '#ffffff', textSoft: 'rgba(255,255,255,0.90)', textMuted: 'rgba(255,255,255,0.66)',
  gold: '#ffe7a8', coralDeep: '#d8456b', line: 'rgba(255,255,255,0.30)', lineSoft: 'rgba(255,255,255,0.18)',
};

/* ── AvatarMedallion ── */
const AvatarMedallion = memo(function AvatarMedallion({ src, name, onPress, ghost = false }: { src?: string | null; name: string; onPress?: () => void; ghost?: boolean }) {
  const [imgError, setImgError] = useState(false);
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={name}
      style={({ pressed }) => [s.avatar, ghost && { opacity: 0.55 }, pressed && { transform: [{ scale: 0.97 }] }]}>
      <LinearGradient {...cssLinear(145, ['#ffffff', C.gold, 'rgba(255,150,180,0.85)'])} style={s.avatarShell}>
        {src && !imgError ? (
          <Image source={{ uri: src }} style={s.avatarInner} contentFit="cover" onError={() => setImgError(true)} />
        ) : (
          <LinearGradient {...cssLinear(180, ['#ff8d9e', '#d8456b'])} style={[s.avatarInner, s.center]}>
            <Text style={s.avatarFallback}>{getInitials(name)}</Text>
          </LinearGradient>
        )}
      </LinearGradient>
      <Text style={s.avatarName}>{name || 'Любовь'}</Text>
    </Pressable>
  );
});

/* ── Стеклянная поверхность (.quick-action / .info-card) ── */
function Glass({ children, style, radius = 22 }: { children: ReactNode; style?: object; radius?: number }) {
  return (
    <View style={[s.glass, { borderRadius: radius }, style]}>
      <LinearGradient {...cssLinear(180, ['rgba(46,16,34,0.34)', 'rgba(46,16,34,0.20)'])} style={[StyleSheet.absoluteFill, { borderRadius: radius }]} />
      {children}
    </View>
  );
}

/* ── QuickAction ── */
const QuickAction = memo(function QuickAction({ title, subtitle, badge, icon, onPress, delay = 0 }: {
  title: string; subtitle: string; badge: string; icon: ReactNode; onPress: () => void; delay?: number;
}) {
  const [w, setW] = useState(0);
  return (
    <Reveal delay={delay * 1000} duration={600} style={{ flex: 1 }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={({ pressed }) => [{ flex: 1 }, pressed && { transform: [{ scale: 0.982 }] }]}>
        <Glass style={s.quickAction}>
          <Shine width={w} fraction={0.5} duration={8000} startLeft={-0.4} />
          <View style={s.quickTop}>
            <LinearGradient {...cssLinear(180, ['rgba(255,255,255,0.40)', 'rgba(255,255,255,0.16)'])} style={s.quickIcon}>{icon}</LinearGradient>
            <Text style={s.quickBadge}>{badge.toUpperCase()}</Text>
          </View>
          <Text style={s.quickTitle}>{title}</Text>
          <Text style={s.quickSubtitle}>{subtitle}</Text>
        </Glass>
      </Pressable>
    </Reveal>
  );
});

/* ── InfoCard ── */
function InfoCard({ eyebrow, title, children, delay, compact = false }: { eyebrow: string; title: string; children: ReactNode; delay?: number; compact?: boolean }) {
  return (
    <Reveal delay={(delay ?? 0) * 1000} duration={600}>
      <Glass style={[s.infoCard, compact && { gap: 10 }]}>
        <Text style={s.infoEyebrow}>{eyebrow.toUpperCase()}</Text>
        <Text style={s.infoTitle}>{title}</Text>
        {children}
      </Glass>
    </Reveal>
  );
}

function Btn({ label, onPress, ghost, disabled }: { label: string; onPress: () => void; ghost?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [ghost ? s.btnGhost : s.btnPrimary, pressed && { transform: [{ scale: 0.982 }] }, disabled && { opacity: 0.6 }]}>
      <Text style={ghost ? s.btnGhostText : s.btnPrimaryText}>{label}</Text>
    </Pressable>
  );
}

/* ── HeroCounter — таймер изолирован ── */
const HeroCounter = memo(function HeroCounter({ coupleStart, anniversary, hasPartner, hasStartDate, onSettings }: {
  coupleStart: Date | null; anniversary: { daysUntil: number | null; progress: number }; hasPartner: boolean; hasStartDate: boolean; onSettings: () => void;
}) {
  const [time, setTime] = useState(() => (coupleStart ? getRelTime(coupleStart) : null));
  useEffect(() => {
    if (!coupleStart) return;
    const tick = () => setTime(getRelTime(coupleStart));
    const id = setInterval(tick, 1000);
    const first = setTimeout(tick, 0);
    return () => { clearInterval(id); clearTimeout(first); };
  }, [coupleStart]);
  const { width } = useWindowDimensions();
  const numSize = Math.min(86, Math.max(58, width * 0.15));

  if (!(time && hasStartDate && coupleStart)) {
    return (
      <View style={s.heroCounter}>
        <Text style={s.noteText}>
          {hasPartner
            ? 'Укажите дату начала отношений, и экран начнёт красиво считать вашу историю.'
            : 'Пригласите партнёра — и главный экран оживёт для двоих.'}
        </Text>
        <View style={s.actionsRow}><Btn label="Открыть настройки" onPress={onSettings} /></View>
      </View>
    );
  }
  return (
    <View style={s.heroCounter}>
      <View style={s.heroCounterMain}>
        <View style={s.heroCounterNumber} accessible accessibilityLabel={`${time.totalDays} дней вместе`}>
          <Text style={[s.heroNum, { fontSize: numSize, lineHeight: numSize * 0.95 }]}>{time.totalDays}</Text>
          <Text style={s.heroNumLabel}>ДНЕЙ ВМЕСТЕ</Text>
        </View>
        <View style={s.heroClock}>
          <Text style={s.heroClockText}>{pad(time.hours)} : {pad(time.minutes)} : {pad(time.seconds)}</Text>
        </View>
      </View>
      <View style={s.heroProgress}>
        <LinearGradient {...cssLinear(90, ['#ffffff', C.gold])} style={[s.heroProgressBar, { width: `${anniversary.progress}%` }]} />
      </View>
      <View style={s.heroMetrics}>
        {([[time.years, 'лет'], [time.months, 'месяцев'], [anniversary.daysUntil ?? '-', 'до годовщины']] as const).map(([value, label]) => (
          <View style={s.heroMetric} key={label}>
            <Text style={s.heroMetricValue}>{value}</Text>
            <Text style={s.heroMetricLabel}>{label.toUpperCase()}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

/* ── MeetingBody — изолированный обратный отсчёт ── */
const MeetingBody = memo(function MeetingBody({ nextMeeting, onEdit }: { nextMeeting: string | null | undefined; onEdit: () => void }) {
  const [countdown, setCountdown] = useState(() => getTimeUntil(nextMeeting));
  useEffect(() => {
    const tick = () => setCountdown(getTimeUntil(nextMeeting));
    const first = setTimeout(tick, 0);
    const id = nextMeeting ? setInterval(tick, 1000) : undefined;
    return () => { clearTimeout(first); if (id) clearInterval(id); };
  }, [nextMeeting]);

  if (countdown) {
    return (
      <View style={s.meetingRow}>
        <Text style={s.meetingPhrase}>
          через <Text style={s.meetingStrong}>{countdown.days}</Text> {dayWord(countdown.days)} <Text style={s.meetingStrong}>{countdown.hours}</Text> {hourWord(countdown.hours)} вы увидитесь 💕
        </Text>
        <View style={s.meetingGrid}>
          {([[countdown.days, 'дни'], [pad(countdown.hours), 'часы'], [pad(countdown.minutes), 'мин'], [pad(countdown.seconds), 'сек']] as const).map(([v, l]) => (
            <View style={s.meetingCell} key={l}>
              <Text style={s.meetingNum}>{v}</Text>
              <Text style={s.meetingLabel}>{l.toUpperCase()}</Text>
            </View>
          ))}
        </View>
        <View style={s.actionsRow}><Btn ghost label="Изменить" onPress={onEdit} /></View>
      </View>
    );
  }
  return (
    <View style={s.meetingRow}>
      <Text style={s.noteText}>Добавьте следующую встречу, чтобы экран жил в ожидании.</Text>
      <View style={s.actionsRow}><Btn label="Указать дату" onPress={onEdit} /></View>
    </View>
  );
});

/* ── PartnerModal ── */
function PartnerModal({ profile, loading, onClose }: { profile: Profile | null; loading: boolean; onClose: () => void }) {
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.partnerOverlay} onPress={onClose} accessibilityLabel="Закрыть">
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(120,30,55,0.45)' }]} />
        <Pressable onPress={() => {}}>
          <LinearGradient {...cssLinear(170, [['#ff9682', 0], ['#ee5d83', 0.6], ['#cf4f7c', 1]])} style={s.partnerDialog}>
            <Pressable onPress={onClose} style={s.partnerClose} accessibilityRole="button"><Text style={s.partnerCloseText}>Закрыть</Text></Pressable>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <AvatarMedallion src={profile?.avatar_url} name={profile?.name || 'Партнёр'} />
                <Text style={s.partnerTitle}>{profile?.name || 'Партнёр'}</Text>
                {profile?.birthday ? <Text style={s.partnerSubtitle}>{formatDayMonth(profile.birthday)}</Text> : null}
              </>
            )}
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── Свечение .hero-card::before ── */
function HeroGlow() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: -88, left: '-8%', right: '-8%', height: 220 }}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="g1" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#fff" stopOpacity={0.30} /><Stop offset="0.45" stopColor="#fff" stopOpacity={0} /></RadialGradient>
          <RadialGradient id="g2" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="rgb(255,231,168)" stopOpacity={0.22} /><Stop offset="0.68" stopColor="rgb(255,231,168)" stopOpacity={0} /></RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#g1)" />
        <Rect width="100%" height="100%" fill="url(#g2)" />
      </Svg>
    </View>
  );
}

const DEFAULT_MESSAGE = 'Здесь живёт ваша история. Спокойная, красивая и только для двоих.';

type Settings = { id: string; love_message: string | null; next_meeting: string | null } | null;
type NextEvent = { id: string; title: string; emoji: string | null; event_date: string } | null;

export default function Home() {
  const { uid, profile, partner: partnerProfile } = useMe();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [settings, setSettings] = useState<Settings>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [nextEvent, setNextEvent] = useState<NextEvent>(null);
  const [editMessage, setEditMessage] = useState(false);
  const [editMeeting, setEditMeeting] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [newMeeting, setNewMeeting] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [showWave, setShowWave] = useState(false);
  const [thinkingSent, setThinkingSent] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [myMood, setMyMood] = useState<string | null>(profile.mood ?? null);
  const [streak, setStreak] = useState(0);
  const [storyW, setStoryW] = useState(0);
  const thinkChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const waveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasPartner = !!profile.partner_id;
  const partnerLoading = hasPartner && !partnerProfile;
  const effectiveCoupleDate = profile.couple_start_date ?? null;
  const hasStartDate = !!effectiveCoupleDate;
  const coupleStart = useMemo(() => (effectiveCoupleDate ? new Date(`${effectiveCoupleDate}T00:00:00`) : null), [effectiveCoupleDate]);
  const anniversary = useMemo(() => (coupleStart ? getAnniversary(coupleStart) : { daysUntil: null, progress: 0 }), [coupleStart]);

  // Сегодня годовщина? (тот же день и месяц, не в первый год)
  const anniversaryYears = useMemo(() => {
    if (!coupleStart) return 0;
    const now = new Date();
    if (now.getDate() === coupleStart.getDate() && now.getMonth() === coupleStart.getMonth()) {
      const y = now.getFullYear() - coupleStart.getFullYear();
      return y > 0 ? y : 0;
    }
    return 0;
  }, [coupleStart]);

  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    if (anniversaryYears <= 0) return;
    const todayKey = `anniv-${new Date().toISOString().slice(0, 10)}`;
    let t: ReturnType<typeof setTimeout> | undefined;
    // салют один раз в день
    AsyncStorage.getItem(todayKey).then((seen) => {
      if (seen) return;
      AsyncStorage.setItem(todayKey, '1');
      setShowConfetti(true);
      t = setTimeout(() => setShowConfetti(false), 6000);
    });
    return () => { if (t) clearTimeout(t); };
  }, [anniversaryYears]);

  const myName = profile.name || 'Ты';
  const partnerName = partnerProfile?.name || (hasPartner ? 'Партнёр' : 'Только ты');
  const headline = hasPartner ? `${myName} и ${partnerName}` : myName;
  const loveMessage = settings?.love_message || DEFAULT_MESSAGE;

  /* ── «Думаю о тебе» — realtime-волна сердец + push ── */
  const thinkKey = useMemo(() => {
    const ids = [uid, profile.partner_id].filter(Boolean).sort();
    return ids.length === 2 ? `think-${ids[0]}-${ids[1]}` : null;
  }, [profile.partner_id, uid]);

  const playWave = useCallback(() => {
    setShowWave(true);
    if (waveTimerRef.current) clearTimeout(waveTimerRef.current);
    waveTimerRef.current = setTimeout(() => setShowWave(false), 3200);
  }, []);

  useEffect(() => {
    if (!thinkKey) return;
    const ch = supabase.channel(thinkKey, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'heart' }, () => playWave());
    ch.subscribe();
    thinkChannelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      thinkChannelRef.current = null;
      if (waveTimerRef.current) clearTimeout(waveTimerRef.current);
    };
  }, [thinkKey, playWave]);

  const sendThinking = useCallback(() => {
    if (!hasPartner || thinkingSent) return;
    playWave();
    setThinkingSent(true);
    setTimeout(() => setThinkingSent(false), 4000);
    thinkChannelRef.current?.send({ type: 'broadcast', event: 'heart', payload: { from: uid } });
    sendPushNotification(`${myName} 💗`, 'думает о тебе', profile.partner_id).catch(() => {});
    toast.success('Сердечко отправлено 💗');
  }, [hasPartner, thinkingSent, playWave, uid, profile.partner_id, myName]);

  /* ── Моё настроение ── */
  const setMood = useCallback(async (emoji: string) => {
    const next = myMood === emoji ? null : emoji;
    setMyMood(next);
    try {
      await supabase.from('profiles').update({ mood: next, mood_at: next ? new Date().toISOString() : null }).eq('id', uid);
    } catch { /* столбца может ещё не быть — тихо игнорируем */ }
  }, [myMood, uid]);

  /* ── Серия ежедневных визитов (на устройстве) ── */
  useEffect(() => {
    const key = `streak_${uid}`;
    const todayStr = new Date().toISOString().slice(0, 10);
    AsyncStorage.getItem(key).then((raw) => {
      let saved: { count?: number; date?: string | null } = { count: 0, date: null };
      try { saved = JSON.parse(raw || '{}'); } catch { /* ignore */ }
      if (saved.date === todayStr) { setStreak(saved.count || 1); return; }
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const count = saved.date === yesterday ? (saved.count || 0) + 1 : 1;
      AsyncStorage.setItem(key, JSON.stringify({ count, date: todayStr }));
      setStreak(count);
    });
  }, [uid]);

  /* ── «В сети»: обновляем last_seen раз в минуту ── */
  useEffect(() => {
    const ping = () => supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', uid).then(() => {}, () => {});
    ping();
    const id = setInterval(ping, 60000);
    return () => clearInterval(id);
  }, [uid]);

  /* ── Загрузка данных (те же запросы, что в вебе) ── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [{ data: settingsData }, { data: events }] = await Promise.all([
          supabase.from('couple_settings').select('*').eq('user_id', uid).maybeSingle(),
          supabase.from('calendar_events').select('id, title, emoji, event_date')
            .gte('event_date', new Date().toISOString()).order('event_date', { ascending: true }).limit(1).eq('user_id', uid),
        ]);
        if (!mounted) return;
        const fetched = (settingsData as Settings) || null;
        setSettings(fetched);
        setSettingsId(fetched?.id || null);
        setNewMessage(fetched?.love_message || DEFAULT_MESSAGE);
        setNewMeeting(utcToLocal(fetched?.next_meeting));
        setNextEvent(((events as NextEvent[] | null)?.[0]) || null);
      } catch (err) {
        console.warn('Ошибка загрузки главного экрана:', err);
      }
    })();
    return () => { mounted = false; };
  }, [profile.partner_id, uid]);

  async function persistSettings(patch: Record<string, unknown>) {
    const payload = {
      user_id: uid,
      love_message: settings?.love_message || DEFAULT_MESSAGE,
      next_meeting: settings?.next_meeting || null,
      ...patch,
    };
    if (settingsId) {
      const { data, error } = await supabase.from('couple_settings').update(payload).eq('id', settingsId).select().single();
      if (error) throw error;
      return data as Settings;
    }
    const { data, error } = await supabase.from('couple_settings').insert(payload).select().single();
    if (error) throw error;
    return data as Settings;
  }

  async function saveMessage() {
    setSaving(true);
    try {
      const saved = await persistSettings({ love_message: newMessage.trim() || DEFAULT_MESSAGE });
      setSettings(saved);
      setSettingsId(saved?.id || null);
      setNewMessage(saved?.love_message || DEFAULT_MESSAGE);
      setEditMessage(false);
    } catch (err) {
      console.warn('Ошибка сохранения:', err);
    } finally {
      setSaving(false);
    }
  }

  async function saveMeeting() {
    setSaving(true);
    try {
      // сбрасываем флаг напоминания, чтобы новое время встречи снова уведомило
      const saved = await persistSettings({ next_meeting: localToUTC(newMeeting), meeting_notified_at: null });
      setSettings(saved);
      setSettingsId(saved?.id || null);
      setNewMeeting(utcToLocal(saved?.next_meeting));
      setEditMeeting(false);
    } catch (err) {
      console.warn('Ошибка сохранения:', err);
    } finally {
      setSaving(false);
    }
  }

  const openSettings = useCallback(() => router.navigate('/settings'), []);
  const openMoments = useCallback(() => router.navigate('/moments'), []);
  const openChat = useCallback(() => router.navigate('/chat'), []);
  const openCalendar = useCallback(() => router.navigate('/calendar'), []);

  const partnerStatusText = relTime(partnerProfile?.last_seen);
  const partnerOnline = partnerStatusText === 'онлайн';
  const partnerMood = partnerProfile?.mood && partnerProfile.mood_at && Date.now() - new Date(partnerProfile.mood_at).getTime() < 86400000
    ? partnerProfile.mood : null;

  /* ── Напоминания: дни рождения / годовщина / события (сегодня и завтра) ── */
  const [remDismissed, setRemDismissed] = useState(false);
  const reminders = useMemo(() => {
    const md = (d: string) => { const x = new Date(d); return `${x.getMonth() + 1}-${x.getDate()}`; };
    const now = new Date(), tom = new Date(Date.now() + 86400000);
    const tMD = `${now.getMonth() + 1}-${now.getDate()}`;
    const nMD = `${tom.getMonth() + 1}-${tom.getDate()}`;
    const whenOf = (m: string) => (m === tMD ? 'Сегодня' : m === nMD ? 'Завтра' : null);
    const out: { icon: string; text: string }[] = [];
    if (partnerProfile?.birthday) {
      const w = whenOf(md(partnerProfile.birthday));
      if (w) out.push({ icon: '🎂', text: `${w} день рождения у ${partnerName}` });
    }
    if (coupleStart) {
      const w = whenOf(`${coupleStart.getMonth() + 1}-${coupleStart.getDate()}`);
      if (w) {
        const years = (w === 'Завтра' ? tom : now).getFullYear() - coupleStart.getFullYear();
        out.push({ icon: '💍', text: years > 0 ? `${w}: ${years} ${yearsWord(years)} вместе` : `${w} — ваша годовщина` });
      }
    }
    if (nextEvent?.event_date) {
      const w = whenOf(md(nextEvent.event_date));
      if (w) out.push({ icon: nextEvent.emoji || '📅', text: `${w}: ${nextEvent.title}` });
    }
    return out;
  }, [partnerProfile?.birthday, coupleStart, nextEvent, partnerName]);

  // локальное системное уведомление раз в день (как reg.showNotification в вебе)
  useEffect(() => {
    if (!reminders.length) return;
    const key = `home_reminded_${new Date().toISOString().slice(0, 10)}`;
    AsyncStorage.getItem(key).then(async (done) => {
      if (done) return;
      await AsyncStorage.setItem(key, '1');
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;
      for (const r of reminders) {
        Notifications.scheduleNotificationAsync({ content: { title: 'Love App 💕', body: `${r.icon} ${r.text}` }, trigger: null }).catch(() => {});
      }
    });
  }, [reminders]);

  const titleSize = width <= 370 ? 32 : Math.min(52, Math.max(34, width * 0.09));
  const thinkBeat = useLoop(1100, 0, Easing.inOut(Easing.ease));
  const annivPulse = useLoop(2000, 0, Easing.inOut(Easing.ease));

  return (
    <View style={s.screen}>
      <CssBackground angle={165} stops={SUNSET_STOPS}
        radials={[{ x: 84, y: 4, color: 'rgba(255,214,150,0.30)', stop: 40 }, { x: 8, y: 96, color: 'rgba(60,20,45,0.55)', stop: 52 }]} />
      <HeartsBackground />
      <Blob style={{ top: 60, left: -50 }} size={220} color="rgba(255,195,130,0.22)" duration={24000} />
      <Blob style={{ top: 280, right: -50 }} size={240} color="rgba(180,50,90,0.28)" duration={30000} reverse />

      <ScrollView contentContainerStyle={[s.shell, { paddingTop: insets.top + 24, paddingBottom: 96 + insets.bottom, paddingHorizontal: width <= 370 ? 10 : 16 }]}
        showsVerticalScrollIndicator={false}>
        {reminders.length > 0 && !remDismissed ? (
          <Reveal>
            <LinearGradient {...cssLinear(135, ['rgba(255,215,106,0.20)', 'rgba(255,141,160,0.18)'])} style={s.remBanner}>
              <Pressable onPress={() => setRemDismissed(true)} accessibilityLabel="Скрыть" style={s.remClose}><Text style={s.remCloseText}>×</Text></Pressable>
              <Text style={s.remHead}>НЕ ЗАБУДЬ ✨</Text>
              {reminders.map((r, i) => (
                <View style={s.remRow} key={i}>
                  <Text style={s.remIc}>{r.icon}</Text>
                  <Text style={s.remText}>{r.text}</Text>
                </View>
              ))}
            </LinearGradient>
          </Reveal>
        ) : null}

        {/* ── Hero card ── */}
        <Reveal>
          <View style={s.heroCard}>
            <LinearGradient {...cssLinear(180, ['rgba(46,16,34,0.30)', 'rgba(46,16,34,0.14)'])} style={[StyleSheet.absoluteFill, { borderRadius: 28 }]} />
            <HeroGlow />
            <View style={s.heroTop}>
              <View />
              <Pressable onPress={openSettings} accessibilityRole="button" style={({ pressed }) => [s.heroButton, pressed && { transform: [{ scale: 0.97 }], backgroundColor: 'rgba(255,255,255,0.32)' }]}>
                <Text style={s.heroButtonText}>Настройки</Text>
              </Pressable>
            </View>

            <View style={s.heroContent}>
              <View style={s.heroAvatars}>
                <AvatarMedallion src={profile.avatar_url} name={myName} onPress={openSettings} />
                {hasPartner ? (
                  <>
                    <View style={s.heroLink}>
                      <LinearGradient colors={['transparent', 'rgba(255,255,255,0.65)', 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
                      <Text style={s.heroLinkHeart}>♥</Text>
                    </View>
                    {partnerLoading
                      ? <AvatarMedallion name="…" ghost />
                      : <AvatarMedallion src={partnerProfile?.avatar_url} name={partnerName} onPress={() => setShowPartnerModal(true)} />}
                  </>
                ) : null}
              </View>

              {hasPartner ? (
                <View style={s.heroStatus}>
                  <View style={s.heroStatusLine}>
                    {partnerStatusText ? (
                      <View style={s.statusChip}>
                        <View style={[s.statusDot, partnerOnline && s.statusDotOnline]} />
                        <Text style={s.statusChipText}>{partnerName}: {partnerStatusText}</Text>
                      </View>
                    ) : null}
                    {partnerMood ? <View style={s.statusChip}><Text style={s.statusChipText}>{partnerMood} настроение</Text></View> : null}
                    {streak > 1 ? <View style={s.statusChip}><Text style={s.statusChipText}>🔥 {streak} дн подряд</Text></View> : null}
                  </View>
                  <View style={s.moodRow}>
                    <Text style={s.moodRowLabel}>Как ты?</Text>
                    {STATUS_MOODS.map((m) => (
                      <Pressable key={m.e} onPress={() => setMood(m.e)} accessibilityRole="button" accessibilityLabel={m.label}
                        accessibilityState={{ selected: myMood === m.e }}
                        style={({ pressed }) => [s.moodPick, myMood === m.e && s.moodPickActive, pressed && { transform: [{ scale: 0.88 }] }]}>
                        <Text style={s.moodPickText}>{m.e}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={s.heroTitleWrap}>
                <Text style={s.heroOverline}>ГЛАВНАЯ ИСТОРИЯ</Text>
                <Text style={[s.heroTitle, { fontSize: titleSize, lineHeight: titleSize * 0.98 }]} accessibilityRole="header">{headline}</Text>
                {anniversaryYears > 0 ? (
                  <Animated.View style={{ transform: [{ scale: annivPulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.02, 1] }) }] }}>
                    <LinearGradient {...cssLinear(135, ['rgba(255,215,106,0.22)', 'rgba(255,141,160,0.22)'])} style={s.heroAnniversary}>
                      <Text style={s.heroAnniversaryText}>🎉 С годовщиной! {anniversaryYears} {yearsWord(anniversaryYears)} вместе</Text>
                    </LinearGradient>
                  </Animated.View>
                ) : null}
              </View>

              <HeroCounter coupleStart={coupleStart} anniversary={anniversary} hasPartner={hasPartner} hasStartDate={hasStartDate} onSettings={openSettings} />

              {hasPartner ? (
                <Pressable onPress={sendThinking} disabled={thinkingSent} accessibilityRole="button"
                  style={({ pressed }) => [s.thinkingWrap, thinkingSent && { opacity: 0.7 }, pressed && { transform: [{ scale: 0.97 }] }]}>
                  <LinearGradient {...cssLinear(135, ['#ff8da0', '#d8456b'])} style={s.thinkingBtn}>
                    <Animated.Text style={[s.thinkingHeart, { transform: [{ scale: beatScale(thinkBeat, 1.28) }] }]}>♥</Animated.Text>
                    <Text style={s.thinkingText}>{thinkingSent ? 'Отправлено' : 'Думаю о тебе'}</Text>
                  </LinearGradient>
                </Pressable>
              ) : null}
            </View>
          </View>
        </Reveal>

        {/* ── Наша история ── */}
        {hasPartner ? (
          <Reveal duration={600}>
            <Pressable onPress={() => setShowStory(true)} accessibilityRole="button" accessibilityLabel="Наша история"
              onLayout={(e) => setStoryW(e.nativeEvent.layout.width)} style={({ pressed }) => [pressed && { transform: [{ scale: 0.985 }] }]}>
              <LinearGradient {...cssLinear(120, [['#6a2747', 0], ['#bd5552', 0.55], ['#e09a6f', 1]])} style={s.storyCard}>
                <Shine width={storyW} fraction={0.45} duration={6000} startLeft={-0.5} />
                <Text style={s.storySpark}>✨</Text>
                <View style={s.storyText}>
                  <Text style={s.storyTitle}>Наша история</Text>
                  <Text style={s.storySub}>Кино про вас двоих — нажми ▸</Text>
                </View>
                <View style={s.storyPlay}><IPlay size={20} /></View>
              </LinearGradient>
            </Pressable>
          </Reveal>
        ) : null}

        {/* ── Quick actions ── */}
        <View style={[s.quickGrid, width <= 370 && { flexDirection: 'column' }]}>
          <QuickAction badge="Раздел" title="Моменты" subtitle="Ваши общие кадры и воспоминания." icon={<ICamera size={22} color="#fff" />} onPress={openMoments} delay={0.08} />
          <QuickAction badge="Быстрый переход" title="Чат" subtitle="Открыть ваш диалог прямо сейчас." icon={<IChat size={22} color="#fff" />} onPress={openChat} delay={0.14} />
        </View>

        {/* ── Info row ── */}
        <InfoCard eyebrow="Скоро" title="Ближайшее событие" delay={0.26}>
          {nextEvent ? (
            <View style={s.eventRow}>
              <View style={s.eventLine}>
                <View style={s.eventEmoji}><Text style={{ fontSize: 22 }}>{nextEvent.emoji || '•'}</Text></View>
                <View style={s.eventCopy}>
                  <Text style={s.eventName} numberOfLines={1}>{nextEvent.title}</Text>
                  <Text style={s.eventDate}>{formatDayMonth(nextEvent.event_date)}</Text>
                </View>
                <View style={s.eventDays}>
                  <Text style={s.eventDaysText}>{Math.max(0, Math.ceil((new Date(nextEvent.event_date).getTime() - Date.now()) / 86400000))} дн</Text>
                </View>
              </View>
              <View style={s.actionsRow}><Btn ghost label="Открыть календарь" onPress={openCalendar} /></View>
            </View>
          ) : (
            <View style={s.eventRow}>
              <Text style={s.noteText}>Добавьте событие: встречу, поездку, ужин или особую дату.</Text>
              <View style={s.actionsRow}><Btn label="Создать событие" onPress={openCalendar} /></View>
            </View>
          )}
        </InfoCard>

        <InfoCard eyebrow="Отсчёт" title="До встречи" delay={0.32} compact>
          {editMeeting ? (
            <>
              <DateTimeInput mode="datetime" value={newMeeting} onChange={setNewMeeting} style={s.field} textStyle={s.fieldText}
                placeholder="дд.мм.гггг, --:--" placeholderColor="rgba(255,255,255,0.55)" label="Дата и время встречи" />
              <View style={s.actionsRow}>
                <Btn label={saving ? 'Сохраняю…' : 'Сохранить'} onPress={saveMeeting} disabled={saving} />
                <Btn ghost label="Отмена" onPress={() => setEditMeeting(false)} />
              </View>
            </>
          ) : (
            <MeetingBody nextMeeting={settings?.next_meeting} onEdit={() => setEditMeeting(true)} />
          )}
        </InfoCard>

        {/* ── Love message ── */}
        <InfoCard eyebrow="Личное" title="Ваше сообщение" delay={0.38}>
          {editMessage ? (
            <>
              <TextInput style={[s.field, s.fieldText, { minHeight: 104, textAlignVertical: 'top' }]} multiline value={newMessage} onChangeText={setNewMessage}
                placeholder="Напишите фразу, ради которой хочется возвращаться на главный экран" placeholderTextColor="rgba(255,255,255,0.55)"
                selectionColor="#fff" accessibilityLabel="Ваше сообщение" />
              <View style={s.actionsRow}>
                <Btn label={saving ? 'Сохраняю…' : 'Сохранить'} onPress={saveMessage} disabled={saving} />
                <Btn ghost label="Отмена" onPress={() => setEditMessage(false)} />
              </View>
            </>
          ) : (
            <>
              <Text style={s.noteText}><Text style={s.noteStrong}>«{loveMessage}»</Text></Text>
              <View style={s.actionsRow}><Btn ghost label="Редактировать" onPress={() => setEditMessage(true)} /></View>
            </>
          )}
        </InfoCard>
      </ScrollView>

      {showPartnerModal ? <PartnerModal profile={partnerProfile} loading={partnerLoading} onClose={() => setShowPartnerModal(false)} /> : null}
      {showWave ? <HeartWave /> : null}
      {showConfetti ? <Confetti /> : null}
      {showStory ? <LoveStory uid={uid} profile={profile} partnerName={partnerName} coupleStart={coupleStart} onClose={() => setShowStory(false)} /> : null}
    </View>
  );
}

const helv = { fontFamily: fonts.numericBold, fontVariant: ['tabular-nums' as const, 'lining-nums' as const] };

const s = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  shell: { gap: 12, width: '100%', maxWidth: 480, alignSelf: 'center' },

  heroCard: {
    borderRadius: 28, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 22, overflow: 'hidden', borderWidth: 1, borderColor: C.line,
    shadowColor: 'rgb(40,12,28)', shadowOpacity: 0.36, shadowRadius: 30, shadowOffset: { width: 0, height: 24 },
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 },
  heroButton: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.40)', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 },
  heroButtonText: { color: C.textMain, fontSize: 12, fontFamily: fonts.body },
  heroContent: { gap: 16 },

  heroAvatars: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  heroLink: { width: 34, height: 1, alignItems: 'center', justifyContent: 'center' },
  heroLinkHeart: {
    position: 'absolute', color: '#fff', fontSize: 12, top: -9,
    textShadowColor: 'rgba(255,150,180,0.8)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 },
  },
  avatar: { alignItems: 'center', gap: 7 },
  avatarShell: {
    width: 80, height: 80, padding: 2.5, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    shadowColor: 'rgb(150,30,60)', shadowOpacity: 0.3, shadowRadius: 15, shadowOffset: { width: 0, height: 12 },
  },
  avatarInner: { width: '100%', height: '100%', borderRadius: 999, overflow: 'hidden' },
  avatarFallback: { color: '#fff', fontSize: 22, fontFamily: fonts.bodyBold, letterSpacing: 1.76 },
  avatarName: { fontSize: 11, color: C.textSoft, fontFamily: fonts.body },

  heroTitleWrap: { gap: 7, alignItems: 'center' },
  heroOverline: { fontSize: 10, letterSpacing: 2.6, color: C.gold, fontFamily: fonts.body },
  heroTitle: {
    fontFamily: fonts.display, color: C.textMain, textAlign: 'center', letterSpacing: -1,
    textShadowColor: 'rgba(140,30,55,0.25)', textShadowRadius: 18, textShadowOffset: { width: 0, height: 2 },
  },
  heroAnniversary: { marginTop: 2, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,215,106,0.45)' },
  heroAnniversaryText: { color: '#fff', fontFamily: fonts.bodySemi, fontSize: 13.5, textAlign: 'center' },

  heroCounter: { gap: 12 },
  heroCounterMain: { alignItems: 'center', gap: 6 },
  heroCounterNumber: { flexDirection: 'row', gap: 8, alignItems: 'baseline', justifyContent: 'center', flexWrap: 'wrap' },
  heroNum: {
    ...helv, color: C.textMain, letterSpacing: -2.5,
    textShadowColor: 'rgba(140,30,55,0.30)', textShadowRadius: 28, textShadowOffset: { width: 0, height: 8 },
  },
  heroNumLabel: { fontSize: 13, color: C.gold, letterSpacing: 2.1, fontFamily: fonts.body },
  heroClock: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)' },
  heroClockText: { ...helv, fontFamily: fonts.numeric, color: C.textMain, fontSize: 13, letterSpacing: 0.8 },
  heroProgress: { height: 6, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.22)' },
  heroProgressBar: { height: '100%', borderRadius: 999 },
  heroMetrics: { flexDirection: 'row', gap: 8 },
  heroMetric: { flex: 1, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)', alignItems: 'center' },
  heroMetricValue: { ...helv, color: C.textMain, fontSize: 26, lineHeight: 28, marginBottom: 4 },
  heroMetricLabel: { fontSize: 10, letterSpacing: 1.3, color: C.textMuted, fontFamily: fonts.body, textAlign: 'center' },

  heroStatus: { gap: 10, padding: 12, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  heroStatusLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center' },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.22)' },
  statusChipText: { color: C.textSoft, fontSize: 12, fontFamily: fonts.bodyMedium },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  statusDotOnline: { backgroundColor: '#43d97a', shadowColor: 'rgb(67,217,122)', shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  moodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' },
  moodRowLabel: { fontSize: 12, color: C.textMuted, marginRight: 2, fontFamily: fonts.body },
  moodPick: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  moodPickActive: { backgroundColor: 'rgba(255,141,160,0.28)', borderColor: 'rgba(255,141,160,0.7)', transform: [{ scale: 1.08 }] },
  moodPickText: { fontSize: 17, lineHeight: 21 },

  thinkingWrap: {
    marginTop: 4, borderRadius: 999,
    shadowColor: 'rgb(216,69,107)', shadowOpacity: 0.4, shadowRadius: 13, shadowOffset: { width: 0, height: 10 }, elevation: 6,
  },
  thinkingBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 13, paddingHorizontal: 18, borderRadius: 999 },
  thinkingHeart: { fontSize: 17, lineHeight: 20, color: '#fff' },
  thinkingText: { color: '#fff', fontFamily: fonts.bodySemi, fontSize: 15, letterSpacing: 0.15 },

  remBanner: { borderRadius: 20, paddingVertical: 14, paddingLeft: 16, paddingRight: 40, borderWidth: 1, borderColor: 'rgba(255,215,106,0.42)', gap: 8 },
  remHead: { fontSize: 11, letterSpacing: 2, color: C.gold, fontFamily: fonts.bodyBold },
  remRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  remIc: { fontSize: 20 },
  remText: { flex: 1, fontSize: 14, fontFamily: fonts.bodySemi, color: '#fff', lineHeight: 18 },
  remClose: { position: 'absolute', top: 8, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  remCloseText: { color: '#fff', fontSize: 18, lineHeight: 20 },

  storyCard: {
    overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 22,
    shadowColor: 'rgb(150,40,70)', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 16 },
  },
  storySpark: { fontSize: 26, textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } },
  storyText: { flex: 1, gap: 2 },
  storyTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 26, color: '#fff' },
  storySub: { fontSize: 12.5, color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body },
  storyPlay: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },

  quickGrid: { flexDirection: 'row', gap: 12 },
  glass: {
    overflow: 'hidden', borderWidth: 1, borderColor: C.lineSoft,
    shadowColor: 'rgb(40,12,28)', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 16 },
  },
  quickAction: { flex: 1, padding: 16, gap: 12 },
  quickTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  quickIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.40)' },
  quickBadge: { flexShrink: 1, fontSize: 10, letterSpacing: 1.6, color: C.gold, fontFamily: fonts.body, textAlign: 'right' },
  quickTitle: { fontFamily: fonts.displayRegular, fontSize: 28, lineHeight: 28, color: C.textMain },
  quickSubtitle: { color: C.textSoft, fontSize: 13, lineHeight: 21, fontFamily: fonts.body },

  infoCard: { padding: 16, gap: 12 },
  infoEyebrow: { fontSize: 10, letterSpacing: 2, color: C.gold, fontFamily: fonts.body },
  infoTitle: { fontFamily: fonts.displayRegular, fontSize: 26, lineHeight: 26, color: C.textMain },

  eventRow: { gap: 10 },
  meetingRow: { gap: 10 },
  eventLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventEmoji: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)', alignItems: 'center', justifyContent: 'center' },
  eventCopy: { flex: 1, minWidth: 0 },
  eventName: { color: C.textMain, fontSize: 15, fontFamily: fonts.body },
  eventDate: { marginTop: 3, color: C.textSoft, fontSize: 12, fontFamily: fonts.body },
  eventDays: { minWidth: 56, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center' },
  eventDaysText: { ...helv, color: C.coralDeep, fontSize: 12, lineHeight: 17 },

  meetingPhrase: { fontSize: 14, lineHeight: 21, color: C.textSoft, fontFamily: fonts.body },
  meetingStrong: { ...helv, color: C.gold },
  meetingGrid: { flexDirection: 'row', gap: 8 },
  meetingCell: { flex: 1, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)', alignItems: 'center' },
  meetingNum: { ...helv, color: C.textMain, fontSize: 24, lineHeight: 26 },
  meetingLabel: { marginTop: 3, fontSize: 10, letterSpacing: 1.3, color: C.textMuted, fontFamily: fonts.body },

  noteText: { color: C.textSoft, fontSize: 14, lineHeight: 24, fontFamily: fonts.body },
  noteStrong: { color: C.textMain, fontFamily: fonts.bodyMedium },
  field: {
    width: '100%', minHeight: 48, paddingVertical: 13, paddingHorizontal: 15, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)', backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center',
  },
  fieldText: { color: C.textMain, fontSize: 15, fontFamily: fonts.body },
  actionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btnPrimary: {
    borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#ffffff',
    shadowColor: 'rgb(150,30,60)', shadowOpacity: 0.26, shadowRadius: 13, shadowOffset: { width: 0, height: 10 }, elevation: 4,
  },
  btnPrimaryText: { color: C.coralDeep, fontFamily: fonts.bodySemi, fontSize: 13 },
  btnGhost: { borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)' },
  btnGhostText: { color: C.textMain, fontFamily: fonts.body, fontSize: 13 },

  partnerOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  partnerDialog: {
    width: 320, maxWidth: '100%', borderRadius: 26, padding: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)',
    alignItems: 'center', gap: 10, shadowColor: 'rgb(120,30,55)', shadowOpacity: 0.5, shadowRadius: 36, shadowOffset: { width: 0, height: 24 },
  },
  partnerClose: { position: 'absolute', top: 12, right: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)', backgroundColor: 'rgba(255,255,255,0.20)', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, zIndex: 2 },
  partnerCloseText: { color: '#fff', fontSize: 12, fontFamily: fonts.body },
  partnerTitle: { fontFamily: fonts.displayRegular, fontSize: 30, color: '#fff' },
  partnerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontFamily: fonts.body },
});
