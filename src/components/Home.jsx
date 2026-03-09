import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const COUPLE_START = new Date('2025-10-17T00:00:00')

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

/* ─────────────────────────────────────────
   Background floating layer — NO emoji,
   all CSS/SVG shapes
───────────────────────────────────────── */

// 4-pointed sparkle star path
const SPARK = 'M10 0 L11.2 8.8 L20 10 L11.2 11.2 L10 20 L8.8 11.2 L0 10 L8.8 8.8 Z'

// Heart SVG path (20×18 viewBox)
const HEART_PATH = 'M10 16.5 C10 16.5 1.5 10.5 1.5 5 C1.5 2.5 3.6 0.5 6 0.5 C7.5 0.5 8.8 1.3 10 2.8 C11.2 1.3 12.5 0.5 14 0.5 C16.4 0.5 18.5 2.5 18.5 5 C18.5 10.5 10 16.5 10 16.5 Z'

// Static pre-computed positions so we never re-randomise on render
const FLOATERS = [
  // bokeh circles
  { id: 'b1', type: 'bokeh', x: 8,  y: 18, s: 28, o: 0.10, dur: 20, del: 0   },
  { id: 'b2', type: 'bokeh', x: 82, y: 40, s: 36, o: 0.08, dur: 26, del: 4   },
  { id: 'b3', type: 'bokeh', x: 45, y: 72, s: 22, o: 0.12, dur: 18, del: 8   },
  { id: 'b4', type: 'bokeh', x: 92, y: 12, s: 18, o: 0.09, dur: 22, del: 1   },
  { id: 'b5', type: 'bokeh', x: 28, y: 88, s: 30, o: 0.07, dur: 30, del: 12  },
  { id: 'b6', type: 'bokeh', x: 68, y: 65, s: 24, o: 0.10, dur: 24, del: 6   },
  // SVG hearts
  { id: 'h1', type: 'heart', x: 14, y: 28, s: 10, o: 0.18, dur: 14, del: 2   },
  { id: 'h2', type: 'heart', x: 88, y: 58, s: 8,  o: 0.15, dur: 20, del: 6   },
  { id: 'h3', type: 'heart', x: 55, y: 12, s: 12, o: 0.12, dur: 17, del: 9   },
  { id: 'h4', type: 'heart', x: 72, y: 82, s: 9,  o: 0.18, dur: 13, del: 3   },
  { id: 'h5', type: 'heart', x: 5,  y: 62, s: 7,  o: 0.22, dur: 22, del: 11  },
  { id: 'h6', type: 'heart', x: 38, y: 48, s: 11, o: 0.12, dur: 16, del: 5   },
  // 4-pointed sparkles
  { id: 's1', type: 'spark', x: 30, y: 8,  s: 8,  o: 0.28, dur: 7,  del: 1   },
  { id: 's2', type: 'spark', x: 64, y: 32, s: 6,  o: 0.22, dur: 9,  del: 4   },
  { id: 's3', type: 'spark', x: 90, y: 68, s: 7,  o: 0.18, dur: 8,  del: 7   },
  { id: 's4', type: 'spark', x: 48, y: 90, s: 5,  o: 0.30, dur: 10, del: 3   },
  { id: 's5', type: 'spark', x: 18, y: 50, s: 9,  o: 0.20, dur: 6,  del: 9   },
]

