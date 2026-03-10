import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

/* ── Small SVG icons for settings rows ── */
function IcoUser() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
    </svg>
  )
}
function IcoBirthday() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="9" width="18" height="12" rx="2"/>
      <path d="M3 14h18"/>
      <path d="M8 9V7c0-1.1.9-2 2-2s2 .9 2 2v2"/>
      <path d="M14 9V7c0-1.1.9-2 2-2s2 .9 2 2v2"/>
    </svg>
  )
}
function IcoMoon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    </svg>
  )
}
function IcoSun() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}
function IcoCamera() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}
function IcoSpinner() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
    </svg>
  )
}
function IcoPersonFill() {
  return (
    <svg viewBox="0 0 40 40" width="44" height="44" fill="none">
      <circle cx="20" cy="16" r="8" fill="rgba(200,75,139,0.7)"/>
      <path d="M4 38c0-8.8 7.2-16 16-16s16 7.2 16 16" fill="rgba(200,75,139,0.5)"/>
    </svg>
  )
}

const THEMES = [
  { id: 'rose',      label: 'Роза',       a: '#E8466A', b: '#9C27B0' },
  { id: 'cherry',    label: 'Вишня',      a: '#AD1457', b: '#4A0072' },
  { id: 'violet',    label: 'Фиалка',     a: '#6A1B9A', b: '#1A0A2E' },
  { id: 'lavender',  label: 'Лаванда',    a: '#7E57C2', b: '#EC407A' },
  { id: 'ocean',     label: 'Океан',      a: '#0277BD', b: '#00838F' },
  { id: 'sky',       label: 'Небо',       a: '#039BE5', b: '#B388FF' },
  { id: 'forest',    label: 'Лес',        a: '#2E7D32', b: '#004D40' },
  { id: 'northern',  label: 'Сияние',     a: '#00C853', b: '#00BCD4' },
  { id: 'sunset',    label: 'Закат',      a: '#FF6F00', b: '#C62828' },
  { id: 'fire',      label: 'Огонь',      a: '#D50000', b: '#FF6D00' },
  { id: 'gold',      label: 'Золото',     a: '#F57F17', b: '#E65100' },
  { id: 'night',     label: 'Ночь',       a: '#1A237E', b: '#0D0D1A' },
]

