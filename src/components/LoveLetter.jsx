import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/* ── SVG Icons ── */
function IcoClose() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}
function IcoHeart({ size = 14, color = '#8B1A2C' }) {
  return (
    <svg viewBox="0 0 20 18" width={size} height={size * 0.9} fill={color} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M10 16.5C10 16.5 1.5 10.5 1.5 5C1.5 2.5 3.6 0.5 6 0.5C7.5 0.5 8.8 1.3 10 2.8C11.2 1.3 12.5 0.5 14 0.5C16.4 0.5 18.5 2.5 18.5 5C18.5 10.5 10 16.5 10 16.5Z"/>
    </svg>
  )
}
function IcoMailOpen() {
  return (
    <svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.2 7.4L12 13 2.8 7.4"/>
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="M2 7l10 7 10-7"/>
    </svg>
  )
}
function IcoPencil() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 5 }}>
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/>
    </svg>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function LoveLetter({ session, profile }) {
  const [tab, setTab] = useState('write')

  // Write mode
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)   // fly-away animation trigger
  const [envelopeOpen, setEnvelopeOpen] = useState(false)

  // Archive mode
  const [letters, setLetters] = useState([])
  const [loadingLetters, setLoadingLetters] = useState(false)
  const [openLetter, setOpenLetter] = useState(null)

  // Names
  const [partnerName, setPartnerName] = useState('Партнёр')
  const [myName, setMyName] = useState('Я')

  const myId = session?.user?.id
  const partnerId = profile?.partner_id

  const loadNames = useCallback(async () => {
    if (myId) {
      const { data } = await supabase.from('profiles').select('name').eq('id', myId).single()
      if (data?.name) setMyName(data.name)
    }
    if (partnerId) {
      const { data } = await supabase.from('profiles').select('name').eq('id', partnerId).single()
      if (data?.name) setPartnerName(data.name)
    }
  }, [myId, partnerId])

  const loadLetters = useCallback(async () => {
    if (!myId) return
    setLoadingLetters(true)
    const { data } = await supabase
      .from('love_letters')
      .select('*')
      .order('created_at', { ascending: false })
    setLetters(data || [])
    setLoadingLetters(false)
  }, [myId])

  useEffect(() => {
    loadNames()
  }, [loadNames])

  useEffect(() => {
    if (tab === 'archive') loadLetters()
  }, [tab, loadLetters])

  async function handleSend() {
    if (!body.trim() || !myId) return
    setSending(true)
    // animate envelope closing
    setEnvelopeOpen(false)
    await supabase.from('love_letters').insert({
      user_id: myId,
      recipient_name: partnerName,
      body: body.trim(),
    })
    setSent(true)
    // reset after animation
    setTimeout(() => {
      setSent(false)
      setBody('')
      setSending(false)
    }, 1800)
  }

  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

  const rotations = [-2, 1, -1, 2, -1.5]

  return (
    <>
      <style>{`
        .letter-wrap {
          min-height: 100%;
          background: var(--gradient-banner, linear-gradient(160deg, #C8334A 0%, #8B1A2C 100%));
          background-size: 200% 200%;
          animation: gradientShift 8s ease infinite;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 70px 20px 120px;
          position: relative;
          overflow: hidden;
        }
        .letter-wrap::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(255,255,255,0.03) 28px, rgba(255,255,255,0.03) 29px);
          pointer-events: none;
          z-index: 0;
        }

        /* TABS */
        .letter-tabs {
          display: flex;
          background: rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 3px;
          gap: 2px;
          margin-bottom: 28px;
          position: relative;
          z-index: 1;
          width: 220px;
        }
        .letter-tab-btn {
          flex: 1;
          padding: 9px 0;
          border: none;
          border-radius: 11px;
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
          background: transparent;
          color: rgba(255,255,255,0.55);
          -webkit-tap-highlight-color: transparent;
        }
        .letter-tab-btn.active {
          background: rgba(255,255,255,0.18);
          color: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }

        /* PAGE TITLE */
        .letter-page-title {
          font-family: var(--font-display);
          font-size: 24px;
          color: white;
          text-align: center;
          margin-bottom: 4px;
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .letter-page-sub {
          font-family: var(--font-body);
          font-size: 13px;
          color: rgba(255,255,255,0.5);
          margin-bottom: 28px;
          text-align: center;
          position: relative;
          z-index: 1;
        }

        /* ── WRITE MODE ── */
        .letter-compose-wrap {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 360px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }

        /* Envelope */
        .envelope-container {
          position: relative;
          cursor: pointer;
        }
        .envelope {
          width: 240px;
          height: 160px;
          position: relative;
          filter: drop-shadow(0 12px 40px rgba(0,0,0,0.4));
          transition: transform 0.3s;
        }
        .envelope:active { transform: scale(0.97); }
        .envelope-body {
          width: 240px;
          height: 160px;
          background: var(--blush, #FBF0F2);
          border-radius: 8px 8px 16px 16px;
          position: absolute;
          bottom: 0;
          overflow: hidden;
        }
        .envelope-body::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 70px;
          background: var(--blush-2, #F2D0D6);
          clip-path: polygon(0 100%, 50% 0, 100% 100%);
        }
        .envelope-flap {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 100px;
          background: var(--blush, #FBF0F2);
          clip-path: polygon(0 0, 50% 100%, 100% 0);
          transform-origin: top center;
          transition: transform 0.6s cubic-bezier(0.34,1.56,0.64,1);
          z-index: 2;
        }
        .envelope-flap.open {
          transform: rotateX(180deg);
        }
        .envelope-seal {
          position: absolute;
          top: 22px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 3;
          transition: opacity 0.3s;
        }
        .envelope-seal.hidden { opacity: 0; }
        .envelope-lines {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          gap: 4px;
          z-index: 1;
        }
        .envelope-line {
          width: 80px; height: 2px;
          background: rgba(139,26,44,0.25);
          border-radius: 2px;
        }
        /* Fly-away animation */
        @keyframes letterFly {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          40%  { transform: translateY(-20px) scale(1.05); opacity: 1; }
          100% { transform: translateY(-200px) scale(0.5); opacity: 0; }
        }
        .envelope-container.sending {
          animation: letterFly 1.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        /* Compose form */
        .compose-form {
          width: 100%;
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 20px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .compose-to-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .compose-to-label {
          font-family: var(--font-body);
          font-size: 13px;
          color: rgba(255,255,255,0.45);
          flex-shrink: 0;
        }
        .compose-to-name {
          font-family: var(--font-body);
          font-size: 15px;
          font-weight: 600;
          color: var(--theme-accent, #C8334A);
        }
        .compose-textarea {
          width: 100%;
          min-height: 160px;
          background: none;
          border: none;
          outline: none;
          resize: none;
          font-family: 'Georgia', serif;
          font-size: 15px;
          color: rgba(255,255,255,0.9);
          line-height: 1.8;
          placeholder: rgba(255,255,255,0.3);
        }
        .compose-textarea::placeholder { color: rgba(255,255,255,0.3); }
        .compose-send-btn {
          width: 100%;
          padding: 14px;
          background: var(--gradient-main, linear-gradient(160deg, #C8334A, #8B1A2C));
          color: white;
          border: none;
          border-radius: 14px;
          font-family: var(--font-body);
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.3);
          transition: opacity 0.2s, transform 0.15s;
        }
        .compose-send-btn:disabled { opacity: 0.5; }
        .compose-send-btn:active { transform: scale(0.97); }
        .sent-message {
          text-align: center;
          color: rgba(255,255,255,0.8);
          font-family: var(--font-display);
          font-size: 18px;
          animation: fadeInUp 0.4s ease;
        }
        @keyframes fadeInUp {
          from { opacity:0; transform: translateY(12px); }
          to   { opacity:1; transform: translateY(0); }
        }

        /* ── ARCHIVE MODE ── */
        .archive-wrap {
          width: 100%;
          max-width: 360px;
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .archive-empty {
          text-align: center;
          padding: 60px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }
        .archive-empty-text {
          font-family: var(--font-body);
          font-size: 15px;
          color: rgba(255,255,255,0.4);
        }

        /* Letter card */
        .letter-card {
          background: rgba(255,255,255,0.06);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 16px;
          cursor: pointer;
          transition: transform 0.2s, background 0.15s;
          animation: fadeInUp 0.35s ease both;
        }
        .letter-card:active { transform: scale(0.97); background: rgba(255,255,255,0.1); }
        .letter-card-mine {
          border-left: 3px solid var(--theme-accent, #C8334A);
        }
        .letter-card-theirs {
          border-left: 3px solid rgba(255,255,255,0.3);
        }
        .letter-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .letter-card-from {
          font-family: var(--font-body);
          font-size: 15px;
          font-weight: 700;
          color: var(--theme-accent, #C8334A);
        }
        .letter-card-theirs .letter-card-from {
          color: rgba(255,255,255,0.8);
        }
        .letter-card-date {
          font-family: var(--font-body);
          font-size: 12px;
          color: rgba(255,255,255,0.35);
        }
        .letter-card-preview {
          font-family: 'Georgia', serif;
          font-size: 14px;
          font-style: italic;
          color: rgba(255,255,255,0.6);
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .letter-card-recipient {
          font-family: var(--font-body);
          font-size: 12px;
          color: rgba(255,255,255,0.35);
          margin-bottom: 6px;
        }

        /* ── OPEN LETTER MODAL ── */
        .letter-sheet-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.75);
          backdrop-filter: blur(8px);
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.25s ease;
        }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .letter-sheet {
          background: #FFFFFF !important;
          border-radius: 18px;
          padding: 28px 24px;
          max-width: 360px;
          width: 100%;
          max-height: 82vh;
          overflow-y: auto;
          position: relative;
          box-shadow: 0 16px 48px rgba(0,0,0,0.5);
          animation: letterUnfold 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
          font-family: 'Georgia', serif;
          opacity: 1 !important;
          background-image: repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(200,100,150,0.1) 27px, rgba(200,100,150,0.1) 28px) !important;
          background-attachment: local;
        }
        @keyframes letterUnfold {
          from { opacity:0; transform: scale(0.8) translateY(30px); }
          to   { opacity:1; transform: scale(1) translateY(0); }
        }
        .letter-close {
          position: absolute;
          top: 12px; right: 14px;
          background: white;
          border: 1.5px solid rgba(139,26,44,0.25);
          border-radius: 50%;
          width: 36px; height: 36px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #8B1A2C;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        .letter-date {
          font-family: var(--font-body);
          font-size: 13px;
          color: #666666;
          text-align: right;
          margin-bottom: 16px;
        }
        .letter-salutation {
          font-family: var(--font-display);
          font-style: italic;
          font-size: 20px;
          font-weight: 600;
          color: #C2185B;
          margin-bottom: 16px;
        }
        .letter-body {
          font-size: 16px;
          color: #1A1A1A;
          line-height: 1.8;
          white-space: pre-wrap;
          min-height: 60px;
          font-family: 'Georgia', serif;
        }
        .letter-signature {
          margin-top: 28px;
          text-align: right;
          font-family: var(--font-display);
          font-style: italic;
          font-size: 18px;
          font-weight: 500;
          color: #C2185B;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
        }

        /* Loading */
        .archive-loading {
          text-align: center;
          padding: 40px;
          color: rgba(255,255,255,0.4);
          font-family: var(--font-body);
          font-size: 14px;
        }
      `}</style>

      <div className="letter-wrap">
        {/* Page title */}
        <div className="letter-page-title">
          <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden>
            <rect x="1" y="1" width="20" height="14" rx="2" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5"/>
            <polyline points="1,1 11,9.5 21,1" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Письма любви
        </div>
        <div className="letter-page-sub">Твои слова хранятся здесь навсегда</div>

        {/* Tab switcher */}
        <div className="letter-tabs">
          <button
            className={`letter-tab-btn${tab === 'write' ? ' active' : ''}`}
            onClick={() => setTab('write')}
          >
            Написать
          </button>
          <button
            className={`letter-tab-btn${tab === 'archive' ? ' active' : ''}`}
            onClick={() => setTab('archive')}
          >
            Архив
          </button>
        </div>

        {/* ── WRITE MODE ── */}
        {tab === 'write' && (
          <div className="letter-compose-wrap">
            {/* Envelope decoration */}
            <div className={`envelope-container${sent ? ' sending' : ''}`}>
              <div className="envelope">
                <div className="envelope-body">
                  <div className="envelope-lines">
                    <div className="envelope-line"/>
                    <div className="envelope-line"/>
                    <div className="envelope-line"/>
                  </div>
                </div>
                <div className={`envelope-flap${envelopeOpen ? ' open' : ''}`}/>
                <div className={`envelope-seal${envelopeOpen ? ' hidden' : ''}`}>
                  <svg width="28" height="20" viewBox="0 0 28 20" fill="none" aria-hidden>
                    <rect x="1" y="1" width="26" height="18" rx="2" fill="none" stroke="rgba(139,26,44,0.5)" strokeWidth="1.5"/>
                    <polyline points="1,1 14,12 27,1" fill="none" stroke="rgba(139,26,44,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="14" cy="10" r="3" fill="rgba(139,26,44,0.4)"/>
                  </svg>
                </div>
              </div>
            </div>

            {sent ? (
              <div className="sent-message">
                Письмо отправлено <IcoHeart size={18} color="white"/>
              </div>
            ) : (
              <div className="compose-form">
                <div className="compose-to-row">
                  <span className="compose-to-label">Кому:</span>
                  <span className="compose-to-name">{partnerName}</span>
                </div>
                <textarea
                  className="compose-textarea"
                  value={body}
                  onChange={e => {
                    setBody(e.target.value)
                    if (!envelopeOpen && e.target.value.length > 0) setEnvelopeOpen(true)
                    if (e.target.value.length === 0) setEnvelopeOpen(false)
                  }}
                  placeholder="Напиши что чувствуешь..."
                  rows={6}
                />
                <button
                  className="compose-send-btn"
                  onClick={handleSend}
                  disabled={!body.trim() || sending}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  {sending ? 'Отправляю...' : 'Отправить письмо'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ARCHIVE MODE ── */}
        {tab === 'archive' && (
          <div className="archive-wrap">
            {loadingLetters ? (
              <div className="archive-loading">Загружаю...</div>
            ) : letters.length === 0 ? (
              <div className="archive-empty">
                <IcoMailOpen/>
                <div className="archive-empty-text">Писем пока нет. Напишите первое!</div>
              </div>
            ) : (
              letters.map((letter, i) => {
                const isMine = letter.user_id === myId
                const senderName = isMine ? myName : partnerName
                const rotateDeg = rotations[i % rotations.length]
                return (
                  <div
                    key={letter.id}
                    className={`letter-card ${isMine ? 'letter-card-mine' : 'letter-card-theirs'}`}
                    style={{
                      transform: `rotate(${rotateDeg}deg)`,
                      animationDelay: `${i * 0.06}s`,
                    }}
                    onClick={() => setOpenLetter(letter)}
                  >
                    <div className="letter-card-top">
                      <div className="letter-card-from">
                        {isMine ? 'Вы' : senderName}
                      </div>
                      <div className="letter-card-date">{formatDate(letter.created_at)}</div>
                    </div>
                    {letter.recipient_name && (
                      <div className="letter-card-recipient">
                        Кому: {letter.recipient_name}
                      </div>
                    )}
                    <div className="letter-card-preview">{letter.body}</div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── OPEN LETTER MODAL ── */}
        {openLetter && (
          <div className="letter-sheet-overlay" onClick={() => setOpenLetter(null)}>
            <div className="letter-sheet" onClick={e => e.stopPropagation()}>
              <button className="letter-close" onClick={() => setOpenLetter(null)} aria-label="Закрыть">
                <IcoClose/>
              </button>
              <div className="letter-date">{formatDate(openLetter.created_at)}</div>
              <div className="letter-salutation">
                {openLetter.recipient_name
                  ? `${openLetter.recipient_name},`
                  : 'Моя любовь,'}
              </div>
              <div className="letter-body">{openLetter.body}</div>
              <div className="letter-signature">
                С любовью,&nbsp;
                {openLetter.user_id === myId ? myName : partnerName}
                &nbsp;<IcoHeart size={14} color="#8B1A2C"/>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
