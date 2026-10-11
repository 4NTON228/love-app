// Порт src/components/Calendar.jsx — «Наш календарь».
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import type { ImagePickerAsset } from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { Radials } from '@/components/Backgrounds';
import { DateTimeInput } from '@/components/DateTimeInput';
import { FormFileLabel, FormGroup, FormInput, FormSubmit, WebModal } from '@/components/webui';
import { chooseImage, compressImage, uploadToStorage } from '@/lib/media';
import { sendPushNotification } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { useMe } from '@/providers/AuthProvider';
import { colors, cssLinear, fonts } from '@/theme';

const IcoClose = () => <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round"><Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" /></Svg>;
const IcoCamera = () => <Svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><Circle cx="12" cy="13" r="4" /></Svg>;
const IcoPlus = () => <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round"><Line x1="12" y1="5" x2="12" y2="19" /><Line x1="5" y1="12" x2="19" y2="12" /></Svg>;
const IcoChevron = ({ dir }: { dir: 'left' | 'right' }) => <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={colors.text} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">{dir === 'left' ? <Polyline points="15 6 9 12 15 18" /> : <Polyline points="9 6 15 12 9 18" />}</Svg>;
const IcoTrash = () => <Svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke={colors.textMuted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Polyline points="3 6 5 6 21 6" /><Path d="M19 6l-1 14H6L5 6" /><Path d="M10 11v6M14 11v6" /><Path d="M9 6V4h6v2" /></Svg>;
const IcoCheck = () => <Svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><Polyline points="20 6 9 17 4 12" /></Svg>;

function LoadingHeart() {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => { Animated.loop(Animated.timing(v, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true })).start(); }, [v]);
  return (
    <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 1] }) }] }}>
      <Svg viewBox="0 0 60 56" width={44} height={40} fill="none"><Path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z" fill="rgba(255,141,160,0.5)" stroke="rgba(255,141,160,0.7)" strokeWidth={2} /></Svg>
    </Animated.View>
  );
}

const MONTHS_FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const EMOJIS = ['❤️', '🥰', '🎉', '🎂', '🎬', '🍕', '✈️', '🌅', '🎵', '💐', '🏖️', '🎄', '🌸', '🎭', '🌙', '⭐'];
const DAY_MOODS = [
  { e: '🥰', label: 'Любовь' }, { e: '😊', label: 'Хорошо' }, { e: '😌', label: 'Спокойно' },
  { e: '🔥', label: 'Страсть' }, { e: '😕', label: 'Так себе' }, { e: '😢', label: 'Грустно' },
];
const MOOD_COLOR: Record<string, string> = { '🥰': '#ff5c7a', '😊': '#f7b94a', '😌': '#4cc6c0', '🔥': '#ff7a45', '😕': '#9aa0a6', '😢': '#5b8def' };
const WD_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

function sameMonthDay(dateStr: string | null | undefined, m: number, d: number) {
  if (!dateStr) return false;
  const x = new Date(dateStr);
  return x.getMonth() === m && x.getDate() === d;
}
function keyOf(d: string | Date) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
function yearsWord(n: number) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return 'год';
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return 'года';
  return 'лет';
}

type Ev = { id: string; user_id: string; title: string; description: string | null; event_date: string; emoji: string | null; photo_url: string | null };
type Ph = { id: string; title: string | null; photo_url: string | null; thumb_url: string | null; created_at: string; mood: string | null };
type Pl = { id: string; title: string; completed: boolean | null; completed_at: string | null; created_at: string };
type Md = { id: string; user_id: string; day: string; mood: string | null; note?: string | null };
type Day = { events: Ev[]; photos: Ph[]; plans: Pl[]; moods: Md[] };
const EMPTY: Day = { events: [], photos: [], plans: [], moods: [] };

function CardIn({ children, style }: { children: React.ReactNode; style?: object }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start(); }, [v]);
  return <Animated.View style={[st.card, style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>{children}</Animated.View>;
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start(); }, [v]);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={st.lb} onPress={onClose} accessibilityLabel="Закрыть фото">
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,3,6,0.86)' }]} />
        <Animated.View style={{ width: '100%', height: '82%', opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
          <Image source={{ uri: url }} style={{ flex: 1, borderRadius: 18 }} contentFit="contain" />
        </Animated.View>
        <Pressable onPress={onClose} style={[st.lbClose, { top: 18 + insets.top }]} accessibilityLabel="Закрыть"><IcoClose /></Pressable>
        <Text style={[st.lbHint, { bottom: 28 + insets.bottom }]}>нажмите, чтобы закрыть</Text>
      </Pressable>
    </Modal>
  );
}

