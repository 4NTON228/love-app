import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Camera, Trash2 } from 'lucide-react'

const MOODS = [
  { value: 'love', emoji: '🥰', label: 'Любовь' },
  { value: 'happy', emoji: '😊', label: 'Счастье' },
  { value: 'laugh', emoji: '😂', label: 'Смех' },
  { value: 'warm', emoji: '🤗', label: 'Тепло' },
  { value: 'dream', emoji: '✨', label: 'Мечта' },
  { value: 'kiss', emoji: '😘', label: 'Поцелуй' },
  { value: 'adventure', emoji: '🌍', label: 'Путешествие' },
  { value: 'cozy', emoji: '☕', label: 'Уют' },
]

export default function Moments({ session }) {
  const [moments, setMoments] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [mood, setMood] = useState('love')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  useEffect(() => {
    loadMoments()
  }, [])

  async function loadMoments() {
    const { data } = await supabase
      .from('moments')
      .select('*')
      .order('created_at', { ascending: false })

    setMoments(data || [])
    setLoading(false)
  }

  async function uploadPhoto(file) {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `moments/${fileName}`

    const { error } = await supabase.storage
      .from('photos')
      .upload(filePath, file)

    if (error) throw error

    const { data } = supabase.storage
      .from('photos')
      .getPublicUrl(filePath)

    return data.publicUrl
  }

  function handlePhotoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title) return
    setSaving(true)

    try {
      let photoUrl = null
      if (photo) {
        photoUrl = await uploadPhoto(photo)
      }

      const { error } = await supabase
        .from('moments')
        .insert({
          user_id: session.user.id,
          title,
          description,
          mood,
          photo_url: photoUrl
        })

      if (!error) {
        resetForm()
        setShowModal(false)
        loadMoments()
      }
    } catch (err) {
      console.error(err)
    }

    setSaving(false)
  }

  async function deleteMoment(id) {
    if (!confirm('Удалить этот момент?')) return
    await supabase.from('moments').delete().eq('id', id)
    loadMoments()
  }

  function resetForm() {
    setTitle('')
    setDescription('')
    setMood('love')
    setPhoto(null)
    setPhotoPreview(null)
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const getMoodEmoji = (moodValue) => {
    return MOODS.find(m => m.value === moodValue)?.emoji || '❤️'
  }

  return (
    <div>
      <h1 className="screen-title">💝 Наши моменты</h1>

      <button className="add-btn" onClick={() => setShowModal(true)}>
        <Plus size={20} />
        Добавить момент
      </button>

      {loading ? (
        <div className="empty-state">
          <div className="loading-heart">💕</div>
        </div>
      ) : moments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-emoji">💝</div>
          <p className="empty-state-text">
            Пока нет моментов.<br />
            Сохраните ваше первое воспоминание!
          </p>
        </div>
      ) : (
        moments.map(moment => (
          <div key={moment.id} className="moment-card">
            {moment.photo_url ? (
              <img
                className="moment-photo"
                src={moment.photo_url}
                alt={moment.title}
                loading="lazy"
              />
            ) : (
              <div className="moment-photo-placeholder">
                {getMoodEmoji(moment.mood)}
              </div>
            )}
            <div className="moment-content">
              <h3 className="moment-title">{moment.title}</h3>
              {moment.description && (
                <p className="moment-desc">{moment.description}</p>
              )}
              <div className="moment-footer">
                <span className="moment-date">{formatDate(moment.created_at)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="moment-mood">{getMoodEmoji(moment.mood)}</span>
                  {moment.user_id === session.user.id && (
                    <button
                      className="event-delete"
                      onClick={() => deleteMoment(moment.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
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
            <h2 className="modal-title">Новый момент</h2>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Название</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Прогулка по парку"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Описание</label>
                <textarea
                  className="form-textarea"
                  placeholder="Расскажите об этом моменте..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Настроение</label>
                <div className="emoji-select">
                  {MOODS.map(m => (
                    <button
                      key={m.value}
                      type="button"
                      className={`emoji-option ${mood === m.value ? 'selected' : ''}`}
                      onClick={() => setMood(m.value)}
                      title={m.label}
                    >
                      {m.emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Фото</label>
                <label className="form-file-label">
                  <Camera size={20} />
                  {photo ? photo.name : 'Выбрать фото'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                  />
                </label>
                {photoPreview && (
                  <img className="photo-preview" src={photoPreview} alt="Preview" />
                )}
              </div>

              <button className="form-submit" type="submit" disabled={saving}>
                {saving ? 'Сохраняем...' : 'Сохранить 💕'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
