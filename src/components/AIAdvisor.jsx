import { useState } from 'react'
import SyncMirror from './SyncMirror'
import TimeCapsule from './TimeCapsule'
import WarmthBarometer from './WarmthBarometer'
import InsightsWidget from './InsightsWidget'

// Icon for Mirror tab
function IconMirror({ active }) {
  const color = active ? '#C8334A' : '#9A6070'
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="10" rx="7" ry="9" />
      <path d="M9 21h6" />
      <path d="M12 19v2" />
    </svg>
  )
}

// Icon for Capsule tab
function IconCapsule({ active }) {
  const color = active ? '#C8334A' : '#9A6070'
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v10M12 12v10M6 7h12M6 17h12" />
      <circle cx="12" cy="12" r="2" fill={color} />
    </svg>
  )
}

// Icon for Warmth tab
function IconWarmth({ active }) {
  const color = active ? '#C8334A' : '#9A6070'
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2c-1.5 2-3 4-3 7 0 2.5 1.3 4.7 3 6 1.7-1.3 3-3.5 3-6 0-3-1.5-5-3-7z" />
      <path d="M12 15c-2.8 1-5 3.2-5 5.5 0 3 2.2 5.5 5 5.5s5-2.5 5-5.5c0-2.3-2.2-4.5-5-5.5z" />
    </svg>
  )
}

// Icon for Insights tab
function IconInsights({ active }) {
  const color = active ? '#C8334A' : '#9A6070'
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" fill={color} />
      <path d="M12 7v10M7 12h10M8.6 7.4l6.8 6.8M8.6 16.4l6.8-6.8" />
    </svg>
  )
}

export default function AIAdvisor({ session, profile, darkMode }) {
  const [activeView, setActiveView] = useState('mirror')

  const views = [
    { id: 'mirror', label: 'Зеркало', Icon: IconMirror },
    { id: 'capsule', label: 'Капсула', Icon: IconCapsule },
    { id: 'warmth', label: 'Теплота', Icon: IconWarmth },
    { id: 'insights', label: 'Советы', Icon: IconInsights },
  ]

  return (
    <div className={`advisor-view${darkMode ? ' dark' : ''}`}>
      <style>{`
        .advisor-view {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--surface, #FFFFFF);
          color: var(--text, #1E0A10);
          overflow: hidden;
        }
        .advisor-view.dark {
          background: #0F0408;
          color: #F5E6EB;
        }

        .advisor-header {
          padding: max(12px, env(safe-area-inset-top)) 20px 16px;
          border-bottom: 0.5px solid var(--border, rgba(200,51,74,0.13));
          background: rgba(255,245,247,0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .advisor-view.dark .advisor-header {
          background: rgba(15,4,8,0.8);
          border-bottom-color: rgba(200,51,74,0.18);
        }

        .advisor-title {
          font-family: var(--font-head);
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.5px;
          margin-bottom: 16px;
          background: linear-gradient(135deg, #C8334A, #8B1A2C);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .advisor-tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          padding: 0 16px 12px;
        }
        .advisor-tabs::-webkit-scrollbar { display: none; }

        .advisor-tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 12px;
          border: 1px solid var(--border, rgba(200,51,74,0.13));
          background: var(--blush, #FBF0F2);
          cursor: pointer;
          white-space: nowrap;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 500;
          color: var(--muted, #9A6070);
          transition: all 0.2s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .advisor-view.dark .advisor-tab-btn {
          background: #3D1520;
          border-color: rgba(200,51,74,0.18);
          color: #C4909A;
        }

        .advisor-tab-btn.active {
          background: linear-gradient(135deg, #C8334A, #8B1A2C);
          color: #FFFFFF;
          border-color: transparent;
        }

        .advisor-tab-btn:active:not(.active) {
          transform: scale(0.96);
        }

        .advisor-content {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
        }

        .advisor-section {
          animation: fadeInUp 0.3s ease;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="advisor-header">
        <div className="advisor-title">Советник пары</div>
        <div className="advisor-tabs">
          {views.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`advisor-tab-btn${activeView === id ? ' active' : ''}`}
              onClick={() => setActiveView(id)}
            >
              <Icon active={activeView === id} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="advisor-content">
        <div className="advisor-section">
          {activeView === 'mirror' && (
            <SyncMirror session={session} profile={profile} darkMode={darkMode} />
          )}
          {activeView === 'capsule' && (
            <TimeCapsule session={session} profile={profile} darkMode={darkMode} />
          )}
          {activeView === 'warmth' && (
            <WarmthBarometer session={session} profile={profile} darkMode={darkMode} />
          )}
          {activeView === 'insights' && (
            <InsightsWidget session={session} profile={profile} darkMode={darkMode} />
          )}
        </div>
      </div>
    </div>
  )
}
