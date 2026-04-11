import { useState } from 'react'
import { supabase } from '../lib/supabase'

const STYLE = `
  .auth-bg::before {
    content:''; position:absolute; width:300px; height:300px; border-radius:50%;
    background:radial-gradient(circle,rgba(255,255,255,0.12) 0%,transparent 70%);
    top:-80px; right:-80px; animation:pulse 4s ease-in-out infinite; pointer-events:none;
  }
  .auth-bg::after {
    content:''; position:absolute; width:200px; height:200px; border-radius:50%;
    background:radial-gradient(circle,rgba(255,255,255,0.08) 0%,transparent 70%);
    bottom:-50px; left:-50px; animation:pulse 5s ease-in-out 1s infinite; pointer-events:none;
  }
  .auth-card {
    width:100%; max-width:340px;
    background:rgba(255,255,255,0.15); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
    border:0.5px solid rgba(255,255,255,0.3); border-radius:24px;
    padding:32px 24px 28px; box-shadow:0 8px 40px rgba(139,26,44,0.3);
    position:relative; z-index:1;
  }
  .auth-title {
    font-family:var(--font-display); font-size:34px; font-weight:600;
    color:white; text-align:center; margin-bottom:4px; font-style:italic;
  }
  .auth-subtitle { font-size:14px; color:rgba(255,255,255,0.75); text-align:center; margin-bottom:20px; }
  .auth-tabs { display:flex; gap:0; margin-bottom:20px; background:rgba(0,0,0,0.2); border-radius:12px; padding:3px; }
  .auth-tab {
    flex:1; padding:9px; border:none; background:transparent; color:rgba(255,255,255,0.6);
    font-family:var(--font-body); font-size:14px; font-weight:500; cursor:pointer;
    border-radius:10px; transition:all 0.2s;
  }
  .auth-tab.active { background:rgba(255,255,255,0.2); color:white; }
  .auth-field { margin-bottom:14px; }
  .auth-label {
    display:block; font-size:12px; font-weight:500; color:rgba(255,255,255,0.8);
    letter-spacing:0.5px; text-transform:uppercase; margin-bottom:6px;
  }
  .auth-input {
    width:100%; background:rgba(255,255,255,0.15); backdrop-filter:blur(10px);
    border:0.5px solid rgba(255,255,255,0.25); border-radius:14px;
    padding:13px 16px; font-size:15px; color:white; outline:none;
    transition:border-color 0.2s,box-shadow 0.2s;
  }
  .auth-input::placeholder { color:rgba(255,255,255,0.4); }
  .auth-input:focus { border-color:rgba(255,255,255,0.6); box-shadow:0 0 0 3px rgba(255,255,255,0.12); }
  .auth-error {
    background:rgba(255,100,100,0.15); border:0.5px solid rgba(255,100,100,0.4);
    border-radius:12px; padding:10px 14px; font-size:13px; color:#FFB3B3;
    margin-bottom:14px; text-align:center;
  }
  .auth-success {
    background:rgba(100,255,150,0.12); border:0.5px solid rgba(100,255,150,0.3);
    border-radius:12px; padding:12px 14px; font-size:13px; color:#B3FFD0;
    margin-bottom:14px; text-align:center; line-height:1.5;
  }
  .auth-btn {
    width:100%; background:white; color:#C8334A; border:none; border-radius:14px;
    padding:14px; font-size:15px; font-weight:600; cursor:pointer;
    margin-top:8px; transition:transform 0.15s,opacity 0.15s;
    box-shadow:0 4px 20px rgba(0,0,0,0.15);
  }
  .auth-btn:active { transform:scale(0.97); opacity:0.92; }
  .auth-btn:disabled { opacity:0.7; }
  .auth-btn-google {
    width:100%; background:rgba(255,255,255,0.12); color:white;
    border:0.5px solid rgba(255,255,255,0.3); border-radius:14px;
    padding:13px; font-size:14px; font-weight:500; cursor:pointer;
    margin-top:10px; display:flex; align-items:center; justify-content:center; gap:10px;
    transition:background 0.2s;
  }
  .auth-btn-google:hover { background:rgba(255,255,255,0.2); }
  .auth-btn-vk {
    width:100%; background:#0077FF; color:white;
    border:none; border-radius:14px;
    padding:13px; font-size:14px; font-weight:600; cursor:pointer;
    margin-top:10px; display:flex; align-items:center; justify-content:center; gap:10px;
    transition:opacity 0.2s;
  }
  .auth-btn-vk:hover { opacity:0.9; }
  .auth-divider {
    display:flex; align-items:center; gap:10px; margin:14px 0 6px;
    color:rgba(255,255,255,0.35); font-size:12px;
  }
  .auth-divider::before,.auth-divider::after {
    content:''; flex:1; height:0.5px; background:rgba(255,255,255,0.2);
  }
  .auth-link {
    background:none; border:none; color:rgba(255,255,255,0.7);
    font-size:13px; cursor:pointer; text-decoration:underline;
    padding:0; margin-top:14px; display:block; text-align:center; width:100%;
  }
  .auth-link:hover { color:white; }
`

