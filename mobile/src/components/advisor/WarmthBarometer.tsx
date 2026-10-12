// Порт WarmthBarometer.jsx — барометр теплоты общения (.wb-dark).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { Enter, Grad, HEAD_BOLD, Orb, Ring, usePingPong, V } from '@/components/advisor/common';
import { calcWarmth, type Msg, type Warmth } from '@/lib/advisorLogic';
import { supabase } from '@/lib/supabase';
import { fonts } from '@/theme';

const MUTED = V.muted;

function warmthLevel(idx: number) {
  if (idx < 0.35) return { label: 'Внимание', color: '#E8556A', colorDark: '#FF6B80' };
  if (idx < 0.65) return { label: 'Нейтрально', color: '#C8A84B', colorDark: '#FFD166' };
  return { label: 'Тепло', color: '#4CAF50', colorDark: '#66BB6A' };
}

function fmtTime(sec: number) {
  if (sec < 60) return `${sec}с`;
  if (sec < 3600) return `${Math.round(sec / 60)}мин`;
  return `${Math.round(sec / 3600)}ч`;
}

const SnowflakeIcon = () => (
  <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="#FF6B80" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="12" y1="2" x2="12" y2="22" /><Line x1="2" y1="12" x2="22" y2="12" />
    <Line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /><Line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
    <Polyline points="12 6 9 9 12 6 15 9" /><Polyline points="18 12 15 9 18 12 15 15" />
    <Polyline points="12 18 9 15 12 18 15 15" /><Polyline points="6 12 9 15 6 12 9 9" />
  </Svg>
);
const CloudSunIcon = () => (
  <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="#FFD166" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="9" cy="13" r="4" /><Path d="M13 13a4 4 0 10-4-4" /><Path d="M17.5 13H18a3 3 0 000-6 3 3 0 00-5.5-1.5" />
    <Line x1="19" y1="4" x2="19.5" y2="3.5" /><Line x1="21" y1="7" x2="22" y2="7" /><Line x1="19" y1="10" x2="19.5" y2="10.5" />
  </Svg>
);
const FlameIcon = () => (
  <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="#66BB6A" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M8.5 14.5A4.5 4.5 0 0012 19a4.5 4.5 0 004.5-4.5c0-2-1-3.5-2.5-5C13 11 12 9 12 7c-1 2-3.5 4-3.5 7.5z" />
    <Path d="M12 7c0-1.5-.5-3-1.5-4C9 5 8 7 8 9.5A4.5 4.5 0 0012 14" />
  </Svg>
);
const WarningTriangleIcon = () => (
  <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#FF6B80" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <Line x1="12" y1="9" x2="12" y2="13" /><Line x1="12" y1="17" x2="12.01" y2="17" />
  </Svg>
);
const CheckCircleIcon = () => (
  <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#66BB6A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" /><Polyline points="9 12 11 14 15 10" />
  </Svg>
);

function LevelIcon({ idx }: { idx: number }) {
  if (idx < 0.35) return <SnowflakeIcon />;
  if (idx < 0.65) return <CloudSunIcon />;
  return <FlameIcon />;
}

/** Полукруглая шкала: центр внизу, дуга вверх */
function BigGauge({ index }: { index: number }) {
  const W = 240, H = 130, CX = 120, CY = 124, R = 96;
  const pt = (t: number) => {
    const rad = ((180 + t * 180) * Math.PI) / 180;
    return [CX + R * Math.cos(rad), CY + R * Math.sin(rad)];
  };
  const seg = (t1: number, t2: number) => {
    const [x1, y1] = pt(t1);
    const [x2, y2] = pt(t2);
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };
  const level = warmthLevel(index);
  const [nx, ny] = pt(index);
  return (
    <Enter duration={600} delay={300} scale={0.92}>
      <Svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
        <Path d={seg(0, 1)} fill="none" stroke="rgba(200,51,74,0.08)" strokeWidth={16} strokeLinecap="round" />
        <Path d={seg(0, 0.35)} fill="none" stroke="#E8556A" strokeWidth={16} strokeLinecap="butt" opacity={0.3} />
        <Path d={seg(0.35, 0.65)} fill="none" stroke="#C8A84B" strokeWidth={16} strokeLinecap="butt" opacity={0.3} />
        <Path d={seg(0.65, 1)} fill="none" stroke="#4CAF50" strokeWidth={16} strokeLinecap="butt" opacity={0.3} />
        {index > 0 ? <Path d={seg(0, index)} fill="none" stroke={level.color} strokeWidth={16} strokeLinecap="round" opacity={0.9} /> : null}
        <Line x1={CX} y1={CY} x2={(nx + CX * 0.08).toFixed(1)} y2={(ny + CY * 0.08).toFixed(1)} stroke={level.color} strokeWidth={3} strokeLinecap="round" />
        <Circle cx={CX} cy={CY} r="7" fill={level.color} opacity={0.9} />
        <Circle cx={CX} cy={CY} r="3" fill="white" />
      </Svg>
    </Enter>
  );
}

