// ══════════════════════════════════════════════════════════════
// SyncMirror — Игра «Зеркало»
//
// Каждый день в 20:00 оба партнёра получают одинаковый вопрос.
// Каждый отвечает, не видя ответа другого. Ответы открываются,
// когда оба написали. Совпадение → +1 к счётчику синхронности.
// 7 дней подряд → разблокируется стикер для чата.
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'

// Резервный банк вопросов (если edge function ещё не сработал)
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

// Иконка зеркала — SVG
function MirrorIcon({ size = 24, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="10" rx="7" ry="9" />
      <path d="M9 21h6" />
      <path d="M12 19v2" />
    </svg>
  )
}

// Иконка искры / звезды синхронности
function SparkIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color} stroke="none">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  )
}

// Иконка замка (стикер заблокирован)
function LockIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  )
}

// Иконка разблокировки
function UnlockIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 017.9-.5" />
    </svg>
  )
}

export default function SyncMirror({ session, profile, darkMode, onClose }) {
  const userId    = session?.user?.id
  const partnerId = profile?.partner_id

  // ── Состояние компонента ─────────────────────────────────
  const [loading,     setLoading]     = useState(true)
  const [mirror,      setMirror]      = useState(null)   // текущая запись sync_mirror
  const [myAnswer,    setMyAnswer]    = useState('')      // черновик ответа
  const [submitting,  setSubmitting]  = useState(false)
  const [streak,      setStreak]      = useState(0)       // серия дней
  const [settings,    setSettings]    = useState(null)    // ai_advisor_settings
  const textareaRef = useRef(null)

  // ── Загрузка данных ──────────────────────────────────────
  const load = useCallback(async () => {
    if (!userId || !partnerId) { setLoading(false); return }

    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)

    // Ищем запись на сегодня (пользователь мог быть как user_id, так и partner_id)
    const { data: rows } = await supabase
      .from('sync_mirror')
      .select('*')
      .or(`user_id.eq.${userId},partner_id.eq.${userId}`)
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${today}T23:59:59Z`)
      .order('created_at', { ascending: false })
      .limit(1)

    let row = rows?.[0] ?? null

    // Если записи ещё нет — создаём сами (резервный вопрос)
    if (!row) {
      const dayOfYear = Math.floor(
        (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000,
      )
      const question = FALLBACK_QUESTIONS[dayOfYear % FALLBACK_QUESTIONS.length]

      const { data: created } = await supabase
        .from('sync_mirror')
        .insert({ user_id: userId, partner_id: partnerId, question })
        .select()
        .single()

      row = created
    }

    setMirror(row)

    // Подставляем уже сохранённый черновик
    if (row) {
      const isOwner = row.user_id === userId
      const saved   = isOwner ? row.answer : row.partner_answer
      if (saved) setMyAnswer(saved)
    }

    // Настройки советчика (счётчик серии)
    const { data: s } = await supabase
      .from('ai_advisor_settings')
      .select('sync_streak')
      .eq('user_id', userId)
      .maybeSingle()

    setStreak(s?.sync_streak ?? 0)
    setLoading(false)
  }, [userId, partnerId])

  useEffect(() => { load() }, [load])

  // Реалтайм — когда партнёр ответил
  useEffect(() => {
    if (!mirror?.id) return
    const channel = supabase
      .channel(`mirror:${mirror.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'sync_mirror',
        filter: `id=eq.${mirror.id}`,
      }, payload => setMirror(payload.new))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [mirror?.id])

  // ── Отправка ответа ──────────────────────────────────────
  async function submitAnswer() {
    if (!myAnswer.trim() || !mirror) return
    setSubmitting(true)

    const isOwner = mirror.user_id === userId
    const field   = isOwner ? 'answer' : 'partner_answer'
    const timeField = isOwner ? 'answered_at' : 'partner_answered_at'

    const update = {
      [field]:    myAnswer.trim(),
      [timeField]: new Date().toISOString(),
    }

    // Проверяем совпадение, если партнёр уже ответил
    const partnerAns = isOwner ? mirror.partner_answer : mirror.answer
    if (partnerAns) {
      const matched = checkMatch(myAnswer.trim(), partnerAns)
      update.is_matched   = matched
      update.spark_earned = matched
    }

    const { data: updated } = await supabase
      .from('sync_mirror')
      .update(update)
      .eq('id', mirror.id)
      .select()
      .single()

    if (updated) setMirror(updated)

    // Обновляем серию в настройках, если совпало
    if (update.spark_earned) {
      await supabase
        .from('ai_advisor_settings')
        .upsert({ user_id: userId, sync_streak: streak + 1, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' })
      setStreak(s => s + 1)
    }

    setSubmitting(false)
  }

  // ── Простая проверка созвучности ответов ─────────────────
  function checkMatch(a, b) {
    const normalize = s => s.toLowerCase().replace(/[^а-яёa-z0-9\s]/g, '').trim()
    const wordsA = new Set(normalize(a).split(/\s+/).filter(w => w.length > 3))
    const wordsB = new Set(normalize(b).split(/\s+/).filter(w => w.length > 3))
    if (wordsA.size === 0 || wordsB.size === 0) return false
    let common = 0
    wordsA.forEach(w => { if (wordsB.has(w)) common++ })
    // Считаем совпадением: > 30% общих значимых слов
    return common / Math.max(wordsA.size, wordsB.size) > 0.3
  }

  // ── Производные состояния ────────────────────────────────
  const isOwner      = mirror?.user_id === userId
  const myStoredAns  = mirror ? (isOwner ? mirror.answer       : mirror.partner_answer) : null
  const theirAns     = mirror ? (isOwner ? mirror.partner_answer : mirror.answer)       : null
  const bothAnswered = !!(myStoredAns && theirAns)
  const iAnswered    = !!myStoredAns
  const sticker      = streak >= 7  // разблокирован стикер

  return createPortal(
    <>
      <style>{`
        .mirror-overlay {
          position: fixed; inset: 0; z-index: 300;
          background: rgba(28,10,14,0.75);
          backdrop-filter: blur(10px);
          display: flex; align-items: flex-end; justify-content: center;
          animation: fadeIn 0.2s ease;
        }
        .mirror-sheet {
          width: 100%; max-height: 92vh; overflow-y: auto;
          background: var(--surface);
          border-radius: 24px 24px 0 0;
          padding: 20px 20px calc(var(--safe-bottom, 0px) + 24px);
          animation: slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .mirror-sheet-dark { background: #1E0A10 !important; }
        .mirror-sheet-dark .mirror-handle { background: #3D1520; }
        .mirror-sheet-dark .mirror-close { background: #3D1520; }
        .mirror-sheet-dark .mirror-textarea { background: #3D1520; border-color: rgba(232,85,106,0.2); color: #F5E8EA; }
        .mirror-sheet-dark .mirror-answer-card { background: #3D1520; }
        .mirror-sheet-dark .mirror-streak-row { background: #3D1520; }
        .mirror-sheet-dark .mirror-title { color: #F5E8EA; }
        .mirror-sheet-dark .mirror-answer-text { color: #F5E8EA; }
        .mirror-handle {
          width: 36px; height: 4px;
          background: var(--blush-2); border-radius: 99px;
          margin: 0 auto 20px;
        }
        .app.dark .mirror-handle { background: #3D1520; }
        .mirror-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 20px;
        }
        .mirror-title-row {
          display: flex; align-items: center; gap: 10px;
        }
        .mirror-title {
          font-family: var(--font-display);
          font-size: 22px; font-weight: 600; font-style: italic;
          color: var(--ink);
        }
        .mirror-close {
          width: 32px; height: 32px;
          border-radius: 50%;
          background: var(--blush); border: none;
          display: flex; align-items: center; justify-content: center;
          color: var(--muted); cursor: pointer;
        }
        .app.dark .mirror-close { background: #3D1520; }
        .mirror-question-card {
          background: var(--gradient);
          border-radius: 18px;
          padding: 20px;
          margin-bottom: 20px;
          position: relative; overflow: hidden;
        }
        .mirror-question-card::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 60%);
          pointer-events: none; border-radius: inherit;
        }
        .mirror-q-label {
          font-size: 11px; font-weight: 700; letter-spacing: 1px;
          text-transform: uppercase; color: rgba(255,255,255,0.6);
          margin-bottom: 8px;
        }
        .mirror-q-text {
          font-family: var(--font-display);
          font-size: 19px; font-weight: 600; font-style: italic;
          color: white; line-height: 1.4;
        }
        .mirror-textarea {
          width: 100%;
          background: var(--blush); border: 1.5px solid var(--border);
          border-radius: 16px; padding: 14px 16px;
          font-family: var(--font-body); font-size: 15px;
          color: var(--ink); resize: none; outline: none;
          min-height: 100px; line-height: 1.6;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .app.dark .mirror-textarea {
          background: #3D1520; border-color: rgba(232,85,106,0.2);
          color: var(--ink);
        }
        .mirror-textarea:focus {
          border-color: var(--rose);
          box-shadow: 0 0 0 3px rgba(200,51,74,0.1);
        }
        .mirror-submit {
          width: 100%; margin-top: 12px;
          background: var(--gradient);
          color: white; border: none;
          border-radius: 14px; padding: 14px;
          font-family: var(--font-body); font-size: 15px; font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
          box-shadow: 0 4px 16px rgba(139,26,44,0.3);
        }
        .mirror-submit:active { transform: scale(0.98); opacity: 0.9; }
        .mirror-submit:disabled { opacity: 0.5; cursor: default; }
        .mirror-waiting {
          text-align: center; padding: 20px 0;
        }
        .mirror-waiting-icon {
          width: 48px; height: 48px;
          border-radius: 50%;
          background: rgba(200,51,74,0.08);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 12px;
          animation: pulse 2s ease-in-out infinite;
        }
        .mirror-waiting-text {
          font-size: 14px; color: var(--text-muted); line-height: 1.5;
        }
        .mirror-answers {
          display: flex; flex-direction: column; gap: 12px;
          margin-bottom: 16px;
        }
        .mirror-answer-card {
          background: var(--blush);
          border-radius: 16px; padding: 14px 16px;
          border: 1px solid var(--border);
          animation: slideUp 0.3s ease both;
        }
        .app.dark .mirror-answer-card { background: #3D1520; }
        .mirror-answer-who {
          font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
          text-transform: uppercase; color: var(--rose);
          margin-bottom: 6px;
        }
        .mirror-answer-text {
          font-size: 15px; color: var(--ink); line-height: 1.5;
        }
        .mirror-match-badge {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          background: linear-gradient(135deg, rgba(200,51,74,0.1), rgba(139,26,44,0.08));
          border: 1.5px solid rgba(200,51,74,0.25);
          border-radius: 14px; padding: 12px 16px;
          margin-bottom: 16px; animation: slideUp 0.4s ease both;
        }
        .mirror-match-text {
          font-weight: 600; font-size: 14px; color: var(--rose);
        }
        .mirror-streak-row {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--blush); border-radius: 14px;
          padding: 12px 16px; border: 1px solid var(--border);
        }
        .app.dark .mirror-streak-row { background: #3D1520; }
        .mirror-streak-label {
          font-size: 13px; color: var(--text-muted); font-weight: 500;
        }
        .mirror-streak-value {
          display: flex; align-items: center; gap: 6px;
          font-family: var(--font-display);
          font-size: 20px; font-weight: 700; color: var(--rose);
        }
        .mirror-sticker-row {
          display: flex; align-items: center; gap: 10px;
          background: rgba(200,51,74,0.06);
          border: 1.5px dashed rgba(200,51,74,0.3);
          border-radius: 14px; padding: 12px 16px;
          margin-top: 12px;
        }
        .mirror-sticker-text {
          font-size: 13px; color: var(--text-muted); line-height: 1.4; flex: 1;
        }
        .mirror-sticker-text strong { color: var(--rose); }
      `}</style>

      <div className="mirror-overlay" onClick={onClose}>
        <div className={`mirror-sheet${darkMode ? ' mirror-sheet-dark' : ''}`} onClick={e => e.stopPropagation()}>
          <div className="mirror-handle" />

          <div className="mirror-header">
            <div className="mirror-title-row">
              <MirrorIcon size={22} color="var(--rose)" />
              <span className="mirror-title">Зеркало</span>
            </div>
            <button className="mirror-close" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <div style={{ animation: 'pulse 1.5s infinite' }}>
                <MirrorIcon size={32} color="var(--muted)" />
              </div>
              <p style={{ marginTop: 12, fontSize: 14 }}>Загрузка...</p>
            </div>
          ) : !mirror ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                Сначала добавьте партнёра в настройках.
              </p>
            </div>
          ) : (
            <>
              {/* Вопрос дня */}
              <div className="mirror-question-card">
                <div className="mirror-q-label">Вопрос дня</div>
                <div className="mirror-q-text">{mirror.question}</div>
              </div>

              {/* Состояние: ответы раскрыты */}
              {bothAnswered ? (
                <>
                  {mirror.is_matched && (
                    <div className="mirror-match-badge">
                      <SparkIcon size={18} color="var(--rose)" />
                      <span className="mirror-match-text">Ваши ответы созвучны</span>
                    </div>
                  )}
                  <div className="mirror-answers">
                    <div className="mirror-answer-card" style={{ animationDelay: '0s' }}>
                      <div className="mirror-answer-who">Ты</div>
                      <div className="mirror-answer-text">{myStoredAns}</div>
                    </div>
                    <div className="mirror-answer-card" style={{ animationDelay: '0.1s' }}>
                      <div className="mirror-answer-who">Партнёр</div>
                      <div className="mirror-answer-text">{theirAns}</div>
                    </div>
                  </div>
                </>
              ) : iAnswered ? (
                /* Ждём партнёра */
                <div className="mirror-waiting">
                  <div className="mirror-waiting-icon">
                    <MirrorIcon size={22} color="var(--rose)" />
                  </div>
                  <p className="mirror-waiting-text">
                    Твой ответ сохранён.<br />
                    Ждём, когда партнёр ответит — тогда увидите оба.
                  </p>
                  <div style={{
                    marginTop: 12, padding: '12px 16px',
                    background: 'var(--blush)', borderRadius: 14,
                    fontSize: 14, color: 'var(--text-muted)', fontStyle: 'italic',
                  }}>
                    Твой ответ скрыт до открытия
                  </div>
                </div>
              ) : (
                /* Форма ответа */
                <>
                  <textarea
                    ref={textareaRef}
                    className="mirror-textarea"
                    value={myAnswer}
                    onChange={e => setMyAnswer(e.target.value)}
                    placeholder="Напиши свой ответ честно и без цензуры..."
                    maxLength={500}
                  />
                  <div style={{
                    textAlign: 'right', fontSize: 11,
                    color: 'var(--text-muted)', marginTop: 4,
                  }}>
                    {myAnswer.length}/500
                  </div>
                  <button
                    className="mirror-submit"
                    onClick={submitAnswer}
                    disabled={!myAnswer.trim() || submitting}
                  >
                    {submitting ? 'Сохраняю...' : 'Отправить ответ'}
                  </button>
                  <p style={{
                    textAlign: 'center', fontSize: 12,
                    color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.4,
                  }}>
                    Партнёр не увидит твой ответ, пока не ответит сам
                  </p>
                </>
              )}

              {/* Счётчик серии */}
              <div style={{ marginTop: 16 }}>
                <div className="mirror-streak-row">
                  <span className="mirror-streak-label">Синхронность подряд</span>
                  <div className="mirror-streak-value">
                    <SparkIcon size={16} color="var(--rose)" />
                    {streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'}
                  </div>
                </div>

                {/* Прогресс до стикера */}
                <div className="mirror-sticker-row">
                  {sticker
                    ? <UnlockIcon size={20} color="var(--rose)" />
                    : <LockIcon size={20} color="var(--muted)" />}
                  <span className="mirror-sticker-text">
                    {sticker
                      ? <><strong>Стикер разблокирован!</strong> Используй его в чате.</>
                      : <>7 дней синхронности → стикер для чата. Осталось: <strong>{7 - streak} дн</strong></>}
                  </span>
                  {/* Прогресс-бар */}
                  <div style={{
                    position: 'absolute', display: 'none',
                  }} />
                </div>

                {/* Визуальный прогресс */}
                <div style={{
                  marginTop: 8,
                  height: 4, background: 'var(--blush-2)',
                  borderRadius: 99, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min((streak / 7) * 100, 100)}%`,
                    background: 'var(--gradient)',
                    borderRadius: 99,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
