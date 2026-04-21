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

  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || 'L'
  )
}

function AvatarBadge({ src, name, onClick, muted = false }) {
  const [imgError, setImgError] = useState(false)

  return (
    <button
      type="button"
      className={`home-avatar${muted ? ' muted' : ''}`}
      onClick={onClick}
    >
      <span className="home-avatar-frame">
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
}

function FeatureCard({ title, subtitle, badge, icon, onClick, wide = false }) {
  return (
    <button
      type="button"
      className={`feature-card${wide ? ' wide' : ''}`}
      onClick={onClick}
    >
      <div className="feature-card-top">
        <span className="feature-card-icon">{icon}</span>
        <span className="feature-card-badge">{badge}</span>
      </div>
      <div className="feature-card-title">{title}</div>
      <div className="feature-card-subtitle">{subtitle}</div>
    </button>
  )
}

function InfoCard({ eyebrow, title, children, compact = false }) {
  return (
    <section className={`info-card${compact ? ' compact' : ''}`}>
      <div className="info-card-eyebrow">{eyebrow}</div>
      <div className="info-card-title">{title}</div>
      {children}
    </section>
  )
}

function PartnerModal({ profile, loading, onClose }) {
  return (
    <div className="partner-modal-overlay" onClick={onClose}>
      <div className="partner-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="partner-close" onClick={onClose}>
          Закрыть
        </button>

        {loading ? (
          <div className="partner-loading" />
        ) : (
          <>
            <AvatarBadge
              src={profile?.avatar_url}
              name={profile?.name || 'Партнер'}
            />
            <div className="partner-name">{profile?.name || 'Партнер'}</div>
            {profile?.birthday && (
              <div className="partner-meta">
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
  const [editMessage, setEditMessage] = useState(false)
  const [editMeeting, setEditMeeting] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [newMeeting, setNewMeeting] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPartnerModal, setShowPartnerModal] = useState(false)

  const hasPartner = !!profile?.partner_id
  const effectiveCoupleDate = sharedCoupleDate ?? profile?.couple_start_date ?? null
  const hasStartDate = !!effectiveCoupleDate

  const coupleStart = useMemo(() => {
    return effectiveCoupleDate ? new Date(`${effectiveCoupleDate}T00:00:00`) : null
  }, [effectiveCoupleDate])

  const anniversary = useMemo(() => {
    return coupleStart ? getAnniversary(coupleStart) : { daysUntil: null, progress: 0 }
  }, [coupleStart])

  const myName = profile?.name || 'Ты'
  const partnerName = partnerProfile?.name || (hasPartner ? 'Партнер' : 'Только ты')
  const title = hasPartner ? `${myName} и ${partnerName}` : myName
  const loveMessage =
    settings?.love_message || 'Здесь живет ваша история. Тихая, красивая и только для двоих.'

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

          if (mounted) {
            setPartnerProfile(partner || null)
          }
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
          setNewMessage(
            fetchedSettings?.love_message ||
              'Здесь живет ваша история. Тихая, красивая и только для двоих.'
          )
          setNewMeeting(utcToLocal(fetchedSettings?.next_meeting))
        }

        let eventQuery = supabase
          .from('calendar_events')
          .select('id, title, emoji, event_date')
          .gte('event_date', new Date().toISOString())
          .order('event_date', { ascending: true })
          .limit(1)

        if (profile?.couple_id) {
          eventQuery = eventQuery.eq('couple_id', profile.couple_id)
        } else {
          eventQuery = eventQuery.eq('user_id', session.user.id)
        }

        const { data: events } = await eventQuery

        if (mounted) {
          setNextEvent(events?.[0] || null)
          setPartnerLoading(false)
        }
      } catch (error) {
        console.warn('Ошибка загрузки главного экрана:', error)
        if (mounted) {
          setPartnerLoading(false)
        }
      }
    }

    loadHome()

    return () => {
      mounted = false
    }
  }, [profile?.couple_id, profile?.partner_id, session?.user?.id])

  async function saveMessage() {
    if (!session?.user?.id) return
    setSaving(true)

    try {
      const payload = {
        love_message: newMessage.trim(),
        next_meeting: settings?.next_meeting || null,
      }

      if (profile?.couple_id) {
        payload.couple_id = profile.couple_id
      } else {
        payload.user_id = session.user.id
      }

      const { data, error } = await supabase
        .from('couple_settings')
        .upsert(payload, {
          onConflict: profile?.couple_id ? 'couple_id' : 'user_id',
        })
        .select()
        .maybeSingle()

      if (error) throw error

      setSettings(prev => ({ ...prev, ...payload, ...(data || {}) }))
      setEditMessage(false)
    } catch (error) {
      console.warn('Ошибка сохранения сообщения:', error)
    } finally {
      setSaving(false)
    }
  }

  async function saveMeeting() {
    if (!session?.user?.id) return
    setSaving(true)

    try {
      const payload = {
        love_message: settings?.love_message || loveMessage,
        next_meeting: localToUTC(newMeeting),
      }

      if (profile?.couple_id) {
        payload.couple_id = profile.couple_id
      } else {
        payload.user_id = session.user.id
      }

      const { data, error } = await supabase
        .from('couple_settings')
        .upsert(payload, {
          onConflict: profile?.couple_id ? 'couple_id' : 'user_id',
        })
        .select()
        .maybeSingle()

      if (error) throw error

      setSettings(prev => ({ ...prev, ...payload, ...(data || {}) }))
      setEditMeeting(false)
    } catch (error) {
      console.warn('Ошибка сохранения даты встречи:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <style>{`
        .home-screen {
          --bg-main: #090708;
          --bg-hero: rgba(18, 13, 15, 0.88);
          --bg-card: rgba(22, 16, 18, 0.84);
          --bg-soft: rgba(255, 255, 255, 0.04);
          --line: rgba(255, 245, 232, 0.08);
          --line-strong: rgba(255, 245, 232, 0.14);
          --text-main: #f7efe7;
          --text-soft: rgba(247, 239, 231, 0.74);
          --text-muted: rgba(247, 239, 231, 0.48);
          --gold: #dcc19b;
          --wine: #7d2234;
          --wine-dark: #5d1827;
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          padding: 20px 16px calc(104px + env(safe-area-inset-bottom, 0px));
          background:
            radial-gradient(circle at 12% 12%, rgba(125, 34, 52, 0.20), transparent 30%),
            radial-gradient(circle at 88% 0%, rgba(220, 193, 155, 0.10), transparent 26%),
            linear-gradient(180deg, #120d0f 0%, #090708 48%, #090708 100%);
          color: var(--text-main);
        }

        .home-screen::before,
        .home-screen::after {
          content: '';
          position: absolute;
          pointer-events: none;
          border-radius: 999px;
          filter: blur(90px);
          opacity: 0.42;
          z-index: 0;
        }

        .home-screen::before {
          top: 120px;
          left: -70px;
          width: 220px;
          height: 220px;
          background: rgba(125, 34, 52, 0.20);
          animation: driftBlob 24s ease-in-out infinite;
        }

        .home-screen::after {
          top: 240px;
          right: -80px;
          width: 240px;
          height: 240px;
          background: rgba(220, 193, 155, 0.10);
          animation: driftBlob 30s ease-in-out infinite reverse;
        }

        .home-shell {
          position: relative;
          z-index: 1;
          width: min(100%, 760px);
          margin: 0 auto;
          display: grid;
          gap: 14px;
        }

        .hero-card {
          position: relative;
          overflow: hidden;
          border-radius: 30px;
          padding: 18px 18px 20px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
            var(--bg-hero);
          border: 1px solid var(--line);
          box-shadow:
            0 24px 80px rgba(0, 0, 0, 0.42),
            inset 0 1px 0 rgba(255,255,255,0.05);
          animation: fadeUp 0.55s ease both;
        }

        .hero-card::before {
          content: '';
          position: absolute;
          inset: -20% -10% auto;
          height: 220px;
          background:
            radial-gradient(circle at center, rgba(220, 193, 155, 0.10), transparent 46%),
            radial-gradient(circle at center, rgba(125, 34, 52, 0.18), transparent 68%);
          opacity: 0.7;
          pointer-events: none;
        }

        .hero-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .hero-chip {
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

        .hero-chip-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: linear-gradient(180deg, var(--gold), #b68f62);
        }

        .hero-button {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: var(--text-main);
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.2s ease;
        }

        .hero-button:active {
          transform: scale(0.98);
        }

        .hero-content {
          display: grid;
          gap: 16px;
        }

        .hero-avatars {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
        }

        .hero-link {
          width: 34px;
          height: 1px;
          position: relative;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent);
        }

        .hero-link::after {
          content: '♥';
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -58%);
          color: rgba(220, 193, 155, 0.72);
          font-size: 13px;
        }

        .home-avatar {
          border: none;
          background: transparent;
          color: inherit;
          padding: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .home-avatar.muted {
          opacity: 0.42;
        }

        .home-avatar-frame {
          width: 84px;
          height: 84px;
          border-radius: 999px;
          padding: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(
            145deg,
            rgba(220, 193, 155, 0.88),
            rgba(125, 34, 52, 0.52),
            rgba(255, 255, 255, 0.34)
          );
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.32);
        }

        .home-avatar-image,
        .home-avatar-fallback {
          width: 100%;
          height: 100%;
          border-radius: inherit;
          object-fit: cover;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, #2a1d21, #171114);
          color: var(--text-main);
          font-size: 24px;
          font-weight: 600;
          letter-spacing: 0.08em;
        }

        .home-avatar-name {
          font-size: 12px;
          color: var(--text-soft);
        }

        .hero-title-wrap {
          display: grid;
          gap: 8px;
          text-align: center;
          justify-items: center;
        }

        .hero-overline {
          font-size: 11px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .hero-title {
          margin: 0;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(36px, 7vw, 56px);
          line-height: 0.95;
          font-weight: 500;
          letter-spacing: -0.03em;
        }

        .hero-subtitle {
          margin: 0;
          max-width: 32rem;
          font-size: 15px;
          line-height: 1.65;
          color: var(--text-soft);
        }

        .hero-counter {
          display: grid;
          gap: 14px;
          margin-top: 4px;
        }

        .hero-counter-main {
          display: grid;
          justify-items: center;
          gap: 4px;
        }

        .hero-counter-number {
          display: flex;
          gap: 6px;
          align-items: baseline;
          flex-wrap: wrap;
          justify-content: center;
        }

        .hero-counter-number strong {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(72px, 18vw, 108px);
          line-height: 0.9;
          font-weight: 600;
          text-shadow: 0 10px 40px rgba(0,0,0,0.35);
        }

        .hero-counter-number span {
          font-size: 15px;
          color: var(--gold);
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .hero-clock {
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

        .hero-progress {
          height: 6px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(255,255,255,0.08);
        }

        .hero-progress-bar {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--wine), var(--gold));
          transition: width 0.8s ease;
        }

        .hero-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .hero-metric {
          padding: 14px 10px;
          border-radius: 20px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          text-align: center;
        }

        .hero-metric-value {
          display: block;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 28px;
          line-height: 1;
          margin-bottom: 4px;
        }

        .hero-metric-label {
          display: block;
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .feature-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .feature-card,
        .info-card {
          border-radius: 24px;
          border: 1px solid var(--line);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
            var(--bg-card);
          box-shadow: 0 22px 60px rgba(0,0,0,0.24);
          animation: fadeUp 0.6s ease both;
        }

        .feature-card {
          padding: 18px;
          color: inherit;
          text-align: left;
          cursor: pointer;
          display: grid;
          gap: 14px;
          transition: transform 0.2s ease, background 0.2s ease;
        }

        .feature-card:active {
          transform: scale(0.985);
        }

        .feature-card.wide {
          grid-column: span 2;
        }

        .feature-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .feature-card-icon {
          width: 46px;
          height: 46px;
          border-radius: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, rgba(220,193,155,0.18), rgba(125,34,52,0.12));
          border: 1px solid rgba(255,255,255,0.08);
          color: var(--gold);
        }

        .feature-card-badge {
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .feature-card-title {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 30px;
          line-height: 0.95;
        }

        .feature-card-subtitle {
          font-size: 14px;
          line-height: 1.6;
          color: var(--text-soft);
        }

        .section-row {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 14px;
        }

        .info-card {
          padding: 18px;
          display: grid;
          gap: 14px;
        }

        .info-card.compact {
          gap: 12px;
        }

        .info-card-eyebrow {
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .info-card-title {
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
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.06);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          flex-shrink: 0;
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
          flex-shrink: 0;
          min-width: 62px;
          padding: 10px 12px;
          border-radius: 16px;
          background: linear-gradient(180deg, var(--wine), var(--wine-dark));
          color: #fff6ee;
          font-size: 13px;
          text-align: center;
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
          color: var(--text-muted);
        }

        .note-text {
          margin: 0;
          font-size: 15px;
          line-height: 1.75;
          color: var(--text-soft);
        }

        .note-text strong {
          font-weight: 500;
          color: var(--text-main);
        }

        .field {
          width: 100%;
          padding: 14px 16px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.09);
          background: rgba(255,255,255,0.04);
          color: var(--text-main);
          font: inherit;
          outline: none;
          resize: vertical;
        }

        .field::placeholder {
          color: rgba(247, 239, 231, 0.36);
        }

        .field:focus {
          border-color: rgba(220, 193, 155, 0.34);
          box-shadow: 0 0 0 4px rgba(220, 193, 155, 0.08);
        }

        .actions-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn-primary,
        .btn-ghost {
          border: none;
          border-radius: 999px;
          padding: 11px 16px;
          font: inherit;
          cursor: pointer;
        }

        .btn-primary {
          background: linear-gradient(180deg, var(--wine), var(--wine-dark));
          color: #fff6ee;
        }

        .btn-ghost {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.07);
          color: var(--text-soft);
        }

        .partner-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(5, 3, 4, 0.72);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 80;
        }

        .partner-modal {
          width: min(100%, 340px);
          border-radius: 28px;
          padding: 24px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)),
            rgba(19, 14, 16, 0.96);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 26px 80px rgba(0,0,0,0.45);
          display: grid;
          justify-items: center;
          gap: 12px;
          position: relative;
          animation: fadeUp 0.25s ease both;
        }

        .partner-close {
          position: absolute;
          top: 14px;
          right: 14px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.04);
          color: var(--text-main);
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 12px;
          cursor: pointer;
        }

        .partner-name {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 32px;
        }

        .partner-meta {
          color: var(--text-soft);
        }

        .partner-loading {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: 2px solid rgba(255,255,255,0.12);
          border-top-color: var(--gold);
          animation: rotateLoader 0.9s linear infinite;
        }

        @keyframes driftBlob {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(10px, -8px, 0) scale(1.04);
          }
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes rotateLoader {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 640px) {
          .home-screen {
            padding-inline: 12px;
          }

          .feature-grid,
          .section-row {
            grid-template-columns: 1fr;
          }

          .feature-card.wide {
            grid-column: span 1;
          }

          .meeting-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .hero-metrics {
            grid-template-columns: 1fr;
          }

          .hero-title {
            font-size: 42px;
          }
        }
      `}</style>

      <div className="home-screen">
        <div className="home-shell">
          <section className="hero-card">
            <div className="hero-top">
              <div className="hero-chip">
                <span className="hero-chip-dot" />
                Только для двоих
              </div>

              <button
                type="button"
                className="hero-button"
                onClick={() => onNavigate?.('settings')}
              >
                Настройки
              </button>
            </div>

            <div className="hero-content">
              <div className="hero-avatars">
                <AvatarBadge
                  src={profile?.avatar_url}
                  name={myName}
                  onClick={() => onNavigate?.('settings')}
                />

                {hasPartner ? (
                  <>
                    <div className="hero-link" />
                    {partnerLoading ? (
                      <AvatarBadge name="..." muted />
                    ) : (
                      <AvatarBadge
                        src={partnerProfile?.avatar_url}
                        name={partnerName}
                        onClick={() => setShowPartnerModal(true)}
                      />
                    )}
                  </>
                ) : null}
              </div>

              <div className="hero-title-wrap">
                <div className="hero-overline">Главная история</div>
                <h1 className="hero-title">{title}</h1>
                <p className="hero-subtitle">
                  Пространство, которое выглядит дорого, чувствуется спокойно и хранит
                  только вашу историю.
                </p>
              </div>

              <div className="hero-counter">
                {time && hasStartDate ? (
                  <>
                    <div className="hero-counter-main">
                      <div className="hero-counter-number">
                        <strong>{time.totalDays}</strong>
                        <span>дней вместе</span>
                      </div>

                      <div className="hero-clock">
                        <span>{pad(time.hours)}</span>
                        <span>:</span>
                        <span>{pad(time.minutes)}</span>
                        <span>:</span>
                        <span>{pad(time.seconds)}</span>
                      </div>
                    </div>

                    <div className="hero-progress">
                      <div
                        className="hero-progress-bar"
                        style={{ width: `${anniversary.progress}%` }}
                      />
                    </div>

                    <div className="hero-metrics">
                      <div className="hero-metric">
                        <span className="hero-metric-value">{time.years}</span>
                        <span className="hero-metric-label">лет</span>
                      </div>

                      <div className="hero-metric">
                        <span className="hero-metric-value">{time.months}</span>
                        <span className="hero-metric-label">месяцев</span>
                      </div>

                      <div className="hero-metric">
                        <span className="hero-metric-value">
                          {anniversary.daysUntil ?? '-'}
                        </span>
                        <span className="hero-metric-label">до годовщины</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <InfoCard
                    eyebrow="Подготовка"
                    title={hasPartner ? 'Добавьте дату начала' : 'Пригласите партнера'}
                  >
                    <p className="note-text">
                      {hasPartner
                        ? 'Когда вы укажете дату отношений, главный экран начнет жить и покажет историю вашей пары.'
                        : 'Когда вы подключите партнера, главный экран станет пространством для двоих.'}
                    </p>

                    <div className="actions-row">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => onNavigate?.('settings')}
                      >
                        Открыть настройки
                      </button>
                    </div>
                  </InfoCard>
                )}
              </div>
            </div>
          </section>

          <div className="feature-grid">
            <FeatureCard
              badge="Раздел"
              title="Моменты"
              subtitle="Личная галерея ваших общих кадров и воспоминаний."
              onClick={() => onNavigate?.('moments')}
              icon={
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              }
            />

            <FeatureCard
              badge="Раздел"
              title="Письмо"
              subtitle="Теплое личное послание, которое хочется открыть вечером."
              onClick={() => onNavigate?.('letter')}
              icon={
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <polyline points="2,5 12,13 22,5" />
                </svg>
              }
            />

            <FeatureCard
              badge="Быстрый переход"
              title="Чат"
              subtitle="Открыть ваш диалог сразу с главного экрана."
              onClick={() => onNavigate?.('chat')}
              wide
              icon={
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              }
            />
          </div>

          <div className="section-row">
            <InfoCard eyebrow="Скоро" title="Ближайшее событие">
              {nextEvent ? (
                <div className="event-row">
                  <div className="event-line">
                    <div className="event-emoji">{nextEvent.emoji || '•'}</div>

                    <div className="event-copy">
                      <div className="event-name">{nextEvent.title}</div>
                      <div className="event-date">
                        {formatDate(nextEvent.event_date, {
                          day: 'numeric',
                          month: 'long',
                        })}
                      </div>
                    </div>

                    <div className="event-days">
                      {Math.max(
                        0,
                        Math.ceil(
                          (new Date(nextEvent.event_date) - new Date()) / 86400000
                        )
                      )}{' '}
                      дн
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => onNavigate?.('calendar')}
                  >
                    Открыть календарь
                  </button>
                </div>
              ) : (
                <div className="event-row">
                  <p className="note-text">
                    Добавьте красивое следующее событие: встречу, поездку, ужин или вашу
                    особенную дату.
                  </p>

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => onNavigate?.('calendar')}
                  >
                    Создать событие
                  </button>
                </div>
              )}
            </InfoCard>

            <InfoCard eyebrow="Отсчет" title="До встречи" compact>
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
                      {saving ? 'Сохраняю...' : 'Сохранить'}
                    </button>

                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setEditMeeting(false)}
                    >
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

                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setEditMeeting(true)}
                  >
                    Изменить
                  </button>
                </div>
              ) : (
                <div className="meeting-row">
                  <p className="note-text">
                    Добавьте следующую встречу, чтобы экран жил в ожидании.
                  </p>

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setEditMeeting(true)}
                  >
                    Указать дату
                  </button>
                </div>
              )}
            </InfoCard>
          </div>

          <InfoCard eyebrow="Личное" title="Ваше сообщение">
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
                    {saving ? 'Сохраняю...' : 'Сохранить'}
                  </button>

                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setEditMessage(false)}
                  >
                    Отмена
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="note-text">
                  <strong>"{loveMessage}"</strong>
                </p>

                <div className="actions-row">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setEditMessage(true)}
                  >
                    Редактировать
                  </button>

                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => onNavigate?.('clock')}
                  >
                    Часы любви
                  </button>
                </div>
              </>
            )}
          </InfoCard>
        </div>
      </div>

      {showPartnerModal && (
        <PartnerModal
          profile={partnerProfile}
          loading={partnerLoading}
          onClose={() => setShowPartnerModal(false)}
        />
      )}
    </>
  )
}
