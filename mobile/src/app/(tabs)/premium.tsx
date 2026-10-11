// Порт src/components/Premium.jsx — оплата через Edge Function yookassa.
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

import { Radials } from '@/components/Backgrounds';
import { useSubscription } from '@/hooks/useSubscription';
import { SUPABASE_URL, WEB_URL, supabase } from '@/lib/supabase';
import { colors, cssLinear, fonts } from '@/theme';

const ROSE = 'hsl(349, 59%, 41%)';
const S = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: ROSE, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const FEATURES = [
  { svg: <Svg {...S}><Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" /><Path d="M8 12h8M12 8v8" /></Svg>, title: 'ИИ-советник для пары', desc: 'Персональные рекомендации и анализ вашей связи' },
  { svg: <Svg {...S}><Rect x="3" y="3" width="18" height="18" rx="3" /><Circle cx="8.5" cy="8.5" r="1.5" /><Path d="M21 15l-5-5L5 21" /></Svg>, title: 'Безлимитные воспоминания', desc: 'Фото и моменты без каких-либо ограничений' },
  { svg: <Svg {...S}><Path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" /><Polyline points="22,6 12,13 2,6" /></Svg>, title: 'Капсула времени', desc: 'Письма в будущее — откройте в нужный момент' },
  { svg: <Svg {...S}><Circle cx="12" cy="12" r="3" /><Path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></Svg>, title: 'Синхро-зеркало', desc: 'Вопросы и игры для лучшего понимания друг друга' },
  { svg: <Svg {...S}><Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><Polyline points="14 2 14 8 20 8" /><Line x1="16" y1="13" x2="8" y2="13" /><Line x1="16" y1="17" x2="8" y2="17" /><Polyline points="10 9 9 9 8 9" /></Svg>, title: 'Личный журнал', desc: 'Дневник настроения с ИИ-рефлексией' },
  { svg: <Svg {...S}><Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><Path d="M13.73 21a2 2 0 0 1-3.46 0" /></Svg>, title: 'Push-уведомления', desc: 'Мгновенные уведомления о сообщениях и датах' },
  { svg: <Svg {...S}><Rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><Line x1="16" y1="2" x2="16" y2="6" /><Line x1="8" y1="2" x2="8" y2="6" /><Line x1="3" y1="10" x2="21" y2="10" /></Svg>, title: 'Совместный календарь', desc: 'Планирование и напоминания о важных датах' },
];

const PLANS = [
  { id: 'premium', label: 'Месяц', price: '299', per: '299 ₽ в месяц', badge: null, saving: null },
  { id: 'premium_yearly', label: 'Год', price: '2 490', per: '207 ₽ в месяц', badge: 'Выгода 30%', saving: 'Экономия 1 098 ₽' },
];

export default function Premium() {
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState('premium_yearly');
  const [loadingPay, setLoadingPay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isPremium, afterPayment } = useSubscription();

  async function handleSubscribe() {
    setLoadingPay(true);
    setError(null);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const returnUrl = `${WEB_URL}/?tab=premium&payment=success`;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/yookassa?action=create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.access_token}` },
        body: JSON.stringify({ plan, returnUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.confirmation_url) throw new Error(data.error || 'Ошибка создания платежа');
      // Платёжная страница ЮKassa (в вебе — переход window.location.href)
      await WebBrowser.openBrowserAsync(data.confirmation_url);
      await afterPayment();
      setLoadingPay(false);
    } catch (e) {
      setError((e as Error).message);
      setLoadingPay(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 100 + 92 + insets.bottom }}>
      <View style={st.hero}>
        <LinearGradient {...cssLinear(170, [['#0C0B09', 0], ['#151210', 0.42], ['#1D1412', 1]])} style={StyleSheet.absoluteFill} />
        <Radials items={[{ x: 50, y: 0, color: 'rgba(155,40,62,0.16)', stop: 60 }, { x: 50, y: 100, color: 'rgba(81,21,32,0.08)', stop: 60 }]} />
        <View style={{ paddingTop: Math.max(64, insets.top + 20), paddingHorizontal: 24, paddingBottom: 48, alignItems: 'center' }}>
          <View style={st.crown}>
            <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="rgba(207,85,104,0.8)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </Svg>
          </View>
          <Text style={st.heroTitle} accessibilityRole="header">Любовь{'\n'}<Text style={{ color: colors.roseLight }}>без ограничений</Text></Text>
          <Text style={st.heroSub}>Одна подписка — для вас двоих</Text>
        </View>
      </View>

      {isPremium ? (
        <View style={st.active}>
          <View style={st.activeDot} />
          <Text style={{ fontSize: 14, fontFamily: fonts.bodyBold, color: '#1C7A3C' }}>Premium активен</Text>
        </View>
      ) : null}

      <View style={st.section}>
        <Text style={st.label}>ЧТО ВХОДИТ</Text>
        <View style={{ gap: 1 }}>
          {FEATURES.map((f, i) => (
            <View key={f.title} style={[st.feat, i === 0 && { borderTopLeftRadius: 14, borderTopRightRadius: 14 }, i === FEATURES.length - 1 && { borderBottomLeftRadius: 14, borderBottomRightRadius: 14, borderBottomWidth: 0 }]}>
              <View style={st.featIcon}>{f.svg}</View>
              <View style={{ flex: 1 }}>
                <Text style={st.featTitle}>{f.title}</Text>
                <Text style={st.featDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {!isPremium ? (
        <>
          <View style={st.divider}>
            <View style={st.divLine} /><Text style={st.divText}>ВЫБЕРИТЕ ПЛАН</Text><View style={st.divLine} />
          </View>
          <View style={st.plans}>
            {PLANS.map((p) => (
              <Pressable key={p.id} onPress={() => setPlan(p.id)} accessibilityRole="radio" accessibilityState={{ selected: plan === p.id }}
                style={[st.plan, plan === p.id && st.planSel]}>
                {p.badge ? <Text style={st.planBadge}>{p.badge.toUpperCase()}</Text> : null}
                <Text style={st.planLabel}>{p.label}</Text>
                <Text style={st.planPrice}><Text style={{ fontSize: 13 }}>₽</Text>{p.price}</Text>
                <Text style={st.planPer}>{p.per}</Text>
                {p.saving ? <Text style={st.planSave}>{p.saving}</Text> : null}
              </Pressable>
            ))}
          </View>
          {error ? <Text style={st.error}>{error}</Text> : null}
          <View style={{ paddingTop: 20, paddingHorizontal: 16 }}>
            <Pressable onPress={handleSubscribe} disabled={loadingPay} accessibilityRole="button"
              style={({ pressed }) => [st.btn, loadingPay && { opacity: 0.5, shadowOpacity: 0 }, pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 }]}>
              <Text style={st.btnText}>{loadingPay ? 'Переходим к оплате…' : 'Оформить Premium'}</Text>
            </Pressable>
          </View>
          <Text style={st.note}>Безопасная оплата · Карты, SberPay, СБП, ЮMoney{'\n'}Отменить подписку можно в любой момент</Text>
        </>
      ) : null}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  hero: { overflow: 'hidden' },
  crown: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(166,43,65,0.12)', borderWidth: 0.5, borderColor: 'rgba(166,43,65,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  heroTitle: { fontFamily: fonts.displayLightItalic, fontSize: 36, color: 'rgba(237,233,226,0.92)', lineHeight: 43, marginBottom: 10, textAlign: 'center' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.32)', letterSpacing: 0.3, fontFamily: fonts.bodyLight },
  active: { marginTop: 16, marginHorizontal: 16, backgroundColor: 'rgba(50,160,90,0.06)', borderWidth: 0.5, borderColor: 'rgba(50,160,90,0.2)', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#32C864' },
  section: { paddingTop: 28, paddingHorizontal: 16 },
  label: { fontSize: 10, fontFamily: fonts.bodyMedium, letterSpacing: 1.2, color: colors.textMuted, marginBottom: 14 },
  feat: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  featIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(168,40,60,0.07)', borderWidth: 0.5, borderColor: 'rgba(168,40,60,0.1)', alignItems: 'center', justifyContent: 'center' },
  featTitle: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.text, marginBottom: 2 },
  featDesc: { fontSize: 12, color: colors.textMuted, lineHeight: 17, fontFamily: fonts.bodyLight },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginTop: 24, marginBottom: 14 },
  divLine: { flex: 1, height: 0.5, backgroundColor: colors.border },
  divText: { fontSize: 10, color: colors.textMuted, letterSpacing: 1, fontFamily: fonts.body },
  plans: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10 },
  plan: { flex: 1, borderRadius: 16, paddingVertical: 20, paddingHorizontal: 12, borderWidth: 0.5, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
  planSel: { borderColor: ROSE, borderWidth: 1.5, backgroundColor: 'rgba(166,43,65,0.04)', shadowColor: ROSE, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  planBadge: { position: 'absolute', top: -10, alignSelf: 'center', backgroundColor: ROSE, color: 'white', fontSize: 9, fontFamily: fonts.bodySemi, letterSpacing: 0.5, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20, overflow: 'hidden' },
  planLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 8, fontFamily: fonts.body },
  planPrice: { fontFamily: fonts.displayRegular, fontSize: 28, color: colors.text, lineHeight: 30, marginBottom: 2 },
  planPer: { fontSize: 11, color: ROSE, marginTop: 5, fontFamily: fonts.body },
  planSave: { fontSize: 10, color: colors.textMuted, marginTop: 2, fontFamily: fonts.bodyLight },
  error: { marginTop: 12, marginHorizontal: 16, backgroundColor: 'rgba(200,30,30,0.06)', borderWidth: 0.5, borderColor: 'rgba(200,30,30,0.2)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, fontSize: 13, color: '#A03030', textAlign: 'center', overflow: 'hidden', fontFamily: fonts.body },
  btn: { width: '100%', padding: 16, borderRadius: 14, backgroundColor: ROSE, alignItems: 'center', shadowColor: ROSE, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  btnText: { fontSize: 15, fontFamily: fonts.bodyMedium, letterSpacing: 0.2, color: 'white' },
  note: { textAlign: 'center', fontSize: 11, color: colors.textMuted, marginTop: 14, lineHeight: 19, fontFamily: fonts.bodyLight },
});
