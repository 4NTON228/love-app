// Порт TimeCapsule.jsx — письма партнёру, которые откроются в особый момент (.tc-dark).
import { BlurView } from 'expo-blur';
import { type ComponentType, useCallback, useEffect, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { cubicSpring, Enter, Grad, HEAD_BOLD, Orb, Ring, usePingPong, V } from '@/components/advisor/common';
import { DateTimeInput } from '@/components/DateTimeInput';
import { supabase } from '@/lib/supabase';
import { fonts } from '@/theme';

const MUTED = V.muted;
const PURPLE = '#7B3FBE';

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function TrashIcon({ size = 16, color = MUTED }: { size?: number; color?: string }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
    </Svg>
  );
}

type IconProps = { color: string };
const CalIcon = ({ color }: IconProps) => (
  <Svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="4" width="18" height="17" rx="2" /><Line x1="8" y1="2" x2="8" y2="6" /><Line x1="16" y1="2" x2="16" y2="6" /><Line x1="3" y1="10" x2="21" y2="10" />
  </Svg>
);
const DaysIcon = ({ color }: IconProps) => (
  <Svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
    <Circle cx="12" cy="12" r="9" /><Line x1="12" y1="12" x2="12" y2="7.5" strokeWidth={2} /><Line x1="12" y1="12" x2="15.5" y2="14" strokeWidth={1.5} />
  </Svg>
);
const FightIcon = ({ color }: IconProps) => (
  <Svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />
  </Svg>
);

type TriggerId = 'date' | 'days' | 'fight';
const TRIGGERS: { id: TriggerId; label: string; desc: string; Icon: ComponentType<IconProps> }[] = [
  { id: 'date', label: 'Дата', desc: 'Конкретная дата', Icon: CalIcon },
  { id: 'days', label: 'Дни', desc: 'Через N дней', Icon: DaysIcon },
  { id: 'fight', label: 'Ссора', desc: 'Если замолчим', Icon: FightIcon },
];

const STATUS_META = {
  sent: { label: 'Доставлено', color: '#4CAF50', bg: 'rgba(76,175,80,0.1)' },
  pending: { label: 'Ожидает', color: '#C8A84B', bg: 'rgba(200,168,75,0.1)' },
  fight: { label: 'Ждёт ссоры', color: '#C8334A', bg: 'rgba(200,51,74,0.1)' },
};

type Capsule = {
  id: string; message: string; trigger_type: TriggerId; trigger_date: string | null; trigger_days: number | null;
  is_sent: boolean | null; created_at: string;
};

function capsuleStatus(cap: Capsule, now: number) {
  if (cap.is_sent) return { text: 'Доставлено', ...STATUS_META.sent };
  if (cap.trigger_type === 'fight') return { text: 'Ждёт ссоры', ...STATUS_META.fight };
  if (cap.trigger_type === 'date' && cap.trigger_date) return { text: `Отправится ${formatDate(cap.trigger_date)}`, ...STATUS_META.pending };
  if (cap.trigger_type === 'days' && cap.trigger_days) {
    const sendAt = new Date(cap.created_at);
    sendAt.setDate(sendAt.getDate() + cap.trigger_days);
    const daysLeft = Math.max(0, Math.ceil((sendAt.getTime() - now) / 86400000));
    return { text: daysLeft > 0 ? `Осталось ${daysLeft} дн` : 'Скоро', ...STATUS_META.pending };
  }
  return { text: 'Ожидает', ...STATUS_META.pending };
}

const toIsoFromLocal = (v: string) => {
  const [d, t = '00:00'] = v.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  return new Date(y, m - 1, day, hh, mm).toISOString();
};

