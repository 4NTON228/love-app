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
    rose:     { a: '#E8466A', b: '#9C27B0' },
    cherry:   { a: '#AD1457', b: '#4A0072' },
    violet:   { a: '#6A1B9A', b: '#1A0A2E' },
    lavender: { a: '#7E57C2', b: '#EC407A' },
    ocean:    { a: '#0277BD', b: '#00838F' },
    sky:      { a: '#039BE5', b: '#B388FF' },
    forest:   { a: '#2E7D32', b: '#004D40' },
    northern: { a: '#00C853', b: '#00BCD4' },
    sunset:   { a: '#FF6F00', b: '#C62828' },
    fire:     { a: '#D50000', b: '#FF6D00' },
    gold:     { a: '#F57F17', b: '#E65100' },
    night:    { a: '#1A237E', b: '#0D0D1A' },
  }
  // Try full theme data first, fall back to id lookup
  let t = null
  try {
    const raw = localStorage.getItem('loveThemeData')
    if (raw) t = JSON.parse(raw)
  } catch (_) {}
  if (!t) {
    const saved = localStorage.getItem('loveTheme')
    if (saved && THEMES[saved]) t = THEMES[saved]
  }
  if (t) {
    const gradient = `linear-gradient(135deg, ${t.a} 0%, ${t.b} 100%)`
    document.documentElement.style.setProperty('--primary', t.a)
    document.documentElement.style.setProperty('--primary-dark', t.b)
    document.documentElement.style.setProperty('--gradient', gradient)
    document.documentElement.style.setProperty('--gradient-warm', gradient)
    document.documentElement.style.setProperty('--theme-gradient', gradient)
    document.documentElement.style.setProperty('--theme-accent', t.a)
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
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--blush)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16
      }}>
        <div style={{ animation: 'heartbeat 1.5s ease-in-out infinite' }}>
          <svg viewBox="0 0 60 56" width="64" height="60" fill="none">
            <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z"
              fill="url(#lg)"/>
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="60" y2="56" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#E8556A"/>
                <stop offset="100%" stopColor="#C8334A"/>
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
      {/* Aurora animated background */}
      <div className="aurora-bg"><div className="aurora-blob3" /></div>

      <div
        className="app-content"
        style={noPadding ? { padding: 0, paddingTop: activeTab === 'chat' ? 'var(--safe-top)' : 0 } : {}}
      >
        <div key={activeTab} className="tab-anim">
          {renderTab()}
        </div>
      </div>
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  )
}
