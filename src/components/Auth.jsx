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
    <div className="auth-screen">
      <div className="auth-logo">💕</div>
      <h1 className="auth-title">Love App</h1>
      <p className="auth-subtitle">Наша история любви</p>

      <form className="auth-form" onSubmit={handleLogin}>
        {error && <div className="auth-error">{error}</div>}

        <div className="auth-input-group">
          <label>Email</label>
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

        <div className="auth-input-group">
          <label>Пароль</label>
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
          {loading ? '💕 Входим...' : 'Войти ❤️'}
        </button>
      </form>
    </div>
  )
}
