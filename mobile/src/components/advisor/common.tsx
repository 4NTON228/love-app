// Общие элементы раздела «Советник» (AIAdvisor.jsx и его подразделы).
// Подразделы рендерятся внутри .app.dark — значения CSS-переменных взяты оттуда.
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Spin } from '@/components/anim';
import { cssLinear } from '@/theme';

/** Переменные .app.dark */
export const V = {
  surface: '#1f0e16',
  surface2: '#2a1620',
  blush: '#160a10',
  ink: '#F3E8EC',
  inkMid: '#B79DA8',
  muted: '#8A7480',
  border: 'rgba(255,255,255,0.07)',
  rose: 'hsl(349, 59%, 41%)',
} as const;

/** var(--font-head, Georgia, serif): --font-head не задан → Georgia */
export const HEAD = Platform.select({ ios: 'Georgia', default: 'serif' })!;
export const HEAD_BOLD = Platform.select({ ios: 'Georgia-Bold', default: 'serif' })!;
export const HEAD_BOLD_ITALIC = Platform.select({ ios: 'Georgia-BoldItalic', default: 'serif' })!;
export const HEAD_ITALIC = Platform.select({ ios: 'Georgia-Italic', default: 'serif' })!;

export const cubicSpring = Easing.bezier(0.34, 1.56, 0.64, 1);
export const cubicOut = Easing.bezier(0.2, 1, 0.4, 1);

/** Блок с linear-gradient фоном */
export function Grad({ angle, stops, style, children }: {
  angle: number; stops: readonly (string | readonly [string, number])[]; style?: StyleProp<ViewStyle>; children?: ReactNode;
}) {
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <LinearGradient {...cssLinear(angle, stops)} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

/** Круг с radial-gradient(circle, color 0%, transparent N%) */
export function Orb({ size, color, stop = 70, style }: { size: number; color: string; stop?: number; style?: StyleProp<ViewStyle> }) {
  const m = /rgba?\(([^)]+)\)/.exec(color);
  const [r, g, b, a = '1'] = m ? m[1].split(',').map((x) => x.trim()) : ['0', '0', '0', '1'];
  const id = `orb${size}${r}${g}${b}`;
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={`rgb(${r},${g},${b})`} stopOpacity={Number(a)} />
            <Stop offset={stop / 100} stopColor={`rgb(${r},${g},${b})`} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Кольцо-спиннер (border + border-top-color, spin) */
export function Ring({ size = 48, width = 3, track = 'rgba(200,51,74,0.15)', color = '#C8334A', duration = 900 }: {
  size?: number; width?: number; track?: string; color?: string; duration?: number;
}) {
  return (
    <Spin duration={duration}>
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: width, borderColor: track, borderTopColor: color }} />
    </Spin>
  );
}

/** Анимация появления (keyframes from → to) один раз с задержкой */
export function useEnter(duration: number, delay = 0, easing: (v: number) => number = Easing.ease) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const a = Animated.timing(v, { toValue: 1, duration, delay, easing, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [v, duration, delay, easing]);
  return v;
}

/** Бесконечное «туда-обратно» (ease-in-out infinite, 0%/100% → 50%) */
export function usePingPong(duration: number, delay = 0) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const half = duration / 2;
    const ease = Easing.inOut(Easing.ease);
    const a = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: half, easing: ease, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: half, easing: ease, useNativeDriver: true }),
    ]));
    const t = setTimeout(() => a.start(), delay);
    return () => { clearTimeout(t); a.stop(); };
  }, [v, duration, delay]);
  return v;
}

/** Обёртка с анимацией появления: fade + сдвиг/масштаб */
export function Enter({ children, duration = 400, delay = 0, dx = 0, dy = 0, scale = 1, easing, style }: {
  children: ReactNode; duration?: number; delay?: number; dx?: number; dy?: number; scale?: number;
  easing?: (v: number) => number; style?: StyleProp<ViewStyle>;
}) {
  const v = useEnter(duration, delay, easing);
  const transform = [
    { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [dx, 0] }) },
    { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) },
    { scale: v.interpolate({ inputRange: [0, 1], outputRange: [scale, 1] }) },
  ];
  return <Animated.View style={[style, { opacity: v, transform }]}>{children}</Animated.View>;
}
