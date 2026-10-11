// Нативный выбор даты: iOS — компактный пикер, Android — системный диалог.
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { humanDate, parseDay, ymd } from '@/lib/dates';
import { colors, radius, space, type } from '@/theme';

type Props = { label: string; value: string | null; onChange: (v: string) => void; maximumDate?: Date; minimumDate?: Date };

export function DateField({ label, value, onChange, maximumDate, minimumDate }: Props) {
  const [open, setOpen] = useState(false);
  const date = parseDay(value) ?? new Date();

  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === 'ios' ? (
        <View style={styles.box}>
          <DateTimePicker value={date} mode="date" display="compact" locale="ru-RU" themeVariant="dark"
            accentColor={colors.roseLight} maximumDate={maximumDate} minimumDate={minimumDate}
            onChange={(_, d) => d && onChange(ymd(d))} />
        </View>
      ) : (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value ? humanDate(value) : 'не выбрано'}`}
            onPress={() => setOpen(true)} style={styles.box}>
            <Text style={[type.body, !value && { color: colors.textMuted }]}>{value ? humanDate(value) : 'Выбрать дату'}</Text>
          </Pressable>
          {open ? (
            <DateTimePicker value={date} mode="date" maximumDate={maximumDate} minimumDate={minimumDate}
              onChange={(e, d) => { setOpen(false); if (e.type === 'set' && d) onChange(ymd(d)); }} />
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...type.caption, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  box: {
    backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: space.lg, minHeight: 52, justifyContent: 'center', alignItems: 'flex-start',
  },
});
