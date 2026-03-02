import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { subscribeToPush } from './lib/push'
import Auth from './components/Auth'
import Home from './components/Home'
import Chat from './components/Chat'
import Calendar from './components/Calendar'
import Moments from './components/Moments'
import Plans from './components/Plans'
import Navigation from './components/Navigation'
import Hearts from './components/Hearts'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('home')
  const [profile, setProfile] = useState(null)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('appDarkMode') === 'true')

  function toggleDarkMode() {
    setDarkMode(v => {
      localStorage.setItem('appDarkMode', !v)
      return !v
    })
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session) loadProfile(session.user.id)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    subscribeToPush(userId)
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-heart">💕</div>
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'home':
        return <Home session={session} profile={profile} />
      case 'chat':
        return <Chat session={session} profile={profile} darkMode={darkMode} />
      case 'calendar':
        return <Calendar session={session} profile={profile} />
      case 'moments':
        return <Moments session={session} profile={profile} />
      case 'plans':
        return <Plans session={session} profile={profile} />
      default:
        return <Home session={session} profile={profile} />
    }
  }

  return (
    <div className={`app${darkMode ? ' dark' : ''}`}>
      {activeTab !== 'chat' && <Hearts />}
      <button
        className="theme-toggle-btn"
        onClick={toggleDarkMode}
        aria-label="Сменить тему"
      >
        {darkMode ? '☀️' : '🌙'}
      </button>
      <div className="app-content" style={activeTab === 'chat' ? { padding: 0, paddingTop: 'var(--safe-top)' } : {}}>
        {renderTab()}
      </div>
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  )
}