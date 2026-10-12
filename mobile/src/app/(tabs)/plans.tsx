// Порт src/components/Plans.jsx — «Наши планы».
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { Radials } from '@/components/Backgrounds';
import { useLoop } from '@/components/anim';
import { FormGroup, FormInput, FormSubmit, WebModal } from '@/components/webui';
import { sendPushNotification } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { useMe } from '@/providers/AuthProvider';
import { colors, cssLinear, fonts } from '@/theme';

const IcoTrash = () => <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={colors.textMuted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Polyline points="3 6 5 6 21 6" /><Path d="M19 6l-1 14H6L5 6" /><Path d="M10 11v6M14 11v6" /><Path d="M9 6V4h6v2" /></Svg>;
const IcoCheck = () => <Svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><Polyline points="20 6 9 17 4 12" /></Svg>;
const IcoList = () => (
  <Svg viewBox="0 0 60 60" width={48} height={48} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="6" y="8" width="48" height="44" rx="6" /><Line x1="18" y1="22" x2="46" y2="22" /><Line x1="18" y1="32" x2="46" y2="32" /><Line x1="18" y1="42" x2="36" y2="42" />
    <Circle cx="12" cy="22" r="2" fill="rgba(255,255,255,0.3)" stroke="none" /><Circle cx="12" cy="32" r="2" fill="rgba(255,255,255,0.3)" stroke="none" /><Circle cx="12" cy="42" r="2" fill="rgba(255,255,255,0.3)" stroke="none" />
  </Svg>
);
const IcoPlus = () => <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round"><Line x1="12" y1="5" x2="12" y2="19" /><Line x1="5" y1="12" x2="19" y2="12" /></Svg>;
const HEART = 'M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z';

function LoadingHeart() {
  const v = useLoop(1200, 0, Easing.inOut(Easing.ease));
  return (
    <View>
      <Svg viewBox="0 0 60 56" width={48} height={44} fill="none"><Path d={HEART} fill="rgba(200,51,74,0.4)" /></Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 1] }) }] }]}>
        <Svg viewBox="0 0 60 56" width={48} height={44} fill="none"><Path d={HEART} fill="none" stroke="rgba(200,51,74,0.6)" strokeWidth={2} /></Svg>
      </Animated.View>
    </View>
  );
}

const CATEGORIES = [
  { value: 'dream', label: 'Мечта', color: '#8B1A2C', bg: 'rgba(139,26,44,0.12)' },
  { value: 'travel', label: 'Путешествие', color: '#4a8fe7', bg: 'rgba(74,143,231,0.12)' },
  { value: 'date', label: 'Свидание', color: '#e8a225', bg: 'rgba(232,162,37,0.12)' },
  { value: 'other', label: 'Другое', color: '#6b6b6b', bg: 'rgba(107,107,107,0.1)' },
];
const getCat = (v: string | null) => CATEGORIES.find((c) => c.value === v) || CATEGORIES[0];

const CONFETTI_ITEMS = [
  { x: 8, shape: 'heart', s: 14, c: '#C8334A', dur: 1.0, del: 0.00 }, { x: 18, shape: 'star', s: 10, c: '#f7a8c4', dur: 0.9, del: 0.05 },
  { x: 28, shape: 'diamond', s: 12, c: '#8B1A2C', dur: 1.1, del: 0.10 }, { x: 38, shape: 'heart', s: 10, c: '#ff8fab', dur: 0.8, del: 0.15 },
  { x: 48, shape: 'star', s: 14, c: '#ffb6d9', dur: 1.2, del: 0.00 }, { x: 58, shape: 'diamond', s: 9, c: '#C8334A', dur: 0.9, del: 0.08 },
  { x: 68, shape: 'heart', s: 12, c: '#8B1A2C', dur: 1.0, del: 0.12 }, { x: 78, shape: 'star', s: 11, c: '#f7a8c4', dur: 0.85, del: 0.04 },
  { x: 88, shape: 'diamond', s: 13, c: '#8B1A2C', dur: 1.1, del: 0.18 }, { x: 13, shape: 'star', s: 9, c: '#ff8fab', dur: 0.95, del: 0.22 },
  { x: 23, shape: 'heart', s: 11, c: '#ffb6d9', dur: 1.05, del: 0.07 }, { x: 33, shape: 'diamond', s: 8, c: '#C8334A', dur: 0.9, del: 0.13 },
  { x: 43, shape: 'star', s: 13, c: '#8B1A2C', dur: 1.2, del: 0.03 }, { x: 53, shape: 'heart', s: 10, c: '#f7a8c4', dur: 0.85, del: 0.20 },
  { x: 63, shape: 'diamond', s: 12, c: '#8B1A2C', dur: 1.0, del: 0.09 }, { x: 73, shape: 'star', s: 10, c: '#ff8fab', dur: 0.95, del: 0.16 },
  { x: 83, shape: 'heart', s: 14, c: '#ffb6d9', dur: 1.1, del: 0.01 }, { x: 93, shape: 'diamond', s: 9, c: '#C8334A', dur: 0.9, del: 0.24 },
];
const STAR_PATH = 'M10 0L11.8 7.2L19 10L11.8 12.8L10 20L8.2 12.8L1 10L8.2 7.2Z';
const HEART_PATH_S = 'M10 16.5C10 16.5 1.5 10 1.5 4.5C1.5 2.2 3.4 0.5 5.8 0.5C7.3 0.5 8.6 1.3 10 2.8C11.4 1.3 12.7 0.5 14.2 0.5C16.6 0.5 18.5 2.2 18.5 4.5C18.5 10 10 16.5 10 16.5Z';

