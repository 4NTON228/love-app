import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export default function LoveLetter({ session, profile }) {
  const [myMessage, setMyMessage] = useState('')
  const [partnerMessage, setPartnerMessage] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [envelopeOpen, setEnvelopeOpen] = useState(false)
  const [showLetter, setShowLetter] = useState(false)
  const [showPartner, setShowPartner] = useState(false)
  const [partnerName, setPartnerName] = useState('Партнёр')
  const [myName, setMyName] = useState('Я')

  const loadMessages = useCallback(async () => {
    if (!session?.user?.id) return
    const partnerId = profile?.partner_id

    const userIds = [session.user.id, partnerId].filter(Boolean)
    const { data } = await supabase.from('couple_settings').select('user_id, love_message').in('user_id', userIds)
    if (data) {
      const mine = data.find(d => d.user_id === session.user.id)
      const theirs = data.find(d => d.user_id === partnerId)
      setMyMessage(mine?.love_message || '')
      setPartnerMessage(theirs?.love_message || '')
      setDraft(mine?.love_message || '')
    }
    if (partnerId) {
      const { data: p } = await supabase.from('profiles').select('name').eq('id', partnerId).single()
      if (p) setPartnerName(p.name || 'Партнёр')
    }
    if (session.user.id) {
      const { data: me } = await supabase.from('profiles').select('name').eq('id', session.user.id).single()
      if (me) setMyName(me.name || 'Я')
    }
  }, [session?.user?.id, profile?.partner_id])

  useEffect(() => { loadMessages() }, [loadMessages])

  const handleOpen = () => {
    setEnvelopeOpen(true)
    setTimeout(() => setShowLetter(true), 600)
  }

  const handleClose = () => {
    setShowLetter(false)
    setTimeout(() => setEnvelopeOpen(false), 400)
  }

  async function saveLetter() {
    setSaving(true)
    const { data: ex } = await supabase.from('couple_settings').select('id').eq('user_id', session.user.id).maybeSingle()
    if (ex) {
      await supabase.from('couple_settings').update({ love_message: draft, updated_at: new Date().toISOString() }).eq('id', ex.id)
    } else {
      await supabase.from('couple_settings').insert({ user_id: session.user.id, love_message: draft })
    }
    setMyMessage(draft)
    setEditing(false)
    setSaving(false)
  }

  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <style>{`
        .letter-wrap {
          min-height: 100%;
          background: linear-gradient(160deg, #2d1457 0%, #6b1a6e 40%, #c84b8b 80%, #e8466a 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 70px 20px 120px;
          position: relative;
          overflow: hidden;
        }

        /* Paper texture overlay */
        .letter-wrap::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(255,255,255,0.03) 28px, rgba(255,255,255,0.03) 29px);
          pointer-events: none;
          z-index: 0;
        }

        .letter-page-title {
          font-family: var(--font-display);
          font-size: 26px;
          color: white;
          text-align: center;
          margin-bottom: 4px;
          position: relative;
          z-index: 1;
        }
        .letter-page-sub {
          font-family: var(--font-body);
          font-size: 13px;
          color: rgba(255,255,255,0.5);
          margin-bottom: 36px;
          text-align: center;
          position: relative;
          z-index: 1;
        }

        /* ---- Envelope ---- */
        .envelope-container {
          position: relative;
          z-index: 1;
          cursor: pointer;
          margin-bottom: 24px;
        }
        .envelope {
          width: 240px;
          height: 160px;
          position: relative;
          filter: drop-shadow(0 12px 40px rgba(0,0,0,0.4));
        }
        .envelope-body {
          width: 240px;
          height: 160px;
          background: linear-gradient(160deg, #fff5f8 0%, #ffe0ea 100%);
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
          background: linear-gradient(160deg, #ffd6e0 0%, #ffb6d0 100%);
          clip-path: polygon(0 100%, 50% 0, 100% 100%);
        }
        .envelope-flap {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 100px;
          background: linear-gradient(160deg, #ffeef4 0%, #ffd6e0 100%);
          clip-path: polygon(0 0, 50% 100%, 100% 0);
          transform-origin: top center;
          transition: transform 0.6s cubic-bezier(0.34,1.56,0.64,1);
          z-index: 2;
        }
        .envelope-flap.open {
          transform: rotateX(180deg);
        }
        .envelope-heart {
          position: absolute;
          top: 22px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 22px;
          z-index: 3;
          transition: opacity 0.3s;
        }
        .envelope-heart.hidden { opacity: 0; }
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
          width: 80px;
          height: 2px;
          background: rgba(200,75,139,0.25);
          border-radius: 2px;
        }
        .open-hint {
          font-family: var(--font-body);
          font-size: 13px;
          color: rgba(255,255,255,0.65);
          margin-top: 10px;
          text-align: center;
          animation: pulsate 2s ease-in-out infinite;
        }
        @keyframes pulsate {
          0%,100% { opacity:0.65; }
          50%      { opacity:1; }
        }

        /* ---- Letter sheet ---- */
        .letter-sheet-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.65);
          backdrop-filter: blur(6px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .letter-sheet {
          background: linear-gradient(160deg, #fffdf5 0%, #fff5e8 100%);
          border-radius: 16px;
          padding: 28px 24px;
          max-width: 360px;
          width: 100%;
          max-height: 82vh;
          overflow-y: auto;
          position: relative;
          box-shadow: 0 24px 80px rgba(0,0,0,0.5);
          animation: letterUnfold 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
          font-family: 'Georgia', serif;
          background-image:
            repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(200,100,150,0.12) 27px, rgba(200,100,150,0.12) 28px);
          background-attachment: local;
        }
        @keyframes letterUnfold {
          from { opacity:0; transform: scale(0.7) translateY(40px); }
          to   { opacity:1; transform: scale(1) translateY(0); }
        }
        .letter-close {
          position: absolute;
          top: 12px; right: 14px;
          background: rgba(200,75,139,0.12);
          border: none;
          border-radius: 50%;
          width: 32px; height: 32px;
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #c84b8b;
        }
        .letter-date {
          font-family: var(--font-body);
          font-size: 12px;
          color: #b08090;
          text-align: right;
          margin-bottom: 16px;
        }
        .letter-salutation {
          font-family: var(--font-display);
          font-style: italic;
          font-size: 17px;
          color: #c84b8b;
          margin-bottom: 12px;
        }
        .letter-body {
          font-size: 15px;
          color: #3d2030;
          line-height: 1.8;
          white-space: pre-wrap;
          min-height: 60px;
        }
        .letter-empty {
          color: #c0a0b0;
          font-style: italic;
          font-size: 14px;
        }
        .letter-signature {
          margin-top: 20px;
          text-align: right;
          font-family: var(--font-display);
          font-style: italic;
          font-size: 16px;
          color: #c84b8b;
        }
        .letter-edit-area {
          width: 100%;
          font-family: 'Georgia', serif;
          font-size: 15px;
          color: #3d2030;
          line-height: 1.8;
          border: none;
          background: transparent;
          resize: none;
          min-height: 140px;
          outline: none;
        }
        .letter-edit-area::placeholder { color: #d0b0be; }
        .letter-btn-row {
          display: flex;
          gap: 8px;
          margin-top: 14px;
        }
        .letter-btn-save {
          background: linear-gradient(135deg, #e8466a, #c84b8b);
          color: white;
          border: none;
          border-radius: 10px;
          padding: 9px 20px;
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
        }
        .letter-btn-cancel {
          background: rgba(200,75,139,0.1);
          color: #c84b8b;
          border: none;
          border-radius: 10px;
          padding: 9px 16px;
          font-family: var(--font-body);
          font-size: 14px;
          cursor: pointer;
        }
        .letter-btn-edit {
          background: rgba(200,75,139,0.12);
          color: #c84b8b;
          border: 1.5px solid rgba(200,75,139,0.3);
          border-radius: 10px;
          padding: 7px 16px;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 12px;
        }

        /* Partner letter section */
        .partner-section {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 340px;
          margin-top: 10px;
        }
        .partner-section-title {
          font-family: var(--font-body);
          font-size: 12px;
          color: rgba(255,255,255,0.55);
          text-transform: uppercase;
          letter-spacing: 1px;
          text-align: center;
          margin-bottom: 12px;
        }
        .partner-letter-preview {
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 18px;
          padding: 18px 20px;
          cursor: pointer;
          transition: transform 0.15s;
        }
        .partner-letter-preview:active { transform: scale(0.97); }
        .partner-letter-from {
          font-family: var(--font-display);
          font-style: italic;
          font-size: 15px;
          color: rgba(255,255,255,0.8);
          margin-bottom: 8px;
        }
        .partner-letter-text {
          font-family: 'Georgia', serif;
          font-size: 14px;
          color: rgba(255,255,255,0.65);
          line-height: 1.6;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .partner-letter-empty {
          font-size: 13px;
          color: rgba(255,255,255,0.4);
          font-style: italic;
        }
      `}</style>

      <div className="letter-wrap">
        <div className="letter-page-title">Письма любви 💌</div>
        <div className="letter-page-sub">Твои слова хранятся здесь навсегда</div>

        {/* Envelope */}
        <div className="envelope-container" onClick={envelopeOpen ? undefined : handleOpen}>
          <div className="envelope">
            <div className="envelope-body">
              <div className="envelope-lines">
                <div className="envelope-line" />
                <div className="envelope-line" />
                <div className="envelope-line" />
              </div>
            </div>
            <div className={`envelope-flap${envelopeOpen ? ' open' : ''}`} />
            <div className={`envelope-heart${envelopeOpen ? ' hidden' : ''}`}>💌</div>
          </div>
          {!envelopeOpen && <div className="open-hint">Нажми, чтобы открыть ✨</div>}
        </div>

        {/* Letter sheet (modal) */}
        {showLetter && (
          <div className="letter-sheet-overlay" onClick={handleClose}>
            <div className="letter-sheet" onClick={e => e.stopPropagation()}>
              <button className="letter-close" onClick={handleClose}>✕</button>
              <div className="letter-date">{today}</div>

              {editing ? (
                <>
                  <div className="letter-salutation">Моя любовь,</div>
                  <textarea
                    className="letter-edit-area"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    placeholder="Напиши что-нибудь прекрасное..."
                    autoFocus
                  />
                  <div className="letter-btn-row">
                    <button className="letter-btn-save" onClick={saveLetter} disabled={saving}>
                      {saving ? '💕 Сохраняю...' : 'Сохранить'}
                    </button>
                    <button className="letter-btn-cancel" onClick={() => { setEditing(false); setDraft(myMessage) }}>
                      Отмена
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="letter-salutation">Моя любовь,</div>
                  {myMessage ? (
                    <div className="letter-body">{myMessage}</div>
                  ) : (
                    <div className="letter-body letter-empty">
                      Ты ещё не написал(а) письмо... Нажми «Написать», чтобы оставить слова для любимого человека 💕
                    </div>
                  )}
                  <div className="letter-signature">С любовью, {myName} ❤️</div>
                  <button className="letter-btn-edit" onClick={() => setEditing(true)}>
                    ✏️ {myMessage ? 'Изменить письмо' : 'Написать письмо'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Partner letter */}
        <div className="partner-section">
          <div className="partner-section-title">Письмо от {partnerName}</div>
          <div
            className="partner-letter-preview"
            onClick={() => setShowPartner(true)}
          >
            <div className="partner-letter-from">Любимый(ая),</div>
            {partnerMessage ? (
              <div className="partner-letter-text">{partnerMessage}</div>
            ) : (
              <div className="partner-letter-empty">{partnerName} ещё не написал(а) письмо...</div>
            )}
          </div>
        </div>

        {/* Partner letter fullscreen */}
        {showPartner && (
          <div className="letter-sheet-overlay" onClick={() => setShowPartner(false)}>
            <div className="letter-sheet" onClick={e => e.stopPropagation()}>
              <button className="letter-close" onClick={() => setShowPartner(false)}>✕</button>
              <div className="letter-date">{today}</div>
              <div className="letter-salutation">Любимый(ая),</div>
              {partnerMessage ? (
                <div className="letter-body">{partnerMessage}</div>
              ) : (
                <div className="letter-body letter-empty">
                  {partnerName} ещё не написал(а) письмо... 💕
                </div>
              )}
              <div className="letter-signature">С любовью, {partnerName} ❤️</div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
