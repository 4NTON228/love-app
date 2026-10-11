// Порт toast из src/lib/helpers.js: снизу по центру, 3 секунды, те же цвета.
// API тот же: toast.success('…') / toast.error('…') / toast.info('…')
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { fonts } from '@/theme';

type Kind = 'success' | 'error' | 'info';
type Item = { id: number; message: string; kind: Kind };

const BG: Record<Kind, string> = { success: '#22c55e', error: '#ef4444', info: '#C8334A' };

let push: ((m: string, k: Kind) => void) | null = null;
let seq = 0;

export const toast = {
  success: (msg: string) => push?.(msg, 'success'),
  error: (msg: string) => push?.(msg, 'error'),
  info: (msg: string) => push?.(msg, 'info'),
};

function ToastItem({ item, onDone }: { item: Item; onDone: (id: number) => void }) {
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onDone(item.id));
    }, 3000);
    return () => clearTimeout(t);
  }, [opacity, item.id, onDone]);
  return (
    <Animated.View style={[styles.toast, { backgroundColor: BG[item.kind], opacity }]} accessibilityLiveRegion="polite">
      <Text numberOfLines={1} style={styles.text}>{item.message}</Text>
    </Animated.View>
  );
}

export function ToastHost() {
  const [items, setItems] = useState<Item[]>([]);
  const remove = useRef((id: number) => setItems((l) => l.filter((x) => x.id !== id))).current;
  useEffect(() => {
    push = (message, kind) => setItems((l) => [...l, { id: ++seq, message, kind }]);
    return () => { push = null; };
  }, []);
  return (
    <View pointerEvents="none" style={styles.container}>
      {items.map((it) => <ToastItem key={it.id} item={it} onDone={remove} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: 80, left: 0, right: 0, alignItems: 'center', gap: 8, zIndex: 99999 },
  toast: {
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 14, maxWidth: '80%',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  text: { color: 'white', fontSize: 14, fontFamily: fonts.bodyMedium },
});
