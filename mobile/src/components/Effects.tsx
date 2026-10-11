// Эффекты из Home.jsx / Home.css: HeartWave, Confetti, HeartsBackground,
// блик cardSweep и размытые пятна blobDrift.
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { parseRgba } from '@/components/Backgrounds';
import { useLoop } from '@/components/anim';

/* ── HeartWave — 16 сердец поднимаются на весь экран ── */
function WaveHeart({ left, delay, dur, size, h }: { left: number; delay: number; dur: number; size: number; h: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: dur * 1000, delay: delay * 1000, easing: Easing.in(Easing.ease), useNativeDriver: true }).start();
  }, [v, dur, delay]);
  return (
    <Animated.Text style={[styles.waveHeart, {
      left: `${left}%`, fontSize: size,
      opacity: v.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }),
      transform: [
        { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -1.05 * h] }) },
        { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.1] }) },
        { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '20deg'] }) },
      ],
    }]}>♥</Animated.Text>
  );
}

export function HeartWave() {
  const { height } = useWindowDimensions();
  const hearts = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 0.5, dur: 1.7 + Math.random() * 1.3, size: 16 + Math.random() * 28,
  })), []);
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent>
      <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
        {hearts.map((h) => <WaveHeart key={h.id} {...h} h={height} />)}
      </View>
    </Modal>
  );
}

/* ── Confetti — 60 кусочков падают (годовщина) ── */
const CONF_COLORS = ['#ffd76a', '#ff8da0', '#ffffff', '#d8456b', '#ffb3c1'];
function Piece({ left, delay, dur, size, rot, color, h }: { left: number; delay: number; dur: number; size: number; rot: number; color: string; h: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: dur * 1000, delay: delay * 1000, easing: Easing.linear, useNativeDriver: true }).start();
  }, [v, dur, delay]);
  return (
    <Animated.View style={{
      position: 'absolute', top: -24, left: `${left}%`, width: size, height: size * 1.4, backgroundColor: color, borderRadius: 2,
      opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
      transform: [
        { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-10, 1.08 * h] }) },
        { rotate: v.interpolate({ inputRange: [0, 1], outputRange: [`${rot}deg`, `${rot + 540}deg`] }) },
      ],
    }} />
  );
}

export function Confetti() {
  const { height } = useWindowDimensions();
  const pieces = useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 1.2, dur: 2.4 + Math.random() * 2.2,
    size: 7 + Math.random() * 8, rot: Math.random() * 360, color: CONF_COLORS[i % 5],
  })), []);
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {pieces.map((p) => <Piece key={p.id} {...p} h={height} />)}
      </View>
    </Modal>
  );
}

/* ── HeartsBackground — 8 сердечек всплывают в фоне главной ── */
const HEART_CONFIGS = [
  { left: 6, size: 9, dur: 16, delay: 0, r: -12, op: 0.12 },
  { left: 17, size: 13, dur: 11, delay: 2.5, r: 8, op: 0.10 },
  { left: 29, size: 7, dur: 20, delay: 5, r: -19, op: 0.08 },
  { left: 44, size: 11, dur: 14, delay: 1, r: 14, op: 0.11 },
  { left: 59, size: 8, dur: 22, delay: 7.5, r: -8, op: 0.09 },
  { left: 73, size: 12, dur: 13, delay: 4, r: 20, op: 0.12 },
  { left: 86, size: 6, dur: 18, delay: 9, r: -24, op: 0.08 },
  { left: 94, size: 10, dur: 15, delay: 3, r: 11, op: 0.10 },
];

function Particle({ left, size, dur, delay, r, op, h }: (typeof HEART_CONFIGS)[number] & { h: number }) {
  const v = useLoop(dur * 1000, delay * 1000, Easing.in(Easing.ease));
  return (
    <Animated.Text style={{
      position: 'absolute', bottom: -10, left: `${left}%`, fontSize: size, lineHeight: size * 1.1, color: '#fff',
      opacity: v.interpolate({ inputRange: [0, 0.08, 0.88, 1], outputRange: [0, op, op, 0] }),
      transform: [
        { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -h] }) },
        { rotate: v.interpolate({ inputRange: [0, 1], outputRange: [`${r}deg`, `${r + 22}deg`] }) },
      ],
    }}>♥</Animated.Text>
  );
}

export function HeartsBackground() {
  const { height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} accessibilityElementsHidden>
      {HEART_CONFIGS.map((c, i) => <Particle key={i} {...c} h={height} />)}
    </View>
  );
}

/* ── cardSweep — диагональный блик по карточке ── */
export function Shine({ width, fraction = 0.5, duration = 8000, startLeft = -0.4 }: { width: number; fraction?: number; duration?: number; startLeft?: number }) {
  const v = useLoop(duration, 0, Easing.inOut(Easing.ease));
  if (!width) return null;
  const w = width * fraction;
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', top: 0, bottom: 0, left: width * startLeft, width: w,
      opacity: v.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 1], outputRange: [0, 0, 1, 0, 0] }),
      transform: [
        { translateX: v.interpolate({ inputRange: [0, 0.6, 0.6001, 1], outputRange: [-1.6 * w, 3.4 * w, -1.6 * w, -1.6 * w] }) },
        { skewX: '-18deg' },
      ],
    }}>
      <LinearGradient colors={['transparent', 'rgba(255,255,255,0.22)', 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

/* ── Размытое пятно (filter: blur(70px)) + blobDrift ── */
export function Blob({ style, size, color, duration, reverse }: {
  style: object; size: number; color: string; duration: number; reverse?: boolean;
}) {
  const v = useLoop(duration, 0, Easing.inOut(Easing.ease));
  const span = reverse ? [1, 0.5, 0] : [0, 0.5, 1];
  const p = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: span });
  const big = size * 1.8; // размытие расширяет пятно
  const { rgb, a } = parseRgba(color);
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: big, height: big, marginLeft: -(big - size) / 2, marginTop: -(big - size) / 2 }, style, {
      transform: [
        { translateX: p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 10, 0] }) },
        { translateY: p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -8, 0] }) },
        { scale: p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.04, 1] }) },
      ],
    }]}>
      <Svg width={big} height={big}>
        <Defs>
          <RadialGradient id="b" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={rgb} stopOpacity={a} />
            <Stop offset="0.45" stopColor={rgb} stopOpacity={a * 0.6} />
            <Stop offset="1" stopColor={rgb} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={big} height={big} fill="url(#b)" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  waveHeart: {
    position: 'absolute', bottom: -40, color: '#ff5c7a',
    textShadowColor: 'rgba(255,92,122,0.5)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 4 },
  },
});

