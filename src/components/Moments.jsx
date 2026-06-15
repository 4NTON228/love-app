import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { sendPushNotification } from '../lib/push'
import { processAndUpload, validateImageFile } from '../lib/mediaUtils'
import { toast } from '../lib/helpers'

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

function StoriesViewer({ stories, startIdx, onClose, onToggleLike }) {
  const [idx, setIdx] = useState(startIdx)
  const [burst, setBurst] = useState(false)
  const burstTimerRef = useRef(null)

  const story = stories[idx]
  const moodData = getMood(story?.mood)
  const liked = !!story?.liked

  // Блокируем скролл body при открытии
  useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    document.body.style.left = '0'
    document.body.style.right = '0'

    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      document.body.style.left = ''
      document.body.style.right = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  // Чистим таймер всплеска сердца при размонтировании
  useEffect(() => () => {
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current)
  }, [])

  function goNext() {
    if (idx < stories.length - 1) {
      setIdx(i => i + 1)
    } else {
      onClose()
    }
  }

  function goPrev() {
    if (idx > 0) {
      setIdx(i => i - 1)
    }
  }

  function triggerHeart(e) {
    e.stopPropagation()
    const next = !liked
    onToggleLike?.(story.id, next)
    if (next) {
      setBurst(true)
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current)
      burstTimerRef.current = setTimeout(() => setBurst(false), 600)
    }
  }

  if (!story) return null

  return createPortal(
    <div
      className="stories-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: '#000000',
        display: 'flex',
        flexDirection: 'column',
        touchAction: 'none', // Фото зафиксировано — никакого скролла/смещения
        overscrollBehavior: 'none',
      }}
    >
      <style>{`
        .stories-prog-track {
          flex: 1;
          height: 3px;
          background: rgba(255,255,255,0.25);
          border-radius: 3px;
          overflow: hidden;
        }
        .stories-prog-fill {
          height: 100%;
          width: 100%;
          border-radius: 3px;
          background: #ffffff;
          transform: scaleX(0);
          transform-origin: left center;
        }
        .stories-prog-fill.done { transform: scaleX(1); }
        .stories-prog-fill.active {
          animation: storyFill linear forwards;
          will-change: transform;
        }
        @keyframes storyFill {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        .stories-close-btn {
          position: absolute;
          top: calc(env(safe-area-inset-top, 0px) + 20px);
          right: 20px;
          z-index: 30;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(10px);
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .stories-image-container {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000000;
        }
        .story-img {
          position: relative;
          z-index: 1;
          display: block;
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;
          object-fit: contain;
          pointer-events: none;
          border-radius: 4px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6);
          animation: storyImgIn 0.45s cubic-bezier(0.22, 1, 0.36, 1);
          will-change: transform, opacity;
        }
        @keyframes storyImgIn {
          from { opacity: 0; transform: scale(1.05); }
          to   { opacity: 1; transform: scale(1); }
        }
        /* Blurred fill behind the photo for a richer look */
        .stories-image-container::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: var(--bg-img);
          background-size: cover;
          background-position: center;
          filter: blur(40px) brightness(0.45) saturate(1.2);
          transform: scale(1.2);
          opacity: var(--bg-op, 0);
          transition: opacity 0.4s ease;
          pointer-events: none;
        }
        .stories-tap-left {
          position: absolute;
          left: 0;
          top: 0;
          width: 25%;
          height: 100%;
          z-index: 20;
          background: transparent;
        }
        .stories-tap-right {
          position: absolute;
          right: 0;
          top: 0;
          width: 25%;
          height: 100%;
          z-index: 20;
          background: transparent;
        }
        .stories-caption {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 15;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          /* extra right padding keeps text clear of the heart button */
          padding: 100px 96px calc(env(safe-area-inset-bottom, 0px) + 120px) 24px;
          background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%);
          pointer-events: none;
        }
        .stories-heart-btn {
          position: absolute;
          bottom: calc(env(safe-area-inset-bottom, 0px) + 120px);
          right: 24px;
          z-index: 20;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(12px);
          border: 1.5px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          width: 56px;
          height: 56px;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.1s;
        }
        .stories-heart-btn:active {
          transform: scale(0.92);
        }
        .stories-heart-btn.is-liked {
          background: rgba(255,59,92,0.18);
          border-color: rgba(255,59,92,0.55);
        }
        .heart-svg {
          position: relative;
          z-index: 2;
          transition: transform 0.18s ease;
        }
        .heart-svg path { transition: fill 0.18s ease; }
        .heart-pop {
          animation: heartPop 0.55s cubic-bezier(0.18, 0.89, 0.32, 1.28);
        }
        @keyframes heartPop {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.42); }
          55%  { transform: scale(0.88); }
          100% { transform: scale(1); }
        }
        /* Particle burst when liking */
        .stories-heart-burst {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
        }
        .burst-piece {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 7px;
          height: 7px;
          margin: -3.5px 0 0 -3.5px;
          border-radius: 50%;
          background: #FF3B5C;
          opacity: 0;
          animation: burstFly 0.6s ease-out forwards;
        }
        @keyframes burstFly {
          0%   { opacity: 1; transform: rotate(var(--a)) translateY(0) scale(1); }
          100% { opacity: 0; transform: rotate(var(--a)) translateY(-38px) scale(0.3); }
        }
      `}</style>

      {/* Progress bars */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 25,
        padding: `calc(env(safe-area-inset-top, 0px) + 12px) 12px 0`,
        display: 'flex',
        gap: 6,
      }}>
        {stories.map((_, i) => (
          <div key={i} className="stories-prog-track">
            {i < idx && <div className="stories-prog-fill done" />}
            {i === idx && (
              <div
                key={idx}
                className="stories-prog-fill active"
                style={{ animationDuration: `${STORY_DURATION}ms` }}
                onAnimationEnd={goNext}
              />
            )}
          </div>
        ))}
      </div>

      {/* Close button */}
      <button className="stories-close-btn" onClick={onClose}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      {/* Image Container */}
      <div
        className="stories-image-container"
        style={{
          '--bg-img': story.photo_url ? `url("${story.photo_url}")` : 'none',
          '--bg-op': story.photo_url ? 1 : 0,
        }}
      >
        {story.photo_url ? (
          <img
            key={story.id}
            className="story-img"
            src={story.photo_url}
            alt={story.title}
            loading="eager"
            draggable={false}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            background: `linear-gradient(160deg, ${moodData.color}66 0%, #1a0a0a 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg viewBox="0 0 60 56" width="100" height="93" fill="none">
              <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z"
                fill={moodData.color} opacity="0.6"/>
            </svg>
          </div>
        )}
      </div>

      {/* Tap zones */}
      <div className="stories-tap-left" onClick={goPrev} />
      <div className="stories-tap-right" onClick={goNext} />

      {/* Caption */}
      <div className="stories-caption">
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 11px 4px 8px',
          marginBottom: 10,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.16)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          fontWeight: 600,
          color: '#fff',
          letterSpacing: '0.02em',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: moodData.color }} />
          {moodData.label}
        </span>
        <div style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 28,
          fontWeight: 600,
          color: 'white',
          marginBottom: 8,
          textShadow: '0 2px 12px rgba(0,0,0,0.5)',
        }}>
          {story.title}
        </div>
        {story.description && (
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.5,
          }}>
            {story.description}
          </div>
        )}
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 12,
          color: 'rgba(255,255,255,0.5)',
          marginTop: 8,
        }}>
          {formatDate(story.created_at)}
        </div>
      </div>

      {/* Heart button */}
      <button
        className={`stories-heart-btn${liked ? ' is-liked' : ''}`}
        onClick={triggerHeart}
        aria-pressed={liked}
        aria-label={liked ? 'Убрать лайк' : 'Поставить лайк'}
      >
        {burst && (
          <span className="stories-heart-burst" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <span key={i} className="burst-piece" style={{ '--a': `${i * 60}deg` }} />
            ))}
          </span>
        )}
        <svg viewBox="0 0 24 22" width="26" height="24" fill="none" className={`heart-svg${burst ? ' heart-pop' : ''}`}>
          <path d="M12 20S2 13.5 2 6C2 3.5 4 1.5 6.5 1.5C8.5 1.5 10 3 12 5.5C14 3 15.5 1.5 17.5 1.5C20 1.5 22 3.5 22 6C22 13.5 12 20 12 20Z"
            fill={liked ? '#FF3B5C' : 'rgba(255,255,255,0.25)'} stroke="white" strokeWidth="1.5"/>
        </svg>
      </button>
    </div>,
    document.body
  )
}
export default function Moments({ session, profile }) {
  const uid = session?.user?.id
  const pid = profile?.partner_id
  const [moments, setMoments] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadStage, setUploadStage] = useState('')
  const [imgErrors, setImgErrors] = useState({})
  const [storiesIdx, setStoriesIdx] = useState(0)
  const [showStories, setShowStories] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [mood, setMood] = useState('love')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  const loadMoments = useCallback(async () => {
    const ids = [uid, pid].filter(Boolean)
    if (!ids.length) { setLoading(false); return }
    const q = supabase.from('moments').select('*').order('created_at', { ascending: false })
    const { data } = ids.length === 1
      ? await q.eq('user_id', ids[0])
      : await q.in('user_id', ids)
    setMoments(data || [])
    setLoading(false)
  }, [uid, pid])

  useEffect(() => { loadMoments() }, [loadMoments])

  function handlePhotoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    const err = validateImageFile(file)
    if (err) { toast.error(err); e.target.value = ''; return }
    setPhoto(file)
    setPhotoPreview(prev => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) { toast.error('Добавьте название'); return }
    setSaving(true)
    try {
      let photoUrl = null
      let thumbUrl = null
      if (photo) {
        setUploadStage('Сжимаем фото…')
        const base = `moments/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        setUploadStage('Загружаем…')
        const res = await processAndUpload(photo, base)
        photoUrl = res.publicUrl
        thumbUrl = res.thumbPublicUrl
      }
      setUploadStage('Сохраняем…')
      const { error } = await supabase.from('moments').insert({
        user_id: session.user.id, title: title.trim(), description, mood,
        photo_url: photoUrl, thumb_url: thumbUrl,
      })
      if (error) throw error

      resetForm(); setShowModal(false); loadMoments()
      toast.success('Момент сохранён')
      if (profile?.partner_id) {
        sendPushNotification(
          profile?.name || 'Новый момент',
          photo ? `📸 ${title}` : `💝 ${title}`,
          profile.partner_id,
          session.user.id
        ).catch(() => {})
      }
    } catch (err) {
      console.error(err)
      toast.error('Не удалось сохранить момент')
    } finally {
      setSaving(false)
      setUploadStage('')
    }
  }

  async function deleteMoment(id) {
    if (!confirm('Удалить этот момент?')) return
    const { error } = await supabase.from('moments').delete().eq('id', id)
    if (error) { toast.error('Не удалось удалить'); return }
    setMoments(prev => prev.filter(m => m.id !== id))
    toast.success('Момент удалён')
  }

  function resetForm() {
    setTitle(''); setDescription(''); setMood('love'); setPhoto(null)
    setPhotoPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return null })
  }

  function openStories(i) {
    setStoriesIdx(i)
    setShowStories(true)
  }

  const toggleLike = useCallback(async (id, value) => {
    // Оптимистично обновляем UI
    setMoments(prev => prev.map(m => (m.id === id ? { ...m, liked: value } : m)))
    const { error } = await supabase.from('moments').update({ liked: value }).eq('id', id)
    if (error) {
      // Откатываем при ошибке
      setMoments(prev => prev.map(m => (m.id === id ? { ...m, liked: !value } : m)))
      console.error('Не удалось сохранить лайк:', error)
      toast.error('Не удалось сохранить лайк')
    }
  }, [])

  return (
    <>
      <style>{`
        .moments-wrap { padding: 0 0 120px; }
        .moments-header {
          background: linear-gradient(165deg, #5e2545 0%, #92384e 42%, #bd5552 76%, #cb6650 100%);
          padding: 60px 20px 30px;
          border-radius: 0 0 32px 32px;
          margin-bottom: 18px;
          box-shadow: 0 12px 40px rgba(60,20,40,0.45);
          overflow: hidden;
          position: relative;
        }
        .moments-header::after {
          content: '';
          position: absolute; inset: 0; border-radius: inherit;
          background: radial-gradient(ellipse at 80% 0%, rgba(255,210,150,0.30) 0%, transparent 55%);
          pointer-events: none;
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
          background: rgba(255,255,255,0.18);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.28);
          border-radius: 14px;
          color: white;
          font-family: var(--font-body);
          font-weight: 500;
          font-size: 14px;
          padding: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: background 0.15s, transform 0.15s;
        }
        .moments-add-btn:active { background: rgba(255,255,255,0.26); transform: scale(0.97); }
        .moments-slide-btn {
          background: rgba(255,255,255,0.13);
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: 14px;
          color: white;
          width: 48px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, transform 0.15s;
        }
        .moments-slide-btn:active { background: rgba(255,255,255,0.22); transform: scale(0.96); }

        /* Grid — uniform photo tiles (always shows every photo, no gaps) */
        .moments-grid {
          padding: 0 14px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .moment-card-new {
          position: relative;
          aspect-ratio: 3 / 4;
          border-radius: 20px;
          overflow: hidden;
          background: linear-gradient(160deg, #3a1622, #1d0b12);
          box-shadow: 0 6px 20px rgba(40,12,24,0.18);
          animation: momentIn 0.45s ease both;
          cursor: pointer;
          transition: transform 0.16s ease;
        }
        @keyframes momentIn {
          from { opacity:0; transform: translateY(20px) scale(0.96); }
          to   { opacity:1; transform: translateY(0) scale(1); }
        }
        .moment-card-new:active { transform: scale(0.97); }

        .moment-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .moment-no-photo {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* gradient + caption overlaid on the photo */
        .moment-overlay {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          z-index: 1;
          padding: 30px 12px 12px;
          background: linear-gradient(to top,
            rgba(10,4,8,0.82) 0%,
            rgba(10,4,8,0.40) 55%,
            transparent 100%);
        }
        .moment-title-new {
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 13.5px;
          color: #fff;
          line-height: 1.25;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-shadow: 0 1px 4px rgba(0,0,0,0.5);
        }
        .moment-mood-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 9px 3px 7px;
          margin-bottom: 7px;
          border-radius: 999px;
          background: rgba(0,0,0,0.42);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 600;
          color: #fff;
          letter-spacing: 0.02em;
        }
        .moment-mood-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .moment-date-new {
          display: block;
          margin-top: 4px;
          font-size: 11px;
          color: rgba(255,255,255,0.78);
          font-family: var(--font-body);
        }

        .moment-like-badge {
          position: absolute;
          top: 9px; right: 9px;
          z-index: 2;
          width: 30px; height: 30px;
          border-radius: 50%;
          background: rgba(0,0,0,0.35);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          pointer-events: none;
        }
        .moment-del-btn {
          position: absolute;
          top: 9px; left: 9px;
          z-index: 2;
          background: rgba(0,0,0,0.35);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: none;
          color: rgba(255,255,255,0.9);
          cursor: pointer;
          width: 30px; height: 30px;
          line-height: 0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .moment-del-btn:active { background: rgba(200,51,74,0.6); }

        /* "+" tile that invites adding a new moment */
        .moment-add-tile {
          aspect-ratio: 3 / 4;
          border-radius: 20px;
          border: 2px dashed hsl(var(--h,349), var(--s,59%), 70%);
          background: hsl(var(--h,349), var(--s,59%), 97%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          color: var(--rose, #C8334A);
          transition: transform 0.16s ease, background 0.16s ease;
          animation: momentIn 0.45s ease both;
        }
        .app.dark .moment-add-tile {
          border-color: hsl(var(--h,349), var(--s,59%), 32%);
          background: hsl(var(--h,349), var(--s,59%), 12%);
        }
        .moment-add-tile:active { transform: scale(0.97); }
        .moment-add-tile-circle {
          width: 46px; height: 46px;
          border-radius: 50%;
          background: var(--rose, #C8334A);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 16px rgba(200,51,74,0.35);
        }
        .moment-add-tile-label {
          font-family: var(--font-body);
          font-size: 12.5px;
          font-weight: 600;
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
        ) : (
          <div className="moments-grid">
            <div className="moment-add-tile" onClick={() => setShowModal(true)}>
              <span className="moment-add-tile-circle"><IcoPlus /></span>
              <span className="moment-add-tile-label">Добавить фото</span>
            </div>
            {moments.map((moment, i) => {
              const moodData = getMood(moment.mood)
              const isMine = moment.user_id === session.user.id
              return (
                <div
                  key={moment.id}
                  className="moment-card-new"
                  style={{ animationDelay: `${Math.min(i, 8) * 0.05}s` }}
                  onClick={() => openStories(i)}
                >
                  {moment.photo_url && !imgErrors[moment.id] ? (
                    <img
                      className="moment-img"
                      src={moment.thumb_url || moment.photo_url}
                      alt={moment.title}
                      loading="lazy"
                      decoding="async"
                      onError={() => setImgErrors(prev => ({ ...prev, [moment.id]: true }))}
                    />
                  ) : (
                    <div
                      className="moment-no-photo"
                      style={{ background: `linear-gradient(160deg, ${moodData.color}88, #1d0b12)` }}
                    >
                      <svg viewBox="0 0 60 56" width="48" height="44" fill="none">
                        <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z"
                          fill="#ffffff" opacity="0.55"/>
                      </svg>
                    </div>
                  )}

                  {moment.liked && (
                    <span className="moment-like-badge">
                      <svg viewBox="0 0 24 22" width="15" height="14" fill="#FF3B5C" stroke="white" strokeWidth="1.5">
                        <path d="M12 20S2 13.5 2 6C2 3.5 4 1.5 6.5 1.5C8.5 1.5 10 3 12 5.5C14 3 15.5 1.5 17.5 1.5C20 1.5 22 3.5 22 6C22 13.5 12 20 12 20Z"/>
                      </svg>
                    </span>
                  )}

                  {isMine && (
                    <button
                      className="moment-del-btn"
                      onClick={e => { e.stopPropagation(); deleteMoment(moment.id) }}
                      aria-label="Удалить момент"
                    >
                      <IcoTrash />
                    </button>
                  )}

                  <div className="moment-overlay">
                    <span className="moment-mood-chip">
                      <span className="moment-mood-dot" style={{ background: moodData.color }} />
                      {moodData.label}
                    </span>
                    <div className="moment-title-new">{moment.title}</div>
                    <span className="moment-date-new">{formatDate(moment.created_at)}</span>
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
          onToggleLike={toggleLike}
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
                {saving ? (uploadStage || 'Сохраняем…') : 'Сохранить'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
