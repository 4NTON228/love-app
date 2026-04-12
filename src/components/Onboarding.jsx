/**
 * Onboarding — многошаговый мастер настройки профиля
 * Показывается при первом входе (profile.onboarding_done = false)
 *
 * Шаги:
 * 1. Приветствие
 * 2. Имя + аватар
 * 3. День рождения
 * 4. Дата начала отношений
 * 5. Подключение партнёра (QR/ссылка ИЛИ ввод кода)
 */
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import QRCode from 'qrcode'

const TOTAL_STEPS = 5

/* ── Утилиты ── */
function pad(n) { return String(n).padStart(2, '0') }

/* ── Компонент шага прогресса ── */
function StepDots({ step }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 32 }}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div key={i} style={{
          width: i === step ? 24 : 8,
          height: 8,
          borderRadius: 99,
          background: i <= step ? '#C8334A' : 'rgba(200,51,74,0.15)',
          transition: 'all 0.3s',
        }} />
      ))}
    </div>
  )
}

/* ── Кнопка «Далее» ── */
function NextBtn({ onClick, label = 'Далее', disabled = false, loading = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: '100%', padding: '15px', border: 'none', borderRadius: 16,
        background: disabled ? 'rgba(200,51,74,0.2)' : 'linear-gradient(135deg,#C8334A,#8B1A2C)',
        color: disabled ? 'rgba(200,51,74,0.5)' : 'white',
        fontSize: 16, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 6px 24px rgba(200,51,74,0.35)',
        transition: 'all 0.2s',
      }}
    >
      {loading ? 'Сохраняем...' : label}
    </button>
  )
}

/* ── Шаг 1: Приветствие ── */
function StepWelcome({ onNext }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 40 }}>
      <div style={{ fontSize: 80, marginBottom: 24, animation: 'heartbeat 1.5s ease-in-out infinite' }}>
        <svg viewBox="0 0 60 56" width="90" height="84" fill="none" style={{ display: 'inline-block' }}>
          <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z"
            fill="url(#wlcGrad)" />
          <defs>
            <linearGradient id="wlcGrad" x1="0" y1="0" x2="60" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E8556A"/>
              <stop offset="100%" stopColor="#C8334A"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <h1 style={{
        fontFamily: 'var(--font-display)', fontSize: 36, fontStyle: 'italic',
        color: '#C8334A', marginBottom: 12,
      }}>Добро пожаловать!</h1>
      <p style={{
        fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.6,
        marginBottom: 40, maxWidth: 280, margin: '0 auto 40px',
      }}>
        Love App — личное пространство для вас двоих.<br />
        Давай настроим всё за пару минут.
      </p>
      <NextBtn onClick={onNext} label="Начать →" />
    </div>
  )
}

