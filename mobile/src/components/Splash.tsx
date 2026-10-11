// Порт сплэша из App.jsx: бьющееся сердце, «Love App» курсивом, бегущая полоска.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { CssBackground } from '@/components/Backgrounds';
import { beatScale, easeOut, useLoop } from '@/components/anim';
import { SplashHeart } from '@/components/icons';
import { fonts } from '@/theme';

export function Splash() {
  const beat = useLoop(1400, 0, Easing.inOut(Easing.ease));
  const slide = useLoop(1300, 0, Easing.inOut(Easing.ease));
  const [word] = useState(() => new Animated.Value(0));
  const [bar] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(word, { toValue: 1, duration: 900, delay: 150, easing: easeOut, useNativeDriver: true }).start();
    Animated.timing(bar, { toValue: 1, duration: 900, delay: 300, easing: easeOut, useNativeDriver: true }).start();
  }, [word, bar]);

  const up = (v: Animated.Value) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] });
  const glow = beat.interpolate({ inputRange: [0, 0.22, 1], outputRange: [0.5, 1, 0.5] });

  return (
    <View style={styles.root} accessibilityLabel="Love App загружается">
      <CssBackground angle={165} stops={[['#3d1838', 0], ['#6a2747', 0.28], ['#9a3c50', 0.56], ['#bd5552', 0.8], ['#cb6650', 1]]}
        radials={[{ x: 82, y: 8, color: 'rgba(255,214,150,0.22)', stop: 42 }, { x: 12, y: 94, color: 'rgba(60,20,45,0.55)', stop: 52 }]} />
      <View style={styles.heartWrap}>
        <Animated.View style={[styles.glow, { opacity: glow, transform: [{ scale: glow.interpolate({ inputRange: [0.5, 1], outputRange: [0.9, 1.1] }) }] }]} />
        <Animated.View style={{ transform: [{ scale: beatScale(beat, 1.16, 1.1) }] }}>
          <SplashHeart size={84} />
        </Animated.View>
      </View>
      <Animated.Text style={[styles.word, up(word)]}>Love App</Animated.Text>
      <Animated.View style={[styles.bar, { opacity: bar }]}>
        <Animated.View style={[styles.barFill, { transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-62, 158] }) }] }]}>
          <LinearGradient colors={['transparent', '#ffe7a8', '#fff', 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 26, overflow: 'hidden', zIndex: 9999 },
  heartWrap: { width: 84, height: 78, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 151, height: 140, borderRadius: 80, backgroundColor: 'rgba(255,200,170,0.25)' },
  word: {
    fontFamily: fonts.displayItalic, fontSize: 34, letterSpacing: 1.5, color: '#fff',
    textShadowColor: 'rgba(120,20,50,0.4)', textShadowRadius: 20, textShadowOffset: { width: 0, height: 2 },
  },
  bar: { width: 120, height: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  barFill: { width: 48, height: '100%', borderRadius: 999, overflow: 'hidden' },
});
