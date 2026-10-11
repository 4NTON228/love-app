// SVG-иконки веб-версии (те же пути), через react-native-svg.
import type { ReactNode } from 'react';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

type P = { size?: number; color?: string; width?: number };

function Stroke({ size = 22, color = 'currentColor', width = 1.8, children, fill = 'none' }: P & { children: ReactNode; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}

// ── Navigation.jsx ──
export const IHome = (p: P) => <Stroke {...p}><Path d="M3 11.5L12 4l9 7.5" /><Path d="M5 9.8V21h5v-5.5h4V21h5V9.8" /></Stroke>;
export const IChat = (p: P) => <Stroke {...p}><Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></Stroke>;
export const ICamera = (p: P) => <Stroke {...p}><Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><Circle cx="12" cy="13" r="4" /></Stroke>;
export const ICalendar = (p: P) => <Stroke {...p}><Rect x="3" y="4" width="18" height="17" rx="2" /><Line x1="8" y1="2" x2="8" y2="6" /><Line x1="16" y1="2" x2="16" y2="6" /><Line x1="3" y1="10" x2="21" y2="10" /></Stroke>;
export const IPlans = (p: P) => <Stroke {...p}><Line x1="10" y1="6" x2="20" y2="6" /><Line x1="10" y1="12" x2="20" y2="12" /><Line x1="10" y1="18" x2="20" y2="18" /><Polyline points="4,6 5.5,7.5 8,5" /><Polyline points="4,12 5.5,13.5 8,11" /><Circle cx="6" cy="18" r="1.6" /></Stroke>;
export const IPerson = (p: P) => <Stroke {...p}><Circle cx="12" cy="8" r="4" /><Path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" /></Stroke>;

// ── общие ──
export const IClose = ({ size = 20, color = '#fff', width = 2.4 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round">
    <Line x1="18" y1="6" x2="6" y2="18" /><Line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
);
export const IPlay = ({ size = 20, color = '#fff' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Polygon points="6 4 20 12 6 20 6 4" /></Svg>
);

/** Сердце сплэша (App.jsx) */
export const SplashHeart = ({ size = 84 }: { size?: number }) => (
  <Svg width={size} height={size * (56 / 60)} viewBox="0 0 60 56" fill="none">
    <Path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z" fill="#fff" fillOpacity={0.95} />
  </Svg>
);
