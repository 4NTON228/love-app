// Порт PrivateJournal.jsx — личный дневник с ИИ-рефлексией (.pj-dark).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Line, Path, Polyline, Rect } from 'react-native-svg';

import { cubicOut, Enter, Grad, HEAD_BOLD, Orb, usePingPong } from '@/components/advisor/common';
import { useLoop } from '@/components/anim';
import { supabase } from '@/lib/supabase';
import { fonts } from '@/theme';

type IconP = { size?: number; color?: string };
const PenIcon = ({ size = 20, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
);
const ArrowRightIcon = ({ size = 16, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="5" y1="12" x2="19" y2="12" /><Polyline points="12,5 19,12 12,19" />
  </Svg>
);
const TrashIcon = ({ size = 16, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="3 6 5 6 21 6" /><Path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><Path d="M10 11v6M14 11v6" /><Path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </Svg>
);
const LockIcon = ({ size = 14, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><Path d="M7 11V7a5 5 0 0110 0v4" />
  </Svg>
);
const MessageIcon = ({ size = 16, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </Svg>
);

const MOOD_OPTIONS = [
  { value: 1, label: 'Тяжело', color: '#C8334A' },
  { value: 2, label: 'Грустно', color: '#E8753A' },
  { value: 3, label: 'Нейтрально', color: '#8899AA' },
  { value: 4, label: 'Хорошо', color: '#4CAF82' },
  { value: 5, label: 'Отлично', color: '#2B8FD8' },
];

const LILAC = '#B87FFF';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

type Entry = { id: string; content: string; mood: number; ai_reflection: string | null; created_at: string };

/* .pj-write-btn::after — бегущий блик */
function ShimmerBand({ width }: { width: number }) {
  const v = useLoop(2500, 0);
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', top: 0, bottom: 0, width: width * 0.6,
      transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-width, width * 2] }) }],
    }}>
      <Grad angle={90} stops={['transparent', 'rgba(255,255,255,0.15)', 'transparent']} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

