// Порт src/components/LoveStory.jsx — «Наша история», кино-сторис о паре.
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Animated, Easing, Modal, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CssBackground } from '@/components/Backgrounds';
import { beatScale, useLoop } from '@/components/anim';
import { IClose } from '@/components/icons';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { fonts } from '@/theme';

const SLIDE_MS = 5200;

function plural(n: number, one: string, few: string, many: string) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return few;
  return many;
}

const MOOD_LABEL: Record<string, string> = { '🥰': 'любовь', '😊': 'радость', '😌': 'спокойствие', '🔥': 'страсть', '😕': 'задумчивость', '😢': 'нежность' };

type Data = { photos: { photo_url: string | null; thumb_url: string | null }[]; photoCount: number; eventCount: number; topEvent: { title: string; emoji: string | null } | null; plansDone: number; topMood: string | null };
type Grad = string[];
const G = (...c: string[]): Grad => c;

/** .ls-in: появление снизу с задержкой d0..d3 */
function In({ d, children, style }: { d: 0 | 1 | 2 | 3; children: React.ReactNode; style?: object }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 700, delay: [50, 200, 380, 560][d], easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start();
  }, [v, d]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>{children}</Animated.View>;
}

function Beat({ children, dur = 1300 }: { children: React.ReactNode; dur?: number }) {
  const v = useLoop(dur, 0, Easing.inOut(Easing.ease));
  return <Animated.View style={{ transform: [{ scale: beatScale(v, 1.18) }] }}>{children}</Animated.View>;
}

function Cell({ i, p, size }: { i: number; p: Data['photos'][number]; size: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 500, delay: 300 + i * 80, easing: Easing.bezier(0.34, 1.56, 0.64, 1), useNativeDriver: true }).start();
  }, [v, i]);
  const uri = p.thumb_url || p.photo_url;
  return (
    <Animated.View style={[st.cell, { width: size, height: size, opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={{ color: '#fff' }}>♥</Text>}
    </Animated.View>
  );
}

function Progress({ active, done, onEnd }: { active: boolean; done: boolean; onEnd: () => void }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active) return;
    v.setValue(0);
    const a = Animated.timing(v, { toValue: 1, duration: SLIDE_MS, easing: Easing.linear, useNativeDriver: false });
    a.start(({ finished }) => { if (finished) onEnd(); });
    return () => a.stop();
  }, [active, v, onEnd]);
  return (
    <View style={st.pg}>
      {done ? <View style={[st.pgFill, { width: '100%' }]} /> : null}
      {active ? <Animated.View style={[st.pgFill, { width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} /> : null}
    </View>
  );
}

function Ambient({ h }: { h: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', zIndex: 1 }]}>
      {[8, 22, 40, 58, 74, 90].map((l, i) => <AmbHeart key={i} left={l} delay={i * 1300} size={10 + (i % 3) * 6} h={h} />)}
    </View>
  );
}
function AmbHeart({ left, delay, size, h }: { left: number; delay: number; size: number; h: number }) {
  const v = useLoop(9000, delay, Easing.in(Easing.ease));
  return (
    <Animated.Text style={{
      position: 'absolute', bottom: -30, left: `${left}%`, fontSize: size, color: 'rgba(255,255,255,0.18)',
      opacity: v.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 0] }),
      transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -1.05 * h] }) }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '40deg'] }) }],
    }}>♥</Animated.Text>
  );
}

