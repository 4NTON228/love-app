import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const FALLBACK_QUESTIONS = [
  'Что в нашем партнёре вдохновляет тебя больше всего прямо сейчас?',
  'Каким был наш лучший совместный день за последние месяцы?',
  'Какую мечту ты хочешь осуществить вместе с партнёром?',
  'Что ты больше всего ценишь в наших отношениях?',
  'Какой момент вместе ты будешь помнить всегда?',
  'Что партнёр делает, что неизменно поднимает тебе настроение?',
  'Какое приключение ты хочешь пережить с партнёром?',
  'Что тебя удивило в партнёре за последнее время?',
  'Какая наша традиция нравится тебе больше всего?',
  'Что бы ты хотел сказать партнёру, но ещё не сказал?',
]

function checkMatch(a, b) {
  const normalize = s => s.toLowerCase().replace(/[^а-яёa-z0-9\s]/g, '').trim()
  const wordsA = new Set(normalize(a).split(/\s+/).filter(w => w.length > 3))
  const wordsB = new Set(normalize(b).split(/\s+/).filter(w => w.length > 3))
  if (wordsA.size === 0 || wordsB.size === 0) return false
  let common = 0
  wordsA.forEach(w => { if (wordsB.has(w)) common++ })
  return common / Math.max(wordsA.size, wordsB.size) > 0.3
}

// Small heart SVG for streak dots — replaces text '✦'
function HeartDot() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="rgba(255,255,255,0.9)" stroke="none">
      <path d="M8 13.5C8 13.5 1.5 9.2 1.5 5.5a3.5 3.5 0 016.5-1.8A3.5 3.5 0 0114.5 5.5C14.5 9.2 8 13.5 8 13.5z" />
    </svg>
  )
}

