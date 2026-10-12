// Порт SyncMirror.jsx — «Вопрос дня» (зеркало синхронности пары). Только тёмная тема (.sm-dark).
import { useCallback, useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { cubicSpring, Enter, Grad, HEAD_BOLD_ITALIC, Orb, Ring, usePingPong, V } from '@/components/advisor/common';
import { checkMatch } from '@/lib/advisorLogic';
import { supabase } from '@/lib/supabase';
import { fonts } from '@/theme';

const FALLBACK_QUESTIONS = [
  'Что в нашем партнёре вдохновляет тебя больше всего прямо сейчас?',
  'Каким был наш лучший совместный день за последние месяцы?',
  'Какую мечту ты хочешь осуществить вместе с партнёром?',
  'Что ты больше всего ценишь в наших отношениях?',
  'Какой момент вместе ты будешь помнить всегда?',
  'Что партнёр делает, что неизменно поднимает тебе настроение?',
  'Какое приключение ты хочешь пережить с партнёром?',
  'Что тебя удивило в партнёре за последнее время?',
  'Какая наша традиция нравится тебе больше всего?',
  'Что бы ты хотел сказать партнёру, но ещё не сказал?',
];

const MUTED = V.muted;


type Mirror = {
  id: string; user_id: string; partner_id: string; question: string;
  answer: string | null; partner_answer: string | null; is_matched: boolean | null; spark_earned?: boolean | null;
};

function HeartDot() {
  return (
    <Svg viewBox="0 0 16 16" width={12} height={12} fill="rgba(255,255,255,0.9)">
      <Path d="M8 13.5C8 13.5 1.5 9.2 1.5 5.5a3.5 3.5 0 016.5-1.8A3.5 3.5 0 0114.5 5.5C14.5 9.2 8 13.5 8 13.5z" />
    </Svg>
  );
}

const MirrorIcon = ({ size, width }: { size: number; width: number }) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#C8334A" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
    <Ellipse cx="12" cy="10" rx="7" ry="9" /><Path d="M9 21h6M12 19v2" />
  </Svg>
);

function StreakDot({ i, filled }: { i: number; filled: boolean }) {
  const inner = filled ? <Grad angle={135} stops={['#C8334A', '#8B1A2C']} style={[s.dot, { borderColor: 'transparent' }]}><HeartDot /></Grad> : <View style={s.dot} />;
  return (
    <Enter duration={400} delay={i * 70} scale={0} easing={cubicSpring}>{inner}</Enter>
  );
}

