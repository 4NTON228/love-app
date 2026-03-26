import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Неверный email или пароль'
        : error.message
      )
    }
    setLoading(false)
  }

  return (
    <div className="auth-bg">
      <style>{`
        .auth-bg::before {
          content: '';
          position: absolute;
          width: 300px; height: 300px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%);
          top: -80px; right: -80px;
          animation: pulse 4s ease-in-out infinite;
          pointer-events: none;
        }
        .auth-bg::after {
          content: '';
          position: absolute;
          width: 200px; height: 200px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
          bottom: -50px; left: -50px;
          animation: pulse 5s ease-in-out 1s infinite;
          pointer-events: none;
        }
        .auth-logo-wrap {
          margin-bottom: 24px;
          animation: heartbeat 1.5s ease-in-out infinite;
        }
        .auth-card {
          width: 100%;
          max-width: 340px;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 0.5px solid rgba(255,255,255,0.3);
          border-radius: 24px;
          padding: 32px 24px 28px;
          box-shadow: 0 8px 40px rgba(139,26,44,0.3);
          position: relative; z-index: 1;
        }
        .auth-title {
          font-family: var(--font-display);
          font-size: 34px; font-weight: 600;
          color: white;
          text-align: center;
          margin-bottom: 4px;
          font-style: italic;
        }
        .auth-subtitle {
          font-family: var(--font-body);
          font-size: 14px;
          color: rgba(255,255,255,0.75);
          text-align: center;
          margin-bottom: 28px;
        }
        .auth-field { margin-bottom: 14px; }
        .auth-label {
          display: block;
          font-family: var(--font-body);
          font-size: 12px; font-weight: 500;
          color: rgba(255,255,255,0.8);
          letter-spacing: 0.5px; text-transform: uppercase;
          margin-bottom: 6px;
        }
        .auth-input {
          width: 100%;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(10px);
          border: 0.5px solid rgba(255,255,255,0.25);
          border-radius: 14px;
          padding: 13px 16px;
          font-family: var(--font-body);
          font-size: 15px;
          color: white;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .auth-input::placeholder { color: rgba(255,255,255,0.4); }
        .auth-input:focus {
          border-color: rgba(255,255,255,0.6);
          box-shadow: 0 0 0 3px rgba(255,255,255,0.12);
        }
        .auth-error {
          background: rgba(255,255,255,0.1);
          border: 0.5px solid rgba(255,255,255,0.25);
          border-radius: 12px;
          padding: 10px 14px;
          font-family: var(--font-body);
          font-size: 13px;
          color: white;
          margin-bottom: 14px;
          text-align: center;
        }
        .auth-btn {
          width: 100%;
          background: white;
          color: var(--rose, #C8334A);
          border: none;
          border-radius: 14px;
          padding: 14px;
          font-family: var(--font-body);
          font-size: 15px; font-weight: 600;
          cursor: pointer;
          margin-top: 8px;
          transition: transform 0.15s, opacity 0.15s;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .auth-btn:active { transform: scale(0.97); opacity: 0.92; }
        .auth-btn:disabled { opacity: 0.7; }
      `}</style>

      {/* Heart logo */}
      <div className="auth-logo-wrap">
        <svg viewBox="0 0 60 56" width="64" height="60" fill="none">
          <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z"
            fill="rgba(255,255,255,0.9)" />
        </svg>
      </div>

      <div className="auth-card">
        <h1 className="auth-title">Love App</h1>
        <p className="auth-subtitle">Наша история любви</p>

        <form onSubmit={handleLogin}>
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              className="auth-input"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Пароль</label>
            <input
              className="auth-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