function ConfettiShape({ shape, size, color }: { shape: string; size: number; color: string }) {
  if (shape === 'heart') return <Svg viewBox="0 0 20 18" width={size} height={size * 0.9} fill={color}><Path d={HEART_PATH_S} /></Svg>;
  if (shape === 'star') return <Svg viewBox="0 0 20 20" width={size} height={size} fill={color}><Path d={STAR_PATH} /></Svg>;
  return <Svg viewBox="0 0 12 16" width={size * 0.7} height={size} fill={color}><Path d="M6 0 L12 6 L6 16 L0 6 Z" /></Svg>;
}

function FallingPiece({ it, h }: { it: (typeof CONFETTI_ITEMS)[number]; h: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: it.dur * 1000, delay: it.del * 1000, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(); }, [v, it]);
  return (
    <Animated.View style={{
      position: 'absolute', left: `${it.x}%`, top: 0,
      opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
      transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-10, 1.1 * h] }) }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] }) }],
    }}>
      <ConfettiShape shape={it.shape} size={it.s} color={it.c} />
    </Animated.View>
  );
}

function Confetti({ active }: { active: boolean }) {
  const { height } = useWindowDimensions();
  if (!active) return null;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
        {CONFETTI_ITEMS.map((it, i) => <FallingPiece key={i} it={it} h={height} />)}
      </View>
    </Modal>
  );
}

/* shimmer по полосе прогресса */
function Shimmer({ w }: { w: number }) {
  const v = useLoop(2000, 0, Easing.inOut(Easing.ease));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { width: w, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-w, 2 * w] }) }] }]}>
      <LinearGradient colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

function PlanIn({ delay, children }: { delay: number; children: React.ReactNode }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 400, delay, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(); }, [v, delay]);
  return <Animated.View style={{ opacity: v, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] }}>{children}</Animated.View>;
}

function CheckBox({ checked, onPress }: { checked: boolean; onPress: () => void }) {
  const [s] = useState(() => new Animated.Value(checked ? 1.1 : 1));
  useEffect(() => {
    if (checked) {
      s.setValue(0.8);
      Animated.sequence([
        Animated.timing(s, { toValue: 1.25, duration: 180, easing: Easing.bezier(0.34, 1.56, 0.64, 1), useNativeDriver: true }),
        Animated.timing(s, { toValue: 1.1, duration: 120, useNativeDriver: true }),
      ]).start();
    } else s.setValue(1);
  }, [checked, s]);
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }} hitSlop={8}>
      <Animated.View style={[st.cb, checked && { borderColor: 'transparent' }, { transform: [{ scale: s }] }]}>
        {checked ? <LinearGradient {...cssLinear(135, ['#C8334A', '#8B1A2C'])} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} /> : null}
        {checked ? <IcoCheck /> : null}
      </Animated.View>
    </Pressable>
  );
}

type PlanRow = { id: string; user_id: string; title: string; category: string | null; completed: boolean | null; completed_at: string | null; created_at: string };

