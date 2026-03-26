import { useState } from 'react'

/* ── Shared SVG gradient / glow defs (referenced via url(#…) anywhere in doc) ── */
function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }} aria-hidden>
      <defs>
        <linearGradient id="nav-g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#C8334A" />
          <stop offset="100%" stopColor="#8B1A2C" />
        </linearGradient>
        <filter id="nav-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
    </svg>
  )
}

/* ── Individual hand-drawn SVG icons ── */
function IconHome({ active }) {
  const s = active ? 'url(#nav-g)' : 'currentColor'
  const f = active ? 'url(#nav-g)' : 'none'
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" filter={active ? 'url(#nav-glow)' : 'none'}>
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M5 9.8V21h5v-5.5h4V21h5V9.8" />
      {active
        ? <path d="M12 14.5c0 0-2.2-1.5-2.2-2.8 0-.7.6-1.2 1.2-1.2.4 0 .7.2 1 .5.3-.3.6-.5 1-.5.6 0 1.2.5 1.2 1.2 0 1.3-2.2 2.8-2.2 2.8z"
            fill={f} stroke="none" />
        : <line x1="10" y1="21" x2="14" y2="21" stroke={s} strokeWidth="1.5" />
      }
    </svg>
  )
}

function IconChat({ active }) {
  const s = active ? 'url(#nav-g)' : 'currentColor'
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" filter={active ? 'url(#nav-glow)' : 'none'}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      <circle cx="9"  cy="11" r="1" fill={s} stroke="none" />
      <circle cx="12" cy="11" r="1" fill={s} stroke="none" />
      <circle cx="15" cy="11" r="1" fill={s} stroke="none" />
    </svg>
  )
}

function IconClock({ active }) {
  const s = active ? 'url(#nav-g)' : 'currentColor'
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8"
      strokeLinecap="round" filter={active ? 'url(#nav-glow)' : 'none'}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="12" x2="12" y2="7.5" strokeWidth="2" />
      <line x1="12" y1="12" x2="15.5" y2="14" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1.5" fill={s} stroke="none" />
    </svg>
  )
}

function IconLetter({ active }) {
  const s = active ? 'url(#nav-g)' : 'currentColor'
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" filter={active ? 'url(#nav-glow)' : 'none'}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <polyline points="2,5 12,13 22,5" />
      {active && <circle cx="12" cy="13" r="2" fill="url(#nav-g)" stroke="none" />}
    </svg>
  )
}

function IconMore({ active }) {
  const s = active ? 'url(#nav-g)' : 'currentColor'
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" filter={active ? 'url(#nav-glow)' : 'none'}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function IconCamera({ active }) {
  const s = active ? 'url(#nav-g)' : 'currentColor'
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" filter={active ? 'url(#nav-glow)' : 'none'}>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function IconCalendar({ active }) {
  const s = active ? 'url(#nav-g)' : 'currentColor'
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" filter={active ? 'url(#nav-glow)' : 'none'}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
      <circle cx="8"  cy="15" r="1.2" fill={s} stroke="none" />
      <circle cx="12" cy="15" r="1.2" fill={s} stroke="none" />
      <circle cx="16" cy="15" r="1.2" fill={s} stroke="none" />
    </svg>
  )
}

function IconPlans({ active }) {
  const s = active ? 'url(#nav-g)' : 'currentColor'
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" filter={active ? 'url(#nav-glow)' : 'none'}>
      <line x1="10" y1="6"  x2="20" y2="6"  />
      <line x1="10" y1="12" x2="20" y2="12" />
      <line x1="10" y1="18" x2="20" y2="18" />
      <polyline points="4,6  5.5,7.5  8,5"  />
      <polyline points="4,12 5.5,13.5 8,11" />
      <circle cx="6" cy="18" r="2" />
    </svg>
  )
}

function IconPerson({ active }) {
  const s = active ? 'url(#nav-g)' : 'currentColor'
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" filter={active ? 'url(#nav-glow)' : 'none'}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  )
}

