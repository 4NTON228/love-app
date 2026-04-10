import { useState } from 'react'
import SyncMirror from './SyncMirror'
import TimeCapsule from './TimeCapsule'
import WarmthBarometer from './WarmthBarometer'
import InsightsWidget from './InsightsWidget'
import PrivateJournal from './PrivateJournal'
import EmotionTranslator from './EmotionTranslator'
import Contracts from './Contracts'

const VIEWS = [
  {
    id: 'mirror',
    label: 'Зеркало',
    desc: 'Синхронность пары',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="10" rx="7" ry="9" />
        <path d="M9 21h6M12 19v2" />
      </svg>
    ),
    gradient: 'linear-gradient(135deg, #C8334A 0%, #6B0F1F 100%)',
    glow: 'rgba(200,51,74,0.35)',
  },
  {
    id: 'capsule',
    label: 'Капсула',
    desc: 'Письма будущему',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    gradient: 'linear-gradient(135deg, #7B3FBE 0%, #3D1A6B 100%)',
    glow: 'rgba(123,63,190,0.35)',
  },
  {
    id: 'warmth',
    label: 'Теплота',
    desc: 'Барометр общения',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2c-1.5 2-3 4-3 7 0 2.5 1.3 4.7 3 6 1.7-1.3 3-3.5 3-6 0-3-1.5-5-3-7z" />
        <path d="M12 15c-2.8 1-5 3.2-5 5.5 0 3 2.2 5.5 5 5.5s5-2.5 5-5.5c0-2.3-2.2-4.5-5-5.5z" />
      </svg>
    ),
    gradient: 'linear-gradient(135deg, #E8753A 0%, #8B2200 100%)',
    glow: 'rgba(232,117,58,0.35)',
  },
  {
    id: 'insights',
    label: 'Советы ИИ',
    desc: 'Персональный анализ',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.5 2A2.5 2.5 0 007 4.5A2.5 2.5 0 004.5 7A2.5 2.5 0 002 9.5v5A2.5 2.5 0 004.5 17A2.5 2.5 0 007 19.5A2.5 2.5 0 009.5 22h5a2.5 2.5 0 002.5-2.5 2.5 2.5 0 002.5-2.5 2.5 2.5 0 002.5-2.5v-5A2.5 2.5 0 0019.5 7 2.5 2.5 0 0017 4.5 2.5 2.5 0 0014.5 2z"/>
        <path d="M12 5v14M9 9h6M9 15h6" />
      </svg>
    ),
    gradient: 'linear-gradient(135deg, #2B8FD8 0%, #0D4A7A 100%)',
    glow: 'rgba(43,143,216,0.35)',
  },
  {
    id: 'journal',
    label: 'Дневник',
    desc: 'Личные заметки',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    gradient: 'linear-gradient(135deg, #7B3FBE 0%, #1A0A2E 100%)',
    glow: 'rgba(123,63,190,0.4)',
  },
  {
    id: 'translator',
    label: 'Переводчик',
    desc: 'Смягчи эмоции',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8l6 6" />
        <path d="M4 14l6-6 2-3" />
        <path d="M2 5h12" />
        <path d="M7 2h1" />
        <path d="M22 22l-5-10-5 10" />
        <path d="M14 18h6" />
      </svg>
    ),
    gradient: 'linear-gradient(135deg, #2B8F50 0%, #0D2A18 100%)',
    glow: 'rgba(43,143,80,0.4)',
  },
  {
    id: 'contracts',
    label: 'Контракты',
    desc: 'Договорённости пары',
    icon: (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    gradient: 'linear-gradient(135deg, #2B64D8 0%, #0D1A4A 100%)',
    glow: 'rgba(43,100,216,0.4)',
  },
]

