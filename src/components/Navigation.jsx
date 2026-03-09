import { useState } from 'react'

const TABS = [
  { id: 'home',     label: 'Главная',    icon: '🏠' },
  { id: 'chat',     label: 'Чат',        icon: '💬' },
  { id: 'clock',    label: 'Часы',       icon: '⏱️' },
  { id: 'letter',   label: 'Письмо',     icon: '💌' },
  { id: 'moments',  label: 'Фото',       icon: '📸' },
  { id: 'calendar', label: 'Дни',        icon: '📅' },
  { id: 'plans',    label: 'Планы',      icon: '📝' },
  { id: 'settings', label: 'Я',          icon: '⚙️' },
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
          bottom: 0;
          left: 0; right: 0;
          background: rgba(255,250,252,0.92);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border-top: 1px solid rgba(232,70,106,0.1);
          display: flex;
          align-items: stretch;
          padding-bottom: var(--safe-bottom, 0px);
          z-index: 50;
          box-shadow: 0 -4px 30px rgba(200,75,139,0.08);
        }
        .app.dark .nav-new {
          background: rgba(26,24,37,0.94);
          border-top-color: rgba(232,70,106,0.15);
          box-shadow: 0 -4px 30px rgba(0,0,0,0.3);
        }
        .nav-tab {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 8px 2px 10px;
          cursor: pointer;
          background: none;
          border: none;
          gap: 3px;
          position: relative;
          -webkit-tap-highlight-color: transparent;
          transition: transform 0.15s;
        }
        .nav-tab.pressing { transform: scale(0.88); }
        .nav-tab-icon {
          font-size: 22px;
          line-height: 1;
          transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), filter 0.2s;
          filter: grayscale(0.3) brightness(0.75);
        }
        .nav-tab.active .nav-tab-icon {
          transform: scale(1.2) translateY(-2px);
          filter: none;
        }
        .nav-tab-label {
          font-family: var(--font-body);
          font-size: 9.5px;
          font-weight: 600;
          color: var(--text-muted);
          letter-spacing: 0.2px;
          transition: color 0.2s;
          white-space: nowrap;
        }
        .nav-tab.active .nav-tab-label {
          color: var(--primary);
        }
        .nav-tab-dot {
          position: absolute;
          top: 6px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px; height: 4px;
          border-radius: 50%;
          background: var(--primary);
          opacity: 0;
          transition: opacity 0.2s, transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
        }
        .nav-tab.active .nav-tab-dot {
          opacity: 1;
          transform: translateX(-50%) translateY(-2px);
        }
        .app.dark .nav-tab-label { color: #7A6880; }
        .app.dark .nav-tab.active .nav-tab-label { color: var(--primary); }
      `}</style>

      <nav className="nav-new">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`nav-tab${activeTab === tab.id ? ' active' : ''}${pressing === tab.id ? ' pressing' : ''}`}
            onClick={() => handlePress(tab.id)}
          >
            <div className="nav-tab-dot" />
            <span className="nav-tab-icon">{tab.icon}</span>
            <span className="nav-tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
