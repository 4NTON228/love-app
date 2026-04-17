import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── SVG Icons ────────────────────────────────────────────────
function ScrollIcon({ size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function PlusIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function SignIcon({ size = 15 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17c3-3 6-5 9-5s3 4 6 4 3-1 3-1" />
      <path d="M3 17V7" />
    </svg>
  )
}

function CheckIcon({ size = 15 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ClockIcon({ size = 13 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function TrashIcon({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  )
}

const STATUS_CONFIG = {
  pending:   { label: 'Ожидает подписи', color: '#E8753A', bg: 'rgba(232,117,58,0.1)' },
  active:    { label: 'Активен',          color: '#2B8F50', bg: 'rgba(43,143,80,0.1)' },
  completed: { label: 'Завершён',         color: '#2B8FD8', bg: 'rgba(43,143,216,0.1)' },
  violated:  { label: 'Нарушен',          color: '#C8334A', bg: 'rgba(200,51,74,0.1)' },
  cancelled: { label: 'Отменён',          color: '#8899AA', bg: 'rgba(136,153,170,0.1)' },
}

const PERIOD_OPTIONS = [7, 14, 30, 60, 90]

const CONTRACT_SUGGESTIONS = [
  { title: 'Без телефона на свидании', condition: 'Убираем телефоны во время совместного ужина' },
  { title: 'Утреннее "доброе утро"', condition: 'Каждое утро говорим друг другу "доброе утро" — лично или в сообщении' },
  { title: 'Один вечер без гаджетов', condition: 'Раз в неделю проводим вечер без телефонов и компьютеров' },
  { title: 'Выражать благодарность', condition: 'Каждый день говорим одно конкретное "спасибо" партнёру' },
  { title: 'Не критиковать публично', condition: 'Никогда не критикуем друг друга при других людях' },
]

function daysLeft(expiresAt) {
  if (!expiresAt) return null
  const diff = new Date(expiresAt) - Date.now()
  return Math.max(0, Math.ceil(diff / 86400000))
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

export default function Contracts({ session, profile, darkMode }) {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [noPartner, setNoPartner] = useState(false)

  const [form, setForm] = useState({
    title: '',
    condition: '',
    consequence: '',
    period_days: 30,
  })

  const loadContracts = useCallback(async () => {
    setLoading(true)
    if (!profile?.partner_id) {
      setNoPartner(true)
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('contracts')
      .select('*')
      .or(`creator_id.eq.${session.user.id},partner_id.eq.${session.user.id}`)
      .order('created_at', { ascending: false })

    setContracts(data ?? [])
    setLoading(false)
  }, [profile?.partner_id, session.user.id])

  useEffect(() => { loadContracts() }, [loadContracts])

  async function createContract() {
    if (!form.title.trim() || !form.condition.trim() || saving) return
    if (!profile?.partner_id) return
    setSaving(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('contracts')
      .insert({
        creator_id: session.user.id,
        partner_id: profile.partner_id,
        title: form.title.trim(),
        condition: form.condition.trim(),
        consequence: form.consequence.trim() || null,
        period_days: form.period_days,
        status: 'pending',
        signed_by_creator: true,
        signed_by_partner: false,
      })
      .select()
      .single()

    if (err) {
      setError('Не удалось создать контракт. Попробуй снова.')
    } else if (data) {
      setContracts(prev => [data, ...prev])
      setCreating(false)
      setForm({ title: '', condition: '', consequence: '', period_days: 30 })
    }
    setSaving(false)
  }

  async function signContract(contractId) {
    // Use RPC so status + expires_at are set atomically server-side
    const { error: err } = await supabase
      .rpc('sign_contract', { contract_id: contractId })

    if (err) {
      setError('Не удалось подписать контракт — попробуй снова')
      return
    }

    // Refresh contract from DB after RPC
    const { data: updated } = await supabase
      .from('contracts').select('*').eq('id', contractId).single()
    if (updated) {
      setContracts(prev => prev.map(c => c.id === contractId ? updated : c))
    }
  }

  async function cancelContract(contractId) {
    const { data } = await supabase
      .from('contracts')
      .update({ status: 'cancelled' })
      .eq('id', contractId)
      .select()
      .single()

    if (data) setContracts(prev => prev.map(c => c.id === contractId ? data : c))
  }

  function applySuggestion(s) {
    setForm(f => ({ ...f, title: s.title, condition: s.condition }))
  }

  const dk = darkMode ? ' ct-dark' : ''
  const userId = session.user.id

  return (
    <div className={`ct${dk}`}>
      <style>{`
        .ct {
          min-height: 100%;
          background: var(--surface, #FFFFFF);
          color: var(--ink, #1E0A10);
        }
        .ct-dark { background: #0A0206; color: #F5E6EB; }

        /* Hero */
        .ct-hero {
          position: relative;
          padding: 28px 24px 32px;
          overflow: hidden;
        }
        .ct-hero-bg {
          position: absolute; inset: 0;
          background: linear-gradient(150deg, #0D1A30 0%, #1A2F50 50%, #0A0206 100%);
        }
        .ct-orb1 {
          position: absolute; top: -30px; right: -20px;
          width: 160px; height: 160px; border-radius: 50%;
          background: radial-gradient(circle, rgba(43,100,216,0.5) 0%, transparent 70%);
          animation: ctFloat1 8s ease-in-out infinite;
        }
        .ct-orb2 {
          position: absolute; bottom: -20px; left: 10px;
          width: 110px; height: 110px; border-radius: 50%;
          background: radial-gradient(circle, rgba(139,26,44,0.3) 0%, transparent 70%);
          animation: ctFloat2 11s ease-in-out infinite;
        }
        @keyframes ctFloat1 {
          0%,100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(-10px, 12px) scale(1.08); }
        }
        @keyframes ctFloat2 {
          0%,100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(8px,-10px) scale(1.05); }
        }
        .ct-hero-content { position: relative; z-index: 1; }
        .ct-hero-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18);
          border-radius: 99px; padding: 4px 12px;
          font-size: 11px; font-weight: 600; letter-spacing: 0.8px;
          text-transform: uppercase; color: rgba(255,255,255,0.8);
          margin-bottom: 14px;
        }
        .ct-hero-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #5B9BFF;
          animation: ctPulse 2s ease-in-out infinite;
        }
        @keyframes ctPulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.6); }
        }
        .ct-hero-title {
          font-family: var(--font-head, Georgia, serif);
          font-size: 28px; font-weight: 700; color: #FFFFFF;
          line-height: 1.2; margin-bottom: 8px;
        }
        .ct-hero-sub {
          font-size: 13px; color: rgba(255,255,255,0.55); line-height: 1.5;
        }

        /* New contract button */
        .ct-new-btn {
          margin: 16px;
          width: calc(100% - 32px);
          padding: 14px;
          border-radius: 16px; border: none;
          background: linear-gradient(135deg, #2B64D8 0%, #0D2A5A 100%);
          color: #FFFFFF; font-size: 15px; font-weight: 600;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          cursor: pointer;
          box-shadow: 0 6px 20px rgba(43,100,216,0.35);
          transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
          position: relative; overflow: hidden;
        }
        .ct-new-btn:active { transform: scale(0.96); }
        .ct-new-btn::after {
          content: '';
          position: absolute; top: 0; left: -100%;
          width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          animation: ctShimmer 2.5s ease-in-out infinite;
        }
        @keyframes ctShimmer {
          0% { left: -100%; }
          100% { left: 200%; }
        }

        /* Form */
        .ct-form {
          margin: 0 16px 16px;
          background: var(--blush, #FBF0F2);
          border-radius: 20px; padding: 20px;
          animation: ctSlideDown 0.3s cubic-bezier(0.2,1,0.4,1) both;
        }
        .ct-dark .ct-form { background: #0D1A30; }
        @keyframes ctSlideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ct-form-title {
          font-size: 14px; font-weight: 700;
          color: #2B64D8; margin-bottom: 16px;
        }
        .ct-dark .ct-form-title { color: #5B9BFF; }

        .ct-field { margin-bottom: 12px; }
        .ct-label {
          font-size: 11px; font-weight: 600; letter-spacing: 0.5px;
          text-transform: uppercase; color: rgba(30,10,16,0.45);
          margin-bottom: 6px; display: block;
        }
        .ct-dark .ct-label { color: rgba(245,230,235,0.4); }
        .ct-input, .ct-textarea-sm {
          width: 100%; border-radius: 12px;
          border: 1.5px solid rgba(43,100,216,0.2);
          background: rgba(255,255,255,0.7);
          padding: 10px 12px;
          font-size: 14px; color: inherit; outline: none;
          font-family: inherit;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .ct-dark .ct-input, .ct-dark .ct-textarea-sm {
          background: rgba(43,100,216,0.07);
          border-color: rgba(91,155,255,0.2);
        }
        .ct-input:focus, .ct-textarea-sm:focus { border-color: #2B64D8; }
        .ct-textarea-sm { min-height: 70px; resize: none; line-height: 1.5; }

        /* Suggestions */
        .ct-suggestions-label {
          font-size: 11px; font-weight: 600; letter-spacing: 0.5px;
          text-transform: uppercase; color: rgba(30,10,16,0.4); margin-bottom: 8px;
        }
        .ct-dark .ct-suggestions-label { color: rgba(245,230,235,0.35); }
        .ct-suggestions-scroll {
          display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px;
          margin-bottom: 14px;
          -webkit-overflow-scrolling: touch; scrollbar-width: none;
        }
        .ct-suggestions-scroll::-webkit-scrollbar { display: none; }
        .ct-sug-chip {
          flex-shrink: 0; padding: 7px 14px; border-radius: 99px;
          border: 1.5px solid rgba(43,100,216,0.25);
          background: rgba(43,100,216,0.06);
          font-size: 12px; font-weight: 600;
          color: var(--ink, #1E0A10);
          cursor: pointer; white-space: nowrap;
          transition: all 0.15s;
        }
        .ct-dark .ct-sug-chip {
          color: #F5E6EB; background: rgba(91,155,255,0.08);
          border-color: rgba(91,155,255,0.2);
        }
        .ct-sug-chip:active { background: rgba(43,100,216,0.15); }

        /* Period */
        .ct-period-row {
          display: flex; gap: 6px; flex-wrap: wrap;
        }
        .ct-period-btn {
          flex: 1; min-width: 44px; padding: 8px 4px;
          border-radius: 10px; border: 1.5px solid rgba(43,100,216,0.2);
          background: transparent; font-size: 12px; font-weight: 600;
          color: var(--ink, #1E0A10); cursor: pointer; transition: all 0.15s;
        }
        .ct-dark .ct-period-btn { color: #F5E6EB; border-color: rgba(91,155,255,0.2); }
        .ct-period-btn.active {
          background: linear-gradient(135deg, #2B64D8 0%, #0D2A5A 100%);
          border-color: transparent; color: #FFFFFF;
        }

        /* Form actions */
        .ct-form-actions { display: flex; gap: 10px; margin-top: 16px; }
        .ct-cancel-btn {
          flex: 1; padding: 11px;
          border-radius: 12px; border: 1.5px solid rgba(43,100,216,0.25);
          background: transparent; color: #2B64D8; font-size: 14px; font-weight: 600; cursor: pointer;
        }
        .ct-dark .ct-cancel-btn { color: #5B9BFF; }
        .ct-submit-btn {
          flex: 2; padding: 11px;
          border-radius: 12px; border: none;
          background: linear-gradient(135deg, #2B64D8 0%, #0D2A5A 100%);
          color: #FFFFFF; font-size: 14px; font-weight: 600; cursor: pointer;
          transition: opacity 0.2s;
        }
        .ct-submit-btn:disabled { opacity: 0.5; }

        /* Error */
        .ct-error {
          margin: 0 16px 12px; padding: 12px 14px; border-radius: 12px;
          background: rgba(200,51,74,0.08); border: 1px solid rgba(200,51,74,0.2);
          font-size: 13px; color: #C8334A;
        }

        /* Contracts list */
        .ct-list { padding: 0 16px 24px; }
        .ct-section-label {
          font-size: 11px; font-weight: 700; letter-spacing: 0.8px;
          text-transform: uppercase; color: #2B64D8; margin-bottom: 12px;
        }
        .ct-dark .ct-section-label { color: #5B9BFF; }

        .ct-card {
          background: var(--blush, #FBF0F2);
          border-radius: 18px; padding: 16px;
          margin-bottom: 12px; cursor: pointer;
          animation: ctCardIn 0.35s cubic-bezier(0.2,1,0.4,1) both;
          transition: transform 0.15s;
        }
        .ct-dark .ct-card { background: #0D1A30; }
        .ct-card:active { transform: scale(0.98); }
        @keyframes ctCardIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .ct-card-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 10px; margin-bottom: 10px;
        }
        .ct-card-title {
          font-size: 15px; font-weight: 700;
          color: var(--ink, #1E0A10); line-height: 1.3;
        }
        .ct-dark .ct-card-title { color: #F5E6EB; }
        .ct-status-badge {
          flex-shrink: 0;
          padding: 3px 10px; border-radius: 99px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.4px;
        }

        .ct-card-condition {
          font-size: 13px; line-height: 1.55;
          color: rgba(30,10,16,0.65); margin-bottom: 10px;
        }
        .ct-dark .ct-card-condition { color: rgba(245,230,235,0.6); }

        .ct-card-meta {
          display: flex; align-items: center; gap: 12px;
          flex-wrap: wrap;
        }
        .ct-meta-item {
          display: flex; align-items: center; gap: 5px;
          font-size: 11px; color: rgba(30,10,16,0.4);
        }
        .ct-dark .ct-meta-item { color: rgba(245,230,235,0.35); }

        /* Signatures */
        .ct-signatures {
          display: flex; gap: 8px; margin-top: 10px;
        }
        .ct-sig {
          flex: 1; padding: 8px;
          border-radius: 10px; border: 1px solid rgba(43,100,216,0.2);
          background: rgba(43,100,216,0.05);
          font-size: 11px; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 4px;
        }
        .ct-dark .ct-sig {
          background: rgba(91,155,255,0.06);
          border-color: rgba(91,155,255,0.15);
        }
        .ct-sig-label { color: rgba(30,10,16,0.45); font-weight: 600; }
        .ct-dark .ct-sig-label { color: rgba(245,230,235,0.4); }
        .ct-sig-signed { color: #2B8F50; font-weight: 700; }
        .ct-sig-pending { color: #E8753A; font-weight: 600; }

        /* Expanded actions */
        .ct-card-actions {
          margin-top: 12px;
          display: flex; gap: 8px;
          animation: ctSlideDown 0.25s cubic-bezier(0.2,1,0.4,1) both;
        }
        .ct-sign-btn {
          flex: 2; padding: 10px 14px;
          border-radius: 12px; border: none;
          background: linear-gradient(135deg, #2B8F50 0%, #1A4A2E 100%);
          color: #FFFFFF; font-size: 13px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(43,143,80,0.3);
        }
        .ct-cancel-contract-btn {
          flex: 1; padding: 10px;
          border-radius: 12px; border: 1.5px solid rgba(200,51,74,0.25);
          background: transparent; color: #C8334A;
          font-size: 12px; font-weight: 600; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 5px;
        }

        /* Days left bar */
        .ct-progress-wrap { margin-top: 10px; }
        .ct-progress-label {
          display: flex; justify-content: space-between;
          font-size: 11px; color: rgba(30,10,16,0.4); margin-bottom: 4px;
        }
        .ct-dark .ct-progress-label { color: rgba(245,230,235,0.35); }
        .ct-progress-track {
          height: 4px; border-radius: 2px;
          background: rgba(43,100,216,0.1);
          overflow: hidden;
        }
        .ct-progress-fill {
          height: 100%; border-radius: 2px;
          background: linear-gradient(90deg, #2B64D8, #4CA0FF);
          transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
        }

        /* Empty / loading */
        .ct-empty {
          text-align: center; padding: 40px 24px;
          color: rgba(30,10,16,0.35);
        }
        .ct-dark .ct-empty { color: rgba(245,230,235,0.3); }
        .ct-empty-icon { margin-bottom: 12px; opacity: 0.4; }
        .ct-empty-text { font-size: 14px; line-height: 1.5; }

        .ct-no-partner {
          margin: 24px 16px;
          padding: 20px; border-radius: 16px;
          background: rgba(43,100,216,0.06);
          border: 1px solid rgba(43,100,216,0.15);
          text-align: center;
          font-size: 14px; line-height: 1.6;
          color: rgba(30,10,16,0.65);
        }
        .ct-dark .ct-no-partner {
          background: rgba(91,155,255,0.08);
          color: rgba(245,230,235,0.6);
        }
      `}</style>

      {/* Hero */}
      <div className="ct-hero">
        <div className="ct-hero-bg" />
        <div className="ct-orb1" />
        <div className="ct-orb2" />
        <div className="ct-hero-content">
          <div className="ct-hero-badge">
            <div className="ct-hero-badge-dot" />
            Совместные обязательства
          </div>
          <div className="ct-hero-title">Контракты пары</div>
          <div className="ct-hero-sub">
            Создайте договорённости и отслеживайте<br />
            их выполнение вместе
          </div>
        </div>
      </div>

      {/* No partner guard */}
      {noPartner ? (
        <div className="ct-no-partner">
          Для создания контрактов нужно<br />связать аккаунты с партнёром в Настройках.
        </div>
      ) : (
        <>
          {/* New contract button */}
          {!creating && (
            <button className="ct-new-btn" onClick={() => setCreating(true)}>
              <PlusIcon size={18} />
              Создать контракт
            </button>
          )}

          {/* Create form */}
          {creating && (
            <div className="ct-form">
              <div className="ct-form-title">Новый контракт</div>

              {/* Suggestions */}
              <div className="ct-suggestions-label">Шаблоны</div>
              <div className="ct-suggestions-scroll">
                {CONTRACT_SUGGESTIONS.map(s => (
                  <button key={s.title} className="ct-sug-chip" onClick={() => applySuggestion(s)}>
                    {s.title}
                  </button>
                ))}
              </div>

              <div className="ct-field">
                <label className="ct-label">Название</label>
                <input
                  className="ct-input"
                  placeholder="Например: утренние обнимашки"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div className="ct-field">
                <label className="ct-label">Условие</label>
                <textarea
                  className="ct-textarea-sm"
                  placeholder="Что конкретно обязуемся делать..."
                  value={form.condition}
                  onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
                />
              </div>

              <div className="ct-field">
                <label className="ct-label">Последствие за нарушение (необязательно)</label>
                <input
                  className="ct-input"
                  placeholder="Например: готовит ужин на этой неделе"
                  value={form.consequence}
                  onChange={e => setForm(f => ({ ...f, consequence: e.target.value }))}
                />
              </div>

              <div className="ct-field">
                <label className="ct-label">Срок действия</label>
                <div className="ct-period-row">
                  {PERIOD_OPTIONS.map(d => (
                    <button
                      key={d}
                      className={`ct-period-btn${form.period_days === d ? ' active' : ''}`}
                      onClick={() => setForm(f => ({ ...f, period_days: d }))}
                    >
                      {d} дн
                    </button>
                  ))}
                </div>
              </div>

              {error && <div className="ct-error">{error}</div>}

              <div className="ct-form-actions">
                <button className="ct-cancel-btn" onClick={() => { setCreating(false); setError(null) }}>
                  Отмена
                </button>
                <button
                  className="ct-submit-btn"
                  onClick={createContract}
                  disabled={!form.title.trim() || !form.condition.trim() || saving}
                >
                  {saving ? 'Создаю...' : 'Отправить партнёру'}
                </button>
              </div>
            </div>
          )}

          {/* Contracts list */}
          <div className="ct-list">
            {contracts.length > 0 && (
              <div className="ct-section-label">
                {contracts.length} {contracts.length === 1 ? 'контракт' : 'контракта/ов'}
              </div>
            )}

            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center', opacity: 0.4 }}>
                <ScrollIcon size={28} />
              </div>
            ) : contracts.length === 0 ? (
              <div className="ct-empty">
                <div className="ct-empty-icon"><ScrollIcon size={36} /></div>
                <div className="ct-empty-text">
                  Нет контрактов.<br />Создайте первое совместное обязательство.
                </div>
              </div>
            ) : (
              contracts.map((c, i) => {
                const isCreator = c.creator_id === userId
                const isPartner = c.partner_id === userId
                const statusCfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.pending
                const isExpanded = expandedId === c.id
                const days = daysLeft(c.expires_at)
                const totalDays = c.period_days
                const pct = days != null && totalDays > 0
                  ? Math.round((days / totalDays) * 100)
                  : null
                const canSign = isPartner && !c.signed_by_partner && c.status === 'pending'
                const canCancel = isCreator && c.status !== 'cancelled' && c.status !== 'completed'

                return (
                  <div
                    key={c.id}
                    className="ct-card"
                    style={{ animationDelay: `${i * 0.05}s` }}
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  >
                    <div className="ct-card-header">
                      <div className="ct-card-title">{c.title}</div>
                      <div
                        className="ct-status-badge"
                        style={{ background: statusCfg.bg, color: statusCfg.color }}
                      >
                        {statusCfg.label}
                      </div>
                    </div>

                    <div className="ct-card-condition">{c.condition}</div>

                    <div className="ct-card-meta">
                      <span className="ct-meta-item">
                        <ClockIcon size={12} />
                        {c.period_days} дней
                      </span>
                      {c.expires_at && c.status === 'active' && (
                        <span className="ct-meta-item">
                          истекает {formatDate(c.expires_at)}
                        </span>
                      )}
                      <span className="ct-meta-item">
                        с {formatDate(c.created_at)}
                      </span>
                    </div>

                    {/* Progress bar for active */}
                    {c.status === 'active' && pct != null && (
                      <div className="ct-progress-wrap">
                        <div className="ct-progress-label">
                          <span>Осталось</span>
                          <span>{days} дн</span>
                        </div>
                        <div className="ct-progress-track">
                          <div className="ct-progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Signatures */}
                    <div className="ct-signatures">
                      <div className="ct-sig">
                        <div className="ct-sig-label">Инициатор</div>
                        {c.signed_by_creator
                          ? <span className="ct-sig-signed"><CheckIcon size={13} /> Подписал</span>
                          : <span className="ct-sig-pending">Ожидает</span>}
                      </div>
                      <div className="ct-sig">
                        <div className="ct-sig-label">Партнёр</div>
                        {c.signed_by_partner
                          ? <span className="ct-sig-signed"><CheckIcon size={13} /> Подписал</span>
                          : <span className="ct-sig-pending">Ожидает</span>}
                      </div>
                    </div>

                    {/* Expanded actions */}
                    {isExpanded && (canSign || canCancel) && (
                      <div className="ct-card-actions" onClick={e => e.stopPropagation()}>
                        {canSign && (
                          <button className="ct-sign-btn" onClick={() => signContract(c.id)}>
                            <SignIcon size={14} />
                            Подписать контракт
                          </button>
                        )}
                        {canCancel && (
                          <button className="ct-cancel-contract-btn" onClick={() => cancelContract(c.id)}>
                            <TrashIcon size={13} />
                            Отменить
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
