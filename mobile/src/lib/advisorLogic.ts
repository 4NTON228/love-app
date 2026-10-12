// Чистая логика раздела «Советник» (из SyncMirror.jsx и WarmthBarometer.jsx веба).

/** Ответы «созвучны», если >30% значимых слов (длиннее 3 букв) совпадают */
export function checkMatch(a: string, b: string) {
  const normalize = (s: string) => s.toLowerCase().replace(/[^а-яёa-z0-9\s]/g, '').trim();
  const wordsA = new Set(normalize(a).split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(normalize(b).split(/\s+/).filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let common = 0;
  wordsA.forEach((w) => { if (wordsB.has(w)) common++; });
  return common / Math.max(wordsA.size, wordsB.size) > 0.3;
}

const EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}]/gu;
const WE_RE = /\b(мы|нас|нам|наш|наша|наше|наши|нашу|нашего|нашей|нашим|нашими)\b/gi;

export type Msg = { user_id: string; text: string | null; created_at: string };
export type Details = { avgLength?: number; emojiDens?: number; weRatio?: number; avgRT?: number };
export type Warmth = { index: number; details: Details };

export function calcWarmth(messages: Msg[]): Warmth {
  if (!messages || messages.length === 0) return { index: 0.5, details: {} };
  const texts = messages.map((m) => m.text ?? '');
  const avgLength = texts.reduce((acc, t) => acc + t.length, 0) / texts.length;
  const withEmoji = texts.filter((t) => { EMOJI_RE.lastIndex = 0; return EMOJI_RE.test(t); }).length;
  const emojiDens = withEmoji / texts.length;
  const withWe = texts.filter((t) => { WE_RE.lastIndex = 0; return WE_RE.test(t); }).length;
  const weRatio = withWe / texts.length;
  let totalRT = 0, rtSamples = 0;
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].user_id !== messages[i - 1].user_id) {
      const diff = (new Date(messages[i].created_at).getTime() - new Date(messages[i - 1].created_at).getTime()) / 1000;
      if (diff > 0 && diff < 86400) { totalRT += diff; rtSamples++; }
    }
  }
  const avgRT = rtSamples > 0 ? Math.round(totalRT / rtSamples) : 0;
  const index = +Math.min(1, Math.max(0,
    Math.min(avgLength / 80, 1) * 0.25 +
    Math.min(emojiDens, 1) * 0.30 +
    Math.min(weRatio * 4, 1) * 0.25 +
    (avgRT > 0 ? Math.max(0, 1 - avgRT / 1800) * 0.20 : 0.10),
  )).toFixed(3);
  return { index, details: { avgLength: Math.round(avgLength), emojiDens, weRatio, avgRT } };
}