export function SyncMirror({ uid, partnerId, topInset = 0 }: { uid: string; partnerId: string | null | undefined; topInset?: number }) {
  const [loading, setLoading] = useState(true);
  const [mirror, setMirror] = useState<Mirror | null>(null);
  const [myAnswer, setMyAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [streak, setStreak] = useState(0);
  const [focus, setFocus] = useState(false);
  const float1 = usePingPong(6000);
  const float2 = usePingPong(9000);
  const pulse = usePingPong(2500);

  const load = useCallback(async () => {
    if (!uid || !partnerId) { setLoading(false); return; }
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    const { data: rows } = await supabase
      .from('sync_mirror')
      .select('*')
      .or(`user_id.eq.${uid},partner_id.eq.${uid}`)
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${today}T23:59:59Z`)
      .order('created_at', { ascending: false })
      .limit(1);

    let row: Mirror | null = (rows?.[0] as Mirror | undefined) ?? null;
    if (!row) {
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      const question = FALLBACK_QUESTIONS[dayOfYear % FALLBACK_QUESTIONS.length];
      const { data: created } = await supabase
        .from('sync_mirror')
        .insert({ user_id: uid, partner_id: partnerId, question })
        .select().single();
      row = created as Mirror | null;
    }

    setMirror(row);
    if (row) {
      const saved = row.user_id === uid ? row.answer : row.partner_answer;
      if (saved) setMyAnswer(saved);
    }

    const { data: st } = await supabase.from('ai_advisor_settings').select('sync_streak').eq('user_id', uid).maybeSingle();
    setStreak(st?.sync_streak ?? 0);
    setLoading(false);
  }, [uid, partnerId]);

  useEffect(() => {
    let alive = true;
    (async () => { if (alive) await load(); })();
    return () => { alive = false; };
  }, [load]);

  const mirrorId = mirror?.id;
  useEffect(() => {
    if (!mirrorId) return;
    const channel = supabase
      .channel(`mirror:${mirrorId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sync_mirror', filter: `id=eq.${mirrorId}` },
        (payload) => setMirror(payload.new as Mirror))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [mirrorId]);

  async function submitAnswer() {
    if (!myAnswer.trim() || !mirror) return;
    setSubmitting(true);
    const isOwner = mirror.user_id === uid;
    const field = isOwner ? 'answer' : 'partner_answer';
    const timeField = isOwner ? 'answered_at' : 'partner_answered_at';
    const update: Record<string, unknown> = { [field]: myAnswer.trim(), [timeField]: new Date().toISOString() };
    const partnerAns = isOwner ? mirror.partner_answer : mirror.answer;
    if (partnerAns) {
      const matched = checkMatch(myAnswer.trim(), partnerAns);
      update.is_matched = matched;
      update.spark_earned = matched;
    }
    const { data: updated } = await supabase.from('sync_mirror').update(update).eq('id', mirror.id).select().single();
    if (updated) setMirror(updated as Mirror);
    if (update.spark_earned) {
      await supabase.from('ai_advisor_settings')
        .upsert({ user_id: uid, sync_streak: streak + 1, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      setStreak((n) => n + 1);
    }
    setSubmitting(false);
  }

  const isOwner = mirror?.user_id === uid;
  const myStoredAns = mirror ? (isOwner ? mirror.answer : mirror.partner_answer) : null;
  const theirAns = mirror ? (isOwner ? mirror.partner_answer : mirror.answer) : null;
  const bothAnswered = !!(myStoredAns && theirAns);
  const iAnswered = !!myStoredAns;
  const sticker = streak >= 7;

  if (loading) {
    return (
      <View style={s.loading}>
        <Ring />
        <Text style={s.loadingText}>Загружаю вопрос дня...</Text>
      </View>
    );
  }

  if (!mirror) {
    return (
      <View style={s.empty}>
        <View style={s.emptyIcon}><MirrorIcon size={36} width={1.6} /></View>
        <Text style={s.emptyTitle}>Партнёр не подключён</Text>
        <Text style={s.emptyText}>Добавьте партнёра в настройках профиля — тогда появится общий вопрос дня.</Text>
      </View>
    );
  }

  const orbStyle = (v: Animated.Value, dy: number, sc: number) => ({
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, sc] }) },
    ],
  });

  return (
    <View>
      {/* Hero */}
      <Grad angle={160} stops={[['#6B1428', 0], ['#3A0A14', 0.5], ['#1A0408', 1]]} style={[s.hero, { paddingTop: 28 + topInset }]}>
        <Animated.View style={[{ position: 'absolute', top: -40, right: -40 }, orbStyle(float1, -20, 1.05)]}>
          <Orb size={180} color="rgba(200,51,74,0.4)" style={{ position: 'relative' }} />
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', bottom: -30, left: -50 }, orbStyle(float2, 16, 0.96)]}>
          <Orb size={140} color="rgba(139,26,44,0.35)" style={{ position: 'relative' }} />
        </Animated.View>
        <View style={s.tag}>
          <Svg viewBox="0 0 24 24" width={10} height={10} fill="rgba(255,255,255,0.7)"><Circle cx="12" cy="12" r="10" /></Svg>
          <Text style={s.tagText}>ВОПРОС ДНЯ</Text>
        </View>
        <Text style={s.heroQ}>
          <Text style={s.quote}>{'«'} </Text>
          {mirror.question}»
        </Text>
      </Grad>

      {/* Streak */}
      <View style={s.streakBar}>
        <View style={{ flexDirection: 'row', gap: 5, flex: 1 }}>
          {Array.from({ length: 7 }).map((_, i) => <StreakDot key={i} i={i} filled={i < streak} />)}
        </View>
        <Text style={s.streakNum}>{streak}/7 дней</Text>
      </View>

      <View style={{ padding: 20 }}>
        {bothAnswered ? (
          <>
            {mirror.is_matched ? (
              <Enter duration={550} scale={0.5} easing={cubicSpring}>
                <Grad angle={135} stops={['rgba(200,51,74,0.1)', 'rgba(139,26,44,0.06)']} style={s.match}>
                  <Svg viewBox="0 0 24 24" width={20} height={20} fill="#C8334A">
                    <Path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
                  </Svg>
                  <Text style={s.matchText}>Ваши мысли созвучны</Text>
                </Grad>
              </Enter>
            ) : null}
            <View style={{ gap: 12, marginBottom: 20 }}>
              <Enter duration={380} dx={-28}>
                <View style={s.answerCard}>
                  <Grad angle={135} stops={['#C8334A', '#8B1A2C']} style={s.who}><Text style={s.whoText}>ТЫ</Text></Grad>
                  <Text style={s.answerText}>{myStoredAns}</Text>
                </View>
              </Enter>
              <Enter duration={380} delay={120} dx={28}>
                <View style={s.answerCard}>
                  <Grad angle={135} stops={['#7B3FBE', '#3D1A6B']} style={s.who}><Text style={s.whoText}>ПАРТНЁР</Text></Grad>
                  <Text style={s.answerText}>{theirAns}</Text>
                </View>
              </Enter>
            </View>
          </>
        ) : iAnswered ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Animated.View style={{
              marginBottom: 16,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
            }}>
              <Grad angle={135} stops={['rgba(200,51,74,0.12)', 'rgba(139,26,44,0.08)']} style={s.waitingPulse}>
                <MirrorIcon size={28} width={1.8} />
              </Grad>
            </Animated.View>
            <Text style={s.waitingTitle}>Ответ сохранён</Text>
            <Text style={s.waitingText}>Ждём партнёра. Ответы откроются{'\n'}когда оба напишут.</Text>
            <View style={s.hiddenBadge}><Text style={s.hiddenBadgeText}>Твой ответ скрыт до открытия</Text></View>
          </View>
        ) : (
          <>
            <View style={{ marginBottom: 8 }}>
              <TextInput
                value={myAnswer} onChangeText={setMyAnswer} maxLength={500} multiline
                placeholder="Пиши честно — партнёр увидит только после своего ответа..." placeholderTextColor={MUTED}
                selectionColor="#C8334A" onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
                style={[s.textarea, focus && { borderColor: '#C8334A' }]}
              />
            </View>
            <Text style={s.counter}>{myAnswer.length}/500</Text>
            <Pressable onPress={submitAnswer} disabled={!myAnswer.trim() || submitting} accessibilityRole="button"
              style={({ pressed }) => [s.submit, (!myAnswer.trim() || submitting) && { opacity: 0.45 }, pressed && { transform: [{ scale: 0.97 }] }]}>
              <Grad angle={135} stops={['#C8334A', '#8B1A2C']} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
              <Text style={s.submitText}>{submitting ? 'Сохраняю...' : 'Отправить ответ'}</Text>
            </Pressable>
            <Text style={s.hint}>Партнёр не увидит ответ, пока не ответит сам</Text>
          </>
        )}

        {/* Стикер */}
        <View style={s.sticker}>
          {sticker ? (
            <Svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="#C8334A" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Rect x="5" y="11" width="14" height="10" rx="2" /><Path d="M8 11V7a4 4 0 017.9-.5" />
            </Svg>
          ) : (
            <Svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="#9A6070" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Rect x="5" y="11" width="14" height="10" rx="2" /><Path d="M8 11V7a4 4 0 018 0v4" />
            </Svg>
          )}
          <Text style={s.stickerText}>
            {sticker
              ? <><Text style={s.strong}>Стикер разблокирован!</Text> Используй его в чате.</>
              : <>7 дней синхронности → стикер для чата. Осталось: <Text style={s.strong}>{7 - streak} дн</Text></>}
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 32 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 99, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 14,
  },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.8, color: 'rgba(255,255,255,0.7)' },
  heroQ: { fontFamily: HEAD_BOLD_ITALIC, fontSize: 22, color: '#FFFFFF', lineHeight: 29.7 },
  quote: { color: 'rgba(200,51,74,0.7)', fontSize: 48 },
  streakBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 20,
    backgroundColor: '#1A0810', borderBottomWidth: 1, borderBottomColor: 'rgba(200,51,74,0.18)',
  },
  dot: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(200,51,74,0.2)',
  },
  streakNum: { fontFamily: fonts.bodyBold, fontSize: 13, color: V.rose },
  textarea: {
    minHeight: 130, backgroundColor: '#1A0810', borderWidth: 2, borderColor: 'transparent', borderRadius: 18, padding: 16,
    fontFamily: fonts.body, fontSize: 16, color: '#F5E6EB', lineHeight: 25.6, textAlignVertical: 'top',
  },
  counter: { textAlign: 'right', fontFamily: fonts.body, fontSize: 11, color: MUTED, marginBottom: 12 },
  submit: {
    padding: 15, borderRadius: 16, alignItems: 'center',
    shadowColor: '#8B1A2C', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  submitText: { fontFamily: fonts.bodyBold, fontSize: 16, color: 'white', letterSpacing: 0.2 },
  hint: { textAlign: 'center', fontFamily: fonts.body, fontSize: 12, color: MUTED, marginTop: 10 },
  waitingPulse: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  waitingTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#F5E6EB', marginBottom: 6 },
  waitingText: { fontFamily: fonts.body, fontSize: 14, color: MUTED, lineHeight: 21, textAlign: 'center' },
  hiddenBadge: { marginTop: 14, backgroundColor: '#1A0810', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  hiddenBadgeText: { fontFamily: fonts.body, fontSize: 13, color: MUTED, fontStyle: 'italic' },
  match: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 20,
    borderRadius: 16, marginBottom: 16, borderWidth: 1.5, borderColor: 'rgba(200,51,74,0.25)',
  },
  matchText: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#C8334A' },
  answerCard: {
    borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(200,51,74,0.14)', backgroundColor: 'rgba(18,5,10,0.92)',
  },
  who: { paddingVertical: 8, paddingHorizontal: 14 },
  whoText: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.85)' },
  answerText: { padding: 14, fontFamily: fonts.body, fontSize: 15, lineHeight: 24, color: '#F5E6EB', backgroundColor: '#1A0810' },
  sticker: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, marginTop: 8,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(200,51,74,0.3)', backgroundColor: 'rgba(200,51,74,0.04)',
  },
  stickerText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: MUTED, lineHeight: 18.2 },
  strong: { fontFamily: fonts.bodyBold, color: '#C8334A' },
  loading: { alignItems: 'center', gap: 14, paddingVertical: 60, paddingHorizontal: 20 },
  loadingText: { fontFamily: fonts.body, fontSize: 14, color: MUTED },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#1A0810', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#F5E6EB', marginBottom: 8 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: MUTED, lineHeight: 21, textAlign: 'center' },
});
