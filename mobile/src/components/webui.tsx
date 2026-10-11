// Общие элементы веб-версии (globals.css, тёмная тема): .modal-overlay/.modal,
// .form-group/.form-label/.form-input/.form-textarea/.form-file-label/.form-submit.
import { BlurView } from 'expo-blur';
import { type ReactNode, useEffect, useState } from 'react';
import {
  Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput,
  type TextInputProps, View, type StyleProp, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { easeOut } from '@/components/anim';
import { colors, fonts } from '@/theme';

/** Нижний лист (.modal-overlay + .modal + .modal-handle + .modal-title) */
export function WebModal({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!visible) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 300, easing: easeOut, useNativeDriver: true }).start();
  }, [visible, v]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Закрыть">
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.8)' }]} />
        </Pressable>
        <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
          <Animated.View style={[s.sheet, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 80 }} keyboardShouldPersistTaps="handled" bounces={false}>
              <View style={s.handle} />
              {title ? <Text style={s.title} accessibilityRole="header">{title}</Text> : null}
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function FormGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      {label ? <Text style={s.label}>{label.toUpperCase()}</Text> : null}
      {children}
    </View>
  );
}

export function FormInput(props: TextInputProps & { textarea?: boolean }) {
  const { textarea, style, ...rest } = props;
  return (
    <TextInput placeholderTextColor={colors.textMuted} selectionColor={colors.rose} {...rest}
      multiline={textarea || rest.multiline}
      style={[s.input, textarea && { minHeight: 90, lineHeight: 24, textAlignVertical: 'top' }, style]} />
  );
}

export function FormFileLabel({ icon, label, onPress }: { icon?: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={s.file}>
      {icon}
      <Text style={s.fileText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function FormSubmit({ label, onPress, disabled, style }: { label: string; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [s.submit, disabled && { opacity: 0.5, shadowOpacity: 0 }, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }, style]}>
      <Text style={s.submitText}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  sheet: { width: '100%', maxHeight: '88%', backgroundColor: '#1A1916', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  handle: { width: 32, height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 99, alignSelf: 'center', marginBottom: 16 },
  title: { fontFamily: fonts.displayItalic, fontSize: 20, color: colors.text, marginBottom: 18 },
  label: { fontSize: 11, fontFamily: fonts.bodyMedium, color: colors.textMuted, letterSpacing: 0.6, marginBottom: 6 },
  input: {
    width: '100%', backgroundColor: '#1A1916', borderWidth: 0.5, borderColor: colors.border, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14, fontSize: 15, color: colors.text, fontFamily: fonts.body,
  },
  file: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1A1916', borderWidth: 0.5, borderColor: colors.border, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14 },
  fileText: { flex: 1, fontSize: 14, color: colors.textMuted, fontFamily: fonts.body },
  submit: {
    width: '100%', backgroundColor: colors.rose, borderRadius: 13, padding: 14, marginTop: 4, alignItems: 'center',
    shadowColor: 'hsl(349, 59%, 41%)', shadowOpacity: 0.3, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  submitText: { color: 'white', fontSize: 15, fontFamily: fonts.bodyMedium },
});