export default function AIAdvisor({ session, profile, darkMode }) {
  const [activeView, setActiveView] = useState(null)
  // For journal → translator flow
  const [translatorInitialText, setTranslatorInitialText] = useState(null)

  const current = VIEWS.find(v => v.id === activeView)

  function handleConvertToMessage(text) {
    setTranslatorInitialText(text)
    setActiveView('translator')
  }

  return (
    <div className={`adv${darkMode ? ' adv-dark' : ''}`}>
      <style>{`
        .adv {
          min-height: 100vh;
          background: var(--surface, #FFFFFF);
          color: var(--ink, #1E0A10);
          display: flex;
          flex-direction: column;
        }
        .adv-dark { background: #0A0206; color: #F5E6EB; }

        /* ── Hero ── */
        .adv-hero {
          position: relative;
          padding: max(52px, calc(env(safe-area-inset-top) + 20px)) 24px 28px;
          overflow: hidden;
        }
        .adv-hero-bg {
          position: absolute; inset: 0;
          background: linear-gradient(160deg, #C8334A 0%, #5C0E1D 60%, #0A0206 100%);
        }
        .adv-hero-orb1 {
          position: absolute; top: -40px; right: -40px;
          width: 200px; height: 200px; border-radius: 50%;
          background: radial-gradient(circle, rgba(200,51,74,0.5) 0%, transparent 70%);
        }
        .adv-hero-orb2 {
          position: absolute; bottom: -20px; left: 20px;
          width: 130px; height: 130px; border-radius: 50%;
          background: radial-gradient(circle, rgba(139,26,44,0.4) 0%, transparent 70%);
        }
        .adv-hero-content { position: relative; z-index: 1; }
        .adv-hero-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 99px;
          padding: 4px 12px;
          font-size: 11px; font-weight: 600; letter-spacing: 0.8px;
          text-transform: uppercase; color: rgba(255,255,255,0.85);
          margin-bottom: 14px;
          backdrop-filter: blur(8px);
        }
        .adv-hero-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #FF6B8A;
          animation: advPulse 2s ease-in-out infinite;
        }
        @keyframes advPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.7); }
        }
        .adv-hero-title {
          font-family: var(--font-head, Georgia, serif);
          font-size: 30px; font-weight: 700;
          color: #FFFFFF;
          line-height: 1.2;
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }
        .adv-hero-sub {
          font-size: 14px; color: rgba(255,255,255,0.65);
          line-height: 1.5;
        }

        /* ── Card grid ── */
        .adv-grid {
          padding: 20px 16px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .adv-card {
          border-radius: 20px;
          padding: 20px 16px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          border: none;
          text-align: left;
          -webkit-tap-highlight-color: transparent;
          transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s;
          min-height: 140px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          animation: advCardIn 0.4s cubic-bezier(0.2,1,0.4,1) both;
        }
        @keyframes advCardIn {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .adv-card:nth-child(1) { animation-delay: 0.04s; }
        .adv-card:nth-child(2) { animation-delay: 0.08s; }
        .adv-card:nth-child(3) { animation-delay: 0.12s; }
        .adv-card:nth-child(4) { animation-delay: 0.16s; }
        .adv-card:nth-child(5) { animation-delay: 0.20s; }
        .adv-card:nth-child(6) { animation-delay: 0.24s; }
        .adv-card:nth-child(7) { animation-delay: 0.28s; }
        .adv-card:active { transform: scale(0.95); }

        .adv-card-icon {
          width: 52px; height: 52px;
          border-radius: 14px;
          background: rgba(255,255,255,0.18);
          display: flex; align-items: center; justify-content: center;
          color: #FFFFFF;
          margin-bottom: 12px;
          backdrop-filter: blur(4px);
        }
        .adv-card-label {
          font-size: 16px; font-weight: 700;
          color: #FFFFFF;
          margin-bottom: 4px;
        }
        .adv-card-desc {
          font-size: 12px;
          color: rgba(255,255,255,0.65);
          line-height: 1.4;
        }
        .adv-card-arrow {
          position: absolute; top: 16px; right: 16px;
          opacity: 0.5;
        }
        .adv-card-glow {
          position: absolute; inset: 0;
          border-radius: inherit;
          pointer-events: none;
        }

        /* ── Section divider ── */
        .adv-section-label {
          padding: 0 20px 8px;
          font-size: 11px; font-weight: 700; letter-spacing: 0.8px;
          text-transform: uppercase; color: rgba(255,255,255,0.35);
        }

        /* ── Content view ── */
        .adv-back-bar {
          display: flex; align-items: center; gap: 12px;
          padding: max(16px, calc(env(safe-area-inset-top) + 8px)) 16px 12px;
          border-bottom: 0.5px solid var(--border, rgba(200,51,74,0.1));
          position: sticky; top: 0; z-index: 10;
          background: var(--surface, #FFFFFF);
          backdrop-filter: blur(20px);
        }
        .adv-dark .adv-back-bar {
          background: rgba(10,2,6,0.92);
          border-bottom-color: rgba(200,51,74,0.18);
        }
        .adv-back-btn {
          width: 36px; height: 36px; border-radius: 50%;
          background: var(--blush, #FBF0F2); border: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--rose, #C8334A);
          flex-shrink: 0;
          -webkit-tap-highlight-color: transparent;
        }
        .adv-dark .adv-back-btn { background: #3D1520; }
        .adv-back-title {
          font-family: var(--font-head, Georgia, serif);
          font-size: 18px; font-weight: 700;
          color: var(--ink, #1E0A10);
        }
        .adv-dark .adv-back-title { color: #F5E6EB; }

        .adv-content-area {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
          animation: advSlideIn 0.28s cubic-bezier(0.2,1,0.4,1) both;
        }
        @keyframes advSlideIn {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .adv-scroll {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
        }
      `}</style>

      {activeView ? (
        /* ── Sub-view ── */
        <>
          <div className="adv-back-bar">
            <button className="adv-back-btn" onClick={() => { setActiveView(null); setTranslatorInitialText(null) }} aria-label="Назад">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15,18 9,12 15,6" />
              </svg>
            </button>
            <span className="adv-back-title">{current?.label}</span>
          </div>
          <div className="adv-content-area">
            {activeView === 'mirror'      && <SyncMirror       session={session} profile={profile} darkMode={darkMode} />}
            {activeView === 'capsule'     && <TimeCapsule      session={session} profile={profile} darkMode={darkMode} />}
            {activeView === 'warmth'      && <WarmthBarometer  session={session} profile={profile} darkMode={darkMode} />}
            {activeView === 'insights'    && <InsightsWidget   session={session} profile={profile} darkMode={darkMode} />}
            {activeView === 'journal'     && <PrivateJournal   session={session} profile={profile} darkMode={darkMode} onConvertToMessage={handleConvertToMessage} />}
            {activeView === 'translator'  && <EmotionTranslator session={session} profile={profile} darkMode={darkMode} initialText={translatorInitialText} />}
            {activeView === 'contracts'   && <Contracts        session={session} profile={profile} darkMode={darkMode} />}
          </div>
        </>
      ) : (
        /* ── Home grid ── */
        <div className="adv-scroll">
          <div className="adv-hero">
            <div className="adv-hero-bg" />
            <div className="adv-hero-orb1" />
            <div className="adv-hero-orb2" />
            <div className="adv-hero-content">
              <div className="adv-hero-badge">
                <div className="adv-hero-badge-dot" />
                Советник пары
              </div>
              <div className="adv-hero-title">Умный помощник<br />ваших отношений</div>
              <div className="adv-hero-sub">Анализирует, напоминает и помогает<br />сохранять тепло между вами</div>
            </div>
          </div>

          <div className="adv-grid">
            {VIEWS.map(v => (
              <button
                key={v.id}
                className="adv-card"
                style={{
                  background: v.gradient,
                  boxShadow: `0 8px 28px ${v.glow}`,
                }}
                onClick={() => setActiveView(v.id)}
              >
                <div>
                  <div className="adv-card-icon">{v.icon}</div>
                  <div className="adv-card-label">{v.label}</div>
                  <div className="adv-card-desc">{v.desc}</div>
                </div>
                <svg className="adv-card-arrow" viewBox="0 0 24 24" width="18" height="18"
                  fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12,5 19,12 12,19" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
