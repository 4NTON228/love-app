// ══════════════════════════════════════════════════════════════
// TimeCapsule — Капсула времени
//
// Письмо партнёру с отложенной отправкой. Триггеры:
//   • конкретная дата
//   • через N дней
//   • когда поссоримся (нет сообщений 8+ часов)
// При срабатывании отправляется в чат с пометкой «Капсула времени».
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── SVG-иконки ─────────────────────────────────────────────

function CapsuleIcon({ size = 24, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function CalendarIcon({ size = 18, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function ClockIcon({ size = 18, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="12" x2="12" y2="7.5" strokeWidth="2" />
      <line x1="12" y1="12" x2="15.5" y2="14" strokeWidth="1.5" />
    </svg>
  )
}

function HeartBreakIcon({ size = 18, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />
      <path d="M12 5l-2 4 4 1-2 4" strokeDasharray="2 1" />
    </svg>
  )
}

function TrashIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

// ── Метки типов триггера ──────────────────────────────────
const TRIGGER_LABELS = {
  date:  'Конкретная дата',
  days:  'Через N дней',
  fight: 'Когда поссоримся',
}

const TRIGGER_ICONS = {
  date:  CalendarIcon,
  days:  ClockIcon,
  fight: HeartBreakIcon,
}

// ── Форматирование даты на русском ────────────────────────
function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function TimeCapsule({ session, profile, darkMode, onClose }) {
  const userId    = session?.user?.id
  const partnerId = profile?.partner_id

  // ── Состояние ─────────────────────────────────────────────
  const [capsules,  setCapsules]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [view,      setView]      = useState('list')   // 'list' | 'create'
  const [saving,    setSaving]    = useState(false)

  // Форма создания
  const [message,      setMessage]      = useState('')
  const [triggerType,  setTriggerType]  = useState('date')
  const [triggerDate,  setTriggerDate]  = useState('')
  const [triggerDays,  setTriggerDays]  = useState('')
  const [deleteId,     setDeleteId]     = useState(null)

  // ── Загрузка капсул ───────────────────────────────────────
  const loadCapsules = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('time_capsules')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setCapsules(data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => { loadCapsules() }, [loadCapsules])

  // ── Сохранение капсулы ────────────────────────────────────
  async function saveCapsule() {
    if (!message.trim() || !userId || !partnerId) return
    if (triggerType === 'date' && !triggerDate) return
    if (triggerType === 'days' && (!triggerDays || +triggerDays < 1)) return

    setSaving(true)
    const { error } = await supabase.from('time_capsules').insert({
      user_id:      userId,
      partner_id:   partnerId,
      message:      message.trim(),
      trigger_type: triggerType,
      trigger_date: triggerType === 'date' ? new Date(triggerDate).toISOString() : null,
      trigger_days: triggerType === 'days' ? +triggerDays : null,
    })

    if (!error) {
      setMessage('')
      setTriggerDate('')
      setTriggerDays('')
      setView('list')
      await loadCapsules()
    }
    setSaving(false)
  }

  // ── Удаление капсулы ──────────────────────────────────────
  async function deleteCapsule(id) {
    await supabase.from('time_capsules').delete().eq('id', id).eq('user_id', userId)
    setDeleteId(null)
    setCapsules(prev => prev.filter(c => c.id !== id))
  }

  // ── Отображение статуса капсулы ───────────────────────────
  function capsuleStatus(cap) {
    if (cap.is_sent) return 'Доставлено'
    if (cap.trigger_type === 'date' && cap.trigger_date) {
      return `Будет доставлено ${formatDate(cap.trigger_date)}`
    }
    if (cap.trigger_type === 'days' && cap.trigger_days) {
      const sendAt = new Date(cap.created_at)
      sendAt.setDate(sendAt.getDate() + cap.trigger_days)
      const daysLeft = Math.max(0, Math.ceil((sendAt - Date.now()) / 86400000))
      return daysLeft > 0 ? `Осталось ${daysLeft} дн` : 'Скоро будет доставлено'
    }
    if (cap.trigger_type === 'fight') return 'Ждёт ссоры'
    return 'Ожидает'
  }

  return (
    <div className="capsule-container" style={{ padding: '20px', paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
      <style>{`
        .caps-overlay {
          position: fixed; inset: 0; z-index: 300;
          background: rgba(28,10,14,0.75);
          backdrop-filter: blur(10px);
          display: flex; align-items: flex-end; justify-content: center;
          animation: fadeIn 0.2s ease;
        }
        .caps-sheet {
          width: 100%; max-height: 92vh; overflow-y: auto;
          background: var(--surface);
          border-radius: 24px 24px 0 0;
          padding: 20px 20px calc(var(--safe-bottom, 0px) + 28px);
          animation: slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .caps-sheet-dark { background: #1E0A10 !important; }
        .caps-sheet-dark .caps-handle { background: #3D1520; }
        .caps-sheet-dark .caps-close { background: #3D1520; }
        .caps-sheet-dark .caps-title { color: #F5E8EA; }
        .caps-sheet-dark .caps-item { background: #3D1520; }
        .caps-sheet-dark .caps-item-msg { color: #F5E8EA; }
        .caps-sheet-dark .caps-textarea { background: #3D1520; border-color: rgba(232,85,106,0.2); color: #F5E8EA; }
        .caps-sheet-dark .caps-date-input { background: #3D1520; border-color: rgba(232,85,106,0.2); color: #F5E8EA; }
        .caps-sheet-dark .caps-days-input { background: #3D1520; border-color: rgba(232,85,106,0.2); color: #F5E8EA; }
        .caps-sheet-dark .caps-back-btn { border-color: rgba(232,85,106,0.2); color: #8A5060; }
        .caps-sheet-dark .caps-confirm-box { background: #1E0A10; }
        .caps-sheet-dark .caps-del-cancel { background: #3D1520; }
        .caps-handle {
          width: 36px; height: 4px; background: var(--blush-2);
          border-radius: 99px; margin: 0 auto 20px;
        }
        .app.dark .caps-handle { background: #3D1520; }
        .caps-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 20px;
        }
        .caps-title-row { display: flex; align-items: center; gap: 10px; }
        .caps-title {
          font-family: var(--font-display);
          font-size: 22px; font-weight: 600; font-style: italic; color: var(--ink);
        }
        .caps-close {
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--blush); border: none;
          display: flex; align-items: center; justify-content: center;
          color: var(--muted); cursor: pointer;
        }
        .app.dark .caps-close { background: #3D1520; }
        .caps-new-btn {
          width: 100%; padding: 13px;
          background: var(--gradient); color: white; border: none;
          border-radius: 14px; font-family: var(--font-body);
          font-size: 15px; font-weight: 600; cursor: pointer;
          box-shadow: 0 4px 16px rgba(139,26,44,0.3);
          margin-bottom: 20px; transition: opacity 0.2s, transform 0.15s;
        }
        .caps-new-btn:active { opacity: 0.9; transform: scale(0.98); }
        .caps-empty {
          text-align: center; padding: 40px 0;
          color: var(--text-muted); font-size: 14px; line-height: 1.6;
        }
        .caps-list { display: flex; flex-direction: column; gap: 10px; }
        .caps-item {
          background: var(--blush); border: 1px solid var(--border);
          border-radius: 16px; padding: 14px 16px;
          position: relative; overflow: hidden;
        }
        .app.dark .caps-item { background: #3D1520; }
        .caps-item-sent { opacity: 0.6; }
        .caps-item-type {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
          text-transform: uppercase; color: var(--rose); margin-bottom: 6px;
        }
        .caps-item-msg {
          font-size: 14px; color: var(--ink); line-height: 1.5;
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden;
        }
        .caps-item-status {
          font-size: 12px; color: var(--text-muted); margin-top: 6px;
        }
        .caps-item-del {
          position: absolute; top: 12px; right: 12px;
          background: none; border: none;
          color: var(--text-muted); cursor: pointer; padding: 4px;
          transition: color 0.15s;
        }
        .caps-item-del:hover { color: var(--rose); }

        /* Форма создания */
        .caps-form { display: flex; flex-direction: column; gap: 16px; }
        .caps-form-label {
          font-size: 12px; font-weight: 700; letter-spacing: 0.5px;
          text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;
        }
        .caps-textarea {
          width: 100%; background: var(--blush);
          border: 1.5px solid var(--border); border-radius: 16px;
          padding: 14px 16px; font-family: var(--font-body);
          font-size: 15px; color: var(--ink); resize: none;
          min-height: 120px; line-height: 1.6; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .app.dark .caps-textarea {
          background: #3D1520; border-color: rgba(232,85,106,0.2); color: var(--ink);
        }
        .caps-textarea:focus {
          border-color: var(--rose); box-shadow: 0 0 0 3px rgba(200,51,74,0.1);
        }
        .caps-trigger-tabs {
          display: flex; gap: 6px;
        }
        .caps-tab {
          flex: 1; padding: 10px 6px;
          border-radius: 12px; border: 1.5px solid var(--border);
          background: none; cursor: pointer;
          display: flex; flex-direction: column;
          align-items: center; gap: 5px;
          font-family: var(--font-body);
          font-size: 11px; font-weight: 600; color: var(--text-muted);
          transition: border-color 0.2s, background 0.2s, color 0.2s;
        }
        .caps-tab.active {
          border-color: var(--rose);
          background: rgba(200,51,74,0.07);
          color: var(--rose);
        }
        .caps-date-input {
          width: 100%; padding: 12px 14px;
          border: 1.5px solid var(--border); border-radius: 14px;
          background: var(--blush); font-family: var(--font-body);
          font-size: 14px; color: var(--ink); outline: none;
        }
        .app.dark .caps-date-input {
          background: #3D1520; border-color: rgba(232,85,106,0.2); color: var(--ink);
        }
        .caps-date-input:focus { border-color: var(--rose); }
        .caps-days-input {
          width: 100%; padding: 12px 14px;
          border: 1.5px solid var(--border); border-radius: 14px;
          background: var(--blush); font-family: var(--font-body);
          font-size: 14px; color: var(--ink); outline: none;
          -moz-appearance: textfield;
        }
        .caps-days-input::-webkit-inner-spin-button { display: none; }
        .app.dark .caps-days-input {
          background: #3D1520; border-color: rgba(232,85,106,0.2); color: var(--ink);
        }
        .caps-days-input:focus { border-color: var(--rose); }
        .caps-fight-hint {
          background: rgba(200,51,74,0.06);
          border: 1px dashed rgba(200,51,74,0.25);
          border-radius: 12px; padding: 12px 14px;
          font-size: 13px; color: var(--text-muted); line-height: 1.5;
        }
        .caps-save-btn {
          width: 100%; padding: 14px;
          background: var(--gradient); color: white; border: none;
          border-radius: 14px; font-family: var(--font-body);
          font-size: 15px; font-weight: 600; cursor: pointer;
          box-shadow: 0 4px 16px rgba(139,26,44,0.3);
          transition: opacity 0.2s, transform 0.15s;
        }
        .caps-save-btn:active { opacity: 0.9; transform: scale(0.98); }
        .caps-save-btn:disabled { opacity: 0.5; cursor: default; }
        .caps-back-btn {
          width: 100%; padding: 12px; background: transparent;
          border: 1.5px solid var(--border); border-radius: 14px;
          font-family: var(--font-body); font-size: 14px; font-weight: 600;
          color: var(--text-muted); cursor: pointer;
          transition: background 0.15s;
        }
        .caps-back-btn:active { background: var(--blush); }

        /* Диалог подтверждения удаления */
        .caps-confirm-overlay {
          position: fixed; inset: 0; z-index: 400;
          background: rgba(28,10,14,0.65); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          padding: 24px; animation: fadeIn 0.15s ease;
        }
        .caps-confirm-box {
          background: var(--surface); border-radius: 20px;
          padding: 24px; max-width: 300px; width: 100%;
          box-shadow: 0 24px 80px rgba(0,0,0,0.4);
          animation: slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .app.dark .caps-confirm-box { background: #1E0A10; }
        .caps-confirm-title {
          font-family: var(--font-display); font-size: 20px;
          font-weight: 600; color: var(--ink); margin-bottom: 8px;
        }
        .caps-confirm-text { font-size: 14px; color: var(--text-muted); margin-bottom: 20px; }
        .caps-confirm-btns { display: flex; gap: 8px; }
        .caps-del-confirm {
          flex: 1; padding: 11px; background: #C8334A;
          color: white; border: none; border-radius: 12px;
          font-family: var(--font-body); font-size: 14px; font-weight: 600;
          cursor: pointer;
        }
        .caps-del-cancel {
          flex: 1; padding: 11px; background: var(--blush);
          color: var(--text-muted); border: none; border-radius: 12px;
          font-family: var(--font-body); font-size: 14px; cursor: pointer;
        }
        .app.dark .caps-del-cancel { background: #3D1520; }
      `}</style>

      <div className="caps-overlay" onClick={onClose}>
        <div className={`caps-sheet${darkMode ? ' caps-sheet-dark' : ''}`} onClick={e => e.stopPropagation()}>
          <div className="caps-handle" />

          <div className="caps-header">
            <div className="caps-title-row">
              <CapsuleIcon size={22} color="var(--rose)" />
              <span className="caps-title">Капсула времени</span>
            </div>
            <button className="caps-close" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* ── Список капсул ── */}
          {view === 'list' && (
            <>
              <button className="caps-new-btn" onClick={() => setView('create')}>
                Написать капсулу
              </button>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                  Загрузка...
                </div>
              ) : capsules.length === 0 ? (
                <div className="caps-empty">
                  <CapsuleIcon size={40} color="var(--blush-2)" />
                  <p style={{ marginTop: 12 }}>
                    Напиши письмо партнёру — оно откроется<br />в нужный момент.
                  </p>
                </div>
              ) : (
                <div className="caps-list">
                  {capsules.map(cap => {
                    const Icon = TRIGGER_ICONS[cap.trigger_type] ?? CapsuleIcon
                    return (
                      <div
                        key={cap.id}
                        className={`caps-item${cap.is_sent ? ' caps-item-sent' : ''}`}
                      >
                        <div className="caps-item-type">
                          <Icon size={13} color="var(--rose)" />
                          {TRIGGER_LABELS[cap.trigger_type]}
                          {cap.is_sent && <span style={{ marginLeft: 4 }}>— Доставлено</span>}
                        </div>
                        <div className="caps-item-msg">{cap.message}</div>
                        <div className="caps-item-status">{capsuleStatus(cap)}</div>
                        {!cap.is_sent && (
                          <button
                            className="caps-item-del"
                            onClick={() => setDeleteId(cap.id)}
                            aria-label="Удалить"
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Форма создания ── */}
          {view === 'create' && (
            <div className="caps-form">
              <div>
                <div className="caps-form-label">Сообщение</div>
                <textarea
                  className="caps-textarea"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Напиши то, что хочешь сказать в особый момент..."
                  maxLength={1000}
                />
                <div style={{
                  textAlign: 'right', fontSize: 11,
                  color: 'var(--text-muted)', marginTop: 4,
                }}>
                  {message.length}/1000
                </div>
              </div>

              <div>
                <div className="caps-form-label">Когда отправить</div>
                <div className="caps-trigger-tabs">
                  {(['date', 'days', 'fight']).map(type => {
                    const Icon = TRIGGER_ICONS[type]
                    return (
                      <button
                        key={type}
                        className={`caps-tab${triggerType === type ? ' active' : ''}`}
                        onClick={() => setTriggerType(type)}
                      >
                        <Icon size={16} color={triggerType === type ? 'var(--rose)' : 'var(--muted)'} />
                        {TRIGGER_LABELS[type].split(' ')[0]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Поле ввода в зависимости от типа триггера */}
              {triggerType === 'date' && (
                <div>
                  <div className="caps-form-label">Дата отправки</div>
                  <input
                    type="datetime-local"
                    className="caps-date-input"
                    value={triggerDate}
                    onChange={e => setTriggerDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              )}

              {triggerType === 'days' && (
                <div>
                  <div className="caps-form-label">Через сколько дней</div>
                  <input
                    type="number"
                    className="caps-days-input"
                    value={triggerDays}
                    onChange={e => setTriggerDays(e.target.value)}
                    placeholder="Например: 30"
                    min={1}
                    max={3650}
                  />
                </div>
              )}

              {triggerType === 'fight' && (
                <div className="caps-fight-hint">
                  Капсула откроется автоматически, если в чате не будет сообщений
                  8 часов подряд при обычной активности. Идеально для письма-примирения.
                </div>
              )}

              <button
                className="caps-save-btn"
                onClick={saveCapsule}
                disabled={
                  saving ||
                  !message.trim() ||
                  (triggerType === 'date' && !triggerDate) ||
                  (triggerType === 'days' && (!triggerDays || +triggerDays < 1))
                }
              >
                {saving ? 'Сохраняю...' : 'Запечатать капсулу'}
              </button>
              <button className="caps-back-btn" onClick={() => setView('list')}>
                Назад
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Диалог подтверждения удаления */}
      {deleteId && (
        <div className="caps-confirm-overlay" onClick={() => setDeleteId(null)}>
          <div className="caps-confirm-box" onClick={e => e.stopPropagation()}>
            <div className="caps-confirm-title">Удалить капсулу?</div>
            <p className="caps-confirm-text">
              Сообщение будет удалено и не отправится партнёру.
            </p>
            <div className="caps-confirm-btns">
              <button className="caps-del-confirm" onClick={() => deleteCapsule(deleteId)}>
                Удалить
              </button>
              <button className="caps-del-cancel" onClick={() => setDeleteId(null)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
