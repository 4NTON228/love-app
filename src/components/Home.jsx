import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { sendPushNotification } from '../lib/push'
import { toast } from '../lib/helpers'
import LoveStory from './LoveStory'
import './Home.css'

/* ─────────────────────────────────────────────
   HeartWave — full-screen burst of rising hearts
───────────────────────────────────────────── */
function HeartWave() {
  const hearts = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      dur: 1.7 + Math.random() * 1.3,
      size: 16 + Math.random() * 28,
    })),
    []
  )
  return createPortal(
    <div className="heart-wave" aria-hidden="true">
      <style>{`
        .heart-wave { position: fixed; inset: 0; z-index: 4000; pointer-events: none; overflow: hidden; }
        .hw-heart {
          position: absolute; bottom: -40px;
          color: #ff5c7a;
          opacity: 0;
          will-change: transform, opacity;
          animation: hwRise var(--d, 2s) ease-in forwards;
          filter: drop-shadow(0 4px 10px rgba(255,92,122,0.5));
        }
        @keyframes hwRise {
          0%   { transform: translateY(0) scale(0.6) rotate(0deg); opacity: 0; }
          15%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(-105vh) scale(1.1) rotate(20deg); opacity: 0; }
        }
      `}</style>
      {hearts.map(h => (
        <span
          key={h.id}
          className="hw-heart"
          style={{ left: `${h.left}%`, fontSize: `${h.size}px`, animationDelay: `${h.delay}s`, '--d': `${h.dur}s` }}
        >
          ♥
        </span>
      ))}
    </div>,
    document.body
  )
}

/* ─────────────────────────────────────────────
   Confetti — anniversary celebration
───────────────────────────────────────────── */
function Confetti() {
  const pieces = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      dur: 2.4 + Math.random() * 2.2,
      size: 7 + Math.random() * 8,
      rot: Math.random() * 360,
      color: ['#ffd76a', '#ff8da0', '#ffffff', '#d8456b', '#ffb3c1'][i % 5],
    })),
    []
  )
  return createPortal(
    <div className="confetti-layer" aria-hidden="true">
      <style>{`
        .confetti-layer { position: fixed; inset: 0; z-index: 4001; pointer-events: none; overflow: hidden; }
        .confetti-piece {
          position: absolute; top: -24px;
          will-change: transform, opacity;
          animation: confFall var(--d, 3s) linear var(--delay, 0s) forwards;
          border-radius: 2px;
        }
        @keyframes confFall {
          0%   { transform: translateY(-10px) rotate(var(--r,0deg)); opacity: 1; }
          100% { transform: translateY(108vh) rotate(calc(var(--r,0deg) + 540deg)); opacity: 0; }
        }
      `}</style>
      {pieces.map(p => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 1.4}px`,
            background: p.color,
            '--d': `${p.dur}s`,
            '--delay': `${p.delay}s`,
            '--r': `${p.rot}deg`,
          }}
        />
      ))}
    </div>,
    document.body
  )
}

function pad(v) {
  return String(v).padStart(2, '0')
}

function yearsWord(n) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'год'
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'года'
  return 'лет'
}
function plural(n, one, few, many) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few
  return many
}
function dayWord(n) { return plural(n, 'день', 'дня', 'дней') }
function hourWord(n) { return plural(n, 'час', 'часа', 'часов') }

/* Status moods (emoji) shared between partners */
const STATUS_MOODS = [
  { e: '🥰', label: 'влюблён' },
  { e: '😊', label: 'хорошо' },
  { e: '🔥', label: 'огонь' },
  { e: '😴', label: 'устал' },
  { e: '😔', label: 'грустно' },
  { e: '🤔', label: 'скучаю' },
]

function relTime(ts) {
  if (!ts) return null
  const diff = Date.now() - new Date(ts).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 2) return 'онлайн'
  if (min < 60) return `${min} мин назад`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ч назад`
  const d = Math.floor(h / 24)
  return d === 1 ? 'вчера' : `${d} дн назад`
}

function getRelTime(start) {
  const diff = Date.now() - start.getTime()
  const totalDays = Math.max(0, Math.floor(diff / 86400000))
  return {
    totalDays,
    years:   Math.floor(totalDays / 365),
    months:  Math.floor((totalDays % 365) / 30),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  }
}

function getAnniversary(start) {
  const now  = new Date()
  const next = new Date(start)
  next.setFullYear(now.getFullYear())
  if (next <= now) next.setFullYear(now.getFullYear() + 1)
  const daysPassed = Math.max(0, Math.floor((now - start) / 86400000))
  return {
    daysUntil: Math.max(0, Math.ceil((next - now) / 86400000)),
    progress:  Math.min(((daysPassed % 365) / 365) * 100, 100),
  }
}

function getTimeUntil(target) {
  if (!target) return null
  const diff = new Date(target) - new Date()
  if (diff <= 0) return null
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  }
}

