import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  { value: 'dream',  label: '✨ Мечта',       color: '#c84b8b', bg: 'rgba(200,75,139,0.12)' },
  { value: 'travel', label: '✈️ Путешествие',  color: '#4a8fe7', bg: 'rgba(74,143,231,0.12)' },
  { value: 'date',   label: '💕 Свидание',     color: '#e8a225', bg: 'rgba(232,162,37,0.12)' },
  { value: 'other',  label: '📌 Другое',       color: '#6b6b6b', bg: 'rgba(107,107,107,0.1)' },
]

function getCat(value) {
  return CATEGORIES.find(c => c.value === value) || CATEGORIES[0]
}

function Confetti({ active }) {
  if (!active) return null
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 300, overflow: 'hidden' }}>
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${5 + Math.random() * 90}%`,
            top: '-20px',
            fontSize: `${12 + Math.random() * 12}px`,
            animation: `confettiFall ${0.8 + Math.random() * 0.8}s ${Math.random() * 0.4}s ease-in forwards`,
          }}
        >
          {['🎉','💕','⭐','🎊','✨','🌸'][i % 6]}
        </span>
      ))}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
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
          margin-bottom: 12px;
        }
        /* Progress */
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

        /* Category filter */
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

        /* Plan items */
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

        /* Animated checkbox */
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
          font-size: 14px;
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
          font-size: 17px;
          cursor: pointer;
          padding: 4px;
          border-radius: 8px;
          flex-shrink: 0;
        }
        .plan-del-btn:active { background: rgba(232,70,106,0.1); color: var(--primary); }

        /* dark */
        .app.dark .plan-item-new { background: #2A2540; }
        .app.dark .plan-title-new { color: #EDE4F0; }

        /* empty */
        .plans-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 60px 20px;
          gap: 12px;
        }
        .plans-empty-emoji { font-size: 60px; }
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
          <div className="plans-header-title">📝 Наши планы</div>
          {totalCount > 0 && (
            <>
              <div className="plans-progress-bg">
                <div className="plans-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="plans-progress-label">
                {completedCount} из {totalCount} выполнено {completedCount === totalCount && totalCount > 0 ? '🎉' : ''}
              </div>
            </>
          )}
          <button className="plans-add-btn" onClick={() => setShowModal(true)}>＋ Добавить план</button>
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
          <div className="plans-empty"><div className="loading-heart">💕</div></div>
        ) : visiblePlans.length === 0 ? (
          <div className="plans-empty">
            <div className="plans-empty-emoji">📝</div>
            <p className="plans-empty-text">Пока нет планов.<br />Добавьте ваши мечты и цели!</p>
          </div>
        ) : (
          <div className="plan-list">
            {visiblePlans.map((plan, i) => {
              const cat = getCat(plan.category)
              return (
                <div key={plan.id} className={`plan-item-new${plan.completed ? ' done' : ''}`} style={{ animationDelay: `${i * 0.04}s` }}>
                  <button
                    className={`plan-cb${plan.completed ? ' checked' : ''}`}
                    onClick={() => toggleComplete(plan)}
                  >
                    {plan.completed && '✓'}
                  </button>
                  <div className="plan-main">
                    <div className={`plan-title-new${plan.completed ? ' striked' : ''}`}>{plan.title}</div>
                    <span className="plan-cat-badge" style={{ background: cat.bg, color: cat.color }}>
                      {cat.label}
                    </span>
                  </div>
                  {plan.user_id === session.user.id && (
                    <button className="plan-del-btn" onClick={() => deletePlan(plan.id)}>🗑️</button>
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
            <h2 className="modal-title">✨ Новый план</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Что хотите сделать?</label>
                <input className="form-input" type="text" placeholder="Посетить Париж 🗼" value={title} onChange={e => setTitle(e.target.value)} required />
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
                {saving ? '💕 Сохраняем...' : 'Добавить план'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
