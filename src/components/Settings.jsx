import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeToPush } from '../lib/push'
import { validateImageFile, toast } from '../lib/helpers'
import QRCode from 'qrcode'

const notifPermission = () =>
  typeof Notification !== 'undefined' ? Notification.permission : 'default'

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
function IcoBell() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  )
}
function IcoPersonFill() {
  return (
    <svg viewBox="0 0 40 40" width="44" height="44" fill="none">
      <circle cx="20" cy="16" r="8" fill="rgba(139,26,44,0.7)"/>
      <path d="M4 38c0-8.8 7.2-16 16-16s16 7.2 16 16" fill="rgba(139,26,44,0.5)"/>
    </svg>
  )
}

function getZodiac(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr), m = d.getMonth() + 1, day = d.getDate()
  if ((m===3&&day>=21)||(m===4&&day<=19)) return 'Овен ♈'
  if ((m===4&&day>=20)||(m===5&&day<=20)) return 'Телец ♉'
  if ((m===5&&day>=21)||(m===6&&day<=20)) return 'Близнецы ♊'
  if ((m===6&&day>=21)||(m===7&&day<=22)) return 'Рак ♋'
  if ((m===7&&day>=23)||(m===8&&day<=22)) return 'Лев ♌'
  if ((m===8&&day>=23)||(m===9&&day<=22)) return 'Дева ♍'
  if ((m===9&&day>=23)||(m===10&&day<=22)) return 'Весы ♎'
  if ((m===10&&day>=23)||(m===11&&day<=21)) return 'Скорпион ♏'
  if ((m===11&&day>=22)||(m===12&&day<=21)) return 'Стрелец ♐'
  if ((m===12&&day>=22)||(m===1&&day<=19)) return 'Козерог ♑'
  if ((m===1&&day>=20)||(m===2&&day<=18)) return 'Водолей ♒'
  return 'Рыбы ♓'
}
function formatBirthday(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

const THEMES = [
  { id: 'rose',      label: 'Роза',       h: 349, s: '59%' },
  { id: 'blush',     label: 'Румянец',    h: 340, s: '55%' },
  { id: 'cherry',    label: 'Вишня',      h: 349, s: '70%' },
  { id: 'plum',      label: 'Слива',      h: 330, s: '48%' },
  { id: 'iris',      label: 'Ирис',       h: 270, s: '52%' },
  { id: 'lavender',  label: 'Лаванда',    h: 258, s: '45%' },
  { id: 'sapphire',  label: 'Сапфир',     h: 220, s: '62%' },
  { id: 'ocean',     label: 'Океан',      h: 198, s: '65%' },
  { id: 'teal',      label: 'Бирюза',     h: 176, s: '60%' },
  { id: 'emerald',   label: 'Изумруд',    h: 148, s: '52%' },
  { id: 'bronze',    label: 'Бронза',     h: 28,  s: '58%' },
  { id: 'gold',      label: 'Золото',     h: 44,  s: '62%' },
  { id: 'copper',    label: 'Медь',       h: 18,  s: '60%' },
  { id: 'slate',     label: 'Грифель',    h: 218, s: '22%' },
  { id: 'sage',      label: 'Шалфей',     h: 150, s: '28%' },
  { id: 'graphite',  label: 'Графит',     h: 220, s: '10%' },
]

/* ── Partner Invite Section ── */
function PartnerSection({ profile }) {
  const [qrUrl, setQrUrl] = useState(null)
  const [showQR, setShowQR] = useState(false)
  const [copied, setCopied] = useState(false)
  const [partnerProfile, setPartnerProfile] = useState(null)
  const [inviteCode, setInviteCode] = useState(profile?.invite_code || null)

  // Резервная генерация invite_code (обычно код уже создан триггером БД).
  // Нижний регистр обязателен — все RPC ищут код через lower().
  useEffect(() => {
    if (!profile?.invite_code && profile?.id) {
      const code = Math.random().toString(36).slice(2, 10).toLowerCase()
      supabase.from('profiles').update({ invite_code: code }).eq('id', profile.id)
        .then(({ error }) => { if (!error) setInviteCode(code) })
    }
  }, [profile?.id, profile?.invite_code])

  const inviteLink = inviteCode
    ? `${window.location.origin}/?invite=${inviteCode}`
    : null

  useEffect(() => {
    if (profile?.partner_id) {
      supabase.from('profiles').select('name, avatar_url').eq('id', profile.partner_id).single()
        .then(({ data }) => setPartnerProfile(data))
    }
  }, [profile?.partner_id])

  useEffect(() => {
    if (inviteLink && showQR) {
      QRCode.toDataURL(inviteLink, {
        width: 200, margin: 1,
        color: { dark: '#C8334A', light: '#FDF5F6' },
      }).then(setQrUrl)
    }
  }, [inviteLink, showQR])

  async function copy() {
    await navigator.clipboard.writeText(inviteLink).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="settings-section">
      <div className="settings-section-title">Партнёр</div>

      {profile?.partner_id && partnerProfile ? (
        /* Партнёр подключён */
        <div style={{ padding: '12px 0 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', overflow: 'hidden',
              background: 'linear-gradient(135deg,#FBF0F2,#F2D0D6)', flexShrink: 0,
            }}>
              {partnerProfile.avatar_url
                ? <img src={partnerProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                    <svg viewBox="0 0 40 40" width="22" height="22" fill="none"><circle cx="20" cy="15" r="7" fill="#C8334A" opacity="0.6"/><path d="M4 38c0-8.8 7.2-16 16-16s16 7.2 16 16" fill="#C8334A" opacity="0.4"/></svg>
                  </div>
              }
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{partnerProfile.name}</div>
              <div style={{ fontSize: 12, color: 'var(--rose, #A8283C)' }}>Подключён</div>
            </div>
          </div>
        </div>
      ) : (
        /* Партнёр не подключён */
        <div style={{ paddingTop: 8 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
            Партнёр ещё не подключён. Поделись ссылкой или QR-кодом.
          </p>

          <div style={{
            background: 'var(--surface, #fff)', borderRadius: 10, padding: '10px 12px',
            fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, wordBreak: 'break-all',
            border: '0.5px solid var(--border, rgba(0,0,0,0.08))',
          }}>
            {inviteLink}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={copy} style={{
              flex: 1, padding: '10px 0', borderRadius: 10,
              border: '0.5px solid rgba(168,40,60,0.25)',
              background: copied ? 'rgba(168,40,60,0.07)' : 'transparent',
              color: 'var(--rose, #A8283C)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
              {copied ? '✓ Скопировано' : 'Скопировать'}
            </button>
            <button onClick={() => setShowQR(v => !v)} style={{
              flex: 1, padding: '10px 0', borderRadius: 10,
              border: '0.5px solid rgba(168,40,60,0.25)',
              background: showQR ? 'rgba(168,40,60,0.07)' : 'transparent',
              color: 'var(--rose, #A8283C)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
              QR-код
            </button>
            {navigator.share && (
              <button onClick={() => navigator.share({ title: 'Love App', url: inviteLink })} style={{
                flex: 1, padding: '10px 0', borderRadius: 10,
                border: 'none', background: 'var(--rose, #A8283C)',
                color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}>
                Поделиться
              </button>
            )}
          </div>

          {showQR && qrUrl && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <img src={qrUrl} alt="QR" style={{ width: 160, height: 160, borderRadius: 12 }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Settings({ session, profile, darkMode, toggleDarkMode, onProfileUpdate, onNavigate }) {
  const [name, setName] = useState(profile?.name || '')
  const [birthday, setBirthday] = useState(profile?.birthday || '')
  const [coupleStart, setCoupleStart] = useState(profile?.couple_start_date || '')
  const [loveMessage, setLoveMessage] = useState('')
  // Overwrite initial value with shared couples-table date once loaded
  useEffect(() => {
    if (!profile?.partner_id) return
    supabase
      .from('couples')
      .select('couple_start_date')
      .or(`user_a.eq.${session.user.id},user_b.eq.${session.user.id}`)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => { if (data?.couple_start_date) setCoupleStart(data.couple_start_date) })
  }, [session.user.id, profile?.partner_id])
  const [saving, setSaving] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [saved, setSaved] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null)
  const [activeTheme, setActiveTheme] = useState(() => localStorage.getItem('loveTheme') || 'rose')
  const [pushEnabled, setPushEnabled] = useState(() => notifPermission() === 'granted')
  const [pushLoading, setPushLoading] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    setPushEnabled(notifPermission() === 'granted')
  }, [])

  async function togglePush() {
    if (pushLoading) return
    setPushLoading(true)
    try {
      if (pushEnabled) {
        // Отписаться
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await sub.unsubscribe()
          await supabase.from('push_subscriptions').delete().eq('user_id', session.user.id)
        }
        setPushEnabled(false)
      } else {
        // Подписаться
        const result = await subscribeToPush(session.user.id)
        if (result) setPushEnabled(true)
        else if (notifPermission() === 'denied') toast.error('Уведомления заблокированы — разреши их в настройках браузера')
      }
    } catch (e) { console.error(e) }
    setPushLoading(false)
  }

  const loadLoveMessage = useCallback(async () => {
    if (!session?.user?.id) return
    const { data } = await supabase.from('couple_settings').select('love_message').eq('user_id', session.user.id).maybeSingle()
    if (data) setLoveMessage(data.love_message || '')
  }, [session?.user?.id])

  // Load love message on mount
  useEffect(() => { loadLoveMessage() }, [loadLoveMessage])

  async function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const fileErr = validateImageFile(file)
    if (fileErr) { toast.error(fileErr); return }
    setSavingAvatar(true)
    try {
      const ext = file.type.split('/')[1] || 'jpg'
      const path = `avatars/${session.user.id}.${ext}`
      const { error: upErr } = await supabase.storage.from('photos').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('photos').getPublicUrl(path)
      const url = data.publicUrl + '?t=' + Date.now()
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', session.user.id)
      setAvatarPreview(url)
      onProfileUpdate?.()
      toast.success('Фото обновлено')
    } catch (err) {
      toast.error('Не удалось загрузить фото')
      console.error(err)
    }
    setSavingAvatar(false)
  }

  async function saveProfile() {
    if (!name.trim()) { toast.error('Введи своё имя'); return }
    setSaving(true)

    if (profile?.partner_id) {
      // Paired: update name+birthday on profiles; couple_start_date goes to the shared
      // couples row so both partners always see the same value.
      const [profRes, dateRes] = await Promise.all([
        supabase.from('profiles').update({ name: name.trim(), birthday: birthday || null }).eq('id', session.user.id),
        supabase.rpc('set_couple_start_date', { p_date: coupleStart || null }),
      ])
      if (profRes.error || dateRes.error) {
        toast.error('Не удалось сохранить профиль')
      } else {
        onProfileUpdate?.()
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } else {
      // Not yet paired: no couples row — save everything including date to own profile
      const { error } = await supabase.from('profiles').update({
        name: name.trim(),
        birthday: birthday || null,
        couple_start_date: coupleStart || null,
      }).eq('id', session.user.id)
      if (error) {
        toast.error('Не удалось сохранить профиль')
      } else {
        onProfileUpdate?.()
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    }

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
    localStorage.setItem('loveH', theme.h)
    localStorage.setItem('loveS', theme.s)
    const r = document.documentElement
    r.style.setProperty('--h', theme.h)
    r.style.setProperty('--s', theme.s)
    const rose      = `hsl(${theme.h}, ${theme.s}, 41%)`
    const roseDark  = `hsl(${theme.h}, ${theme.s}, 28%)`
    const roseLight = `hsl(${theme.h}, ${theme.s}, 54%)`
    const gradient  = `linear-gradient(135deg, hsl(${theme.h},${theme.s},46%) 0%, hsl(${theme.h},${theme.s},30%) 100%)`
    r.style.setProperty('--rose',          rose)
    r.style.setProperty('--rose-dark',     roseDark)
    r.style.setProperty('--rose-light',    roseLight)
    r.style.setProperty('--primary',       rose)
    r.style.setProperty('--primary-dark',  roseDark)
    r.style.setProperty('--gradient',      gradient)
    r.style.setProperty('--gradient-warm', gradient)
    r.style.setProperty('--theme-gradient',gradient)
    r.style.setProperty('--theme-accent',  rose)
    r.style.setProperty('--gradient-main', gradient)
    r.style.setProperty('--bubble-mine',   `linear-gradient(135deg, hsl(${theme.h},${theme.s},49%) 0%, hsl(${theme.h},${theme.s},35%) 100%)`)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      'Удалить аккаунт?\n\nВсе ваши данные будут удалены безвозвратно. Это действие нельзя отменить.'
    )
    if (!confirmed) return
    const confirmed2 = window.confirm('Вы уверены? Восстановить данные будет невозможно.')
    if (!confirmed2) return

    try {
      // Вызываем серверную функцию — она удаляет все данные и auth-пользователя
      const { error } = await supabase.rpc('delete_user_account')
      if (error) throw error
      // Очищаем localStorage
      localStorage.clear()
      await supabase.auth.signOut()
    } catch (err) {
      alert('Ошибка при удалении: ' + (err.message || JSON.stringify(err)))
    }
  }

  const myName = profile?.name || 'Пользователь'

  return (
    <>
      <style>{`
        .settings-wrap { padding: 0 0 120px; }

        /* ── Header ── */
        .settings-header {
          background: linear-gradient(170deg, #0C0B09 0%, #151210 40%, #1C1510 100%);
          padding: 72px 20px 36px;
          border-radius: 0 0 32px 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 20px;
          overflow: hidden;
          position: relative;
        }
        .settings-header::before {
          content: '';
          position: absolute;
          top: -60px; left: 50%;
          transform: translateX(-50%);
          width: 280px; height: 240px;
          background: radial-gradient(ellipse, rgba(168,40,60,0.12) 0%, transparent 65%);
          pointer-events: none;
        }

        /* ── Avatar ring ── */
        .settings-av-ring {
          width: 110px; height: 110px;
          border-radius: 50%;
          padding: 2px;
          background: rgba(168,40,60,0.3);
          border: 0.5px solid rgba(168,40,60,0.2);
          position: relative; z-index: 1;
          flex-shrink: 0;
          margin-bottom: 16px;
        }
        .settings-av-gap {
          width: 100%; height: 100%;
          border-radius: 50%;
          background: #110D0B;
          padding: 2px;
        }
        .settings-avatar-wrap {
          position: relative;
          width: 100%; height: 100%;
        }
        .settings-avatar {
          width: 100%; height: 100%;
          border-radius: 50%;
          background: rgba(200,51,74,0.1);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .settings-avatar-btn {
          position: absolute;
          bottom: 2px; right: 2px;
          background: var(--rose, #A8283C);
          border: 2px solid #110D0B;
          border-radius: 50%;
          width: 28px; height: 28px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: white; z-index: 2;
        }
        .settings-header-name {
          font-family: var(--font-display);
          font-size: 26px; font-weight: 300; font-style: italic;
          color: rgba(237,233,226,0.9); margin-bottom: 4px;
          letter-spacing: 0.3px;
          position: relative; z-index: 1;
        }
        .settings-header-sub {
          font-family: var(--font-body);
          font-size: 12px;
          color: rgba(255,255,255,0.42);
          margin-bottom: 16px;
          position: relative; z-index: 1;
        }
        .settings-chips {
          display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;
          position: relative; z-index: 1;
        }
        .settings-chip {
          display: inline-flex; align-items: center; gap: 5px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: 20px;
          padding: 5px 14px;
          font-family: var(--font-body);
          font-size: 12px; font-weight: 500;
          color: rgba(255,255,255,0.78);
        }

        /* ── Sections ── */
        .settings-section {
          background: var(--surface, #fff);
          border-radius: 14px;
          margin: 0 16px 12px;
          overflow: hidden;
          border: 0.5px solid var(--border, rgba(0,0,0,0.07));
        }
        .settings-section-title {
          font-family: var(--font-body);
          font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 1.4px;
          color: var(--text-muted);
          padding: 16px 18px 8px;
        }
        .settings-row {
          display: flex; align-items: center;
          padding: 12px 16px; gap: 14px;
          border-top: 1px solid rgba(0,0,0,0.04);
        }
        .app.dark .settings-row { border-top-color: rgba(255,255,255,0.05); }
        .settings-row-icon {
          flex-shrink: 0;
          width: 36px; height: 36px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(168,40,60,0.07);
          border: 0.5px solid rgba(168,40,60,0.1);
          color: var(--rose, #A8283C);
        }
        .settings-row-label {
          flex: 1;
          font-family: var(--font-body);
          font-size: 15px; font-weight: 500;
          color: var(--text);
        }
        .settings-row-right {
          font-family: var(--font-body);
          font-size: 14px; color: var(--text-muted);
        }
        .settings-toggle {
          width: 50px; height: 28px;
          background: var(--rose, #C8334A);
          border-radius: 99px;
          position: relative; cursor: pointer; border: none; flex-shrink: 0;
          transition: background 0.2s;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
        }
        .settings-toggle.off { background: rgba(0,0,0,0.15); }
        .app.dark .settings-toggle.off { background: rgba(255,255,255,0.12); }
        .settings-toggle-thumb {
          position: absolute; top: 3px; left: 3px;
          width: 22px; height: 22px; border-radius: 50%;
          background: white;
          transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
          box-shadow: 0 1px 6px rgba(0,0,0,0.25);
        }
        .settings-toggle:not(.off) .settings-toggle-thumb { transform: translateX(22px); }

        /* ── Inputs ── */
        .settings-input {
          width: 100%; background: none; border: none;
          font-family: var(--font-body); font-size: 15px;
          color: var(--text); outline: none; text-align: right;
        }
        .settings-input::placeholder { color: var(--text-muted); }

        /* ── Themes ── */
        .themes-grid {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 12px; padding: 8px 16px 20px;
        }
        .theme-swatch { display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; }
        .theme-circle {
          width: 50px; height: 50px; border-radius: 50%;
          box-shadow: 0 2px 10px rgba(0,0,0,0.18);
          position: relative; transition: transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s;
          border: 2.5px solid transparent;
        }
        .theme-circle:active { transform: scale(0.94); }
        .theme-circle.active {
          transform: scale(1.12); border-color: white;
          box-shadow: 0 5px 22px rgba(0,0,0,0.32);
        }
        .theme-circle.active::after {
          content: ''; position: absolute; inset: 0; border-radius: 50%;
          background: url("data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolyline points='20 6 9 17 4 12' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/55% no-repeat;
        }
        .theme-label { font-family: var(--font-body); font-size: 10px; color: var(--text-muted); text-align: center; white-space: nowrap; }

        /* ── Save button ── */
        .settings-save-btn {
          display: block;
          width: calc(100% - 28px);
          margin: 0 14px 14px;
          background: var(--rose, #A8283C);
          color: white; border: none; border-radius: 14px;
          padding: 15px;
          font-family: var(--font-body); font-weight: 500; font-size: 15px;
          cursor: pointer; letter-spacing: 0.2px;
          transition: opacity 0.2s, transform 0.15s;
          box-shadow: 0 4px 16px hsl(var(--h,349), var(--s,59%), 41% / 0.3);
        }
        .settings-save-btn:active { transform: scale(0.98); opacity: 0.9; }
        .settings-save-btn:disabled { opacity: 0.5; box-shadow: none; }
        .settings-save-btn.saved { background: #2A7A4A; box-shadow: 0 4px 14px rgba(42,122,74,0.3); }

        /* ── Logout ── */
        .settings-logout-btn {
          display: block; width: calc(100% - 28px); margin: 0 14px;
          background: rgba(168,40,60,0.05);
          border: 0.5px solid rgba(168,40,60,0.2);
          color: var(--rose, #A8283C);
          border-radius: 14px; padding: 15px;
          font-family: var(--font-body); font-weight: 500; font-size: 15px;
          cursor: pointer; transition: background 0.15s;
        }
        .settings-logout-btn:active { background: rgba(168,40,60,0.1); }
        .settings-delete-btn {
          display: block; width: calc(100% - 28px); margin: 10px 14px 0;
          background: transparent; border: 0.5px solid rgba(150,20,20,0.2);
          color: rgba(160,40,40,0.8); border-radius: 14px; padding: 13px;
          font-family: var(--font-body); font-weight: 400; font-size: 13px;
          cursor: pointer; transition: background 0.15s;
        }
        .settings-delete-btn:active { background: rgba(180,20,20,0.06); }

        /* ── Dark mode ── */
        .app.dark .settings-section { background: rgba(22,18,14,0.95); border-color: rgba(255,255,255,0.06); }
        .app.dark .settings-row-label { color: rgba(237,233,226,0.85); }
        .app.dark .settings-input { color: rgba(237,233,226,0.85); }
      `}</style>

      <div className="settings-wrap">
        {/* ── Premium Header ── */}
        <div className="settings-header">
          <div className="settings-av-ring">
            <div className="settings-av-gap">
              <div className="settings-avatar-wrap">
                <div className="settings-avatar">
                  {avatarPreview
                    ? <img src={avatarPreview} alt={myName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : <IcoPersonFill />
                  }
                </div>
                <button className="settings-avatar-btn" onClick={() => fileRef.current?.click()} disabled={savingAvatar}>
                  {savingAvatar ? <IcoSpinner /> : <IcoCamera />}
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              </div>
            </div>
          </div>
          <div className="settings-header-name">{myName}</div>
          <div className="settings-header-sub">Нажми на фото, чтобы изменить</div>
          {birthday && (
            <div className="settings-chips">
              <div className="settings-chip">{getZodiac(birthday)}</div>
              <div className="settings-chip">{formatBirthday(birthday)}</div>
            </div>
          )}
        </div>

        {/* Разделы (вынесены из нижней панели для простоты) */}
        <div className="settings-section">
          <div className="settings-section-title">Разделы</div>
          {[
            ['advisor', 'Советник',   '🧭'],
            ['mirror',  'Вопрос дня', '❓'],
            ['premium', 'Premium',    '⭐'],
          ].map(([id, label, ic], i, arr) => (
            <button
              key={id}
              onClick={() => onNavigate?.(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '15px 2px', background: 'none', border: 'none',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', color: 'var(--text)', font: 'inherit', fontSize: 15,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ fontSize: 19, width: 26, textAlign: 'center' }}>{ic}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 22, lineHeight: 1 }}>›</span>
            </button>
          ))}
        </div>

        {/* Profile */}
        <div className="settings-section">
          <div className="settings-section-title">Профиль</div>
          <div className="settings-row">
            <span className="settings-row-icon" style={{ color: 'var(--rose, #A8283C)' }}><IcoUser /></span>
            <span className="settings-row-label">Имя</span>
            <input
              className="settings-input"
              placeholder="Твоё имя"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="settings-row">
            <span className="settings-row-icon" style={{ color: 'var(--rose, #A8283C)' }}><IcoBirthday /></span>
            <span className="settings-row-label">День рождения</span>
            <input
              className="settings-input"
              type="date"
              value={birthday}
              onChange={e => setBirthday(e.target.value)}
              style={{ width: '120px' }}
            />
          </div>
          <div className="settings-row">
            <span className="settings-row-icon" style={{ color: 'var(--rose, #A8283C)' }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
              </svg>
            </span>
            <span className="settings-row-label">Вместе с</span>
            <input
              className="settings-input"
              type="date"
              value={coupleStart}
              onChange={e => setCoupleStart(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
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
            <span className="settings-row-icon" style={{ color: 'var(--rose, #A8283C)' }}>{darkMode ? <IcoMoon /> : <IcoSun />}</span>
            <span className="settings-row-label">Тёмная тема</span>
            <button
              className={`settings-toggle${darkMode ? '' : ' off'}`}
              onClick={toggleDarkMode}
            >
              <div className="settings-toggle-thumb" />
            </button>
          </div>
          <div className="settings-row">
            <span className="settings-row-icon" style={{ color: 'var(--rose, #A8283C)' }}><IcoBell /></span>
            <span className="settings-row-label">Уведомления</span>
            <button
              className={`settings-toggle${pushEnabled ? '' : ' off'}`}
              onClick={togglePush}
              disabled={pushLoading}
              style={{ opacity: pushLoading ? 0.6 : 1 }}
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
                  style={{ background: `linear-gradient(135deg, hsl(${t.h},${t.s},46%), hsl(${t.h},${t.s},30%))` }}
                />
                <span className="theme-label">{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Partner invite */}
        <PartnerSection profile={profile} />

        {/* Logout */}
        <button className="settings-logout-btn" onClick={handleLogout}>
          Выйти из аккаунта
        </button>
        <button className="settings-delete-btn" onClick={handleDeleteAccount}>
          Удалить аккаунт
        </button>
      </div>
    </>
  )
}
