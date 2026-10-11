// Порт Navigation.jsx: плавающий док с увеличением иконок под пальцем.
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { type ComponentType, useState } from 'react';
import { type GestureResponderEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { ICalendar, ICamera, IChat, IHome, IPerson, IPlans } from '@/components/icons';
import { tap } from '@/lib/haptics';
import { cssLinear, fonts } from '@/theme';

const ITEMS: { id: string; label: string; Icon: ComponentType<{ size?: number; color?: string }> }[] = [
  { id: 'index', label: 'Главная', Icon: IHome },
  { id: 'chat', label: 'Чат', Icon: IChat },
  { id: 'moments', label: 'Фото', Icon: ICamera },
  { id: 'calendar', label: 'Дни', Icon: ICalendar },
  { id: 'plans', label: 'Планы', Icon: IPlans },
  { id: 'settings', label: 'Профиль', Icon: IPerson },
];

// Разделы внутри «Профиля» — подсвечиваем Профиль
const EXTRA = ['advisor', 'premium', 'mirror'];

const MAX = 1.4;       // пик увеличения
const INFLUENCE = 70;  // радиус влияния, px
const RISE = 14;       // подъём иконки на пике, px
const ITEM_W = 48, GAP = 2, PAD_X = 8;
const BASE = ITEMS.map(() => 1);

export function Dock({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [scales, setScales] = useState(BASE);
  const routeName = state.routes[state.index]?.name ?? 'index';
  const current = EXTRA.includes(routeName) ? 'settings' : routeName;
  const keyboard = useKeyboardVisible();

  function magnify(e: GestureResponderEvent) {
    const x = e.nativeEvent.locationX;
    setScales(ITEMS.map((_, i) => {
      const c = PAD_X + i * (ITEM_W + GAP) + ITEM_W / 2;
      const t = Math.max(0, 1 - Math.abs(x - c) / INFLUENCE);
      return 1 + (MAX - 1) * t;
    }));
  }
  const clear = () => setScales(BASE);

  function pick(id: string) {
    tap();
    clear();
    navigation.navigate(id as never);
  }

  if (keyboard) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 10 }]}>
      <View style={styles.dock} onTouchStart={magnify} onTouchMove={magnify} onTouchEnd={clear} onTouchCancel={clear}>
        {/* фон отдельным слоем: сам док не обрезает поднятые иконки */}
        <View style={styles.glass}>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(24,12,18,0.66)' }]} />
        </View>
        {ITEMS.map(({ id, label, Icon }, i) => {
          const active = current === id;
          const s = scales[i] ?? 1;
          const lift = s > 1.001 ? -(s - 1) * RISE : active ? -2 : 0;
          const scale = s > 1.001 ? s : active ? 1.06 : 1;
          const color = active ? '#ff8da0' : 'rgba(235,235,245,0.5)';
          return (
            <Pressable key={id} onPress={() => pick(id)} accessibilityRole="tab" accessibilityLabel={label}
              accessibilityState={{ selected: active }} style={styles.item}>
              <View style={[styles.ic, { transform: [{ translateY: lift }, { scale }] }]}>
                {active ? <LinearGradient {...cssLinear(160, ['rgba(255,141,160,0.22)', 'rgba(216,69,107,0.14)'])} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} /> : null}
                <Icon size={22} color={color} />
              </View>
              <Text style={[styles.label, active && { color: '#ff8da0' }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 50 },
  dock: {
    flexDirection: 'row', alignItems: 'flex-end', gap: GAP, paddingVertical: 7, paddingHorizontal: PAD_X,
    borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 19, shadowOffset: { width: 0, height: 14 }, elevation: 12,
  },
  glass: { ...StyleSheet.absoluteFill, borderRadius: 21, overflow: 'hidden' },
  item: { width: ITEM_W, alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  ic: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.bodySemi, fontSize: 9, lineHeight: 11, letterSpacing: 0.1, color: 'rgba(235,235,245,0.45)' },
});