// Tabs shown in the main nav bar
const MAIN_TABS = [
  { id: 'home',   label: 'Главная', Icon: IconHome   },
  { id: 'chat',   label: 'Чат',     Icon: IconChat   },
  { id: 'clock',  label: 'Часы',    Icon: IconClock  },
  { id: 'letter', label: 'Письмо',  Icon: IconLetter },
  { id: 'more',   label: 'Ещё',     Icon: IconMore   },
]

// Items inside the "More" drawer
const MORE_ITEMS = [
  { id: 'moments',  label: 'Фото',      Icon: IconCamera   },
  { id: 'calendar', label: 'Дни',       Icon: IconCalendar },
  { id: 'plans',    label: 'Планы',     Icon: IconPlans    },
  { id: 'settings', label: 'Профиль',   Icon: IconPerson   },
]

const MORE_IDS = MORE_ITEMS.map(m => m.id)

export default function Navigation({ activeTab, setActiveTab }) {
  const [pressing, setPressing]   = useState(null)
  const [bouncing, setBouncing]   = useState(null)
  const [showMore, setShowMore]   = useState(false)

  const isMoreActive = MORE_IDS.includes(activeTab)

  function handlePress(id) {
    if (id === 'more') {
      setShowMore(v => !v)
      setBouncing('more')
      setTimeout(() => setBouncing(null), 480)
      return
    }
    setPressing(id)
    setBouncing(id)
    setTimeout(() => setPressing(null), 200)
    setTimeout(() => setBouncing(null), 480)
    setActiveTab(id)
    setShowMore(false)
  }

  function handleMoreItem(id) {
    setActiveTab(id)
    setShowMore(false)
  }

  return (
    <>
      <style>{`
        .nav-new {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          background: rgba(255,245,247,0.92);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border-top: 0.5px solid var(--border, rgba(200,51,74,0.13));
          display: flex;
          align-items: stretch;
          height: calc(56px + env(safe-area-inset-bottom, 0px));
          padding-bottom: env(safe-area-inset-bottom, 0px);
          z-index: 50;
          box-shadow: 0 -1px 0 rgba(200,51,74,0.07), 0 -4px 24px rgba(200,51,74,0.06);
        }
        .app.dark .nav-new {
          background: rgba(19,5,8,0.94);
          border-top-color: rgba(200,51,74,0.18);
          box-shadow: 0 -1px 0 rgba(200,51,74,0.12), 0 -4px 24px rgba(0,0,0,0.4);
        }

        .nav-tab {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 9px 2px 8px;
          cursor: pointer;
          background: none;
          border: none;
          gap: 4px;
          position: relative;
          -webkit-tap-highlight-color: transparent;
          outline: none;
        }

        .nav-tab-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px; height: 30px;
          border-radius: 9px;
          transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), background 0.2s;
          color: var(--muted, #9A6070);
        }

        .nav-tab-icon svg {
          width: 26px; height: 26px;
          transition: filter 0.2s;
        }

        .nav-tab.active .nav-tab-icon {
          transform: translateY(-3px) scale(1.1);
          background: rgba(200,51,74,0.1);
          color: var(--rose, #C8334A);
        }

        .nav-tab.pressing .nav-tab-icon {
          transform: scale(0.86);
        }

        @keyframes navIconBounce {
          0%   { transform: scale(1) translateY(0); }
          18%  { transform: scale(0.80) translateY(3px); }
          52%  { transform: scale(1.28) translateY(-7px); }
          72%  { transform: scale(0.96) translateY(-2px); }
          100% { transform: scale(1.1) translateY(-3px); }
        }
        .nav-tab.bouncing .nav-tab-icon {
          animation: navIconBounce 0.46s cubic-bezier(0.22,1,0.36,1) both;
        }

        .nav-tab-label {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.2px;
          color: var(--muted, #9A6070);
          transition: color 0.2s;
          white-space: nowrap;
        }
        .nav-tab.active .nav-tab-label {
          color: var(--rose, #C8334A);
          font-weight: 600;
        }

        /* Active dot indicator */
        .nav-tab-dot {
          position: absolute;
          bottom: calc(env(safe-area-inset-bottom, 0px) + 4px);
          left: 50%;
          transform: translateX(-50%) scaleX(0);
          width: 18px; height: 3px;
          border-radius: 99px;
          background: var(--gradient-main, linear-gradient(160deg, #C8334A, #8B1A2C));
          transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        .nav-tab.active .nav-tab-dot {
          transform: translateX(-50%) scaleX(1);
        }

        /* ── More Drawer overlay ── */
        .more-overlay {
          position: fixed;
          inset: 0;
          z-index: 49;
          background: rgba(28,10,14,0.5);
          backdrop-filter: blur(8px);
          animation: fadeIn 0.2s ease;
        }

        .more-drawer {
          position: fixed;
          bottom: calc(56px + env(safe-area-inset-bottom, 0px));
          left: 0; right: 0;
          background: var(--surface, #FFFFFF);
          border-radius: 24px 24px 0 0;
          border-top: 0.5px solid var(--border, rgba(200,51,74,0.13));
          padding: 16px 20px 24px;
          z-index: 50;
          animation: slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
          box-shadow: 0 -8px 40px rgba(200,51,74,0.1);
        }
        .app.dark .more-drawer {
          background: #1E0A10;
          border-top-color: rgba(200,51,74,0.2);
          box-shadow: 0 -8px 40px rgba(0,0,0,0.5);
        }

        .more-handle {
          width: 36px; height: 4px;
          border-radius: 99px;
          background: var(--blush-2, #F2D0D6);
          margin: 0 auto 18px;
        }
        .app.dark .more-handle { background: #3D1520; }

        .more-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }

        .more-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 14px 8px;
          border-radius: 16px;
          cursor: pointer;
          background: var(--blush, #FBF0F2);
          border: 0.5px solid var(--border, rgba(200,51,74,0.13));
          transition: background 0.2s, transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
          -webkit-tap-highlight-color: transparent;
        }
        .app.dark .more-item { background: #3D1520; border-color: rgba(200,51,74,0.18); }
        .more-item:active, .more-item.active-item {
          background: rgba(200,51,74,0.12);
          transform: scale(0.95);
          border-color: rgba(200,51,74,0.3);
        }
        .more-item:not(:active):hover { transform: translateY(-2px); }

        .more-item-icon {
          width: 28px; height: 28px;
          color: var(--ink-mid, #4A2030);
          display: flex; align-items: center; justify-content: center;
        }
        .app.dark .more-item-icon { color: var(--ink-mid, #C4909A); }
        .more-item-icon svg { width: 26px; height: 26px; }
        .more-item.active-item .more-item-icon { color: var(--rose, #C8334A); }

        .more-item-label {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          color: var(--muted, #9A6070);
          text-align: center;
        }
        .more-item.active-item .more-item-label { color: var(--rose, #C8334A); font-weight: 600; }
      `}</style>

      <SvgDefs />

      {/* More drawer + overlay */}
      {showMore && (
        <>
          <div className="more-overlay" onClick={() => setShowMore(false)} />
          <div className="more-drawer">
            <div className="more-handle" />
            <div className="more-grid">
              {MORE_ITEMS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  className={`more-item${activeTab === id ? ' active-item' : ''}`}
                  onClick={() => handleMoreItem(id)}
                >
                  <span className="more-item-icon">
                    <Icon active={activeTab === id} />
                  </span>
                  <span className="more-item-label">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <nav className="nav-new">
        {MAIN_TABS.map(({ id, label, Icon }) => {
          const isActive = id === 'more' ? (isMoreActive || showMore) : activeTab === id
          return (
            <button
              key={id}
              className={`nav-tab${isActive ? ' active' : ''}${pressing === id ? ' pressing' : ''}${bouncing === id ? ' bouncing' : ''}`}
              onClick={() => handlePress(id)}
            >
              <div className="nav-tab-dot" />
              <span className="nav-tab-icon">
                <Icon active={isActive} />
              </span>
              <span className="nav-tab-label">{label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