export function PrivateJournal({ uid, onConvertToMessage }: { uid: string; onConvertToMessage?: (text: string) => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  const [mood, setMood] = useState(3);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [btnW, setBtnW] = useState(0);
  const [focus, setFocus] = useState(false);
  const textareaRef = useRef<TextInput>(null);
  const float1 = usePingPong(8000);
  const float2 = usePingPong(11000);
  const pulse = usePingPong(2000);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('private_journal').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(50);
    setEntries((data as Entry[]) ?? []);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    (async () => { await loadEntries(); })();
  }, [loadEntries]);

  async function generateReflection(entryId: string, content: string) {
    setAiLoading(true);
    try {
      const { data } = await supabase.functions.invoke('relationship-keeper', {
        body: {
          messages: [
            { role: 'system', content: 'Ты заботливый психолог. Прочитай запись в личный дневник и задай 1-2 глубоких вопроса для рефлексии. Помоги человеку лучше понять свои чувства. Будь тёплым и ненавязчивым. Максимум 3 предложения.' },
            { role: 'user', content: `Запись в дневнике:\n${content}` },
          ],
        },
      });
      const reflection = data?.choices?.[0]?.message?.content;
      if (reflection) {
        await supabase.from('private_journal').update({ ai_reflection: reflection }).eq('id', entryId);
        setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, ai_reflection: reflection } : e)));
      }
    } catch { /* silent */ }
    setAiLoading(false);
  }

  async function save() {
    if (!text.trim() || saving) return;
    setSaving(true);
    const { data, error } = await supabase.from('private_journal').insert({ user_id: uid, content: text.trim(), mood }).select().single();
    if (!error && data) {
      setEntries((prev) => [data as Entry, ...prev]);
      setText('');
      setMood(3);
      setWriting(false);
      generateReflection(data.id, data.content);
    }
    setSaving(false);
  }

  async function deleteEntry(id: string) {
    await supabase.from('private_journal').delete().eq('id', id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
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
      <Grad angle={150} stops={[['#1A0A2E', 0], ['#2D1B4E', 0.5], ['#0A0206', 1]]} style={s.hero}>
        <Animated.View style={[{ position: 'absolute', top: -30, right: -20 }, orb1]}><Orb size={160} color="rgba(123,63,190,0.5)" style={{ position: 'relative' }} /></Animated.View>
        <Animated.View style={[{ position: 'absolute', bottom: -20, left: 10 }, orb2]}><Orb size={100} color="rgba(200,51,74,0.3)" style={{ position: 'relative' }} /></Animated.View>
        <View style={s.badge}>
          <Animated.View style={[s.badgeDot, {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }) }],
          }]} />
          <Text style={s.badgeText}>ТОЛЬКО ДЛЯ ТЕБЯ</Text>
        </View>
        <Text style={s.heroTitle}>Личный дневник</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <LockIcon size={13} color="rgba(255,255,255,0.55)" />
          <Text style={s.heroSub}>Записи видны только тебе — не партнёру</Text>
        </View>
      </Grad>

      {!writing ? (
        <Pressable
          onPress={() => { setWriting(true); setTimeout(() => textareaRef.current?.focus(), 50); }}
          onLayout={(e) => setBtnW(e.nativeEvent.layout.width)} accessibilityRole="button"
          style={({ pressed }) => [s.writeBtn, pressed && { transform: [{ scale: 0.96 }] }]}>
          <Grad angle={135} stops={['#7B3FBE', '#3D1A6B']} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
          {btnW > 0 ? <ShimmerBand width={btnW} /> : null}
          <PenIcon size={18} />
          <Text style={s.writeText}>Написать запись</Text>
        </Pressable>
      ) : (
        <Enter duration={300} dy={-12} easing={cubicOut} style={s.compose}>
          <Text style={s.composeLabel}>КАК ТЫ СЕБЯ ЧУВСТВУЕШЬ?</Text>
          <View style={s.moodRow}>
            {MOOD_OPTIONS.map((m) => {
              const active = mood === m.value;
              return (
                <Pressable key={m.value} onPress={() => setMood(m.value)} accessibilityRole="radio" accessibilityState={{ selected: active }}
                  style={[s.moodBtn, active && { backgroundColor: m.color, borderColor: m.color, transform: [{ scale: 1.05 }] }]}>
                  <Text style={[s.moodText, active && { color: '#FFFFFF' }]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            ref={textareaRef} value={text} onChangeText={setText} multiline
            placeholder="Напиши всё, что у тебя на душе..." placeholderTextColor="rgba(245,230,235,0.4)" selectionColor="#7B3FBE"
            onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
            style={[s.textarea, focus && { borderColor: '#7B3FBE' }]}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Pressable onPress={() => { setWriting(false); setText(''); setMood(3); }} style={s.cancelBtn} accessibilityRole="button">
              <Text style={s.cancelText}>Отмена</Text>
            </Pressable>
            <Pressable onPress={save} disabled={!text.trim() || saving} accessibilityRole="button" style={[s.saveBtn, (!text.trim() || saving) && { opacity: 0.5 }]}>
              <Grad angle={135} stops={['#7B3FBE', '#3D1A6B']} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
              <Text style={s.saveText}>{saving ? 'Сохраняю...' : 'Сохранить'}</Text>
            </Pressable>
          </View>
        </Enter>
      )}

      <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {entries.length > 0 ? <Text style={s.sectionTitle}>ЗАПИСИ</Text> : null}

        {loading ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', padding: 48 }}>
            <Svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="rgba(123,63,190,0.5)" strokeWidth={2} strokeLinecap="round">
              <Path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
            </Svg>
          </View>
        ) : entries.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
            <View style={{ marginBottom: 12, opacity: 0.4 }}><PenIcon size={36} color="rgba(245,230,235,0.3)" /></View>
            <Text style={s.emptyText}>Твой дневник пуст.{'\n'}Напиши первую запись — выплесни всё, что на душе.</Text>
          </View>
        ) : (
          entries.map((entry, i) => {
            const isExpanded = expandedId === entry.id;
            const moodColor = MOOD_OPTIONS.find((m) => m.value === entry.mood)?.color ?? '#8899AA';
            return (
              <Enter key={entry.id} duration={350} delay={i * 50} dy={10} easing={cubicOut}>
                <Pressable onPress={() => setExpandedId(isExpanded ? null : entry.id)} accessibilityRole="button"
                  style={({ pressed }) => [s.entry, pressed && { transform: [{ scale: 0.98 }] }]}>
                  <View style={s.entryHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[s.moodDot, { backgroundColor: moodColor }]} />
                      <Text style={s.entryDate}>{formatDate(entry.created_at)}</Text>
                    </View>
                    {/* В вебе кнопка проявляется при :hover — на телефоне это касание записи */}
                    <Pressable onPress={() => deleteEntry(entry.id)} accessibilityRole="button" accessibilityLabel="Удалить"
                      style={{ padding: 4, opacity: isExpanded ? 1 : 0 }} disabled={!isExpanded}>
                      <TrashIcon size={14} color="rgba(200,51,74,0.4)" />
                    </Pressable>
                  </View>

                  <Text style={s.entryText} numberOfLines={isExpanded ? undefined : 3}>{entry.content}</Text>

                  {isExpanded ? (
                    <>
                      {entry.ai_reflection ? (
                        <Enter duration={300} dy={-12} easing={cubicOut} style={s.reflection}>
                          <Text style={s.reflectionLabel}>ВОПРОС ДЛЯ РЕФЛЕКСИИ</Text>
                          <Text style={s.reflectionText}>{entry.ai_reflection}</Text>
                        </Enter>
                      ) : aiLoading ? (
                        <Enter duration={300} dy={-12} easing={cubicOut} style={s.reflection}>
                          <Text style={s.reflectionLabel}>ИИ ДУМАЕТ...</Text>
                        </Enter>
                      ) : null}

                      {onConvertToMessage ? (
                        <Pressable onPress={() => onConvertToMessage(entry.content)} accessibilityRole="button"
                          style={({ pressed }) => [s.convertBtn, pressed && { transform: [{ scale: 0.95 }] }]}>
                          <MessageIcon size={13} color={LILAC} />
                          <Text style={s.convertText}>Перевести в сообщение</Text>
                          <ArrowRightIcon size={13} color={LILAC} />
                        </Pressable>
                      ) : null}
                    </>
                  ) : null}
                </Pressable>
              </Enter>
            );
          })
        )}
      </View>
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
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: LILAC },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.8, color: 'rgba(255,255,255,0.8)' },
  heroTitle: { fontFamily: HEAD_BOLD, fontSize: 28, color: '#FFFFFF', lineHeight: 33.6, marginBottom: 8 },
  heroSub: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 19.5 },
  writeBtn: {
    margin: 16, padding: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden',
    shadowColor: '#7B3FBE', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  writeText: { fontFamily: fonts.bodySemi, fontSize: 15, color: '#FFFFFF' },
  compose: { marginHorizontal: 16, marginBottom: 16, marginTop: 16, backgroundColor: '#1A0830', borderRadius: 20, padding: 20 },
  composeLabel: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.6, color: LILAC, marginBottom: 10 },
  moodRow: { flexDirection: 'row', gap: 8, marginVertical: 12, flexWrap: 'wrap' },
  moodBtn: {
    flexGrow: 1, flexBasis: 56, minWidth: 56, paddingVertical: 7, paddingHorizontal: 4, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'transparent', backgroundColor: 'rgba(184,127,255,0.1)', alignItems: 'center',
  },
  moodText: { fontFamily: fonts.bodySemi, fontSize: 11, color: '#F5E6EB' },
  textarea: {
    minHeight: 120, borderWidth: 1.5, borderColor: 'rgba(184,127,255,0.25)', borderRadius: 12, padding: 12,
    fontFamily: fonts.body, fontSize: 15, lineHeight: 24, color: '#F5E6EB', textAlignVertical: 'top',
  },
  cancelBtn: { flex: 1, padding: 11, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(123,63,190,0.25)', alignItems: 'center' },
  cancelText: { fontFamily: fonts.bodySemi, fontSize: 14, color: LILAC },
  saveBtn: { flex: 2, padding: 11, borderRadius: 12, alignItems: 'center' },
  saveText: { fontFamily: fonts.bodySemi, fontSize: 14, color: '#FFFFFF' },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.8, color: LILAC, marginBottom: 12 },
  entry: { backgroundColor: '#1A0830', borderRadius: 18, padding: 16, marginBottom: 12 },
  entryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  moodDot: { width: 10, height: 10, borderRadius: 5 },
  entryDate: { fontFamily: fonts.body, fontSize: 11, color: 'rgba(245,230,235,0.4)' },
  entryText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22.4, color: '#F5E6EB' },
  reflection: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: 'rgba(184,127,255,0.08)', borderLeftWidth: 2.5, borderLeftColor: LILAC },
  reflectionLabel: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.7, color: LILAC, marginBottom: 6 },
  reflectionText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20.15, color: 'rgba(245,230,235,0.7)', fontStyle: 'italic' },
  convertBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 10, paddingVertical: 7, paddingHorizontal: 14,
    borderRadius: 99, borderWidth: 1.5, borderColor: 'rgba(184,127,255,0.3)',
  },
  convertText: { fontFamily: fonts.bodySemi, fontSize: 12, color: LILAC },
  emptyText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: 'rgba(245,230,235,0.3)', textAlign: 'center' },
});