export default function Auth() {
  const [tab, setTab] = useState('login') // 'login' | 'register' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  function reset() { setError(null); setSuccess(null) }

  async function handleLogin(e) {
    e.preventDefault(); reset(); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(
      error.message === 'Invalid login credentials' ? 'Неверный email или пароль' :
      error.message === 'Email not confirmed' ? 'Подтвердите email — письмо отправлено при регистрации' :
      error.message
    )
    setLoading(false)
  }

  async function handleRegister(e) {
    e.preventDefault(); reset()
    if (password !== confirm) { setError('Пароли не совпадают'); return }
    if (password.length < 6) { setError('Пароль должен быть не менее 6 символов'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: window.location.origin,
      }
    })
    if (error) setError(error.message)
    else setSuccess('Письмо с подтверждением отправлено на ' + email + '. Проверьте почту (и папку «Спам»).')
    setLoading(false)
  }

  async function handleReset(e) {
    e.preventDefault(); reset(); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/?reset=true',
    })
    if (error) setError(error.message)
    else setSuccess('Письмо для сброса пароля отправлено на ' + email)
    setLoading(false)
  }

  function handleVK() {
    reset()
    // Редирект на Edge Function → она редиректит на VK OAuth
    const vkAuthUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vk-auth?action=login`
    window.location.href = vkAuthUrl
  }

  async function handleGoogle() {
    reset()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) setError(error.message)
  }

  const VKIcon = () => (
    <svg width="20" height="12" viewBox="0 0 20 12" fill="white">
      <path d="M10.6 12c-5.9 0-9.3-4-9.4-10.7H4c.1 4.9 2.2 7 3.9 7.4V1.3h2.8v4.3c1.7-.2 3.5-2.2 4.1-4.3H17c-.5 2.6-2.3 4.6-3.7 5.4 1.4.7 3.4 2.4 4.2 5.3h-3.1c-.6-1.9-2.1-3.4-4.1-3.6V12h-.7z"/>
    </svg>
  )

  const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )

  return (
    <div className="auth-bg">
      <style>{STYLE}</style>

      <div className="auth-logo-wrap" style={{ marginBottom: 24, animation: 'heartbeat 1.5s ease-in-out infinite' }}>
        <svg viewBox="0 0 60 56" width="64" height="60" fill="none">
          <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z"
            fill="rgba(255,255,255,0.9)" />
        </svg>
      </div>

      <div className="auth-card">
        <h1 className="auth-title">Love App</h1>
        <p className="auth-subtitle">
          {tab === 'reset' ? 'Восстановление пароля' : 'Наша история любви'}
        </p>

        {tab !== 'reset' && (
          <div className="auth-tabs">
            <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); reset() }}>Вход</button>
            <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); reset() }}>Регистрация</button>
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        {/* LOGIN */}
        {tab === 'login' && !success && (
          <form onSubmit={handleLogin}>
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input className="auth-input" type="email" placeholder="email@example.com"
                value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="auth-field">
              <label className="auth-label">Пароль</label>
              <input className="auth-input" type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? 'Входим...' : 'Войти'}
            </button>
            <div className="auth-divider">или</div>
            <button type="button" className="auth-btn-vk" onClick={handleVK}>
              <VKIcon /> Войти через ВКонтакте
            </button>
            <button type="button" className="auth-btn-google" onClick={handleGoogle}>
              <GoogleIcon /> Войти через Google
            </button>
            <button type="button" className="auth-link" onClick={() => { setTab('reset'); reset() }}>
              Забыли пароль?
            </button>
          </form>
        )}

        {/* REGISTER */}
        {tab === 'register' && !success && (
          <form onSubmit={handleRegister}>
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input className="auth-input" type="email" placeholder="email@example.com"
                value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="auth-field">
              <label className="auth-label">Пароль</label>
              <input className="auth-input" type="password" placeholder="Минимум 6 символов"
                value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
            </div>
            <div className="auth-field">
              <label className="auth-label">Повторите пароль</label>
              <input className="auth-input" type="password" placeholder="••••••••"
                value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />
            </div>
            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? 'Создаём аккаунт...' : 'Создать аккаунт'}
            </button>
            <div className="auth-divider">или</div>
            <button type="button" className="auth-btn-vk" onClick={handleVK}>
              <VKIcon /> Зарегистрироваться через ВКонтакте
            </button>
            <button type="button" className="auth-btn-google" onClick={handleGoogle}>
              <GoogleIcon /> Зарегистрироваться через Google
            </button>
          </form>
        )}

        {/* RESET */}
        {tab === 'reset' && !success && (
          <form onSubmit={handleReset}>
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input className="auth-input" type="email" placeholder="email@example.com"
                value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? 'Отправляем...' : 'Отправить письмо'}
            </button>
            <button type="button" className="auth-link" onClick={() => { setTab('login'); reset() }}>
              Вернуться ко входу
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