function Stat({ value, pct, label, color, delay }: { value: string | number; pct: number; label: string; color: string; delay: number }) {
  return (
    <Enter duration={450} delay={delay} dy={16} style={{ width: '48.5%' }}>
      <View style={s.stat}>
        <Text style={s.statVal}>{value}</Text>
        <View style={s.barWrap}><View style={{ height: '100%', borderRadius: 99, width: `${Math.max(0, Math.min(pct, 100))}%`, backgroundColor: color }} /></View>
        <Text style={s.statLabel}>{label}</Text>
      </View>
    </Enter>
  );
}

export function WarmthBarometer({ uid, partnerId }: { uid: string; partnerId: string | null | undefined }) {
  const [warmth, setWarmth] = useState<Warmth>({ index: 0.5, details: {} });
  const [prev, setPrev] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const prevRef = useRef<number | null>(null);
  const float1 = usePingPong(6000);
  const float2 = usePingPong(8000);

  const compute = useCallback(async () => {
    if (!uid || !partnerId) { setLoading(false); return; }
    const today = new Date().toISOString().slice(0, 10);
    const { data: metric } = await supabase.from('warmth_metrics').select('*').eq('user_id', uid).eq('date', today).maybeSingle();

    if (metric) {
      if (prevRef.current !== null && prevRef.current !== metric.warmth_index) setPrev(prevRef.current);
      prevRef.current = metric.warmth_index;
      setWarmth({ index: metric.warmth_index, details: { avgLength: metric.avg_length, emojiDens: metric.emoji_density, weRatio: metric.we_ratio, avgRT: metric.avg_response_time } });
      setLoading(false); return;
    }

    const { data: msgs } = await supabase.from('messages').select('user_id, text, created_at')
      .or(`user_id.eq.${uid},user_id.eq.${partnerId}`)
      .order('created_at', { ascending: true }).limit(50);
    if (msgs && msgs.length >= 3) setWarmth(calcWarmth(msgs as Msg[]));
    setLoading(false);
  }, [uid, partnerId]);

  useEffect(() => {
    (async () => { await compute(); })();
  }, [compute]);

  useEffect(() => {
    if (!uid || !partnerId) return;
    const ch = supabase.channel('warmth-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => setTimeout(compute, 500))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, partnerId, compute]);

  const level = warmthLevel(warmth.index);
  const delta = prev !== null ? warmth.index - prev : null;

  const d = warmth.details;
  const hints: { text: string; bad: boolean }[] = [];
  if (d && Object.keys(d).length > 0) {
    if ((d.avgLength ?? 0) < 20) hints.push({ text: 'Ответы стали короче', bad: true });
    if ((d.emojiDens ?? 0) < 0.1) hints.push({ text: 'Эмодзи почти исчезли', bad: true });
    if ((d.avgRT ?? 0) > 1800) hints.push({ text: `Долгие паузы — ${fmtTime(d.avgRT ?? 0)} в среднем`, bad: true });
    if ((d.weRatio ?? 0) < 0.05) hints.push({ text: 'Редко говорите «мы»', bad: true });
    if ((d.avgLength ?? 0) > 80) hints.push({ text: 'Сообщения длинные и содержательные', bad: false });
    if ((d.emojiDens ?? 0) > 0.4) hints.push({ text: 'Много эмодзи — хороший знак', bad: false });
    if ((d.avgRT ?? 0) < 120) hints.push({ text: 'Отвечаете очень быстро', bad: false });
  }
  const pct = Math.round(warmth.index * 100);

  if (loading) {
    return (
      <View style={s.loading}>
        <Ring track="rgba(232,117,58,0.15)" color="#E8753A" />
        <Text style={s.loadingText}>Анализирую переписку...</Text>
      </View>
    );
  }

  if (!partnerId) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyTitle}>Партнёр не подключён</Text>
        <Text style={s.emptyText}>Добавьте партнёра в настройках — тогда появится барометр общения.</Text>
      </View>
    );
  }

  const orbStyle = (v: Animated.Value, dy: number, sc: number) => ({
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, sc] }) },
    ],
  });
  const levelColor = level.colorDark ?? level.color;

  return (
    <View>
      <Grad angle={160} stops={[['#4A2200', 0], ['#2A1200', 0.5], ['#0A0302', 1]]} style={s.hero}>
        <Animated.View style={[{ position: 'absolute', top: -40, right: -40 }, orbStyle(float1, -18, 1.04)]}>
          <Orb size={200} color="rgba(232,117,58,0.4)" style={{ position: 'relative' }} />
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', bottom: 10, left: -60 }, orbStyle(float2, 14, 0.97)]}>
          <Orb size={160} color="rgba(200,51,74,0.25)" style={{ position: 'relative' }} />
        </Animated.View>
        <View style={s.tag}>
          <Svg viewBox="0 0 8 8" width={8} height={8} fill="rgba(255,255,255,0.7)"><Circle cx="4" cy="4" r="4" /></Svg>
          <Text style={s.tagText}>БАРОМЕТР ТЕПЛОТЫ</Text>
        </View>
        <Text style={s.heroLabel}>Сейчас в отношениях</Text>
        <View style={s.levelRow}>
          <LevelIcon idx={warmth.index} />
          <Text style={[s.levelText, { color: levelColor }]}>{level.label}</Text>
        </View>
        <Text style={[s.pct, { color: levelColor }]}>{pct}% тепла</Text>
        {delta !== null ? (
          <Text style={[s.delta, { color: delta >= 0 ? '#66BB6A' : '#FF6B80' }]}>
            {delta >= 0 ? '▲' : '▼'} {Math.round(Math.abs(delta) * 100)}% с прошлого раза
          </Text>
        ) : null}
        <View style={{ alignItems: 'center', marginTop: 8 }}><BigGauge index={warmth.index} /></View>
      </Grad>

      <View style={{ paddingVertical: 20, paddingHorizontal: 16 }}>
        {d && Object.keys(d).length > 0 ? (
          <>
            <Text style={s.sectionLabel}>СТАТИСТИКА</Text>
            <View style={s.grid}>
              <Stat delay={0} value={d.avgLength ?? 0} pct={(d.avgLength ?? 0) / 100 * 100} label="символов в среднем" color={level.color} />
              <Stat delay={50} value={d.avgRT ? fmtTime(d.avgRT) : '—'} pct={100 - (d.avgRT ?? 0) / 3600 * 100} label="среднее время ответа" color={level.color} />
              <Stat delay={100} value={`${Math.round((d.emojiDens ?? 0) * 100)}%`} pct={Math.round((d.emojiDens ?? 0) * 100)} label="сообщений с эмодзи" color={level.color} />
              <Stat delay={150} value={`${Math.round((d.weRatio ?? 0) * 100)}%`} pct={Math.round((d.weRatio ?? 0) * 100)} label="«мы»-слов" color={level.color} />
            </View>
          </>
        ) : null}

        {hints.length > 0 ? (
          <>
            <Text style={s.sectionLabel}>НАБЛЮДЕНИЯ</Text>
            <View style={{ gap: 8 }}>
              {hints.map((h, i) => (
                <Enter key={i} duration={400} delay={i * 70} dy={16}>
                  <View style={[s.hint, { backgroundColor: h.bad ? 'rgba(232,85,106,0.07)' : 'rgba(76,175,80,0.07)' }]}>
                    <View style={{ marginTop: 2 }}>{h.bad ? <WarningTriangleIcon /> : <CheckCircleIcon />}</View>
                    <Text style={s.hintText}>{h.text}</Text>
                  </View>
                </Enter>
              ))}
            </View>
          </>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <View style={{ marginBottom: 12 }}><FlameIcon /></View>
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16, color: V.ink, marginBottom: 6 }}>Всё отлично!</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 14, color: MUTED }}>Общение живое и тёплое</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { paddingTop: 28, paddingHorizontal: 20 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 99, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 16,
  },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.8, color: 'rgba(255,255,255,0.7)' },
  heroLabel: { fontFamily: HEAD_BOLD, fontSize: 17, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  levelText: { fontFamily: HEAD_BOLD, fontSize: 36, lineHeight: 40 },
  pct: { fontFamily: fonts.bodySemi, fontSize: 15, opacity: 0.7, marginBottom: 4 },
  delta: { fontFamily: fonts.bodyBold, fontSize: 13 },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.8, color: MUTED, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 20 },
  stat: {
    borderRadius: 22, padding: 16, backgroundColor: '#150509', borderWidth: 1, borderColor: 'rgba(232,117,58,0.15)',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  statVal: { fontFamily: HEAD_BOLD, fontSize: 26, lineHeight: 28, color: '#F5E6EB', marginBottom: 4 },
  barWrap: { height: 4, backgroundColor: V.border, borderRadius: 99, overflow: 'hidden', marginVertical: 6 },
  statLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: MUTED, letterSpacing: 0.3 },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14 },
  hintText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 19.6, color: '#F5E6EB' },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#F5E6EB', marginBottom: 8 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: MUTED, lineHeight: 21, textAlign: 'center' },
  loading: { alignItems: 'center', gap: 14, paddingVertical: 60, paddingHorizontal: 20 },
  loadingText: { fontFamily: fonts.body, fontSize: 14, color: '#E8753A' },
});