function localToUTC(v) { return v ? new Date(v).toISOString() : null }
function utcToLocal(v) {
  if (!v) return ''
  const d = new Date(v)
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function formatDate(v, opts) {
  return v ? new Date(v).toLocaleDateString('ru-RU', opts) : ''
}
function getInitials(name) {
  if (!name) return 'L'
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || 'L'
}

/* ── Static heart configs — rendered once, CSS-animated on GPU ── */
const HEART_CONFIGS = [
  { left: '6%',  '--size': '9px',  '--dur': '16s', '--delay': '0s',   '--r': '-12deg', '--op': '0.12' },
  { left: '17%', '--size': '13px', '--dur': '11s', '--delay': '2.5s', '--r': '8deg',   '--op': '0.10' },
  { left: '29%', '--size': '7px',  '--dur': '20s', '--delay': '5s',   '--r': '-19deg', '--op': '0.08' },
  { left: '44%', '--size': '11px', '--dur': '14s', '--delay': '1s',   '--r': '14deg',  '--op': '0.11' },
  { left: '59%', '--size': '8px',  '--dur': '22s', '--delay': '7.5s', '--r': '-8deg',  '--op': '0.09' },
  { left: '73%', '--size': '12px', '--dur': '13s', '--delay': '4s',   '--r': '20deg',  '--op': '0.12' },
  { left: '86%', '--size': '6px',  '--dur': '18s', '--delay': '9s',   '--r': '-24deg', '--op': '0.08' },
  { left: '94%', '--size': '10px', '--dur': '15s', '--delay': '3s',   '--r': '11deg',  '--op': '0.10' },
]

/* Static icon elements — created once, not on every render */
const CAMERA_ICON = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
)
const CHAT_ICON = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

/* ─────────────────────────────────────────────
   HeartsBackground — renders once, no state
───────────────────────────────────────────── */
const HeartsBackground = memo(function HeartsBackground() {
  return (
    <div className="hearts-bg" aria-hidden="true">
      {HEART_CONFIGS.map((cfg, i) => (
        <span key={i} className="heart-particle" style={cfg}>♥</span>
      ))}
    </div>
  )
})

/* ─────────────────────────────────────────────
   AvatarMedallion
───────────────────────────────────────────── */
const AvatarMedallion = memo(function AvatarMedallion({ src, name, onClick, ghost = false }) {
  const [imgError, setImgError] = useState(false)
  return (
    <button
      type="button"
      className={`home-avatar${ghost ? ' ghost' : ''}`}
      onClick={onClick}
    >
      <span className="home-avatar-shell">
        {src && !imgError ? (
          <img
            src={src}
            alt={name}
            className="home-avatar-image"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="home-avatar-fallback">{getInitials(name)}</span>
        )}
      </span>
      <span className="home-avatar-name">{name || 'Любовь'}</span>
    </button>
  )
})

/* ─────────────────────────────────────────────
   QuickAction
───────────────────────────────────────────── */
const QuickAction = memo(function QuickAction({ title, subtitle, badge, icon, onClick, wide = false, delay = 0 }) {
  return (
    <button
      type="button"
      className={`quick-action${wide ? ' wide' : ''}`}
      onClick={onClick}
      style={{ animationDelay: `${delay}s` }}
    >
      <span className="quick-action-shine" />
      <div className="quick-action-top">
        <span className="quick-action-icon">{icon}</span>
        <span className="quick-action-badge">{badge}</span>
      </div>
      <div className="quick-action-title">{title}</div>
      <div className="quick-action-subtitle">{subtitle}</div>
    </button>
  )
})

/* ─────────────────────────────────────────────
   InfoCard
───────────────────────────────────────────── */
const InfoCard = memo(function InfoCard({ eyebrow, title, children, delay, compact = false }) {
  return (
    <section
      className={`info-card${compact ? ' compact' : ''}`}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      <div className="info-card-eyebrow">{eyebrow}</div>
      <div className="info-card-title">{title}</div>
      {children}
    </section>
  )
})

