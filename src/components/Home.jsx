import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'

// COUPLE_START теперь берётся из profile.couple_start_date (динамически)

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
function getRelTime(start) {
  const now  = new Date()
  const diff = now - start
  const totalDays = Math.floor(diff / 86400000)
  return {
    totalDays,
    years:   Math.floor(totalDays / 365),
    months:  Math.floor((totalDays % 365) / 30),
    days:    totalDays % 30,
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000)  / 60000),
    seconds: Math.floor((diff % 60000)    / 1000),
  }
}

function getAnniv(start) {
  const now  = new Date()
  let next   = new Date(start)
  next.setFullYear(now.getFullYear())
  if (next <= now) next.setFullYear(now.getFullYear() + 1)
  const daysUntil  = Math.ceil((next - now) / 86400000)
  const daysPassed = Math.floor((now - start) / 86400000)
  const progress   = Math.min(((daysPassed % 365) / 365) * 100, 100)
  return { daysUntil, progress }
}

function getTimeUntil(target) {
  if (!target) return null
  const diff = new Date(target) - new Date()
  if (diff <= 0) return null
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000)  / 60000),
    seconds: Math.floor((diff % 60000)    / 1000),
  }
}

function localToUTC(s) { return s ? new Date(s).toISOString() : null }
function utcToLocal(s) {
  if (!s) return ''
  const d = new Date(s)
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const pad = n => String(n).padStart(2, '0')

/* ─────────────────────────────────────────
   Typewriter hook
───────────────────────────────────────── */
function useTypewriter(text, speed = 55) {
  const [out, setOut]   = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!text) return
    setOut(''); setDone(false)
    let i = 0
    const id = setInterval(() => {
      setOut(text.slice(0, ++i))
      if (i >= text.length) { clearInterval(id); setDone(true) }
    }, speed)
    return () => clearInterval(id)
  }, [text, speed])
  return { out, done }
}

/* FloatingLayer removed — replaced with clean premium background */

/* FloatingHearts removed */

/* ─────────────────────────────────────────
   Minimal heart divider between avatars
───────────────────────────────────────── */
function CentreHeart() {
  return (
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden>
        <path
          d="M10 16.5C10 16.5 1.5 10.5 1.5 5C1.5 2.5 3.6 0.5 6 0.5C7.5 0.5 8.8 1.3 10 2.8C11.2 1.3 12.5 0.5 14 0.5C16.4 0.5 18.5 2.5 18.5 5C18.5 10.5 10 16.5 10 16.5Z"
          fill="rgba(168,40,60,0.55)"
        />
      </svg>
    </div>
  )
}

/* ─────────────────────────────────────────
   Anniversary progress bar — minimal line
───────────────────────────────────────── */
function HeartProgress({ progress, daysUntil }) {
  return (
    <div style={{ width: '100%', maxWidth: 220, margin: '18px auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ width: '100%', height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'rgba(255,255,255,0.5)',
          borderRadius: 99,
          transition: 'width 1.2s ease',
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 11,
        fontWeight: 300,
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: 0.4,
      }}>
        {daysUntil === 0 ? 'Сегодня годовщина' : `до годовщины ${daysUntil} дн`}
      </span>
    </div>
  )
}

/* ParticleField removed */

/* ─────────────────────────────────────────
   Clean divider between avatars
───────────────────────────────────────── */
function BinaryConnection() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 60, gap: 6 }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
      <CentreHeart />
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
    </div>
  )
}

/* ─────────────────────────────────────────
   Orbital ring — clean, no glow
───────────────────────────────────────── */
function OrbitalRing({ progress, children }) {
  const r = 118
  const circ = 2 * Math.PI * r
  const filled = circ * (progress / 100)
  const angle = -Math.PI / 2 + (progress / 100) * 2 * Math.PI
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 260 260" width="260" height="260"
        style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
        <circle cx="130" cy="130" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
        <circle cx="130" cy="130" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" transform="rotate(-90 130 130)"
          style={{ transition: 'stroke-dasharray 2s ease' }}/>
        <circle
          cx={130 + r * Math.cos(angle)}
          cy={130 + r * Math.sin(angle)}
          r="3.5" fill="rgba(255,255,255,0.7)" />
      </svg>
      {children}
    </div>
  )
}

