import { useRef, useState } from 'react'

/* ── Icons ── */
function IHome() {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5L12 4l9 7.5" /><path d="M5 9.8V21h5v-5.5h4V21h5V9.8" /></svg>)
}
function IChat() {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>)
}
function ICamera() {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>)
}
function ICalendar() {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>)
}
function IPlans() {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /><polyline points="4,6 5.5,7.5 8,5" /><polyline points="4,12 5.5,13.5 8,11" /><circle cx="6" cy="18" r="1.6" /></svg>)
}
function IPerson() {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg>)
}

const ITEMS = [
  { id: 'home',     label: 'Главная', Icon: IHome     },
  { id: 'chat',     label: 'Чат',     Icon: IChat     },
  { id: 'moments',  label: 'Фото',    Icon: ICamera   },
  { id: 'calendar', label: 'Дни',     Icon: ICalendar },
  { id: 'plans',    label: 'Планы',   Icon: IPlans    },
  { id: 'settings', label: 'Профиль', Icon: IPerson   },
]

// Sections that live inside the Профиль screen — keep Профиль highlighted for them
const EXTRA = ['advisor', 'premium', 'mirror']

const MAX = 1.4       // peak magnification (gentle)
const INFLUENCE = 70  // px radius of the magnify falloff
const RISE = 14       // px the icon lifts at peak

export default function Navigation({ activeTab, setActiveTab }) {
  const refs = useRef([])
  const BASE = useRef(ITEMS.map(() => 1)).current
  const [scales, setScales] = useState(BASE)
  const current = EXTRA.includes(activeTab) ? 'settings' : activeTab

  function magnify(clientX) {
    const next = refs.current.map(el => {
      if (!el) return 1
      const r = el.getBoundingClientRect()
      const c = r.left + r.width / 2
      const d = Math.abs(clientX - c)
      const t = Math.max(0, 1 - d / INFLUENCE)
      return 1 + (MAX - 1) * t
    })
    setScales(next)
  }

  function clearMag() {
    setScales(BASE)
  }

  function pick(id) {
    setActiveTab(id)
    clearMag()
  }

  return (
    <>
      <style>{`
        .dock {
          position: fixed;
          left: 50%;
          bottom: calc(env(safe-area-inset-bottom, 0px) + 10px);
          transform: translateX(-50%);
          z-index: 50;
          display: flex;
          align-items: flex-end;
          gap: 2px;
          padding: 7px 8px;
          border-radius: 22px;
          background: rgba(24, 12, 18, 0.66);
          backdrop-filter: blur(28px) saturate(180%);
          -webkit-backdrop-filter: blur(28px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.13);
          box-shadow: 0 14px 38px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.10);
          touch-action: none;
        }
        .dk-item {
          width: 48px;
          flex-shrink: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: flex-end;
          gap: 2px;
          background: none; border: none; padding: 0; cursor: pointer;
          position: relative;
          -webkit-tap-highlight-color: transparent;
        }
        .dk-ic {
          width: 38px; height: 38px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          color: rgba(235,235,245,0.5);
          transform-origin: center bottom;
          transition: transform 0.18s cubic-bezier(0.22,1,0.36,1), color 0.2s ease, background 0.2s ease;
          will-change: transform;
        }
        .dk-ic svg { width: 22px; height: 22px; }
        .dk-item.active .dk-ic {
          color: #ff8da0;
          background: linear-gradient(160deg, rgba(255,141,160,0.22), rgba(216,69,107,0.14));
          transform: translateY(-2px) scale(1.06);
        }
        .dk-label {
          font-family: var(--font-body, sans-serif);
          font-size: 9px; font-weight: 600; line-height: 1;
          letter-spacing: 0.1px;
          color: rgba(235,235,245,0.45);
          white-space: nowrap;
          transition: color 0.2s ease;
        }
        .dk-item.active .dk-label { color: #ff8da0; }
      `}</style>

      <nav
        className="dock"
        onMouseMove={e => magnify(e.clientX)}
        onMouseLeave={clearMag}
        onTouchStart={e => magnify(e.touches[0].clientX)}
        onTouchMove={e => magnify(e.touches[0].clientX)}
        onTouchEnd={clearMag}
        onTouchCancel={clearMag}
      >
        {ITEMS.map(({ id, label, Icon }, i) => {
          const isActive = current === id
          const s = scales[i] || 1
          const icStyle = s > 1.001
            ? { transform: `translateY(${-(s - 1) * RISE}px) scale(${s})` }
            : undefined
          return (
            <button
              key={id}
              ref={el => { refs.current[i] = el }}
              className={`dk-item${isActive ? ' active' : ''}`}
              onClick={() => pick(id)}
              aria-label={label}
            >
              <span className="dk-ic" style={icStyle}><Icon /></span>
              <span className="dk-label">{label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
