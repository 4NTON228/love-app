import { useState, useEffect, useRef, useCallback } from 'react'
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
          fill="rgba(200,51,74,0.4)" stroke="rgba(200,51,74,0.6)" strokeWidth="2"/>
      </g>
    </svg>
  )
}

/* Mood colors for display (no emoji) */
const MOODS = [
  { value: 'love',      label: 'Любовь',      color: '#C8334A' },
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

/* ── Stories Viewer ── */
const STORY_DURATION = 5000

function StoriesViewer({ stories, startIdx, onClose }) {
  const [idx, setIdx] = useState(startIdx)
  const [progress, setProgress] = useState(0)
  const [bursts, setBursts] = useState([])
  const [liked, setLiked] = useState(false)
  const rafRef = useRef(null)
  const startRef = useRef(null)

  const story = stories[idx]
  const moodData = getMood(story?.mood)

  // Reset and start progress animation when idx changes
  useEffect(() => {
    setProgress(0)
    setLiked(false)
    startRef.current = null

    function tick(ts) {
      if (!startRef.current) startRef.current = ts
      const elapsed = ts - startRef.current
      const p = Math.min((elapsed / STORY_DURATION) * 100, 100)
      setProgress(p)
      if (p < 100) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        if (idx < stories.length - 1) {
          setIdx(i => i + 1)
        } else {
          onClose()
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [idx, stories.length])

  function goNext() {
    cancelAnimationFrame(rafRef.current)
    if (idx < stories.length - 1) setIdx(i => i + 1)
    else onClose()
  }

  function goPrev() {
    cancelAnimationFrame(rafRef.current)
    if (idx > 0) setIdx(i => i - 1)
  }

  function triggerHeart(e) {
    e.stopPropagation()
    setLiked(true)
    const newBursts = Array.from({ length: 10 }, (_, i) => ({
      id: Date.now() + i,
      angle: (i / 10) * 360 + Math.random() * 20,
      dist: 55 + Math.random() * 35,
      size: 10 + Math.random() * 8,
    }))
    setBursts(b => [...b, ...newBursts])
    setTimeout(() => setBursts([]), 900)
  }

  if (!story) return null

  return (
    <div className="stories-overlay" style={{ position:'fixed', inset:0, zIndex:300, background:'#000', display:'flex', flexDirection:'column', userSelect:'none', touchAction:'none' }}>
      <style>{`
        .stories-prog-track {
          flex: 1; height: 2.5px;
          background: rgba(255,255,255,0.3);
          border-radius: 2px; overflow: hidden;
        }
        .stories-prog-fill {
          height: 100%; background: white; border-radius: 2px;
        }
        .stories-close-btn {
          position: absolute;
          top: calc(var(--safe-top,0px) + 22px); right: 16px;
          z-index: 20;
          background: rgba(0,0,0,0.35); border: none; border-radius: 50%;
          width: 38px; height: 38px; color: white; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        @keyframes storyImgIn {
          from { opacity:0; transform: scale(1.04); }
          to   { opacity:1; transform: scale(1); }
        }
        .story-bg-img {
          width:100%; height:100%; object-fit:cover;
          animation: storyImgIn 0.35s ease both;
        }
        @keyframes heartBurstOut {
          0%   { opacity:1; transform: translate(0,0) scale(1.2); }
          100% { opacity:0; transform: translate(var(--bx),var(--by)) scale(0.2); }
        }
        .burst-particle {
          position:absolute; pointer-events:none;
          animation: heartBurstOut 0.85s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        @keyframes likedPop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.4); }
          100% { transform: scale(1); }
        }
        .heart-liked { animation: likedPop 0.35s ease both; }
        .stories-tap-l {
          position:absolute; left:0; top:0; width:35%; height:100%;
          z-index:5; background:transparent;
        }
        .stories-tap-r {
          position:absolute; right:0; top:0; width:65%; height:100%;
          z-index:5; background:transparent;
        }
      `}</style>

      {/* Progress bars */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, zIndex:10,
        padding:`calc(var(--safe-top,0px) + 10px) 10px 0`,
        display:'flex', gap:4,
      }}>
        {stories.map((_, i) => (
          <div key={i} className="stories-prog-track">
            <div className="stories-prog-fill" style={{
              width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%',
              transition: i === idx ? 'none' : undefined,
            }} />
          </div>
        ))}
      </div>

      {/* Close button */}
      <button className="stories-close-btn" onClick={onClose}><IcoClose /></button>

      {/* Background */}
      <div style={{ position:'absolute', inset:0 }}>
        {story.photo_url ? (
          <img key={story.id} className="story-bg-img" src={story.photo_url} alt={story.title} />
        ) : (
          <div style={{
            width:'100%', height:'100%',
            background: `linear-gradient(160deg, ${moodData.color}44 0%, #0A0A14 100%)`,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg viewBox="0 0 60 56" width="130" height="120" fill="none">
              <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z"
                fill={moodData.color} opacity="0.45"/>
            </svg>
          </div>
        )}
      </div>

      {/* Tap zones */}
      <div className="stories-tap-l" onClick={goPrev} />
      <div className="stories-tap-r" onClick={goNext} />

      {/* Caption overlay */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, zIndex:10,
        padding:`80px 20px calc(var(--safe-bottom,0px) + 110px)`,
        background:'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)',
        pointerEvents:'none',
      }}>
        <div style={{
          fontFamily:'var(--font-display)', fontSize:22, color:'white',
          marginBottom:5, textShadow:'0 2px 10px rgba(0,0,0,0.6)',
        }}>{story.title}</div>
        {story.description && (
          <div style={{
            fontFamily:'var(--font-body)', fontSize:14, color:'rgba(255,255,255,0.82)',
            lineHeight:1.55, textShadow:'0 1px 5px rgba(0,0,0,0.5)',
          }}>{story.description}</div>
        )}
        <div style={{
          fontFamily:'var(--font-body)', fontSize:12, color:'rgba(255,255,255,0.48)',
          marginTop:7,
        }}>{formatDate(story.created_at)}</div>
      </div>

      {/* Heart button + burst */}
      <div style={{
        position:'absolute',
        bottom:`calc(var(--safe-bottom,0px) + 112px)`,
        right:22, zIndex:15,
      }}>
        <button
          onClick={triggerHeart}
          style={{
            background:'rgba(255,255,255,0.13)',
            border:'1.5px solid rgba(255,255,255,0.28)',
            borderRadius:'50%', width:54, height:54,
            color:'white', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}
        >
          <svg viewBox="0 0 24 22" width="24" height="22" fill="none" className={liked ? 'heart-liked' : ''}>
            <path d="M12 20S2 13.5 2 6C2 3.5 4 1.5 6.5 1.5C8.5 1.5 10 3 12 5.5C14 3 15.5 1.5 17.5 1.5C20 1.5 22 3.5 22 6C22 13.5 12 20 12 20Z"
              fill={liked ? '#C8334A' : 'rgba(255,255,255,0.25)'} stroke="white" strokeWidth="1.5"/>
          </svg>
        </button>
        {/* Burst particles */}
        {bursts.map(b => {
          const rad = (b.angle * Math.PI) / 180
          return (
            <div key={b.id} className="burst-particle" style={{
              '--bx': `${Math.cos(rad) * b.dist}px`,
              '--by': `${Math.sin(rad) * b.dist}px`,
              left: 27 - b.size / 2, top: 27 - b.size / 2,
            }}>
              <svg viewBox="0 0 12 11" width={b.size} height={b.size * 0.92} fill="#C8334A">
                <path d="M6 10S1 6.5 1 3C1 1.75 2 1 3.25 1C4.25 1 5 1.75 6 3C7 1.75 7.75 1 8.75 1C10 1 11 1.75 11 3C11 6.5 6 10 6 10Z"/>
              </svg>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Moments({ session }) {
  const [moments, setMoments] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [storiesIdx, setStoriesIdx] = useState(0)
  const [showStories, setShowStories] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [mood, setMood] = useState('love')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  useEffect(() => { loadMoments() }, [])

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

  function openStories(i) {
    setStoriesIdx(i)
    setShowStories(true)
  }

  return (
    <>
      <style>{`
        .moments-wrap { padding: 0 0 120px; }
        .moments-header {
          background: var(--gradient-banner, linear-gradient(160deg, #C8334A 0%, #8B1A2C 100%));
          background-size: 200% 200%;
          animation: gradientShift 8s ease infinite;
          padding: 60px 20px 24px;
          border-radius: 0 0 28px 28px;
          margin-bottom: 18px;
          box-shadow: 0 8px 32px rgba(139,26,44,0.3);
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
          background: var(--blush, #FBF0F2);
        }
        .app.dark .moment-no-photo { background: rgba(139,26,44,0.12); }
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
        .moment-del-btn:active { background: rgba(200,51,74,0.1); color: #C8334A; }

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

        .app.dark .moment-card-new { background: var(--surface-2, #1E0A10); }
        .app.dark .moment-title-new { color: var(--ink, #F5E8EA); }
      `}</style>

      <div className="moments-wrap">
        <div className="moments-header">
          <div className="moments-header-title">Наши моменты</div>
          <div className="moments-header-sub">{moments.length} воспоминаний сохранено</div>
          <div className="moments-actions">
            <button className="moments-add-btn" onClick={() => setShowModal(true)}>
              <IcoPlus /> Добавить момент
            </button>
            {moments.length > 0 && (
              <button className="moments-slide-btn" onClick={() => openStories(0)} title="Истории">
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
                  onClick={() => openStories(i)}
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

      {/* Stories Viewer */}
      {showStories && moments.length > 0 && (
        <StoriesViewer
          stories={moments}
          startIdx={storiesIdx}
          onClose={() => setShowStories(false)}
        />
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
