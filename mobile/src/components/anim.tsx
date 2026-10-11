// Анимации из CSS веб-версии, перенесённые на Animated (нативный драйвер).
import { type ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

// cubic-bezier(0.22,1,0.36,1) — основная кривая веба
export const easeOut = Easing.bezier(0.22, 1, 0.36, 1);

/** @keyframes sectionReveal / fadeInUp: opacity 0→1, translateY(dy→0) */
export function Reveal({ children, delay = 0, duration = 500, dy = 14, style }: {
  children: ReactNode; delay?: number; duration?: number; dy?: number; style?: StyleProp<ViewStyle>;
}) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [v, delay, duration]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** .tab-anim — tabFadeIn 0.22s: opacity, translateY(8px), scale(0.99) */
export function TabFade({ children }: { children: ReactNode }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 220, easing: easeOut, useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View style={{
      flex: 1, opacity: v,
      transform: [
        { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
        { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.99, 1] }) },
      ],
    }}>
      {children}
    </Animated.View>
  );
}

/** Бесконечная анимация 0→1 (для keyframes вида infinite) */
export function useLoop(duration: number, delay = 0, easing = Easing.linear) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.loop(Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: true }));
    const t = setTimeout(() => anim.start(), delay);
    return () => { clearTimeout(t); anim.stop(); };
  }, [v, duration, delay, easing]);
  return v;
}

/** Пульс сердца (thinkBeat/lsBeat/splashBeat): 0%,100% → 1; peak на 18% → s */
export function beatScale(v: Animated.Value, peak = 1.28, second?: number) {
  return second
    ? v.interpolate({ inputRange: [0, 0.15, 0.3, 0.45, 1], outputRange: [1, peak, 1, second, 1] })
    : v.interpolate({ inputRange: [0, 0.18, 0.36, 1], outputRange: [1, peak, 1, 1] });
}

/** Спиннер (loaderSpin) */
export function Spin({ children, duration = 900 }: { children: ReactNode; duration?: number }) {
  const v = useLoop(duration);
  return <Animated.View style={{ transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>{children}</Animated.View>;
}
