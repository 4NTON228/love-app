import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/* ── SVG icons ── */
function IcoTrash() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  )
}
function IcoCheck() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}
function IcoList() {
  return (
    <svg viewBox="0 0 60 60" width="48" height="48" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="8" width="48" height="44" rx="6"/>
      <line x1="18" y1="22" x2="46" y2="22"/>
      <line x1="18" y1="32" x2="46" y2="32"/>
      <line x1="18" y1="42" x2="36" y2="42"/>
      <circle cx="12" cy="22" r="2" fill="rgba(255,255,255,0.3)" stroke="none"/>
      <circle cx="12" cy="32" r="2" fill="rgba(255,255,255,0.3)" stroke="none"/>
      <circle cx="12" cy="42" r="2" fill="rgba(255,255,255,0.3)" stroke="none"/>
    </svg>
  )
}
function IcoPlus() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}
function LoadingHeart() {
  return (
    <svg viewBox="0 0 60 56" width="48" height="44" fill="none">
      <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z"
        fill="rgba(232,70,106,0.4)"/>
      <style>{`@keyframes hbLoad{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}.hbL{animation:hbLoad 1.2s ease-in-out infinite;transform-origin:center}`}</style>
      <g className="hbL">
        <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z"
          fill="none" stroke="rgba(232,70,106,0.6)" strokeWidth="2"/>
      </g>
    </svg>
  )
}

const CATEGORIES = [
  { value: 'dream',  label: 'Мечта',        color: '#c84b8b', bg: 'rgba(200,75,139,0.12)' },
  { value: 'travel', label: 'Путешествие',   color: '#4a8fe7', bg: 'rgba(74,143,231,0.12)' },
  { value: 'date',   label: 'Свидание',      color: '#e8a225', bg: 'rgba(232,162,37,0.12)' },
  { value: 'other',  label: 'Другое',        color: '#6b6b6b', bg: 'rgba(107,107,107,0.1)'  },
]

function getCat(value) {
  return CATEGORIES.find(c => c.value === value) || CATEGORIES[0]
}

// SVG confetti shapes (no emoji)
const CONFETTI_ITEMS = [
  { x:8,  shape:'heart',   s:14, c:'#e8466a', dur:1.0, del:0.00 },
  { x:18, shape:'star',    s:10, c:'#f7a8c4', dur:0.9, del:0.05 },
  { x:28, shape:'diamond', s:12, c:'#c84b8b', dur:1.1, del:0.10 },
  { x:38, shape:'heart',   s:10, c:'#ff8fab', dur:0.8, del:0.15 },
  { x:48, shape:'star',    s:14, c:'#ffb6d9', dur:1.2, del:0.00 },
  { x:58, shape:'diamond', s:9,  c:'#e8466a', dur:0.9, del:0.08 },
  { x:68, shape:'heart',   s:12, c:'#9b4dca', dur:1.0, del:0.12 },
  { x:78, shape:'star',    s:11, c:'#f7a8c4', dur:0.85,del:0.04 },
  { x:88, shape:'diamond', s:13, c:'#c84b8b', dur:1.1, del:0.18 },
  { x:13, shape:'star',    s:9,  c:'#ff8fab', dur:0.95,del:0.22 },
  { x:23, shape:'heart',   s:11, c:'#ffb6d9', dur:1.05,del:0.07 },
  { x:33, shape:'diamond', s:8,  c:'#e8466a', dur:0.9, del:0.13 },
  { x:43, shape:'star',    s:13, c:'#9b4dca', dur:1.2, del:0.03 },
  { x:53, shape:'heart',   s:10, c:'#f7a8c4', dur:0.85,del:0.20 },
  { x:63, shape:'diamond', s:12, c:'#c84b8b', dur:1.0, del:0.09 },
  { x:73, shape:'star',    s:10, c:'#ff8fab', dur:0.95,del:0.16 },
  { x:83, shape:'heart',   s:14, c:'#ffb6d9', dur:1.1, del:0.01 },
  { x:93, shape:'diamond', s:9,  c:'#e8466a', dur:0.9, del:0.24 },
]
const STAR_PATH    = 'M10 0L11.8 7.2L19 10L11.8 12.8L10 20L8.2 12.8L1 10L8.2 7.2Z'
const HEART_PATH_S = 'M10 16.5C10 16.5 1.5 10 1.5 4.5C1.5 2.2 3.4 0.5 5.8 0.5C7.3 0.5 8.6 1.3 10 2.8C11.4 1.3 12.7 0.5 14.2 0.5C16.6 0.5 18.5 2.2 18.5 4.5C18.5 10 10 16.5 10 16.5Z'

