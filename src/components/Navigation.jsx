import { useState } from 'react'

/* ── Individual SVG icons — stroke-based, clean ── */
function IconHome({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
      stroke={active ? 'var(--rose,#A8283C)' : 'currentColor'}
      strokeWidth={active ? '1.7' : '1.5'}>
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M5 9.8V21h5v-5.5h4V21h5V9.8" />
    </svg>
  )
}

function IconChat({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
      stroke={active ? 'var(--rose,#A8283C)' : 'currentColor'}
      strokeWidth={active ? '1.7' : '1.5'}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
}

function IconClock({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round"
      stroke={active ? 'var(--rose,#A8283C)' : 'currentColor'}
      strokeWidth={active ? '1.7' : '1.5'}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="12" x2="12" y2="7.5" strokeWidth={active ? '1.9' : '1.7'} />
      <line x1="12" y1="12" x2="15.5" y2="14" strokeWidth="1.5" />
    </svg>
  )
}

function IconLetter({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
      stroke={active ? 'var(--rose,#A8283C)' : 'currentColor'}
      strokeWidth={active ? '1.7' : '1.5'}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <polyline points="2,5 12,13 22,5" />
    </svg>
  )
}

function IconMore({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
      stroke={active ? 'var(--rose,#A8283C)' : 'currentColor'}
      strokeWidth={active ? '1.7' : '1.5'}>
      <circle cx="5"  cy="12" r="1.2" fill={active ? 'var(--rose,#A8283C)' : 'currentColor'} stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill={active ? 'var(--rose,#A8283C)' : 'currentColor'} stroke="none" />
      <circle cx="19" cy="12" r="1.2" fill={active ? 'var(--rose,#A8283C)' : 'currentColor'} stroke="none" />
    </svg>
  )
}

function IconCamera({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
      stroke={active ? 'var(--rose,#A8283C)' : 'currentColor'}
      strokeWidth={active ? '1.7' : '1.5'}>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function IconCalendar({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
      stroke={active ? 'var(--rose,#A8283C)' : 'currentColor'}
      strokeWidth={active ? '1.7' : '1.5'}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  )
}

function IconPlans({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
      stroke={active ? 'var(--rose,#A8283C)' : 'currentColor'}
      strokeWidth={active ? '1.7' : '1.5'}>
      <line x1="10" y1="6"  x2="20" y2="6"  />
      <line x1="10" y1="12" x2="20" y2="12" />
      <line x1="10" y1="18" x2="20" y2="18" />
      <polyline points="4,6  5.5,7.5  8,5"  />
      <polyline points="4,12 5.5,13.5 8,11" />
      <circle cx="6" cy="18" r="1.8" />
    </svg>
  )
}

function IconAdvisor({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
      stroke={active ? 'var(--rose,#A8283C)' : 'currentColor'}
      strokeWidth={active ? '1.7' : '1.5'}>
      <path d="M12 2c-1.5 2-3 4-3 7 0 2.5 1.3 4.7 3 6 1.7-1.3 3-3.5 3-6 0-3-1.5-5-3-7z" />
      <path d="M12 15c-2.8 1-5 3.2-5 5.5 0 3 2.2 5.5 5 5.5s5-2.5 5-5.5c0-2.3-2.2-4.5-5-5.5z" />
    </svg>
  )
}

function IconPerson({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
      stroke={active ? 'var(--rose,#A8283C)' : 'currentColor'}
      strokeWidth={active ? '1.7' : '1.5'}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  )
}

function IconPremium({ active }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
      stroke={active ? 'var(--rose,#A8283C)' : 'currentColor'}
      strokeWidth={active ? '1.7' : '1.5'}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

const MAIN_TABS = [
  { id: 'home',    label: 'Главная', Icon: IconHome   },
  { id: 'chat',    label: 'Чат',     Icon: IconChat   },
  { id: 'moments', label: 'Фото',    Icon: IconCamera },
  { id: 'more',    label: 'Ещё',     Icon: IconMore   },
]

const MORE_ITEMS = [
  { id: 'letter',   label: 'Письмо',    Icon: IconLetter   },
  { id: 'advisor',  label: 'Советник',  Icon: IconAdvisor  },
  { id: 'clock',    label: 'Часы',      Icon: IconClock    },
  { id: 'calendar', label: 'Дни',       Icon: IconCalendar },
  { id: 'plans',    label: 'Планы',     Icon: IconPlans    },
  { id: 'premium',  label: 'Premium',   Icon: IconPremium  },
  { id: 'settings', label: 'Профиль',   Icon: IconPerson   },
]

const QUICK_ADD = [
  { id: 'moments',  label: 'Добавить фото',   Icon: IconCamera   },
  { id: 'letter',   label: 'Написать письмо', Icon: IconLetter   },
  { id: 'calendar', label: 'Добавить событие',Icon: IconCalendar },
]

const MORE_IDS = MORE_ITEMS.map(m => m.id)

export default function Navigation({ activeTab, setActiveTab }) {
  const [showMore, setShowMore] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const isMoreActive = MORE_IDS.includes(activeTab)

  function handlePress(id) {
    if (id === 'more') {
      setShowAdd(false)
      setShowMore(v => !v)
      return
    }
    setActiveTab(id)
    setShowMore(false)
    setShowAdd(false)
  }

  function handleMoreItem(id) {
    setActiveTab(id)
    setShowMore(false)
  }

  function handleQuickAdd(id) {
    setActiveTab(id)
    setShowAdd(false)
  }

  function toggleAdd() {
    setShowMore(false)
    setShowAdd(v => !v)
  }

  return (
    <>
      <style>{`
        /* ── Bottom nav bar ── */
        .nav-new {
          --rose: #ff9bb0;
          --muted: rgba(255,255,255,0.58);
          position: fixed;
          bottom: 0; left: 0; right: 0;
          background: #160a10;
          border-top: 0.5px solid rgba(255,255,255,0.10);
          display: flex;
          align-items: stretch;
          height: calc(56px + env(safe-area-inset-bottom, 0px));
          padding-bottom: env(safe-area-inset-bottom, 0px);
          z-index: 50;
        }
        .app.dark .nav-new {
          background: #120810;
          border-top-color: rgba(255,255,255,0.08);
        }

        /* ── Individual tab button ── */
        .nav-tab {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 7px 2px 8px;
          cursor: pointer;
          background: none;
          border: none;
          gap: 3px;
          position: relative;
          -webkit-tap-highlight-color: transparent;
          outline: none;
          transition: opacity 0.15s;
        }
        .nav-tab:active { opacity: 0.65; }

        /* Pill background that grows when active */
        .nav-tab-pill {
          position: absolute;
          top: 6px; left: 50%;
          transform: translateX(-50%) scale(0);
          width: 48px; height: 30px;
          border-radius: 15px;
          background: rgba(255,155,176,0.16);
          transition: transform 0.28s cubic-bezier(0.22,1,0.36,1);
          pointer-events: none;
        }
        .app.dark .nav-tab-pill {
          background: rgba(255,155,176,0.14);
        }
        .nav-tab.active .nav-tab-pill {
          transform: translateX(-50%) scale(1);
        }

        .nav-tab-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px; height: 28px;
          position: relative; z-index: 1;
          transition: transform 0.25s cubic-bezier(0.22,1,0.36,1);
          color: var(--muted, #8A8480);
        }
        .nav-tab-icon svg { width: 22px; height: 22px; }
        .nav-tab.active .nav-tab-icon { transform: translateY(-1px); }

        .nav-tab-label {
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 0.1px;
          color: var(--muted, #8A8480);
          transition: color 0.2s;
          white-space: nowrap;
          position: relative; z-index: 1;
        }
        .nav-tab.active .nav-tab-label {
          color: var(--rose, #A8283C);
          font-weight: 500;
        }

        /* ── Center "+" floating action button ── */
        .nav-fab-slot {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .nav-fab {
          position: absolute;
          top: -18px;
          left: 50%;
          transform: translateX(-50%);
          width: 54px; height: 54px;
          border-radius: 50%;
          background: linear-gradient(160deg, #ff8da0 0%, #d8456b 100%);
          border: 4px solid #160a10;
          box-shadow: 0 8px 22px rgba(216,69,107,0.5);
          display: flex; align-items: center; justify-content: center;
          color: #fff;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .app.dark .nav-fab { border-color: #120810; }
        .nav-fab:active { transform: translateX(-50%) scale(0.9); }
        .nav-fab-icon {
          width: 26px; height: 26px;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
        }
        .nav-fab-icon svg { width: 24px; height: 24px; }
        .nav-fab.open .nav-fab-icon { transform: rotate(135deg); }

        /* quick-add sheet title */
        .more-title {
          font-family: var(--font-display, serif);
          font-size: 19px;
          color: var(--text, #1A1714);
          text-align: center;
          margin: 2px 0 14px;
        }
        .app.dark .more-title { color: #EDE9E2; }

        /* ── More drawer overlay ── */
        .more-overlay {
          position: fixed; inset: 0; z-index: 49;
          background: rgba(10,8,6,0.55);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          animation: fadeIn 0.18s ease;
        }

        .more-drawer {
          position: fixed;
          bottom: calc(58px + env(safe-area-inset-bottom, 0px));
          left: 0; right: 0;
          background: var(--surface, #FFFFFF);
          border-radius: 20px 20px 0 0;
          border-top: 0.5px solid var(--border, rgba(0,0,0,0.07));
          padding: 14px 16px 20px;
          z-index: 50;
          animation: slideUp 0.28s cubic-bezier(0.22,1,0.36,1) both;
          box-shadow: 0 -12px 48px rgba(0,0,0,0.1);
        }
        .app.dark .more-drawer {
          background: #151412;
          border-top-color: rgba(255,255,255,0.05);
          box-shadow: 0 -12px 48px rgba(0,0,0,0.5);
        }

        .more-handle {
          width: 32px; height: 3px;
          border-radius: 99px;
          background: var(--blush-2, #EAE5DC);
          margin: 0 auto 16px;
        }
        .app.dark .more-handle { background: rgba(255,255,255,0.1); }

        .more-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .more-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 7px;
          padding: 16px 6px 13px;
          border-radius: 14px;
          cursor: pointer;
          background: var(--blush, #F6F3EE);
          border: 0.5px solid var(--border, rgba(0,0,0,0.07));
          transition: opacity 0.15s, transform 0.15s, background 0.2s, border-color 0.2s;
          -webkit-tap-highlight-color: transparent;
        }
        .app.dark .more-item { background: #1A1916; border-color: rgba(255,255,255,0.05); }
        .more-item:active { opacity: 0.65; transform: scale(0.96); }

        .more-item.active-item {
          background: hsl(var(--h,349), var(--s,59%), 96%);
          border-color: hsl(var(--h,349), var(--s,59%), 87%);
        }
        .app.dark .more-item.active-item {
          background: hsl(var(--h,349), var(--s,59%), 12%);
          border-color: hsl(var(--h,349), var(--s,59%), 22%);
        }

        .more-item-icon {
          width: 26px; height: 26px;
          color: var(--ink-mid, #48423C);
          display: flex; align-items: center; justify-content: center;
        }
        .app.dark .more-item-icon { color: var(--ink-mid, #9E9990); }
        .more-item-icon svg { width: 22px; height: 22px; }
        .more-item.active-item .more-item-icon { color: var(--rose, #A8283C); }

        .more-item-label {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 400;
          color: var(--muted, #8A8480);
          text-align: center;
        }
        .more-item.active-item .more-item-label {
          color: var(--rose, #A8283C);
          font-weight: 500;
        }
      `}</style>

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

      {showAdd && (
        <>
          <div className="more-overlay" onClick={() => setShowAdd(false)} />
          <div className="more-drawer">
            <div className="more-handle" />
            <div className="more-title">Что добавим?</div>
            <div className="more-grid">
              {QUICK_ADD.map(({ id, label, Icon }) => (
                <button key={id} className="more-item" onClick={() => handleQuickAdd(id)}>
                  <span className="more-item-icon"><Icon active={false} /></span>
                  <span className="more-item-label">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <nav className="nav-new">
        {MAIN_TABS.slice(0, 2).map(({ id, label, Icon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              className={`nav-tab${isActive ? ' active' : ''}`}
              onClick={() => handlePress(id)}
            >
              <div className="nav-tab-pill" />
              <span className="nav-tab-icon"><Icon active={isActive} /></span>
              <span className="nav-tab-label">{label}</span>
            </button>
          )
        })}

        <div className="nav-fab-slot">
          <button
            className={`nav-fab${showAdd ? ' open' : ''}`}
            onClick={toggleAdd}
            aria-label="Добавить"
          >
            <span className="nav-fab-icon"><IconPlus /></span>
          </button>
        </div>

        {MAIN_TABS.slice(2).map(({ id, label, Icon }) => {
          const isActive = id === 'more' ? (isMoreActive || showMore) : activeTab === id
          return (
            <button
              key={id}
              className={`nav-tab${isActive ? ' active' : ''}`}
              onClick={() => handlePress(id)}
            >
              <div className="nav-tab-pill" />
              <span className="nav-tab-icon"><Icon active={isActive} /></span>
              <span className="nav-tab-label">{label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
