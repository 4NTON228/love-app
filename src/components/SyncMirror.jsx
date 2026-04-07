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

function HeartFillIcon({ size = 14, color = '#C8334A' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color} stroke="none">
      <path d="M12 21C12 21 3 14 3 8.5A5.5 5.5 0 0112 5.1 5.5 5.5 0 0121 8.5C21 14 12 21 12 21z"/>
    </svg>
  )
}

function SparkStarIcon({ size = 18, color = '#C8334A' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color} stroke="none">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
    </svg>
  )
}

function LockSvg({ size = 20, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2"/>
      <path d="M8 11V7a4 4 0 018 0v4"/>
    </svg>
  )
}

function UnlockSvg({ size = 20, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2"/>
      <path d="M8 11V7a4 4 0 017.9-.5"/>
    </svg>
  )
}

function checkMatch(a, b) {
  const norm = s => s.toLowerCase().replace(/[^а-яёa-z0-9\s]/g, '').trim()
  const wA = new Set(norm(a).split(/\s+/).filter(w => w.length > 3))
  const wB = new Set(norm(b).split(/\s+/).filter(w => w.length > 3))
  if (!wA.size || !wB.size) return false
  let common = 0; wA.forEach(w => { if (wB.has(w)) common++ })
  return common / Math.max(wA.size, wB.size) > 0.3
}

