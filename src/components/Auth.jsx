import { useState } from 'react'
import { supabase } from '../lib/supabase'

const STYLE = `
  .auth-tabs {
    display:flex; gap:0; margin-bottom:24px;
    background:rgba(255,255,255,0.06); border-radius:12px; padding:3px;
  }
  .auth-tab {
    flex:1; padding:9px 6px; border:none; background:transparent;
    color:rgba(255,255,255,0.38);
    font-family:var(--font-body); font-size:13px; font-weight:400; cursor:pointer;
    border-radius:10px; transition:all 0.22s cubic-bezier(0.22,1,0.36,1);
  }
  .auth-tab.active {
    background:rgba(255,255,255,0.1);
    color:rgba(237,233,226,0.92);
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  }
  .auth-btn-google {
    width:100%; background:rgba(255,255,255,0.07); color:rgba(237,233,226,0.78);
    border:0.5px solid rgba(255,255,255,0.12); border-radius:13px;
    padding:13px; font-size:13px; font-weight:400; cursor:pointer;
    margin-top:10px; display:flex; align-items:center; justify-content:center; gap:10px;
    transition:background 0.2s, transform 0.15s;
  }
  .auth-btn-google:active { background:rgba(255,255,255,0.12); transform:scale(0.98); }
  .auth-divider {
    display:flex; align-items:center; gap:10px; margin:14px 0 6px;
    color:rgba(255,255,255,0.22); font-size:11px; letter-spacing:0.6px;
  }
  .auth-divider::before,.auth-divider::after {
    content:''; flex:1; height:0.5px; background:rgba(255,255,255,0.08);
  }
  .auth-link {
    background:none; border:none; color:rgba(255,255,255,0.35);
    font-size:12px; cursor:pointer; text-decoration:none;
    padding:0; margin-top:14px; display:block; text-align:center; width:100%;
    transition:color 0.2s;
  }
  .auth-link:active { color:rgba(255,255,255,0.65); }
  .auth-success {
    background:rgba(50,160,90,0.1); border:0.5px solid rgba(50,160,90,0.28);
    border-radius:12px; padding:12px 14px; font-size:13px;
    color:rgba(160,220,180,0.92);
    margin-bottom:12px; text-align:center; line-height:1.55;
  }
  .auth-consent {
    display:flex; align-items:flex-start; gap:10px; margin:12px 0 4px; cursor:pointer;
  }
  .auth-consent input[type="checkbox"] {
    width:16px; height:16px; min-width:16px; margin-top:2px; cursor:pointer;
    accent-color:var(--rose, #A8283C);
  }
  .auth-consent-text {
    font-size:11px; color:rgba(255,255,255,0.3); line-height:1.6;
  }
  .auth-consent-text a { color:rgba(255,255,255,0.5); text-decoration:underline; }
`

export default function Auth() {
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [consent, setConsent] = useState(false)

  function reset() { setError(null); setSuccess(null) }

  async function handleLogin(e) {
    e.preventDefault(); reset(); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(
      error.message === 'Invalid login credentials' ? 'Неверный email или пароль. Если вы новый пользователь — перейдите на вкладку «Регистрация».' :
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
      options: { emailRedirectTo: window.location.origin }
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

  async function handleGoogle() {
    reset()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        // Всегда показывать выбор Google-аккаунта, а не входить молча
        // под уже залогиненным в браузере аккаунтом.
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) setError(error.message)
  }

  const GoogleIcon = () => (
    <svg width="16" height="16" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )

  return (
    <div className="auth-bg">
      <style>{STYLE}</style>

      {/* Wordmark */}
      <div className="auth-logo-wrap">
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 36,
            fontWeight: 300,
            fontStyle: 'italic',
            letterSpacing: 1,
            color: 'rgba(237,233,226,0.88)',
            lineHeight: 1,
            marginBottom: 6,
          }}>
            Love
          </div>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 10,
            fontWeight: 400,
            letterSpacing: 5,
            textTransform: 'uppercase',
            color: 'rgba(237,233,226,0.28)',
          }}>
            your story
          </div>
        </div>
      </div>

      <div className="auth-card">
        <h1 className="auth-title">
          {tab === 'reset' ? 'Восстановление' : 'Добро пожаловать'}
        </h1>
        <p className="auth-subtitle">
          {tab === 'reset' ? 'Укажите ваш email' : 'Ваша личная история'}
        </p>

        {tab !== 'reset' && (
          <div className="auth-tabs">
            <button className={`auth-tab${tab === 'login' ? ' active' : ''}`}
              onClick={() => { setTab('login'); reset() }}>Вход</button>
            <button className={`auth-tab${tab === 'register' ? ' active' : ''}`}
              onClick={() => { setTab('register'); reset() }}>Регистрация</button>
          </div>
        )}

        {error   && <div className="auth-error">{error}</div>}
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
              {loading ? 'Входим…' : 'Войти'}
            </button>
            <div className="auth-divider">или</div>
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
            <button className="auth-btn" type="submit" disabled={loading || !consent}>
              {loading ? 'Создаём аккаунт…' : 'Создать аккаунт'}
            </button>
            <div className="auth-divider">или</div>
            <button type="button" className="auth-btn-google" onClick={handleGoogle}>
              <GoogleIcon /> Зарегистрироваться через Google
            </button>
            <label className="auth-consent">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
              <span className="auth-consent-text">
                Регистрируясь, я принимаю{' '}
                <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Политику конфиденциальности</a>{' '}
                и <a href="/terms.html" target="_blank" rel="noopener noreferrer">Условия использования</a>,
                и даю согласие на обработку персональных данных
              </span>
            </label>
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
              {loading ? 'Отправляем…' : 'Отправить письмо'}
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