export function LoveStory({ uid, profile, partnerName, coupleStart, onClose }: {
  uid: string; profile: Profile; partnerName: string; coupleStart: Date | null; onClose: () => void;
}) {
  const pid = profile.partner_id;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [data, setData] = useState<Data | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let on = true;
    (async () => {
      const ids = [uid, pid].filter(Boolean) as string[];
      const scoped = (q: any) => (ids.length <= 1 ? q.eq('user_id', uid) : q.in('user_id', ids));
      const [mo, ev, pl, md] = await Promise.all([
        scoped(supabase.from('moments').select('photo_url,thumb_url,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(9)),
        scoped(supabase.from('calendar_events').select('title,emoji', { count: 'exact' }).order('event_date', { ascending: false }).limit(1)),
        scoped(supabase.from('plans').select('id', { count: 'exact' }).eq('completed', true)),
        scoped(supabase.from('day_moods').select('mood')),
      ]);
      if (!on) return;
      const moodCount: Record<string, number> = {};
      ((md.data || []) as { mood: string | null }[]).forEach((m) => { if (m.mood) moodCount[m.mood] = (moodCount[m.mood] || 0) + 1; });
      let topMood: string | null = null, mx = 0;
      Object.entries(moodCount).forEach(([e, c]) => { if (c > mx) { mx = c; topMood = e; } });
      setData({
        photos: mo.data || [],
        photoCount: mo.count || (mo.data?.length ?? 0),
        eventCount: ev.count || 0,
        topEvent: ev.data?.[0] || null,
        plansDone: pl.count || 0,
        topMood,
      });
    })();
    return () => { on = false; };
  }, [uid, pid]);

  const [now] = useState(() => Date.now());
  const days = useMemo(() => (coupleStart ? Math.max(0, Math.floor((now - coupleStart.getTime()) / 86400000)) : null), [coupleStart, now]);

  const slides = useMemo(() => {
    if (!data) return [] as { key: string; grad: Grad }[];
    const s: { key: string; grad: Grad }[] = [];
    s.push({ key: 'cover', grad: G('#3d1838', '#7b2d49', '#bd5552') });
    if (days != null) s.push({ key: 'days', grad: G('#5e2545', '#a0414f', '#cb6650') });
    if (data.photoCount > 0) s.push({ key: 'photos', grad: G('#2a1230', '#6a2747', '#bd5552') });
    if (data.eventCount > 0) s.push({ key: 'events', grad: G('#3d1838', '#92384e', '#cb6650') });
    if (data.plansDone > 0) s.push({ key: 'plans', grad: G('#2a1230', '#7b2d49', '#d2715f') });
    if (data.topMood) s.push({ key: 'mood', grad: G('#451f3f', '#a0414f', '#e09a6f') });
    s.push({ key: 'finale', grad: G('#3d1838', '#7b2d49', '#cb6650') });
    return s;
  }, [data, days]);

  const last = idx >= slides.length - 1;
  const next = useCallback(() => setIdx((i) => (i < slides.length - 1 ? i + 1 : i)), [slides.length]);
  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);

  // свайп вниз — закрыть
  const [pan] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderRelease: (_, g) => { if (g.dy > 90 && Math.abs(g.dy) > Math.abs(g.dx)) onClose(); },
  }));

  const myName = profile.name || 'Ты';
  const slide = slides[idx];
  const big = Math.min(150, Math.max(86, width * 0.3));
  const num = Math.min(110, Math.max(60, width * 0.2));
  const titleSize = Math.min(64, Math.max(38, width * 0.12));
  const cellSize = (Math.min(360, width - 56) - 16) / 3;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={st.root} {...pan.panHandlers}>
        <CssBackground angle={165} stops={slide ? slide.grad : ['#3d1838', '#7b2d49', '#bd5552']} />
        {!data ? <ActivityIndicator color="#fff" size="large" /> : (
          <>
            <View style={[st.progress, { top: insets.top + 12 }]}>
              {slides.map((_, i) => <Progress key={`${i}-${i === idx ? idx : 'x'}`} active={i === idx && !last} done={i < idx || (i === idx && last)} onEnd={next} />)}
            </View>

            <Pressable onPress={onClose} accessibilityLabel="Закрыть" style={[st.close, { top: insets.top + 22 }]}><IClose /></Pressable>

            <Pressable style={[st.tap, { left: 0 }]} onPress={prev} accessibilityLabel="Назад" />
            <Pressable style={[st.tap, { right: 0 }]} onPress={next} accessibilityLabel="Дальше" />

            <View style={st.stage} key={slide.key} pointerEvents="box-none">
              {slide.key === 'cover' ? (
                <View style={st.center}>
                  <In d={0}><Text style={st.eyebrow}>НАША ИСТОРИЯ</Text></In>
                  <In d={1}><Beat><Text style={st.hearts}>♥</Text></Beat></In>
                  <In d={2}><Text style={[st.title, { fontSize: titleSize, lineHeight: titleSize * 1.02 }]}>{myName} <Text style={st.amp}>&</Text> {partnerName}</Text></In>
                  <In d={3}><Text style={st.sub}>маленький фильм про вас двоих</Text></In>
                </View>
              ) : null}
              {slide.key === 'days' && days != null ? (
                <View style={st.center}>
                  <In d={0}><Text style={st.eyebrow}>ВМЕСТЕ УЖЕ</Text></In>
                  <In d={1}><Text style={[st.big, { fontSize: big, lineHeight: big * 0.95 }]}>{days}</Text></In>
                  <In d={2}><Text style={st.bigsub}>{plural(days, 'день', 'дня', 'дней')}</Text></In>
                  <In d={3}><Text style={st.sub}>и каждый из них — ваш</Text></In>
                </View>
              ) : null}
              {slide.key === 'photos' ? (
                <View style={st.col}>
                  <In d={0}><Text style={st.eyebrow}>ВАШИ КАДРЫ</Text></In>
                  <In d={1}><Text style={[st.num, { fontSize: num, lineHeight: num * 0.95 }]}>{data.photoCount}</Text></In>
                  <In d={2}><Text style={st.numsub}>{plural(data.photoCount, 'момент', 'момента', 'моментов')} сохранено</Text></In>
                  <In d={3} style={st.collage}>
                    {data.photos.slice(0, 6).map((p, i) => <Cell key={i} i={i} p={p} size={cellSize} />)}
                  </In>
                </View>
              ) : null}
              {slide.key === 'events' ? (
                <View style={st.center}>
                  <In d={0}><Text style={st.eyebrow}>ВЫ ПЕРЕЖИЛИ</Text></In>
                  <In d={1}><Text style={[st.big, { fontSize: big, lineHeight: big * 0.95 }]}>{data.eventCount}</Text></In>
                  <In d={2}><Text style={st.bigsub}>{plural(data.eventCount, 'событие', 'события', 'событий')}</Text></In>
                  {data.topEvent ? <In d={3}><View style={st.chip}><Text style={st.chipText} numberOfLines={1}>{data.topEvent.emoji || '✨'} {data.topEvent.title}</Text></View></In> : null}
                </View>
              ) : null}
              {slide.key === 'plans' ? (
                <View style={st.center}>
                  <In d={0}><Text style={st.eyebrow}>МЕЧТЫ СБЫВАЮТСЯ</Text></In>
                  <In d={1}><Text style={[st.big, { fontSize: big, lineHeight: big * 0.95 }]}>{data.plansDone}</Text></In>
                  <In d={2}><Text style={st.bigsub}>{plural(data.plansDone, 'план исполнен', 'плана исполнено', 'планов исполнено')}</Text></In>
                  <In d={3}><Text style={st.sub}>вместе — всё по силам</Text></In>
                </View>
              ) : null}
              {slide.key === 'mood' && data.topMood ? (
                <View style={st.center}>
                  <In d={0}><Text style={st.eyebrow}>ЧАЩЕ ВСЕГО У ВАС</Text></In>
                  <In d={1}><Beat dur={1400}><Text style={{ fontSize: big, lineHeight: big * 1.1 }}>{data.topMood}</Text></Beat></In>
                  <In d={2}><Text style={st.bigsub}>{MOOD_LABEL[data.topMood] || 'тепло'}</Text></In>
                </View>
              ) : null}
              {slide.key === 'finale' ? (
                <View style={st.center}>
                  <In d={0}><Beat><Text style={[st.hearts, { fontSize: 64 }]}>♥</Text></Beat></In>
                  <In d={1}><Text style={st.fin}>И это только{'\n'}начало вашей истории</Text></In>
                  <In d={2}><Text style={st.sub}>{myName} & {partnerName}</Text></In>
                  <In d={3}>
                    <Pressable onPress={onClose} style={st.btn} accessibilityRole="button"><Text style={st.btnText}>Закрыть</Text></Pressable>
                  </In>
                </View>
              ) : null}
            </View>

            <Ambient h={height} />
          </>
        )}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  progress: { position: 'absolute', left: 12, right: 12, zIndex: 10, flexDirection: 'row', gap: 5 },
  pg: { flex: 1, height: 3, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' },
  pgFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#fff', borderRadius: 3 },
  close: { position: 'absolute', right: 16, zIndex: 12, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  tap: { position: 'absolute', top: 0, bottom: 0, width: '30%', zIndex: 8 },
  stage: { zIndex: 6, width: '100%', paddingHorizontal: 28 },
  center: { alignItems: 'center', gap: 8 },
  col: { gap: 8 },
  eyebrow: { fontSize: 13, letterSpacing: 3.6, color: 'rgba(255,255,255,0.7)', fontFamily: fonts.body, textAlign: 'center' },
  title: { fontFamily: fonts.displaySemi, color: '#fff', textAlign: 'center', marginVertical: 6, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 30, textShadowOffset: { width: 0, height: 4 } },
  amp: { color: '#ffd9a8', fontFamily: fonts.displaySemiItalic },
  sub: { fontSize: 15, color: 'rgba(255,255,255,0.82)', fontFamily: fonts.body, textAlign: 'center' },
  hearts: { fontSize: 40, color: '#fff', textShadowColor: 'rgba(255,120,150,0.6)', textShadowRadius: 18, textShadowOffset: { width: 0, height: 6 } },
  big: { fontFamily: fonts.numericBold, color: '#fff', letterSpacing: -4, fontVariant: ['tabular-nums'], textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 40, textShadowOffset: { width: 0, height: 10 } },
  bigsub: { fontFamily: fonts.displayRegular, fontSize: 32, color: '#fff', textAlign: 'center' },
  num: { fontFamily: fonts.numericBold, color: '#fff', letterSpacing: -3 },
  numsub: { fontSize: 15, color: 'rgba(255,255,255,0.82)', marginBottom: 6, fontFamily: fonts.body },
  chip: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', maxWidth: '90%' },
  chipText: { fontSize: 15, fontFamily: fonts.bodySemi, color: '#fff' },
  fin: { fontFamily: fonts.displaySemi, fontSize: 36, lineHeight: 41, color: '#fff', textAlign: 'center', marginVertical: 4 },
  btn: { marginTop: 14, paddingVertical: 13, paddingHorizontal: 28, borderRadius: 999, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 15, shadowOffset: { width: 0, height: 10 } },
  btnText: { color: '#b2364f', fontFamily: fonts.bodyBold, fontSize: 15 },
  collage: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, width: '100%', maxWidth: 360, alignSelf: 'center' },
  cell: { borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
});
