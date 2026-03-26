import { useState } from 'react'

function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }} aria-hidden>
      <defs>
        <linearGradient id="nav-g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="var(--primary)" />
          <stop offset="100%" stopColor="#c84b8b" />
        </linearGradient>
        <filter id="nav-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="nav-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  )
}

function IconHome({ active }) {
  const s = active ? 'url(#nav-g)' : 'currentColor'
  const f = active ? 'url(#nav-g)' : 'none'
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" filter={active ? 'url(#nav-glow-strong)' : 'none'}>
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
      strokeLinecap="round" strokeLinejoin="round" filter={active ? 'url(#nav-glow-strong)' : 'none'}>
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
      strokeLinecap="round" filter={active ? 'url(#nav-glow-strong)' : 'none'}>
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
      strokeLinecap="round" strokeLinejoin="round" filter={active ? 'url(#nav-glow-strong)' : 'none'}>
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
      strokeLinecap="round" strokeLinejoin="round" filter={active ? 'url(#nav-glow-strong)' : 'none'}>
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
      strokeLinecap="round" strokeLinejoin="round" filter={active ? 'url(#nav-glow-strong)' : 'none'}>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function IconCalendar({ active }) {
  const s = active ? 'url(#nav-g)' : 'currentColor'
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" filter={active ? 'url(#nav-glow-strong)' : 'none'}>
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
      strokeLinecap="round" strokeLinejoin="round" filter={active ? 'url(#nav-glow-strong)' : 'none'}>
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
      strokeLinecap="round" strokeLinejoin="round" filter={active ? 'url(#nav-glow-strong)' : 'none'}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  )
}

const MAIN_TABS = [
  { id: 'home',   label: 'Главная', Icon: IconHome   },
  { id: 'chat',   label: 'Чат',     Icon: IconChat   },
  { id: 'clock',  label: 'Часы',    Icon: IconClock  },
  { id: 'letter', label: 'Письмо',  Icon: IconLetter },
  { id: 'more',   label: 'Ещё',     Icon: IconMore   },
]

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
        .nav-glass {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          background: rgba(255, 245, 247, 0.85);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border-top: 1px solid rgba(255, 255, 255, 0.6);
          display: flex;
          align-items: stretch;
          height: calc(64px + env(safe-area-inset-bottom, 0px));
          padding-bottom: env(safe-area-inset-bottom, 0px);
          z-index: 50;
          box-shadow: 
            0 -4px 24px rgba(232, 70, 106, 0.1),
            0 -1px 0 rgba(255, 255, 255, 0.8) inset;
        }

        .app.dark .nav-glass {
          background: rgba(26, 24, 37, 0.9);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 
            0 -4px 24px rgba(0, 0, 0, 0.4),
            0 -1px 0 rgba(255, 255, 255, 0.05) inset;
        }

        .nav-tab {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 10px 4px 8px;
          cursor: pointer;
          background: none;
          border: none;
          gap: 6px;
          position: relative;
          -webkit-tap-highlight-color: transparent;
          outline: none;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .nav-tab-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px; height: 44px;
          border-radius: 16px;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          color: var(--text-muted);
          background: transparent;
          position: relative;
        }

        .nav-tab-icon::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(232, 70, 106, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
          opacity: 0;
          transition: opacity 0.3s;
        }

        .nav-tab-icon svg {
          width: 24px; height: 24px;
          transition: all 0.3s;
          position: relative;
          z-index: 1;
        }

        .nav-tab:hover .nav-tab-icon {
          transform: translateY(-2px);
        }

        .nav-tab.active .nav-tab-icon {
          transform: translateY(-4px) scale(1.1);
          color: var(--primary);
        }

        .nav-tab.active .nav-tab-icon::before {
          opacity: 1;
        }

        .nav-tab.pressing .nav-tab-icon {
          transform: scale(0.9);
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
          font-weight: 600;
          letter-spacing: 0.3px;
          color: var(--text-muted);
          transition: all 0.3s;
          white-space: nowrap;
        }

        .nav-tab.active .nav-tab-label {
          color: var(--primary);
          font-weight: 700;
        }

        .nav-tab-dot {
          position: absolute;
          bottom: calc(env(safe-area-inset-bottom, 0px) + 6px);
          left: 50%;
          transform: translateX(-50%) scaleX(0);
          width: 20px; height: 4px;
          border-radius: 99px;
          background: linear-gradient(90deg, var(--primary), #c84b8b);
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 0 12px rgba(232, 70, 106, 0.5);
        }

        .nav-tab.active .nav-tab-dot {
          transform: translateX(-50%) scaleX(1);
        }

        .more-overlay {
          position: fixed;
          inset: 0;
          z-index: 49;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(8px);
          animation: fadeInOverlay 0.25s ease;
        }

        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .more-drawer {
          position: fixed;
          bottom: calc(64px + env(safe-area-inset-bottom, 0px));
          left: 16px; right: 16px;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(30px) saturate(180%);
          -webkit-backdrop-filter: blur(30px) saturate(180%);
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.6);
          padding: 20px 16px 24px;
          z-index: 50;
          animation: slideUpDrawer 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          box-shadow: 
            0 -8px 40px rgba(0, 0, 0, 0.15),
            0 0 0 1px rgba(255, 255, 255, 0.5) inset;
        }

        .app.dark .more-drawer {
          background: rgba(30, 27, 46, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 
            0 -8px 40px rgba(0, 0, 0, 0.5),
            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
        }

        @keyframes slideUpDrawer {
          from { transform: translateY(30px) scale(0.95); opacity: 0; }
          to   { transform: translateY(0) scale(1);    opacity: 1; }
        }

        .more-handle {
          width: 40px; height: 4px;
          border-radius: 99px;
          background: linear-gradient(90deg, transparent, rgba(232, 70, 106, 0.3), transparent);
          margin: 0 auto 20px;
        }

        .more-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .more-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 18px 8px;
          border-radius: 20px;
          cursor: pointer;
          background: rgba(232, 70, 106, 0.05);
          border: 1px solid rgba(232, 70, 106, 0.08);
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          -webkit-tap-highlight-color: transparent;
        }

        .more-item:hover {
          transform: translateY(-2px);
          background: rgba(232, 70, 106, 0.1);
          box-shadow: 0 4px 16px rgba(232, 70, 106, 0.15);
        }

        .more-item:active, .more-item.active-item {
          background: linear-gradient(135deg, rgba(232, 70, 106, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%);
          transform: scale(0.95);
          border-color: rgba(232, 70, 106, 0.3);
        }

        .more-item-icon {
          width: 32px; height: 32px;
          color: var(--text-light);
          display: flex; align-items: center; justify-content: center;
          transition: all 0.3s;
        }

        .more-item-icon svg { width: 28px; height: 28px; }

        .more-item.active-item .more-item-icon {
          color: var(--primary);
          filter: drop-shadow(0 0 8px rgba(232, 70, 106, 0.5));
        }

        .more-item-label {
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 600;
          color: var(--text-light);
          text-align: center;
          transition: color 0.3s;
        }

        .more-item.active-item .more-item-label {
          color: var(--primary);
          font-weight: 700;
        }
      `}</style>

      <SvgDefs />

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

      <nav className="nav-glass">
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
