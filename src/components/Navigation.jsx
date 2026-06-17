import { memo } from 'react'

/* ── Tab icons — stroke-based, clean ── */
function IconHome({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
      stroke="currentColor" strokeWidth={active ? '2' : '1.7'}>
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M5 9.8V21h5v-5.5h4V21h5V9.8" />
    </svg>
  )
}
function IconChat({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
      stroke="currentColor" strokeWidth={active ? '2' : '1.7'}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
}
function IconCamera({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
      stroke="currentColor" strokeWidth={active ? '2' : '1.7'}>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}
function IconCalendar({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
      stroke="currentColor" strokeWidth={active ? '2' : '1.7'}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}
function IconPerson({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
      stroke="currentColor" strokeWidth={active ? '2' : '1.7'}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  )
}

/* 5 direct destinations — nothing hidden, no popups */
const TABS = [
  { id: 'home',     label: 'Главная', Icon: IconHome     },
  { id: 'chat',     label: 'Чат',     Icon: IconChat     },
  { id: 'moments',  label: 'Фото',    Icon: IconCamera   },
  { id: 'calendar', label: 'Дни',     Icon: IconCalendar },
  { id: 'settings', label: 'Профиль', Icon: IconPerson   },
]

// Sections reachable from the Профиль screen (kept routable)
export const EXTRA_SECTIONS = ['advisor', 'plans', 'premium']

function Navigation({ activeTab, setActiveTab }) {
  // map extra sections onto the Профиль tab so it stays highlighted there
  const current = EXTRA_SECTIONS.includes(activeTab) ? 'settings' : activeTab

  return (
    <>
      <style>{`
        .nav-bar {
          position: fixed;
          left: 0; right: 0; bottom: 0;
          z-index: 50;
          display: flex;
          height: calc(60px + env(safe-area-inset-bottom, 0px));
          padding-bottom: env(safe-area-inset-bottom, 0px);
          background: rgba(22, 11, 16, 0.86);
          backdrop-filter: blur(22px) saturate(160%);
          -webkit-backdrop-filter: blur(22px) saturate(160%);
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .navb-tab {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          background: none;
          border: none;
          cursor: pointer;
          position: relative;
          -webkit-tap-highlight-color: transparent;
          color: rgba(255,255,255,0.5);
          transition: color 0.2s ease;
          padding-top: 6px;
        }
        .navb-tab:active { transform: translateY(1px); }
        .navb-tab.active { color: #ff8da0; }

        .navb-icon-wrap {
          width: 52px; height: 30px;
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          position: relative;
          transition: background 0.25s ease;
        }
        .navb-tab.active .navb-icon-wrap {
          background: linear-gradient(135deg, rgba(255,141,160,0.26), rgba(216,69,107,0.18));
        }
        .navb-icon-wrap svg {
          width: 24px; height: 24px;
          transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1);
        }
        .navb-tab.active .navb-icon-wrap svg { transform: translateY(-1px) scale(1.06); }

        .navb-label {
          font-family: var(--font-body, sans-serif);
          font-size: 10.5px;
          font-weight: 500;
          letter-spacing: 0.1px;
          line-height: 1;
        }
        .navb-tab.active .navb-label { font-weight: 700; }
      `}</style>

      <nav className="nav-bar">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = current === id
          return (
            <button
              key={id}
              className={`navb-tab${isActive ? ' active' : ''}`}
              onClick={() => setActiveTab(id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="navb-icon-wrap"><Icon active={isActive} /></span>
              <span className="navb-label">{label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}

export default memo(Navigation)