export default function SyncMirror({ session, profile, darkMode }) {
  const userId    = session?.user?.id
  const partnerId = profile?.partner_id

  const [loading,    setLoading]    = useState(true)
  const [mirror,     setMirror]     = useState(null)
  const [myAnswer,   setMyAnswer]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [streak,     setStreak]     = useState(0)
  const [mounted,    setMounted]    = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => { setTimeout(() => setMounted(true), 50) }, [])

  const load = useCallback(async () => {
    if (!userId || !partnerId) { setLoading(false); return }
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const { data: rows } = await supabase
      .from('sync_mirror').select('*')
      .or(`user_id.eq.${userId},partner_id.eq.${userId}`)
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${today}T23:59:59Z`)
      .order('created_at', { ascending: false }).limit(1)

    let row = rows?.[0] ?? null
    if (!row) {
      const q = FALLBACK_QUESTIONS[Math.floor((Date.now() - new Date(new Date().getFullYear(),0,0)) / 86400000) % FALLBACK_QUESTIONS.length]
      const { data: c } = await supabase.from('sync_mirror').insert({ user_id: userId, partner_id: partnerId, question: q }).select().single()
      row = c
    }
    setMirror(row)
    if (row) {
      const saved = row.user_id === userId ? row.answer : row.partner_answer
      if (saved) setMyAnswer(saved)
    }
    const { data: s } = await supabase.from('ai_advisor_settings').select('sync_streak').eq('user_id', userId).maybeSingle()
    setStreak(s?.sync_streak ?? 0)
    setLoading(false)
  }, [userId, partnerId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!mirror?.id) return
    const ch = supabase.channel(`mirror:${mirror.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sync_mirror', filter: `id=eq.${mirror.id}` }, p => setMirror(p.new))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [mirror?.id])

  async function submitAnswer() {
    if (!myAnswer.trim() || !mirror) return
    setSubmitting(true)
    const isOwner = mirror.user_id === userId
    const field   = isOwner ? 'answer' : 'partner_answer'
    const tField  = isOwner ? 'answered_at' : 'partner_answered_at'
    const update  = { [field]: myAnswer.trim(), [tField]: new Date().toISOString() }
    const pAns    = isOwner ? mirror.partner_answer : mirror.answer
    if (pAns) { const m = checkMatch(myAnswer.trim(), pAns); update.is_matched = m; update.spark_earned = m }
    const { data: u } = await supabase.from('sync_mirror').update(update).eq('id', mirror.id).select().single()
    if (u) setMirror(u)
    if (update.spark_earned) {
      await supabase.from('ai_advisor_settings').upsert({ user_id: userId, sync_streak: streak + 1, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      setStreak(s => s + 1)
    }
    setSubmitting(false)
  }

  const isOwner      = mirror?.user_id === userId
  const myStoredAns  = mirror ? (isOwner ? mirror.answer       : mirror.partner_answer) : null
  const theirAns     = mirror ? (isOwner ? mirror.partner_answer : mirror.answer)       : null
  const bothAnswered = !!(myStoredAns && theirAns)
  const iAnswered    = !!myStoredAns
  const sticker      = streak >= 7

  return (
    <div className={`sm${darkMode ? ' sm-dark' : ''}`}>
      <style>{`
        .sm { background: var(--surface, #fff); min-height: 100%; }
        .sm-dark { background: #080206; }

        /* ── Hero ── */
        .sm-hero {
          position: relative; overflow: hidden;
          padding: 32px 22px 36px;
          background: linear-gradient(155deg, #7A1425 0%, #3D0A14 45%, #130308 100%);
        }
        .sm-orb1 {
          position: absolute; top: -50px; right: -50px; width: 220px; height: 220px; border-radius: 50%;
          background: radial-gradient(circle, rgba(200,51,74,0.5) 0%, transparent 65%);
          animation: smFloat1 7s ease-in-out infinite;
        }
        .sm-orb2 {
          position: absolute; bottom: -40px; left: -30px; width: 160px; height: 160px; border-radius: 50%;
          background: radial-gradient(circle, rgba(139,26,44,0.4) 0%, transparent 65%);
          animation: smFloat2 9s ease-in-out infinite;
        }
        @keyframes smFloat1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-12px,14px)} }
        @keyframes smFloat2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(10px,-10px)} }
        .sm-hero-chip {
          position: relative; z-index: 1;
          display: inline-flex; align-items: center; gap: 7px;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18);
          border-radius: 99px; padding: 5px 13px;
          font-size: 11px; font-weight: 700; letter-spacing: 0.8px;
          text-transform: uppercase; color: rgba(255,255,255,0.75); margin-bottom: 16px;
        }
        .sm-hero-chip-dot { width: 6px; height: 6px; border-radius: 50%; background: #FF8096; animation: smDotPulse 2s ease-in-out infinite; }
        @keyframes smDotPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.7)} }
        .sm-hero-q {
          position: relative; z-index: 1;
          font-family: var(--font-head, Georgia, serif);
          font-size: 21px; font-weight: 700; font-style: italic;
          color: #fff; line-height: 1.4;
          opacity: 0; transform: translateY(10px);
          animation: smHeroIn 0.5s 0.1s ease both;
        }
        @keyframes smHeroIn { to { opacity: 1; transform: translateY(0); } }
        .sm-hero-q-mark { color: rgba(255,130,150,.7); font-size: 42px; line-height: 0; vertical-align: -16px; margin-right: 3px; font-style: normal; }

        /* ── Streak ── */
        .sm-streak {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 20px; border-bottom: 1px solid var(--border, rgba(200,51,74,0.1));
          background: var(--blush, #FBF0F2);
        }
        .sm-dark .sm-streak { background: #180810; border-bottom-color: rgba(200,51,74,0.18); }
        .sm-dots { display: flex; gap: 6px; flex: 1; }
        .sm-dot {
          width: 28px; height: 28px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          border: 1.5px solid rgba(200,51,74,0.2); background: transparent;
          transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        .sm-dot.on {
          background: linear-gradient(135deg, #C8334A, #8B1A2C);
          border-color: transparent;
          animation: smDotPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes smDotPop { from{transform:scale(0)} to{transform:scale(1)} }
        .sm-streak-num { font-size: 13px; font-weight: 700; color: #C8334A; white-space: nowrap; }

        /* ── Body ── */
        .sm-body { padding: 22px 20px 32px; }

        /* Textarea */
        .sm-ta {
          width: 100%; min-height: 130px; resize: none; outline: none;
          background: var(--blush, #FBF0F2); border: 2px solid transparent;
          border-radius: 18px; padding: 16px; font-family: var(--font-body, sans-serif);
          font-size: 16px; color: var(--ink, #1E0A10); line-height: 1.6;
          transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box;
        }
        .sm-dark .sm-ta { background: #1A0810; color: #F5E6EB; }
        .sm-ta:focus { border-color: #C8334A; box-shadow: 0 0 0 4px rgba(200,51,74,0.1); }
        .sm-counter { text-align: right; font-size: 11px; color: var(--muted, #9A6070); margin: 4px 0 12px; }

        /* Submit btn */
        .sm-btn {
          width: 100%; padding: 15px; border: none; border-radius: 16px;
          background: linear-gradient(135deg, #C8334A, #8B1A2C);
          color: white; font-size: 16px; font-weight: 700; cursor: pointer;
          box-shadow: 0 6px 20px rgba(139,26,44,0.35);
          transition: transform 0.15s, box-shadow 0.15s;
          position: relative; overflow: hidden;
          -webkit-tap-highlight-color: transparent;
        }
        .sm-btn:not(:disabled):active { transform: scale(0.97); box-shadow: 0 3px 10px rgba(139,26,44,0.25); }
        .sm-btn:disabled { opacity: 0.45; cursor: default; }
        .sm-btn::after {
          content: ''; position: absolute; top: 0; left: -100%;
          width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          transition: left 0.5s;
        }
        .sm-btn:not(:disabled):hover::after { left: 160%; }
        .sm-hint-txt { text-align: center; font-size: 12px; color: var(--muted, #9A6070); margin-top: 10px; }

        /* Waiting */
        .sm-wait { text-align: center; padding: 36px 0; }
        .sm-wait-ring {
          width: 68px; height: 68px; border-radius: 50%; margin: 0 auto 18px;
          background: rgba(200,51,74,0.08); display: flex; align-items: center; justify-content: center;
          animation: smWaitPulse 2.4s ease-in-out infinite;
        }
        @keyframes smWaitPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.1);opacity:.7} }
        .sm-wait-title { font-size: 17px; font-weight: 700; color: var(--ink,#1E0A10); margin-bottom: 7px; }
        .sm-dark .sm-wait-title { color: #F5E6EB; }
        .sm-wait-sub { font-size: 14px; color: var(--muted,#9A6070); line-height: 1.5; }
        .sm-wait-badge {
          display: inline-block; margin-top: 14px; padding: 10px 18px;
          background: var(--blush,#FBF0F2); border-radius: 12px;
          font-size: 13px; color: var(--muted,#9A6070); font-style: italic;
        }
        .sm-dark .sm-wait-badge { background: #1A0810; }

        /* Match badge */
        .sm-match {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 14px 18px; border-radius: 16px; margin-bottom: 18px;
          background: linear-gradient(135deg, rgba(200,51,74,0.1), rgba(139,26,44,0.06));
          border: 1.5px solid rgba(200,51,74,0.3);
          animation: smMatchBounce 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes smMatchBounce { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
        .sm-match-text { font-weight: 700; font-size: 15px; color: #C8334A; }

        /* Answer cards */
        .sm-answers { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
        .sm-ans-card {
          border-radius: 18px; overflow: hidden;
          box-shadow: 0 4px 16px rgba(0,0,0,0.07);
        }
        .sm-ans-card:nth-child(1) { animation: smAnsLeft  0.4s 0.05s ease both; }
        .sm-ans-card:nth-child(2) { animation: smAnsRight 0.4s 0.15s ease both; }
        @keyframes smAnsLeft  { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }
        @keyframes smAnsRight { from{opacity:0;transform:translateX(16px)}  to{opacity:1;transform:translateX(0)} }
        .sm-ans-label {
          padding: 8px 14px; font-size: 10px; font-weight: 800;
          letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.85);
        }
        .sm-ans-label-you  { background: linear-gradient(135deg, #C8334A, #8B1A2C); }
        .sm-ans-label-them { background: linear-gradient(135deg, #7B3FBE, #3D1A6B); }
        .sm-ans-text {
          padding: 14px; font-size: 15px; line-height: 1.6;
          color: var(--ink,#1E0A10);
          background: var(--blush,#FBF0F2);
        }
        .sm-dark .sm-ans-text { background: #1A0810; color: #F5E6EB; }

        /* Sticker */
        .sm-sticker {
          display: flex; align-items: center; gap: 12px; margin-top: 12px;
          padding: 14px 16px; border-radius: 16px;
          border: 1.5px dashed rgba(200,51,74,0.3);
          background: rgba(200,51,74,0.04);
          animation: smFadeUp 0.4s 0.3s ease both;
        }
        @keyframes smFadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .sm-sticker-text { font-size: 13px; color: var(--muted,#9A6070); flex: 1; line-height: 1.4; }
        .sm-sticker-text strong { color: #C8334A; }

        /* No partner / loading */
        .sm-center { text-align: center; padding: 60px 24px; }
        .sm-center-icon {
          width: 72px; height: 72px; border-radius: 50%;
          background: var(--blush,#FBF0F2); display: flex; align-items: center; justify-content: center;
          margin: 0 auto 18px;
        }
        .sm-dark .sm-center-icon { background: #1A0810; }
        .sm-center-title { font-size: 17px; font-weight: 700; color: var(--ink,#1E0A10); margin-bottom: 7px; }
        .sm-dark .sm-center-title { color: #F5E6EB; }
        .sm-center-sub { font-size: 14px; color: var(--muted,#9A6070); line-height: 1.55; }
        .sm-ring {
          width: 48px; height: 48px; border-radius: 50%;
          border: 3px solid rgba(200,51,74,0.15); border-top-color: #C8334A;
          animation: smSpin 0.9s linear infinite; margin: 0 auto 16px;
        }
        @keyframes smSpin { to{transform:rotate(360deg)} }
      `}</style>

      {loading ? (
        <div className="sm-center" style={{paddingTop:80}}>
          <div className="sm-ring"/>
          <div className="sm-center-sub">Загружаю вопрос дня...</div>
        </div>
      ) : !mirror ? (
        <div className="sm-center">
          <div className="sm-center-icon">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#C8334A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="10" rx="7" ry="9"/><path d="M9 21h6M12 19v2"/>
            </svg>
          </div>
          <div className="sm-center-title">Партнёр не подключён</div>
          <div className="sm-center-sub">Добавьте партнёра в настройках профиля — тогда появится общий вопрос дня.</div>
        </div>
      ) : (
        <>
          <div className="sm-hero">
            <div className="sm-orb1"/><div className="sm-orb2"/>
            <div className="sm-hero-chip">
              <div className="sm-hero-chip-dot"/>
              Вопрос дня
            </div>
            <div className="sm-hero-q">
              <span className="sm-hero-q-mark">«</span>{mirror.question}»
            </div>
          </div>

          <div className="sm-streak">
            <div className="sm-dots">
              {Array.from({length:7}).map((_,i) => (
                <div key={i} className={`sm-dot${i < streak ? ' on' : ''}`} style={i < streak ? {animationDelay:`${i*0.06}s`} : {}}>
                  {i < streak && <HeartFillIcon size={13} color="white"/>}
                </div>
              ))}
            </div>
            <div className="sm-streak-num">{streak}/7</div>
          </div>

          <div className="sm-body">
            {bothAnswered ? (
              <>
                {mirror.is_matched && (
                  <div className="sm-match">
                    <SparkStarIcon size={20} color="#C8334A"/>
                    <span className="sm-match-text">Ваши мысли созвучны</span>
                    <SparkStarIcon size={14} color="rgba(200,51,74,0.5)"/>
                  </div>
                )}
                <div className="sm-answers">
                  <div className="sm-ans-card">
                    <div className="sm-ans-label sm-ans-label-you">Твой ответ</div>
                    <div className="sm-ans-text">{myStoredAns}</div>
                  </div>
                  <div className="sm-ans-card">
                    <div className="sm-ans-label sm-ans-label-them">Ответ партнёра</div>
                    <div className="sm-ans-text">{theirAns}</div>
                  </div>
                </div>
              </>
            ) : iAnswered ? (
              <div className="sm-wait">
                <div className="sm-wait-ring">
                  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#C8334A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="12" cy="10" rx="7" ry="9"/><path d="M9 21h6M12 19v2"/>
                  </svg>
                </div>
                <div className="sm-wait-title">Ответ сохранён</div>
                <div className="sm-wait-sub">Ждём партнёра. Оба ответа откроются<br/>одновременно.</div>
                <div className="sm-wait-badge">Твой ответ скрыт до открытия</div>
              </div>
            ) : (
              <>
                <textarea ref={textareaRef} className="sm-ta" value={myAnswer}
                  onChange={e => setMyAnswer(e.target.value)}
                  placeholder="Пиши честно — партнёр увидит только после своего ответа..." maxLength={500}/>
                <div className="sm-counter">{myAnswer.length}/500</div>
                <button className="sm-btn" onClick={submitAnswer} disabled={!myAnswer.trim() || submitting}>
                  {submitting ? 'Сохраняю...' : 'Отправить ответ'}
                </button>
                <div className="sm-hint-txt">Партнёр не увидит ответ, пока не ответит сам</div>
              </>
            )}

            <div className="sm-sticker">
              {sticker
                ? <UnlockSvg size={22} color="#C8334A"/>
                : <LockSvg   size={22} color="#9A6070"/>}
              <span className="sm-sticker-text">
                {sticker
                  ? <><strong>Стикер разблокирован!</strong> Используй его в чате.</>
                  : <>7 дней синхронности → стикер для чата. Осталось: <strong>{7-streak} дн</strong></>}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
