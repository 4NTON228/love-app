
# Создаю улучшенный Home.jsx с 3D эффектами и Premium UI
home_jsx = '''import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const COUPLE_START = new Date('2025-10-17T00:00:00')

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
function getRelTime(start) {
  const now = new Date()
  const diff = now - start
  const totalDays = Math.floor(diff / 86400000)
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

function getAnniv(start) {
  const now = new Date()
  let next = new Date(start)
  next.setFullYear(now.getFullYear())
  if (next <= now) next.setFullYear(now.getFullYear() + 1)
  const daysUntil = Math.ceil((next - now) / 86400000)
  const daysPassed = Math.floor((now - start) / 86400000)
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

function localToUTC(s) { return s ? new Date(s).toISOString() : null }
function utcToLocal(s) {
  if (!s) return ''
  const d = new Date(s)
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const pad = n => String(n).padStart(2, '0')

/* ─────────────────────────────────────────
   Typewriter hook with cursor
───────────────────────────────────────── */
function useTypewriter(text, speed = 50) {
  const [out, setOut] = useState('')
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
   Ambient Background - Floating Orbs
───────────────────────────────────────── */
function AmbientBackground() {
  return (
    <div className="ambient-bg">
      <div className="ambient-orb orb-1" />
      <div className="ambient-orb orb-2" />
      <div className="ambient-orb orb-3" />
    </div>
  )
}

/* ─────────────────────────────────────────
   3D Avatar Component with Glass Ring
───────────────────────────────────────── */
function Avatar3D({ src, name, onClick }) {
  return (
    <div className="avatar-3d" onClick={onClick}>
      <div className="avatar-ring-glass" />
      <div className="avatar-inner">
        {src ? (
          <img src={src} alt={name} />
        ) : (
          <div style={{ 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #FFE4E8 0%, #FDF2F8 100%)'
          }}>
            <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
              <circle cx="20" cy="16" r="8" fill="rgba(232, 70, 106, 0.6)"/>
              <path d="M4 38c0-8.8 7.2-16 16-16s16 7.2 16 16" fill="rgba(232, 70, 106, 0.4)"/>
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   Animated Heart with Glow
───────────────────────────────────────── */
function HeartCenter() {
  return (
    <div className="heart-center">
      <svg width="60" height="56" viewBox="0 0 60 56" fill="none">
        <defs>
          <linearGradient id="heartGrad" x1="0" y1="0" x2="60" y2="56">
            <stop offset="0%" stopColor="#FF6B8A" />
            <stop offset="50%" stopColor="#FF2D55" />
            <stop offset="100%" stopColor="#D10043" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <path
          d="M30 52 C30 52 3 35 3 16 C3 8 9.5 2 18 2 C22.5 2 26.5 4.5 30 9 C33.5 4.5 37.5 2 42 2 C50.5 2 57 8 57 16 C57 35 30 52 30 52 Z"
          fill="url(#heartGrad)"
          filter="url(#glow)"
        />
        <path
          d="M16 9 C13 12 12 16 13 20"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  )
}

/* ─────────────────────────────────────────
   Glow Digit for Clock
───────────────────────────────────────── */
function GlowDigit({ value }) {
  return (
    <span className="clock-digit" style={{
      textShadow: '0 0 20px rgba(255,255,255,0.5), 0 0 40px rgba(232,70,106,0.3)'
    }}>
      {value}
    </span>
  )
}

/* ─────────────────────────────────────────
   MAIN HOME COMPONENT
───────────────────────────────────────── */
export default function Home({ session, profile, onNavigate }) {
  const [time, setTime] = useState(getRelTime(COUPLE_START))
  const [settings, setSettings] = useState(null)
  const [nextEvent, setNextEvent] = useState(null)
  const [countdown, setCountdown] = useState(null)
  const [partnerProfile, setPartnerProfile] = useState(null)
  const [editMsg, setEditMsg] = useState(false)
  const [editMeet, setEditMeet] = useState(false)
  const [newMsg, setNewMsg] = useState('')
  const [newMeet, setNewMeet] = useState('')
  const [saving, setSaving] = useState(false)

  const loveMsg = settings?.love_message || 'Ты — лучшее, что случилось в моей жизни'
  const { out, done } = useTypewriter(loveMsg, 45)

  // Live counter
  useEffect(() => {
    const id = setInterval(() => setTime(getRelTime(COUPLE_START)), 1000)
    return () => clearInterval(id)
  }, [])

  // Meeting countdown
  useEffect(() => {
    if (!settings?.next_meeting) { setCountdown(null); return }
    const tick = () => setCountdown(getTimeUntil(settings.next_meeting))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [settings?.next_meeting])

  // Load data
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
      const merged = { 
        love_message: my?.love_message || pt?.love_message || '', 
        next_meeting: lm 
      }
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

  const anniv = getAnniv(COUPLE_START)
  const myName = profile?.name || 'Антон'
  const pName = partnerProfile?.name || 'Эльвира'

  const actions = [
    { id: 'moments', label: 'Наши\\nмоменты', icon: '📸' },
    { id: 'letter', label: 'Написать\\nписьмо', icon: '💌' },
    { id: 'clock', label: 'Часы\\nлюбви', icon: '⏰' },
    { id: 'calendar', label: 'Наш\\nкалендарь', icon: '📅' },
  ]

  return (
    <>
      <AmbientBackground />
      
      <div className="home-wrap">
        {/* Hero Section */}
        <div className="home-hero">
          <div className="hero-avatars">
            <Avatar3D 
              src={profile?.avatar_url} 
              name={myName}
              onClick={() => onNavigate?.('settings')}
            />
            <HeartCenter />
            <Avatar3D 
              src={partnerProfile?.avatar_url} 
              name={pName}
              onClick={() => {}}
            />
          </div>

          {/* Day Counter */}
          <div className="day-counter">
            <div className="day-number">{time.totalDays}</div>
            <div className="day-label">
              {time.totalDays === 1 ? 'день' : time.totalDays < 5 ? 'дня' : 'дней'} вместе
            </div>

            <div className="day-breakdown">
              {time.years > 0 && (
                <div className="day-unit">
                  <span className="day-unit-value">{time.years}</span>
                  <span className="day-unit-label">лет</span>
                </div>
              )}
              <div className="day-unit">
                <span className="day-unit-value">{time.months}</span>
                <span className="day-unit-label">мес</span>
              </div>
              <div className="day-unit">
                <span className="day-unit-value">{time.days}</span>
                <span className="day-unit-label">дн</span>
              </div>
            </div>

            {/* Live Clock */}
            <div className="live-clock">
              <GlowDigit value={pad(time.hours)} />
              <span className="clock-separator">:</span>
              <GlowDigit value={pad(time.minutes)} />
              <span className="clock-separator">:</span>
              <GlowDigit value={pad(time.seconds)} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="home-content">
          {/* Love Message */}
          <div className="love-message-card animate-slide-up">
            {editMsg ? (
              <div>
                <textarea
                  className="form-textarea"
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  placeholder="Напиши что-то прекрасное..."
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: 'white',
                    borderRadius: '16px',
                    padding: '16px',
                    width: '100%',
                    minHeight: '100px',
                    fontSize: '16px',
                    fontFamily: 'var(--font-body)',
                    resize: 'none'
                  }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <button className="form-submit" onClick={saveMsg} disabled={saving}>
                    {saving ? '...' : 'Сохранить'}
                  </button>
                  <button 
                    onClick={() => setEditMsg(false)}
                    style={{
                      padding: '16px 24px',
                      borderRadius: '16px',
                      border: '1px solid rgba(255,255,255,0.3)',
                      background: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button className="love-edit-btn" onClick={() => setEditMsg(true)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/>
                  </svg>
                </button>
                <p className="love-text">
                  «{out}»{!done && <span className="cursor" style={{
                    display: 'inline-block',
                    width: '2px',
                    height: '1em',
                    background: 'rgba(255,255,255,0.8)',
                    marginLeft: '4px',
                    animation: 'blink 1s step-end infinite'
                  }}> </span>}
                </p>
              </>
            )}
          </div>

          {/* Quick Actions Grid */}
          <div className="action-grid">
            {actions.map((action, idx) => (
              <button 
                key={action.id} 
                className="action-card animate-slide-up"
                style={{ animationDelay: `${(idx + 1) * 0.1}s` }}
                onClick={() => onNavigate?.(action.id)}
              >
                <div className="action-icon">{action.icon}</div>
                <span className="action-label" style={{ whiteSpace: 'pre-line' }}>
                  {action.label}
                </span>
              </button>
            ))}
          </div>

          {/* Next Event Card */}
          {nextEvent && (
            <div className="glass-card animate-slide-up" style={{ padding: '20px', animationDelay: '0.5s' }}>
              <div style={{ 
                fontSize: '12px', 
                fontWeight: 700, 
                color: 'var(--text-muted)', 
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '12px'
              }}>
                Ближайшее событие
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  boxShadow: '0 4px 16px rgba(232, 70, 106, 0.3)'
                }}>
                  {nextEvent.emoji || '📅'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontWeight: 700, 
                    fontSize: '17px', 
                    color: 'var(--text)',
                    marginBottom: '4px'
                  }}>
                    {nextEvent.title}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-light)' }}>
                    {new Date(nextEvent.event_date).toLocaleDateString('ru-RU', { 
                      day: 'numeric', 
                      month: 'long' 
                    })}
                  </div>
                </div>
                <div style={{
                  background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(232, 70, 106, 0.3)'
                }}>
                  {Math.max(0, Math.ceil((new Date(nextEvent.event_date) - new Date()) / 86400000))} дн
                </div>
              </div>
            </div>
          )}

          {/* Meeting Countdown */}
          <div className="glass-card animate-slide-up" style={{ padding: '20px', animationDelay: '0.6s' }}>
            <div style={{ 
              fontSize: '12px', 
              fontWeight: 700, 
              color: 'var(--text-muted)', 
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '16px'
            }}>
              До встречи
            </div>
            
            {editMeet ? (
              <div>
                <input 
                  type="datetime-local" 
                  value={newMeet} 
                  onChange={e => setNewMeet(e.target.value)}
                  className="form-input"
                  style={{ marginBottom: '16px' }}
                />
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="form-submit" onClick={saveMeet} disabled={saving}>
                    {saving ? '...' : 'Сохранить'}
                  </button>
                  <button className="btn-ghost" onClick={() => setEditMeet(false)}>
                    Отмена
                  </button>
                </div>
              </div>
            ) : countdown ? (
              <>
                <div style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}>
                  {[
                    [countdown.days, 'дн'],
                    [pad(countdown.hours), 'ч'],
                    [pad(countdown.minutes), 'мин'],
                    [pad(countdown.seconds), 'сек']
                  ].map(([val, label]) => (
                    <div key={label} style={{
                      background: 'linear-gradient(135deg, rgba(232, 70, 106, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
                      borderRadius: '16px',
                      padding: '16px 20px',
                      textAlign: 'center',
                      minWidth: '70px'
                    }}>
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '28px',
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                      }}>
                        {val}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <button 
                    onClick={() => setEditMeet(true)}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '12px',
                      border: '1.5px solid rgba(232, 70, 106, 0.3)',
                      background: 'transparent',
                      color: 'var(--primary)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Изменить дату
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                  {settings?.next_meeting ? 'Время встречи прошло' : 'Когда ваша следующая встреча?'}
                </p>
                <button 
                  onClick={() => setEditMeet(true)}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '14px',
                    border: 'none',
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(232, 70, 106, 0.3)'
                  }}
                >
                  Установить дату
                </button>
              </div>
            )}
          </div>

          {/* Anniversary Progress */}
          <div className="glass-card animate-slide-up" style={{ 
            padding: '24px', 
            animationDelay: '0.7s',
            background: 'linear-gradient(135deg, rgba(232, 70, 106, 0.9) 0%, rgba(139, 92, 246, 0.9) 100%)',
            color: 'white'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ 
                fontSize: '14px', 
                opacity: 0.9,
                marginBottom: '8px',
                fontWeight: 600
              }}>
                Прогресс до годовщины
              </div>
              <div style={{ 
                fontFamily: 'var(--font-display)',
                fontSize: '36px',
                fontWeight: 700
              }}>
                {Math.round(anniv.progress)}%
              </div>
            </div>
            
            <div style={{
              height: '8px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '12px'
            }}>
              <div style={{
                height: '100%',
                width: `${anniv.progress}%`,
                background: 'linear-gradient(90deg, #fff 0%, rgba(255,255,255,0.8) 100%)',
                borderRadius: '4px',
                transition: 'width 1s ease',
                boxShadow: '0 0 20px rgba(255,255,255,0.5)'
              }} />
            </div>
            
            <div style={{ 
              textAlign: 'center', 
              fontSize: '13px', 
              opacity: 0.85,
              fontWeight: 500
            }}>
              {anniv.daysUntil === 0 ? '🎉 Сегодня годовщина!' : `Осталось ${anniv.daysUntil} дней до годовщины`}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
'''

with open('/mnt/kimi/output/glass-bloom-redesign/src/components/Home.jsx', 'w', encoding='utf-8') as f:
    f.write(home_jsx)

print("✅ Home.jsx создан с 3D эффектами и Premium UI!")
print("📊 Размер файла:", len(home_jsx), "символов")
