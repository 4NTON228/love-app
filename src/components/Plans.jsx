import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Check, Trash2 } from 'lucide-react'

const CATEGORIES = [
  { value: 'dream', label: '✨ Мечта', className: 'dream' },
  { value: 'travel', label: '✈️ Путешествие', className: 'travel' },
  { value: 'date', label: '💕 Свидание', className: 'date' },
]

export default function Plans({ session }) {
  const [plans, setPlans] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('dream')

  useEffect(() => {
    loadPlans()
  }, [])

  async function loadPlans() {
    const { data } = await supabase
      .from('plans')
      .select('*')
      .order('completed', { ascending: true })
      .order('created_at', { ascending: false })

    setPlans(data || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title) return
    setSaving(true)

    const { error } = await supabase
      .from('plans')
      .insert({
        user_id: session.user.id,
        title,
        category
      })

    if (!error) {
      setTitle('')
      setCategory('dream')
      setShowModal(false)
      loadPlans()
    }

    setSaving(false)
  }

  async function toggleComplete(plan) {
    await supabase
      .from('plans')
      .update({ completed: !plan.completed })
      .eq('id', plan.id)

    loadPlans()
  }

  async function deletePlan(id) {
    if (!confirm('Удалить этот план?')) return
    await supabase.from('plans').delete().eq('id', id)
    loadPlans()
  }

  const completedCount = plans.filter(p => p.completed).length
  const totalCount = plans.length

  return (
    <div>
      <h1 className="screen-title">📝 Наши планы</h1>

      {totalCount > 0 && (
        <div className="stat-card" style={{ marginBottom: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-light)', marginBottom: '8px' }}>
            Выполнено
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            background: '#F0E8EF',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '8px'
          }}>
            <div style={{
              width: `${totalCount > 0 ? (completedCount / totalCount * 100) : 0}%`,
              height: '100%',
              background: 'var(--gradient-warm)',
              borderRadius: '4px',
              transition: 'width 0.5s ease'
            }} />
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {completedCount} из {totalCount} 🎯
          </div>
        </div>
      )}

      <button className="add-btn" onClick={() => setShowModal(true)}>
        <Plus size={20} />
        Добавить план
      </button>

      {loading ? (
        <div className="empty-state">
          <div className="loading-heart">💕</div>
        </div>
      ) : plans.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-emoji">📝</div>
          <p className="empty-state-text">
            Пока нет планов.<br />
            Добавьте ваши мечты и цели!
          </p>
        </div>
      ) : (
        plans.map(plan => (
          <div key={plan.id} className="plan-item">
            <button
              className={`plan-checkbox ${plan.completed ? 'checked' : ''}`}
              onClick={() => toggleComplete(plan)}
            >
              {plan.completed && <Check size={14} strokeWidth={3} />}
            </button>
            <span className={`plan-text ${plan.completed ? 'completed' : ''}`}>
              {plan.title}
            </span>
            <span className={`plan-category ${plan.category}`}>
              {CATEGORIES.find(c => c.value === plan.category)?.label || '✨ Мечта'}
            </span>
            {plan.user_id === session.user.id && (
              <button className="plan-delete" onClick={() => deletePlan(plan.id)}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))
      )}

      {/* Модалка */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) setShowModal(false)
        }}>
          <div className="modal">
            <div className="modal-handle" />
            <h2 className="modal-title">Новый план</h2>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Что хотите сделать?</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Посетить Париж"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Категория</label>
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <button className="form-submit" type="submit" disabled={saving}>
                {saving ? 'Сохраняем...' : 'Добавить 🎯'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
