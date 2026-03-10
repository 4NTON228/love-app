import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

/* ── SVG icons ── */
function IcoTrash() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  )
}
function IcoClose() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}
function IcoPlay() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none"/>
    </svg>
  )
}
function IcoCamera() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}
function IcoCameraLg() {
  return (
    <svg viewBox="0 0 60 56" width="48" height="44" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M54 44a4 4 0 01-4 4H10a4 4 0 01-4-4V20a4 4 0 014-4h8l4-6h16l4 6h8a4 4 0 014 4v24z"/>
      <circle cx="30" cy="30" r="8"/>
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
      <style>{`@keyframes hbLoad{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}.hbL{animation:hbLoad 1.2s ease-in-out infinite;transform-origin:center}`}</style>
      <g className="hbL">
        <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z"
          fill="rgba(232,70,106,0.4)" stroke="rgba(232,70,106,0.6)" strokeWidth="2"/>
      </g>
    </svg>
  )
}

/* Mood colors for display (no emoji) */
const MOODS = [
  { value: 'love',      label: 'Любовь',      color: '#e8466a' },
  { value: 'happy',     label: 'Счастье',     color: '#f7c948' },
  { value: 'laugh',     label: 'Смех',        color: '#ff8fab' },
  { value: 'warm',      label: 'Тепло',       color: '#f97316' },
  { value: 'dream',     label: 'Мечта',       color: '#a78bfa' },
  { value: 'kiss',      label: 'Поцелуй',     color: '#ec4899' },
  { value: 'adventure', label: 'Путешествие', color: '#22c55e' },
  { value: 'cozy',      label: 'Уют',         color: '#b45309' },
]

function getMood(moodValue) {
  return MOODS.find(m => m.value === moodValue) || MOODS[0]
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
          background: var(--theme-gradient, linear-gradient(160deg, #e8466a 0%, #c84b8b 50%, #9b4dca 100%));
          padding: 60px 20px 24px;
          border-radius: 0 0 32px 32px;
          margin-bottom: 18px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        .moments-header-title {
          font-family: var(--font-display);
          font-size: 26px;
          color: white;
          text-shadow: 0 1px 3px rgba(0,0,0,0.3);
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
        }
        .app.dark .moment-no-photo { background: rgba(200,75,139,0.12); }
        .moment-info { padding: 10px 12px; }
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
        .moment-mood-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .moment-del-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 2px 4px;
          line-height: 1;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
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
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .moments-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 60px 20px;
          gap: 12px;
        }
        .moments-empty-text {
          font-family: var(--font-body);
          font-size: 15px;
          color: var(--text-muted);
          text-align: center;
          line-height: 1.6;
        }

        /* Mood selector in modal */
        .mood-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .mood-btn {
          padding: 6px 12px;
          border-radius: 20px;
          border: 2px solid transparent;
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 0.15s, transform 0.15s;
        }
        .mood-btn:active { transform: scale(0.95); }

        .app.dark .moment-card-new { background: #2A2540; }
        .app.dark .moment-title-new { color: #EDE4F0; }
      `}</style>

      <div className="moments-wrap">
        <div className="moments-header">
          <div className="moments-header-title">Наши моменты</div>
          <div className="moments-header-sub">{moments.length} воспоминаний сохранено</div>
          <div className="moments-actions">
            <button className="moments-add-btn" onClick={() => setShowModal(true)}>
              <IcoPlus /> Добавить момент
            </button>
            {withPhotos.length > 1 && (
              <button className="moments-slide-btn" onClick={() => { setShowSlide(true); setSlideIdx(0) }} title="Слайд-шоу">
                <IcoPlay />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="moments-empty"><LoadingHeart /></div>
        ) : moments.length === 0 ? (
          <div className="moments-empty">
            <IcoCameraLg />
            <p className="moments-empty-text">Пока нет моментов.<br />Сохраните ваше первое воспоминание!</p>
          </div>
        ) : (
          <div className="moments-grid">
            {moments.map((moment, i) => {
              const moodData = getMood(moment.mood)
              return (
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
                    <div className="moment-no-photo">
                      {/* Heart SVG for no-photo placeholder */}
                      <svg viewBox="0 0 60 56" width="44" height="40" fill="none">
                        <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z"
                          fill={moodData.color} opacity="0.4"/>
                      </svg>
                    </div>
                  )}
                  <div className="moment-info">
                    <div className="moment-title-new">{moment.title}</div>
                    <div className="moment-foot">
                      <span className="moment-date-new">{formatDate(moment.created_at)}</span>
                      <span
                        className="moment-mood-dot"
                        style={{ background: moodData.color }}
                        title={moodData.label}
                      />
                    </div>
                    {moment.user_id === session.user.id && (
                      <button className="moment-del-btn" onClick={e => { e.stopPropagation(); deleteMoment(moment.id) }}>
                        <IcoTrash />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Slideshow */}
      {showSlide && withPhotos.length > 0 && (
        <div className="slideshow-overlay">
          <button className="slideshow-close" onClick={() => setShowSlide(false)}><IcoClose /></button>
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
          <button className="lightbox-close" onClick={() => setLightbox(null)}><IcoClose /></button>
          <img className="lightbox-img" src={lightbox.photo_url} alt={lightbox.title} onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal">
            <div className="modal-handle" />
            <h2 className="modal-title">Новый момент</h2>
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
                <div className="mood-grid">
                  {MOODS.map(m => (
                    <button
                      key={m.value}
                      type="button"
                      className="mood-btn"
                      onClick={() => setMood(m.value)}
                      style={{
                        background: mood === m.value ? m.color + '22' : 'transparent',
                        borderColor: mood === m.value ? m.color : 'rgba(0,0,0,0.1)',
                        color: mood === m.value ? m.color : 'var(--text-muted)',
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Фото</label>
                <label className="form-file-label">
                  <IcoCamera /> {photo ? photo.name : 'Выбрать фото'}
                  <input type="file" accept="image/*" onChange={handlePhotoSelect} />
                </label>
                {photoPreview && <img className="photo-preview" src={photoPreview} alt="Preview" />}
              </div>
              <button className="form-submit" type="submit" disabled={saving}>
                {saving ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