/* ─────────────────────────────────────────────
   HeroCounter — isolated timer, doesn't re-render Home
───────────────────────────────────────────── */
const HeroCounter = memo(function HeroCounter({ coupleStart, anniversary, hasPartner, hasStartDate, onNavigate }) {
  const [time, setTime] = useState(() => coupleStart ? getRelTime(coupleStart) : null)

  useEffect(() => {
    if (!coupleStart) { setTime(null); return }
    setTime(getRelTime(coupleStart))
    const id = setInterval(() => setTime(getRelTime(coupleStart)), 1000)
    return () => clearInterval(id)
  }, [coupleStart])

  return (
    <div className="hero-counter">
      {time && hasStartDate ? (
        <>
          <div className="hero-counter-main">
            <div className="hero-counter-number">
              <strong>{time.totalDays}</strong>
              <span>дней вместе</span>
            </div>
            <div className="hero-clock">
              {pad(time.hours)} : {pad(time.minutes)} : {pad(time.seconds)}
            </div>
          </div>
          <div className="hero-progress">
            <div className="hero-progress-bar" style={{ width: `${anniversary.progress}%` }} />
          </div>
          <div className="hero-metrics">
            {[
              [time.years,              'лет'],
              [time.months,             'месяцев'],
              [anniversary.daysUntil ?? '-', 'до годовщины'],
            ].map(([value, label]) => (
              <div className="hero-metric" key={label}>
                <span className="hero-metric-value">{value}</span>
                <span className="hero-metric-label">{label}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="note-text">
            {hasPartner
              ? 'Укажите дату начала отношений, и экран начнёт красиво считать вашу историю.'
              : 'Пригласите партнёра — и главный экран оживёт для двоих.'}
          </p>
          <div className="actions-row">
            <button type="button" className="btn-primary" onClick={() => onNavigate?.('settings')}>
              Открыть настройки
            </button>
          </div>
        </>
      )}
    </div>
  )
})

/* ─────────────────────────────────────────────
   MeetingBody — isolated countdown timer
───────────────────────────────────────────── */
const MeetingBody = memo(function MeetingBody({ nextMeeting, onEdit }) {
  const [countdown, setCountdown] = useState(() => getTimeUntil(nextMeeting))

  useEffect(() => {
    if (!nextMeeting) { setCountdown(null); return }
    setCountdown(getTimeUntil(nextMeeting))
    const id = setInterval(() => setCountdown(getTimeUntil(nextMeeting)), 1000)
    return () => clearInterval(id)
  }, [nextMeeting])

  if (countdown) {
    return (
      <div className="meeting-row">
        <p className="meeting-phrase">
          через <strong>{countdown.days}</strong> {dayWord(countdown.days)} <strong>{countdown.hours}</strong> {hourWord(countdown.hours)} вы увидитесь 💕
        </p>
        <div className="meeting-grid">
          {[
            [countdown.days,         'дни'],
            [pad(countdown.hours),   'часы'],
            [pad(countdown.minutes), 'мин'],
            [pad(countdown.seconds), 'сек'],
          ].map(([value, label]) => (
            <div className="meeting-cell" key={label}>
              <span className="meeting-num">{value}</span>
              <span className="meeting-label">{label}</span>
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost" onClick={onEdit}>Изменить</button>
      </div>
    )
  }

  return (
    <div className="meeting-row">
      <p className="note-text">Добавьте следующую встречу, чтобы экран жил в ожидании.</p>
      <button type="button" className="btn-primary" onClick={onEdit}>Указать дату</button>
    </div>
  )
})

/* ─────────────────────────────────────────────
   PartnerModal
───────────────────────────────────────────── */
const PartnerModal = memo(function PartnerModal({ profile, loading, onClose }) {
  return (
    <div className="partner-overlay" onClick={onClose}>
      <div className="partner-dialog" onClick={e => e.stopPropagation()}>
        <button type="button" className="partner-close" onClick={onClose}>Закрыть</button>
        {loading ? (
          <div className="partner-loader" />
        ) : (
          <>
            <AvatarMedallion src={profile?.avatar_url} name={profile?.name || 'Партнёр'} />
            <div className="partner-title">{profile?.name || 'Партнёр'}</div>
            {profile?.birthday && (
              <div className="partner-subtitle">
                {formatDate(profile.birthday, { day: 'numeric', month: 'long' })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
})

/* ═══════════════════════════════════════════════════════
   Home — main component
   No timer state here — timers live in HeroCounter and MeetingBody
═══════════════════════════════════════════════════════ */
const DEFAULT_MESSAGE = 'Здесь живёт ваша история. Спокойная, красивая и только для двоих.'

export default function Home({ session, profile, onNavigate }) {
  const [settings,       setSettings]       = useState(null)
  const [settingsId,     setSettingsId]     = useState(null)
  const [nextEvent,      setNextEvent]      = useState(null)
  const [partnerProfile, setPartnerProfile] = useState(null)
  const [sharedCoupleDate, setSharedCoupleDate] = useState(null)
  const [partnerLoading, setPartnerLoading] = useState(!!profile?.partner_id)
  const [editMessage,    setEditMessage]    = useState(false)
  const [editMeeting,    setEditMeeting]    = useState(false)
  const [newMessage,     setNewMessage]     = useState('')
  const [newMeeting,     setNewMeeting]     = useState('')
  const [saving,         setSaving]         = useState(false)
  const [showPartnerModal, setShowPartnerModal] = useState(false)
  const [showWave,       setShowWave]       = useState(false)
  const [thinkingSent,   setThinkingSent]   = useState(false)
  const [showStory,      setShowStory]      = useState(false)
  const [myMood,         setMyMood]         = useState(null)
  const [streak,         setStreak]         = useState(0)
  const [partnerSeen,    setPartnerSeen]    = useState(null)
  const thinkChannelRef = useRef(null)
  const waveTimerRef = useRef(null)

  const hasPartner        = !!profile?.partner_id
  const effectiveCoupleDate = sharedCoupleDate ?? profile?.couple_start_date ?? null
  const hasStartDate      = !!effectiveCoupleDate

  const coupleStart = useMemo(() => (
    effectiveCoupleDate ? new Date(`${effectiveCoupleDate}T00:00:00`) : null
  ), [effectiveCoupleDate])

  const anniversary = useMemo(() => (
    coupleStart ? getAnniversary(coupleStart) : { daysUntil: null, progress: 0 }
  ), [coupleStart])

  // Сегодня годовщина? (тот же день и месяц, но не в самый первый год)
  const anniversaryYears = useMemo(() => {
    if (!coupleStart) return 0
    const now = new Date()
    if (now.getDate() === coupleStart.getDate() && now.getMonth() === coupleStart.getMonth()) {
      const y = now.getFullYear() - coupleStart.getFullYear()
      return y > 0 ? y : 0
    }
    return 0
  }, [coupleStart])

  const [showConfetti, setShowConfetti] = useState(false)
  useEffect(() => {
    if (anniversaryYears > 0) {
      const todayKey = `anniv-${new Date().toISOString().slice(0, 10)}`
      setShowConfetti(true)
      const t = setTimeout(() => setShowConfetti(false), 6000)
      // показываем салют один раз в день
      if (localStorage.getItem(todayKey)) setShowConfetti(false)
      else localStorage.setItem(todayKey, '1')
      return () => clearTimeout(t)
    }
  }, [anniversaryYears])

  const myName      = profile?.name || 'Ты'
  const partnerName = partnerProfile?.name || (hasPartner ? 'Партнёр' : 'Только ты')
  const headline    = hasPartner ? `${myName} и ${partnerName}` : myName
  const loveMessage = settings?.love_message || DEFAULT_MESSAGE

  /* ── "Думаю о тебе" — realtime heart wave + push ── */
  const thinkKey = useMemo(() => {
    if (profile?.couple_id) return `think-${profile.couple_id}`
    const ids = [session?.user?.id, profile?.partner_id].filter(Boolean).sort()
    return ids.length === 2 ? `think-${ids[0]}-${ids[1]}` : null
  }, [profile?.couple_id, profile?.partner_id, session?.user?.id])

  const playWave = useCallback(() => {
    setShowWave(true)
    if (waveTimerRef.current) clearTimeout(waveTimerRef.current)
    waveTimerRef.current = setTimeout(() => setShowWave(false), 3200)
  }, [])

  useEffect(() => {
    if (!thinkKey) return
    const ch = supabase.channel(thinkKey, { config: { broadcast: { self: false } } })
    ch.on('broadcast', { event: 'heart' }, () => playWave())
    ch.subscribe()
    thinkChannelRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      thinkChannelRef.current = null
      if (waveTimerRef.current) clearTimeout(waveTimerRef.current)
    }
  }, [thinkKey, playWave])

  const sendThinking = useCallback(() => {
    if (!hasPartner || thinkingSent) return
    playWave()
    setThinkingSent(true)
    setTimeout(() => setThinkingSent(false), 4000)
    thinkChannelRef.current?.send({ type: 'broadcast', event: 'heart', payload: { from: session?.user?.id } })
    sendPushNotification(
      `${myName} 💗`,
      'думает о тебе',
      profile.partner_id,
      session.user.id
    ).catch(() => {})
    toast.success('Сердечко отправлено 💗')
  }, [hasPartner, thinkingSent, playWave, session?.user?.id, profile?.partner_id, myName])

  /* ── My mood from profile ── */
  useEffect(() => { setMyMood(profile?.mood || null) }, [profile?.mood])

  const setMood = useCallback(async (emoji) => {
    const next = myMood === emoji ? null : emoji
    setMyMood(next)
    try {
      await supabase.from('profiles')
        .update({ mood: next, mood_at: next ? new Date().toISOString() : null })
        .eq('id', session.user.id)
    } catch (_e) { /* столбца может ещё не быть — тихо игнорируем */ }
  }, [myMood, session?.user?.id])

  /* ── Daily visit streak (localStorage, per device) ── */
  useEffect(() => {
    if (!session?.user?.id) return
    const key = `streak_${session.user.id}`
    const todayStr = new Date().toISOString().slice(0, 10)
    let saved = { count: 0, date: null }
    try { saved = JSON.parse(localStorage.getItem(key) || '{}') } catch (_e) { /* ignore */ }
    if (saved.date === todayStr) { setStreak(saved.count || 1); return }
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const count = saved.date === yesterday ? (saved.count || 0) + 1 : 1
    localStorage.setItem(key, JSON.stringify({ count, date: todayStr }))
    setStreak(count)
  }, [session?.user?.id])

  /* ── Keep my presence fresh + watch partner presence/mood live ── */
  useEffect(() => {
    if (!session?.user?.id) return
    const ping = () => supabase.from('profiles')
      .update({ last_seen: new Date().toISOString() }).eq('id', session.user.id).then(() => {}, () => {})
    ping()
    const id = setInterval(ping, 60000)
    return () => clearInterval(id)
  }, [session?.user?.id])

  useEffect(() => { setPartnerSeen(partnerProfile?.last_seen || null) }, [partnerProfile?.last_seen])

  useEffect(() => {
    if (!profile?.partner_id) return
    const ch = supabase
      .channel(`partner-presence-${profile.partner_id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profile.partner_id}` },
        p => {
          setPartnerSeen(p.new.last_seen || null)
          setPartnerProfile(prev => prev ? { ...prev, mood: p.new.mood, mood_at: p.new.mood_at, last_seen: p.new.last_seen } : prev)
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile?.partner_id])

  /* ── Data loading — parallel queries ── */
  useEffect(() => {
    let mounted = true

    async function loadHome() {
      if (!session?.user?.id) return
      setPartnerLoading(!!profile?.partner_id)

      try {
        const partnerQ = profile?.partner_id
          ? supabase.from('profiles')
              .select('*')
              .eq('id', profile.partner_id)
              .single()
          : Promise.resolve({ data: null })

        const coupleQ = profile?.couple_id
          ? supabase.from('couples')
              .select('start_date')
              .eq('id', profile.couple_id)
              .maybeSingle()
          : Promise.resolve({ data: null })

        const settingsQ = profile?.couple_id
          ? supabase.from('couple_settings')
              .select('*')
              .eq('couple_id', profile.couple_id)
              .maybeSingle()
          : supabase.from('couple_settings')
              .select('*')
              .eq('user_id', session.user.id)
              .maybeSingle()

        const eventsQ = (
          profile?.couple_id
            ? supabase.from('calendar_events')
                .select('id, title, emoji, event_date')
                .gte('event_date', new Date().toISOString())
                .order('event_date', { ascending: true })
                .limit(1)
                .eq('couple_id', profile.couple_id)
            : supabase.from('calendar_events')
                .select('id, title, emoji, event_date')
                .gte('event_date', new Date().toISOString())
                .order('event_date', { ascending: true })
                .limit(1)
                .eq('user_id', session.user.id)
        )

        const [
          { data: partner },
          { data: couple },
          { data: settingsData },
          { data: events },
        ] = await Promise.all([partnerQ, coupleQ, settingsQ, eventsQ])

        if (!mounted) return

        let fetchedSettings = settingsData || null
        /* Rare fallback: couple_id set but no couple-level settings yet */
        if (!fetchedSettings && profile?.couple_id) {
          const { data } = await supabase
            .from('couple_settings')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle()
          if (mounted) fetchedSettings = data || null
        }

        if (!mounted) return

        setPartnerProfile(partner || null)
        setSharedCoupleDate(couple?.start_date || null)
        setSettings(fetchedSettings)
        setSettingsId(fetchedSettings?.id || null)
        setNewMessage(fetchedSettings?.love_message || DEFAULT_MESSAGE)
        setNewMeeting(utcToLocal(fetchedSettings?.next_meeting))
        setNextEvent(events?.[0] || null)
        setPartnerLoading(false)
      } catch (err) {
        console.warn('Ошибка загрузки главного экрана:', err)
        if (mounted) setPartnerLoading(false)
      }
    }

    loadHome()
    return () => { mounted = false }
  }, [profile?.couple_id, profile?.partner_id, session?.user?.id])

  /* ── Persist settings helper ── */
  async function persistSettings(patch) {
    const payload = {
      user_id:      session.user.id,
      love_message: settings?.love_message || DEFAULT_MESSAGE,
      next_meeting: settings?.next_meeting || null,
      ...patch,
    }
    if (profile?.couple_id) payload.couple_id = profile.couple_id

    if (settingsId) {
      const { data, error } = await supabase
        .from('couple_settings').update(payload).eq('id', settingsId).select().single()
      if (error) throw error
      return data
    }
    const { data, error } = await supabase
      .from('couple_settings').insert(payload).select().single()
    if (error) throw error
    return data
  }

  async function saveMessage() {
    if (!session?.user?.id) return
    setSaving(true)
    try {
      const saved = await persistSettings({ love_message: newMessage.trim() || DEFAULT_MESSAGE })
      setSettings(saved)
      setSettingsId(saved?.id || null)
      setNewMessage(saved?.love_message || DEFAULT_MESSAGE)
      setEditMessage(false)
    } catch (err) {
      console.warn('Ошибка сохранения:', err)
    } finally {
      setSaving(false)
    }
  }

  async function saveMeeting() {
    if (!session?.user?.id) return
    setSaving(true)
    try {
      // reset the reminder flag so the new meeting time will notify
      const saved = await persistSettings({ next_meeting: localToUTC(newMeeting), meeting_notified_at: null })
      setSettings(saved)
      setSettingsId(saved?.id || null)
      setNewMeeting(utcToLocal(saved?.next_meeting))
      setEditMeeting(false)
    } catch (err) {
      console.warn('Ошибка сохранения:', err)
    } finally {
      setSaving(false)
    }
  }

  /* ── Stable callbacks for memoized children ── */
  const openSettings     = useCallback(() => onNavigate?.('settings'), [onNavigate])
  const openMoments      = useCallback(() => onNavigate?.('moments'),  [onNavigate])
  const openChat         = useCallback(() => onNavigate?.('chat'),     [onNavigate])
  const openCalendar     = useCallback(() => onNavigate?.('calendar'), [onNavigate])
  const openPartnerModal = useCallback(() => setShowPartnerModal(true),  [])
  const closePartnerModal= useCallback(() => setShowPartnerModal(false), [])
  const startEditMeeting = useCallback(() => setEditMeeting(true),  [])
  const cancelEditMeeting= useCallback(() => setEditMeeting(false), [])
  const startEditMessage = useCallback(() => setEditMessage(true),  [])
  const cancelEditMessage= useCallback(() => setEditMessage(false), [])

  const partnerStatusText = relTime(partnerSeen)
  const partnerOnline = partnerStatusText === 'онлайн'
  const partnerMood = (partnerProfile?.mood && partnerProfile?.mood_at &&
    (Date.now() - new Date(partnerProfile.mood_at).getTime() < 86400000))
    ? partnerProfile.mood : null

  /* ── Client-side reminders: birthdays / anniversary / events (today & tomorrow) ── */
  const [remDismissed, setRemDismissed] = useState(false)
  const reminders = useMemo(() => {
    const md = d => { const x = new Date(d); return `${x.getMonth() + 1}-${x.getDate()}` }
    const now = new Date(), tom = new Date(Date.now() + 86400000)
    const tMD = `${now.getMonth() + 1}-${now.getDate()}`
    const nMD = `${tom.getMonth() + 1}-${tom.getDate()}`
    const whenOf = m => (m === tMD ? 'Сегодня' : m === nMD ? 'Завтра' : null)
    const out = []
    if (partnerProfile?.birthday) {
      const w = whenOf(md(partnerProfile.birthday))
      if (w) out.push({ icon: '🎂', text: `${w} день рождения у ${partnerName}` })
    }
    if (coupleStart) {
      const w = whenOf(`${coupleStart.getMonth() + 1}-${coupleStart.getDate()}`)
      if (w) {
        const years = (w === 'Завтра' ? tom : now).getFullYear() - coupleStart.getFullYear()
        out.push({ icon: '💍', text: years > 0 ? `${w}: ${years} ${yearsWord(years)} вместе` : `${w} — ваша годовщина` })
      }
    }
    if (nextEvent?.event_date) {
      const w = whenOf(md(nextEvent.event_date))
      if (w) out.push({ icon: nextEvent.emoji || '📅', text: `${w}: ${nextEvent.title}` })
    }
    return out
  }, [partnerProfile?.birthday, coupleStart, nextEvent, partnerName])

  // fire a local (foreground) system notification once per day
  useEffect(() => {
    if (!reminders.length) return
    const key = `home_reminded_${new Date().toISOString().slice(0, 10)}`
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && navigator.serviceWorker) {
      navigator.serviceWorker.ready.then(reg => {
        reminders.forEach(r => reg.showNotification('Love App 💕', { body: `${r.icon} ${r.text}`, icon: '/apple-touch-icon.png', tag: `rem-${r.text}` }))
      }).catch(() => {})
    }
  }, [reminders])

  return (
    <div className="home-screen">
      <HeartsBackground />
      <div className="home-bg-blob home-bg-blob-1" />
      <div className="home-bg-blob home-bg-blob-2" />

      <div className="home-shell">
        {reminders.length > 0 && !remDismissed && (
          <div className="rem-banner">
            <button type="button" className="rem-close" onClick={() => setRemDismissed(true)} aria-label="Скрыть">×</button>
            <div className="rem-head">Не забудь ✨</div>
            {reminders.map((r, i) => (
              <div className="rem-row" key={i}>
                <span className="rem-ic">{r.icon}</span>
                <span className="rem-text">{r.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Hero card ── */}
        <section className="hero-card">
          <div className="hero-top">
            <span />
            <button type="button" className="hero-button" onClick={openSettings}>
              Настройки
            </button>
          </div>

          <div className="hero-content">
            <div className="hero-avatars">
              <AvatarMedallion
                src={profile?.avatar_url}
                name={myName}
                onClick={openSettings}
              />
              {hasPartner && (
                <>
                  <div className="hero-link" />
                  {partnerLoading ? (
                    <AvatarMedallion name="…" ghost />
                  ) : (
                    <AvatarMedallion
                      src={partnerProfile?.avatar_url}
                      name={partnerName}
                      onClick={openPartnerModal}
                    />
                  )}
                </>
              )}
            </div>

            {hasPartner && (
              <div className="hero-status">
                <div className="hero-status-line">
                  {partnerStatusText && (
                    <span className="status-chip">
                      <span className={`status-dot${partnerOnline ? ' online' : ''}`} />
                      {partnerName}: {partnerStatusText}
                    </span>
                  )}
                  {partnerMood && (
                    <span className="status-chip">{partnerMood} настроение</span>
                  )}
                  {streak > 1 && (
                    <span className="status-chip">🔥 {streak} дн подряд</span>
                  )}
                </div>
                <div className="mood-row">
                  <span className="mood-row-label">Как ты?</span>
                  {STATUS_MOODS.map(m => (
                    <button
                      key={m.e}
                      type="button"
                      className={`mood-pick${myMood === m.e ? ' active' : ''}`}
                      onClick={() => setMood(m.e)}
                      title={m.label}
                    >
                      {m.e}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="hero-title-wrap">
              <div className="hero-overline">Главная история</div>
              <h1 className="hero-title">{headline}</h1>
              {anniversaryYears > 0 && (
                <div className="hero-anniversary">
                  🎉 С годовщиной! {anniversaryYears} {yearsWord(anniversaryYears)} вместе
                </div>
              )}
            </div>

            <HeroCounter
              coupleStart={coupleStart}
              anniversary={anniversary}
              hasPartner={hasPartner}
              hasStartDate={hasStartDate}
              onNavigate={onNavigate}
            />

            {hasPartner && (
              <button
                type="button"
                className={`thinking-btn${thinkingSent ? ' sent' : ''}`}
                onClick={sendThinking}
                disabled={thinkingSent}
              >
                <span className="thinking-btn-heart">♥</span>
                {thinkingSent ? 'Отправлено' : 'Думаю о тебе'}
              </button>
            )}
          </div>
        </section>

        {/* ── Наша история (cinematic recap) ── */}
        {hasPartner && (
          <button type="button" className="story-card" onClick={() => setShowStory(true)}>
            <span className="story-card-shine" />
            <span className="story-card-spark">✨</span>
            <span className="story-card-text">
              <span className="story-card-title">Наша история</span>
              <span className="story-card-sub">Кино про вас двоих — нажми ▸</span>
            </span>
            <span className="story-card-play">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><polygon points="6 4 20 12 6 20 6 4"/></svg>
            </span>
          </button>
        )}

        {/* ── Quick actions ── */}
        <div className="quick-grid">
          <QuickAction
            badge="Раздел"
            title="Моменты"
            subtitle="Ваши общие кадры и воспоминания."
            icon={CAMERA_ICON}
            onClick={openMoments}
            delay={0.08}
          />
          <QuickAction
            badge="Быстрый переход"
            title="Чат"
            subtitle="Открыть ваш диалог прямо сейчас."
            icon={CHAT_ICON}
            onClick={openChat}
            delay={0.14}
          />
        </div>

        {/* ── Info row ── */}
        <div className="section-row">
          <InfoCard eyebrow="Скоро" title="Ближайшее событие" delay={0.26}>
            {nextEvent ? (
              <div className="event-row">
                <div className="event-line">
                  <div className="event-emoji">{nextEvent.emoji || '•'}</div>
                  <div className="event-copy">
                    <div className="event-name">{nextEvent.title}</div>
                    <div className="event-date">
                      {formatDate(nextEvent.event_date, { day: 'numeric', month: 'long' })}
                    </div>
                  </div>
                  <div className="event-days">
                    {Math.max(0, Math.ceil(
                      (new Date(nextEvent.event_date) - new Date()) / 86400000
                    ))} дн
                  </div>
                </div>
                <button type="button" className="btn-ghost" onClick={openCalendar}>
                  Открыть календарь
                </button>
              </div>
            ) : (
              <div className="event-row">
                <p className="note-text">
                  Добавьте событие: встречу, поездку, ужин или особую дату.
                </p>
                <button type="button" className="btn-primary" onClick={openCalendar}>
                  Создать событие
                </button>
              </div>
            )}
          </InfoCard>

          <InfoCard eyebrow="Отсчёт" title="До встречи" delay={0.32} compact>
            {editMeeting ? (
              <>
                <input
                  className="field"
                  type="datetime-local"
                  value={newMeeting}
                  onChange={e => setNewMeeting(e.target.value)}
                />
                <div className="actions-row">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={saveMeeting}
                    disabled={saving}
                  >
                    {saving ? 'Сохраняю…' : 'Сохранить'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={cancelEditMeeting}>
                    Отмена
                  </button>
                </div>
              </>
            ) : (
              <MeetingBody
                nextMeeting={settings?.next_meeting}
                onEdit={startEditMeeting}
              />
            )}
          </InfoCard>
        </div>

        {/* ── Love message card ── */}
        <InfoCard eyebrow="Личное" title="Ваше сообщение" delay={0.38}>
          {editMessage ? (
            <>
              <textarea
                className="field"
                rows={4}
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Напишите фразу, ради которой хочется возвращаться на главный экран"
              />
              <div className="actions-row">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={saveMessage}
                  disabled={saving}
                >
                  {saving ? 'Сохраняю…' : 'Сохранить'}
                </button>
                <button type="button" className="btn-ghost" onClick={cancelEditMessage}>
                  Отмена
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="note-text">
                <strong>&laquo;{loveMessage}&raquo;</strong>
              </p>
              <div className="actions-row">
                <button type="button" className="btn-ghost" onClick={startEditMessage}>
                  Редактировать
                </button>
              </div>
            </>
          )}
        </InfoCard>
      </div>

      {showPartnerModal && (
        <PartnerModal
          profile={partnerProfile}
          loading={partnerLoading}
          onClose={closePartnerModal}
        />
      )}

      {showWave && <HeartWave />}
      {showConfetti && <Confetti />}
      {showStory && (
        <LoveStory
          session={session}
          profile={profile}
          partnerName={partnerName}
          coupleStart={coupleStart}
          onClose={() => setShowStory(false)}
        />
      )}
    </div>
  )
}
