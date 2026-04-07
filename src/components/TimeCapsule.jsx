import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function TrashIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  )
}

// Proper function components for trigger icons — fixes the JSX-in-array bug
function CalIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function DaysIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="12" x2="12" y2="7.5" strokeWidth="2" />
      <line x1="12" y1="12" x2="15.5" y2="14" strokeWidth="1.5" />
    </svg>
  )
}

function FightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />
    </svg>
  )
}

const TRIGGERS = [
  { id: 'date',  label: 'Дата',  desc: 'Конкретная дата', Icon: CalIcon },
  { id: 'days',  label: 'Дни',   desc: 'Через N дней',    Icon: DaysIcon },
  { id: 'fight', label: 'Ссора', desc: 'Если замолчим',   Icon: FightIcon },
]

const STATUS_META = {
  sent:    { label: 'Доставлено', color: '#4CAF50',  bg: 'rgba(76,175,80,0.1)'  },
  pending: { label: 'Ожидает',   color: '#C8A84B',  bg: 'rgba(200,168,75,0.1)' },
  fight:   { label: 'Ждёт ссоры', color: '#C8334A', bg: 'rgba(200,51,74,0.1)'  },
}

export default function TimeCapsule({ session, profile, darkMode }) {
  const userId    = session?.user?.id
  const partnerId = profile?.partner_id

  const [capsules,     setCapsules]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [view,         setView]         = useState('list')
  const [saving,       setSaving]       = useState(false)
  const [saveError,    setSaveError]    = useState(null)
  const [message,      setMessage]      = useState('')
  const [triggerType,  setTriggerType]  = useState('date')
  const [triggerDate,  setTriggerDate]  = useState('')
  const [triggerDays,  setTriggerDays]  = useState('')
  const [deleteId,     setDeleteId]     = useState(null)

  const loadCapsules = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase.from('time_capsules').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false })
    setCapsules(data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => { loadCapsules() }, [loadCapsules])

  async function saveCapsule() {
    if (!message.trim() || !userId || !partnerId) return
    if (triggerType === 'date' && !triggerDate) return
    if (triggerType === 'days' && (!triggerDays || +triggerDays < 1)) return
    setSaving(true)
    setSaveError(null)
    const { error } = await supabase.from('time_capsules').insert({
      user_id: userId, partner_id: partnerId, message: message.trim(),
      trigger_type: triggerType,
      trigger_date: triggerType === 'date' ? new Date(triggerDate).toISOString() : null,
      trigger_days: triggerType === 'days' ? +triggerDays : null,
    })
    if (!error) {
      setMessage(''); setTriggerDate(''); setTriggerDays(''); setView('list'); await loadCapsules()
    } else {
      setSaveError('Не удалось сохранить капсулу. Попробуйте ещё раз.')
    }
    setSaving(false)
  }

  async function deleteCapsule(id) {
    await supabase.from('time_capsules').delete().eq('id', id).eq('user_id', userId)
    setDeleteId(null)
    setCapsules(prev => prev.filter(c => c.id !== id))
  }

  function capsuleStatus(cap) {
    if (cap.is_sent) return { text: 'Доставлено', ...STATUS_META.sent }
    if (cap.trigger_type === 'fight') return { text: 'Ждёт ссоры', ...STATUS_META.fight }
    if (cap.trigger_type === 'date' && cap.trigger_date)
      return { text: `Отправится ${formatDate(cap.trigger_date)}`, ...STATUS_META.pending }
    if (cap.trigger_type === 'days' && cap.trigger_days) {
      const sendAt = new Date(cap.created_at)
      sendAt.setDate(sendAt.getDate() + cap.trigger_days)
      const daysLeft = Math.max(0, Math.ceil((sendAt - Date.now()) / 86400000))
      return { text: daysLeft > 0 ? `Осталось ${daysLeft} дн` : 'Скоро', ...STATUS_META.pending }
    }
    return { text: 'Ожидает', ...STATUS_META.pending }
  }

  return (
    <div className={`tc-page${darkMode ? ' tc-dark' : ''}`}>
      <style>{`
        .tc-page { background: var(--surface, #fff); min-height: 100%; }
        .tc-dark  { background: #0A0206; }

        @keyframes tcFloat1 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-16px) scale(1.03); }
        }
        @keyframes tcFloat2 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(12px) scale(0.97); }
        }
        @keyframes tcIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tcSlideRight {
          from { opacity: 0; transform: translateX(32px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes tcFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tcConfirmIn {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes tcSpin { to { transform: rotate(360deg); } }
        @keyframes tcCountIn {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes tcShine {
          from { background-position: -200% center; }
          to   { background-position: 200% center; }
        }

        /* Hero */
        .tc-hero {
          position: relative; overflow: hidden;
          padding: 28px 20px 32px;
          background: linear-gradient(160deg, #3D1A6B 0%, #1E0A38 50%, #080212 100%);
        }
        .tc-hero-orb1 {
          position: absolute; top: -40px; right: -40px;
          width: 200px; height: 200px; border-radius: 50%;
          background: radial-gradient(circle, rgba(123,63,190,0.45) 0%, transparent 70%);
          pointer-events: none;
          animation: tcFloat1 7s ease-in-out infinite;
        }
        .tc-hero-orb2 {
          position: absolute; bottom: -20px; left: -50px;
          width: 150px; height: 150px; border-radius: 50%;
          background: radial-gradient(circle, rgba(61,26,107,0.5) 0%, transparent 70%);
          pointer-events: none;
          animation: tcFloat2 9s ease-in-out infinite;
        }
        .tc-hero-tag {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
          border-radius: 99px; padding: 4px 12px;
          font-size: 11px; font-weight: 700; letter-spacing: 0.8px;
          text-transform: uppercase; color: rgba(255,255,255,0.7);
          margin-bottom: 14px; position: relative; z-index: 1;
        }
        .tc-hero-title {
          font-family: var(--font-head, Georgia, serif);
          font-size: 26px; font-weight: 700;
          color: #FFFFFF; line-height: 1.2; margin-bottom: 8px;
          position: relative; z-index: 1;
        }
        .tc-hero-sub {
          font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.5;
          position: relative; z-index: 1;
        }
        .tc-hero-count {
          display: inline-block; margin-top: 12px;
          background: rgba(255,255,255,0.12); border-radius: 10px;
          padding: 6px 14px; font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.85);
          position: relative; z-index: 1;
          animation: tcCountIn 0.5s 0.2s cubic-bezier(0.34,1.56,0.64,1) both;
        }

        /* No partner notice */
        .tc-no-partner {
          margin: 16px; padding: 18px 20px;
          border-radius: 18px;
          background: rgba(123,63,190,0.08);
          border: 1.5px dashed rgba(123,63,190,0.3);
          display: flex; align-items: center; gap: 14px;
        }
        .tc-no-partner-icon {
          width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%;
          background: rgba(123,63,190,0.15);
          display: flex; align-items: center; justify-content: center;
        }
        .tc-no-partner-text { font-size: 14px; color: var(--muted, #9A6070); line-height: 1.5; }
        .tc-no-partner-text strong { color: var(--ink, #1E0A10); display: block; font-size: 15px; margin-bottom: 2px; }
        .tc-dark .tc-no-partner-text strong { color: #F5E6EB; }

        /* New btn */
        .tc-new-btn {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          margin: 16px; padding: 15px;
          background: linear-gradient(135deg, #7B3FBE, #3D1A6B);
          color: white; border: none; border-radius: 18px;
          font-size: 15px; font-weight: 700; cursor: pointer;
          box-shadow: 0 6px 20px rgba(61,26,107,0.45);
          -webkit-tap-highlight-color: transparent;
          transition: transform 0.15s, box-shadow 0.15s;
          position: relative; overflow: hidden;
        }
        .tc-new-btn:active { transform: scale(0.97); box-shadow: 0 3px 10px rgba(61,26,107,0.3); }
        .tc-new-btn:hover::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%);
          background-size: 200% auto;
          animation: tcShine 0.6s linear;
        }

        /* List */
        .tc-list { padding: 4px 16px 20px; display: flex; flex-direction: column; gap: 12px; }

        .tc-card {
          border-radius: 20px; overflow: hidden;
          border: 1px solid var(--border, rgba(200,51,74,0.1));
          background: var(--surface, #fff);
          opacity: 0;
          animation: tcIn 0.38s ease both;
          position: relative;
        }
        .tc-dark .tc-card { background: #140820; border-color: rgba(123,63,190,0.2); }
        .tc-card-sent { opacity: 0.55; }

        .tc-card-top {
          padding: 14px 16px 0;
          display: flex; align-items: center; justify-content: space-between;
        }
        .tc-card-badge {
          display: flex; align-items: center; gap: 6px;
          border-radius: 99px; padding: 4px 10px;
          font-size: 11px; font-weight: 700;
        }
        .tc-card-del {
          background: none; border: none; cursor: pointer;
          color: var(--muted, #9A6070); padding: 4px;
          -webkit-tap-highlight-color: transparent;
          transition: color 0.15s;
        }
        .tc-card-del:active { color: #C8334A; }

        .tc-card-msg {
          padding: 10px 16px;
          font-size: 15px; color: var(--ink, #1E0A10); line-height: 1.55;
          display: -webkit-box; -webkit-line-clamp: 3;
          -webkit-box-orient: vertical; overflow: hidden;
        }
        .tc-dark .tc-card-msg { color: #F5E6EB; }

        .tc-card-footer {
          padding: 8px 16px 14px;
          display: flex; align-items: center; gap: 6px;
          font-size: 12px; color: var(--muted, #9A6070);
        }

        /* Empty */
        .tc-empty {
          text-align: center; padding: 60px 20px;
        }
        .tc-empty-icon {
          width: 80px; height: 80px; border-radius: 50%;
          background: linear-gradient(135deg, rgba(123,63,190,0.12), rgba(61,26,107,0.06));
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px;
        }
        .tc-empty-title { font-size: 17px; font-weight: 700; color: var(--ink, #1E0A10); margin-bottom: 8px; }
        .tc-dark .tc-empty-title { color: #F5E6EB; }
        .tc-empty-text { font-size: 14px; color: var(--muted, #9A6070); line-height: 1.6; }

        /* Create form — slides in from right */
        .tc-form {
          padding: 20px 16px; display: flex; flex-direction: column; gap: 20px;
          animation: tcSlideRight 0.35s cubic-bezier(0.25,0.46,0.45,0.94) both;
        }

        .tc-form-section-label {
          font-size: 11px; font-weight: 800; letter-spacing: 0.8px;
          text-transform: uppercase; color: var(--muted, #9A6070);
          margin-bottom: 8px;
        }
        .tc-textarea {
          width: 100%; min-height: 140px; resize: none; outline: none;
          background: var(--blush, #FBF0F2);
          border: 2px solid transparent; border-radius: 18px; padding: 16px;
          font-family: var(--font-body, sans-serif); font-size: 16px;
          color: var(--ink, #1E0A10); line-height: 1.6;
          transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box;
        }
        .tc-dark .tc-textarea { background: #1A0820; color: #F5E6EB; }
        .tc-textarea:focus {
          border-color: #7B3FBE;
          box-shadow: 0 0 0 4px rgba(123,63,190,0.12);
        }
        .tc-counter { text-align: right; font-size: 11px; color: var(--muted, #9A6070); margin-top: 4px; }

        .tc-trigger-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .tc-trigger-btn {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          padding: 14px 8px; border-radius: 16px;
          border: 2px solid var(--border, rgba(200,51,74,0.1));
          background: var(--blush, #FBF0F2);
          cursor: pointer; -webkit-tap-highlight-color: transparent;
          transition: all 0.2s;
        }
        .tc-dark .tc-trigger-btn { background: #1A0820; border-color: rgba(123,63,190,0.2); }
        .tc-trigger-btn.active {
          border-color: #7B3FBE; background: rgba(123,63,190,0.1);
          color: #7B3FBE;
        }
        .tc-trigger-icon { color: var(--muted, #9A6070); }
        .tc-trigger-btn.active .tc-trigger-icon { color: #7B3FBE; }
        .tc-trigger-label { font-size: 12px; font-weight: 700; color: var(--muted, #9A6070); }
        .tc-trigger-btn.active .tc-trigger-label { color: #7B3FBE; }
        .tc-trigger-desc { font-size: 10px; color: var(--muted, #9A6070); text-align: center; }

        .tc-input {
          width: 100%; padding: 14px 16px;
          border: 2px solid var(--border, rgba(200,51,74,0.1)); border-radius: 16px;
          background: var(--blush, #FBF0F2); font-size: 15px;
          color: var(--ink, #1E0A10); outline: none; box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .tc-dark .tc-input { background: #1A0820; border-color: rgba(123,63,190,0.2); color: #F5E6EB; }
        .tc-input:focus { border-color: #7B3FBE; }
        .tc-input::-webkit-inner-spin-button { display: none; }

        .tc-fight-info {
          background: rgba(123,63,190,0.07);
          border: 1.5px dashed rgba(123,63,190,0.3);
          border-radius: 16px; padding: 16px;
          font-size: 14px; color: var(--muted, #9A6070); line-height: 1.6;
        }

        /* Save error */
        .tc-save-error {
          background: rgba(200,51,74,0.08);
          border: 1px solid rgba(200,51,74,0.25);
          border-radius: 12px; padding: 12px 14px;
          font-size: 14px; color: #C8334A; line-height: 1.4;
          display: flex; align-items: center; gap: 8px;
        }

        /* Save button with shimmer hover */
        .tc-save-btn {
          padding: 15px; border: none; border-radius: 16px;
          background: linear-gradient(135deg, #7B3FBE, #3D1A6B);
          color: white; font-size: 16px; font-weight: 700;
          cursor: pointer; letter-spacing: 0.2px;
          box-shadow: 0 6px 20px rgba(61,26,107,0.4);
          transition: transform 0.15s, box-shadow 0.15s;
          -webkit-tap-highlight-color: transparent;
          position: relative; overflow: hidden;
        }
        .tc-save-btn::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.22) 50%, transparent 100%);
          background-size: 200% auto;
          opacity: 0; transition: opacity 0.2s;
        }
        .tc-save-btn:hover::after { opacity: 1; animation: tcShine 0.65s linear; }
        .tc-save-btn:active { transform: scale(0.97); box-shadow: 0 3px 10px rgba(61,26,107,0.3); }
        .tc-save-btn:disabled { opacity: 0.45; cursor: default; }
        .tc-cancel-btn {
          padding: 14px; border-radius: 16px;
          background: transparent; border: 2px solid var(--border, rgba(200,51,74,0.1));
          font-size: 15px; font-weight: 600; color: var(--muted, #9A6070); cursor: pointer;
          transition: background 0.15s;
        }
        .tc-cancel-btn:active { background: rgba(123,63,190,0.05); }
        .tc-dark .tc-cancel-btn { border-color: rgba(123,63,190,0.2); }

        /* Delete confirm */
        .tc-confirm-overlay {
          position: fixed; inset: 0; z-index: 500;
          background: rgba(10,2,6,0.7); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center; padding: 24px;
          animation: tcFade 0.15s ease;
        }
        .tc-confirm-box {
          background: var(--surface, #fff); border-radius: 24px;
          padding: 24px; width: 100%; max-width: 300px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
          animation: tcConfirmIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .tc-dark .tc-confirm-box { background: #1A0820; }
        .tc-confirm-title { font-size: 19px; font-weight: 700; color: var(--ink, #1E0A10); margin-bottom: 8px; }
        .tc-dark .tc-confirm-title { color: #F5E6EB; }
        .tc-confirm-text { font-size: 14px; color: var(--muted, #9A6070); margin-bottom: 20px; line-height: 1.5; }
        .tc-confirm-btns { display: flex; gap: 10px; }
        .tc-confirm-del {
          flex: 1; padding: 12px; background: #C8334A; color: white;
          border: none; border-radius: 14px; font-size: 15px; font-weight: 700; cursor: pointer;
        }
        .tc-confirm-cancel {
          flex: 1; padding: 12px; background: var(--blush, #FBF0F2); color: var(--muted, #9A6070);
          border: none; border-radius: 14px; font-size: 15px; cursor: pointer;
        }
        .tc-dark .tc-confirm-cancel { background: #3D1520; }

        /* Loading */
        .tc-loading { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 60px 20px; }
        .tc-loading-ring {
          width: 48px; height: 48px; border-radius: 50%;
          border: 3px solid rgba(123,63,190,0.15); border-top-color: #7B3FBE;
          animation: tcSpin 0.9s linear infinite;
        }
        .tc-loading-text { font-size: 14px; color: var(--muted, #9A6070); }
      `}</style>

      {/* Hero */}
      <div className="tc-hero">
        <div className="tc-hero-orb1" />
        <div className="tc-hero-orb2" />
        <div className="tc-hero-tag">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="rgba(255,255,255,0.7)">
            <circle cx="12" cy="12" r="10" />
          </svg>
          Капсула времени
        </div>
        <div className="tc-hero-title">Письма<br />из прошлого</div>
        <div className="tc-hero-sub">Напиши партнёру сообщение, которое откроется в особый момент</div>
        {capsules.length > 0 && (
          <div className="tc-hero-count">{capsules.length} {capsules.length === 1 ? 'капсула' : capsules.length < 5 ? 'капсулы' : 'капсул'}</div>
        )}
      </div>

      {view === 'create' ? (
        <div className="tc-form">
          {/* No partner guard */}
          {!partnerId && (
            <div className="tc-no-partner">
              <div className="tc-no-partner-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#7B3FBE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="tc-no-partner-text">
                <strong>Партнёр не подключён</strong>
                Добавьте партнёра в настройках профиля, чтобы создать капсулу.
              </div>
            </div>
          )}

          <div>
            <div className="tc-form-section-label">Твоё сообщение</div>
            <textarea
              className="tc-textarea"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Напиши то, что хочется сказать в особый момент..."
              maxLength={1000}
            />
            <div className="tc-counter">{message.length}/1000</div>
          </div>

          <div>
            <div className="tc-form-section-label">Когда отправить</div>
            <div className="tc-trigger-grid">
              {TRIGGERS.map(t => (
                <button
                  key={t.id}
                  className={`tc-trigger-btn${triggerType === t.id ? ' active' : ''}`}
                  onClick={() => setTriggerType(t.id)}
                >
                  <span className="tc-trigger-icon"><t.Icon /></span>
                  <span className="tc-trigger-label">{t.label}</span>
                  <span className="tc-trigger-desc">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {triggerType === 'date' && (
            <div>
              <div className="tc-form-section-label">Дата отправки</div>
              <input type="datetime-local" className="tc-input"
                value={triggerDate} onChange={e => setTriggerDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)} />
            </div>
          )}
          {triggerType === 'days' && (
            <div>
              <div className="tc-form-section-label">Через сколько дней</div>
              <input type="number" className="tc-input" placeholder="Например: 30"
                value={triggerDays} onChange={e => setTriggerDays(e.target.value)} min={1} max={3650} />
            </div>
          )}
          {triggerType === 'fight' && (
            <div className="tc-fight-info">
              Капсула откроется автоматически когда в чате не будет сообщений 8 часов подряд. Идеально для письма-примирения.
            </div>
          )}

          {saveError && (
            <div className="tc-save-error">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#C8334A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {saveError}
            </div>
          )}

          <button
            className="tc-save-btn"
            onClick={saveCapsule}
            disabled={saving || !message.trim() || !partnerId ||
              (triggerType === 'date' && !triggerDate) ||
              (triggerType === 'days' && (!triggerDays || +triggerDays < 1))}
          >
            {saving ? 'Запечатываю...' : 'Запечатать капсулу'}
          </button>
          <button className="tc-cancel-btn" onClick={() => { setView('list'); setSaveError(null) }}>Назад</button>
        </div>
      ) : (
        <>
          <button className="tc-new-btn" onClick={() => setView('create')}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Написать капсулу
          </button>

          {loading ? (
            <div className="tc-loading">
              <div className="tc-loading-ring" />
              <div className="tc-loading-text">Загрузка...</div>
            </div>
          ) : capsules.length === 0 ? (
            <div className="tc-empty">
              <div className="tc-empty-icon">
                <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="#7B3FBE" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div className="tc-empty-title">Капсул пока нет</div>
              <div className="tc-empty-text">Напиши письмо партнёру — оно откроется<br />в нужный момент.</div>
            </div>
          ) : (
            <div className="tc-list">
              {capsules.map((cap, i) => {
                const st = capsuleStatus(cap)
                const trigger = TRIGGERS.find(t => t.id === cap.trigger_type)
                return (
                  <div key={cap.id} className={`tc-card${cap.is_sent ? ' tc-card-sent' : ''}`} style={{ animationDelay: `${i * 0.055}s` }}>
                    <div className="tc-card-top">
                      <div className="tc-card-badge" style={{ background: st.bg, color: st.color }}>
                        <svg viewBox="0 0 8 8" width="7" height="7" fill={st.color} stroke="none"><circle cx="4" cy="4" r="4" /></svg>
                        {st.text}
                      </div>
                      {!cap.is_sent && (
                        <button className="tc-card-del" onClick={() => setDeleteId(cap.id)} aria-label="Удалить">
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                    <div className="tc-card-msg">{cap.message}</div>
                    <div className="tc-card-footer">
                      {trigger && (
                        <span style={{ color: '#7B3FBE', display: 'flex', alignItems: 'center' }}>
                          <trigger.Icon />
                        </span>
                      )}
                      <span>{trigger?.desc}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {deleteId && (
        <div className="tc-confirm-overlay" onClick={() => setDeleteId(null)}>
          <div className="tc-confirm-box" onClick={e => e.stopPropagation()}>
            <div className="tc-confirm-title">Удалить капсулу?</div>
            <p className="tc-confirm-text">Сообщение будет удалено и не отправится партнёру.</p>
            <div className="tc-confirm-btns">
              <button className="tc-confirm-del" onClick={() => deleteCapsule(deleteId)}>Удалить</button>
              <button className="tc-confirm-cancel" onClick={() => setDeleteId(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
