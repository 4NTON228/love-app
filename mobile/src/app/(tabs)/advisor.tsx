// Порт AIAdvisor.jsx — «Советник пары»: сетка разделов и подразделы с панелью «назад» (.adv-dark).
import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Animated, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Ellipse, Line, Path, Polyline, Circle } from 'react-native-svg';

import { Contracts } from '@/components/advisor/Contracts';
import { cubicOut, Enter, Grad, HEAD_BOLD, Orb, usePingPong } from '@/components/advisor/common';
import { EmotionTranslator } from '@/components/advisor/EmotionTranslator';
import { InsightsWidget } from '@/components/advisor/InsightsWidget';
import { PrivateJournal } from '@/components/advisor/PrivateJournal';
import { SyncMirror } from '@/components/advisor/SyncMirror';
import { TimeCapsule } from '@/components/advisor/TimeCapsule';
import { WarmthBarometer } from '@/components/advisor/WarmthBarometer';
import { useMe } from '@/providers/AuthProvider';
import { fonts } from '@/theme';

type ViewId = 'mirror' | 'capsule' | 'warmth' | 'insights' | 'journal' | 'translator' | 'contracts';

const ico = (children: ReactNode) => (
  <Svg viewBox="0 0 24 24" width={28} height={28} fill="none" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">{children}</Svg>
);

