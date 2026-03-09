import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { subscribeToPush } from './lib/push'
import Auth from './components/Auth'
import Home from './components/Home'
import Chat from './components/Chat'
import Calendar from './components/Calendar'
import Moments from './components/Moments'
import Plans from './components/Plans'
import LoveClock from './components/LoveClock'
import LoveLetter from './components/LoveLetter'
import Settings from './components/Settings'
import Navigation from './components/Navigation'

// Apply saved theme on load
;(function applyStoredTheme() {
  const THEMES = {
    rose:    { a: '#e8466a', b: '#c84b8b' },
    purple:  { a: '#9b4dca', b: '#6d28d9' },
    sunset:  { a: '#f97316', b: '#ec4899' },
    ocean:   { a: '#0ea5e9', b: '#6366f1' },
    forest:  { a: '#22c55e', b: '#059669' },
    cherry:  { a: '#be123c', b: '#9f1239' },
    gold:    { a: '#f59e0b', b: '#d97706' },
    night:   { a: '#1e1b4b', b: '#312e81' },
  }
  const saved = localStorage.getItem('loveTheme')
  if (saved && THEMES[saved]) {
    const t = THEMES[saved]
    document.documentElement.style.setProperty('--primary', t.a)
    document.documentElement.style.setProperty('--primary-dark', t.b)
    document.documentElement.style.setProperty('--gradient', `linear-gradient(135deg, ${t.a} 0%, ${t.b} 100%)`)
    document.documentElement.style.setProperty('--gradient-warm', `linear-gradient(135deg, ${t.a} 0%, ${t.b} 100%)`)
  }
})()

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('home')
  const [profile, setProfile] = useState(null)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('appDarkMode') === 'true')

  function toggleDarkMode() {
    setDarkMode(v => {
      localStorage.setItem('appDarkMode', String(!v))
      return !v
    })
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    subscribeToPush(userId)
  }

  const reloadProfile = useCallback(() => {
    if (session?.user?.id) loadProfile(session.user.id)
  }, [session?.user?.id])

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-heart">
          <svg viewBox="0 0 60 56" width="60" height="56" fill="none">
            <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z"
              fill="url(#lg-load)"/>
            <defs>
              <linearGradient id="lg-load" x1="0" y1="0" x2="60" y2="56" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FF6B8A"/>
                <stop offset="100%" stopColor="#FF2D55"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'home':
        return <Home session={session} profile={profile} darkMode={darkMode} onNavigate={setActiveTab} />
      case 'chat':
        return <Chat session={session} profile={profile} darkMode={darkMode} />
      case 'clock':
        return <LoveClock session={session} profile={profile} />
      case 'letter':
        return <LoveLetter session={session} profile={profile} />
      case 'calendar':
        return <Calendar session={session} profile={profile} />
      case 'moments':
        return <Moments session={session} profile={profile} />
      case 'plans':
        return <Plans session={session} profile={profile} />
      case 'settings':
        return (
          <Settings
            session={session}
            profile={profile}
            darkMode={darkMode}
            toggleDarkMode={toggleDarkMode}
            onProfileUpdate={reloadProfile}
          />
        )
      default:
        return <Home session={session} profile={profile} darkMode={darkMode} onNavigate={setActiveTab} />
    }
  }

  const noPadding = activeTab === 'chat' || activeTab === 'clock' || activeTab === 'letter'

  return (
    <div className={`app${darkMode ? ' dark' : ''}`}>
      <div
        className="app-content"
        style={noPadding ? { padding: 0, paddingTop: activeTab === 'chat' ? 'var(--safe-top)' : 0 } : {}}
      >
        {renderTab()}
      </div>
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  )
}
