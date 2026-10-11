// Порт parseText из Chat.jsx: **жирный**, *курсив*, __подчёркнутый__,
// ~~зачёркнутый~~, `код`, [текст](https://…), автоссылки и строки «> цитата».
import { type ReactNode } from 'react';
import { Linking, Text, type TextStyle, View } from 'react-native';

const ROSE = '#C8334A';

type Rule = { re: RegExp; render: (m: RegExpExecArray, key: string, base: TextStyle) => ReactNode };

const RULES: Rule[] = [
  { re: /\*\*(.+?)\*\*/, render: (m, k, b) => <Text key={k} style={{ fontWeight: '700' }}>{inline(m[1], b, k)}</Text> },
  { re: /\*(.+?)\*/, render: (m, k, b) => <Text key={k} style={{ fontStyle: 'italic' }}>{inline(m[1], b, k)}</Text> },
  { re: /__(.+?)__/, render: (m, k, b) => <Text key={k} style={{ textDecorationLine: 'underline' }}>{inline(m[1], b, k)}</Text> },
  { re: /~~(.+?)~~/, render: (m, k, b) => <Text key={k} style={{ textDecorationLine: 'line-through' }}>{inline(m[1], b, k)}</Text> },
  {
    re: /`(.+?)`/,
    render: (m, k) => (
      <Text key={k} style={{ backgroundColor: 'rgba(200,51,74,0.1)', borderRadius: 4, fontFamily: 'monospace', fontSize: 13 }}> {m[1]} </Text>
    ),
  },
  {
    re: /\[(.+?)\]\((https?:\/\/[^)]+)\)/,
    render: (m, k) => <Text key={k} style={{ color: ROSE, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(m[2])}>{m[1]}</Text>,
  },
  {
    re: /(https?:\/\/[^\s<]+)/,
    render: (m, k) => <Text key={k} style={{ color: ROSE, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(m[1])}>{m[1]}</Text>,
  },
];

function inline(text: string, base: TextStyle, prefix = 'i'): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest) {
    let best: { idx: number; m: RegExpExecArray; rule: Rule } | null = null;
    for (const rule of RULES) {
      const m = rule.re.exec(rest);
      if (m && (best === null || m.index < best.idx)) best = { idx: m.index, m, rule };
    }
    if (!best) { out.push(rest); break; }
    if (best.idx > 0) out.push(rest.slice(0, best.idx));
    out.push(best.rule.render(best.m, `${prefix}-${n++}`, base));
    rest = rest.slice(best.idx + best.m[0].length);
  }
  return out;
}

/** Текст сообщения с форматированием. Цитаты «> …» — отдельной строкой с полосой слева. */
export function RichText({ text, style }: { text: string; style: TextStyle }) {
  const lines = text.split('\n');
  if (!lines.some((l) => l.startsWith('> '))) {
    return <Text style={style}>{inline(text, style)}</Text>;
  }
  return (
    <View>
      {lines.map((line, i) => line.startsWith('> ') ? (
        <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: ROSE, marginVertical: 4, paddingVertical: 2, paddingHorizontal: 8, opacity: 0.8 }}>
          <Text style={style}>{inline(line.slice(2), style, `q${i}`)}</Text>
        </View>
      ) : (
        <Text key={i} style={style}>{inline(line, style, `l${i}`)}</Text>
      ))}
    </View>
  );
}
