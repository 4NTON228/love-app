// Базовые компоненты в едином стиле. Все интерактивные элементы — Pressable
// с accessibilityRole/Label, область нажатия не меньше 44pt.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { tap } from '@/lib/haptics';
import { colors, gradients, radius, space, type } from '@/theme';

export function Screen({ children, edges = ['top'], style }: { children: ReactNode; edges?: Edge[]; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView edges={edges} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={type.title} accessibilityRole="header">{children}</Text>
      {sub ? <Text style={[type.small, { marginTop: 4 }]}>{sub}</Text> : null}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, icon, style }: ButtonProps) {
  const inactive = disabled || loading;
  const content = (
    <View style={styles.btnInner}>
      {loading ? <ActivityIndicator color={colors.white} /> : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={variant === 'ghost' ? colors.roseLight : colors.white} /> : null}
          <Text style={[styles.btnText, variant === 'ghost' && { color: colors.roseLight }]}>{label}</Text>
        </>
      )}
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [styles.btn, variant !== 'primary' && styles.btnOutline,
        variant === 'danger' && { borderColor: colors.danger, backgroundColor: 'rgba(229,72,77,0.12)' },
        { opacity: inactive ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}
    >
      {variant === 'primary'
        ? <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnGradient}>{content}</LinearGradient>
        : content}
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, color = colors.text, size = 22, style }: {
  icon: ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; color?: string; size?: number; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }, style]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.roseLight}
        style={[styles.input, error ? { borderColor: colors.danger } : null]}
        {...props}
      />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, style, onPress, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string }) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }, style]}>
      {children}
    </Pressable>
  );
}

export function Avatar({ uri, name, size = 48 }: { uri?: string | null; name?: string | null; size?: number }) {
  const initial = (name?.trim()[0] ?? '♥').toUpperCase();
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" transition={150}
      accessibilityLabel={name ? `Фото: ${name}` : 'Фото профиля'} />
  ) : (
    <LinearGradient colors={gradients.primary} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.white, fontSize: size * 0.42, fontWeight: '600' }}>{initial}</Text>
    </LinearGradient>
  );
}

export function Chip({ label, active, onPress, color = colors.roseLight }: { label: string; active?: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={label}
      onPress={() => { tap(); onPress(); }}
      style={[styles.chip, active && { backgroundColor: color + '33', borderColor: color }]}
    >
      <Text style={[type.small, active && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Empty({ emoji, title, text }: { emoji: string; title: string; text?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 44, marginBottom: space.md }} accessibilityElementsHidden>{emoji}</Text>
      <Text style={[type.heading, { textAlign: 'center' }]}>{title}</Text>
      {text ? <Text style={[type.small, { textAlign: 'center', marginTop: 6 }]}>{text}</Text> : null}
    </View>
  );
}

export function Loading() {
  return <View style={styles.center}><ActivityIndicator color={colors.roseLight} size="large" /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  btn: { borderRadius: radius.md, overflow: 'hidden', minHeight: 50 },
  btnOutline: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: 'transparent', justifyContent: 'center' },
  btnGradient: { flex: 1, justifyContent: 'center' },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: space.lg, minHeight: 50 },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { ...type.caption, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: space.lg, paddingVertical: 14, color: colors.text, fontSize: 16,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 6 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, minHeight: 36, justifyContent: 'center',
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgElevated,
  },
  empty: { alignItems: 'center', justifyContent: 'center', padding: space.xxl, flex: 1 },
});
