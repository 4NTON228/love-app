// Даты и русские склонения. Даты вида 'YYYY-MM-DD' трактуются как локальные дни.

export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 10, b = Math.abs(n) % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return few;
  return many;
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' → локальная полночь; null для мусора. */
export function parseDay(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function daysBetween(from: string, to: string): number {
  const a = parseDay(from), b = parseDay(to);
  if (!a || !b) return NaN;
  // через UTC, чтобы переход на летнее время не давал 23/25 часов
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
}

/** Сколько дней вместе; день начала отношений — первый день. */
export function daysTogether(start: string | null | undefined, now = new Date()): number | null {
  const s = parseDay(start);
  if (!s) return null;
  const diff = daysBetween(ymd(s), ymd(now));
  return diff < 0 ? null : diff + 1;
}

export function nextAnniversary(start: string, now = new Date()) {
  const s = parseDay(start)!;
  const today = startOfDay(now);
  let year = today.getFullYear();
  let d = new Date(year, s.getMonth(), s.getDate());
  if (d < today) d = new Date(++year, s.getMonth(), s.getDate());
  return { date: ymd(d), years: year - s.getFullYear(), inDays: daysBetween(ymd(today), ymd(d)) };
}

export function isWithinHours(ts: string | null | undefined, hours: number, now = new Date()): boolean {
  return !!ts && now.getTime() - new Date(ts).getTime() < hours * 3600000;
}

export function relativeSeen(ts: string | null | undefined, now = new Date()): string | null {
  if (!ts) return null;
  const min = Math.floor((now.getTime() - new Date(ts).getTime()) / 60000);
  if (min < 3) return 'в сети';
  if (min < 60) return `${min} ${plural(min, 'минуту', 'минуты', 'минут')} назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ${plural(h, 'час', 'часа', 'часов')} назад`;
  const d = Math.floor(h / 24);
  return `${d} ${plural(d, 'день', 'дня', 'дней')} назад`;
}

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export function humanDate(s: string): string {
  const d = parseDay(s);
  return d ? `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''}` : s;
}

export function timeHM(ts: string): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function dayLabel(ts: string, now = new Date()): string {
  const diff = daysBetween(ymd(new Date(ts)), ymd(now));
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  return humanDate(ymd(new Date(ts)));
}
