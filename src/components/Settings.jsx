import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const THEMES = [
  { id: 'rose',    label: 'Роза',      a: '#e8466a', b: '#c84b8b' },
  { id: 'purple',  label: 'Лаванда',   a: '#9b4dca', b: '#6d28d9' },
  { id: 'sunset',  label: 'Закат',     a: '#f97316', b: '#ec4899' },
  { id: 'ocean',   label: 'Океан',     a: '#0ea5e9', b: '#6366f1' },
  { id: 'forest',  label: 'Лес',       a: '#22c55e', b: '#059669' },
  { id: 'cherry',  label: 'Вишня',     a: '#be123c', b: '#9f1239' },
  { id: 'gold',    label: 'Золото',    a: '#f59e0b', b: '#d97706' },
  { id: 'night',   label: 'Ночь',      a: '#1e1b4b', b: '#312e81' },
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
    setActiveTheme(theme.id)
    localStorage.setItem('loveTheme', theme.id)
    document.documentElement.style.setProperty('--primary', theme.a)
    document.documentElement.style.setProperty('--primary-dark', theme.b)
    document.documentElement.style.setProperty('--gradient', `linear-gradient(135deg, ${theme.a} 0%, ${theme.b} 100%)`)
    document.documentElement.style.setProperty('--gradient-warm', `linear-gradient(135deg, ${theme.a} 0%, ${theme.b} 100%)`)
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
          background: linear-gradient(160deg, #e8466a 0%, #c84b8b 50%, #9b4dca 100%);
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
          object-fit: cover;
          border: 3px solid rgba(255,255,255,0.6);
          box-shadow: 0 4px 20px rgba(0,0,0,0.25);
          display: block;
          background: rgba(255,255,255,0.2);
          font-size: 40px;
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
          font-size: 22px;
          flex-shrink: 0;
          width: 34px;
          text-align: center;
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
          gap: 10px;
          padding: 8px 16px 16px;
        }
        .theme-swatch {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          cursor: pointer;
        }
        .theme-circle {
          width: 42px; height: 42px;
          border-radius: 50%;
          box-shadow: 0 2px 10px rgba(0,0,0,0.15);
          position: relative;
          transition: transform 0.15s;
        }
        .theme-circle.active {
          transform: scale(1.15);
          box-shadow: 0 4px 16px rgba(0,0,0,0.25);
        }
        .theme-circle.active::after {
          content: '✓';
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 16px;
          font-weight: 700;
        }
        .theme-label {
          font-family: var(--font-body);
          font-size: 10px;
          color: var(--text-muted);
          text-align: center;
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
              {avatarPreview ? (
                <img src={avatarPreview} alt={myName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : '👤'}
            </div>
            <button className="settings-avatar-btn" onClick={() => fileRef.current?.click()} disabled={savingAvatar}>
              {savingAvatar ? '⏳' : '📷'}
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
            <span className="settings-row-icon">👤</span>
            <span className="settings-row-label">Имя</span>
            <input
              className="settings-input"
              placeholder="Твоё имя"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="settings-row">
            <span className="settings-row-icon">🎂</span>
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
          {saved ? '✓ Сохранено!' : saving ? 'Сохраняем...' : 'Сохранить профиль'}
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
          {saved ? '✓ Сохранено!' : saving ? 'Сохраняем...' : 'Сохранить послание 💌'}
        </button>

        {/* Appearance */}
        <div className="settings-section">
          <div className="settings-section-title">Оформление</div>
          <div className="settings-row">
            <span className="settings-row-icon">{darkMode ? '🌙' : '☀️'}</span>
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
