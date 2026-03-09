import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

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

function getMoodEmoji(moodValue) {
  return MOODS.find(m => m.value === moodValue)?.emoji || '❤️'
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function Moments({ session }) {
  const [moments, setMoments] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [slideIdx, setSlideIdx] = useState(0)
  const [showSlide, setShowSlide] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [mood, setMood] = useState('love')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  const slideTimer = useRef(null)

  useEffect(() => { loadMoments() }, [])

  // Auto slideshow
  useEffect(() => {
    if (!showSlide) return
    const photos = moments.filter(m => m.photo_url)
    if (!photos.length) return
    slideTimer.current = setInterval(() => {
      setSlideIdx(i => (i + 1) % photos.length)
    }, 3500)
    return () => clearInterval(slideTimer.current)
  }, [showSlide, moments])

  async function loadMoments() {
    const { data } = await supabase.from('moments').select('*').order('created_at', { ascending: false })
    setMoments(data || [])
    setLoading(false)
  }

  async function uploadPhoto(file) {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const { error } = await supabase.storage.from('photos').upload(`moments/${fileName}`, file)
    if (error) throw error
    const { data } = supabase.storage.from('photos').getPublicUrl(`moments/${fileName}`)
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
      if (photo) photoUrl = await uploadPhoto(photo)
      const { error } = await supabase.from('moments').insert({ user_id: session.user.id, title, description, mood, photo_url: photoUrl })
      if (!error) { resetForm(); setShowModal(false); loadMoments() }
    } catch (err) { console.error(err) }
    setSaving(false)
  }

  async function deleteMoment(id) {
    if (!confirm('Удалить этот момент?')) return
    await supabase.from('moments').delete().eq('id', id)
    loadMoments()
  }

  function resetForm() {
    setTitle(''); setDescription(''); setMood('love'); setPhoto(null); setPhotoPreview(null)
  }

  const withPhotos = moments.filter(m => m.photo_url)

  return (
    <>
      <style>{`
        .moments-wrap { padding: 0 0 120px; }
        .moments-header {
          background: linear-gradient(160deg, #e8466a 0%, #c84b8b 50%, #9b4dca 100%);
          padding: 60px 20px 24px;
          border-radius: 0 0 32px 32px;
          margin-bottom: 18px;
          box-shadow: 0 8px 32px rgba(200,75,139,0.3);
        }
        .moments-header-title {
          font-family: var(--font-display);
          font-size: 26px;
          color: white;
          margin-bottom: 4px;
        }
        .moments-header-sub {
          font-size: 13px;
          color: rgba(255,255,255,0.65);
          font-family: var(--font-body);
        }
        .moments-actions {
          display: flex;
          gap: 10px;
          margin-top: 16px;
        }
        .moments-add-btn {
          flex: 1;
          background: rgba(255,255,255,0.2);
          backdrop-filter: blur(8px);
          border: 1.5px solid rgba(255,255,255,0.3);
          border-radius: 14px;
          color: white;
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 14px;
          padding: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .moments-slide-btn {
          background: rgba(255,255,255,0.15);
          border: 1.5px solid rgba(255,255,255,0.25);
          border-radius: 14px;
          color: white;
          font-size: 20px;
          width: 48px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Slideshow */
        .slideshow-overlay {
          position: fixed;
          inset: 0;
          background: #000;
          z-index: 200;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .slideshow-img {
          max-width: 100%;
          max-height: 75vh;
          object-fit: contain;
          animation: slideFade 0.6s ease;
        }
        @keyframes slideFade {
          from { opacity:0; transform: scale(0.95); }
          to   { opacity:1; transform: scale(1); }
        }
        .slideshow-close {
          position: absolute;
          top: calc(20px + var(--safe-top, 0px));
          right: 20px;
          background: rgba(255,255,255,0.15);
          border: none;
          border-radius: 50%;
          width: 40px; height: 40px;
          color: white;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .slideshow-info {
          position: absolute;
          bottom: calc(30px + var(--safe-bottom, 0px));
          text-align: center;
          color: white;
        }
        .slideshow-title {
          font-family: var(--font-display);
          font-size: 20px;
          margin-bottom: 4px;
        }
        .slideshow-date {
          font-size: 13px;
          opacity: 0.6;
          font-family: var(--font-body);
        }
        .slideshow-dots {
          display: flex;
          gap: 6px;
          justify-content: center;
          margin-top: 12px;
        }
        .slideshow-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: rgba(255,255,255,0.35);
          cursor: pointer;
          transition: background 0.2s, transform 0.2s;
        }
        .slideshow-dot.active {
          background: white;
          transform: scale(1.4);
        }

        /* Masonry grid */
        .moments-grid {
          padding: 0 14px;
          columns: 2;
          column-gap: 12px;
        }
        .moment-card-new {
          break-inside: avoid;
          margin-bottom: 12px;
          border-radius: 18px;
          overflow: hidden;
          background: var(--bg-card);
          box-shadow: var(--shadow);
          animation: momentIn 0.45s ease both;
          cursor: pointer;
        }
        @keyframes momentIn {
          from { opacity:0; transform: translateY(24px) scale(0.95); }
          to   { opacity:1; transform: translateY(0) scale(1); }
        }
        .moment-card-new:active { transform: scale(0.97); }
        .moment-img {
          width: 100%;
          aspect-ratio: auto;
          display: block;
          object-fit: cover;
        }
        .moment-img-tall { aspect-ratio: 3/4; }
        .moment-img-wide { aspect-ratio: 4/3; }
        .moment-no-photo {
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #ffeef4 0%, #ffe0ea 100%);
          font-size: 40px;
        }
        .app.dark .moment-no-photo { background: rgba(200,75,139,0.12); }
        .moment-info {
          padding: 10px 12px;
        }
        .moment-title-new {
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 13px;
          color: var(--text);
          margin-bottom: 3px;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .moment-date-new {
          font-size: 11px;
          color: var(--text-muted);
          font-family: var(--font-body);
        }
        .moment-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 4px;
        }
        .moment-del-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 14px;
          cursor: pointer;
          padding: 2px 4px;
          line-height: 1;
          border-radius: 6px;
        }
        .moment-del-btn:active { background: rgba(232,70,106,0.1); color: #e8466a; }

        /* Lightbox */
        .lightbox-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.9);
          z-index: 210;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.2s ease;
        }
        .lightbox-img {
          max-width: 95%;
          max-height: 90vh;
          object-fit: contain;
          border-radius: 8px;
          animation: zoomIn 0.25s ease;
        }
        @keyframes zoomIn { from{transform:scale(0.85);opacity:0} to{transform:scale(1);opacity:1} }
        .lightbox-close {
          position: absolute;
          top: calc(16px + var(--safe-top,0px));
          right: 16px;
          background: rgba(255,255,255,0.15);
          border: none;
          border-radius: 50%;
          width: 40px; height: 40px;
          color: white;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Empty state */
        .moments-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 60px 20px;
          gap: 12px;
        }
        .moments-empty-emoji { font-size: 60px; }
        .moments-empty-text {
          font-family: var(--font-body);
          font-size: 15px;
          color: var(--text-muted);
          text-align: center;
          line-height: 1.6;
        }

        /* dark */
        .app.dark .moment-card-new { background: #2A2540; }
        .app.dark .moment-title-new { color: #EDE4F0; }
      `}</style>

      <div className="moments-wrap">
        {/* Header */}
        <div className="moments-header">
          <div className="moments-header-title">💝 Наши моменты</div>
          <div className="moments-header-sub">{moments.length} воспоминаний сохранено</div>
          <div className="moments-actions">
            <button className="moments-add-btn" onClick={() => setShowModal(true)}>
              ＋ Добавить момент
            </button>
            {withPhotos.length > 1 && (
              <button className="moments-slide-btn" onClick={() => { setShowSlide(true); setSlideIdx(0) }} title="Слайд-шоу">
                ▶️
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="moments-empty">
            <div className="loading-heart">💕</div>
          </div>
        ) : moments.length === 0 ? (
          <div className="moments-empty">
            <div className="moments-empty-emoji">💝</div>
            <p className="moments-empty-text">Пока нет моментов.<br />Сохраните ваше первое воспоминание!</p>
          </div>
        ) : (
          <div className="moments-grid">
            {moments.map((moment, i) => (
              <div
                key={moment.id}
                className="moment-card-new"
                style={{ animationDelay: `${i * 0.05}s` }}
                onClick={() => moment.photo_url && setLightbox(moment)}
              >
                {moment.photo_url ? (
                  <img
                    className={`moment-img ${i % 3 === 0 ? 'moment-img-tall' : 'moment-img-wide'}`}
                    src={moment.photo_url}
                    alt={moment.title}
                    loading="lazy"
                  />
                ) : (
                  <div className="moment-no-photo">{getMoodEmoji(moment.mood)}</div>
                )}
                <div className="moment-info">
                  <div className="moment-title-new">{moment.title}</div>
                  <div className="moment-foot">
                    <span className="moment-date-new">{formatDate(moment.created_at)}</span>
                    <span>{getMoodEmoji(moment.mood)}</span>
                  </div>
                  {moment.user_id === session.user.id && (
                    <button
                      className="moment-del-btn"
                      onClick={e => { e.stopPropagation(); deleteMoment(moment.id) }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Slideshow */}
      {showSlide && withPhotos.length > 0 && (
        <div className="slideshow-overlay">
          <button className="slideshow-close" onClick={() => setShowSlide(false)}>✕</button>
          <img key={slideIdx} className="slideshow-img" src={withPhotos[slideIdx].photo_url} alt="" />
          <div className="slideshow-info">
            <div className="slideshow-title">{withPhotos[slideIdx].title}</div>
            <div className="slideshow-date">{formatDate(withPhotos[slideIdx].created_at)}</div>
            <div className="slideshow-dots">
              {withPhotos.map((_, i) => (
                <div key={i} className={`slideshow-dot${i === slideIdx ? ' active' : ''}`} onClick={() => setSlideIdx(i)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          <img className="lightbox-img" src={lightbox.photo_url} alt={lightbox.title} onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal">
            <div className="modal-handle" />
            <h2 className="modal-title">✨ Новый момент</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Название</label>
                <input className="form-input" type="text" placeholder="Прогулка по парку..." value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Описание</label>
                <textarea className="form-textarea" placeholder="Расскажи об этом моменте..." value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Настроение</label>
                <div className="emoji-select">
                  {MOODS.map(m => (
                    <button key={m.value} type="button" className={`emoji-option${mood === m.value ? ' selected' : ''}`} onClick={() => setMood(m.value)} title={m.label}>
                      {m.emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Фото</label>
                <label className="form-file-label">
                  📷 {photo ? photo.name : 'Выбрать фото'}
                  <input type="file" accept="image/*" onChange={handlePhotoSelect} />
                </label>
                {photoPreview && <img className="photo-preview" src={photoPreview} alt="Preview" />}
              </div>
              <button className="form-submit" type="submit" disabled={saving}>
                {saving ? '💕 Сохраняем...' : 'Сохранить 💝'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