export default function Settings({ session, profile, darkMode, toggleDarkMode, onProfileUpdate }) {
  const [name, setName] = useState(profile?.name || '')
  const [birthday, setBirthday] = useState(profile?.birthday || '')
  const [loveMessage, setLoveMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [saved, setSaved] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null)
  const [activeTheme, setActiveTheme] = useState(localStorage.getItem('loveTheme') || 'rose')
  const fileRef = useRef(null)

  async function loadLoveMessage() {
    if (!session?.user?.id) return
    const { data } = await supabase.from('couple_settings').select('love_message').eq('user_id', session.user.id).maybeSingle()
    if (data) setLoveMessage(data.love_message || '')
  }

  // Load on mount
  useState(() => { loadLoveMessage() })

  async function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setSavingAvatar(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${session.user.id}.${ext}`
      await supabase.storage.from('photos').upload(path, file, { upsert: true })
      const { data } = supabase.storage.from('photos').getPublicUrl(path)
      const url = data.publicUrl + '?t=' + Date.now()
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', session.user.id)
      setAvatarPreview(url)
      onProfileUpdate?.()
    } catch (err) { console.error(err) }
    setSavingAvatar(false)
  }

  async function saveProfile() {
    setSaving(true)
    await supabase.from('profiles').update({ name, birthday: birthday || null }).eq('id', session.user.id)
    onProfileUpdate?.()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  async function saveLoveMsg() {
    setSaving(true)
    const { data: ex } = await supabase.from('couple_settings').select('id').eq('user_id', session.user.id).maybeSingle()
    if (ex) await supabase.from('couple_settings').update({ love_message: loveMessage, updated_at: new Date().toISOString() }).eq('id', ex.id)
    else await supabase.from('couple_settings').insert({ user_id: session.user.id, love_message: loveMessage })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  function applyTheme(theme) {
    const gradient = `linear-gradient(135deg, ${theme.a} 0%, ${theme.b} 100%)`
    setActiveTheme(theme.id)
    localStorage.setItem('loveTheme', theme.id)
    localStorage.setItem('loveThemeData', JSON.stringify(theme))
    document.documentElement.style.setProperty('--primary', theme.a)
    document.documentElement.style.setProperty('--primary-dark', theme.b)
    document.documentElement.style.setProperty('--gradient', gradient)
    document.documentElement.style.setProperty('--gradient-warm', gradient)
    document.documentElement.style.setProperty('--theme-gradient', gradient)
    document.documentElement.style.setProperty('--theme-accent', theme.a)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const myName = profile?.name || 'Пользователь'

  return (
    <>
      <style>{`
        .settings-wrap { padding: 0 0 120px; }
        .settings-header {
          background: var(--theme-gradient, linear-gradient(160deg, #e8466a 0%, #c84b8b 50%, #9b4dca 100%));
          padding: 60px 20px 30px;
          border-radius: 0 0 32px 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 20px;
          box-shadow: 0 8px 32px rgba(200,75,139,0.3);
        }
        .settings-avatar-wrap {
          position: relative;
          margin-bottom: 12px;
        }
        .settings-avatar {
          width: 90px;
          height: 90px;
          border-radius: 50%;
          border: 3px solid rgba(255,255,255,0.6);
          box-shadow: 0 4px 20px rgba(0,0,0,0.25);
          background: rgba(255,255,255,0.15);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .settings-avatar-btn {
          position: absolute;
          bottom: -2px;
          right: -2px;
          background: white;
          border: none;
          border-radius: 50%;
          width: 30px; height: 30px;
          font-size: 14px;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .settings-header-name {
          font-family: var(--font-display);
          font-size: 20px;
          color: white;
          margin-bottom: 2px;
        }
        .settings-header-sub {
          font-family: var(--font-body);
          font-size: 13px;
          color: rgba(255,255,255,0.6);
        }

        /* Sections */
        .settings-section {
          background: var(--bg-card);
          border-radius: 20px;
          margin: 0 14px 14px;
          overflow: hidden;
          box-shadow: var(--shadow);
        }
        .settings-section-title {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: var(--text-muted);
          padding: 14px 16px 8px;
        }
        .settings-row {
          display: flex;
          align-items: center;
          padding: 13px 16px;
          gap: 12px;
          border-top: 1px solid rgba(0,0,0,0.04);
        }
        .app.dark .settings-row { border-top-color: rgba(255,255,255,0.05); }
        .settings-row-icon {
          flex-shrink: 0;
          width: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .settings-row-label {
          flex: 1;
          font-family: var(--font-body);
          font-size: 15px;
          font-weight: 500;
          color: var(--text);
        }
        .settings-row-right {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--text-muted);
        }
        .settings-toggle {
          width: 48px;
          height: 28px;
          background: var(--primary);
          border-radius: 99px;
          position: relative;
          cursor: pointer;
          border: none;
          flex-shrink: 0;
          transition: background 0.2s;
        }
        .settings-toggle.off { background: rgba(0,0,0,0.15); }
        .app.dark .settings-toggle.off { background: rgba(255,255,255,0.12); }
        .settings-toggle-thumb {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 22px; height: 22px;
          border-radius: 50%;
          background: white;
          transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
        }
        .settings-toggle:not(.off) .settings-toggle-thumb { transform: translateX(20px); }

        /* Input fields */
        .settings-input {
          width: 100%;
          background: none;
          border: none;
          font-family: var(--font-body);
          font-size: 15px;
          color: var(--text);
          outline: none;
          text-align: right;
        }
        .settings-input::placeholder { color: var(--text-muted); }

        /* Themes grid */
        .themes-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          padding: 8px 16px 16px;
        }
        .theme-swatch {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }
        .theme-circle {
          width: 52px; height: 52px;
          border-radius: 50%;
          box-shadow: 0 2px 10px rgba(0,0,0,0.18);
          position: relative;
          transition: transform 0.15s, box-shadow 0.15s;
          border: 3px solid transparent;
        }
        .theme-circle.active {
          transform: scale(1.12);
          border-color: white;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .theme-circle.active::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: url("data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolyline points='20 6 9 17 4 12' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/60% no-repeat;
        }
        .theme-label {
          font-family: var(--font-body);
          font-size: 10px;
          color: var(--text-muted);
          text-align: center;
          white-space: nowrap;
        }

        /* Save button */
        .settings-save-btn {
          display: block;
          width: calc(100% - 28px);
          margin: 0 14px 14px;
          background: linear-gradient(135deg, #e8466a, #c84b8b);
          color: white;
          border: none;
          border-radius: 16px;
          padding: 14px;
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(200,75,139,0.3);
        }
        .settings-save-btn:active { transform: scale(0.98); }
        .settings-save-btn.saved { background: linear-gradient(135deg, #22c55e, #16a34a); }

        /* Logout */
        .settings-logout-btn {
          display: block;
          width: calc(100% - 28px);
          margin: 0 14px;
          background: rgba(232,70,106,0.06);
          border: 1.5px solid rgba(232,70,106,0.2);
          color: var(--primary);
          border-radius: 16px;
          padding: 14px;
          font-family: var(--font-body);
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
        }

        /* dark */
        .app.dark .settings-section { background: #2A2540; }
        .app.dark .settings-row-label { color: #EDE4F0; }
        .app.dark .settings-input { color: #EDE4F0; }
      `}</style>

      <div className="settings-wrap">
        {/* Header / Avatar */}
        <div className="settings-header">
          <div className="settings-avatar-wrap">
            <div className="settings-avatar">
              {avatarPreview
                ? <img src={avatarPreview} alt={myName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : <IcoPersonFill />
              }
            </div>
            <button className="settings-avatar-btn" onClick={() => fileRef.current?.click()} disabled={savingAvatar} style={{ color: '#c84b8b' }}>
              {savingAvatar ? <IcoSpinner /> : <IcoCamera />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>
          <div className="settings-header-name">{myName}</div>
          <div className="settings-header-sub">Нажми на фото, чтобы изменить</div>
        </div>

        {/* Profile */}
        <div className="settings-section">
          <div className="settings-section-title">Профиль</div>
          <div className="settings-row">
            <span className="settings-row-icon" style={{ color: 'var(--primary)' }}><IcoUser /></span>
            <span className="settings-row-label">Имя</span>
            <input
              className="settings-input"
              placeholder="Твоё имя"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="settings-row">
            <span className="settings-row-icon" style={{ color: 'var(--primary)' }}><IcoBirthday /></span>
            <span className="settings-row-label">День рождения</span>
            <input
              className="settings-input"
              type="date"
              value={birthday}
              onChange={e => setBirthday(e.target.value)}
              style={{ width: '120px' }}
            />
          </div>
        </div>
        <button className="settings-save-btn" onClick={saveProfile} disabled={saving}>
          {saved ? 'Сохранено!' : saving ? 'Сохраняем...' : 'Сохранить профиль'}
        </button>

        {/* Love message */}
        <div className="settings-section">
          <div className="settings-section-title">Любовное послание</div>
          <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <textarea
              value={loveMessage}
              onChange={e => setLoveMessage(e.target.value)}
              placeholder="Напиши что-то прекрасное для партнёра..."
              style={{
                width: '100%',
                border: 'none',
                background: 'none',
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--text)',
                resize: 'none',
                minHeight: '80px',
                outline: 'none',
                lineHeight: 1.6,
              }}
            />
          </div>
        </div>
        <button className="settings-save-btn" onClick={saveLoveMsg} disabled={saving}>
          {saved ? 'Сохранено!' : saving ? 'Сохраняем...' : 'Сохранить послание'}
        </button>

        {/* Appearance */}
        <div className="settings-section">
          <div className="settings-section-title">Оформление</div>
          <div className="settings-row">
            <span className="settings-row-icon" style={{ color: 'var(--primary)' }}>{darkMode ? <IcoMoon /> : <IcoSun />}</span>
            <span className="settings-row-label">Тёмная тема</span>
            <button
              className={`settings-toggle${darkMode ? '' : ' off'}`}
              onClick={toggleDarkMode}
            >
              <div className="settings-toggle-thumb" />
            </button>
          </div>
        </div>

        {/* Themes */}
        <div className="settings-section">
          <div className="settings-section-title">Цветовая тема</div>
          <div className="themes-grid">
            {THEMES.map(t => (
              <div key={t.id} className="theme-swatch" onClick={() => applyTheme(t)}>
                <div
                  className={`theme-circle${activeTheme === t.id ? ' active' : ''}`}
                  style={{ background: `linear-gradient(135deg, ${t.a}, ${t.b})` }}
                />
                <span className="theme-label">{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Logout */}
        <button className="settings-logout-btn" onClick={handleLogout}>
          Выйти из аккаунта
        </button>
      </div>
    </>
  )
}
