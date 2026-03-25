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
import ThemeToggle from './components/ThemeToggle'
import FloatingHearts from './components/FloatingHearts'

;(function applyStoredTheme() {
  const THEMES = {
    rose:     { a: '#E8466A', b: '#9C27B0', name: 'Розовый' },
    cherry:   { a: '#AD1457', b: '#4A0072', name: 'Вишнёвый' },
    violet:   { a: '#6A1B9A', b: '#1A0A2E', name: 'Фиолетовый' },
    lavender: { a: '#7E57C2', b: '#EC407A', name: 'Лавандовый' },
    ocean:    { a: '#0277BD', b: '#00838F', name: 'Океан' },
    sky:      { a: '#039BE5', b: '#B388FF', name: 'Небо' },
    forest:   { a: '#2E7D32', b: '#004D40', name: 'Лес' },
    northern: { a: '#00C853', b: '#00BCD4', name: 'Северное сияние' },
    sunset:   { a: '#FF6F00', b: '#C62828', name: 'Закат' },
    fire:     { a: '#D50000', b: '#FF6D00', name: 'Пламя' },
    gold:     { a: '#F57F17', b: '#E65100', name: 'Золото' },
    night:    { a: '#1A237E', b: '#0D0D1A', name: 'Ночь' },
  }
  
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
      <div className="loading">
        <div className="loading-heart">
          <svg viewBox="0 0 60 56" width="80" height="74" fill="none">
            <defs>
              <linearGradient id="lg-load" x1="0" y1="0" x2="60" y2="56">
                <stop offset="0%" stopColor="#FF6B8A"/>
                <stop offset="50%" stopColor="#FF2D55"/>
                <stop offset="100%" stopColor="#D10043"/>
              </linearGradient>
              <filter id="glow-load">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <path 
              d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z"
              fill="url(#lg-load)"
              filter="url(#glow-load)"
            />
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
        return <Home session={session} profile={profile} onNavigate={setActiveTab} />
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
        return <Home session={session} profile={profile} onNavigate={setActiveTab} />
    }
  }

  const noPadding = activeTab === 'chat' || activeTab === 'clock' || activeTab === 'letter'

  return (
    <div className={`app${darkMode ? ' dark' : ''}`}>
      <FloatingHearts />
      <ThemeToggle darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      
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