/* ─────────────────────────────────────────
   Counter digit — clean, no glow
───────────────────────────────────────── */
function GlowDigit({ value, prevValue }) {
  const changed = value !== prevValue
  return (
    <span
      key={value}
      className="glow-digit"
      style={{ animationName: changed ? 'digitFlip' : 'none' }}
    >
      {value}
    </span>
  )
}

/* ─────────────────────────────────────────
   Zodiac sign from birthday date
───────────────────────────────────────── */
function getZodiac(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const m = d.getMonth() + 1
  const day = d.getDate()
  if ((m === 3 && day >= 21) || (m === 4 && day <= 19)) return 'Овен'
  if ((m === 4 && day >= 20) || (m === 5 && day <= 20)) return 'Телец'
  if ((m === 5 && day >= 21) || (m === 6 && day <= 20)) return 'Близнецы'
  if ((m === 6 && day >= 21) || (m === 7 && day <= 22)) return 'Рак'
  if ((m === 7 && day >= 23) || (m === 8 && day <= 22)) return 'Лев'
  if ((m === 8 && day >= 23) || (m === 9 && day <= 22)) return 'Дева'
  if ((m === 9 && day >= 23) || (m === 10 && day <= 22)) return 'Весы'
  if ((m === 10 && day >= 23) || (m === 11 && day <= 21)) return 'Скорпион'
  if ((m === 11 && day >= 22) || (m === 12 && day <= 21)) return 'Стрелец'
  if ((m === 12 && day >= 22) || (m === 1 && day <= 19)) return 'Козерог'
  if ((m === 1 && day >= 20) || (m === 2 && day <= 18)) return 'Водолей'
  return 'Рыбы'
}

function formatBirthday(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

/* ─────────────────────────────────────────
   Avatar ring — clickable, CSS animated gradient
───────────────────────────────────────── */
function AvatarRing({ src, name, birthday, onClick }) {
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, cursor: 'pointer' }}
      onClick={onClick}
    >
      {/* outer spinning gradient ring */}
      <div className="av-ring" style={{ transition: 'opacity 0.15s, transform 0.15s' }}
        onTouchStart={e => e.currentTarget.style.opacity = '0.75'}
        onTouchEnd={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = '' }}
      >
        <div className="av-gap">
          <div className="av-inner">
            {src
              ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                  onError={e => { e.currentTarget.style.display='none' }} />
              : <div className="av-initials-wrap">
                  <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
                    <circle cx="20" cy="16" r="8" fill="rgba(139,26,44,0.7)"/>
                    <path d="M4 38c0-8.8 7.2-16 16-16s16 7.2 16 16" fill="rgba(139,26,44,0.5)"/>
                  </svg>
                </div>
            }
          </div>
        </div>
      </div>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 11,
        fontWeight: 400,
        color: 'rgba(255,255,255,0.8)',
        letterSpacing: 0.3,
      }}>
        {name}
      </span>
      {birthday && (
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize: 10,
          fontWeight: 300,
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: 0.2,
          marginTop: -3,
        }}>
          {formatBirthday(birthday)}
        </span>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────
   Partner card modal
