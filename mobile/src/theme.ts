// Дизайн-токены веб-версии (src/styles/globals.css, тёмная тема .app.dark — она
// единственная в вебе после удаления переключения тем).
import { Platform } from 'react-native';

export const colors = {
  bg: '#160a10',
  bgCard: '#1f0e16',
  surface: '#1f0e16',
  surface2: '#2a1620',
  border: 'rgba(255,255,255,0.07)',
  borderSubtle: 'rgba(255,255,255,0.04)',
  text: '#F3E8EC',
  textLight: '#B79DA8',
  textMuted: '#8A7480',
  // --h: 349, --s: 59%
  rose: 'hsl(349, 59%, 41%)',
  roseDark: 'hsl(349, 59%, 28%)',
  roseLight: 'hsl(349, 59%, 54%)',
  roseFaint: 'hsl(349, 40%, 14%)',
  roseMuted: 'hsl(349, 30%, 24%)',
  gold: '#B8975A',
  white: '#FFFFFF',
} as const;

// --gradient / --bubble-mine и т.п. как [цвета, угол CSS]
export const gradients = {
  main: { colors: ['hsl(349, 59%, 44%)', 'hsl(349, 59%, 29%)'], angle: 150 },
  warm: { colors: ['hsl(349, 59%, 48%)', 'hsl(349, 59%, 33%)'], angle: 135 },
  bubbleMine: { colors: ['hsl(349, 59%, 49%)', 'hsl(349, 59%, 35%)'], angle: 135 },
} as const;

// Шрифты веба: Cormorant Garamond (display) и DM Sans (body)
export const fonts = {
  display: 'CormorantGaramond_500Medium',
  displayLight: 'CormorantGaramond_300Light',
  displayRegular: 'CormorantGaramond_400Regular',
  displaySemi: 'CormorantGaramond_600SemiBold',
  displayItalic: 'CormorantGaramond_400Regular_Italic',
  displayLightItalic: 'CormorantGaramond_300Light_Italic',
  displaySemiItalic: 'CormorantGaramond_600SemiBold_Italic',
  body: 'DMSans_400Regular',
  bodyLight: 'DMSans_300Light',
  bodyMedium: 'DMSans_500Medium',
  bodySemi: 'DMSans_600SemiBold',
  bodyBold: 'DMSans_700Bold',
  // "Helvetica Neue", Arial — для цифр счётчиков
  numeric: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' })!,
  numericBold: Platform.select({ ios: 'HelveticaNeue-Bold', default: 'sans-serif' })!,
};

export const radius = { sm: 8, md: 14, lg: 18, xl: 24 } as const;

/**
 * CSS linear-gradient(angle, ...) → props для expo-linear-gradient.
 * angle как в CSS: 0deg — вверх, 90deg — вправо, 180deg — вниз.
 */
export function cssLinear(angle: number, stops: readonly (string | readonly [string, number])[]) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad), dy = -Math.cos(rad);
  const colorsOut = stops.map((s) => (typeof s === 'string' ? s : s[0]));
  const hasPos = stops.some((s) => typeof s !== 'string');
  const locations = hasPos
    ? stops.map((s, i) => (typeof s === 'string' ? i / Math.max(1, stops.length - 1) : s[1]))
    : undefined;
  return {
    colors: colorsOut as unknown as readonly [string, string, ...string[]],
    locations: locations as unknown as readonly [number, number, ...number[]] | undefined,
    start: { x: 0.5 - dx / 2, y: 0.5 - dy / 2 },
    end: { x: 0.5 + dx / 2, y: 0.5 + dy / 2 },
  };
}