function FloatingLayer() {
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      <style>{`
        @keyframes floatBob {
          0%,100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-18px) scale(1.06); }
        }
        @keyframes sparkPulse {
          0%,100% { transform: scale(1) rotate(0deg); }
          50%      { transform: scale(1.4) rotate(45deg); }
        }
      `}</style>
      {FLOATERS.map(f => {
        const base = {
          position: 'absolute',
          left:  `${f.x}%`,
          top:   `${f.y}%`,
          opacity: f.o,
          animationName:           f.type === 'spark' ? 'sparkPulse' : 'floatBob',
          animationDuration:       `${f.dur}s`,
          animationDelay:          `${f.del}s`,
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
        }

        if (f.type === 'bokeh') return (
          <div key={f.id} style={{
            ...base,
            width:  f.s,
            height: f.s,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,107,138,0.9) 0%, transparent 70%)',
            filter: `blur(${f.s * 0.45}px)`,
          }} />
        )

        if (f.type === 'heart') return (
          <svg key={f.id} style={{ ...base, width: f.s, height: f.s * 0.9 }}
            viewBox="0 0 20 18" fill="rgba(232,70,106,0.7)">
            <path d={HEART_PATH} />
          </svg>
        )

        // sparkle
        return (
          <svg key={f.id} style={{ ...base, width: f.s, height: f.s }}
            viewBox="0 0 20 20" fill="rgba(255,200,220,0.9)">
            <path d={SPARK} />
          </svg>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────
   SVG gradient heart between avatars — bright, high-contrast
───────────────────────────────────────── */
function CentreHeart() {
  return (
    <div style={{
      width: 60, height: 56,
      filter: 'drop-shadow(0 0 18px rgba(255,45,85,0.95)) drop-shadow(0 0 6px rgba(255,255,255,0.4))',
      animation: 'heartbeatBig 1.4s cubic-bezier(0.37,0,0.63,1) infinite',
      flexShrink: 0,
    }}>
      <svg width="60" height="56" viewBox="0 0 60 56" fill="none" aria-hidden>
        <defs>
          <linearGradient id="hg" x1="0" y1="0" x2="60" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#FF6B8A" />
            <stop offset="50%"  stopColor="#FF2D55" />
            <stop offset="100%" stopColor="#D10043" />
          </linearGradient>
        </defs>
        {/* Bright solid fill heart */}
        <path
          d="M30 52 C30 52 3 35 3 16 C3 8 9.5 2 18 2 C22.5 2 26.5 4.5 30 9 C33.5 4.5 37.5 2 42 2 C50.5 2 57 8 57 16 C57 35 30 52 30 52 Z"
          fill="url(#hg)"
        />
        {/* White highlight for depth */}
        <path
          d="M16 9 C13 12 12 16 13 20"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <style>{`
          @keyframes heartbeatBig {
            0%,100% { transform: scale(1); }
            20%      { transform: scale(1.35); }
            40%      { transform: scale(1.05); }
            60%      { transform: scale(1.22); }
            80%      { transform: scale(1); }
          }
        `}</style>
      </svg>
    </div>
  )
}

/* ─────────────────────────────────────────
   SVG heart outline progress bar
   Draws around the heart stroke gradually
───────────────────────────────────────── */
function HeartProgress({ progress, daysUntil }) {
  // Heart outline path in a 100×90 viewBox
  const heartOutline = 'M50 82 C50 82 6 55 6 25 C6 12 15 4 26 4 C33 4 40 8 50 16 C60 8 67 4 74 4 C85 4 94 12 94 25 C94 55 50 82 50 82 Z'
  const pathLen = 230 // approximate path length for this shape
  const filled  = pathLen * (progress / 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 20 }}>
      <div style={{ position: 'relative', width: 110, height: 100 }}>
        <svg viewBox="0 0 100 90" width="110" height="99" overflow="visible">
          <defs>
            <linearGradient id="hpg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="rgba(255,255,255,0.25)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
            </linearGradient>
            <linearGradient id="hpf" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#fff8b0" />
              <stop offset="50%"  stopColor="#ffd6e0" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
          </defs>
          {/* background heart */}
          <path d={heartOutline} fill="url(#hpg)" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
          {/* animated progress stroke */}
          <path
            d={heartOutline}
            fill="none"
            stroke="url(#hpf)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${pathLen}`}
            style={{ transition: 'stroke-dasharray 1.2s ease', filter: 'drop-shadow(0 0 4px rgba(255,230,230,0.6))' }}
          />
        </svg>
        {/* percentage inside */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          paddingTop: 6,
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'white', lineHeight: 1 }}>
            {Math.round(progress)}%
          </span>
        </div>
      </div>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        color: 'rgba(255,255,255,0.65)',
        textAlign: 'center',
      }}>
        {daysUntil === 0 ? 'Сегодня годовщина!' : `до годовщины ${daysUntil} дн`}
      </span>
    </div>
  )
}

