// Порт Contracts.jsx — договорённости пары с подписью партнёра (.ct-dark).
import { useCallback, useEffect, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { cubicOut, Enter, Grad, HEAD_BOLD, Orb, usePingPong } from '@/components/advisor/common';
import { useLoop } from '@/components/anim';
import { supabase } from '@/lib/supabase';
import { fonts } from '@/theme';

type IconP = { size?: number; color?: string };
const ScrollIcon = ({ size = 22, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><Polyline points="14 2 14 8 20 8" />
    <Line x1="16" y1="13" x2="8" y2="13" /><Line x1="16" y1="17" x2="8" y2="17" /><Polyline points="10 9 9 9 8 9" />
  </Svg>
);
const PlusIcon = ({ size = 18, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="12" y1="5" x2="12" y2="19" /><Line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);
const SignIcon = ({ size = 15, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 17c3-3 6-5 9-5s3 4 6 4 3-1 3-1" /><Path d="M3 17V7" />
  </Svg>
);
const CheckIcon = ({ size = 15, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="20 6 9 17 4 12" />
  </Svg>
);
const ClockIcon = ({ size = 13, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" /><Polyline points="12 6 12 12 16 14" />
  </Svg>
);
const TrashIcon = ({ size = 14, color = '#fff' }: IconP) => (
  <Svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="3 6 5 6 21 6" /><Path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><Path d="M10 11v6M14 11v6" /><Path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </Svg>
);

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Ожидает подписи', color: '#E8753A', bg: 'rgba(232,117,58,0.1)' },
  active: { label: 'Активен', color: '#2B8F50', bg: 'rgba(43,143,80,0.1)' },
  completed: { label: 'Завершён', color: '#2B8FD8', bg: 'rgba(43,143,216,0.1)' },
  violated: { label: 'Нарушен', color: '#C8334A', bg: 'rgba(200,51,74,0.1)' },
  cancelled: { label: 'Отменён', color: '#8899AA', bg: 'rgba(136,153,170,0.1)' },
};

const PERIOD_OPTIONS = [7, 14, 30, 60, 90];

const CONTRACT_SUGGESTIONS = [
  { title: 'Без телефона на свидании', condition: 'Убираем телефоны во время совместного ужина' },
  { title: 'Утреннее "доброе утро"', condition: 'Каждое утро говорим друг другу "доброе утро" — лично или в сообщении' },
  { title: 'Один вечер без гаджетов', condition: 'Раз в неделю проводим вечер без телефонов и компьютеров' },
  { title: 'Выражать благодарность', condition: 'Каждый день говорим одно конкретное "спасибо" партнёру' },
  { title: 'Не критиковать публично', condition: 'Никогда не критикуем друг друга при других людях' },
];

const BLUE = '#2B64D8';
const BLUE_L = '#5B9BFF';
const META = 'rgba(245,230,235,0.35)';

function daysLeft(expiresAt: string | null, now: number) {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 86400000));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

type Contract = {
  id: string; creator_id: string; partner_id: string; title: string; condition: string; consequence: string | null;
  period_days: number; status: string; signed_by_creator: boolean; signed_by_partner: boolean; expires_at: string | null; created_at: string;
};

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

function Field({ label, focusKey, focus, setFocus, multiline, ...rest }: {
  label: string; focusKey: string; focus: string | null; setFocus: (k: string | null) => void; multiline?: boolean;
  value: string; onChangeText: (t: string) => void; placeholder: string;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label.toUpperCase()}</Text>
      <TextInput {...rest} multiline={multiline} placeholderTextColor="rgba(245,230,235,0.35)" selectionColor={BLUE}
        onFocus={() => setFocus(focusKey)} onBlur={() => setFocus(null)}
        style={[s.input, multiline && { minHeight: 70, lineHeight: 21, textAlignVertical: 'top' }, focus === focusKey && { borderColor: BLUE }]} />
    </View>
  );
}

function Sig({ label, signed }: { label: string; signed: boolean }) {
  return (
    <View style={s.sig}>
      <Text style={s.sigLabel}>{label}</Text>
      {signed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <CheckIcon size={13} color="#2B8F50" /><Text style={s.sigSigned}> Подписал</Text>
        </View>
      ) : <Text style={s.sigPending}>Ожидает</Text>}
    </View>
  );
}

export function Contracts({ uid, partnerId }: { uid: string; partnerId: string | null | undefined }) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noPartner, setNoPartner] = useState(false);
  const [form, setForm] = useState({ title: '', condition: '', consequence: '', period_days: 30 });
  const [focus, setFocus] = useState<string | null>(null);
  const [btnW, setBtnW] = useState(0);
  const [now] = useState(() => Date.now());
  const float1 = usePingPong(8000);
  const float2 = usePingPong(11000);
  const pulse = usePingPong(2000);

  const loadContracts = useCallback(async () => {
    setLoading(true);
    if (!partnerId) {
      setNoPartner(true);
      setLoading(false);
      return;
    }
    const { data } = await supabase.from('contracts').select('*')
      .or(`creator_id.eq.${uid},partner_id.eq.${uid}`).order('created_at', { ascending: false });
    setContracts((data as Contract[]) ?? []);
    setLoading(false);
  }, [partnerId, uid]);

  useEffect(() => {
    (async () => { await loadContracts(); })();
  }, [loadContracts]);

  async function createContract() {
    if (!form.title.trim() || !form.condition.trim() || saving) return;
    if (!partnerId) return;
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase.from('contracts').insert({
      creator_id: uid, partner_id: partnerId,
      title: form.title.trim(), condition: form.condition.trim(), consequence: form.consequence.trim() || null,
      period_days: form.period_days, status: 'pending', signed_by_creator: true, signed_by_partner: false,
    }).select().single();
    if (err) {
      setError('Не удалось создать контракт. Попробуй снова.');
    } else if (data) {
      setContracts((prev) => [data as Contract, ...prev]);
      setCreating(false);
      setForm({ title: '', condition: '', consequence: '', period_days: 30 });
    }
    setSaving(false);
  }

  async function signContract(contractId: string) {
    // RPC: статус и expires_at выставляются атомарно на сервере
    const { error: err } = await supabase.rpc('sign_contract', { contract_id: contractId });
    if (err) {
      setError('Не удалось подписать контракт — попробуй снова');
      return;
    }
    const { data: updated } = await supabase.from('contracts').select('*').eq('id', contractId).single();
    if (updated) setContracts((prev) => prev.map((c) => (c.id === contractId ? (updated as Contract) : c)));
  }

  async function cancelContract(contractId: string) {
    const { data } = await supabase.from('contracts').update({ status: 'cancelled' }).eq('id', contractId).select().single();
    if (data) setContracts((prev) => prev.map((c) => (c.id === contractId ? (data as Contract) : c)));
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

  const submitDisabled = !form.title.trim() || !form.condition.trim() || saving;

  return (
    <View>
      {/* Hero */}
      <Grad angle={150} stops={[['#0D1A30', 0], ['#1A2F50', 0.5], ['#0A0206', 1]]} style={s.hero}>
        <Animated.View style={[{ position: 'absolute', top: -30, right: -20 }, orb1]}><Orb size={160} color="rgba(43,100,216,0.5)" style={{ position: 'relative' }} /></Animated.View>
        <Animated.View style={[{ position: 'absolute', bottom: -20, left: 10 }, orb2]}><Orb size={110} color="rgba(139,26,44,0.3)" style={{ position: 'relative' }} /></Animated.View>
        <View style={s.badge}>
          <Animated.View style={[s.badgeDot, {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }) }],
          }]} />
          <Text style={s.badgeText}>СОВМЕСТНЫЕ ОБЯЗАТЕЛЬСТВА</Text>
        </View>
        <Text style={s.heroTitle}>Контракты пары</Text>
        <Text style={s.heroSub}>Создайте договорённости и отслеживайте{'\n'}их выполнение вместе</Text>
      </Grad>

      {noPartner ? (
        <View style={s.noPartner}>
          <Text style={s.noPartnerText}>Для создания контрактов нужно{'\n'}связать аккаунты с партнёром в Настройках.</Text>
        </View>
      ) : (
        <>
          {!creating ? (
            <Pressable onPress={() => setCreating(true)} onLayout={(e) => setBtnW(e.nativeEvent.layout.width)} accessibilityRole="button"
              style={({ pressed }) => [s.newBtn, pressed && { transform: [{ scale: 0.96 }] }]}>
              <Grad angle={135} stops={[BLUE, '#0D2A5A']} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
              {btnW > 0 ? <ShimmerBand width={btnW} /> : null}
              <PlusIcon size={18} />
              <Text style={s.newText}>Создать контракт</Text>
            </Pressable>
          ) : (
            <Enter duration={300} dy={-12} easing={cubicOut} style={s.form}>
              <Text style={s.formTitle}>Новый контракт</Text>

              <Text style={s.label}>ШАБЛОНЫ</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {CONTRACT_SUGGESTIONS.map((sg) => (
                  <Pressable key={sg.title} onPress={() => setForm((f) => ({ ...f, title: sg.title, condition: sg.condition }))} accessibilityRole="button"
                    style={({ pressed }) => [s.chip, pressed && { backgroundColor: 'rgba(43,100,216,0.15)' }]}>
                    <Text style={s.chipText}>{sg.title}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Field label="Название" focusKey="title" focus={focus} setFocus={setFocus} placeholder="Например: утренние обнимашки"
                value={form.title} onChangeText={(t) => setForm((f) => ({ ...f, title: t }))} />
              <Field label="Условие" focusKey="cond" focus={focus} setFocus={setFocus} multiline placeholder="Что конкретно обязуемся делать..."
                value={form.condition} onChangeText={(t) => setForm((f) => ({ ...f, condition: t }))} />
              <Field label="Последствие за нарушение (необязательно)" focusKey="cons" focus={focus} setFocus={setFocus} placeholder="Например: готовит ужин на этой неделе"
                value={form.consequence} onChangeText={(t) => setForm((f) => ({ ...f, consequence: t }))} />

              <View style={{ marginBottom: 12 }}>
                <Text style={s.label}>СРОК ДЕЙСТВИЯ</Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {PERIOD_OPTIONS.map((d) => {
                    const active = form.period_days === d;
                    return (
                      <Pressable key={d} onPress={() => setForm((f) => ({ ...f, period_days: d }))} accessibilityRole="radio" accessibilityState={{ selected: active }}
                        style={[s.periodBtn, active && { borderColor: 'transparent' }]}>
                        {active ? <Grad angle={135} stops={[BLUE, '#0D2A5A']} style={[StyleSheet.absoluteFill, { borderRadius: 10 }]} /> : null}
                        <Text style={[s.periodText, active && { color: '#FFFFFF' }]}>{d} дн</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {error ? <View style={s.error}><Text style={s.errorText}>{error}</Text></View> : null}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <Pressable onPress={() => { setCreating(false); setError(null); }} style={s.cancelBtn} accessibilityRole="button">
                  <Text style={s.cancelText}>Отмена</Text>
                </Pressable>
                <Pressable onPress={createContract} disabled={submitDisabled} accessibilityRole="button" style={[s.submitBtn, submitDisabled && { opacity: 0.5 }]}>
                  <Grad angle={135} stops={[BLUE, '#0D2A5A']} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
                  <Text style={s.submitText}>{saving ? 'Создаю...' : 'Отправить партнёру'}</Text>
                </Pressable>
              </View>
            </Enter>
          )}

          <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            {contracts.length > 0 ? (
              <Text style={s.sectionLabel}>{contracts.length} {contracts.length === 1 ? 'КОНТРАКТ' : 'КОНТРАКТА/ОВ'}</Text>
            ) : null}

            {loading ? (
              <View style={{ padding: 32, alignItems: 'center', opacity: 0.4 }}><ScrollIcon size={28} color="#F5E6EB" /></View>
            ) : contracts.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
                <View style={{ marginBottom: 12, opacity: 0.4 }}><ScrollIcon size={36} color="rgba(245,230,235,0.3)" /></View>
                <Text style={s.emptyText}>Нет контрактов.{'\n'}Создайте первое совместное обязательство.</Text>
              </View>
            ) : (
              contracts.map((c, i) => {
                const isCreator = c.creator_id === uid;
                const isPartner = c.partner_id === uid;
                const statusCfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.pending;
                const isExpanded = expandedId === c.id;
                const days = daysLeft(c.expires_at, now);
                const totalDays = c.period_days;
                const pct = days != null && totalDays > 0 ? Math.round((days / totalDays) * 100) : null;
                const canSign = isPartner && !c.signed_by_partner && c.status === 'pending';
                const canCancel = isCreator && c.status !== 'cancelled' && c.status !== 'completed';

                return (
                  <Enter key={c.id} duration={350} delay={i * 50} dy={10} easing={cubicOut}>
                    <Pressable onPress={() => setExpandedId(isExpanded ? null : c.id)} accessibilityRole="button"
                      style={({ pressed }) => [s.card, pressed && { transform: [{ scale: 0.98 }] }]}>
                      <View style={s.cardHeader}>
                        <Text style={s.cardTitle}>{c.title}</Text>
                        <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
                          <Text style={[s.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                        </View>
                      </View>

                      <Text style={s.condition}>{c.condition}</Text>

                      <View style={s.meta}>
                        <View style={s.metaItem}><ClockIcon size={12} color={META} /><Text style={s.metaText}>{c.period_days} дней</Text></View>
                        {c.expires_at && c.status === 'active' ? <View style={s.metaItem}><Text style={s.metaText}>истекает {formatDate(c.expires_at)}</Text></View> : null}
                        <View style={s.metaItem}><Text style={s.metaText}>с {formatDate(c.created_at)}</Text></View>
                      </View>

                      {c.status === 'active' && pct != null ? (
                        <View style={{ marginTop: 10 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={s.metaText}>Осталось</Text>
                            <Text style={s.metaText}>{days} дн</Text>
                          </View>
                          <View style={s.track}>
                            <Grad angle={90} stops={[BLUE, '#4CA0FF']} style={{ height: '100%', borderRadius: 2, width: `${pct}%` }} />
                          </View>
                        </View>
                      ) : null}

                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                        <Sig label="Инициатор" signed={c.signed_by_creator} />
                        <Sig label="Партнёр" signed={c.signed_by_partner} />
                      </View>

                      {isExpanded && (canSign || canCancel) ? (
                        <Enter duration={250} dy={-12} easing={cubicOut} style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
                          {canSign ? (
                            <Pressable onPress={() => signContract(c.id)} style={s.signBtn} accessibilityRole="button">
                              <Grad angle={135} stops={['#2B8F50', '#1A4A2E']} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
                              <SignIcon size={14} />
                              <Text style={s.signText}>Подписать контракт</Text>
                            </Pressable>
                          ) : null}
                          {canCancel ? (
                            <Pressable onPress={() => cancelContract(c.id)} style={s.cancelContractBtn} accessibilityRole="button">
                              <TrashIcon size={13} color="#C8334A" />
                              <Text style={s.cancelContractText}>Отменить</Text>
                            </Pressable>
                          ) : null}
                        </Enter>
                      ) : null}
                    </Pressable>
                  </Enter>
                );
              })
            )}
          </View>
        </>
      )}
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
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BLUE_L },
  badgeText: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.8, color: 'rgba(255,255,255,0.8)' },
  heroTitle: { fontFamily: HEAD_BOLD, fontSize: 28, color: '#FFFFFF', lineHeight: 33.6, marginBottom: 8 },
  heroSub: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 19.5 },
  newBtn: {
    margin: 16, padding: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden',
    shadowColor: BLUE, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  newText: { fontFamily: fonts.bodySemi, fontSize: 15, color: '#FFFFFF' },
  form: { margin: 16, backgroundColor: '#0D1A30', borderRadius: 20, padding: 20 },
  formTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: BLUE_L, marginBottom: 16 },
  label: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.5, color: 'rgba(245,230,235,0.4)', marginBottom: 6 },
  input: {
    borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(91,155,255,0.2)', backgroundColor: 'rgba(43,100,216,0.07)',
    paddingVertical: 10, paddingHorizontal: 12, fontFamily: fonts.body, fontSize: 14, color: '#F5E6EB',
  },
  chip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1.5, borderColor: 'rgba(91,155,255,0.2)', backgroundColor: 'rgba(91,155,255,0.08)' },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: '#F5E6EB' },
  periodBtn: {
    flexGrow: 1, flexBasis: 44, minWidth: 44, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'rgba(91,155,255,0.2)', alignItems: 'center', overflow: 'hidden',
  },
  periodText: { fontFamily: fonts.bodySemi, fontSize: 12, color: '#F5E6EB' },
  error: {
    marginBottom: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
    backgroundColor: 'rgba(200,51,74,0.08)', borderWidth: 1, borderColor: 'rgba(200,51,74,0.2)',
  },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: '#C8334A' },
  cancelBtn: { flex: 1, padding: 11, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(43,100,216,0.25)', alignItems: 'center' },
  cancelText: { fontFamily: fonts.bodySemi, fontSize: 14, color: BLUE_L },
  submitBtn: { flex: 2, padding: 11, borderRadius: 12, alignItems: 'center' },
  submitText: { fontFamily: fonts.bodySemi, fontSize: 14, color: '#FFFFFF' },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.8, color: BLUE_L, marginBottom: 12 },
  card: { backgroundColor: '#0D1A30', borderRadius: 18, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  cardTitle: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: '#F5E6EB', lineHeight: 19.5 },
  statusBadge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 99 },
  statusText: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.4 },
  condition: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20.15, color: 'rgba(245,230,235,0.6)', marginBottom: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontFamily: fonts.body, fontSize: 11, color: META },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(43,100,216,0.1)', overflow: 'hidden' },
  sig: {
    flex: 1, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(91,155,255,0.15)', backgroundColor: 'rgba(91,155,255,0.06)',
    alignItems: 'center', gap: 4,
  },
  sigLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: 'rgba(245,230,235,0.4)' },
  sigSigned: { fontFamily: fonts.bodyBold, fontSize: 11, color: '#2B8F50' },
  sigPending: { fontFamily: fonts.bodySemi, fontSize: 11, color: '#E8753A' },
  signBtn: {
    flex: 2, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    shadowColor: '#2B8F50', shadowOpacity: 0.3, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  signText: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#FFFFFF' },
  cancelContractBtn: {
    flex: 1, padding: 10, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(200,51,74,0.25)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  cancelContractText: { fontFamily: fonts.bodySemi, fontSize: 12, color: '#C8334A' },
  emptyText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: 'rgba(245,230,235,0.3)', textAlign: 'center' },
  noPartner: {
    marginVertical: 24, marginHorizontal: 16, padding: 20, borderRadius: 16,
    backgroundColor: 'rgba(91,155,255,0.08)', borderWidth: 1, borderColor: 'rgba(43,100,216,0.15)',
  },
  noPartnerText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22.4, color: 'rgba(245,230,235,0.6)', textAlign: 'center' },
});
