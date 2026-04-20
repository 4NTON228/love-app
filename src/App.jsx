import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { supabase } from './lib/supabase'
import { subscribeToPush } from './lib/push'
import Auth from './components/Auth'
import Onboarding from './components/Onboarding'
import Home from './components/Home'
import Navigation from './components/Navigation'

const Chat        = lazy(() => import('./components/Chat'))
const Calendar    = lazy(() => import('./components/Calendar'))
const Moments     = lazy(() => import('./components/Moments'))
const Plans       = lazy(() => import('./components/Plans'))
const LoveClock   = lazy(() => import('./components/LoveClock'))
const LoveLetter  = lazy(() => import('./components/LoveLetter'))
const Settings    = lazy(() => import('./components/Settings'))
const AIAdvisor   = lazy(() => import('./components/AIAdvisor'))
const Premium     = lazy(() => import('./components/Premium'))

// Apply saved theme on load
;(function applyStoredTheme() {
  const THEMES = {
    rose:     { a: '#A8283C', b: '#6E1424' },
    cherry:   { a: '#9B1B30', b: '#5C0E1A' },
    violet:   { a: '#5C2D7A', b: '#2A0F40' },
    lavender: { a: '#6B4F9C', b: '#3A2060' },
    ocean:    { a: '#1B6B8A', b: '#0C3A50' },
    sky:      { a: '#1A6FA0', b: '#0D3D5C' },
    forest:   { a: '#2A6B3A', b: '#0F3820' },
    northern: { a: '#1A8070', b: '#0A4038' },
    sunset:   { a: '#B85020', b: '#7A2C10' },
    fire:     { a: '#A82018', b: '#6E100C' },
    gold:     { a: '#9A7020', b: '#5C4010' },
    night:    { a: '#2A3070', b: '#12163A' },
  }
  let t = null
  try {
    const raw = localStorage.getItem('loveThemeData')
    if (raw) t = JSON.parse(raw)
  } catch (_e) { /* ignore invalid stored theme */ }
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

    // Принимаем pending invite для уже прошедших онбординг пользователей.
    // Для новых пользователей это handled в StepPartner во время онбординга.
    const pendingInvite = localStorage.getItem('pendingInvite')
    if (pendingInvite && data && !data.partner_id) {
      try {
        const { data: rpcResult, error: rpcErr } = await supabase
          .rpc('connect_partner_by_invite', { p_invite_code: pendingInvite.trim().toLowerCase() })
        if (!rpcErr && !rpcResult?.error) {
          localStorage.removeItem('pendingInvite')
          const { data: updated } = await supabase.from('profiles').select('*').eq('id', userId).single()
          setProfile(updated)
        } else {
          console.warn('Pending invite connect failed:', rpcErr?.message ?? rpcResult?.error)
        }
      } catch (e) {
        console.warn('Pending invite exception:', e)
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
        background: '#0E0C0A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
      }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontStyle: 'italic',
          fontWeight: 300,
          fontSize: 28,
          color: 'rgba(237,233,226,0.9)',
          letterSpacing: 2,
          animation: 'ldFade 2s ease-in-out infinite',
        }}>
          Love App
        </div>
        <div style={{
          width: 32, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(168,40,60,0.6), transparent)',
          animation: 'ldFade 2s ease-in-out 0.3s infinite',
        }} />
        <style>{`
          @keyframes ldFade { 0%,100%{opacity:0.5} 50%{opacity:1} }
        `}</style>
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  // Проверяем localStorage-fallback (работает если миграция ещё не запущена)
  const onboardingDoneLocally = !!localStorage.getItem(`ob_done_${session?.user?.id}`)

  // Показываем онбординг новым пользователям:
  // Если пользователь завершил онбординг на этом устройстве — сразу пускаем
  // Иначе: новый профиль (null) или явно не завершённый онбординг
  const needsOnboarding = !onboardingDoneLocally && (
    !profile ||
    profile.onboarding_done === false ||
    (!profile.name && profile.onboarding_done !== true)
  )
  if (needsOnboarding) {
    return (
      <Onboarding
        session={session}
        onComplete={reloadProfile}
        onSignOut={() => supabase.auth.signOut()}
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
      {darkMode && <div className="aurora-bg"><div className="aurora-blob3" /></div>}

      <div
        className="app-content"
        style={{ 
          padding: 0,
          paddingTop: getPaddingTop(),
          paddingBottom: getPaddingBottom(),
        }}
      >
        <Suspense fallback={null}>
          <div key={activeTab} className="tab-anim">
            {renderTab()}
          </div>
        </Suspense>
      </div>
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  )
}
