import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function pad(value) {
  return String(value).padStart(2, '0')
}

function getRelTime(start) {
  const now = new Date()
  const diff = now - start
  const totalDays = Math.max(0, Math.floor(diff / 86400000))

  return {
    totalDays,
    years: Math.floor(totalDays / 365),
    months: Math.floor((totalDays % 365) / 30),
    days: totalDays % 30,
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  }
}

function getAnniversary(start) {
  const now = new Date()
  const next = new Date(start)
  next.setFullYear(now.getFullYear())
  if (next <= now) next.setFullYear(now.getFullYear() + 1)

  const daysUntil = Math.max(0, Math.ceil((next - now) / 86400000))
  const daysPassed = Math.max(0, Math.floor((now - start) / 86400000))
  const progress = Math.min(((daysPassed % 365) / 365) * 100, 100)

  return { daysUntil, progress }
}

function getTimeUntil(target) {
  if (!target) return null
  const diff = new Date(target) - new Date()
  if (diff <= 0) return null

  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  }
}

function localToUTC(value) {
  return value ? new Date(value).toISOString() : null
}

function utcToLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function formatDate(value, options) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('ru-RU', options)
}

function getInitials(name) {
  if (!name) return 'L'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'L'
}

function AvatarHalo({ src, name, onClick, muted = false }) {
  const [imgError, setImgError] = useState(false)

  return (
    <button type="button" className={`lux-avatar${muted ? ' muted' : ''}`} onClick={onClick}>
      <span className="lux-avatar-ring" />
      <span className="lux-avatar-core">
        {src && !imgError ? (
          <img
            src={src}
            alt={name}
            className="lux-avatar-image"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="lux-avatar-fallback">{getInitials(name)}</span>
        )}
      </span>
      <span className="lux-avatar-name">{name || 'Love'}</span>
    </button>
  )
}

function ActionCard({ title, subtitle, label, icon, onClick, wide = false }) {
  return (
    <button
      type="button"
      className={`action-card${wide ? ' wide' : ''}`}
      onClick={onClick}
    >
      <span className="action-card-glow" />
      <span className="action-card-head">
        <span className="action-card-icon">{icon}</span>
        <span className="action-card-label">{label}</span>
      </span>
      <span className="action-card-title">{title}</span>
      <span className="action-card-subtitle">{subtitle}</span>
    </button>
  )
}

function DataCard({ eyebrow, title, children, compact = false }) {
  return (
    <section className={`data-card${compact ? ' compact' : ''}`}>
      <div className="data-card-eyebrow">{eyebrow}</div>
      <div className="data-card-title">{title}</div>
      {children}
    </section>
  )
}

