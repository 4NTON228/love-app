// Порт InsightsWidget.jsx — советы ИИ и анализ по данным пары (.insights-dark).
import { LinearGradient } from 'expo-linear-gradient';
import { type ComponentType, useCallback, useEffect, useState } from 'react';
import { Animated, type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path, Polyline } from 'react-native-svg';

import { Enter, Grad, Orb, V } from '@/components/advisor/common';
import { Spin, useLoop } from '@/components/anim';
import { supabase } from '@/lib/supabase';
import { fonts } from '@/theme';

type IconP = { size?: number; color?: string };

function SparkleIcon({ size = 20, color = '#fff' }: IconP) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <Path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2z" />
      <Path d="M19 15l.8 2.7 2.7.8-2.7.8L19 22l-.8-2.7-2.7-.8 2.7-.8L19 15z" opacity={0.6} />
      <Path d="M5 3l.5 1.7 1.7.5-1.7.5L5 7l-.5-1.7L2.8 4.7l1.7-.5L5 3z" opacity={0.5} />
    </Svg>
  );
}
const HeartIcon = ({ size = 16, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <Path d="M12 21C12 21 3 14.5 3 8.5 3 5.4 5.4 3 8.5 3c1.7 0 3.3.8 4.4 2 1.1-1.2 2.7-2 4.4-2C20.6 3 23 5.4 23 8.5c0 6-9 12.5-9 12.5H12z" />
  </Svg>
);
const ChatIcon = ({ size = 16, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </Svg>
);
const MirrorIcon = ({ size = 16, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Ellipse cx="12" cy="10" rx="7" ry="9" /><Path d="M9 21h6M12 19v2" />
  </Svg>
);
const ThermIcon = ({ size = 16, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" />
  </Svg>
);
const RefreshIcon = ({ size = 18, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="23,4 23,10 17,10" /><Path d="M20.5 15a9 9 0 11-2.5-9L23 10" />
  </Svg>
);

type TypeId = 'dialog' | 'mirror' | 'warmth' | 'ai';
const TYPE_META: Record<TypeId, { label: string; Icon: ComponentType<IconP>; color: string; bg: string }> = {
  dialog: { label: 'Диалог', Icon: ChatIcon, color: '#C8334A', bg: 'rgba(200,51,74,0.1)' },
  mirror: { label: 'Зеркало', Icon: MirrorIcon, color: '#7B3FBE', bg: 'rgba(123,63,190,0.1)' },
  warmth: { label: 'Теплота', Icon: ThermIcon, color: '#E8753A', bg: 'rgba(232,117,58,0.1)' },
  ai: { label: 'ИИ-совет', Icon: SparkleIcon, color: '#2B8FD8', bg: 'rgba(43,143,216,0.1)' },
};

// Готовые советы для демонстрации без AI
const PRESET_TIPS: { type: TypeId; title: string; text: string }[] = [
  { type: 'ai', title: 'Маленькие жесты', text: 'Отношения поддерживаются не большими событиями, а мелочами: утреннее сообщение, неожиданная похвала, совместный ритуал. Выберите одну небольшую привычку на эту неделю.' },
  { type: 'ai', title: 'Активное слушание', text: 'Когда партнёр говорит о чём-то важном — уберите телефон. Полное внимание на 5 минут дороже часа разговора вполуха.' },
  { type: 'ai', title: 'Благодарность вслух', text: 'Скажите партнёру за что вы ему/ей благодарны прямо сегодня. Конкретно, не абстрактно — «спасибо, что помог с...» работает лучше чем «ты хороший».' },
  { type: 'mirror', title: 'Синхронность мыслей', text: 'Ответьте на вопрос дня в зеркале — это помогает понять как вы оба смотрите на одно и то же событие. Нередко ответы удивляют.' },
  { type: 'dialog', title: 'Незавершённые темы', text: 'Если в чате оборвался разговор — вернитесь к нему. «Мы так и не договорили про...» — часто лучшее начало для важного разговора.' },
  { type: 'warmth', title: 'Качество VS количество', text: 'Дело не в том сколько сообщений в день — а в том насколько они содержательные. Один вдумчивый ответ лучше десяти «ок».' },
];

type Insight = { id: string; type: TypeId; title: string; text: string; priority: number };

/** .ins-skeleton: полоса-блик бежит по фону */
function Skeleton({ height, opacity = 1 }: { height: number; opacity?: number }) {
  const v = useLoop(1400);
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  return (
    <View onLayout={onLayout} style={[s.skeleton, { height, opacity }]}>
      {w > 0 ? (
        <Animated.View style={[StyleSheet.absoluteFill, { width: w * 2, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, -w] }) }] }]}>
          <LinearGradient colors={[V.blush, 'rgba(200,51,74,0.06)', V.blush, 'rgba(200,51,74,0.06)', V.blush]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
    </View>
  );
}

export function InsightsWidget({ uid, partnerId }: { uid: string; partnerId: string | null | undefined }) {
  const [dataInsights, setDataInsights] = useState<Insight[]>([]);
  const [aiText, setAiText] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [tipIdx, setTipIdx] = useState(() => Math.floor(Math.random() * PRESET_TIPS.length));

  const loadDataInsights = useCallback(async () => {
    if (!uid) { setLoadingData(false); return; }
    setLoadingData(true);
    const insights: Insight[] = [];
    const now = new Date();
    try {
      // 1. Зеркало сегодня
      if (partnerId) {
        const today = now.toISOString().slice(0, 10);
        const { data: mirror } = await supabase
          .from('sync_mirror').select('*')
          .or(`user_id.eq.${uid},partner_id.eq.${uid}`)
          .gte('created_at', `${today}T00:00:00Z`)
          .limit(1).maybeSingle();

        if (mirror) {
          const isOwner = mirror.user_id === uid;
          const myAns = isOwner ? mirror.answer : mirror.partner_answer;
          const theirAns = isOwner ? mirror.partner_answer : mirror.answer;
          if (!myAns) {
            insights.push({ id: 'mirror_unanswered', type: 'mirror', title: 'Вопрос дня ждёт ответа', text: `«${(mirror.question || '').slice(0, 80)}» — ты ещё не ответил(а).`, priority: 2 });
          } else if (myAns && !theirAns) {
            insights.push({ id: 'mirror_waiting', type: 'mirror', title: 'Ждём партнёра', text: 'Ты ответил(а) на вопрос дня. Партнёр ещё не ответил — ответы откроются когда оба напишут.', priority: 1 });
          } else if (myAns && theirAns) {
            insights.push({
              id: 'mirror_done', type: 'mirror',
              title: mirror.is_matched ? '✨ Ответы совпали!' : 'Зеркало заполнено',
              text: mirror.is_matched
                ? 'Сегодня ваши ответы на вопрос дня оказались похожими. Это +1 к синхронности.'
                : 'Оба ответили на вопрос дня — хорошо! Разные взгляды тоже ценны.',
              priority: 0,
            });
          }
        } else {
          insights.push({ id: 'mirror_missing', type: 'mirror', title: 'Зеркало сегодня не открыто', text: 'Вопрос дня ещё не появился. Зайди в раздел «Зеркало» — там будет вопрос для вас обоих.', priority: 1 });
        }
      }

      // 2. Барометр теплоты
      const { data: metric } = await supabase
        .from('warmth_metrics').select('warmth_index, avg_length, emoji_density, avg_response_time')
        .eq('user_id', uid).order('date', { ascending: false }).limit(1).maybeSingle();

      if (metric) {
        const wi = metric.warmth_index ?? 0;
        let warmthText = '';
        if (wi >= 0.7) warmthText = 'Ваш барометр в зелёной зоне — общение живое и тёплое. Так держать!';
        else if (wi >= 0.4) warmthText = 'Общение в норме. Небольшой жест — эмодзи, вопрос или воспоминание — сделает его теплее.';
        else {
          const parts: string[] = [];
          if (metric.avg_length < 15) parts.push('короткие ответы');
          if (metric.emoji_density < 0.05) parts.push('мало эмодзи');
          if (metric.avg_response_time > 7200) parts.push('долгие паузы');
          warmthText = `Барометр показывает охлаждение${parts.length ? ': ' + parts.join(', ') : ''}. Напиши партнёру что-то тёплое?`;
        }
        insights.push({
          id: 'warmth_status', type: 'warmth',
          title: wi >= 0.7 ? 'Тепло в отношениях' : wi >= 0.4 ? 'Общение в норме' : 'Барометр в зоне внимания',
          text: warmthText, priority: wi < 0.4 ? 2 : 0,
        });
      }

      // 3. Незавершённый диалог
      if (partnerId) {
        const cutoff = new Date(now.getTime() - 8 * 3600000).toISOString();
        const { data: questions } = await supabase
          .from('messages').select('id, text, created_at')
          .eq('user_id', uid).ilike('text', '%?%').lte('created_at', cutoff)
          .order('created_at', { ascending: false }).limit(1);

        if (questions?.[0]) {
          const { data: reply } = await supabase
            .from('messages').select('id').eq('user_id', partnerId).gt('created_at', questions[0].created_at).limit(1).maybeSingle();
          if (!reply) {
            insights.push({
              id: 'dialog_unanswered', type: 'dialog', title: 'Вопрос без ответа',
              text: `«${(questions[0].text || '').slice(0, 70).replace(/\n/g, ' ')}...» — партнёр ещё не ответил. Может напомнить?`,
              priority: 2,
            });
          }
        }
      }

      insights.sort((a, b) => b.priority - a.priority);
      setDataInsights(insights);
    } catch (e) {
      console.error('InsightsWidget load error:', e);
    } finally {
      setLoadingData(false);
    }
  }, [uid, partnerId]);

  useEffect(() => {
    (async () => { await loadDataInsights(); })();
  }, [loadDataInsights]);

  async function generateAIAdvice() {
    if (!uid) return;
    setGenerating(true);
    const nextTip = () => {
      const next = (tipIdx + 1) % PRESET_TIPS.length;
      setTipIdx(next);
      setAiText(PRESET_TIPS[next].text);
    };
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('relationship-keeper', {
        body: {
          action: 'ai_advice', userId: uid, partnerId,
          context: { hasPartner: !!partnerId, insights: dataInsights.map((i) => i.title).join(', ') },
        },
      });
      if (fnErr) throw fnErr;
      if (data?.advice) setAiText(data.advice);
      else nextTip();
    } catch {
      nextTip();
    } finally {
      setGenerating(false);
    }
  }

  const tip = PRESET_TIPS[tipIdx];

  return (
    <View style={{ paddingTop: 20, paddingHorizontal: 16, paddingBottom: 32 }}>
      {/* ИИ-блок */}
      <Grad angle={135} stops={['#1A3A5C', '#0D1F33']} style={s.aiBlock}>
        <Orb size={120} color="rgba(43,143,216,0.3)" style={{ top: -30, right: -30 }} />
        <View style={s.aiHeader}>
          <View style={s.aiIcon}><SparkleIcon size={22} color="#5BB8FF" /></View>
          <View>
            <Text style={s.aiLabel}>ПЕРСОНАЛЬНЫЙ СОВЕТ</Text>
            <Text style={s.aiTitle}>Советник ИИ</Text>
          </View>
        </View>
        <Text style={s.aiText}>{aiText || tip.text}</Text>
        <Pressable onPress={generateAIAdvice} disabled={generating} accessibilityRole="button"
          style={({ pressed }) => [s.aiBtn, pressed && { backgroundColor: 'rgba(43,143,216,0.4)' }, generating && { opacity: 0.5 }]}>
          {generating ? <Spin duration={1000}><RefreshIcon size={16} color="#5BB8FF" /></Spin> : <RefreshIcon size={16} color="#5BB8FF" />}
          <Text style={s.aiBtnText}>{generating ? 'Анализирую...' : 'Получить новый совет'}</Text>
        </Pressable>
      </Grad>

      {/* Аналитика по данным */}
      <Text style={s.sectionLabel}>АНАЛИЗ ПО ВАШИМ ДАННЫМ</Text>

      {loadingData ? (
        <>
          <Skeleton height={90} />
          <Skeleton height={70} opacity={0.6} />
        </>
      ) : dataInsights.length === 0 ? (
        <Enter duration={300} dy={8}>
          <View style={[s.card, { justifyContent: 'center' }]}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.cardTitle}>Всё хорошо</Text>
              <Text style={[s.cardText, { textAlign: 'center' }]}>Нет срочных рекомендаций. Продолжайте общаться!</Text>
            </View>
          </View>
        </Enter>
      ) : (
        dataInsights.map((ins, i) => {
          const meta = TYPE_META[ins.type] || TYPE_META.ai;
          const { Icon } = meta;
          return (
            <Enter key={ins.id} duration={300} delay={i * 60} dy={8}>
              <View style={s.card}>
                <View style={[s.cardIcon, { backgroundColor: meta.bg }]}><Icon size={18} color={meta.color} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.cardTitle}>{ins.title}</Text>
                  <Text style={s.cardText}>{ins.text}</Text>
                </View>
              </View>
            </Enter>
          );
        })
      )}

      {/* Совет дня */}
      <Text style={[s.sectionLabel, { marginTop: 20, marginBottom: 8 }]}>СОВЕТ ДНЯ</Text>
      <View style={s.tip}>
        <View style={s.tipIcon}><HeartIcon size={18} color={V.rose} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.tipLabel}>ДЛЯ ВАС</Text>
          <Text style={s.cardTitle}>{tip.title}</Text>
          <Text style={s.cardText}>{tip.text}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  aiBlock: { borderRadius: 24, paddingVertical: 24, paddingHorizontal: 20, marginBottom: 20 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  aiIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(43,143,216,0.2)', alignItems: 'center', justifyContent: 'center' },
  aiLabel: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.5, color: 'rgba(91,184,255,0.8)', marginBottom: 2 },
  aiTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#FFFFFF' },
  aiText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22.4, color: 'rgba(255,255,255,0.8)', marginBottom: 16 },
  aiBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 14,
    backgroundColor: 'rgba(43,143,216,0.25)', borderWidth: 1, borderColor: 'rgba(43,143,216,0.4)',
  },
  aiBtnText: { fontFamily: fonts.bodySemi, fontSize: 14, color: '#5BB8FF' },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.8, color: V.muted, marginHorizontal: 4, marginBottom: 12 },
  card: {
    borderRadius: 22, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(200,51,74,0.14)', backgroundColor: '#150509',
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  cardIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#F5E6EB', marginBottom: 4 },
  cardText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20.15, color: '#C4909A' },
  tip: {
    borderRadius: 18, padding: 16, backgroundColor: '#2A0D16', borderWidth: 1, borderColor: 'rgba(200,51,74,0.18)',
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
  },
  tipIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(200,51,74,0.1)', alignItems: 'center', justifyContent: 'center' },
  tipLabel: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.6, color: V.rose, marginBottom: 3 },
  skeleton: { borderRadius: 18, backgroundColor: V.blush, overflow: 'hidden', marginBottom: 10 },
});