export function TimeCapsule({ uid, partnerId }: { uid: string; partnerId: string | null | undefined }) {
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create'>('list');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerId>('date');
  const [triggerDate, setTriggerDate] = useState('');
  const [triggerDays, setTriggerDays] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const float1 = usePingPong(7000);
  const float2 = usePingPong(9000);

  const loadCapsules = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    const { data } = await supabase.from('time_capsules').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    setCapsules((data as Capsule[]) ?? []);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    (async () => { await loadCapsules(); })();
  }, [loadCapsules]);

  const daysInvalid = !triggerDays || +triggerDays < 1;

  async function saveCapsule() {
    if (!message.trim() || !uid || !partnerId) return;
    if (triggerType === 'date' && !triggerDate) return;
    if (triggerType === 'days' && daysInvalid) return;
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase.from('time_capsules').insert({
      user_id: uid, partner_id: partnerId, message: message.trim(),
      trigger_type: triggerType,
      trigger_date: triggerType === 'date' ? toIsoFromLocal(triggerDate) : null,
      trigger_days: triggerType === 'days' ? +triggerDays : null,
    });
    if (!error) {
      setMessage(''); setTriggerDate(''); setTriggerDays(''); setView('list'); await loadCapsules();
    } else {
      setSaveError('Не удалось сохранить капсулу. Попробуйте ещё раз.');
    }
    setSaving(false);
  }

  async function deleteCapsule(id: string) {
    await supabase.from('time_capsules').delete().eq('id', id).eq('user_id', uid);
    setDeleteId(null);
    setCapsules((prev) => prev.filter((c) => c.id !== id));
  }

  const orbStyle = (v: Animated.Value, dy: number, sc: number) => ({
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, sc] }) },
    ],
  });

  const n = capsules.length;
  const saveDisabled = saving || !message.trim() || !partnerId || (triggerType === 'date' && !triggerDate) || (triggerType === 'days' && daysInvalid);

  return (
    <View>
      {/* Hero */}
      <Grad angle={160} stops={[['#3D1A6B', 0], ['#1E0A38', 0.5], ['#080212', 1]]} style={s.hero}>
        <Animated.View style={[{ position: 'absolute', top: -40, right: -40 }, orbStyle(float1, -16, 1.03)]}>
          <Orb size={200} color="rgba(123,63,190,0.45)" style={{ position: 'relative' }} />
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', bottom: -20, left: -50 }, orbStyle(float2, 12, 0.97)]}>
          <Orb size={150} color="rgba(61,26,107,0.5)" style={{ position: 'relative' }} />
        </Animated.View>
        <View style={s.tag}>
          <Svg viewBox="0 0 24 24" width={10} height={10} fill="rgba(255,255,255,0.7)"><Circle cx="12" cy="12" r="10" /></Svg>
          <Text style={s.tagText}>КАПСУЛА ВРЕМЕНИ</Text>
        </View>
        <Text style={s.heroTitle}>Письма{'\n'}из прошлого</Text>
        <Text style={s.heroSub}>Напиши партнёру сообщение, которое откроется в особый момент</Text>
        {n > 0 ? (
          <Enter duration={500} delay={200} scale={0.7} easing={cubicSpring} style={{ alignSelf: 'flex-start' }}>
            <View style={s.heroCount}><Text style={s.heroCountText}>{n} {n === 1 ? 'капсула' : n < 5 ? 'капсулы' : 'капсул'}</Text></View>
          </Enter>
        ) : null}
      </Grad>

      {view === 'create' ? (
        <Enter duration={350} dx={32} style={s.form}>
          {!partnerId ? (
            <View style={s.noPartner}>
              <View style={s.noPartnerIcon}>
                <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={PURPLE} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><Circle cx="12" cy="7" r="4" />
                </Svg>
              </View>
              <Text style={s.noPartnerText}>
                <Text style={s.noPartnerStrong}>Партнёр не подключён{'\n'}</Text>
                Добавьте партнёра в настройках профиля, чтобы создать капсулу.
              </Text>
            </View>
          ) : null}

          <View>
            <Text style={s.sectionLabel}>ТВОЁ СООБЩЕНИЕ</Text>
            <TextInput
              value={message} onChangeText={setMessage} maxLength={1000} multiline
              placeholder="Напиши то, что хочется сказать в особый момент..." placeholderTextColor={MUTED} selectionColor={PURPLE}
              onFocus={() => setFocus('msg')} onBlur={() => setFocus(null)}
              style={[s.textarea, focus === 'msg' && { borderColor: PURPLE }]}
            />
            <Text style={s.counter}>{message.length}/1000</Text>
          </View>

          <View>
            <Text style={s.sectionLabel}>КОГДА ОТПРАВИТЬ</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {TRIGGERS.map((t) => {
                const active = triggerType === t.id;
                return (
                  <Pressable key={t.id} onPress={() => setTriggerType(t.id)} accessibilityRole="radio" accessibilityState={{ selected: active }}
                    style={[s.triggerBtn, active && { borderColor: PURPLE, backgroundColor: 'rgba(123,63,190,0.1)' }]}>
                    <t.Icon color={active ? PURPLE : MUTED} />
                    <Text style={[s.triggerLabel, active && { color: PURPLE }]}>{t.label}</Text>
                    <Text style={s.triggerDesc}>{t.desc}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {triggerType === 'date' ? (
            <View>
              <Text style={s.sectionLabel}>ДАТА ОТПРАВКИ</Text>
              <DateTimeInput mode="datetime" value={triggerDate} onChange={setTriggerDate} minimumDate={new Date(now)}
                placeholder="дд.мм.гггг, --:--" style={[s.input, { minHeight: 52 }]} textStyle={s.inputText} placeholderColor={MUTED} />
            </View>
          ) : null}
          {triggerType === 'days' ? (
            <View>
              <Text style={s.sectionLabel}>ЧЕРЕЗ СКОЛЬКО ДНЕЙ</Text>
              <TextInput
                value={triggerDays} onChangeText={(t) => setTriggerDays(t.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="number-pad"
                placeholder="Например: 30" placeholderTextColor={MUTED} selectionColor={PURPLE}
                onFocus={() => setFocus('days')} onBlur={() => setFocus(null)}
                style={[s.input, s.inputText, focus === 'days' && { borderColor: PURPLE }]}
              />
            </View>
          ) : null}
          {triggerType === 'fight' ? (
            <View style={s.fightInfo}>
              <Text style={s.fightText}>Капсула откроется автоматически когда в чате не будет сообщений 8 часов подряд. Идеально для письма-примирения.</Text>
            </View>
          ) : null}

          {saveError ? (
            <View style={s.saveError}>
              <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#C8334A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx="12" cy="12" r="10" /><Line x1="12" y1="8" x2="12" y2="12" /><Line x1="12" y1="16" x2="12.01" y2="16" />
              </Svg>
              <Text style={s.saveErrorText}>{saveError}</Text>
            </View>
          ) : null}

          <Pressable onPress={saveCapsule} disabled={saveDisabled} accessibilityRole="button"
            style={({ pressed }) => [s.saveBtn, saveDisabled && { opacity: 0.45 }, pressed && { transform: [{ scale: 0.97 }] }]}>
            <Grad angle={135} stops={[PURPLE, '#3D1A6B']} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
            <Text style={s.saveText}>{saving ? 'Запечатываю...' : 'Запечатать капсулу'}</Text>
          </Pressable>
          <Pressable onPress={() => { setView('list'); setSaveError(null); }} accessibilityRole="button"
            style={({ pressed }) => [s.cancelBtn, pressed && { backgroundColor: 'rgba(123,63,190,0.05)' }]}>
            <Text style={s.cancelText}>Назад</Text>
          </Pressable>
        </Enter>
      ) : (
        <>
          <Pressable onPress={() => setView('create')} accessibilityRole="button"
            style={({ pressed }) => [s.newBtn, pressed && { transform: [{ scale: 0.97 }] }]}>
            <Grad angle={135} stops={[PURPLE, '#3D1A6B']} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} />
            <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round">
              <Line x1="12" y1="5" x2="12" y2="19" /><Line x1="5" y1="12" x2="19" y2="12" />
            </Svg>
            <Text style={s.newText}>Написать капсулу</Text>
          </Pressable>

          {loading ? (
            <View style={s.loading}>
              <Ring track="rgba(123,63,190,0.15)" color={PURPLE} />
              <Text style={s.loadingText}>Загрузка...</Text>
            </View>
          ) : n === 0 ? (
            <View style={s.empty}>
              <Grad angle={135} stops={['rgba(123,63,190,0.12)', 'rgba(61,26,107,0.06)']} style={s.emptyIcon}>
                <Svg viewBox="0 0 24 24" width={38} height={38} fill="none" stroke={PURPLE} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><Circle cx="12" cy="10" r="3" />
                </Svg>
              </Grad>
              <Text style={s.emptyTitle}>Капсул пока нет</Text>
              <Text style={s.emptyText}>Напиши письмо партнёру — оно откроется{'\n'}в нужный момент.</Text>
            </View>
          ) : (
            <View style={s.list}>
              {capsules.map((cap, i) => {
                const st = capsuleStatus(cap, now);
                const trigger = TRIGGERS.find((t) => t.id === cap.trigger_type);
                return (
                  <Enter key={cap.id} duration={380} delay={i * 55} dy={14}>
                    <View style={[s.card, cap.is_sent && { opacity: 0.55 }]}>
                      <View style={s.cardTop}>
                        <View style={[s.badge, { backgroundColor: st.bg }]}>
                          <Svg viewBox="0 0 8 8" width={7} height={7} fill={st.color}><Circle cx="4" cy="4" r="4" /></Svg>
                          <Text style={[s.badgeText, { color: st.color }]}>{st.text}</Text>
                        </View>
                        {!cap.is_sent ? (
                          <Pressable onPress={() => setDeleteId(cap.id)} accessibilityRole="button" accessibilityLabel="Удалить" style={{ padding: 4 }}>
                            {({ pressed }) => <TrashIcon color={pressed ? '#C8334A' : MUTED} />}
                          </Pressable>
                        ) : null}
                      </View>
                      <Text style={s.cardMsg} numberOfLines={3}>{cap.message}</Text>
                      <View style={s.cardFooter}>
                        {trigger ? <trigger.Icon color={PURPLE} /> : null}
                        <Text style={s.cardFooterText}>{trigger?.desc}</Text>
                      </View>
                    </View>
                  </Enter>
                );
              })}
            </View>
          )}
        </>
      )}

      <Modal visible={!!deleteId} transparent animationType="fade" onRequestClose={() => setDeleteId(null)} statusBarTranslucent>
        <Pressable style={s.overlay} onPress={() => setDeleteId(null)}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,2,6,0.7)' }]} />
          {deleteId ? (
            <Enter duration={250} dy={20} scale={0.9} easing={cubicSpring} style={{ width: '100%', maxWidth: 300 }}>
              <Pressable style={s.confirmBox} onPress={() => {}}>
                <Text style={s.confirmTitle}>Удалить капсулу?</Text>
                <Text style={s.confirmText}>Сообщение будет удалено и не отправится партнёру.</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable style={s.confirmDel} onPress={() => deleteCapsule(deleteId)} accessibilityRole="button">
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: 'white' }}>Удалить</Text>
                  </Pressable>
                  <Pressable style={s.confirmCancel} onPress={() => setDeleteId(null)} accessibilityRole="button">
                    <Text style={{ fontFamily: fonts.body, fontSize: 15, color: MUTED }}>Отмена</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Enter>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { paddingTop: 28, paddingHorizontal: 20, paddingBottom: 32 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 99, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 14,
  },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.8, color: 'rgba(255,255,255,0.7)' },
  heroTitle: { fontFamily: HEAD_BOLD, fontSize: 26, color: '#FFFFFF', lineHeight: 31.2, marginBottom: 8 },
  heroSub: { fontFamily: fonts.body, fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 21 },
  heroCount: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 14 },
  heroCountText: { fontFamily: fonts.bodySemi, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  noPartner: {
    paddingVertical: 18, paddingHorizontal: 20, borderRadius: 18, backgroundColor: 'rgba(123,63,190,0.08)',
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(123,63,190,0.3)', flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  noPartnerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(123,63,190,0.15)', alignItems: 'center', justifyContent: 'center' },
  noPartnerText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: MUTED, lineHeight: 21 },
  noPartnerStrong: { fontFamily: fonts.bodyBold, color: '#F5E6EB', fontSize: 15 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, margin: 16, padding: 15, borderRadius: 18,
    shadowColor: '#3D1A6B', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  newText: { fontFamily: fonts.bodyBold, fontSize: 15, color: 'white' },
  list: { paddingTop: 4, paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  card: {
    borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(123,63,190,0.2)', backgroundColor: '#0E0518',
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  cardTop: { paddingTop: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, paddingVertical: 4, paddingHorizontal: 10 },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  cardMsg: { paddingVertical: 10, paddingHorizontal: 16, fontFamily: fonts.body, fontSize: 15, color: '#F5E6EB', lineHeight: 23.25 },
  cardFooter: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardFooterText: { fontFamily: fonts.body, fontSize: 12, color: MUTED },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: '#F5E6EB', marginBottom: 8 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: MUTED, lineHeight: 22.4, textAlign: 'center' },
  form: { paddingVertical: 20, paddingHorizontal: 16, gap: 20 },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.8, color: MUTED, marginBottom: 8 },
  textarea: {
    minHeight: 140, backgroundColor: '#1A0820', borderWidth: 2, borderColor: 'transparent', borderRadius: 18, padding: 16,
    fontFamily: fonts.body, fontSize: 16, color: '#F5E6EB', lineHeight: 25.6, textAlignVertical: 'top',
  },
  counter: { textAlign: 'right', fontFamily: fonts.body, fontSize: 11, color: MUTED, marginTop: 4 },
  triggerBtn: {
    flex: 1, alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 16,
    borderWidth: 2, borderColor: 'rgba(123,63,190,0.2)', backgroundColor: '#1A0820',
  },
  triggerLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: MUTED },
  triggerDesc: { fontFamily: fonts.body, fontSize: 10, color: MUTED, textAlign: 'center' },
  input: {
    paddingVertical: 14, paddingHorizontal: 16, borderWidth: 2, borderColor: 'rgba(123,63,190,0.2)', borderRadius: 16,
    backgroundColor: '#1A0820',
  },
  inputText: { fontFamily: fonts.body, fontSize: 15, color: '#F5E6EB' },
  fightInfo: { backgroundColor: 'rgba(123,63,190,0.07)', borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(123,63,190,0.3)', borderRadius: 16, padding: 16 },
  fightText: { fontFamily: fonts.body, fontSize: 14, color: MUTED, lineHeight: 22.4 },
  saveError: {
    backgroundColor: 'rgba(200,51,74,0.08)', borderWidth: 1, borderColor: 'rgba(200,51,74,0.25)', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  saveErrorText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: '#C8334A', lineHeight: 19.6 },
  saveBtn: {
    padding: 15, borderRadius: 16, alignItems: 'center',
    shadowColor: '#3D1A6B', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  saveText: { fontFamily: fonts.bodyBold, fontSize: 16, color: 'white', letterSpacing: 0.2 },
  cancelBtn: { padding: 14, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(123,63,190,0.2)', alignItems: 'center' },
  cancelText: { fontFamily: fonts.bodySemi, fontSize: 15, color: MUTED },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmBox: {
    backgroundColor: '#1A0820', borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 40, shadowOffset: { width: 0, height: 24 }, elevation: 16,
  },
  confirmTitle: { fontFamily: fonts.bodyBold, fontSize: 19, color: '#F5E6EB', marginBottom: 8 },
  confirmText: { fontFamily: fonts.body, fontSize: 14, color: MUTED, marginBottom: 20, lineHeight: 21 },
  confirmDel: { flex: 1, padding: 12, backgroundColor: '#C8334A', borderRadius: 14, alignItems: 'center' },
  confirmCancel: { flex: 1, padding: 12, backgroundColor: '#3D1520', borderRadius: 14, alignItems: 'center' },
  loading: { alignItems: 'center', gap: 14, paddingVertical: 60, paddingHorizontal: 20 },
  loadingText: { fontFamily: fonts.body, fontSize: 14, color: MUTED },
});