/* ── Шаг 2: Имя + Аватар ── */
function StepProfile({ value, onChange, onNext }) {
  const fileRef = useRef()
  const [avatarPreview, setAvatarPreview] = useState(value.avatar_url || null)
  const [uploading, setUploading] = useState(false)

  async function handleAvatar(e) {
    const file = e.target.files[0]
    if (!file) return
    setAvatarPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${Date.now()}.${ext}`
      await supabase.storage.from('photos').upload(path, file, { upsert: true })
      const { data } = supabase.storage.from('photos').getPublicUrl(path)
      onChange({ ...value, avatar_url: data.publicUrl, _avatarFile: file })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text)', marginBottom: 8 }}>
        Расскажи о себе
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>Партнёр увидит это в приложении</p>

      {/* Аватар */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            width: 100, height: 100, borderRadius: '50%', cursor: 'pointer',
            background: avatarPreview ? 'none' : 'linear-gradient(135deg,#FBF0F2,#F2D0D6)',
            border: '3px solid rgba(200,51,74,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', position: 'relative',
            boxShadow: '0 4px 20px rgba(200,51,74,0.15)',
          }}
        >
          {avatarPreview
            ? <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (
              <div style={{ textAlign: 'center' }}>
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#C8334A" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <div style={{ fontSize: 10, color: '#C8334A', marginTop: 2 }}>Фото</div>
              </div>
            )
          }
          {uploading && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(200,51,74,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
            }}>
              <div style={{ width: 20, height: 20, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatar} />
      </div>

      {/* Имя */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Твоё имя
        </label>
        <input
          type="text"
          placeholder="Как тебя зовут?"
          value={value.name || ''}
          onChange={e => onChange({ ...value, name: e.target.value })}
          style={{
            width: '100%', padding: '13px 16px', borderRadius: 14,
            border: '1.5px solid rgba(200,51,74,0.15)',
            background: 'var(--surface-2, #FDF5F6)',
            fontSize: 16, color: 'var(--text)', outline: 'none',
          }}
        />
      </div>

      <NextBtn onClick={onNext} disabled={!value.name?.trim()} />
    </div>
  )
}

/* ── Шаг 3: День рождения ── */
function StepBirthday({ value, onChange, onNext, onSkip }) {
  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text)', marginBottom: 8 }}>
        День рождения
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>
        Партнёр сможет не забыть поздравить тебя
      </p>

      <div style={{ marginBottom: 28 }}>
        <input
          type="date"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 14,
            border: '1.5px solid rgba(200,51,74,0.15)',
            background: 'var(--surface-2, #FDF5F6)',
            fontSize: 16, color: 'var(--text)', outline: 'none',
          }}
        />
      </div>

      <NextBtn onClick={onNext} disabled={!value} />
      <button onClick={onSkip} style={{
        width: '100%', padding: 12, marginTop: 10, border: 'none',
        background: 'none', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer',
      }}>
        Пропустить
      </button>
    </div>
  )
}

/* ── Шаг 4: Дата начала отношений ── */
function StepRelationship({ value, onChange, onNext, onSkip }) {
  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text)', marginBottom: 8 }}>
        Когда вы вместе?
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>
        Дата начала ваших отношений — приложение будет считать дни вместе
      </p>

      <div style={{ marginBottom: 28 }}>
        <input
          type="date"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 14,
            border: '1.5px solid rgba(200,51,74,0.15)',
            background: 'var(--surface-2, #FDF5F6)',
            fontSize: 16, color: 'var(--text)', outline: 'none',
          }}
        />
      </div>

      {value && (
        <div style={{
          background: 'rgba(200,51,74,0.06)', borderRadius: 14, padding: '14px 16px',
          fontSize: 14, color: '#C8334A', textAlign: 'center', marginBottom: 20,
        }}>
          {Math.floor((new Date() - new Date(value)) / 86400000)} дней вместе
        </div>
      )}

      <NextBtn onClick={onNext} disabled={!value} />
      <button onClick={onSkip} style={{
        width: '100%', padding: 12, marginTop: 10, border: 'none',
        background: 'none', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer',
      }}>
        Указать позже
      </button>
    </div>
  )
}

/* ── Шаг 5: Подключение партнёра ── */
function StepPartner({ session, inviteCode, partnerAlreadyLinked, onFinish }) {
  const [mode, setMode] = useState('invite')  // 'invite' | 'enter'
  const [code, setCode] = useState('')
  const [qrUrl, setQrUrl] = useState(null)
  const [foundPartner, setFoundPartner] = useState(null)
  const [searching, setSearching] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const inviteLink = `${window.location.origin}/?invite=${inviteCode}`

  useEffect(() => {
    if (!inviteCode) return
    QRCode.toDataURL(inviteLink, {
      width: 220, margin: 1,
      color: { dark: '#C8334A', light: '#FDF5F6' },
    }).then(setQrUrl)
  }, [inviteCode, inviteLink])

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function searchPartner() {
    if (code.trim().length < 4) return
    setSearching(true); setError(null); setFoundPartner(null)
    const { data, error: err } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .eq('invite_code', code.trim().toLowerCase())
      .single()
    if (err || !data) setError('Профиль не найден. Проверь код.')
    else if (data.id === session.user.id) setError('Это твой собственный код.')
    else setFoundPartner(data)
    setSearching(false)
  }

  async function connectPartner() {
    if (!foundPartner) return
    setConnecting(true)
    try {
      // Обновляем оба профиля
      await supabase.from('profiles').update({ partner_id: foundPartner.id }).eq('id', session.user.id)
      await supabase.from('profiles').update({ partner_id: session.user.id }).eq('id', foundPartner.id)
      onFinish()
    } catch (e) {
      setError('Ошибка подключения. Попробуй снова.')
      setConnecting(false)
    }
  }

  if (partnerAlreadyLinked) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 20 }}>
        <div style={{ fontSize: 60, marginBottom: 16 }}>
          <svg viewBox="0 0 60 56" width="70" height="65" fill="none">
            <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z" fill="#C8334A"/>
          </svg>
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--text)', marginBottom: 8 }}>
          Партнёр уже подключён!
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>Всё готово к использованию</p>
        <NextBtn onClick={onFinish} label="Открыть приложение →" />
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text)', marginBottom: 8 }}>
        Пригласи партнёра
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
        Приложение работает только для пары — пригласи своего человека
      </p>

      {/* Переключатель */}
      <div style={{
        display: 'flex', gap: 0, background: 'rgba(200,51,74,0.07)',
        borderRadius: 12, padding: 3, marginBottom: 24,
      }}>
        {[['invite', 'Моя ссылка'], ['enter', 'Ввести код']].map(([m, l]) => (
          <button key={m}
            onClick={() => { setMode(m); setError(null); setFoundPartner(null) }}
            style={{
              flex: 1, padding: '9px 0', border: 'none', borderRadius: 10,
              background: mode === m ? 'white' : 'transparent',
              color: mode === m ? '#C8334A' : 'var(--text-muted)',
              fontWeight: mode === m ? 700 : 400, fontSize: 14, cursor: 'pointer',
              boxShadow: mode === m ? '0 2px 8px rgba(200,51,74,0.1)' : 'none',
              transition: 'all 0.2s',
            }}
          >{l}</button>
        ))}
      </div>

      {/* Режим: показать свою ссылку/QR */}
      {mode === 'invite' && (
        <div>
          {qrUrl && (
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <img src={qrUrl} alt="QR код" style={{ width: 180, height: 180, borderRadius: 16 }} />
            </div>
          )}

          <div style={{
            background: 'var(--surface-2, #FDF5F6)', borderRadius: 14,
            padding: '12px 14px', marginBottom: 12, wordBreak: 'break-all',
            fontSize: 13, color: 'var(--text-muted)', border: '1px solid rgba(200,51,74,0.1)',
          }}>
            {inviteLink}
          </div>

          <button onClick={copyLink} style={{
            width: '100%', padding: '13px', border: '1.5px solid rgba(200,51,74,0.25)',
            borderRadius: 14, background: copied ? 'rgba(200,51,74,0.08)' : 'white',
            color: '#C8334A', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            marginBottom: 10, transition: 'all 0.2s',
          }}>
            {copied ? '✓ Скопировано!' : 'Скопировать ссылку'}
          </button>

          {navigator.share && (
            <button onClick={() => navigator.share({ title: 'Love App', url: inviteLink })} style={{
              width: '100%', padding: '13px', border: 'none', borderRadius: 14,
              background: 'linear-gradient(135deg,#C8334A,#8B1A2C)',
              color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              marginBottom: 10,
            }}>
              Поделиться
            </button>
          )}

          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
            Партнёр откроет ссылку и вы будете связаны
          </p>
        </div>
      )}

      {/* Режим: ввести код партнёра */}
      {mode === 'enter' && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Введи 8-значный код партнёра"
              value={code}
              onChange={e => { setCode(e.target.value.toLowerCase()); setFoundPartner(null); setError(null) }}
              onKeyDown={e => e.key === 'Enter' && searchPartner()}
              maxLength={8}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 14,
                border: '1.5px solid rgba(200,51,74,0.2)',
                background: 'var(--surface-2, #FDF5F6)',
                fontSize: 18, letterSpacing: 3, textAlign: 'center',
                color: 'var(--text)', outline: 'none',
              }}
            />
          </div>

          <button onClick={searchPartner} disabled={code.length < 4 || searching} style={{
            width: '100%', padding: 13, borderRadius: 14, border: 'none',
            background: code.length >= 4 ? 'rgba(200,51,74,0.1)' : 'rgba(0,0,0,0.04)',
            color: code.length >= 4 ? '#C8334A' : 'var(--text-muted)',
            fontSize: 15, fontWeight: 600, cursor: code.length >= 4 ? 'pointer' : 'default',
            marginBottom: 16,
          }}>
            {searching ? 'Ищем...' : 'Найти партнёра'}
          </button>

          {error && (
            <div style={{ background: 'rgba(255,80,80,0.08)', borderRadius: 12, padding: '10px 14px', color: '#C85050', fontSize: 13, marginBottom: 12 }}>
              {error}
            </div>
          )}

          {foundPartner && (
            <div style={{
              background: 'rgba(200,51,74,0.06)', borderRadius: 16, padding: '16px',
              border: '1.5px solid rgba(200,51,74,0.15)', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', overflow: 'hidden',
                  background: 'linear-gradient(135deg,#FBF0F2,#F2D0D6)',
                  flexShrink: 0,
                }}>
                  {foundPartner.avatar_url
                    ? <img src={foundPartner.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 40 40" width="24" height="24" fill="none">
                          <circle cx="20" cy="16" r="7" fill="#C8334A" opacity="0.6"/>
                          <path d="M4 38c0-8.8 7.2-16 16-16s16 7.2 16 16" fill="#C8334A" opacity="0.4"/>
                        </svg>
                      </div>
                  }
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{foundPartner.name}</div>
                  <div style={{ fontSize: 12, color: '#C8334A' }}>Найден!</div>
                </div>
              </div>
              <NextBtn onClick={connectPartner} label={`Подключиться с ${foundPartner.name}`} loading={connecting} />
            </div>
          )}
        </div>
      )}

      <button onClick={onFinish} style={{
        width: '100%', padding: 12, marginTop: 8, border: 'none',
        background: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
      }}>
        Пропустить — подключу партнёра позже
      </button>
    </div>
  )
}

/* ── Главный компонент онбординга ── */
export default function Onboarding({ session, onComplete }) {
  const [step, setStep] = useState(0)
  const [profileData, setProfileData] = useState({ name: '', avatar_url: null })
  const [birthday, setBirthday] = useState('')
  const [coupleStart, setCoupleStart] = useState('')
  const [inviteCode, setInviteCode] = useState(null)
  const [partnerLinked, setPartnerLinked] = useState(false)
  const [saving, setSaving] = useState(false)

  /* Загружаем текущий профиль (может быть частично заполнен) */
  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data }) => {
      if (data) {
        setProfileData({ name: data.name || '', avatar_url: data.avatar_url || null })
        setBirthday(data.birthday || '')
        setCoupleStart(data.couple_start_date || '')
        setInviteCode(data.invite_code)
        setPartnerLinked(!!data.partner_id)
      }
    })
  }, [session.user.id])

  // upsert используется везде — на случай если строки профиля ещё нет (новый OAuth-пользователь)
  async function saveStep2() {
    setSaving(true)
    try {
      await supabase.from('profiles').upsert({
        id: session.user.id,
        name: profileData.name.trim(),
        avatar_url: profileData.avatar_url,
      }, { onConflict: 'id' })
    } catch (e) { console.warn('saveStep2:', e) }
    setSaving(false)
    setStep(3)
  }

  async function saveStep3() {
    setSaving(true)
    try {
      await supabase.from('profiles').upsert(
        { id: session.user.id, birthday },
        { onConflict: 'id' }
      )
    } catch (e) { console.warn('saveStep3:', e) }
    setSaving(false)
    setStep(4)
  }

  async function saveStep4() {
    setSaving(true)
    try {
      await supabase.from('profiles').upsert(
        { id: session.user.id, couple_start_date: coupleStart || null },
        { onConflict: 'id' }
      )
    } catch (e) { console.warn('saveStep4:', e) }
    setSaving(false)
    setStep(5)
  }

  async function finish() {
    setSaving(true)
    try {
      await supabase.from('profiles').upsert(
        { id: session.user.id, onboarding_done: true },
        { onConflict: 'id' }
      )
    } catch (e) { console.warn('finish onboarding:', e) }
    setSaving(false)
    onComplete()
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(180deg, #FBF0F2 0%, #FFFFFF 100%)',
      display: 'flex', flexDirection: 'column',
      padding: 'calc(env(safe-area-inset-top,0px) + 32px) 24px calc(env(safe-area-inset-bottom,0px) + 32px)',
    }}>
      <style>{`
        @keyframes slideInRight {
          from { opacity:0; transform:translateX(24px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes heartbeat { 0%,100%{transform:scale(1)} 15%{transform:scale(1.3)} 30%{transform:scale(1.05)} 45%{transform:scale(1.2)} }
        .ob-step { animation: slideInRight 0.3s ease both; }
      `}</style>

      {step > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, gap: 12 }}>
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: '4px 0',
            }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          )}
          <div style={{ flex: 1 }}>
            <StepDots step={step - 1} />
          </div>
        </div>
      )}

      <div key={step} className="ob-step" style={{ flex: 1 }}>
        {step === 0 && <StepWelcome onNext={() => setStep(1)} />}

        {step === 1 && (
          <StepWelcome onNext={() => setStep(2)} />
        )}

        {step === 2 && (
          <StepProfile
            value={profileData}
            onChange={setProfileData}
            onNext={saveStep2}
          />
        )}

        {step === 3 && (
          <StepBirthday
            value={birthday}
            onChange={setBirthday}
            onNext={saveStep3}
            onSkip={() => setStep(4)}
          />
        )}

        {step === 4 && (
          <StepRelationship
            value={coupleStart}
            onChange={setCoupleStart}
            onNext={saveStep4}
            onSkip={() => setStep(5)}
          />
        )}

        {step === 5 && (
          <StepPartner
            session={session}
            inviteCode={inviteCode}
            partnerAlreadyLinked={partnerLinked}
            onFinish={finish}
          />
        )}
      </div>
    </div>
  )
}