───────────────────────────────────────── */
function PartnerCard({ profile, onClose }) {
  if (!profile) return null
  const birthday = formatBirthday(profile.birthday)
  const zodiac   = getZodiac(profile.birthday)
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1A1714',
          borderRadius: 20,
          padding: '32px 24px 28px',
          maxWidth: 300, width: '100%',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          border: '0.5px solid rgba(255,255,255,0.08)',
          textAlign: 'center',
          position: 'relative',
          animation: 'slideUp 0.28s ease both',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14,
            background: 'rgba(255,255,255,0.1)', border: 'none',
            borderRadius: '50%', width: 36, height: 36,
            color: 'white', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Avatar */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%', margin: '0 auto 16px',
          border: '1px solid rgba(255,255,255,0.12)',
          overflow: 'hidden', background: '#2A2420',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.currentTarget.style.display='none' }} />
            : <svg viewBox="0 0 40 40" width="44" height="44" fill="none">
                <circle cx="20" cy="16" r="8" fill="rgba(139,26,44,0.7)"/>
                <path d="M4 38c0-8.8 7.2-16 16-16s16 7.2 16 16" fill="rgba(139,26,44,0.5)"/>
              </svg>
          }
        </div>

        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 300, fontStyle: 'italic', color: 'rgba(237,233,226,0.9)', marginBottom: 4 }}>
          {profile.name || 'Партнёр'}
        </div>

        {birthday && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'rgba(255,255,255,0.65)', marginBottom: 16 }}>
            {birthday}
          </div>
        )}

        {zodiac && (
          <div style={{
            display: 'inline-block',
            background: 'rgba(168,40,60,0.1)',
            border: '0.5px solid rgba(168,40,60,0.25)',
            borderRadius: 20,
            padding: '5px 16px',
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            fontWeight: 400,
            color: 'rgba(207,85,104,0.9)',
            letterSpacing: 0.3,
          }}>
            {zodiac}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   Ripple + mouse-glow helpers
───────────────────────────────────────── */
function addRipple(e) {
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()
  const rip = document.createElement('div')
  rip.className = 'ripple-el'
  rip.style.left = (e.clientX - rect.left) + 'px'
  rip.style.top = (e.clientY - rect.top) + 'px'
  el.appendChild(rip)
  setTimeout(() => rip.remove(), 700)
}

function mouseGlow(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width * 100) + '%')
  e.currentTarget.style.setProperty('--my', ((e.clientY - rect.top) / rect.height * 100) + '%')
}

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
export default function Home({ session, profile, onNavigate }) {
  const hasPartner = !!profile?.partner_id
  const hasStartDate = !!profile?.couple_start_date
  const coupleStart = useMemo(() =>
    profile?.couple_start_date
      ? new Date(profile.couple_start_date + 'T00:00:00')
      : null
  , [profile?.couple_start_date])
  const [time,           setTime]           = useState(() => coupleStart ? getRelTime(coupleStart) : null)
  const [_prevTime,      setPrevTime]       = useState(null)
  const [settings,       setSettings]       = useState(null)
  const [nextEvent,      setNextEvent]      = useState(null)
  const [countdown,      setCountdown]      = useState(null)
  const [partnerProfile, setPartnerProfile] = useState(null)
  const [editMsg,        setEditMsg]        = useState(false)
  const [editMeet,       setEditMeet]       = useState(false)
  const [newMsg,         setNewMsg]         = useState('')
  const [newMeet,        setNewMeet]        = useState('')
  const [saving,         setSaving]         = useState(false)
  const [showPartnerCard, setShowPartnerCard] = useState(false)

  const loveMsg   = settings?.love_message || 'Ты — лучшее, что случилось в моей жизни'
  const { out, done } = useTypewriter(loveMsg, 55)

  /* Live counter — every second (only when couple_start_date exists) */
  useEffect(() => {
    if (!coupleStart) { setTime(null); return }
    const id = setInterval(() => {
      setPrevTime(t => t)
      setTime(getRelTime(coupleStart))
    }, 1000)
    return () => clearInterval(id)
  }, [coupleStart])

  /* Meeting countdown */
  useEffect(() => {
    if (!settings?.next_meeting) { setCountdown(null); return }
    const tick = () => setCountdown(getTimeUntil(settings.next_meeting))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [settings?.next_meeting])

  /* Load data */
  const loadData = useCallback(async () => {
    if (!session?.user?.id) return
    const pid = profile?.partner_id

    if (pid) {
      const { data } = await supabase.from('profiles')
        .select('id,name,avatar_url,birthday,public_key')
        .eq('id', pid).single()
      setPartnerProfile(data)
    }

    const uids = [session.user.id, pid].filter(Boolean)
    const { data: all } = await supabase.from('couple_settings')
      .select('user_id,love_message,next_meeting,updated_at,created_at')
      .in('user_id', uids)
    if (all?.length) {
      const my = all.find(s => s.user_id === session.user.id)
      const pt = all.find(s => s.user_id === pid)
      let lm = null, la = null
      for (const s of all) {
        if (s.next_meeting) {
          const at = new Date(s.updated_at || s.created_at || 0)
          if (!la || at > la) { lm = s.next_meeting; la = at }
        }
      }
      const merged = { love_message: my?.love_message || pt?.love_message || '', next_meeting: lm }
      setSettings(merged)
      setNewMsg(merged.love_message)
      setNewMeet(utcToLocal(merged.next_meeting))
    }

    const today = new Date().toISOString().slice(0, 10)
    const evsQ = supabase.from('calendar_events')
      .select('id,title,emoji,event_date,photo_url').gte('event_date', today)
      .order('event_date', { ascending: true }).limit(1)
    const { data: evs } = uids.length === 1
      ? await evsQ.eq('user_id', uids[0])
      : await evsQ.in('user_id', uids)
    if (evs?.length) setNextEvent(evs[0])
  }, [session?.user?.id, profile?.partner_id])

  useEffect(() => { loadData() }, [loadData])

  async function saveMsg() {
    setSaving(true)
    const { data: ex } = await supabase.from('couple_settings').select('id').eq('user_id', session.user.id).maybeSingle()
    if (ex) await supabase.from('couple_settings').update({ love_message: newMsg, updated_at: new Date().toISOString() }).eq('id', ex.id)
    else await supabase.from('couple_settings').insert({ user_id: session.user.id, love_message: newMsg })
    setSettings(p => ({ ...p, love_message: newMsg }))
    setEditMsg(false)
    setSaving(false)
  }

  async function saveMeet() {
    setSaving(true)
    const utc = localToUTC(newMeet)
    const now = new Date().toISOString()
    const { data: myEx } = await supabase.from('couple_settings').select('id').eq('user_id', session.user.id).maybeSingle()
    if (myEx) await supabase.from('couple_settings').update({ next_meeting: utc, updated_at: now }).eq('id', myEx.id)
    else await supabase.from('couple_settings').insert({ user_id: session.user.id, next_meeting: utc })
    if (profile?.partner_id) {
      const { data: pEx } = await supabase.from('couple_settings').select('id').eq('user_id', profile.partner_id).maybeSingle()
      if (pEx) await supabase.from('couple_settings').update({ next_meeting: utc, updated_at: now }).eq('id', pEx.id)
      else await supabase.from('couple_settings').insert({ user_id: profile.partner_id, next_meeting: utc })
    }
    setSettings(p => ({ ...p, next_meeting: utc }))
    setEditMeet(false)
    setSaving(false)
  }

  const anniv  = coupleStart ? getAnniv(coupleStart) : { daysUntil: 0, progress: 0 }
  const myName = profile?.name || ''
  const pName  = partnerProfile?.name || ''

  return (
    <>
      <style>{`
        /* ── Avatar rings ── */
        .av-ring {
          width: 76px; height: 76px;
          border-radius: 50%;
          padding: 1.5px;
          background: rgba(255,255,255,0.2);
        }
        .av-gap {
          width: 100%; height: 100%;
          border-radius: 50%;
          padding: 2px;
          background: rgba(255,255,255,0.08);
        }
        .av-inner {
          width: 100%; height: 100%;
          border-radius: 50%;
          background: #2A2420;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .av-initials {
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 400;
          color: rgba(255,255,255,0.6);
          line-height: 1;
        }

        /* ── Counter digits ── */
        .glow-digit {
          display: inline-block;
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-weight: 300;
          animation: digitFlip 0.28s ease both;
        }
        @keyframes digitFlip {
          from { opacity: 0.4; transform: scaleY(0.7) translateY(-4px); }
          to   { opacity: 1;   transform: scaleY(1)   translateY(0); }
        }

        /* ── Home layout ── */
        .home-wrap {
          min-height: 100%;
          padding: 0 0 130px;
          position: relative;
          overflow: hidden;
        }

        /* ── Hero banner ── */
        .home-banner {
          background: linear-gradient(170deg, #0C0B09 0%, #16120D 40%, #1E1610 100%);
          border-radius: 0 0 28px 28px;
          padding: 52px 20px 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          z-index: 1;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          overflow: hidden;
        }
        .home-banner::after {
          content: '';
          position: absolute; inset: 0;
          border-radius: inherit;
          background: radial-gradient(ellipse at 50% 0%, rgba(168,40,60,0.12) 0%, transparent 55%);
          pointer-events: none;
        }

        /* ── Avatar row ── */
        .av-row { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }

        /* ── Day counter ── */
        .day-counter { text-align: center; color: white; }
        .day-number {
          font-family: var(--font-display);
          font-size: clamp(56px, 15vw, 80px);
          font-weight: 300;
          line-height: 1;
          letter-spacing: -2px;
          animation: countIn 0.5s ease both;
        }
        @keyframes countIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .day-label {
          font-size: 17px;
          font-weight: 600;
          opacity: 0.82;
          margin-top: 2px;
          font-family: var(--font-body);
        }
        .day-breakdown {
          display: flex;
          gap: 14px;
          justify-content: center;
          margin-top: 12px;
        }
        .day-unit { display: flex; flex-direction: column; align-items: center; }
        .day-unit-val {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 400;
          color: rgba(255,255,255,0.85);
        }
        .day-unit-lbl {
          font-family: var(--font-body);
          font-size: 10px;
          opacity: 0.6;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: white;
        }

        /* Live clock bar */
        .live-clock-bar {
          margin-top: 14px;
          display: flex;
          gap: 1px;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.04);
          border: 0.5px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 8px 20px;
          letter-spacing: 3px;
          font-size: 18px;
          color: rgba(255,255,255,0.7);
          font-weight: 300;
        }
        .clock-sep {
          opacity: 0.5;
          animation: sepBlink 1s step-end infinite;
          margin: 0 1px;
        }
        @keyframes sepBlink { 0%,100%{opacity:0.5} 50%{opacity:0.1} }

        /* ── Content below banner ── */
        .home-content {
          padding: 0 15px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-top: 20px;
          position: relative;
          z-index: 1;
        }

        /* ── Cards ── */
        .hc {
          background: var(--surface, #ffffff);
          border-radius: 18px;
          border: 0.5px solid var(--border, rgba(0,0,0,0.07));
          padding: 20px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          animation: slideUp 0.4s ease both;
          position: relative; overflow: hidden;
        }
        .app.dark .hc {
          background: #151412;
          border-color: rgba(255,255,255,0.05);
          box-shadow: 0 4px 24px rgba(0,0,0,0.4);
        }
        .ripple-el {
          position: absolute; border-radius: 50%;
          width: 60px; height: 60px; margin-left: -30px; margin-top: -30px;
          background: rgba(168,40,60,0.12);
          transform: scale(0); animation: ripple 0.6s ease-out forwards;
          pointer-events: none; z-index: 1;
        }
        .hc-title {
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-muted);
          margin-bottom: 14px;
        }

        /* ── Love message ── */
        .love-card {
          background: linear-gradient(150deg, #1A0E0A 0%, #241410 100%);
          border-radius: 18px;
          border: 0.5px solid rgba(168,40,60,0.2);
          padding: 20px;
          color: white;
          position: relative;
          box-shadow: 0 4px 20px rgba(0,0,0,0.25);
          animation: slideUp 0.4s ease both;
        }
        .love-text {
          font-family: var(--font-display);
          font-style: italic;
          font-size: clamp(15px, 4vw, 18px);
          line-height: 1.6;
          min-height: 48px;
          position: relative;
          z-index: 1;
        }
        .cursor {
          display: inline-block;
          width: 2px; height: 1em;
          background: rgba(255,255,255,0.8);
          margin-left: 3px;
          vertical-align: text-bottom;
          animation: curBlink 0.9s step-end infinite;
        }
        @keyframes curBlink { 0%,100%{opacity:1} 50%{opacity:0} }

        /* edit button — SVG pencil */
        .love-edit-btn {
          position: absolute;
          top: 14px; right: 14px;
          background: rgba(255,255,255,0.18);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 50%;
          width: 34px; height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: white;
          transition: background 0.15s;
          z-index: 2;
        }
        .love-edit-btn:active { background: rgba(255,255,255,0.32); }

        .love-textarea {
          width: 100%;
          background: rgba(255,255,255,0.14);
          border: 1.5px solid rgba(255,255,255,0.35);
          border-radius: 14px;
          color: white;
          font-family: var(--font-body);
          font-size: 15px;
          padding: 10px 12px;
          resize: none;
          min-height: 88px;
          outline: none;
        }
        .love-textarea::placeholder { color: rgba(255,255,255,0.45); }

        /* ── Action grid ── */
        .action-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .action-btn {
          background: var(--surface, #fff);
          border: 0.5px solid var(--border, rgba(0,0,0,0.07));
          border-radius: 16px;
          padding: 18px 12px 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          transition: opacity 0.15s, transform 0.15s;
        }
        .action-btn:active { opacity: 0.7; transform: scale(0.96); }
        .action-btn-icon {
          width: 44px; height: 44px;
          border-radius: 14px;
          background: rgba(168,40,60,0.07);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--rose, #A8283C);
        }
        .action-btn-label {
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 400;
          color: var(--text);
          text-align: center;
          line-height: 1.4;
        }
        .app.dark .action-btn { background: #1A1916; border-color: rgba(255,255,255,0.05); }
        .app.dark .action-btn-label { color: var(--ink); }
        .app.dark .action-btn-icon { background: rgba(168,40,60,0.12); }

        /* ── Meeting countdown ── */
        .meet-values { display: flex; gap: 8px; justify-content: center; }
        .meet-unit {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: var(--blush, #F6F3EE);
          border: 0.5px solid var(--border);
          border-radius: 12px;
          padding: 12px 14px;
          min-width: 56px;
        }
        .app.dark .meet-unit { background: #1A1916; }
        .meet-num {
          font-family: var(--font-display);
          font-size: 26px;
          font-weight: 400;
          color: var(--rose, #A8283C);
          line-height: 1;
        }
        .app.dark .meet-num { color: var(--rose-light, #CF5568); }
        .meet-lbl {
          font-family: var(--font-body);
          font-size: 10px;
          color: var(--muted);
          letter-spacing: 0.4px;
          margin-top: 3px;
        }

        /* ── Next event ── */
        .event-row { display: flex; align-items: center; gap: 14px; }
        .event-emoji-block {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: rgba(168,40,60,0.07);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          flex-shrink: 0;
        }
        .event-info { flex: 1; min-width: 0; }
        .event-name {
          font-family: var(--font-body);
          font-weight: 500;
          font-size: 15px;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .app.dark .event-name { color: var(--ink); }
        .event-date { font-size: 12px; color: var(--text-muted); margin-top: 2px; font-weight: 300; }
        .event-badge {
          background: var(--rose, #A8283C);
          color: white;
          border-radius: 10px;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 500;
          font-family: var(--font-body);
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* ── Buttons ── */
        .btn-primary {
          background: var(--rose, #A8283C);
          color: white;
          border: none;
          border-radius: 11px;
          padding: 11px 22px;
          font-family: var(--font-body);
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.12s;
        }
        .btn-primary:active { opacity: 0.85; transform: scale(0.97); }
        .btn-ghost {
          background: rgba(0,0,0,0.05);
          border: none;
          border-radius: 11px;
          padding: 11px 18px;
          font-family: var(--font-body);
          font-weight: 400;
          font-size: 14px;
          color: var(--text-muted);
          cursor: pointer;
        }
        .app.dark .btn-ghost { background: rgba(255,255,255,0.07); }
        .btn-outline-sm {
          background: transparent;
          border: 0.5px solid rgba(168,40,60,0.3);
          color: var(--rose, #A8283C);
          border-radius: 10px;
          padding: 7px 16px;
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 400;
          cursor: pointer;
          margin-top: 10px;
          transition: background 0.15s;
        }
        .btn-outline-sm:active { background: rgba(168,40,60,0.06); }
        .app.dark .btn-outline-sm { border-color: rgba(207,85,104,0.3); color: var(--rose-light, #CF5568); }

        /* date input override */
        input[type='datetime-local'] {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid rgba(200,51,74,0.18);
          border-radius: 13px;
          font-family: var(--font-body);
          font-size: 14px;
          background: var(--bg);
          color: var(--text);
          margin-bottom: 12px;
          outline: none;
        }
        input[type='datetime-local']:focus { border-color: var(--rose, #C8334A); }
        .app.dark input[type='datetime-local'] { background: #3A3050; border-color: #3A3050; color: var(--ink, #F5E8EA); }
      `}</style>

      <div className="home-wrap">
        {/* ════════ HERO BANNER ════════ */}
        <div className="home-banner">

          {/* Avatar row: single avatar if no partner, pair if connected */}
          {hasPartner ? (
            <div className="av-row">
              <AvatarRing
                src={profile?.avatar_url}
                name={myName}
                birthday={profile?.birthday}
                onClick={() => onNavigate?.('settings')}
              />
              <BinaryConnection />
              <AvatarRing
                src={partnerProfile?.avatar_url}
                name={pName}
                birthday={partnerProfile?.birthday}
                onClick={() => setShowPartnerCard(true)}
              />
            </div>
          ) : (
            <div className="av-row" style={{ justifyContent: 'center' }}>
              <AvatarRing
                src={profile?.avatar_url}
                name={myName}
                birthday={profile?.birthday}
                onClick={() => onNavigate?.('settings')}
              />
            </div>
          )}

          {showPartnerCard && hasPartner && (
            <PartnerCard profile={partnerProfile} onClose={() => setShowPartnerCard(false)} />
          )}

          {/* Day counter — only when couple_start_date is set */}
          {time && hasStartDate ? (
            <OrbitalRing progress={anniv.progress}>
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '0.5px solid rgba(255,255,255,0.08)',
              borderRadius: 28,
              padding: '24px 40px 18px',
            }}>
            <div className="day-counter">
              <div className="day-number">
                {String(time.totalDays).split('').map((d, i) => (
                  <GlowDigit key={`${i}-${d}`} value={d} />
                ))}
              </div>
              <div className="day-label">
                {time.totalDays === 1 ? 'день' : time.totalDays < 5 ? 'дня' : 'дней'} вместе
              </div>

              {/* Breakdown */}
              <div className="day-breakdown">
                {time.years > 0 && (
                  <div className="day-unit">
                    <span className="day-unit-val">{time.years}</span>
                    <span className="day-unit-lbl">лет</span>
                  </div>
                )}
                <div className="day-unit">
                  <span className="day-unit-val">{time.months}</span>
                  <span className="day-unit-lbl">мес</span>
                </div>
                <div className="day-unit">
                  <span className="day-unit-val">{time.days}</span>
                  <span className="day-unit-lbl">дн</span>
                </div>
              </div>

              {/* Live clock */}
              <div className="live-clock-bar">
                <GlowDigit value={pad(time.hours)}   />
                <span className="clock-sep">:</span>
                <GlowDigit value={pad(time.minutes)} />
                <span className="clock-sep">:</span>
                <GlowDigit value={pad(time.seconds)} />
              </div>
            </div>
            </div>
            </OrbitalRing>
          ) : (
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(20px)',
              border: '0.5px solid rgba(255,255,255,0.08)',
              borderRadius: 20,
              padding: '24px 28px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.6)',
              marginTop: 8,
            }}>
              {!hasPartner ? (
                <>
                  <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 17, fontWeight: 400, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>
                    Партнёр не подключён
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 300, color: 'rgba(255,255,255,0.4)', marginBottom: 16, lineHeight: 1.5 }}>
                    Пригласите партнёра, чтобы начать
                  </div>
                  <button
                    onClick={() => onNavigate?.('settings')}
                    style={{
                      background: 'rgba(168,40,60,0.7)', border: '0.5px solid rgba(168,40,60,0.4)', borderRadius: 10,
                      padding: '9px 20px', color: 'white', fontSize: 13,
                      fontFamily: 'var(--font-body)', fontWeight: 400, cursor: 'pointer',
                    }}
                  >
                    Пригласить в настройках
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 17, fontWeight: 400, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>
                    Дата отношений не указана
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 300, color: 'rgba(255,255,255,0.4)', marginBottom: 16, lineHeight: 1.5 }}>
                    Укажите дату начала отношений в настройках
                  </div>
                  <button
                    onClick={() => onNavigate?.('settings')}
                    style={{
                      background: 'rgba(168,40,60,0.7)', border: '0.5px solid rgba(168,40,60,0.4)', borderRadius: 10,
                      padding: '9px 20px', color: 'white', fontSize: 13,
                      fontFamily: 'var(--font-body)', fontWeight: 400, cursor: 'pointer',
                    }}
                  >
                    Указать дату
                  </button>
                </>
              )}
            </div>
          )}

          {/* Heart progress bar — only when date is set */}
          {hasStartDate && <HeartProgress progress={anniv.progress} daysUntil={anniv.daysUntil} />}
        </div>

        {/* ════════ CONTENT ════════ */}
        <div className="home-content">

          {/* Love message */}
          <div className="love-card" style={{ animationDelay: '0s' }}>
            {editMsg ? (
              <div>
                <textarea
                  className="love-textarea"
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  placeholder="Напиши что-то прекрасное..."
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn-primary" onClick={saveMsg} disabled={saving}>
                    {saving ? '...' : 'Сохранить'}
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
                    onClick={() => setEditMsg(false)}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button className="love-edit-btn" onClick={() => setEditMsg(true)} aria-label="Редактировать">
                  {/* SVG pencil */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/>
                  </svg>
                </button>
                <p className="love-text">
                  «{out}»{!done && <span className="cursor" />}
                </p>
              </>
            )}
          </div>

          {/* Quick actions */}
          <div className="action-grid">
            {[
              { id: 'moments',  label: 'Наши\nмоменты',
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg> },
              { id: 'letter',   label: 'Написать\nписьмо',
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><rect x="2" y="5" width="20" height="14" rx="2"/><polyline points="2,5 12,13 22,5"/></svg> },
              { id: 'clock',    label: 'Часы\nлюбви',
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="22" height="22"><circle cx="12" cy="12" r="9"/><line x1="12" y1="12" x2="12" y2="7.5" strokeWidth="2"/><line x1="12" y1="12" x2="15.5" y2="14" strokeWidth="1.5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg> },
              { id: 'calendar', label: 'Наш\nкалендарь',
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
            ].map(a => (
              <button key={a.id} className="action-btn" onClick={() => onNavigate?.(a.id)}>
                <div className="action-btn-icon">{a.icon}</div>
                <span className="action-btn-label" style={{ whiteSpace: 'pre-line' }}>{a.label}</span>
              </button>
            ))}
          </div>

          {/* Next event */}
          {nextEvent && (
            <div className="hc" style={{ animationDelay: '0.1s' }} onMouseMove={mouseGlow} onClick={addRipple}>
              <div className="hc-title">Ближайшее событие</div>
              <div className="event-row">
                <div className="event-emoji-block">
                  {nextEvent.emoji
                    ? <span style={{ fontSize: 24 }}>{nextEvent.emoji}</span>
                    : <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--rose)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="17" rx="2"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                  }
                </div>
                <div className="event-info">
                  <div className="event-name">{nextEvent.title}</div>
                  <div className="event-date">
                    {new Date(nextEvent.event_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                  </div>
                </div>
                <div className="event-badge">
                  {Math.max(0, Math.ceil((new Date(nextEvent.event_date) - new Date()) / 86400000))} дн
                </div>
              </div>
            </div>
          )}

          {/* Meeting countdown */}
          <div className="hc" style={{ animationDelay: '0.18s' }} onMouseMove={mouseGlow} onClick={addRipple}>
            <div className="hc-title">До встречи</div>
            {editMeet ? (
              <div>
                <input type="datetime-local" value={newMeet} onChange={e => setNewMeet(e.target.value)} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" onClick={saveMeet} disabled={saving}>
                    {saving ? '...' : 'Сохранить'}
                  </button>
                  <button className="btn-ghost" onClick={() => setEditMeet(false)}>Отмена</button>
                </div>
              </div>
            ) : countdown ? (
              <>
                <div className="meet-values">
                  {[
                    [countdown.days,    'дн'],
                    [pad(countdown.hours),   'ч'],
                    [pad(countdown.minutes), 'мин'],
                    [pad(countdown.seconds), 'сек'],
                  ].map(([v, l]) => (
                    <div key={l} className="meet-unit">
                      <div className="meet-num">{v}</div>
                      <div className="meet-lbl">{l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <button className="btn-outline-sm" onClick={() => setEditMeet(true)}>Изменить</button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  {settings?.next_meeting ? 'Время встречи прошло' : 'Когда ваша следующая встреча?'}
                </p>
                <button className="btn-outline-sm" onClick={() => setEditMeet(true)}>Установить дату</button>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
