import { useState } from 'react'

/* ── Shared SVG gradient / glow defs (referenced via url(#…) anywhere in doc) ── */
function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }} aria-hidden>
      <defs>
        <linearGradient id="nav-g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="var(--primary)" />
          <stop offset="100%" stopColor="#c84b8b" />
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
      {/* roof */}
      <path d="M3 11.5L12 4l9 7.5" />
      {/* walls + door */}
      <path d="M5 9.8V21h5v-5.5h4V21h5V9.8" />
      {/* heart detail when active */}
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
      {/* bubble */}
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      {/* dots */}
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
      {/* hour hand */}
      <line x1="12" y1="12" x2="12" y2="7.5" strokeWidth="2" />
      {/* minute hand */}
      <line x1="12" y1="12" x2="15.5" y2="14" strokeWidth="1.5" />
      {/* centre dot */}
      <circle cx="12" cy="12" r="1.5" fill={s} stroke="none" />
    </svg>
  )
}

function IconLetter({ active }) {
  const s = active ? 'url(#nav-g)' : 'currentColor'
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" filter={active ? 'url(#nav-glow)' : 'none'}>
      {/* envelope body */}
      <rect x="2" y="5" width="20" height="14" rx="2" />
      {/* flap V */}
      <polyline points="2,5 12,13 22,5" />
      {/* wax seal dot when active */}
      {active && <circle cx="12" cy="13" r="2" fill="url(#nav-g)" stroke="none" />}
    </svg>
  )
}

function IconCamera({ active }) {
  const s = active ? 'url(#nav-g)' : 'currentColor'
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" filter={active ? 'url(#nav-glow)' : 'none'}>
      {/* body */}
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      {/* lens */}
      <circle cx="12" cy="13" r="4" />
      {/* lens inner highlight */}
      {active && <circle cx="12" cy="13" r="2" fill="url(#nav-g)" stroke="none" />}
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
      {/* day dots */}
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
      {/* lines */}
      <line x1="10" y1="6"  x2="20" y2="6"  />
      <line x1="10" y1="12" x2="20" y2="12" />
      <line x1="10" y1="18" x2="20" y2="18" />
      {/* checkmarks */}
      <polyline points="4,6  5.5,7.5  8,5"  />
      <polyline points="4,12 5.5,13.5 8,11" />
      {/* pending circle */}
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

const ICON_MAP = {
  home:     IconHome,
  chat:     IconChat,
  clock:    IconClock,
  letter:   IconLetter,
  moments:  IconCamera,
  calendar: IconCalendar,
  plans:    IconPlans,
  settings: IconPerson,
}

const TABS = [
  { id: 'home',     label: 'Главная',  icon: 'home'     },
  { id: 'chat',     label: 'Чат',      icon: 'chat'     },
  { id: 'clock',    label: 'Часы',     icon: 'clock'    },
  { id: 'letter',   label: 'Письмо',   icon: 'letter'   },
  { id: 'moments',  label: 'Фото',     icon: 'moments'  },
  { id: 'calendar', label: 'Дни',      icon: 'calendar' },
  { id: 'plans',    label: 'Планы',    icon: 'plans'    },
  { id: 'settings', label: 'Я',        icon: 'settings' },
]

export default function Navigation({ activeTab, setActiveTab }) {
  const [pressing, setPressing] = useState(null)

  function handlePress(id) {
    setPressing(id)
    setTimeout(() => setPressing(null), 200)
    setActiveTab(id)
  }

  return (
    <>
      <style>{`
        .nav-new {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          background: rgba(255,250,252,0.94);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border-top: 1px solid rgba(232,70,106,0.08);
          display: flex;
          align-items: stretch;
          padding-bottom: var(--safe-bottom, 0px);
          z-index: 50;
          box-shadow: 0 -1px 0 rgba(232,70,106,0.06), 0 -8px 40px rgba(200,75,139,0.06);
        }
        .app.dark .nav-new {
          background: rgba(22,20,34,0.96);
          border-top-color: rgba(232,70,106,0.12);
          box-shadow: 0 -1px 0 rgba(232,70,106,0.1), 0 -8px 40px rgba(0,0,0,0.35);
        }

        .nav-tab {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 9px 2px 10px;
          cursor: pointer;
          background: none;
          border: none;
          gap: 4px;
          position: relative;
          -webkit-tap-highlight-color: transparent;
          outline: none;
        }

        /* Icon wrapper */
        .nav-tab-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px; height: 28px;
          border-radius: 8px;
          transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1),
                      background 0.2s;
          color: var(--text-muted);
        }
        .app.dark .nav-tab-icon { color: #56475e; }

        .nav-tab-icon svg {
          width: 22px; height: 22px;
          transition: filter 0.2s;
        }

        /* Active state */
        .nav-tab.active .nav-tab-icon {
          transform: translateY(-3px) scale(1.1);
          background: rgba(232,70,106,0.07);
          color: var(--primary);
        }
        .app.dark .nav-tab.active .nav-tab-icon {
          background: rgba(232,70,106,0.12);
        }

        /* Press animation */
        .nav-tab.pressing .nav-tab-icon {
          transform: scale(0.86);
        }

        /* Label */
        .nav-tab-label {
          font-family: var(--font-body);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.3px;
          color: var(--text-muted);
          transition: color 0.2s;
          white-space: nowrap;
          text-transform: uppercase;
        }
        .app.dark .nav-tab-label { color: #56475e; }
        .nav-tab.active .nav-tab-label {
          color: var(--primary);
        }

        /* Active pill indicator */
        .nav-tab-pill {
          position: absolute;
          top: 4px;
          left: 50%;
          transform: translateX(-50%) scaleX(0);
          width: 20px; height: 3px;
          border-radius: 99px;
          background: linear-gradient(90deg, var(--primary), #c84b8b);
          transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        .nav-tab.active .nav-tab-pill {
          transform: translateX(-50%) scaleX(1);
        }
      `}</style>

      <SvgDefs />

      <nav className="nav-new">
        {TABS.map(tab => {
          const Icon = ICON_MAP[tab.icon]
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              className={`nav-tab${isActive ? ' active' : ''}${pressing === tab.id ? ' pressing' : ''}`}
              onClick={() => handlePress(tab.id)}
            >
              <div className="nav-tab-pill" />
              <span className="nav-tab-icon">
                <Icon active={isActive} />
              </span>
              <span className="nav-tab-label">{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
