import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const COUPLE_START = new Date('2025-10-17T00:00:00')
const ANTON_ID = 'ab73068c-b71a-4a57-9fa0-867543f1a2b0'
const ELVIRA_ID = '6a9fee91-73c3-4deb-963f-78f758576479'

function getRelationshipTime(start) {
  const now = new Date()
  const diff = now - start
  const totalSec = Math.floor(diff / 1000)
  const totalDays = Math.floor(diff / (1000 * 60 * 60 * 24))
  const years = Math.floor(totalDays / 365)
  const months = Math.floor((totalDays % 365) / 30)
  const days = totalDays % 30
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  return { totalDays, years, months, days, hours, minutes, seconds }
}

function getNextAnniversary(start) {
  const now = new Date()
  let next = new Date(start)
  next.setFullYear(now.getFullYear())
  if (next <= now) next.setFullYear(now.getFullYear() + 1)
  const diff = next - now
  const totalDays = Math.ceil(diff / (1000 * 60 * 60 * 24))
  const daysPassed = Math.floor((now - start) / (1000 * 60 * 60 * 24))
  const yearDays = 365
  const progress = ((daysPassed % yearDays) / yearDays) * 100
  return { daysUntil: totalDays, progress: Math.min(progress, 100) }
}

function localToUTC(localDatetime) {
  if (!localDatetime) return null
  return new Date(localDatetime).toISOString()
}

function utcToLocalInput(utcString) {
  if (!utcString) return ''
  const d = new Date(utcString)
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16)
}

function getTimeUntil(targetDate) {
  if (!targetDate) return null
  const diff = new Date(targetDate) - new Date()
  if (diff <= 0) return null
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  }
}

function useTypewriter(text, speed = 60) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!text) return
    setDisplayed('')
    setDone(false)
    let i = 0
    const id = setInterval(() => {
      setDisplayed(text.slice(0, i + 1))
      i++
      if (i >= text.length) { clearInterval(id); setDone(true) }
    }, speed)
    return () => clearInterval(id)
  }, [text, speed])
  return { displayed, done }
}