/* ─────────────────────────────────────────
   Glow digit — premium counter display
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
   Avatar ring — clickable, CSS animated gradient
───────────────────────────────────────── */
function AvatarRing({ src, name, initials, onClick }) {
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
              ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : <div className="av-initials-wrap">
                  <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
                    <circle cx="20" cy="16" r="8" fill="rgba(200,75,139,0.7)"/>
                    <path d="M4 38c0-8.8 7.2-16 16-16s16 7.2 16 16" fill="rgba(200,75,139,0.5)"/>
                  </svg>
                </div>
            }
          </div>
        </div>
      </div>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        fontWeight: 700,
        color: 'white',
        textShadow: '0 1px 4px rgba(0,0,0,0.5)',
      }}>
        {name}
      </span>
    </div>
  )
}

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
export default function Home({ session, profile, onNavigate }) {
  const [time,           setTime]           = useState(getRelTime(COUPLE_START))
  const [prevTime,       setPrevTime]       = useState(null)
  const [settings,       setSettings]       = useState(null)
  const [nextEvent,      setNextEvent]      = useState(null)
  const [countdown,      setCountdown]      = useState(null)
  const [partnerProfile, setPartnerProfile] = useState(null)
  const [editMsg,        setEditMsg]        = useState(false)
  const [editMeet,       setEditMeet]       = useState(false)
  const [newMsg,         setNewMsg]         = useState('')
  const [newMeet,        setNewMeet]        = useState('')
  const [saving,         setSaving]         = useState(false)

  const loveMsg   = settings?.love_message || 'Ты — лучшее, что случилось в моей жизни'
  const { out, done } = useTypewriter(loveMsg, 55)

  /* Live counter — every second */
  useEffect(() => {
    const id = setInterval(() => {
      setPrevTime(t => t)
      setTime(getRelTime(COUPLE_START))
    }, 1000)
    return () => clearInterval(id)
  }, [])

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
      const { data } = await supabase.from('profiles').select('*').eq('id', pid).single()
      setPartnerProfile(data)
    }

    const uids = [session.user.id, pid].filter(Boolean)
    const { data: all } = await supabase.from('couple_settings').select('*').in('user_id', uids)
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
    const { data: evs } = await supabase.from('calendar_events')
      .select('*').gte('event_date', today)
      .order('event_date', { ascending: true }).limit(1)
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

  const anniv  = getAnniv(COUPLE_START)
  const myName = profile?.name || 'Антон'
  const pName  = partnerProfile?.name || 'Эльвира'

  return (
    <>
      <style>{`
        /* ── Avatar rings ── */
        @property --ring-a {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        .av-ring {
          width: 84px; height: 84px;
          border-radius: 50%;
          padding: 2.5px;
          background: conic-gradient(from var(--ring-a),
            #ff6b8a, #c84b8b, #9b4dca, #4a8fe7, #ff6b8a);
          animation: ringRotate 4s linear infinite;
        }
        @keyframes ringRotate { to { --ring-a: 360deg; } }

        /* Fallback for browsers without @property */
        @supports not (background: conic-gradient(from 0deg, red, blue)) {
          .av-ring {
            background: linear-gradient(135deg, #ff6b8a, #c84b8b, #9b4dca, #4a8fe7);
            background-size: 300% 300%;
            animation: gradShift 4s ease infinite;
          }
        }
        @keyframes gradShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .av-gap {
          width: 100%; height: 100%;
          border-radius: 50%;
          padding: 2px;
          background: linear-gradient(160deg, #e8466a 0%, #9b4dca 100%);
        }
        .av-inner {
          width: 100%; height: 100%;
          border-radius: 50%;
          background: #ffe8f0;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .av-initials {
          font-family: var(--font-display);
          font-size: 26px;
          font-weight: 600;
          color: #c84b8b;
          line-height: 1;
          /* SVG-style person silhouette as text fallback */
        }

        /* ── Glow digits ── */
        .glow-digit {
          display: inline-block;
          font-family: 'Courier New', 'SF Mono', monospace;
          text-shadow:
            0 0 10px rgba(255,200,220,0.8),
            0 0 22px rgba(255,150,200,0.5),
            0 0 40px rgba(200,75,139,0.3);
          animation: digitFlip 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
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
          background: linear-gradient(160deg, #e8466a 0%, #c84b8b 45%, #9b4dca 100%);
          border-radius: 0 0 40px 40px;
          padding: 56px 24px 36px;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          z-index: 1;
          box-shadow: 0 12px 60px rgba(200,75,139,0.4);
        }
        /* subtle shimmer overlay */
        .home-banner::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(135deg,
            rgba(255,255,255,0.08) 0%,
            transparent 40%,
            transparent 60%,
            rgba(255,255,255,0.04) 100%);
          pointer-events: none;
        }

        /* ── Avatar row ── */
        .av-row { display: flex; align-items: center; gap: 20px; margin-bottom: 28px; }

        /* ── Day counter ── */
        .day-counter { text-align: center; color: white; }
        .day-number {
          font-family: var(--font-display);
          font-size: clamp(60px, 15vw, 88px);
          font-weight: 700;
          line-height: 1;
          letter-spacing: -3px;
          animation: countIn 0.7s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes countIn {
          from { opacity:0; transform: scale(0.65); }
          to   { opacity:1; transform: scale(1); }
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
          font-weight: 700;
          color: white;
          text-shadow: 0 0 14px rgba(255,180,210,0.6);
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
          background: rgba(0,0,0,0.15);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 14px;
          padding: 8px 20px;
          letter-spacing: 3px;
          font-size: 24px;
          color: white;
          font-weight: 700;
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
          background: var(--bg-card);
          border-radius: 22px;
          padding: 18px 20px;
          box-shadow: var(--shadow);
          animation: slideUp 0.5s ease both;
        }
        @keyframes slideUp {
          from { opacity:0; transform: translateY(22px); }
          to   { opacity:1; transform: translateY(0); }
        }
        .hc-title {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: var(--text-muted);
          margin-bottom: 12px;
        }

        /* ── Love message ── */
        .love-card {
          background: linear-gradient(150deg, #e8466a 0%, #c84b8b 55%, #9b4dca 100%);
          border-radius: 22px;
          padding: 20px;
          color: white;
          position: relative;
          box-shadow: 0 8px 32px rgba(200,75,139,0.32);
          animation: slideUp 0.5s ease both;
        }
        .love-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          border: 1px solid rgba(255,255,255,0.12);
          pointer-events: none;
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
          gap: 12px;
        }
        .action-btn {
          background: var(--bg-card);
          border: 1px solid rgba(232,70,106,0.08);
          border-radius: 20px;
          padding: 18px 12px 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          box-shadow: var(--shadow);
          transition: transform 0.15s, box-shadow 0.15s;
          position: relative;
          overflow: hidden;
        }
        .action-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(232,70,106,0.04) 0%, transparent 100%);
          pointer-events: none;
        }
        .action-btn:active {
          transform: scale(0.94);
          box-shadow: 0 2px 8px rgba(200,75,139,0.12);
        }
        .action-btn-icon {
          width: 42px; height: 42px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(232,70,106,0.1) 0%, rgba(200,75,139,0.08) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
        }
        .action-btn-label {
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 700;
          color: var(--text);
          text-align: center;
          line-height: 1.3;
        }
        .app.dark .action-btn { background: #2A2540; border-color: rgba(232,70,106,0.12); }
        .app.dark .action-btn-label { color: #EDE4F0; }
        .app.dark .action-btn-icon { background: rgba(232,70,106,0.15); }

        /* ── Meeting countdown ── */
        .meet-values { display: flex; gap: 10px; justify-content: center; }
        .meet-unit {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: linear-gradient(135deg, #fff0f4 0%, #ffe4ee 100%);
          border-radius: 16px;
          padding: 12px 14px;
          min-width: 58px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 8px rgba(200,75,139,0.08);
        }
        .app.dark .meet-unit { background: rgba(200,75,139,0.12); box-shadow: none; }
        .meet-num {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 700;
          color: #c84b8b;
          line-height: 1;
          text-shadow: 0 1px 0 rgba(255,255,255,0.6);
        }
        .app.dark .meet-num { color: #f7a8c4; text-shadow: none; }
        .meet-lbl {
          font-family: var(--font-body);
          font-size: 10px;
          color: #c84b8b;
          opacity: 0.7;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 3px;
        }
        .app.dark .meet-lbl { color: #f7a8c4; }

        /* ── Next event ── */
        .event-row { display: flex; align-items: center; gap: 14px; }
        .event-emoji-block {
          width: 48px; height: 48px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(232,70,106,0.12) 0%, rgba(200,75,139,0.08) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          flex-shrink: 0;
        }
        .event-info { flex: 1; min-width: 0; }
        .event-name {
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 15px;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .app.dark .event-name { color: #EDE4F0; }
        .event-date { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
        .event-badge {
          background: linear-gradient(135deg, #e8466a, #c84b8b);
          color: white;
          border-radius: 12px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 700;
          font-family: var(--font-body);
          white-space: nowrap;
          flex-shrink: 0;
          box-shadow: 0 3px 12px rgba(200,75,139,0.3);
        }

        /* ── Buttons ── */
        .btn-primary {
          background: linear-gradient(135deg, #e8466a, #c84b8b);
          color: white;
          border: none;
          border-radius: 13px;
          padding: 11px 22px;
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(200,75,139,0.3), inset 0 1px 0 rgba(255,255,255,0.15);
          transition: transform 0.12s, box-shadow 0.12s;
        }
        .btn-primary:active {
          transform: scale(0.96);
          box-shadow: 0 2px 8px rgba(200,75,139,0.25);
        }
        .btn-ghost {
          background: rgba(0,0,0,0.05);
          border: none;
          border-radius: 13px;
          padding: 11px 18px;
          font-family: var(--font-body);
          font-weight: 600;
          font-size: 14px;
          color: var(--text-muted);
          cursor: pointer;
        }
        .app.dark .btn-ghost { background: rgba(255,255,255,0.08); }
        .btn-outline-sm {
          background: transparent;
          border: 1.5px solid rgba(200,75,139,0.3);
          color: #c84b8b;
          border-radius: 11px;
          padding: 7px 16px;
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 10px;
          transition: background 0.15s;
        }
        .btn-outline-sm:active { background: rgba(200,75,139,0.08); }
        .app.dark .btn-outline-sm { border-color: rgba(247,168,196,0.3); color: #f7a8c4; }

        /* date input override */
        input[type='datetime-local'] {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid rgba(232,70,106,0.18);
          border-radius: 13px;
          font-family: var(--font-body);
          font-size: 14px;
          background: var(--bg);
          color: var(--text);
          margin-bottom: 12px;
          outline: none;
        }
        input[type='datetime-local']:focus { border-color: var(--primary); }
        .app.dark input[type='datetime-local'] { background: #3A3050; border-color: #3A3050; color: #EDE4F0; }
      `}</style>

      <FloatingLayer />

      <div className="home-wrap">
        {/* ════════ HERO BANNER ════════ */}
        <div className="home-banner">
          {/* Avatars + Heart */}
          <div className="av-row">
            <AvatarRing
              src={profile?.avatar_url}
              name={myName}
              initials={myName[0]}
            />
            <div style={{ animation: 'heartbeat 1.6s ease-in-out infinite' }}>
              <CentreHeart />
            </div>
            <AvatarRing
              src={partnerProfile?.avatar_url}
              name={pName}
              initials={pName[0]}
            />
          </div>

          {/* Day counter */}
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

          {/* Heart progress bar */}
          <HeartProgress progress={anniv.progress} daysUntil={anniv.daysUntil} />
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
            <div className="hc" style={{ animationDelay: '0.1s' }}>
              <div className="hc-title">Ближайшее событие</div>
              <div className="event-row">
                <div className="event-emoji-block">{nextEvent.emoji || '📅'}</div>
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
          <div className="hc" style={{ animationDelay: '0.18s' }}>
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
