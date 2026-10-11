// Аналог <input type="date"> / <input type="datetime-local"> из веба.
// Значения в тех же строковых форматах: 'YYYY-MM-DD' и 'YYYY-MM-DDTHH:mm' (локальное время).
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

const p2 = (n: number) => String(n).padStart(2, '0');
export const toLocalDate = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const toLocalDateTime = (d: Date) => `${toLocalDate(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}`;

function parse(value: string, mode: 'date' | 'datetime'): Date {
  if (!value) return new Date();
  const [date, time = '00:00'] = value.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const out = new Date(y, (m || 1) - 1, d || 1, mode === 'datetime' ? hh || 0 : 0, mode === 'datetime' ? mm || 0 : 0);
  return Number.isNaN(out.getTime()) ? new Date() : out;
}

function display(value: string, mode: 'date' | 'datetime') {
  if (!value) return '';
  const d = parse(value, mode);
  const date = `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
  return mode === 'datetime' ? `${date}, ${p2(d.getHours())}:${p2(d.getMinutes())}` : date;
}

type Props = {
  value: string;
  onChange: (v: string) => void;
  mode?: 'date' | 'datetime';
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  placeholderColor?: string;
  maximumDate?: Date;
  minimumDate?: Date;
  label?: string;
};

export function DateTimeInput({ value, onChange, mode = 'date', placeholder = 'дд.мм.гггг', style, textStyle, placeholderColor, maximumDate, minimumDate, label }: Props) {
  const current = parse(value, mode);
  const emit = (d: Date) => onChange(mode === 'datetime' ? toLocalDateTime(d) : toLocalDate(d));

  if (Platform.OS === 'ios') {
    return (
      <View style={[style, { alignItems: 'flex-start', justifyContent: 'center' }]} accessibilityLabel={label}>
        <DateTimePicker value={current} mode={mode} display="compact" locale="ru-RU" themeVariant="dark"
          maximumDate={maximumDate} minimumDate={minimumDate} onChange={(_, d) => d && emit(d)} />
      </View>
    );
  }

  function openAndroid() {
    DateTimePickerAndroid.open({
      value: current, mode: 'date', maximumDate, minimumDate,
      onChange: (e, d) => {
        if (e.type !== 'set' || !d) return;
        if (mode === 'date') { emit(d); return; }
        DateTimePickerAndroid.open({
          value: current, mode: 'time', is24Hour: true,
          onChange: (e2, t) => {
            if (e2.type !== 'set' || !t) return;
            emit(new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.getHours(), t.getMinutes()));
          },
        });
      },
    });
  }

  return (
    <Pressable onPress={openAndroid} accessibilityRole="button" accessibilityLabel={label ?? placeholder} style={style}>
      <Text style={[textStyle, !value && placeholderColor ? { color: placeholderColor } : null]}>{value ? display(value, mode) : placeholder}</Text>
    </Pressable>
  );
}
