import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { subscribeToPush } from './lib/push'
import Auth from './components/Auth'
import Onboarding from './components/Onboarding'
import Home from './components/Home'
import Chat from './components/Chat'
import Calendar from './components/Calendar'
import Moments from './components/Moments'
import Plans from './components/Plans'
import LoveClock from './components/LoveClock'
import LoveLetter from './components/LoveLetter'
import Settings from './components/Settings'
import AIAdvisor from './components/AIAdvisor'
import Premium from './components/Premium'
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
  const [profileLoading, setProfileLoading] = useState(false)
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('tab') || 'home'
  })
  const [profile, setProfile] = useState(null)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('appDarkMode') === 'true')

  function toggleDarkMode() {
    setDarkMode(v => {
      localStorage.setItem('appDarkMode', String(!v))
      return !v
    })
  }

  // Сохраняем invite-код из URL до авторизации
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const inviteCode = params.get('invite')
    if (inviteCode) {
      localStorage.setItem('pendingInvite', inviteCode)
      // Убираем из URL чтобы не мешало
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session) await loadProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        setProfileLoading(true)
        loadProfile(session.user.id).finally(() => setProfileLoading(false))
      } else {
        setProfile(null)
      }
    })

    // Переключаем на чат по сообщению от service worker (тап по уведомлению)
    function onSwMessage(e) {
      if (e.data?.type === 'OPEN_CHAT') setActiveTab('chat')
    }
    navigator.serviceWorker?.addEventListener('message', onSwMessage)

    return () => {
      subscription.unsubscribe()
      navigator.serviceWorker?.removeEventListener('message', onSwMessage)
    }
  }, [])

  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)

    // Принимаем pending invite после входа
    const pendingInvite = localStorage.getItem('pendingInvite')
    if (pendingInvite && data && !data.partner_id) {
      localStorage.removeItem('pendingInvite')
      const { data: partner } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('invite_code', pendingInvite)
        .single()
      if (partner && partner.id !== userId) {
        await supabase.from('profiles').update({ partner_id: partner.id }).eq('id', userId)
        await supabase.from('profiles').update({ partner_id: userId }).eq('id', partner.id)
        // Перезагружаем профиль с обновлённым partner_id
        const { data: updated } = await supabase.from('profiles').select('*').eq('id', userId).single()
        setProfile(updated)
      }
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      subscribeToPush(userId)
    }
  }

  const reloadProfile = useCallback(() => {
    if (session?.user?.id) loadProfile(session.user.id)
  }, [session?.user?.id])

  if (loading || profileLoading) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#FBF0F2',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
      }}>
        <div style={{ animation: 'heartbeat 1.4s ease-in-out infinite' }}>
          <svg viewBox="0 0 60 56" width="80" height="75" fill="none">
            <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z"
              fill="url(#lgload)"/>
            <defs>
              <linearGradient id="lgload" x1="0" y1="0" x2="60" y2="56" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#E8556A"/>
                <stop offset="100%" stopColor="#C8334A"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontStyle: 'italic',
          fontSize: 22,
          color: '#C8334A',
          letterSpacing: 1,
        }}>
          Love App
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[0, 0.2, 0.4].map((delay, i) => (
            <div key={i} style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#C8334A',
              animation: `pulse 0.9s ${delay}s ease-in-out infinite`,
            }}/>
          ))}
        </div>
        <style>{`
          @keyframes heartbeat { 0%,100%{transform:scale(1)} 15%{transform:scale(1.3)} 30%{transform:scale(1.05)} 45%{transform:scale(1.2)} }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        `}</style>
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  // Показываем онбординг новым пользователям:
  // - profile === null: новый OAuth-пользователь, профиль ещё не создан
  // - onboarding_done === false: явно не завершил онбординг
  // - нет имени: старый способ определения нового пользователя
  const needsOnboarding = !profile || (
    profile.onboarding_done === false ||
    (!profile.name && profile.onboarding_done !== true)
  )
  if (needsOnboarding) {
    return (
      <Onboarding
        session={session}
        onComplete={reloadProfile}
      />
    )
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
      case 'advisor':
        return <AIAdvisor session={session} profile={profile} darkMode={darkMode} />
      case 'premium':
        return <Premium session={session} />
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

  const getPaddingBottom = () => {
    if (activeTab === 'chat') {
      return 'calc(56px + env(safe-area-inset-bottom, 0px))'
    }
    return 0
  }

  const getPaddingTop = () => {
    if (activeTab === 'chat') {
      return 'var(--safe-top)'
    }
    return 0
  }

  return (
    <div className={`app${darkMode ? ' dark' : ''}`}>
      <div className="aurora-bg"><div className="aurora-blob3" /></div>

      <div
        className="app-content"
        style={{ 
          padding: 0,
          paddingTop: getPaddingTop(),
          paddingBottom: getPaddingBottom(),
        }}
      >
        <div key={activeTab} className="tab-anim">
          {renderTab()}
        </div>
      </div>
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  )
}