export default function SyncMirror({ session, profile, darkMode }) {
  const userId    = session?.user?.id
  const partnerId = profile?.partner_id

  const [loading,    setLoading]    = useState(true)
  const [mirror,     setMirror]     = useState(null)
  const [myAnswer,   setMyAnswer]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [streak,     setStreak]     = useState(0)
  const textareaRef = useRef(null)

  const load = useCallback(async () => {
    if (!userId || !partnerId) { setLoading(false); return }
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)

    const { data: rows } = await supabase
      .from('sync_mirror')
      .select('*')
      .or(`user_id.eq.${userId},partner_id.eq.${userId}`)
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${today}T23:59:59Z`)
      .order('created_at', { ascending: false })
      .limit(1)

    let row = rows?.[0] ?? null
    if (!row) {
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
      const question = FALLBACK_QUESTIONS[dayOfYear % FALLBACK_QUESTIONS.length]
      const { data: created } = await supabase
        .from('sync_mirror')
        .insert({ user_id: userId, partner_id: partnerId, question })
        .select().single()
      row = created
    }

    setMirror(row)
    if (row) {
      const isOwner = row.user_id === userId
      const saved   = isOwner ? row.answer : row.partner_answer
      if (saved) setMyAnswer(saved)
    }

    const { data: s } = await supabase
      .from('ai_advisor_settings')
      .select('sync_streak')
      .eq('user_id', userId)
      .maybeSingle()
    setStreak(s?.sync_streak ?? 0)
    setLoading(false)
  }, [userId, partnerId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!mirror?.id) return
    const channel = supabase
      .channel(`mirror:${mirror.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sync_mirror', filter: `id=eq.${mirror.id}` },
        payload => setMirror(payload.new))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [mirror?.id])

  async function submitAnswer() {
    if (!myAnswer.trim() || !mirror) return
    setSubmitting(true)
    const isOwner  = mirror.user_id === userId
    const field    = isOwner ? 'answer' : 'partner_answer'
    const timeField = isOwner ? 'answered_at' : 'partner_answered_at'
    const update   = { [field]: myAnswer.trim(), [timeField]: new Date().toISOString() }
    const partnerAns = isOwner ? mirror.partner_answer : mirror.answer
    if (partnerAns) {
      const matched = checkMatch(myAnswer.trim(), partnerAns)
      update.is_matched   = matched
      update.spark_earned = matched
    }
    const { data: updated } = await supabase.from('sync_mirror').update(update).eq('id', mirror.id).select().single()
    if (updated) setMirror(updated)
    if (update.spark_earned) {
      await supabase.from('ai_advisor_settings')
        .upsert({ user_id: userId, sync_streak: streak + 1, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      setStreak(s => s + 1)
    }
    setSubmitting(false)
  }

  const isOwner      = mirror?.user_id === userId
  const myStoredAns  = mirror ? (isOwner ? mirror.answer : mirror.partner_answer) : null
  const theirAns     = mirror ? (isOwner ? mirror.partner_answer : mirror.answer) : null
  const bothAnswered = !!(myStoredAns && theirAns)
  const iAnswered    = !!myStoredAns
  const sticker      = streak >= 7

  return (
    <div className={`sm-page${darkMode ? ' sm-dark' : ''}`}>
      <style>{`
        .sm-page { background: var(--surface, #fff); min-height: 100%; }
        .sm-dark  { background: #0A0206; }

        @keyframes smFloat1 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50%       { transform: translateY(-20px) scale(1.05); }
        }
        @keyframes smFloat2 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50%       { transform: translateY(16px) scale(0.96); }
        }
        @keyframes smSlideLeft {
          from { opacity: 0; transform: translateX(-28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes smSlideRight {
          from { opacity: 0; transform: translateX(28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes smBounceIn {
          0%   { opacity: 0; transform: scale(0.5); }
          60%  { transform: scale(1.12); }
          80%  { transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes smDotPop {
          0%   { opacity: 0; transform: scale(0); }
          60%  { transform: scale(1.25); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes smPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%       { transform: scale(1.08); opacity: 0.8; }
        }
        @keyframes smFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes smSpin { to { transform: rotate(360deg); } }

        /* Hero */
        .sm-hero {
          position: relative; overflow: hidden;
          padding: 28px 20px 32px;
          background: linear-gradient(160deg, #6B1428 0%, #3A0A14 50%, #1A0408 100%);
        }
        .sm-hero-orb1 {
          position: absolute; top: -40px; right: -40px;
          width: 180px; height: 180px; border-radius: 50%;
          background: radial-gradient(circle, rgba(200,51,74,0.4) 0%, transparent 70%);
          pointer-events: none;
          animation: smFloat1 6s ease-in-out infinite;
        }
        .sm-hero-orb2 {
          position: absolute; bottom: -30px; left: -50px;
          width: 140px; height: 140px; border-radius: 50%;
          background: radial-gradient(circle, rgba(139,26,44,0.35) 0%, transparent 70%);
          pointer-events: none;
          animation: smFloat2 9s ease-in-out infinite;
        }
        .sm-hero-tag {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
          border-radius: 99px; padding: 4px 12px;
          font-size: 11px; font-weight: 700; letter-spacing: 0.8px;
          text-transform: uppercase; color: rgba(255,255,255,0.7);
          margin-bottom: 14px; position: relative; z-index: 1;
        }
        .sm-hero-q {
          font-family: var(--font-head, Georgia, serif);
          font-size: 22px; font-weight: 700; font-style: italic;
          color: #FFFFFF; line-height: 1.35;
          position: relative; z-index: 1;
        }
        .sm-hero-q::before {
          content: '\u00AB'; color: rgba(200,51,74,0.7);
          font-size: 48px; line-height: 0;
          vertical-align: -18px; margin-right: 4px;
        }

        /* Streak bar */
        .sm-streak-bar {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 20px;
          background: var(--blush, #FBF0F2);
          border-bottom: 1px solid var(--border, rgba(200,51,74,0.1));
        }
        .sm-dark .sm-streak-bar { background: #1A0810; border-bottom-color: rgba(200,51,74,0.18); }
        .sm-streak-dots { display: flex; gap: 5px; flex: 1; }
        .sm-streak-dot {
          width: 26px; height: 26px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          border: 1.5px solid rgba(200,51,74,0.2);
          background: transparent;
          opacity: 0;
          animation: smDotPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .sm-streak-dot.filled {
          background: linear-gradient(135deg, #C8334A, #8B1A2C);
          border-color: transparent;
        }
        .sm-streak-num {
          font-size: 13px; font-weight: 700;
          color: var(--rose, #C8334A);
          white-space: nowrap;
        }

        /* Body */
        .sm-body { padding: 20px; }

        /* Answer textarea */
        .sm-textarea-wrap { position: relative; margin-bottom: 8px; }
        .sm-textarea {
          width: 100%; min-height: 130px; resize: none; outline: none;
          background: var(--blush, #FBF0F2);
          border: 2px solid transparent;
          border-radius: 18px; padding: 16px;
          font-family: var(--font-body, sans-serif); font-size: 16px;
          color: var(--ink, #1E0A10); line-height: 1.6;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .sm-dark .sm-textarea { background: #1A0810; color: #F5E6EB; }
        .sm-textarea:focus {
          border-color: #C8334A;
          box-shadow: 0 0 0 4px rgba(200,51,74,0.1);
        }
        .sm-counter {
          text-align: right; font-size: 11px;
          color: var(--muted, #9A6070); margin-bottom: 12px;
        }

        /* Submit button with CSS ripple on click */
        .sm-submit {
          width: 100%; padding: 15px; border: none; border-radius: 16px;
          background: linear-gradient(135deg, #C8334A, #8B1A2C);
          color: white; font-size: 16px; font-weight: 700;
          cursor: pointer; letter-spacing: 0.2px;
          box-shadow: 0 6px 20px rgba(139,26,44,0.35);
          transition: transform 0.15s, box-shadow 0.15s;
          -webkit-tap-highlight-color: transparent;
          position: relative; overflow: hidden;
        }
        .sm-submit::after {
          content: '';
          position: absolute;
          width: 0; height: 0;
          border-radius: 50%;
          background: rgba(255,255,255,0.3);
          top: 50%; left: 50%;
          transform: translate(-50%, -50%) scale(1);
          opacity: 0;
          transition: none;
        }
        .sm-submit:active::after {
          width: 320px; height: 320px;
          opacity: 0;
          transition: width 0.5s ease-out, height 0.5s ease-out, opacity 0.55s ease-out;
        }
        .sm-submit:active { transform: scale(0.97); box-shadow: 0 3px 10px rgba(139,26,44,0.3); }
        .sm-submit:disabled { opacity: 0.45; cursor: default; }
        .sm-hint { text-align: center; font-size: 12px; color: var(--muted, #9A6070); margin-top: 10px; }

        /* Waiting */
        .sm-waiting { text-align: center; padding: 32px 0; }
        .sm-waiting-pulse {
          width: 64px; height: 64px; border-radius: 50%;
          background: linear-gradient(135deg, rgba(200,51,74,0.12), rgba(139,26,44,0.08));
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
          animation: smPulse 2.5s ease-in-out infinite;
        }
        .sm-waiting-title {
          font-size: 16px; font-weight: 700; color: var(--ink, #1E0A10); margin-bottom: 6px;
        }
        .sm-dark .sm-waiting-title { color: #F5E6EB; }
        .sm-waiting-text { font-size: 14px; color: var(--muted, #9A6070); line-height: 1.5; }
        .sm-hidden-badge {
          display: inline-block; margin-top: 14px;
          background: var(--blush, #FBF0F2); border-radius: 12px;
          padding: 10px 16px; font-size: 13px;
          color: var(--muted, #9A6070); font-style: italic;
        }
        .sm-dark .sm-hidden-badge { background: #1A0810; }

        /* Match badge — spring bounce */
        .sm-match {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 14px 20px; border-radius: 16px; margin-bottom: 16px;
          background: linear-gradient(135deg, rgba(200,51,74,0.1), rgba(139,26,44,0.06));
          border: 1.5px solid rgba(200,51,74,0.25);
          animation: smBounceIn 0.55s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .sm-match-text { font-weight: 700; font-size: 15px; color: #C8334A; }

        /* Answer cards — alternating slide-in from left and right */
        .sm-answers { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
        .sm-answer-card {
          border-radius: 22px; overflow: hidden;
          border: 1px solid rgba(200,51,74,0.1);
          background: rgba(255,255,255,0.96);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.06);
          opacity: 0;
        }
        .sm-dark .sm-answer-card {
          background: rgba(18,5,10,0.92);
          border-color: rgba(200,51,74,0.14);
          box-shadow: 0 8px 24px rgba(0,0,0,0.45);
        }
        .sm-answer-card.slide-left  { animation: smSlideLeft  0.38s ease both; }
        .sm-answer-card.slide-right { animation: smSlideRight 0.38s ease both; }
        .sm-answer-who {
          padding: 8px 14px;
          font-size: 10px; font-weight: 800; letter-spacing: 1px;
          text-transform: uppercase;
        }
        .sm-answer-you  { background: linear-gradient(135deg, #C8334A, #8B1A2C); color: rgba(255,255,255,0.85); }
        .sm-answer-them { background: linear-gradient(135deg, #7B3FBE, #3D1A6B); color: rgba(255,255,255,0.85); }
        .sm-answer-text {
          padding: 14px;
          font-size: 15px; line-height: 1.6;
          color: var(--ink, #1E0A10);
          background: var(--blush, #FBF0F2);
        }
        .sm-dark .sm-answer-text { background: #1A0810; color: #F5E6EB; }

        /* Sticker unlock */
        .sm-sticker {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px; border-radius: 16px; margin-top: 8px;
          border: 1.5px dashed rgba(200,51,74,0.3);
          background: rgba(200,51,74,0.04);
        }
        .sm-sticker-text { font-size: 13px; color: var(--muted, #9A6070); line-height: 1.4; flex: 1; }
        .sm-sticker-text strong { color: #C8334A; }

        /* Loading */
        .sm-loading { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 60px 20px; }
        .sm-loading-ring {
          width: 48px; height: 48px; border-radius: 50%;
          border: 3px solid rgba(200,51,74,0.15);
          border-top-color: #C8334A;
          animation: smSpin 0.9s linear infinite;
        }
        .sm-loading-text { font-size: 14px; color: var(--muted, #9A6070); }

        /* No partner */
        .sm-empty { text-align: center; padding: 60px 20px; }
        .sm-empty-icon {
          width: 72px; height: 72px; border-radius: 50%;
          background: var(--blush, #FBF0F2);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
        }
        .sm-dark .sm-empty-icon { background: #1A0810; }
        .sm-empty-title { font-size: 16px; font-weight: 700; color: var(--ink, #1E0A10); margin-bottom: 8px; }
        .sm-dark .sm-empty-title { color: #F5E6EB; }
        .sm-empty-text { font-size: 14px; color: var(--muted, #9A6070); line-height: 1.5; }
      `}</style>

      {loading ? (
        <div className="sm-loading">
          <div className="sm-loading-ring" />
          <div className="sm-loading-text">Загружаю вопрос дня...</div>
        </div>
      ) : !mirror ? (
        <div className="sm-empty">
          <div className="sm-empty-icon">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#C8334A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="10" rx="7" ry="9" /><path d="M9 21h6M12 19v2" />
            </svg>
          </div>
          <div className="sm-empty-title">Партнёр не подключён</div>
          <div className="sm-empty-text">Добавьте партнёра в настройках профиля — тогда появится общий вопрос дня.</div>
        </div>
      ) : (
        <>
          {/* Hero with question and two floating orbs */}
          <div className="sm-hero">
            <div className="sm-hero-orb1" />
            <div className="sm-hero-orb2" />
            <div className="sm-hero-tag">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="rgba(255,255,255,0.7)">
                <circle cx="12" cy="12" r="10" />
              </svg>
              Вопрос дня
            </div>
            <div className="sm-hero-q">{mirror.question}»</div>
          </div>

          {/* Streak dots — pop in one by one */}
          <div className="sm-streak-bar">
            <div className="sm-streak-dots">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className={`sm-streak-dot${i < streak ? ' filled' : ''}`}
                  style={{ animationDelay: `${i * 0.07}s` }}
                >
                  {i < streak ? <HeartDot /> : null}
                </div>
              ))}
            </div>
            <div className="sm-streak-num">{streak}/7 дней</div>
          </div>

          <div className="sm-body">
            {bothAnswered ? (
              <>
                {mirror.is_matched && (
                  <div className="sm-match">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="#C8334A" stroke="none">
                      <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
                    </svg>
                    <span className="sm-match-text">Ваши мысли созвучны</span>
                  </div>
                )}
                <div className="sm-answers">
                  {/* odd card (1st) slides in from left */}
                  <div className="sm-answer-card slide-left" style={{ animationDelay: '0s' }}>
                    <div className="sm-answer-who sm-answer-you">Ты</div>
                    <div className="sm-answer-text">{myStoredAns}</div>
                  </div>
                  {/* even card (2nd) slides in from right */}
                  <div className="sm-answer-card slide-right" style={{ animationDelay: '0.12s' }}>
                    <div className="sm-answer-who sm-answer-them">Партнёр</div>
                    <div className="sm-answer-text">{theirAns}</div>
                  </div>
                </div>
              </>
            ) : iAnswered ? (
              <div className="sm-waiting">
                <div className="sm-waiting-pulse">
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#C8334A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="12" cy="10" rx="7" ry="9" /><path d="M9 21h6M12 19v2" />
                  </svg>
                </div>
                <div className="sm-waiting-title">Ответ сохранён</div>
                <div className="sm-waiting-text">Ждём партнёра. Ответы откроются<br />когда оба напишут.</div>
                <div className="sm-hidden-badge">Твой ответ скрыт до открытия</div>
              </div>
            ) : (
              <>
                <div className="sm-textarea-wrap">
                  <textarea
                    ref={textareaRef}
                    className="sm-textarea"
                    value={myAnswer}
                    onChange={e => setMyAnswer(e.target.value)}
                    placeholder="Пиши честно — партнёр увидит только после своего ответа..."
                    maxLength={500}
                  />
                </div>
                <div className="sm-counter">{myAnswer.length}/500</div>
                <button
                  className="sm-submit"
                  onClick={submitAnswer}
                  disabled={!myAnswer.trim() || submitting}
                >
                  {submitting ? 'Сохраняю...' : 'Отправить ответ'}
                </button>
                <div className="sm-hint">Партнёр не увидит ответ, пока не ответит сам</div>
              </>
            )}

            {/* Стикер */}
            <div className="sm-sticker">
              {sticker ? (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#C8334A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 017.9-.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#9A6070" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" />
                </svg>
              )}
              <span className="sm-sticker-text">
                {sticker
                  ? <><strong>Стикер разблокирован!</strong> Используй его в чате.</>
                  : <>7 дней синхронности → стикер для чата. Осталось: <strong>{7 - streak} дн</strong></>
                }
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
