// QR как в вебе (библиотека qrcode, те же цвета), отрисовка через SVG.
import QR from 'qrcode';
import { useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';

export function QRCode({ value, size, dark = '#C8334A', light = '#FDF5F6', margin = 1 }: { value: string; size: number; dark?: string; light?: string; margin?: number }) {
  const qr = useMemo(() => QR.create(value, { errorCorrectionLevel: 'M' }), [value]);
  const n = qr.modules.size;
  const total = n + margin * 2;
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(x, y)) cells.push({ x, y });
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${total} ${total}`} accessibilityLabel="QR-код приглашения">
      <Rect x="0" y="0" width={total} height={total} fill={light} />
      {cells.map((c) => <Rect key={`${c.x}-${c.y}`} x={c.x + margin} y={c.y + margin} width={1.02} height={1.02} fill={dark} />)}
    </Svg>
  );
}