function ConfettiShape({ shape, size, color }) {
  if (shape === 'heart')
    return <svg viewBox="0 0 20 18" width={size} height={size * 0.9} fill={color}><path d={HEART_PATH_S}/></svg>
  if (shape === 'star')
    return <svg viewBox="0 0 20 20" width={size} height={size} fill={color}><path d={STAR_PATH}/></svg>
  return (
    <svg viewBox="0 0 12 16" width={size * 0.7} height={size} fill={color}>
      <path d="M6 0 L12 6 L6 16 L0 6 Z"/>
    </svg>
  )
}

function Confetti({ active }) {
  if (!active) return null
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 300, overflow: 'hidden' }}>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-10px) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {CONFETTI_ITEMS.map((it, i) => (
        <div key={i} style={{ position: 'absolute', left: `${it.x}%`, top: 0, animation: `confettiFall ${it.dur}s ${it.del}s ease-in forwards` }}>
          <ConfettiShape shape={it.shape} size={it.s} color={it.c} />
        </div>
      ))}
    </div>
  )
}

export default function Plans({ session }) {
  const [plans, setPlans] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [filterCat, setFilterCat] = useState('all')

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('dream')

  useEffect(() => { loadPlans() }, [])

  async function loadPlans() {
    const { data } = await supabase.from('plans').select('*')
      .order('completed', { ascending: true })
      .order('created_at', { ascending: false })
    setPlans(data || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title) return
    setSaving(true)
    const { error } = await supabase.from('plans').insert({ user_id: session.user.id, title, category })
    if (!error) { setTitle(''); setCategory('dream'); setShowModal(false); loadPlans() }
    setSaving(false)
  }

  async function toggleComplete(plan) {
    const newVal = !plan.completed
    await supabase.from('plans').update({ completed: newVal }).eq('id', plan.id)
    if (newVal) {
      setConfetti(true)
      setTimeout(() => setConfetti(false), 2000)
    }
    loadPlans()
  }

  async function deletePlan(id) {
    if (!confirm('Удалить этот план?')) return
    await supabase.from('plans').delete().eq('id', id)
    loadPlans()
  }

  const visiblePlans = filterCat === 'all' ? plans : plans.filter(p => p.category === filterCat)
  const completedCount = plans.filter(p => p.completed).length
  const totalCount = plans.length
  const progress = totalCount > 0 ? (completedCount / totalCount * 100) : 0

  return (
    <>
      <style>{`
        .plans-wrap { padding: 0 0 120px; }
        .plans-header {
          background: linear-gradient(160deg, #e8466a 0%, #c84b8b 50%, #9b4dca 100%);
          padding: 60px 20px 24px;
          border-radius: 0 0 32px 32px;
          margin-bottom: 18px;
          box-shadow: 0 8px 32px rgba(200,75,139,0.3);
        }
        .plans-header-title {
          font-family: var(--font-display);
          font-size: 26px;
          color: white;
          text-shadow: 0 1px 3px rgba(0,0,0,0.3);
          margin-bottom: 12px;
        }
        .plans-progress-bg {
          width: 100%;
          height: 10px;
          background: rgba(255,255,255,0.2);
          border-radius: 99px;
          overflow: hidden;
          margin-bottom: 6px;
        }
        .plans-progress-fill {
          height: 100%;
          border-radius: 99px;
          background: linear-gradient(90deg, #fff8b0, #ffe0f8, #fff);
          transition: width 0.8s cubic-bezier(0.34,1.56,0.64,1);
        }
        .plans-progress-label {
          font-family: var(--font-body);
          font-size: 13px;
          color: rgba(255,255,255,0.75);
          margin-bottom: 14px;
        }
        .plans-add-btn {
          background: rgba(255,255,255,0.2);
          backdrop-filter: blur(8px);
          border: 1.5px solid rgba(255,255,255,0.3);
          border-radius: 14px;
          color: white;
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 14px;
          padding: 12px 24px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .plans-filter {
          display: flex;
          gap: 8px;
          padding: 0 16px;
          margin-bottom: 14px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .plans-filter::-webkit-scrollbar { display: none; }
        .plans-filter-btn {
          flex-shrink: 0;
          background: var(--bg-card);
          border: 1.5px solid transparent;
          border-radius: 20px;
          padding: 6px 14px;
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          box-shadow: var(--shadow);
          transition: all 0.2s;
          white-space: nowrap;
        }
        .plans-filter-btn.active {
          border-color: var(--primary);
          color: var(--primary);
          background: rgba(232,70,106,0.06);
        }
        .app.dark .plans-filter-btn { background: #2A2540; }
        .app.dark .plans-filter-btn.active { background: rgba(232,70,106,0.12); }

        .plan-list { padding: 0 14px; }
        .plan-item-new {
          background: var(--bg-card);
          border-radius: 18px;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 14px 14px 12px;
          box-shadow: var(--shadow);
          animation: planIn 0.4s ease both;
          transition: opacity 0.3s;
        }
        @keyframes planIn {
          from { opacity:0; transform: translateX(-16px); }
          to   { opacity:1; transform: translateX(0); }
        }
        .plan-item-new.done { opacity: 0.6; }

        .plan-cb {
          flex-shrink: 0;
          width: 28px; height: 28px;
          border-radius: 50%;
          border: 2.5px solid var(--primary);
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s, transform 0.2s;
          color: transparent;
        }
        .plan-cb.checked {
          background: linear-gradient(135deg, #e8466a, #c84b8b);
          border-color: transparent;
          color: white;
          transform: scale(1.1);
          animation: checkPop 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes checkPop {
          0%   { transform: scale(0.8); }
          60%  { transform: scale(1.25); }
          100% { transform: scale(1.1); }
        }

        .plan-main { flex: 1; min-width: 0; }
        .plan-title-new {
          font-family: var(--font-body);
          font-size: 15px;
          font-weight: 600;
          color: var(--text);
          transition: all 0.3s;
          margin-bottom: 3px;
        }
        .plan-title-new.striked {
          text-decoration: line-through;
          color: var(--text-muted);
        }
        .plan-cat-badge {
          display: inline-block;
          border-radius: 8px;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 600;
          font-family: var(--font-body);
        }
        .plan-del-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: 8px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .plan-del-btn:active { background: rgba(232,70,106,0.1); color: var(--primary); }

        .app.dark .plan-item-new { background: #2A2540; }
        .app.dark .plan-title-new { color: #EDE4F0; }

        .plans-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 60px 20px;
          gap: 12px;
        }
        .plans-empty-text {
          font-family: var(--font-body);
          font-size: 15px;
          color: var(--text-muted);
          text-align: center;
          line-height: 1.6;
        }
      `}</style>

      <Confetti active={confetti} />

      <div className="plans-wrap">
        <div className="plans-header">
          <div className="plans-header-title">Наши планы</div>
          {totalCount > 0 && (
            <>
              <div className="plans-progress-bg">
                <div className="plans-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="plans-progress-label">
                {completedCount} из {totalCount} выполнено
                {completedCount === totalCount && totalCount > 0 ? ' — готово!' : ''}
              </div>
            </>
          )}
          <button className="plans-add-btn" onClick={() => setShowModal(true)}>
            <IcoPlus /> Добавить план
          </button>
        </div>

        {/* Category filter */}
        <div className="plans-filter">
          <button className={`plans-filter-btn${filterCat === 'all' ? ' active' : ''}`} onClick={() => setFilterCat('all')}>
            Все ({plans.length})
          </button>
          {CATEGORIES.map(c => {
            const count = plans.filter(p => p.category === c.value).length
            if (!count) return null
            return (
              <button
                key={c.value}
                className={`plans-filter-btn${filterCat === c.value ? ' active' : ''}`}
                onClick={() => setFilterCat(c.value)}
              >
                {c.label} ({count})
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="plans-empty"><LoadingHeart /></div>
        ) : visiblePlans.length === 0 ? (
          <div className="plans-empty">
            <IcoList />
            <p className="plans-empty-text">Пока нет планов.<br />Добавьте ваши мечты и цели!</p>
          </div>
        ) : (
          <div className="plan-list">
            {visiblePlans.map((plan, i) => {
              const cat = getCat(plan.category)
              return (
                <div key={plan.id} className={`plan-item-new${plan.completed ? ' done' : ''}`} style={{ animationDelay: `${i * 0.04}s` }}>
                  <button className={`plan-cb${plan.completed ? ' checked' : ''}`} onClick={() => toggleComplete(plan)}>
                    {plan.completed && <IcoCheck />}
                  </button>
                  <div className="plan-main">
                    <div className={`plan-title-new${plan.completed ? ' striked' : ''}`}>{plan.title}</div>
                    <span className="plan-cat-badge" style={{ background: cat.bg, color: cat.color }}>
                      {cat.label}
                    </span>
                  </div>
                  {plan.user_id === session.user.id && (
                    <button className="plan-del-btn" onClick={() => deletePlan(plan.id)}>
                      <IcoTrash />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal">
            <div className="modal-handle" />
            <h2 className="modal-title">Новый план</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Что хотите сделать?</label>
                <input className="form-input" type="text" placeholder="Посетить Париж" value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Категория</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {CATEGORIES.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '12px',
                        border: `2px solid ${category === c.value ? c.color : 'transparent'}`,
                        background: c.bg,
                        color: c.color,
                        fontFamily: 'var(--font-body)',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <button className="form-submit" type="submit" disabled={saving}>
                {saving ? 'Сохраняем...' : 'Добавить план'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