export default function Home({ session, profile, onNavigate }) {
  const [time, setTime] = useState(getRelationshipTime(COUPLE_START))
  const [settings, setSettings] = useState(null)
  const [nextEvent, setNextEvent] = useState(null)
  const [countdown, setCountdown] = useState(null)
  const [partnerProfile, setPartnerProfile] = useState(null)
  const [editingMessage, setEditingMessage] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [newMeetingDate, setNewMeetingDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [floatingHearts, setFloatingHearts] = useState([])
  const heartRef = useRef(0)

  const loveMsg = settings?.love_message || 'Ты — лучшее, что случилось в моей жизни 💕'
  const { displayed, done } = useTypewriter(loveMsg, 55)

  // Парящие сердечки
  useEffect(() => {
    const spawn = () => {
      const id = heartRef.current++
      const size = 10 + Math.random() * 16
      const left = 5 + Math.random() * 90
      const dur = 5 + Math.random() * 5
      setFloatingHearts(h => [...h.slice(-14), { id, size, left, dur }])
    }
    const id = setInterval(spawn, 1200)
    return () => clearInterval(id)
  }, [])

  // Живой счётчик
  useEffect(() => {
    const id = setInterval(() => setTime(getRelationshipTime(COUPLE_START)), 1000)
    return () => clearInterval(id)
  }, [])

  const loadData = useCallback(async () => {
    if (!session?.user?.id) return
    const partnerId = profile?.partner_id

    // Загружаем профиль партнёра
    if (partnerId) {
      const { data } = await supabase.from('profiles').select('*').eq('id', partnerId).single()
      setPartnerProfile(data)
    }

    // Настройки
    const userIds = [session.user.id, partnerId].filter(Boolean)
    const { data: allSettings } = await supabase.from('couple_settings').select('*').in('user_id', userIds)
    if (allSettings?.length) {
      const my = allSettings.find(s => s.user_id === session.user.id)
      const partner = allSettings.find(s => s.user_id === partnerId)
      let latestMeeting = null, latestAt = null
      for (const s of allSettings) {
        if (s.next_meeting) {
          const at = new Date(s.updated_at || s.created_at || 0)
          if (!latestAt || at > latestAt) { latestMeeting = s.next_meeting; latestAt = at }
        }
      }
      const merged = {
        id: my?.id || null,
        love_message: my?.love_message || partner?.love_message || '',
        next_meeting: latestMeeting,
      }
      setSettings(merged)
      setNewMessage(merged.love_message)
      setNewMeetingDate(utcToLocalInput(merged.next_meeting))
    }

    // Ближайшее событие
    const today = new Date().toISOString().slice(0, 10)
    const { data: events } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(1)
    if (events?.length) setNextEvent(events[0])
  }, [session?.user?.id, profile?.partner_id])

  useEffect(() => { loadData() }, [loadData])

  // Таймер встречи
  useEffect(() => {
    if (!settings?.next_meeting) { setCountdown(null); return }
    const tick = () => setCountdown(getTimeUntil(settings.next_meeting))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [settings?.next_meeting])

  async function saveLoveMessage() {
    setSaving(true)
    const { data: ex } = await supabase.from('couple_settings').select('id').eq('user_id', session.user.id).maybeSingle()
    if (ex) await supabase.from('couple_settings').update({ love_message: newMessage, updated_at: new Date().toISOString() }).eq('id', ex.id)
    else await supabase.from('couple_settings').insert({ user_id: session.user.id, love_message: newMessage })
    setSettings(p => ({ ...p, love_message: newMessage }))
    setEditingMessage(false)
    setSaving(false)
  }

  async function saveNextMeeting() {
    setSaving(true)
    const utc = localToUTC(newMeetingDate)
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
    setEditingMeeting(false)
    setSaving(false)
  }

  const myName = profile?.name || 'Антон'
  const partnerName = partnerProfile?.name || 'Эльвира'
  const myAvatar = profile?.avatar_url
  const partnerAvatar = partnerProfile?.avatar_url
  const anniv = getNextAnniversary(COUPLE_START)

  const pad = n => String(n).padStart(2, '0')

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;1,400&family=Nunito:wght@400;500;600;700&display=swap');

        .home-wrap {
          min-height: 100%;
          padding: 0 0 120px;
          position: relative;
          overflow: hidden;
        }

        /* ---- Floating hearts ---- */
        .fh-layer {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }
        .fh {
          position: absolute;
          bottom: -60px;
          animation: floatUp linear forwards;
          opacity: 0.55;
          user-select: none;
          font-size: var(--fh-size);
        }
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1); opacity: 0.55; }
          80%  { opacity: 0.4; }
          100% { transform: translateY(-110vh) scale(0.6); opacity: 0; }
        }

        /* ---- Top banner ---- */
        .home-banner {
          background: linear-gradient(160deg, #e8466a 0%, #c84b8b 50%, #9b4dca 100%);
          border-radius: 0 0 36px 36px;
          padding: 60px 24px 36px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          position: relative;
          z-index: 1;
          box-shadow: 0 8px 40px rgba(200,75,139,0.35);
        }

        /* ---- Avatar row ---- */
        .avatar-row {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 28px;
        }
        .avatar-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .avatar-ring {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          padding: 3px;
          background: linear-gradient(135deg, #ff6b8a, #c84b8b, #9b4dca, #ff6b8a);
          background-size: 300% 300%;
          animation: gradShift 4s ease infinite;
        }
        @keyframes gradShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .avatar-inner {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: #fff;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
        }
        .avatar-inner img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .avatar-name {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 700;
          color: rgba(255,255,255,0.9);
          text-align: center;
        }

        /* ---- Centre heart ---- */
        .centre-heart {
          font-size: 32px;
          animation: pulse 1.4s ease-in-out infinite;
          filter: drop-shadow(0 0 12px rgba(255,100,150,0.7));
        }
        @keyframes pulse {
          0%,100% { transform: scale(1); }
          50%      { transform: scale(1.22); }
        }

        /* ---- Day counter ---- */
        .day-counter {
          text-align: center;
          color: white;
        }
        .day-number {
          font-family: var(--font-display);
          font-size: clamp(56px, 14vw, 80px);
          font-weight: 700;
          line-height: 1;
          letter-spacing: -2px;
          animation: countIn 0.6s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes countIn {
          from { opacity:0; transform: scale(0.7); }
          to   { opacity:1; transform: scale(1); }
        }
        .day-label {
          font-size: 18px;
          font-weight: 600;
          opacity: 0.85;
          margin-top: 2px;
          font-family: var(--font-body);
        }
        .day-breakdown {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-top: 10px;
          font-family: var(--font-body);
        }
        .day-unit {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .day-unit-val {
          font-size: 17px;
          font-weight: 700;
        }
        .day-unit-lbl {
          font-size: 10px;
          opacity: 0.65;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .live-clock {
          margin-top: 10px;
          font-family: 'Courier New', monospace;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 3px;
          opacity: 0.92;
          background: rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 6px 16px;
        }

        /* ---- Anniversary ring ---- */
        .anniv-wrap {
          margin-top: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .anniv-bar-bg {
          width: 220px;
          height: 10px;
          background: rgba(255,255,255,0.2);
          border-radius: 99px;
          overflow: hidden;
        }
        .anniv-bar-fill {
          height: 100%;
          border-radius: 99px;
          background: linear-gradient(90deg, #fff8b0, #ffd6e0, #fff);
          transition: width 1s ease;
        }
        .anniv-label {
          font-size: 12px;
          opacity: 0.75;
          font-family: var(--font-body);
          color: white;
        }

        /* ---- Content below banner ---- */
        .home-content {
          padding: 0 16px;
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-top: 18px;
        }

        /* ---- Cards ---- */
        .hcard {
          background: var(--bg-card);
          border-radius: 20px;
          padding: 18px 20px;
          box-shadow: var(--shadow);
          animation: slideUp 0.4s ease both;
        }
        @keyframes slideUp {
          from { opacity:0; transform: translateY(20px); }
          to   { opacity:1; transform: translateY(0); }
        }
        .hcard-title {
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-muted);
          margin-bottom: 10px;
        }

        /* ---- Love message ---- */
        .love-msg-card {
          background: linear-gradient(135deg, #e8466a 0%, #c84b8b 60%, #9b4dca 100%);
          border-radius: 20px;
          padding: 20px;
          color: white;
          position: relative;
          box-shadow: 0 6px 30px rgba(200,75,139,0.3);
          animation: slideUp 0.5s 0.1s ease both;
        }
        .love-msg-text {
          font-family: var(--font-display);
          font-style: italic;
          font-size: clamp(15px, 4vw, 18px);
          line-height: 1.55;
          min-height: 48px;
        }
        .love-msg-cursor {
          display: inline-block;
          width: 2px;
          height: 1em;
          background: rgba(255,255,255,0.8);
          margin-left: 2px;
          vertical-align: text-bottom;
          animation: blink 0.9s step-end infinite;
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .love-msg-edit {
          position: absolute;
          top: 12px; right: 12px;
          background: rgba(255,255,255,0.2);
          border: none;
          border-radius: 50%;
          width: 32px; height: 32px;
          color: white;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .love-msg-edit:active { background: rgba(255,255,255,0.35); }
        .love-msg-textarea {
          width: 100%;
          background: rgba(255,255,255,0.15);
          border: 2px solid rgba(255,255,255,0.4);
          border-radius: 12px;
          color: white;
          font-family: var(--font-body);
          font-size: 15px;
          padding: 10px 12px;
          resize: none;
          min-height: 80px;
          outline: none;
        }
        .love-msg-textarea::placeholder { color: rgba(255,255,255,0.5); }

        /* ---- Meeting timer ---- */
        .meeting-values {
          display: flex;
          gap: 10px;
          justify-content: center;
        }
        .meeting-unit {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: linear-gradient(135deg, #ffeef2, #ffe0ea);
          border-radius: 14px;
          padding: 10px 14px;
          min-width: 56px;
        }
        .meeting-num {
          font-family: var(--font-display);
          font-size: 26px;
          font-weight: 700;
          color: #c84b8b;
          line-height: 1;
        }
        .meeting-lbl {
          font-size: 10px;
          color: var(--text-muted);
          font-family: var(--font-body);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 2px;
        }

        /* ---- Next event ---- */
        .next-event-card {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .next-event-emoji {
          font-size: 34px;
          flex-shrink: 0;
        }
        .next-event-info { flex: 1; min-width: 0; }
        .next-event-title {
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 15px;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .next-event-date {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .next-event-badge {
          background: linear-gradient(135deg, #e8466a, #c84b8b);
          color: white;
          border-radius: 12px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 700;
          font-family: var(--font-body);
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* ---- Action buttons row ---- */
        .home-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .home-action-btn {
          background: var(--bg-card);
          border: 2px solid transparent;
          border-radius: 18px;
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          box-shadow: var(--shadow);
          transition: transform 0.15s, box-shadow 0.15s;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
        }
        .home-action-btn:active { transform: scale(0.95); box-shadow: none; }
        .home-action-btn .icon { font-size: 28px; }

        /* ---- Form buttons ---- */
        .btn-primary {
          background: linear-gradient(135deg, #e8466a, #c84b8b);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 10px 20px;
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
        }
        .btn-ghost {
          background: rgba(0,0,0,0.05);
          color: var(--text-muted);
          border: none;
          border-radius: 12px;
          padding: 10px 20px;
          font-family: var(--font-body);
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
        }
        .btn-sm-outline {
          background: transparent;
          border: 1.5px solid rgba(200,75,139,0.35);
          color: #c84b8b;
          border-radius: 10px;
          padding: 6px 14px;
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 8px;
        }

        /* dark mode extras */
        .app.dark .hcard { background: #2A2540; }
        .app.dark .meeting-unit { background: rgba(200,75,139,0.12); }
        .app.dark .meeting-num { color: #f7a8c4; }
        .app.dark .home-action-btn { background: #2A2540; color: #EDE4F0; }
        .app.dark .next-event-title { color: #EDE4F0; }
        .app.dark .btn-ghost { background: rgba(255,255,255,0.08); color: #9A8098; }
        .app.dark .btn-sm-outline { border-color: rgba(247,168,196,0.3); color: #f7a8c4; }
        .app.dark .anniv-bar-bg { background: rgba(255,255,255,0.12); }
      `}</style>

      {/* Floating hearts layer */}
      <div className="fh-layer">
        {floatingHearts.map(h => (
          <span
            key={h.id}
            className="fh"
            style={{
              '--fh-size': `${h.size}px`,
              left: `${h.left}%`,
              animationDuration: `${h.dur}s`,
            }}
          >
            {['❤️','🩷','💕','💗','💖'][Math.floor(h.size * 5) % 5]}
          </span>
        ))}
      </div>

      <div className="home-wrap">
        {/* ===== HERO BANNER ===== */}
        <div className="home-banner">
          {/* Avatars */}
          <div className="avatar-row">
            <div className="avatar-wrap">
              <div className="avatar-ring">
                <div className="avatar-inner">
                  {myAvatar ? <img src={myAvatar} alt={myName} /> : '👤'}
                </div>
              </div>
              <span className="avatar-name">{myName}</span>
            </div>

            <div className="centre-heart">❤️</div>

            <div className="avatar-wrap">
              <div className="avatar-ring">
                <div className="avatar-inner">
                  {partnerAvatar ? <img src={partnerAvatar} alt={partnerName} /> : '👤'}
                </div>
              </div>
              <span className="avatar-name">{partnerName}</span>
            </div>
          </div>

          {/* Day counter */}
          <div className="day-counter">
            <div className="day-number">{time.totalDays}</div>
            <div className="day-label">
              {time.totalDays === 1 ? 'день' : time.totalDays < 5 ? 'дня' : 'дней'} вместе
            </div>
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
            <div className="live-clock">
              {pad(time.hours)}:{pad(time.minutes)}:{pad(time.seconds)}
            </div>
          </div>

          {/* Anniversary progress */}
          <div className="anniv-wrap">
            <div className="anniv-bar-bg">
              <div className="anniv-bar-fill" style={{ width: `${anniv.progress}%` }} />
            </div>
            <span className="anniv-label">
              {anniv.daysUntil === 0
                ? '🎉 Сегодня годовщина!'
                : `До годовщины ${anniv.daysUntil} дн — ${Math.round(anniv.progress)}%`}
            </span>
          </div>
        </div>

        {/* ===== CONTENT ===== */}
        <div className="home-content">

          {/* Love message */}
          <div className="love-msg-card" style={{ animationDelay: '0s' }}>
            {editingMessage ? (
              <div>
                <textarea
                  className="love-msg-textarea"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Напиши что-то прекрасное..."
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn-primary" onClick={saveLoveMessage} disabled={saving}>
                    {saving ? '💕' : 'Сохранить'}
                  </button>
                  <button className="btn-ghost" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }} onClick={() => setEditingMessage(false)}>
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button className="love-msg-edit" onClick={() => setEditingMessage(true)}>✏️</button>
                <p className="love-msg-text">
                  «{displayed}»{!done && <span className="love-msg-cursor" />}
                </p>
              </>
            )}
          </div>

          {/* Quick actions */}
          <div className="home-actions">
            <button className="home-action-btn" onClick={() => onNavigate?.('moments')}>
              <span className="icon">📸</span>
              Наши моменты
            </button>
            <button className="home-action-btn" onClick={() => onNavigate?.('letter')}>
              <span className="icon">💌</span>
              Написать письмо
            </button>
            <button className="home-action-btn" onClick={() => onNavigate?.('clock')}>
              <span className="icon">⏱️</span>
              Часы любви
            </button>
            <button className="home-action-btn" onClick={() => onNavigate?.('calendar')}>
              <span className="icon">📅</span>
              Календарь
            </button>
          </div>

          {/* Next event */}
          {nextEvent && (
            <div className="hcard" style={{ animationDelay: '0.15s' }}>
              <div className="hcard-title">Ближайшее событие</div>
              <div className="next-event-card">
                <span className="next-event-emoji">{nextEvent.emoji || '📅'}</span>
                <div className="next-event-info">
                  <div className="next-event-title">{nextEvent.title}</div>
                  <div className="next-event-date">
                    {new Date(nextEvent.event_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                  </div>
                </div>
                <div className="next-event-badge">
                  {Math.max(0, Math.ceil((new Date(nextEvent.event_date) - new Date()) / (1000 * 60 * 60 * 24)))} дн
                </div>
              </div>
            </div>
          )}

          {/* Meeting countdown */}
          <div className="hcard" style={{ animationDelay: '0.2s' }}>
            <div className="hcard-title">⏰ До встречи</div>
            {editingMeeting ? (
              <div>
                <input
                  type="datetime-local"
                  value={newMeetingDate}
                  onChange={e => setNewMeetingDate(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', border: '2px solid var(--secondary)',
                    borderRadius: '12px', fontFamily: 'var(--font-body)', fontSize: '14px',
                    background: 'var(--bg)', color: 'var(--text)', marginBottom: '10px'
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" onClick={saveNextMeeting} disabled={saving}>
                    {saving ? '...' : 'Сохранить'}
                  </button>
                  <button className="btn-ghost" onClick={() => setEditingMeeting(false)}>Отмена</button>
                </div>
              </div>
            ) : countdown ? (
              <>
                <div className="meeting-values">
                  <div className="meeting-unit">
                    <div className="meeting-num">{countdown.days}</div>
                    <div className="meeting-lbl">дн</div>
                  </div>
                  <div className="meeting-unit">
                    <div className="meeting-num">{pad(countdown.hours)}</div>
                    <div className="meeting-lbl">ч</div>
                  </div>
                  <div className="meeting-unit">
                    <div className="meeting-num">{pad(countdown.minutes)}</div>
                    <div className="meeting-lbl">мин</div>
                  </div>
                  <div className="meeting-unit">
                    <div className="meeting-num">{pad(countdown.seconds)}</div>
                    <div className="meeting-lbl">сек</div>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <button className="btn-sm-outline" onClick={() => setEditingMeeting(true)}>Изменить</button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 8 }}>
                  {settings?.next_meeting ? 'Время встречи прошло 💕' : 'Когда ваша следующая встреча?'}
                </p>
                <button className="btn-sm-outline" onClick={() => setEditingMeeting(true)}>
                  Установить дату
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
