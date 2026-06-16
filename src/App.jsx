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
const Settings    = lazy(() => import('./components/Settings'))
const AIAdvisor   = lazy(() => import('./components/AIAdvisor'))
const Premium     = lazy(() => import('./components/Premium'))

// Apply saved theme on load — HSL-based system
;(function applyStoredTheme() {
  const r = document.documentElement
  const h = localStorage.getItem('loveH')
  const s = localStorage.getItem('loveS')
  if (h && s) {
    const rose     = `hsl(${h}, ${s}, 41%)`
    const roseDark = `hsl(${h}, ${s}, 28%)`
    const gradient = `linear-gradient(135deg, hsl(${h},${s},46%) 0%, hsl(${h},${s},30%) 100%)`
    r.style.setProperty('--h',             h)
    r.style.setProperty('--s',             s)
    r.style.setProperty('--rose',          rose)
    r.style.setProperty('--rose-dark',     roseDark)
    r.style.setProperty('--rose-light',    `hsl(${h}, ${s}, 54%)`)
    r.style.setProperty('--primary',       rose)
    r.style.setProperty('--primary-dark',  roseDark)
    r.style.setProperty('--gradient',      gradient)
    r.style.setProperty('--gradient-warm', gradient)
    r.style.setProperty('--theme-gradient',gradient)
    r.style.setProperty('--theme-accent',  rose)
    r.style.setProperty('--gradient-main', gradient)
    r.style.setProperty('--bubble-mine',   `linear-gradient(135deg, hsl(${h},${s},49%) 0%, hsl(${h},${s},35%) 100%)`)
    return
  }
  // Legacy hex fallback (users with old loveThemeData)
  try {
    const raw = localStorage.getItem('loveThemeData')
    if (raw) {
      const t = JSON.parse(raw)
      if (t?.a) {
        const gradient = `linear-gradient(135deg, ${t.a} 0%, ${t.b} 100%)`
        r.style.setProperty('--rose',          t.a)
        r.style.setProperty('--rose-dark',     t.b)
        r.style.setProperty('--primary',       t.a)
        r.style.setProperty('--primary-dark',  t.b)
        r.style.setProperty('--gradient',      gradient)
        r.style.setProperty('--gradient-warm', gradient)
        r.style.setProperty('--theme-gradient',gradient)
        r.style.setProperty('--theme-accent',  t.a)
      }
    }
  } catch (_e) { /* ignore */ }
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
  // Тёмная тема по умолчанию (единый стиль), если пользователь явно не выбрал светлую
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('appDarkMode') !== 'false')

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
      <div className="splash-screen">
        <style>{`
          .splash-screen {
            position: fixed; inset: 0; z-index: 9999;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 26px;
            overflow: hidden;
            background:
              radial-gradient(circle at 82% 8%, rgba(255,214,150,0.22), transparent 42%),
              radial-gradient(circle at 12% 94%, rgba(60,20,45,0.55), transparent 52%),
              linear-gradient(165deg, #3d1838 0%, #6a2747 28%, #9a3c50 56%, #bd5552 80%, #cb6650 100%);
          }
          .splash-heart {
            position: relative;
            width: 84px; height: 78px;
            animation: splashBeat 1.4s ease-in-out infinite;
            filter: drop-shadow(0 8px 24px rgba(255,120,150,0.45));
          }
          .splash-heart svg { width: 100%; height: 100%; display: block; }
          .splash-heart::after {
            content: ''; position: absolute; inset: -40%;
            background: radial-gradient(circle, rgba(255,200,170,0.35), transparent 60%);
            border-radius: 50%;
            animation: splashGlow 1.4s ease-in-out infinite;
            z-index: -1;
          }
          .splash-word {
            font-family: 'Cormorant Garamond', Georgia, serif;
            font-style: italic; font-weight: 400;
            font-size: 34px; letter-spacing: 1.5px;
            color: #fff;
            text-shadow: 0 2px 20px rgba(120,20,50,0.4);
            opacity: 0;
            animation: splashWord 0.9s ease 0.15s forwards;
          }
          .splash-bar {
            width: 120px; height: 3px; border-radius: 999px;
            background: rgba(255,255,255,0.18);
            overflow: hidden;
            opacity: 0;
            animation: splashWord 0.9s ease 0.3s forwards;
          }
          .splash-bar-fill {
            width: 40%; height: 100%; border-radius: 999px;
            background: linear-gradient(90deg, transparent, #ffe7a8, #fff, transparent);
            animation: splashSlide 1.3s ease-in-out infinite;
          }
          @keyframes splashBeat {
            0%, 100% { transform: scale(1); }
            15% { transform: scale(1.16); }
            30% { transform: scale(1); }
            45% { transform: scale(1.10); }
          }
          @keyframes splashGlow {
            0%, 100% { opacity: 0.5; transform: scale(0.9); }
            22%      { opacity: 1;   transform: scale(1.1); }
          }
          @keyframes splashWord {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes splashSlide {
            0%   { transform: translateX(-130%); }
            100% { transform: translateX(330%); }
          }
        `}</style>
        <div className="splash-heart">
          <svg viewBox="0 0 60 56" fill="none">
            <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z"
              fill="#fff" fillOpacity="0.95"/>
          </svg>
        </div>
        <div className="splash-word">Love App</div>
        <div className="splash-bar"><div className="splash-bar-fill" /></div>
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
