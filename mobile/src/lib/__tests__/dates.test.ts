/// <reference types="jest" />
/// <reference types="node" />
import { daysBetween, daysTogether, nextAnniversary, plural, relativeSeen, ymd } from '../dates';

describe('plural', () => {
  test.each([
    [1, 'день'], [2, 'дня'], [5, 'дней'], [11, 'дней'], [21, 'день'], [22, 'дня'], [112, 'дней'], [0, 'дней'],
  ])('%i → %s', (n, word) => {
    expect(plural(n, 'день', 'дня', 'дней')).toBe(word);
  });
});

describe('daysTogether', () => {
  const now = new Date(2026, 9, 11, 15, 30); // 11 окт 2026, локальное время
  test('counts calendar days, start day = day 1', () => {
    expect(daysTogether('2026-10-11', now)).toBe(1);
    expect(daysTogether('2026-10-10', now)).toBe(2);
    expect(daysTogether('2025-10-11', now)).toBe(366);
  });
  test('null / future / garbage → null', () => {
    expect(daysTogether(null, now)).toBeNull();
    expect(daysTogether('2027-01-01', now)).toBeNull();
    expect(daysTogether('nope', now)).toBeNull();
  });
});

describe('nextAnniversary', () => {
  test('this year if not passed, else next year', () => {
    const now = new Date(2026, 9, 11);
    expect(nextAnniversary('2020-12-01', now)).toEqual({ date: '2026-12-01', years: 6, inDays: 51 });
    expect(nextAnniversary('2020-10-11', now)).toEqual({ date: '2026-10-11', years: 6, inDays: 0 });
    expect(nextAnniversary('2020-03-01', now)).toEqual({ date: '2027-03-01', years: 7, inDays: 141 });
  });
});

test('ymd / daysBetween', () => {
  expect(ymd(new Date(2026, 0, 5))).toBe('2026-01-05');
  expect(daysBetween('2026-01-01', '2026-03-01')).toBe(59);
});

describe('relativeSeen', () => {
  const now = new Date('2026-10-11T12:00:00Z');
  test('buckets', () => {
    expect(relativeSeen('2026-10-11T11:59:00Z', now)).toBe('в сети');
    expect(relativeSeen('2026-10-11T11:30:00Z', now)).toBe('30 минут назад');
    expect(relativeSeen('2026-10-11T09:00:00Z', now)).toBe('3 часа назад');
    expect(relativeSeen('2026-10-09T12:00:00Z', now)).toBe('2 дня назад');
    expect(relativeSeen(null, now)).toBeNull();
  });
});