export default function CalendarScreen() {
  const { uid, profile } = useMe();
  const pid = profile.partner_id;
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<Ev[]>([]);
  const [photos, setPhotos] = useState<Ph[]>([]);
  const [plans, setPlans] = useState<Pl[]>([]);
  const [moods, setMoods] = useState<Md[]>([]);
  const [special, setSpecial] = useState<{ partnerName: string; partnerBday: string | null; coupleStart: string | null; nextMeeting: string | null }>({ partnerName: '', partnerBday: null, coupleStart: null, nextMeeting: null });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });
  const [selected, setSelected] = useState(() => keyOf(new Date()));
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [emoji, setEmoji] = useState('❤️');
  const [photo, setPhoto] = useState<ImagePickerAsset | null>(null);

  const load = useCallback(async () => {
    const ids = [uid, pid].filter(Boolean) as string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scoped = (q: any) => (ids.length === 1 ? q.eq('user_id', ids[0]) : q.in('user_id', ids));
    const [ev, mo, pl, md] = await Promise.all([
      scoped(supabase.from('calendar_events').select('*')),
      scoped(supabase.from('moments').select('id,title,photo_url,thumb_url,created_at,mood')),
      scoped(supabase.from('plans').select('id,title,completed,completed_at,created_at')),
      scoped(supabase.from('day_moods').select('id,user_id,day,mood,note')),
    ]);
    setEvents(ev.data || []);
    setPhotos(mo.data || []);
    setPlans(pl.data || []);
    setMoods(md.data || []);
    // Особые даты: ДР партнёра, годовщина, ближайшая встреча
    try {
      const [partnerRes, setRes] = await Promise.all([
        pid ? supabase.from('profiles').select('name,birthday').eq('id', pid).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('couple_settings').select('next_meeting').eq('user_id', uid).maybeSingle(),
      ]);
      const pr = partnerRes.data as { name?: string; birthday?: string } | null;
      setSpecial({
        partnerName: pr?.name || 'Партнёр',
        partnerBday: pr?.birthday || null,
        coupleStart: profile.couple_start_date || null,
        nextMeeting: (setRes.data as { next_meeting?: string } | null)?.next_meeting || null,
      });
    } catch { /* optional */ }
    setLoading(false);
  }, [uid, pid, profile.couple_start_date]);

  useEffect(() => { load(); }, [load]);

  const byDay = useMemo(() => {
    const map: Record<string, Day> = {};
    const add = (k: string, type: keyof Day, item: never) => { (map[k] ??= { events: [], photos: [], plans: [], moods: [] })[type].push(item); };
    events.forEach((e) => e.event_date && add(keyOf(e.event_date), 'events', e as never));
    photos.forEach((p) => p.created_at && add(keyOf(p.created_at), 'photos', p as never));
    plans.forEach((p) => { if (p.completed && p.completed_at) add(keyOf(p.completed_at), 'plans', p as never); });
    moods.forEach((m) => m.day && add(keyOf(m.day), 'moods', m as never));
    return map;
  }, [events, photos, plans, moods]);

  async function saveMood(e: string) {
    const day = selected;
    const mine = moods.find((m) => m.user_id === uid && keyOf(m.day) === day);
    const next = mine && mine.mood === e ? null : e; // повторное касание — снять
    setMoods((prev) => {
      const rest = prev.filter((m) => !(m.user_id === uid && keyOf(m.day) === day));
      return next ? [...rest, { id: mine?.id || `tmp-${day}`, user_id: uid, day, mood: next }] : rest;
    });
    if (next) {
      await supabase.from('day_moods').upsert({ user_id: uid, day, mood: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day' });
    } else if (mine?.id) {
      await supabase.from('day_moods').delete().eq('user_id', uid).eq('day', day);
    }
  }

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(view.y, view.m + 1, 0).getDate();
    const arr: (string | null)[] = [];
    for (let i = 0; i < lead; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(keyOf(new Date(view.y, view.m, d)));
    return arr;
  }, [view]);

  const todayKey = keyOf(new Date());
  const sel = byDay[selected] || EMPTY;
  const selDate = new Date(selected);
  const myMood = sel.moods.find((m) => m.user_id === uid)?.mood || null;
  const partnerMood = sel.moods.find((m) => m.user_id !== uid)?.mood || null;

  const specialsFor = useCallback((key: string) => {
    const d = new Date(key), m = d.getMonth(), day = d.getDate();
    const out: { icon: string; label: string }[] = [];
    if (sameMonthDay(profile.birthday, m, day)) out.push({ icon: '🎂', label: 'Твой день рождения' });
    if (sameMonthDay(special.partnerBday, m, day)) out.push({ icon: '🎂', label: `День рождения · ${special.partnerName}` });
    if (sameMonthDay(special.coupleStart, m, day)) {
      const years = d.getFullYear() - new Date(special.coupleStart!).getFullYear();
      out.push({ icon: '💍', label: years > 0 ? `Годовщина · ${years} ${yearsWord(years)}` : 'Начало отношений' });
    }
    if (special.nextMeeting && keyOf(special.nextMeeting) === key) out.push({ icon: '📍', label: 'Встреча' });
    return out;
  }, [profile.birthday, special]);
  const selSpecials = specialsFor(selected);

  const monthStats = useMemo(() => {
    let ev = 0, ph = 0, pl = 0; const mc: Record<string, number> = {};
    Object.entries(byDay).forEach(([k, v]) => {
      const d = new Date(k);
      if (d.getMonth() !== view.m || d.getFullYear() !== view.y) return;
      ev += v.events.length; ph += v.photos.length; pl += v.plans.length;
      v.moods.forEach((m) => { if (m.mood) mc[m.mood] = (mc[m.mood] || 0) + 1; });
    });
    let top: string | null = null, max = 0;
    Object.entries(mc).forEach(([e, c]) => { if (c > max) { max = c; top = e; } });
    return { ev, ph, pl, top };
  }, [byDay, view]);

  const memories = useMemo(() => {
    const d = new Date(selected), m = d.getMonth(), day = d.getDate(), y = d.getFullYear();
    const out: ({ t: 'e'; it: Ev } | { t: 'p'; it: Ph })[] = [];
    events.forEach((e) => { if (sameMonthDay(e.event_date, m, day) && new Date(e.event_date).getFullYear() < y) out.push({ t: 'e', it: e }); });
    photos.forEach((p) => { if (sameMonthDay(p.created_at, m, day) && new Date(p.created_at).getFullYear() < y) out.push({ t: 'p', it: p }); });
    return out;
  }, [selected, events, photos]);

  const shiftMonth = (delta: number) => setView((v) => { const d = new Date(v.y, v.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  async function uploadPhoto(asset: ImagePickerAsset) {
    // как в вебе: исходное фото без уменьшения (в JPEG, чтобы открывалось и в браузере)
    const uri = await compressImage(asset.uri, asset.width, asset.height, 100000, 1);
    const path = `calendar/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    return uploadToStorage(uri, path, 'image/jpeg');
  }

  function openAdd() { setEventDate(selected); setShowModal(true); }

  async function handleSubmit() {
    if (!title || !eventDate) return;
    setSaving(true);
    try {
      let photoUrl: string | null = null;
      if (photo) photoUrl = await uploadPhoto(photo);
      const { error } = await supabase.from('calendar_events').insert({ user_id: uid, title, description, event_date: eventDate, emoji, photo_url: photoUrl });
      if (!error) {
        const t = title, e = emoji;
        setTitle(''); setDescription(''); setEventDate(''); setEmoji('❤️'); setPhoto(null);
        setShowModal(false); load();
        if (pid) sendPushNotification(`📅 ${profile.name || 'Партнёр'} · Новое событие`, `${e || '📅'} ${t}`, pid).catch(() => {});
      }
    } catch (err) { console.error(err); }
    setSaving(false);
  }

  function deleteEvent(id: string) {
    Alert.alert('Удалить это событие?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'OK', onPress: async () => { await supabase.from('calendar_events').delete().eq('id', id); load(); } },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 + 92 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={st.header}>
          <LinearGradient {...cssLinear(165, [['#5e2545', 0], ['#92384e', 0.44], ['#bd5552', 0.76], ['#cb6650', 1]])} style={StyleSheet.absoluteFill} />
          <Radials items={[{ x: 80, y: 0, color: 'rgba(255,210,150,0.28)', stop: 55 }]} />
          <View style={{ paddingTop: insets.top + 40, paddingHorizontal: 20, paddingBottom: 26 }}>
            <Text style={st.hTitle} accessibilityRole="header">Наш календарь</Text>
            <Text style={st.hSub}>{events.length} событий · {photos.length} фото · {plans.filter((p) => p.completed).length} выполнено</Text>
            <Pressable onPress={openAdd} accessibilityRole="button" style={({ pressed }) => [st.addBtn, pressed && { backgroundColor: 'rgba(255,255,255,0.26)' }]}>
              <IcoPlus /><Text style={st.addBtnText}>Добавить событие</Text>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={{ alignItems: 'center', padding: 50 }}><LoadingHeart /></View>
        ) : (
          <>
            <CardIn>
              <View style={st.monthbar}>
                <Pressable onPress={() => shiftMonth(-1)} accessibilityLabel="Назад" style={({ pressed }) => [st.navBtn, pressed && { backgroundColor: 'rgba(255,141,160,0.18)' }]}><IcoChevron dir="left" /></Pressable>
                <Text style={st.monthTitle}>{MONTHS_FULL[view.m]} {view.y}</Text>
                <Pressable onPress={() => shiftMonth(1)} accessibilityLabel="Вперёд" style={({ pressed }) => [st.navBtn, pressed && { backgroundColor: 'rgba(255,141,160,0.18)' }]}><IcoChevron dir="right" /></Pressable>
              </View>
              <View style={st.weekdays}>
                {WEEKDAYS.map((w) => <Text key={w} style={st.weekday}>{w.toUpperCase()}</Text>)}
              </View>
              <View style={st.grid}>
                {cells.map((k, i) => {
                  if (!k) return <View key={`e${i}`} style={st.cellWrap} />;
                  const d = byDay[k];
                  const day = Number(k.slice(8));
                  const isSel = k === selected, isToday = k === todayKey;
                  const moodE = d?.moods?.length ? d.moods[0].mood : null;
                  const sp = specialsFor(k);
                  const tint = moodE ? MOOD_COLOR[moodE] : null;
                  return (
                    <View key={k} style={st.cellWrap}>
                      <Pressable onPress={() => setSelected(k)} accessibilityRole="button" accessibilityState={{ selected: isSel }}
                        accessibilityLabel={`${day} ${MONTHS_GEN[view.m]}${sp.length ? `, ${sp[0].label}` : ''}`}
                        style={[st.cell, !isSel && tint ? { backgroundColor: `${tint}26` } : null, sp.length ? st.cellSpecial : null]}>
                        {isSel ? <LinearGradient {...cssLinear(160, ['#ff8da0', '#d8456b'])} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} /> : null}
                        {sp.length > 0 ? <Text style={st.cellSp}>{sp[0].icon}</Text> : null}
                        {moodE && !sp.length ? <Text style={st.cellMood}>{moodE}</Text> : null}
                        <Text style={[st.cellText, isToday && !isSel && { color: '#ff8da0', fontFamily: fonts.bodyBold }, isSel && { color: '#fff', fontFamily: fonts.bodyBold }]}>{day}</Text>
                        <View style={st.dots}>
                          {d?.events.length ? <View style={[st.dot, st.dotEv, isSel && st.dotSel]} /> : null}
                          {d?.photos.length ? <View style={[st.dot, st.dotPh, isSel && st.dotSel]} /> : null}
                          {d?.plans.length ? <View style={[st.dot, st.dotPl, isSel && st.dotSel]} /> : null}
                        </View>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </CardIn>

            <View style={st.summary}>
              <View style={st.sumCell}><Text style={st.sumNum}>{monthStats.ev}</Text><Text style={st.sumLbl}>СОБЫТИЙ</Text></View>
              <View style={st.sumCell}><Text style={st.sumNum}>{monthStats.ph}</Text><Text style={st.sumLbl}>ФОТО</Text></View>
              <View style={st.sumCell}><Text style={st.sumNum}>{monthStats.pl}</Text><Text style={st.sumLbl}>ВЫПОЛНЕНО</Text></View>
              <View style={st.sumCell}><Text style={[st.sumNum, { fontSize: 22 }]}>{monthStats.top || '—'}</Text><Text style={st.sumLbl}>НАСТРОЙ</Text></View>
            </View>

            <View style={st.legend}>
              <View style={st.leg}><View style={[st.dot, st.dotEv]} /><Text style={st.legText}>События</Text></View>
              <View style={st.leg}><View style={[st.dot, st.dotPh]} /><Text style={st.legText}>Фото</Text></View>
              <View style={st.leg}><View style={[st.dot, st.dotPl]} /><Text style={st.legText}>Планы</Text></View>
              <View style={st.leg}><Text style={st.legText}>🎂💍 Особые</Text></View>
            </View>

            <CardIn key={selected}>
              <View style={st.dayTitleRow}>
                <Text style={st.dayTitle}>{selDate.getDate()} {MONTHS_GEN[selDate.getMonth()]}</Text>
                <Text style={st.dayWd}>{WD_FULL[selDate.getDay()].charAt(0).toUpperCase() + WD_FULL[selDate.getDay()].slice(1)}</Text>
              </View>

              {selSpecials.map((s, i) => (
                <LinearGradient key={i} {...cssLinear(135, ['rgba(255,210,120,0.16)', 'rgba(255,141,160,0.12)'])} style={st.special}>
                  <Text style={{ fontSize: 20 }}>{s.icon}</Text>
                  <Text style={st.specialLbl}>{s.label}</Text>
                </LinearGradient>
              ))}

              <View style={st.moodBox}>
                <Text style={st.moodQ}>Каким был день?</Text>
                <View style={st.moodRow}>
                  {DAY_MOODS.map((m) => (
                    <Pressable key={m.e} onPress={() => saveMood(m.e)} accessibilityRole="button" accessibilityLabel={m.label} accessibilityState={{ selected: myMood === m.e }}
                      style={({ pressed }) => [st.moodBtn, myMood === m.e && st.moodBtnOn, pressed && { transform: [{ scale: 0.88 }] }]}>
                      <Text style={{ fontSize: 20, lineHeight: 24 }}>{m.e}</Text>
                    </Pressable>
                  ))}
                </View>
                {partnerMood ? <Text style={st.moodPartner}>{partnerMood} — настроение партнёра</Text> : null}
              </View>

              {sel.events.length === 0 && sel.photos.length === 0 && sel.plans.length === 0 ? (
                <Text style={st.emptyDay}>В этот день нет событий, фото и планов</Text>
              ) : (
                <>
                  {sel.events.map((ev) => (
                    <View style={st.row} key={`ev${ev.id}`}>
                      {ev.photo_url
                        ? <Pressable onPress={() => setLightbox(ev.photo_url)} accessibilityLabel="Открыть фото"><Image source={{ uri: ev.photo_url }} style={st.rowThumb} contentFit="cover" /></Pressable>
                        : <View style={st.rowEmoji}><Text style={{ fontSize: 22 }}>{ev.emoji || '📅'}</Text></View>}
                      <View style={st.rowMid}>
                        <Text style={st.rowName} numberOfLines={1}>{ev.title}</Text>
                        {ev.description ? <Text style={st.rowSub}>{ev.description}</Text> : null}
                      </View>
                      <Text style={[st.tag, st.tagEv]}>СОБЫТИЕ</Text>
                      {ev.user_id === uid ? <Pressable onPress={() => deleteEvent(ev.id)} accessibilityLabel="Удалить" style={{ padding: 4 }} hitSlop={6}><IcoTrash /></Pressable> : null}
                    </View>
                  ))}
                  {sel.photos.map((p) => (
                    <View style={st.row} key={`ph${p.id}`}>
                      {p.thumb_url || p.photo_url
                        ? <Pressable onPress={() => setLightbox(p.photo_url || p.thumb_url)} accessibilityLabel="Открыть фото"><Image source={{ uri: p.thumb_url || p.photo_url! }} style={st.rowThumb} contentFit="cover" /></Pressable>
                        : <View style={st.rowEmoji}><Text style={{ fontSize: 22 }}>📷</Text></View>}
                      <View style={st.rowMid}><Text style={st.rowName} numberOfLines={1}>{p.title || 'Момент'}</Text></View>
                      <Text style={[st.tag, st.tagPh]}>ФОТО</Text>
                    </View>
                  ))}
                  {sel.plans.map((p) => (
                    <View style={st.row} key={`pl${p.id}`}>
                      <LinearGradient {...cssLinear(135, ['#43d97a', '#1f9e54'])} style={st.check}><IcoCheck /></LinearGradient>
                      <View style={st.rowMid}>
                        <Text style={st.rowName} numberOfLines={1}>{p.title}</Text>
                        <Text style={st.rowSub}>Выполнено</Text>
                      </View>
                      <Text style={[st.tag, st.tagPl]}>ПЛАН</Text>
                    </View>
                  ))}
                </>
              )}

              {memories.length > 0 ? (
                <View style={st.memories}>
                  <Text style={st.memTitle}>✨ В ЭТОТ ДЕНЬ РАНЬШЕ</Text>
                  {memories.map((mm, i) => {
                    const it = mm.it;
                    const yr = new Date(mm.t === 'e' ? mm.it.event_date : mm.it.created_at).getFullYear();
                    const img = mm.t === 'e' ? mm.it.photo_url : (mm.it.thumb_url || mm.it.photo_url);
                    const full = mm.t === 'e' ? mm.it.photo_url : (mm.it.photo_url || mm.it.thumb_url);
                    const ago = new Date().getFullYear() - yr;
                    return (
                      <View style={st.row} key={`mem${i}`}>
                        {img
                          ? <Pressable onPress={() => setLightbox(full)} accessibilityLabel="Открыть фото"><Image source={{ uri: img }} style={st.rowThumb} contentFit="cover" /></Pressable>
                          : <View style={st.rowEmoji}><Text style={{ fontSize: 22 }}>{mm.t === 'e' ? (mm.it.emoji || '📅') : '📷'}</Text></View>}
                        <View style={st.rowMid}>
                          <Text style={st.rowName} numberOfLines={1}>{it.title || 'Момент'}</Text>
                          <Text style={st.rowSub}>{yr}</Text>
                        </View>
                        <Text style={[st.tag, st.tagPh]}>{`${ago} ${yearsWord(ago)} назад`.toUpperCase()}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </CardIn>
          </>
        )}
      </ScrollView>

      {lightbox ? <Lightbox url={lightbox} onClose={() => setLightbox(null)} /> : null}

      <WebModal visible={showModal} onClose={() => setShowModal(false)} title="Новое событие">
        <FormGroup label="Название">
          <FormInput placeholder="Наше первое свидание" value={title} onChangeText={setTitle} />
        </FormGroup>
        <FormGroup label="Дата">
          <DateTimeInput value={eventDate} onChange={setEventDate} style={st.dateInput} textStyle={st.dateText} placeholderColor={colors.textMuted} label="Дата события" />
        </FormGroup>
        <FormGroup label="Описание">
          <FormInput textarea placeholder="Что делали, какие эмоции..." value={description} onChangeText={setDescription} />
        </FormGroup>
        <FormGroup label="Эмодзи">
          <View style={st.emojiSelect}>
            {EMOJIS.map((e) => (
              <Pressable key={e} onPress={() => setEmoji(e)} accessibilityRole="button" accessibilityState={{ selected: emoji === e }}
                style={({ pressed }) => [st.emojiOption, emoji === e && st.emojiSelected, pressed && { opacity: 0.7 }]}>
                <Text style={{ fontSize: 20 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </FormGroup>
        <FormGroup label="Фото">
          <FormFileLabel icon={<IcoCamera />} label={photo ? (photo.fileName || 'Фото выбрано') : 'Выбрать фото'} onPress={async () => { const a = await chooseImage(); if (a) setPhoto(a); }} />
          {photo ? <Image source={{ uri: photo.uri }} style={st.photoPreview} contentFit="cover" /> : null}
        </FormGroup>
        <FormSubmit label={saving ? 'Сохраняем...' : 'Сохранить'} onPress={handleSubmit} disabled={saving} />
      </WebModal>
    </View>
  );
}

const st = StyleSheet.create({
  header: { borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden', shadowColor: 'rgb(60,20,40)', shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 12 } },
  hTitle: { fontFamily: fonts.displayRegular, fontSize: 26, color: '#fff' },
  hSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontFamily: fonts.body, marginTop: 2 },
  addBtn: { marginTop: 14, width: '100%', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', borderRadius: 14, padding: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addBtnText: { color: '#fff', fontFamily: fonts.bodyMedium, fontSize: 14 },

  card: { marginTop: 16, marginHorizontal: 14, padding: 14, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  monthbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthTitle: { fontFamily: fonts.displayRegular, fontSize: 21, color: colors.text },
  navBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  weekdays: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 10, fontFamily: fonts.bodySemi, color: colors.textMuted, letterSpacing: 0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellWrap: { width: `${100 / 7}%`, aspectRatio: 1, padding: 1 },
  cell: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 3 },
  cellSpecial: { borderWidth: 1.5, borderColor: 'rgba(255,210,120,0.6)' },
  cellText: { color: colors.text, fontFamily: fonts.body, fontSize: 14 },
  cellSp: { position: 'absolute', top: 2, right: 4, fontSize: 11 },
  cellMood: { position: 'absolute', top: 3, right: 5, fontSize: 11, lineHeight: 12 },
  dots: { flexDirection: 'row', gap: 3, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dotEv: { backgroundColor: '#ff8da0' },
  dotPh: { backgroundColor: '#5ec6c6' },
  dotPl: { backgroundColor: '#54df86' },
  dotSel: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },

  summary: { flexDirection: 'row', gap: 8, marginTop: 14, marginHorizontal: 14 },
  sumCell: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 3 },
  sumNum: { fontFamily: fonts.numericBold, fontSize: 22, color: colors.text, fontVariant: ['tabular-nums'] },
  sumLbl: { fontSize: 9.5, letterSpacing: 0.4, color: colors.textMuted, fontFamily: fonts.body },

  legend: { flexDirection: 'row', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12, marginHorizontal: 14 },
  leg: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legText: { fontSize: 11, color: colors.textMuted, fontFamily: fonts.body },

  dayTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 12 },
  dayTitle: { fontFamily: fonts.displayRegular, fontSize: 20, color: colors.text },
  dayWd: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  special: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,210,120,0.35)' },
  specialLbl: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.text },
  moodBox: { padding: 12, borderRadius: 16, backgroundColor: colors.surface2, marginBottom: 14 },
  moodQ: { fontSize: 12, color: colors.textMuted, fontFamily: fonts.body, marginBottom: 8 },
  moodRow: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  moodBtn: { flex: 1, aspectRatio: 1, maxWidth: 46, borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  moodBtnOn: { backgroundColor: 'rgba(255,141,160,0.22)', borderColor: 'rgba(255,141,160,0.7)', transform: [{ scale: 1.06 }] },
  moodPartner: { marginTop: 9, fontSize: 12, color: colors.textMuted, fontFamily: fonts.body },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowEmoji: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surface2 },
  rowThumb: { width: 46, height: 46, borderRadius: 12 },
  rowMid: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 14, fontFamily: fonts.bodySemi, color: colors.text },
  rowSub: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontFamily: fonts.body },
  tag: { fontSize: 10, fontFamily: fonts.bodyBold, letterSpacing: 0.4, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 7, overflow: 'hidden' },
  tagEv: { backgroundColor: 'rgba(255,141,160,0.18)', color: '#ff8da0' },
  tagPh: { backgroundColor: 'rgba(94,198,198,0.18)', color: '#7ad6d6' },
  tagPl: { backgroundColor: 'rgba(84,223,134,0.16)', color: '#6fe29a' },
  check: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  emptyDay: { textAlign: 'center', paddingVertical: 18, color: colors.textMuted, fontSize: 13, fontFamily: fonts.body },
  memories: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: 'rgba(255,255,255,0.1)' },
  memTitle: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.textMuted, letterSpacing: 0.4, marginBottom: 6 },

  lb: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  lbClose: { position: 'absolute', right: 18, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 21, width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  lbHint: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 12, fontFamily: fonts.body },

  dateInput: { width: '100%', minHeight: 46, backgroundColor: '#1A1916', borderWidth: 0.5, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, justifyContent: 'center' },
  dateText: { fontSize: 15, color: colors.text, fontFamily: fonts.body },
  emojiSelect: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  emojiOption: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: colors.border, borderRadius: 10 },
  emojiSelected: { borderColor: colors.rose, backgroundColor: 'rgba(168,40,60,0.06)' },
  photoPreview: { width: '100%', height: 180, borderRadius: 12, marginTop: 10 },
});
