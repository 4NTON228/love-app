// Порт EmotionTranslator.jsx — «Переводчик эмоций» на ненасильственное общение (.et-dark).
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

import { cubicOut, Enter, Grad, HEAD_BOLD, Orb, usePingPong } from '@/components/advisor/common';
import { useLoop } from '@/components/anim';
import { supabase } from '@/lib/supabase';
import { fonts } from '@/theme';

type IconP = { size?: number; color?: string };
const SendIcon = ({ size = 16, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="22" y1="2" x2="11" y2="13" /><Polygon points="22 2 15 22 11 13 2 9 22 2" />
  </Svg>
);
const SparkIcon = ({ size = 18, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
  </Svg>
);
const CopyIcon = ({ size = 15, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><Path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </Svg>
);
const CheckIcon = ({ size = 15, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="20 6 9 17 4 12" />
  </Svg>
);
const ArrowDownIcon = ({ size = 16, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="12" y1="5" x2="12" y2="19" /><Polyline points="19 12 12 19 5 12" />
  </Svg>
);

const TEMPLATES = [
  { id: 'ignore', label: 'Игнорируют', example: 'Ты меня вообще не слышишь!', desc: 'Когда партнёр не реагирует' },
  { id: 'late', label: 'Снова опоздал', example: 'Тебе плевать на моё время!', desc: 'Когда опаздывают без предупреждения' },
  { id: 'phone', label: 'Телефон важнее', example: 'Ты вечно в телефоне когда я говорю!', desc: 'Конкуренция с гаджетами' },
  { id: 'chores', label: 'Дела по дому', example: 'Почему всё всегда на мне?!', desc: 'Несправедливое распределение задач' },
  { id: 'feelings', label: 'Не понимают', example: 'Ты никогда не понимаешь как мне плохо.', desc: 'Когда чувства обесцениваются' },
  { id: 'plans', label: 'Сменил планы', example: 'Ты опять всё испортил своими планами!', desc: 'Отмена договорённостей' },
];
type Template = (typeof TEMPLATES)[number];

const GREEN = '#2B8F50';
const GREEN_L = '#4CAF82';

function Dot({ delay }: { delay: number }) {
  const v = useLoop(1400, delay);
  return (
    <Animated.View style={[s.dot, {
      opacity: v.interpolate({ inputRange: [0, 0.4, 0.8, 1], outputRange: [0.4, 1, 0.4, 0.4] }),
      transform: [{ scale: v.interpolate({ inputRange: [0, 0.4, 0.8, 1], outputRange: [0.6, 1, 0.6, 0.6] }) }],
    }]} />
  );
}

function ShimmerBand({ width }: { width: number }) {
  const v = useLoop(2500);
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', top: 0, bottom: 0, width: width * 0.6,
      transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-width, width * 2] }) }],
    }}>
      <Grad angle={90} stops={['transparent', 'rgba(255,255,255,0.15)', 'transparent']} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

type Result = { original: string; rewritten: string; tips: string[] };