function PartnerCard({ profile, loading, onClose }) {
  return (
    <div className="partner-overlay" onClick={onClose}>
      <div className="partner-dialog" onClick={e => e.stopPropagation()}>
        <button type="button" className="partner-close" onClick={onClose}>
          x
        </button>
        {loading ? (
          <div className="partner-loading" />
        ) : (
          <>
            <AvatarHalo src={profile?.avatar_url} name={profile?.name || 'Партнёр'} />
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
}

export default function Home({ session, profile, onNavigate }) {
  const [time, setTime] = useState(null)
  const [settings, setSettings] = useState(null)
  const [nextEvent, setNextEvent] = useState(null)
  const [countdown, setCountdown] = useState(null)
  const [partnerProfile, setPartnerProfile] = useState(null)
  const [sharedCoupleDate, setSharedCoupleDate] = useState(null)
  const [partnerLoading, setPartnerLoading] = useState(!!profile?.partner_id)
  const [editMsg, setEditMsg] = useState(false)
  const [editMeet, setEditMeet] = useState(false)
  const [newMsg, setNewMsg] = useState('')
  const [newMeet, setNewMeet] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPartnerCard, setShowPartnerCard] = useState(false)

  const hasPartner = !!profile?.partner_id
  const effectiveCoupleDate = sharedCoupleDate ?? profile?.couple_start_date ?? null
  const hasStartDate = !!effectiveCoupleDate
  const coupleStart = useMemo(
    () => (effectiveCoupleDate ? new Date(`${effectiveCoupleDate}T00:00:00`) : null),
    [effectiveCoupleDate]
  )
  const anniv = useMemo(
    () => (coupleStart ? getAnniversary(coupleStart) : { daysUntil: null, progress: 0 }),
    [coupleStart]
  )

  const myName = profile?.name || 'You'
  const partnerName = partnerProfile?.name || (hasPartner ? 'Партнёр' : 'Only you')
  const headline = hasPartner ? `${myName} & ${partnerName}` : myName
  const loveMsg = settings?.love_message || 'Для вас двоих. Тихо, красиво и только по любви.'

  useEffect(() => {
    if (!coupleStart) {
      setTime(null)
      return undefined
    }

    const update = () => setTime(getRelTime(coupleStart))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [coupleStart])

  useEffect(() => {
    if (!settings?.next_meeting) {
      setCountdown(null)
      return undefined
    }

    const update = () => setCountdown(getTimeUntil(settings.next_meeting))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [settings?.next_meeting])

  useEffect(() => {
    let mounted = true

    async function loadHome() {
      if (!session?.user?.id) return

      try {
        if (profile?.partner_id) {
          setPartnerLoading(true)
          const { data: partner } = await supabase
            .from('profiles')
            .select('id, name, avatar_url, birthday')
            .eq('id', profile.partner_id)
            .single()

          if (mounted) setPartnerProfile(partner || null)
        } else if (mounted) {
          setPartnerProfile(null)
          setPartnerLoading(false)
        }

        if (profile?.couple_id) {
          const { data: couple } = await supabase
            .from('couples')
            .select('start_date')
            .eq('id', profile.couple_id)
            .maybeSingle()

          if (mounted && couple?.start_date) {
            setSharedCoupleDate(couple.start_date)
          }
        }

        let fetchedSettings = null

        if (profile?.couple_id) {
          const { data } = await supabase
            .from('couple_settings')
            .select('*')
            .eq('couple_id', profile.couple_id)
            .maybeSingle()
          fetchedSettings = data || null
        }

        if (!fetchedSettings) {
          const { data } = await supabase
            .from('couple_settings')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle()
          fetchedSettings = data || null
        }

        if (mounted) {
          setSettings(fetchedSettings)
          setNewMsg(fetchedSettings?.love_message || loveMsg)
          setNewMeet(utcToLocal(fetchedSettings?.next_meeting))
        }

        let eventsQuery = supabase
          .from('calendar_events')
          .select('id, title, emoji, event_date')
          .gte('event_date', new Date().toISOString())
          .order('event_date', { ascending: true })
          .limit(1)

        if (profile?.couple_id) {
          eventsQuery = eventsQuery.eq('couple_id', profile.couple_id)
        } else {
          eventsQuery = eventsQuery.eq('user_id', session.user.id)
        }

        const { data: eventRows } = await eventsQuery

        if (mounted) {
          setNextEvent(eventRows?.[0] || null)
          setPartnerLoading(false)
        }
      } catch (error) {
        console.warn('Home load failed:', error)
        if (mounted) setPartnerLoading(false)
      }
    }

    loadHome()

    return () => {
      mounted = false
    }
  }, [profile?.couple_id, profile?.partner_id, session?.user?.id, loveMsg])

  async function saveMessage() {
    if (!session?.user?.id) return
    setSaving(true)

    try {
      const payload = {
        love_message: newMsg.trim(),
        next_meeting: settings?.next_meeting || null,
      }

      if (profile?.couple_id) payload.couple_id = profile.couple_id
      else payload.user_id = session.user.id

      const { data, error } = await supabase
        .from('couple_settings')
        .upsert(payload, { onConflict: profile?.couple_id ? 'couple_id' : 'user_id' })
        .select()
        .maybeSingle()

      if (error) throw error

      setSettings(prev => ({ ...prev, ...payload, ...(data || {}) }))
      setEditMsg(false)
    } catch (error) {
      console.warn('Save message failed:', error)
    } finally {
      setSaving(false)
    }
  }

  async function saveMeeting() {
    if (!session?.user?.id) return
    setSaving(true)

    try {
      const payload = {
        love_message: settings?.love_message || loveMsg,
        next_meeting: localToUTC(newMeet),
      }

      if (profile?.couple_id) payload.couple_id = profile.couple_id
      else payload.user_id = session.user.id

      const { data, error } = await supabase
        .from('couple_settings')
        .upsert(payload, { onConflict: profile?.couple_id ? 'couple_id' : 'user_id' })
        .select()
        .maybeSingle()

      if (error) throw error

      setSettings(prev => ({ ...prev, ...payload, ...(data || {}) }))
      setEditMeet(false)
    } catch (error) {
      console.warn('Save meeting failed:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <style>{`
        .lux-home {
          --bg-main: #090709;
          --bg-card: rgba(18, 14, 16, 0.78);
          --bg-card-strong: rgba(27, 20, 23, 0.9);
          --line: rgba(255, 244, 229, 0.08);
          --line-strong: rgba(255, 244, 229, 0.16);
          --text-main: #f7efe6;
          --text-soft: rgba(247, 239, 230, 0.72);
          --text-faint: rgba(247, 239, 230, 0.48);
          --gold: #dcc4a1;
          --wine: #7f2235;
          --wine-2: #5f1527;
          --glow: rgba(220, 196, 161, 0.18);
          min-height: 100vh;
          color: var(--text-main);
          background:
            radial-gradient(circle at 15% 10%, rgba(127, 34, 53, 0.22), transparent 34%),
            radial-gradient(circle at 85% 0%, rgba(220, 196, 161, 0.12), transparent 30%),
            radial-gradient(circle at 50% 30%, rgba(255, 255, 255, 0.04), transparent 45%),
            linear-gradient(180deg, #120c0f 0%, #090709 54%, #090709 100%);
          padding: 20px 16px calc(104px + env(safe-area-inset-bottom, 0px));
          position: relative;
          overflow: hidden;
        }

        .lux-home::before,
        .lux-home::after {
          content: '';
          position: fixed;
          inset: auto;
          pointer-events: none;
          filter: blur(70px);
          z-index: 0;
          opacity: 0.9;
        }

        .lux-home::before {
          top: 80px;
          left: -60px;
          width: 200px;
          height: 200px;
          background: rgba(127, 34, 53, 0.18);
          animation: ambientFloat 14s ease-in-out infinite;
        }

        .lux-home::after {
          top: 160px;
          right: -30px;
          width: 240px;
          height: 240px;
          background: rgba(220, 196, 161, 0.08);
          animation: ambientFloat 18s ease-in-out infinite reverse;
        }

        .lux-shell {
          position: relative;
          z-index: 1;
          width: min(100%, 760px);
          margin: 0 auto;
          display: grid;
          gap: 14px;
        }

        .lux-hero {
          position: relative;
          overflow: hidden;
          border-radius: 30px;
          padding: 18px 18px 20px;
          background:
            linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01)),
            linear-gradient(180deg, rgba(12, 9, 11, 0.9), rgba(20, 13, 17, 0.84));
          border: 1px solid var(--line);
          box-shadow:
            0 24px 80px rgba(0, 0, 0, 0.42),
            inset 0 1px 0 rgba(255,255,255,0.05);
          animation: revealUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .lux-hero::before {
          content: '';
          position: absolute;
          inset: -20% -10% auto;
          height: 220px;
          background:
            radial-gradient(circle at center, rgba(220, 196, 161, 0.15), transparent 46%),
            radial-gradient(circle at center, rgba(127, 34, 53, 0.26), transparent 68%);
          animation: heroPulse 8s ease-in-out infinite;
          pointer-events: none;
        }

        .lux-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .lux-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          color: var(--text-soft);
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .lux-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: linear-gradient(180deg, var(--gold), #b08f65);
          box-shadow: 0 0 18px rgba(220, 196, 161, 0.35);
        }

        .lux-hero-button {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: var(--text-main);
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 12px;
          cursor: pointer;
          transition: transform 0.24s ease, background 0.24s ease;
        }

        .lux-hero-button:active {
          transform: scale(0.98);
        }

        .lux-hero-content {
          display: grid;
          gap: 16px;
        }

        .lux-avatar-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
        }

        .lux-link {
          width: 34px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          position: relative;
        }

        .lux-link::after {
          content: '♥';
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -58%);
          color: rgba(220, 196, 161, 0.72);
          font-size: 14px;
        }

        .lux-avatar {
          border: none;
          background: transparent;
          color: inherit;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          padding: 0;
        }

        .lux-avatar-ring {
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          background:
            linear-gradient(135deg, rgba(220,196,161,0.95), rgba(127,34,53,0.72), rgba(255,255,255,0.52));
          animation: slowSpin 10s linear infinite;
        }

        .lux-avatar-core {
          position: relative;
          width: 84px;
          height: 84px;
          border-radius: 999px;
          padding: 1px;
          background: rgba(255,255,255,0.06);
          overflow: hidden;
          box-shadow: 0 14px 40px rgba(0,0,0,0.35);
        }

        .lux-avatar-core::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(180deg, rgba(255,255,255,0.18), transparent 45%);
          pointer-events: none;
        }

        .lux-avatar-image,
        .lux-avatar-fallback {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          border-radius: inherit;
          object-fit: cover;
          background: linear-gradient(180deg, #2f2025, #171114);
          color: var(--text-main);
          font-size: 24px;
          font-weight: 600;
          letter-spacing: 0.08em;
        }

        .lux-avatar-name {
          font-size: 12px;
          color: var(--text-soft);
        }

        .lux-avatar.muted {
          opacity: 0.5;
        }

        .lux-title-wrap {
          display: grid;
          gap: 8px;
          text-align: center;
          justify-items: center;
        }

        .lux-overline {
          font-size: 11px;
          letter-spacing: 0.26em;
          text-transform: uppercase;
          color: var(--text-faint);
        }

        .lux-title {
          margin: 0;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(36px, 7vw, 56px);
          font-weight: 500;
          line-height: 0.95;
          letter-spacing: -0.03em;
        }

        .lux-subtitle {
          max-width: 30rem;
          margin: 0;
          font-size: 15px;
          line-height: 1.65;
          color: var(--text-soft);
        }

        .lux-counter {
          display: grid;
          gap: 14px;
          margin-top: 4px;
        }

        .lux-counter-main {
          display: grid;
          justify-items: center;
          gap: 4px;
        }

        .lux-counter-number {
          display: flex;
          gap: 4px;
          align-items: baseline;
          flex-wrap: wrap;
          justify-content: center;
        }

        .lux-counter-number strong {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(72px, 18vw, 108px);
          line-height: 0.9;
          font-weight: 600;
          color: var(--text-main);
          text-shadow: 0 10px 40px rgba(0,0,0,0.35);
        }

        .lux-counter-number span {
          font-size: 15px;
          color: var(--gold);
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .lux-counter-clock {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          font-size: 13px;
          color: var(--text-soft);
        }

        .lux-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
        }

        .lux-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .lux-metric {
          padding: 14px 10px;
          border-radius: 20px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          text-align: center;
        }

        .lux-metric-value {
          display: block;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 28px;
          line-height: 1;
          margin-bottom: 4px;
        }

        .lux-metric-label {
          display: block;
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--text-faint);
        }

        .lux-progress {
          height: 6px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(255,255,255,0.08);
        }

        .lux-progress-bar {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--wine), var(--gold));
          box-shadow: 0 0 28px rgba(220, 196, 161, 0.24);
          transition: width 0.9s ease;
        }

        .lux-grid {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .action-card,
        .data-card {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          border: 1px solid var(--line);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
            var(--bg-card);
          box-shadow: 0 22px 60px rgba(0,0,0,0.24);
          animation: revealUp 0.78s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .action-card {
          text-align: left;
          padding: 18px;
          cursor: pointer;
          color: inherit;
          display: grid;
          gap: 14px;
        }

        .action-card.wide {
          grid-column: span 2;
        }

        .action-card-glow {
          position: absolute;
          inset: auto auto 0 -30px;
          width: 140px;
          height: 140px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(220,196,161,0.18), transparent 65%);
          filter: blur(20px);
          transition: transform 0.35s ease;
        }

        .action-card:active .action-card-glow {
          transform: scale(1.1);
        }

        .action-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          position: relative;
          z-index: 1;
        }

        .action-card-icon {
          width: 46px;
          height: 46px;
          border-radius: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, rgba(220,196,161,0.22), rgba(127,34,53,0.15));
          border: 1px solid rgba(255,255,255,0.08);
          color: var(--gold);
        }

        .action-card-label {
          font-size: 11px;
          color: var(--text-faint);
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .action-card-title {
          position: relative;
          z-index: 1;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 30px;
          line-height: 0.95;
        }

        .action-card-subtitle {
          position: relative;
          z-index: 1;
          color: var(--text-soft);
          font-size: 14px;
          line-height: 1.6;
        }

        .data-card {
          padding: 18px;
          display: grid;
          gap: 14px;
        }

        .data-card.compact {
          gap: 12px;
        }

        .data-card-eyebrow {
          font-size: 11px;
          color: var(--text-faint);
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .data-card-title {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 28px;
          line-height: 0.96;
        }

        .event-row,
        .meeting-row {
          display: grid;
          gap: 12px;
        }

        .event-line {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .event-emoji {
          width: 52px;
          height: 52px;
          border-radius: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.06);
          font-size: 24px;
        }

        .event-copy {
          min-width: 0;
          flex: 1;
        }

        .event-name {
          font-size: 16px;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .event-date {
          margin-top: 4px;
          font-size: 13px;
          color: var(--text-soft);
        }

        .event-days {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 62px;
          padding: 10px 12px;
          border-radius: 16px;
          background: linear-gradient(180deg, rgba(127,34,53,0.92), rgba(95,21,39,0.92));
          box-shadow: 0 12px 32px rgba(95, 21, 39, 0.35);
          font-size: 13px;
        }

        .meeting-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .meeting-cell {
          padding: 14px 8px;
          border-radius: 18px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.06);
          text-align: center;
        }

        .meeting-num {
          display: block;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 30px;
          line-height: 1;
        }

        .meeting-label {
          display: block;
          margin-top: 4px;
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--text-faint);
        }

        .lux-note {
          margin: 0;
          font-size: 15px;
          line-height: 1.75;
          color: var(--text-soft);
        }

        .lux-note strong {
          color: var(--text-main);
          font-weight: 500;
        }

        .field {
          width: 100%;
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          color: var(--text-main);
          padding: 14px 16px;
          outline: none;
          font: inherit;
          resize: vertical;
        }

        .field::placeholder {
          color: rgba(247,239,230,0.35);
        }

        .field:focus {
          border-color: rgba(220,196,161,0.36);
          box-shadow: 0 0 0 4px rgba(220,196,161,0.08);
        }

        .field-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn-primary,
        .btn-ghost {
          border: none;
          border-radius: 999px;
          padding: 11px 16px;
          cursor: pointer;
          font: inherit;
        }

        .btn-primary {
          color: #fff7ef;
          background: linear-gradient(180deg, var(--wine), var(--wine-2));
          box-shadow: 0 12px 32px rgba(95, 21, 39, 0.34);
        }

        .btn-ghost {
          color: var(--text-soft);
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.07);
        }

        .section-row {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 14px;
        }

        .partner-overlay {
          position: fixed;
          inset: 0;
          background: rgba(5, 3, 4, 0.7);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 80;
        }

        .partner-dialog {
          width: min(100%, 340px);
          border-radius: 28px;
          padding: 24px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)),
            rgba(19, 14, 16, 0.96);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 26px 80px rgba(0,0,0,0.45);
          text-align: center;
          position: relative;
          display: grid;
          justify-items: center;
          gap: 12px;
          animation: revealUp 0.3s ease both;
        }

        .partner-close {
          position: absolute;
          right: 14px;
          top: 14px;
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.04);
          color: var(--text-main);
          font-size: 22px;
          cursor: pointer;
        }

        .partner-title {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 32px;
        }

        .partner-subtitle {
          color: var(--text-soft);
        }

        .partner-loading {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: 2px solid rgba(255,255,255,0.12);
          border-top-color: var(--gold);
          animation: spin 0.9s linear infinite;
        }

        @keyframes ambientFloat {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(18px, -16px, 0) scale(1.08); }
        }

        @keyframes heroPulse {
          0%, 100% { transform: scale(1); opacity: 0.75; }
          50% { transform: scale(1.08); opacity: 1; }
        }

        @keyframes revealUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slowSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 640px) {
          .lux-home {
            padding-inline: 12px;
          }

          .lux-grid,
          .section-row {
            grid-template-columns: 1fr;
          }

          .action-card.wide {
            grid-column: span 1;
          }

          .meeting-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .lux-metrics {
            grid-template-columns: 1fr;
          }

          .lux-title {
            font-size: 42px;
          }
        }
      `}</style>

      <div className="lux-home">
        <div className="lux-shell">
          <section className="lux-hero">
            <div className="lux-topline">
              <div className="lux-chip">
                <span className="lux-dot" />
                Private for two
              </div>
              <button
                type="button"
                className="lux-hero-button"
                onClick={() => onNavigate?.('settings')}
              >
                Настройки
              </button>
            </div>

            <div className="lux-hero-content">
              <div className="lux-avatar-row">
                <AvatarHalo
                  src={profile?.avatar_url}
                  name={myName}
                  onClick={() => onNavigate?.('settings')}
                />
                {hasPartner ? (
                  <>
                    <div className="lux-link" />
                    {partnerLoading ? (
                      <AvatarHalo name="..." muted />
                    ) : (
                      <AvatarHalo
                        src={partnerProfile?.avatar_url}
                        name={partnerName}
                        onClick={() => setShowPartnerCard(true)}
                      />
                    )}
                  </>
                ) : null}
              </div>

              <div className="lux-title-wrap">
                <div className="lux-overline">Luxury Home</div>
                <h1 className="lux-title">{headline}</h1>
                <p className="lux-subtitle">
                  Пространство, которое ощущается как закрытый клуб для ваших чувств:
                  глубже, чище и красивее с каждым днём.
                </p>
              </div>

              <div className="lux-counter">
                {time && hasStartDate ? (
                  <>
                    <div className="lux-counter-main">
                      <div className="lux-counter-number">
                        <strong>{time.totalDays}</strong>
                        <span>days together</span>
                      </div>
                      <div className="lux-counter-clock">
                        <span>{pad(time.hours)}</span>
                        <span>:</span>
                        <span>{pad(time.minutes)}</span>
                        <span>:</span>
                        <span>{pad(time.seconds)}</span>
                      </div>
                    </div>

                    <div className="lux-progress">
                      <div
                        className="lux-progress-bar"
                        style={{ width: `${anniv.progress}%` }}
                      />
                    </div>

                    <div className="lux-metrics">
                      <div className="lux-metric">
                        <span className="lux-metric-value">{time.years}</span>
                        <span className="lux-metric-label">лет</span>
                      </div>
                      <div className="lux-metric">
                        <span className="lux-metric-value">{time.months}</span>
                        <span className="lux-metric-label">месяцев</span>
                      </div>
                      <div className="lux-metric">
                        <span className="lux-metric-value">
                          {anniv.daysUntil ?? '—'}
                        </span>
                        <span className="lux-metric-label">до годовщины</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <DataCard eyebrow="Setup" title={hasPartner ? 'Добавьте дату начала' : 'Пригласите партнёра'}>
                    <p className="lux-note">
                      {hasPartner
                        ? 'Когда появится дата отношений, главный экран станет живым и покажет историю вашей пары.'
                        : 'Как только вы соедините пару, главный экран превратится в красивую личную историю для двоих.'}
                    </p>
                    <div className="field-row">
                      <button type="button" className="btn-primary" onClick={() => onNavigate?.('settings')}>
                        Открыть настройки
                      </button>
                    </div>
                  </DataCard>
                )}
              </div>
            </div>
          </section>

          <div className="lux-grid">
            <ActionCard
              label="Featured"
              title="Моменты"
              subtitle="Ваши кадры в виде красивой приватной галереи."
              onClick={() => onNavigate?.('moments')}
              icon={
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              }
            />
            <ActionCard
              label="Featured"
              title="Письмо"
              subtitle="Личное послание, которое хочется открыть вечером."
              onClick={() => onNavigate?.('letter')}
              icon={
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <polyline points="2,5 12,13 22,5" />
                </svg>
              }
            />
            <ActionCard
              label="Live"
              title="Чат"
              subtitle="Быстрый переход в тёплый приватный диалог."
              onClick={() => onNavigate?.('chat')}
              wide
              icon={
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              }
            />
          </div>

          <div className="section-row">
            <DataCard eyebrow="Upcoming" title="Ближайшее событие">
              {nextEvent ? (
                <div className="event-row">
                  <div className="event-line">
                    <div className="event-emoji">{nextEvent.emoji || '✦'}</div>
                    <div className="event-copy">
                      <div className="event-name">{nextEvent.title}</div>
                      <div className="event-date">
                        {formatDate(nextEvent.event_date, { day: 'numeric', month: 'long' })}
                      </div>
                    </div>
                    <div className="event-days">
                      {Math.max(0, Math.ceil((new Date(nextEvent.event_date) - new Date()) / 86400000))} дн
                    </div>
                  </div>
                  <button type="button" className="btn-ghost" onClick={() => onNavigate?.('calendar')}>
                    Открыть календарь
                  </button>
                </div>
              ) : (
                <div className="event-row">
                  <p className="lux-note">
                    Добавьте красивый следующий момент: встречу, поездку, ужин или вашу дату.
                  </p>
                  <button type="button" className="btn-primary" onClick={() => onNavigate?.('calendar')}>
                    Создать событие
                  </button>
                </div>
              )}
            </DataCard>

            <DataCard eyebrow="Count" title="До встречи" compact>
              {editMeet ? (
                <>
                  <input
                    className="field"
                    type="datetime-local"
                    value={newMeet}
                    onChange={e => setNewMeet(e.target.value)}
                  />
                  <div className="field-row">
                    <button type="button" className="btn-primary" onClick={saveMeeting} disabled={saving}>
                      {saving ? 'Сохраняю...' : 'Сохранить'}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setEditMeet(false)}>
                      Отмена
                    </button>
                  </div>
                </>
              ) : countdown ? (
                <div className="meeting-row">
                  <div className="meeting-grid">
                    {[
                      [countdown.days, 'дни'],
                      [pad(countdown.hours), 'часы'],
                      [pad(countdown.minutes), 'мин'],
                      [pad(countdown.seconds), 'сек'],
                    ].map(([value, label]) => (
                      <div className="meeting-cell" key={label}>
                        <span className="meeting-num">{value}</span>
                        <span className="meeting-label">{label}</span>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="btn-ghost" onClick={() => setEditMeet(true)}>
                    Изменить
                  </button>
                </div>
              ) : (
                <div className="meeting-row">
                  <p className="lux-note">Добавьте следующую встречу, чтобы экран жил в ожидании.</p>
                  <button type="button" className="btn-primary" onClick={() => setEditMeet(true)}>
                    Указать дату
                  </button>
                </div>
              )}
            </DataCard>
          </div>

          <DataCard eyebrow="Private note" title="Love note">
            {editMsg ? (
              <>
                <textarea
                  className="field"
                  rows={4}
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  placeholder="Напиши фразу, ради которой хочется возвращаться на главный экран"
                />
                <div className="field-row">
                  <button type="button" className="btn-primary" onClick={saveMessage} disabled={saving}>
                    {saving ? 'Сохраняю...' : 'Сохранить'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setEditMsg(false)}>
                    Отмена
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="lux-note">
                  <strong>«{loveMsg}»</strong>
                </p>
                <div className="field-row">
                  <button type="button" className="btn-ghost" onClick={() => setEditMsg(true)}>
                    Редактировать
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => onNavigate?.('clock')}>
                    Часы любви
                  </button>
                </div>
              </>
            )}
          </DataCard>
        </div>
      </div>

      {showPartnerCard && (
        <PartnerCard
          profile={partnerProfile}
          loading={partnerLoading}
          onClose={() => setShowPartnerCard(false)}
        />
      )}
    </>
  )
}