export default function Plans() {
  const { uid, profile } = useMe();
  const pid = profile.partner_id;
  const insets = useSafeAreaInsets();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [filterCat, setFilterCat] = useState('all');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('dream');
  const [barW, setBarW] = useState(0);
  const [prog] = useState(() => new Animated.Value(0));

  const loadPlans = useCallback(async () => {
    const ids = [uid, pid].filter(Boolean) as string[];
    const q = supabase.from('plans').select('*').order('created_at', { ascending: false });
    const { data } = ids.length === 1 ? await q.eq('user_id', ids[0]) : await q.in('user_id', ids);
    setPlans((data || []) as PlanRow[]);
    setLoading(false);
  }, [uid, pid]);

  useEffect(() => { (async () => { await loadPlans(); })(); }, [loadPlans]);

  async function handleSubmit() {
    if (!title) return;
    setSaving(true);
    const { error } = await supabase.from('plans').insert({ user_id: uid, title, category });
    if (!error) {
      const t = title;
      setTitle(''); setCategory('dream'); setShowModal(false); loadPlans();
      if (pid) sendPushNotification(`🗺️ ${profile.name || 'Партнёр'} · Новый план`, `${t}`, pid).catch(() => {});
    }
    setSaving(false);
  }

  async function toggleComplete(plan: PlanRow) {
    const newVal = !plan.completed;
    const completed_at = newVal ? new Date().toISOString() : null;
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, completed: newVal, completed_at } : p)));
    if (newVal) { setConfetti(true); setTimeout(() => setConfetti(false), 2000); }
    const { error } = await supabase.from('plans').update({ completed: newVal, completed_at }).eq('id', plan.id);
    if (error) setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, completed: !newVal } : p)));
  }

  function deletePlan(id: string) {
    Alert.alert('Удалить этот план?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'OK', onPress: async () => { await supabase.from('plans').delete().eq('id', id); loadPlans(); } },
    ]);
  }

  const visiblePlans = filterCat === 'all' ? plans : plans.filter((p) => p.category === filterCat);
  const completedCount = plans.filter((p) => p.completed).length;
  const totalCount = plans.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  useEffect(() => {
    Animated.timing(prog, { toValue: progress, duration: 800, easing: Easing.bezier(0.34, 1.56, 0.64, 1), useNativeDriver: false }).start();
  }, [progress, prog]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Confetti active={confetti} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + 92 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={st.header}>
          <LinearGradient {...cssLinear(175, [['#0D0305', 0], ['#220810', 0.38], ['#46101F', 0.68], ['#2E0C18', 1]])} style={StyleSheet.absoluteFill} />
          <Radials items={[{ x: 50, y: 0, color: 'rgba(200,51,74,0.38)', stop: 65 }]} />
          <View style={{ paddingTop: Math.max(60, insets.top + 16), paddingHorizontal: 20, paddingBottom: 28 }}>
            <Text style={st.hTitle} accessibilityRole="header">Наши планы</Text>
            {totalCount > 0 ? (
              <>
                <View style={st.progBg} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
                  <Animated.View style={[st.progFill, { width: barW ? prog.interpolate({ inputRange: [0, 100], outputRange: [0, barW], extrapolate: 'clamp' }) : 0 }]}>
                    <LinearGradient {...cssLinear(90, ['#2a1620', '#160a10'])} style={StyleSheet.absoluteFill} />
                    <Shimmer w={barW * (progress / 100)} />
                  </Animated.View>
                </View>
                <Text style={st.progLabel}>{completedCount} из {totalCount} выполнено{completedCount === totalCount && totalCount > 0 ? ' — готово!' : ''}</Text>
              </>
            ) : null}
            <Pressable onPress={() => setShowModal(true)} accessibilityRole="button" style={st.addBtn}>
              <IcoPlus /><Text style={st.addBtnText}>Добавить план</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filter}>
          <Pressable onPress={() => setFilterCat('all')} accessibilityState={{ selected: filterCat === 'all' }} style={[st.filterBtn, filterCat === 'all' && st.filterBtnActive]}>
            <Text style={[st.filterText, filterCat === 'all' && { color: colors.rose }]}>Все ({plans.length})</Text>
          </Pressable>
          {CATEGORIES.map((c) => {
            const count = plans.filter((p) => p.category === c.value).length;
            if (!count) return null;
            return (
              <Pressable key={c.value} onPress={() => setFilterCat(c.value)} accessibilityState={{ selected: filterCat === c.value }} style={[st.filterBtn, filterCat === c.value && st.filterBtnActive]}>
                <Text style={[st.filterText, filterCat === c.value && { color: colors.rose }]}>{c.label} ({count})</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={st.empty}><LoadingHeart /></View>
        ) : visiblePlans.length === 0 ? (
          <View style={st.empty}>
            <IcoList />
            <Text style={st.emptyText}>Пока нет планов.{'\n'}Добавьте ваши мечты и цели!</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 14 }}>
            {visiblePlans.map((plan, i) => {
              const cat = getCat(plan.category);
              return (
                <PlanIn key={plan.id} delay={i * 40}>
                  <View style={[st.item, !!plan.completed && { opacity: 0.6 }]}>
                    <CheckBox checked={!!plan.completed} onPress={() => toggleComplete(plan)} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[st.itemTitle, !!plan.completed && st.striked]}>{plan.title}</Text>
                      <Text style={[st.badge, { backgroundColor: cat.bg, color: cat.color }]}>{cat.label}</Text>
                    </View>
                    {plan.user_id === uid ? (
                      <Pressable onPress={() => deletePlan(plan.id)} accessibilityLabel="Удалить план" style={({ pressed }) => [st.delBtn, pressed && { backgroundColor: 'rgba(200,51,74,0.1)' }]}><IcoTrash /></Pressable>
                    ) : null}
                  </View>
                </PlanIn>
              );
            })}
          </View>
        )}
      </ScrollView>

      <WebModal visible={showModal} onClose={() => setShowModal(false)} title="Новый план">
        <FormGroup label="Что хотите сделать?">
          <FormInput placeholder="Посетить Париж" value={title} onChangeText={setTitle} />
        </FormGroup>
        <FormGroup label="Категория">
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {CATEGORIES.map((c) => (
              <Pressable key={c.value} onPress={() => setCategory(c.value)} accessibilityRole="button" accessibilityState={{ selected: category === c.value }}
                style={[st.catBtn, { borderColor: category === c.value ? c.color : 'transparent', backgroundColor: c.bg }]}>
                <Text style={[st.catText, { color: c.color }]}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
        </FormGroup>
        <FormSubmit label={saving ? 'Сохраняем...' : 'Добавить план'} onPress={handleSubmit} disabled={saving} />
      </WebModal>
    </View>
  );
}

const st = StyleSheet.create({
  header: {
    borderBottomLeftRadius: 36, borderBottomRightRadius: 36, marginBottom: 20, overflow: 'hidden',
    shadowColor: 'rgb(14,3,8)', shadowOpacity: 0.75, shadowRadius: 30, shadowOffset: { width: 0, height: 16 },
  },
  hTitle: { fontFamily: fonts.displayRegular, fontSize: 26, color: 'white', marginBottom: 12, textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  progBg: { width: '100%', height: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 },
  progFill: { height: '100%', borderRadius: 99, overflow: 'hidden' },
  progLabel: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 14 },
  addBtn: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addBtnText: { color: 'white', fontFamily: fonts.bodyBold, fontSize: 14 },

  filter: { gap: 8, paddingHorizontal: 16, marginBottom: 14 },
  filterBtn: { backgroundColor: colors.surface2, borderWidth: 1.5, borderColor: 'transparent', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  filterBtnActive: { borderColor: colors.rose, backgroundColor: 'rgba(200,51,74,0.12)' },
  filterText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textMuted },

  item: {
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: 'rgba(200,51,74,0.18)', borderRadius: 22, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingRight: 14, paddingLeft: 12,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  cb: { width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, borderColor: colors.rose, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  itemTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: '#F5E8EA', marginBottom: 3 },
  striked: { textDecorationLine: 'line-through', color: colors.textMuted },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingVertical: 2, paddingHorizontal: 8, fontSize: 11, fontFamily: fonts.bodySemi, overflow: 'hidden' },
  delBtn: { padding: 4, borderRadius: 8 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20, gap: 12 },
  emptyText: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 24 },
  catBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, borderWidth: 2 },
  catText: { fontFamily: fonts.bodySemi, fontSize: 13 },
});
