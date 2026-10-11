// CSS-фоны веба: linear-gradient + radial-gradient(circle at X% Y%, color, transparent N%).
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { cssLinear } from '@/theme';

export type Radial = { x: number; y: number; color: string; stop: number }; // x,y,stop в %

export function parseRgba(c: string): { rgb: string; a: number } {
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (!m) return { rgb: c, a: 1 };
  const [r, g, b, a = '1'] = m[1].split(',').map((s) => s.trim());
  return { rgb: `rgb(${r},${g},${b})`, a: Number(a) };
}

/** Набор radial-gradient поверх фона (как в CSS: circle, farthest-corner). */
export function Radials({ items }: { items: Radial[] }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h}>
          <Defs>
            {items.map((it, i) => {
              const cx = (it.x / 100) * size.w, cy = (it.y / 100) * size.h;
              const far = Math.max(
                Math.hypot(cx, cy), Math.hypot(size.w - cx, cy), Math.hypot(cx, size.h - cy), Math.hypot(size.w - cx, size.h - cy),
              );
              const { rgb, a } = parseRgba(it.color);
              return (
                <RadialGradient key={i} id={`rg${i}`} cx={cx} cy={cy} r={far} gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={rgb} stopOpacity={a} />
                  <Stop offset={it.stop / 100} stopColor={rgb} stopOpacity={0} />
                </RadialGradient>
              );
            })}
          </Defs>
          {items.map((_, i) => <Rect key={i} x="0" y="0" width={size.w} height={size.h} fill={`url(#rg${i})`} />)}
        </Svg>
      ) : null}
    </View>
  );
}

/** linear-gradient(angle, stops) на весь контейнер + радиальные пятна сверху */
export function CssBackground({ angle, stops, radials = [], style }: {
  angle: number; stops: readonly (string | readonly [string, number])[]; radials?: Radial[]; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <LinearGradient {...cssLinear(angle, stops)} style={StyleSheet.absoluteFill} />
      {radials.length ? <Radials items={radials} /> : null}
    </View>
  );
}

/** Фон главной и сплэша (Home.css .home-screen / App.jsx .splash-screen) */
export const SUNSET_STOPS = [['#3d1838', 0], ['#6a2747', 0.26], ['#9a3c50', 0.52], ['#bd5552', 0.76], ['#cb6650', 1]] as const;