export function EmotionTranslator({ uid, partnerId, initialText }: { uid: string; partnerId: string | null | undefined; initialText?: string | null }) {
  const [inputText, setInputText] = useState(initialText ?? '');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [btnW, setBtnW] = useState(0);
  const [focus, setFocus] = useState(false);
  const float1 = usePingPong(8000);
  const float2 = usePingPong(11000);
  const pulse = usePingPong(2000);
  const bounce = usePingPong(1500);

  async function translate() {
    if (!inputText.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setSent(false);
    try {
      // Все инструкции — в user-сообщении (relationship-keeper добавляет свой system-промпт)
      const context = selectedTemplate ? `Ситуация: ${selectedTemplate.label}. ` : '';
      const userMsg =
        `${context}Партнёр написал: "${inputText.trim()}"\n\n` +
        'Переформулируй это сообщение по принципам ненасильственного общения: ' +
        'убери обвинения и агрессию, используй «я-высказывания», сохрани смысл, звучи тепло. ' +
        'Ответь ТОЛЬКО валидным JSON без markdown и пояснений:\n' +
        '{"rewritten":"переформулированный текст","tips":["краткий совет 1","краткий совет 2"]}';

      const { data, error: fnErr } = await supabase.functions.invoke('relationship-keeper', {
        body: { messages: [{ role: 'user', content: userMsg }] },
      });

      if (fnErr) {
        let detail = fnErr.message ?? String(fnErr);
        try {
          const body = await (fnErr as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
          if (body?.error) detail = body.error;
        } catch { /* ignore json parse error */ }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);

      const raw: string = data?.choices?.[0]?.message?.content ?? '';
      let parsed: { rewritten?: string; tips?: unknown } | null = null;
      try {
        const cleaned = raw.replace(/^```json\s*/m, '').replace(/```\s*$/m, '').trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      } catch { /* ignore */ }

      if (parsed?.rewritten) {
        setResult({ original: inputText.trim(), rewritten: parsed.rewritten, tips: Array.isArray(parsed.tips) ? (parsed.tips as string[]).slice(0, 2) : [] });
      } else if (raw) {
        setResult({ original: inputText.trim(), rewritten: raw, tips: [] });
      } else {
        setError('Не удалось переформулировать. Попробуй ещё раз.');
      }
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      console.error('[EmotionTranslator]', msg);
      setError(msg.includes('AI_API_KEY')
        ? 'ИИ не настроен: добавь AI_API_KEY в Supabase → Edge Functions → Secrets'
        : `Ошибка: ${msg}`);
    }
    setLoading(false);
  }

  function applyTemplate(t: Template) {
    setSelectedTemplate(t);
    setInputText(t.example);
    setResult(null);
    setSent(false);
  }

  async function copy() {
    if (!result?.rewritten) return;
    await Clipboard.setStringAsync(result.rewritten).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendToPartner() {
    if (!result?.rewritten || sending) return;
    if (!partnerId) {
      setError('Партнёр не подключён — сначала пригласи партнёра в Настройках');
      return;
    }
    setSending(true);
    try {
      const { error: insErr } = await supabase.from('messages').insert({ user_id: uid, text: result.rewritten });
      if (insErr) throw insErr;
      setSent(true);
    } catch (e) {
      setError('Не удалось отправить сообщение — попробуй снова');
      console.error('[EmotionTranslator sendToPartner]', e);
    }
    setSending(false);
  }

  const orb1 = {
    transform: [
      { translateX: float1.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
      { translateY: float1.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }) },
      { scale: float1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
    ],
  };
  const orb2 = {
    transform: [
      { translateX: float2.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }) },
      { translateY: float2.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
      { scale: float2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) },
    ],
  };

  return (
    <View>
      {/* Hero */}
      <Grad angle={150} stops={[['#0D2A1A', 0], ['#1A4A2E', 0.5], ['#0A0206', 1]]} style={s.hero}>
        <Animated.View style={[{ position: 'absolute', top: -30, right: -20 }, orb1]}><Orb size={160} color="rgba(43,143,80,0.5)" style={{ position: 'relative' }} /></Animated.View>
        <Animated.View style={[{ position: 'absolute', bottom: -20, left: 10 }, orb2]}><Orb size={110} color="rgba(76,175,82,0.3)" style={{ position: 'relative' }} /></Animated.View>
        <View style={s.badge}>
          <Animated.View style={[s.badgeDot, {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }) }],
          }]} />
          <Text style={s.badgeText}>ИИ-ПЕРЕВОДЧИК</Text>
        </View>
        <Text style={s.heroTitle}>Переводчик эмоций</Text>
        <Text style={s.heroSub}>Грубое сообщение → тёплый диалог.{'\n'}ИИ сохраняет смысл, убирает агрессию.</Text>
      </Grad>

      {/* Templates */}
      <View style={{ paddingTop: 16, paddingBottom: 8 }}>
        <Text style={[s.label, { paddingHorizontal: 16, marginBottom: 10, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.8 }]}>ЧАСТЫЕ СИТУАЦИИ</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 4 }}>
          {TEMPLATES.map((t) => {
            const active = selectedTemplate?.id === t.id;
            return (
              <Pressable key={t.id} onPress={() => applyTemplate(t)} accessibilityRole="button" accessibilityState={{ selected: active }}
                style={[s.chip, active && { borderColor: 'transparent' }]}>
                {active ? <Grad angle={135} stops={['#2B6B3A', '#1A4A28']} style={[StyleSheet.absoluteFill, { borderRadius: 99 }]} /> : null}
                <Text style={[s.chipText, active && { color: '#FFFFFF' }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Input */}
      <View style={{ paddingTop: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={[s.label, { marginBottom: 8 }]}>ЧТО ХОЧЕШЬ СКАЗАТЬ</Text>
        <TextInput
          value={inputText} multiline placeholder="Напиши как есть, даже если резко..." placeholderTextColor="rgba(245,230,235,0.35)" selectionColor={GREEN}
          onChangeText={(t) => { setInputText(t); setResult(null); setSent(false); }}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={[s.textarea, focus && { borderColor: GREEN }]}
        />
        <Pressable onPress={translate} disabled={!inputText.trim() || loading} onLayout={(e) => setBtnW(e.nativeEvent.layout.width)} accessibilityRole="button"
          style={({ pressed }) => [s.translateBtn, (!inputText.trim() || loading) && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.96 }] }]}>
          <Grad angle={135} stops={[GREEN, '#1A4A2E']} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} />
          {btnW > 0 ? <ShimmerBand width={btnW} /> : null}
          <SparkIcon size={17} />
          <Text style={s.translateText}>{loading ? 'Перевожу...' : 'Переформулировать'}</Text>
        </Pressable>
      </View>

      {error ? <View style={s.error}><Text style={s.errorText}>{error}</Text></View> : null}

      {loading ? (
        <View style={s.loading}><Dot delay={0} /><Dot delay={200} /><Dot delay={400} /></View>
      ) : null}

      {result && !loading ? (
        <Enter duration={350} dy={16} easing={cubicOut} style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          <View style={s.before}>
            <Text style={[s.blockLabel, { color: '#C8334A' }]}>БЫЛО</Text>
            <Text style={s.blockText}>{result.original}</Text>
          </View>
          <Animated.View style={{ alignItems: 'center', marginVertical: 8, transform: [{ translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) }] }}>
            <ArrowDownIcon size={20} color={GREEN} />
          </Animated.View>
          <View style={s.after}>
            <Text style={[s.blockLabel, { color: GREEN_L }]}>СТАЛО</Text>
            <Text style={s.blockText}>{result.rewritten}</Text>
          </View>

          {result.tips?.length > 0 ? (
            <View style={s.tips}>
              <Text style={s.tipsLabel}>СОВЕТ ОТ ИИ</Text>
              {result.tips.map((tip, i) => (
                <View key={i} style={s.tip}>
                  <View style={s.tipDot} />
                  <Text style={s.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={copy} style={s.copyBtn} accessibilityRole="button">
              {copied ? <CheckIcon size={15} color={GREEN_L} /> : <CopyIcon size={15} color={GREEN_L} />}
              <Text style={s.copyText}>{copied ? 'Скопировано' : 'Скопировать'}</Text>
            </Pressable>
            {sent ? (
              <View style={s.sentBadge}>
                <CheckIcon size={15} color={GREEN_L} />
                <Text style={s.copyText}>Отправлено</Text>
              </View>
            ) : (
              <Pressable onPress={sendToPartner} disabled={sending} accessibilityRole="button"
                style={({ pressed }) => [s.sendBtn, sending && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.96 }] }]}>
                <Grad angle={135} stops={[GREEN, '#1A4A2E']} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
                <SendIcon size={15} />
                <Text style={s.sendText}>{sending ? 'Отправляю...' : 'Отправить партнёру'}</Text>
              </Pressable>
            )}
          </View>
        </Enter>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  hero: { paddingTop: 28, paddingHorizontal: 24, paddingBottom: 32 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 99, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 14,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN_L },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.8, color: 'rgba(255,255,255,0.8)' },
  heroTitle: { fontFamily: HEAD_BOLD, fontSize: 28, color: '#FFFFFF', lineHeight: 33.6, marginBottom: 8 },
  heroSub: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 19.5 },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.5, color: 'rgba(245,230,235,0.35)' },
  chip: {
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1.5, borderColor: 'rgba(76,175,82,0.2)',
    backgroundColor: 'rgba(76,175,82,0.08)', overflow: 'hidden',
  },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: '#F5E6EB' },
  textarea: {
    minHeight: 100, borderWidth: 1.5, borderColor: 'rgba(76,175,82,0.2)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
    fontFamily: fonts.body, fontSize: 15, lineHeight: 24, backgroundColor: '#0F200F', color: '#F5E6EB', textAlignVertical: 'top',
  },
  translateBtn: {
    marginTop: 10, padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden',
    shadowColor: GREEN, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  translateText: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#FFFFFF' },
  error: {
    marginHorizontal: 16, marginBottom: 16, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
    backgroundColor: 'rgba(200,51,74,0.08)', borderWidth: 1, borderColor: 'rgba(200,51,74,0.2)',
  },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: '#C8334A' },
  loading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: GREEN },
  before: { backgroundColor: 'rgba(200,51,74,0.08)', borderWidth: 1, borderColor: 'rgba(200,51,74,0.2)', borderRadius: 14, padding: 14, marginBottom: 10 },
  after: { backgroundColor: 'rgba(43,143,80,0.1)', borderWidth: 1.5, borderColor: 'rgba(76,175,82,0.25)', borderRadius: 14, padding: 14, marginBottom: 10 },
  blockLabel: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.8, marginBottom: 8 },
  blockText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22.4, color: '#F5E6EB' },
  tips: { backgroundColor: 'rgba(76,175,82,0.08)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 12 },
  tipsLabel: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.8, color: GREEN_L, marginBottom: 8 },
  tip: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 3 },
  tipDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: GREEN_L, marginTop: 6 },
  tipText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19.5, color: 'rgba(245,230,235,0.65)' },
  copyBtn: {
    flex: 1, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(76,175,82,0.3)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  copyText: { fontFamily: fonts.bodySemi, fontSize: 13, color: GREEN_L },
  sentBadge: {
    flex: 2, padding: 12, borderRadius: 12, backgroundColor: 'rgba(76,175,82,0.1)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  sendBtn: {
    flex: 2, padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    shadowColor: GREEN, shadowOpacity: 0.3, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  sendText: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#FFFFFF' },
});
