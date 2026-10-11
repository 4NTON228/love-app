// Должен импортироваться первым (см. src/app/_layout.tsx).
// @noble берёт случайность из crypto.getRandomValues — даём нативный CSPRNG.
import { getRandomValues } from 'expo-crypto';

const g = globalThis as { crypto?: { getRandomValues?: unknown } };
if (typeof g.crypto?.getRandomValues !== 'function') {
  g.crypto = { ...(g.crypto ?? {}), getRandomValues };
}
