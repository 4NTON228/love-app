// Те же справочники, что в веб-версии — данные общие.
export const STATUS_MOODS = [
  { e: '🥰', label: 'влюблён' },
  { e: '😊', label: 'хорошо' },
  { e: '🔥', label: 'огонь' },
  { e: '😴', label: 'устал' },
  { e: '😔', label: 'грустно' },
  { e: '🤔', label: 'скучаю' },
] as const;

export const MOMENT_MOODS = [
  { value: 'love', label: 'Любовь', color: '#C8334A', emoji: '❤️' },
  { value: 'happy', label: 'Счастье', color: '#F7C948', emoji: '😊' },
  { value: 'laugh', label: 'Смех', color: '#FF8FAB', emoji: '😂' },
  { value: 'warm', label: 'Тепло', color: '#F97316', emoji: '☀️' },
  { value: 'dream', label: 'Мечта', color: '#A78BFA', emoji: '✨' },
  { value: 'kiss', label: 'Поцелуй', color: '#EC4899', emoji: '💋' },
  { value: 'adventure', label: 'Путешествие', color: '#22C55E', emoji: '🧭' },
  { value: 'cozy', label: 'Уют', color: '#B45309', emoji: '🕯️' },
] as const;

export const PLAN_CATEGORIES = [
  { value: 'dream', label: 'Мечта', color: '#D04F66' },
  { value: 'travel', label: 'Путешествие', color: '#4A8FE7' },
  { value: 'date', label: 'Свидание', color: '#E8A225' },
  { value: 'other', label: 'Другое', color: '#8A7480' },
] as const;

export const EVENT_EMOJIS = ['❤️', '🎂', '💍', '✈️', '🍷', '🎉', '🎁', '🏡', '🌹', '⭐'] as const;

export function momentMood(value: string | null | undefined) {
  return MOMENT_MOODS.find((m) => m.value === value) ?? MOMENT_MOODS[0];
}

export function planCategory(value: string | null | undefined) {
  return PLAN_CATEGORIES.find((c) => c.value === value) ?? PLAN_CATEGORIES[0];
}
