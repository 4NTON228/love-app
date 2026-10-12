import { calcWarmth, checkMatch } from '../advisorLogic';

describe('checkMatch (SyncMirror)', () => {
  it('совпадение по значимым словам', () => {
    expect(checkMatch('Наше путешествие к морю летом', 'Путешествие к морю!')).toBe(true);
  });
  it('разные ответы не совпадают', () => {
    expect(checkMatch('Люблю гулять вечером', 'Хочу собаку')).toBe(false);
  });
  it('короткие слова не считаются', () => {
    expect(checkMatch('да', 'да')).toBe(false);
  });
});

describe('calcWarmth (WarmthBarometer)', () => {
  const t0 = Date.parse('2026-01-01T10:00:00Z');
  const at = (sec: number) => new Date(t0 + sec * 1000).toISOString();

  it('без сообщений — нейтральные 0.5', () => {
    expect(calcWarmth([])).toEqual({ index: 0.5, details: {} });
  });

  it('считает длину, эмодзи и время ответа', () => {
    const r = calcWarmth([
      { user_id: 'a', text: 'Привет ❤️', created_at: at(0) },
      { user_id: 'b', text: 'Привет!', created_at: at(60) },
      { user_id: 'a', text: 'Как дела?', created_at: at(180) },
    ]);
    expect(r.details.avgRT).toBe(90);
    expect(r.details.emojiDens).toBeCloseTo(1 / 3);
    expect(r.index).toBeGreaterThan(0);
    expect(r.index).toBeLessThanOrEqual(1);
  });

  it('паузы дольше суток не учитываются', () => {
    const r = calcWarmth([
      { user_id: 'a', text: 'x', created_at: at(0) },
      { user_id: 'b', text: 'y', created_at: at(90000) },
    ]);
    expect(r.details.avgRT).toBe(0);
  });
});