const VIEWS: { id: ViewId; label: string; desc: string; icon: ReactNode; gradient: [string, string]; glow: string }[] = [
  { id: 'mirror', label: 'Зеркало', desc: 'Синхронность пары', icon: ico(<><Ellipse cx="12" cy="10" rx="7" ry="9" /><Path d="M9 21h6M12 19v2" /></>), gradient: ['#C8334A', '#6B0F1F'], glow: 'rgba(200,51,74,0.35)' },
  { id: 'capsule', label: 'Капсула', desc: 'Письма будущему', icon: ico(<><Path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" /><Circle cx="12" cy="10" r="3" /></>), gradient: ['#7B3FBE', '#3D1A6B'], glow: 'rgba(123,63,190,0.35)' },
  { id: 'warmth', label: 'Теплота', desc: 'Барометр общения', icon: ico(<><Path d="M12 2c-1.5 2-3 4-3 7 0 2.5 1.3 4.7 3 6 1.7-1.3 3-3.5 3-6 0-3-1.5-5-3-7z" /><Path d="M12 15c-2.8 1-5 3.2-5 5.5 0 3 2.2 5.5 5 5.5s5-2.5 5-5.5c0-2.3-2.2-4.5-5-5.5z" /></>), gradient: ['#E8753A', '#8B2200'], glow: 'rgba(232,117,58,0.35)' },
  { id: 'insights', label: 'Советы ИИ', desc: 'Персональный анализ', icon: ico(<><Path d="M9.5 2A2.5 2.5 0 007 4.5A2.5 2.5 0 004.5 7A2.5 2.5 0 002 9.5v5A2.5 2.5 0 004.5 17A2.5 2.5 0 007 19.5A2.5 2.5 0 009.5 22h5a2.5 2.5 0 002.5-2.5 2.5 2.5 0 002.5-2.5 2.5 2.5 0 002.5-2.5v-5A2.5 2.5 0 0019.5 7 2.5 2.5 0 0017 4.5 2.5 2.5 0 0014.5 2z" /><Path d="M12 5v14M9 9h6M9 15h6" /></>), gradient: ['#2B8FD8', '#0D4A7A'], glow: 'rgba(43,143,216,0.35)' },
  { id: 'journal', label: 'Дневник', desc: 'Личные заметки', icon: ico(<><Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></>), gradient: ['#7B3FBE', '#1A0A2E'], glow: 'rgba(123,63,190,0.4)' },
  { id: 'translator', label: 'Переводчик', desc: 'Смягчи эмоции', icon: ico(<><Path d="M5 8l6 6" /><Path d="M4 14l6-6 2-3" /><Path d="M2 5h12" /><Path d="M7 2h1" /><Path d="M22 22l-5-10-5 10" /><Path d="M14 18h6" /></>), gradient: ['#2B8F50', '#0D2A18'], glow: 'rgba(43,143,80,0.4)' },
  { id: 'contracts', label: 'Контракты', desc: 'Договорённости пары', icon: ico(<><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><Polyline points="14 2 14 8 20 8" /><Line x1="16" y1="13" x2="8" y2="13" /><Line x1="16" y1="17" x2="8" y2="17" /><Polyline points="10 9 9 9 8 9" /></>), gradient: ['#2B64D8', '#0D1A4A'], glow: 'rgba(43,100,216,0.4)' },
];

function Card({ v, index, onPress }: { v: (typeof VIEWS)[number]; index: number; onPress: () => void }) {
  return (
    <Enter duration={400} delay={(index + 1) * 40} dy={16} scale={0.96} easing={cubicOut} style={{ width: '48.4%' }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${v.label}. ${v.desc}`}
        style={({ pressed }) => [s.card, { shadowColor: v.glow.replace(/,[\d.]+\)$/, ',1)'), shadowOpacity: Number(/,([\d.]+)\)$/.exec(v.glow)?.[1] ?? 0.35) }, pressed && { transform: [{ scale: 0.95 }] }]}>
        <Grad angle={135} stops={v.gradient} style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />
        <View>
          <View style={s.cardIcon}>{v.icon}</View>
          <Text style={s.cardLabel}>{v.label}</Text>
          <Text style={s.cardDesc}>{v.desc}</Text>
        </View>
        <View style={s.cardArrow}>
          <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Line x1="5" y1="12" x2="19" y2="12" /><Polyline points="12,5 19,12 12,19" />
          </Svg>
        </View>
      </Pressable>
    </Enter>
  );
}

export default function AIAdvisor() {
  const { uid, profile } = useMe();
  const partnerId = profile.partner_id;
  const insets = useSafeAreaInsets();
  const [activeView, setActiveView] = useState<ViewId | null>(null);
  // Дневник → переводчик
  const [translatorInitialText, setTranslatorInitialText] = useState<string | null>(null);
  const pulse = usePingPong(2000);

  const current = VIEWS.find((v) => v.id === activeView);
  const back = useCallback(() => { setActiveView(null); setTranslatorInitialText(null); }, []);

  // В вебе компонент размонтируется при уходе с вкладки — сбрасываем подраздел
  useFocusEffect(useCallback(() => back, [back]));

  useEffect(() => {
    if (!activeView) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => sub.remove();
  }, [activeView, back]);

  function handleConvertToMessage(text: string) {
    setTranslatorInitialText(text);
    setActiveView('translator');
  }

  const bottomPad = 80 + 92 + insets.bottom;

  if (activeView) {
    return (
      <View style={s.page}>
        <View style={[s.backBar, { paddingTop: Math.max(16, insets.top + 8) }]}>
          <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Назад" style={s.backBtn} hitSlop={6}>
            <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="hsl(349, 59%, 41%)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <Polyline points="15,18 9,12 15,6" />
            </Svg>
          </Pressable>
          <Text style={s.backTitle} accessibilityRole="header">{current?.label}</Text>
        </View>
        <ScrollView key={activeView} contentContainerStyle={{ paddingBottom: bottomPad }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
          <Enter duration={280} dx={18} easing={cubicOut}>
            {activeView === 'mirror' ? <SyncMirror uid={uid} partnerId={partnerId} /> : null}
            {activeView === 'capsule' ? <TimeCapsule uid={uid} partnerId={partnerId} /> : null}
            {activeView === 'warmth' ? <WarmthBarometer uid={uid} partnerId={partnerId} /> : null}
            {activeView === 'insights' ? <InsightsWidget uid={uid} partnerId={partnerId} /> : null}
            {activeView === 'journal' ? <PrivateJournal uid={uid} onConvertToMessage={handleConvertToMessage} /> : null}
            {activeView === 'translator' ? <EmotionTranslator uid={uid} partnerId={partnerId} initialText={translatorInitialText} /> : null}
            {activeView === 'contracts' ? <Contracts uid={uid} partnerId={partnerId} /> : null}
          </Enter>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.page}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        <View style={[s.hero, { paddingTop: Math.max(52, insets.top + 20) }]}>
          <Grad angle={175} stops={[['#0D0305', 0], ['#220810', 0.35], ['#46101F', 0.65], ['#0A0206', 1]]} style={StyleSheet.absoluteFill} />
          <Orb size={200} color="rgba(200,51,74,0.5)" style={{ top: -40, right: -40 }} />
          <Orb size={130} color="rgba(139,26,44,0.4)" style={{ bottom: -20, left: 20 }} />
          <View style={s.badge}>
            <Animated.View style={[s.badgeDot, {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) }],
            }]} />
            <Text style={s.badgeText}>СОВЕТНИК ПАРЫ</Text>
          </View>
          <Text style={s.heroTitle}>Умный помощник{'\n'}ваших отношений</Text>
          <Text style={s.heroSub}>Анализирует, напоминает и помогает{'\n'}сохранять тепло между вами</Text>
        </View>

        <View style={s.grid}>
          {VIEWS.map((v, i) => <Card key={v.id} v={v} index={i} onPress={() => setActiveView(v.id)} />)}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0A0206' },
  hero: { paddingHorizontal: 24, paddingBottom: 28, overflow: 'hidden' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 99, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 14,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF6B8A' },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.8, color: 'rgba(255,255,255,0.85)' },
  heroTitle: { fontFamily: HEAD_BOLD, fontSize: 30, color: '#FFFFFF', lineHeight: 36, marginBottom: 8, letterSpacing: -0.5 },
  heroSub: { fontFamily: fonts.body, fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 21 },
  grid: { paddingVertical: 20, paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  card: {
    borderRadius: 20, paddingVertical: 20, paddingHorizontal: 16, minHeight: 140, justifyContent: 'space-between',
    shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  cardIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  cardLabel: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#FFFFFF', marginBottom: 4 },
  cardDesc: { fontFamily: fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 16.8 },
  cardArrow: { position: 'absolute', top: 16, right: 16, opacity: 0.5 },
  backBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(200,51,74,0.18)', backgroundColor: 'rgba(10,2,6,0.92)', zIndex: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3D1520', alignItems: 'center', justifyContent: 'center' },
  backTitle: { fontFamily: HEAD_BOLD, fontSize: 18, color: '#F5E6EB' },
});
