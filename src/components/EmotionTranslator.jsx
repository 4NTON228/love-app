import { useState } from 'react'
import { supabase } from '../lib/supabase'

// ── SVG Icons ────────────────────────────────────────────────
function TranslateIcon({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8l6 6" />
      <path d="M4 14l6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="M22 22l-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  )
}

function SendIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function SparkIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  )
}

function CopyIcon({ size = 15 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

function CheckIcon({ size = 15 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ArrowDownIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  )
}

const TEMPLATES = [
  {
    id: 'ignore',
    label: 'Игнорируют',
    example: 'Ты меня вообще не слышишь!',
    desc: 'Когда партнёр не реагирует',
  },
  {
    id: 'late',
    label: 'Снова опоздал',
    example: 'Тебе плевать на моё время!',
    desc: 'Когда опаздывают без предупреждения',
  },
  {
    id: 'phone',
    label: 'Телефон важнее',
    example: 'Ты вечно в телефоне когда я говорю!',
    desc: 'Конкуренция с гаджетами',
  },
  {
    id: 'chores',
    label: 'Дела по дому',
    example: 'Почему всё всегда на мне?!',
    desc: 'Несправедливое распределение задач',
  },
  {
    id: 'feelings',
    label: 'Не понимают',
    example: 'Ты никогда не понимаешь как мне плохо.',
    desc: 'Когда чувства обесцениваются',
  },
  {
    id: 'plans',
    label: 'Сменил планы',
    example: 'Ты опять всё испортил своими планами!',
    desc: 'Отмена договорённостей',
  },
]

export default function EmotionTranslator({ session, profile, darkMode, initialText, onSendToPartner }) {
  const [inputText, setInputText] = useState(initialText ?? '')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  async function translate() {
    if (!inputText.trim() || loading) return
    setLoading(true)
    setResult(null)
    setError(null)
    setSent(false)

    try {
      const systemPrompt =
        'Ты эксперт по ненасильственному общению. ' +
        'Переформулируй сообщение: убери агрессию и обвинения, ' +
        'вырази через «я-высказывания», сохрани смысл, звучи тепло. ' +
        'Отвечай СТРОГО в формате JSON без markdown:\n' +
        '{"rewritten":"...","tips":["совет 1","совет 2"]}'

      const userMsg = selectedTemplate
        ? `Ситуация: ${selectedTemplate.label}. Сообщение: "${inputText.trim()}"`
        : `Сообщение: "${inputText.trim()}"`

      const { data, error: fnErr } = await supabase.functions.invoke('relationship-keeper', {
        body: {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg },
          ],
        },
      })

      if (fnErr) throw new Error(fnErr.message ?? String(fnErr))

      const raw = data?.choices?.[0]?.message?.content ?? ''

      // Parse JSON from response
      let parsed = null
      try {
        const cleaned = raw.replace(/^```json\s*/m, '').replace(/```\s*$/m, '').trim()
        // Find first { ... } block
        const match = cleaned.match(/\{[\s\S]*\}/)
        if (match) parsed = JSON.parse(match[0])
      } catch (_) { /* ignore */ }

      if (parsed?.rewritten) {
        setResult({
          original: inputText.trim(),
          rewritten: parsed.rewritten,
          tips: Array.isArray(parsed.tips) ? parsed.tips.slice(0, 2) : [],
        })
      } else if (raw) {
        // Fallback: use raw text as rewritten
        setResult({ original: inputText.trim(), rewritten: raw, tips: [] })
      } else {
        setError('Не удалось переформулировать. Попробуй ещё раз.')
      }
    } catch (e) {
      console.error('[EmotionTranslator]', e)
      setError('Не удалось подключиться к ИИ. Попробуй позже.')
    }
    setLoading(false)
  }

  function useTemplate(t) {
    setSelectedTemplate(t)
    setInputText(t.example)
    setResult(null)
    setSent(false)
  }

  async function copy() {
    if (!result?.rewritten) return
    await navigator.clipboard.writeText(result.rewritten).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function sendToPartner() {
    if (!result?.rewritten || sending) return
    setSending(true)
    try {
      if (onSendToPartner) {
        await onSendToPartner(result.rewritten)
        setSent(true)
      } else {
        // Direct insert to messages table
        const { data: prof } = await supabase
          .from('profiles')
          .select('partner_id')
          .eq('id', session.user.id)
          .single()

        if (prof?.partner_id) {
          await supabase.from('messages').insert({
            user_id: session.user.id,
            text: result.rewritten,
          })
          setSent(true)
        }
      }
    } catch (_) { /* silent */ }
    setSending(false)
  }

  const dk = darkMode ? ' et-dark' : ''

  return (
    <div className={`et${dk}`}>
      <style>{`
        .et {
          min-height: 100%;
          background: var(--surface, #FFFFFF);
          color: var(--ink, #1E0A10);
        }
        .et-dark { background: #0A0206; color: #F5E6EB; }

        /* Hero */
        .et-hero {
          position: relative;
          padding: 28px 24px 32px;
          overflow: hidden;
        }
        .et-hero-bg {
          position: absolute; inset: 0;
          background: linear-gradient(150deg, #0D2A1A 0%, #1A4A2E 50%, #0A0206 100%);
        }
        .et-orb1 {
          position: absolute; top: -30px; right: -20px;
          width: 160px; height: 160px; border-radius: 50%;
          background: radial-gradient(circle, rgba(43,143,80,0.5) 0%, transparent 70%);
          animation: etFloat1 8s ease-in-out infinite;
        }
        .et-orb2 {
          position: absolute; bottom: -20px; left: 10px;
          width: 110px; height: 110px; border-radius: 50%;
          background: radial-gradient(circle, rgba(76,175,82,0.3) 0%, transparent 70%);
          animation: etFloat2 11s ease-in-out infinite;
        }
        @keyframes etFloat1 {
          0%,100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(-10px, 12px) scale(1.08); }
        }
        @keyframes etFloat2 {
          0%,100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(8px,-10px) scale(1.05); }
        }
        .et-hero-content { position: relative; z-index: 1; }
        .et-hero-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18);
          border-radius: 99px; padding: 4px 12px;
          font-size: 11px; font-weight: 600; letter-spacing: 0.8px;
          text-transform: uppercase; color: rgba(255,255,255,0.8);
          margin-bottom: 14px;
        }
        .et-hero-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #4CAF82;
          animation: etPulse 2s ease-in-out infinite;
        }
        @keyframes etPulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.6); }
        }
        .et-hero-title {
          font-family: var(--font-head, Georgia, serif);
          font-size: 28px; font-weight: 700; color: #FFFFFF;
          line-height: 1.2; margin-bottom: 8px;
        }
        .et-hero-sub {
          font-size: 13px; color: rgba(255,255,255,0.55); line-height: 1.5;
        }

        /* Templates */
        .et-templates {
          padding: 16px 16px 8px;
        }
        .et-templates-label {
          font-size: 11px; font-weight: 700; letter-spacing: 0.8px;
          text-transform: uppercase; color: rgba(30,10,16,0.4);
          margin-bottom: 10px;
        }
        .et-dark .et-templates-label { color: rgba(245,230,235,0.35); }
        .et-templates-scroll {
          display: flex; gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .et-templates-scroll::-webkit-scrollbar { display: none; }
        .et-tpl-chip {
          flex-shrink: 0;
          padding: 7px 14px; border-radius: 99px;
          border: 1.5px solid rgba(43,143,80,0.25);
          background: rgba(43,143,80,0.06);
          font-size: 12px; font-weight: 600;
          color: var(--ink, #1E0A10);
          cursor: pointer; transition: all 0.15s;
          white-space: nowrap;
        }
        .et-dark .et-tpl-chip {
          color: #F5E6EB;
          background: rgba(76,175,82,0.08);
          border-color: rgba(76,175,82,0.2);
        }
        .et-tpl-chip.active {
          background: linear-gradient(135deg, #2B6B3A 0%, #1A4A28 100%);
          border-color: transparent; color: #FFFFFF;
        }

        /* Input area */
        .et-input-area {
          padding: 8px 16px 16px;
        }
        .et-input-label {
          font-size: 12px; font-weight: 600; letter-spacing: 0.5px;
          text-transform: uppercase; color: rgba(30,10,16,0.4);
          margin-bottom: 8px;
        }
        .et-dark .et-input-label { color: rgba(245,230,235,0.35); }
        .et-textarea {
          width: 100%; min-height: 100px;
          border: 1.5px solid rgba(43,143,80,0.2);
          border-radius: 14px; padding: 12px 14px;
          font-size: 15px; line-height: 1.6;
          background: var(--blush, #FBF0F2);
          color: inherit; resize: none; outline: none;
          font-family: inherit;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .et-dark .et-textarea {
          background: #0F200F;
          border-color: rgba(76,175,82,0.2);
        }
        .et-textarea:focus { border-color: #2B8F50; }

        .et-translate-btn {
          width: 100%; margin-top: 10px;
          padding: 14px;
          border-radius: 14px; border: none;
          background: linear-gradient(135deg, #2B8F50 0%, #1A4A2E 100%);
          color: #FFFFFF; font-size: 15px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          cursor: pointer;
          box-shadow: 0 6px 20px rgba(43,143,80,0.35);
          transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
          position: relative; overflow: hidden;
        }
        .et-translate-btn:active { transform: scale(0.96); }
        .et-translate-btn:disabled { opacity: 0.5; transform: none; }
        .et-translate-btn::after {
          content: '';
          position: absolute; top: 0; left: -100%;
          width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          animation: etShimmer 2.5s ease-in-out infinite;
        }
        @keyframes etShimmer {
          0% { left: -100%; }
          100% { left: 200%; }
        }

        /* Result */
        .et-result {
          padding: 0 16px 24px;
          animation: etSlideUp 0.35s cubic-bezier(0.2,1,0.4,1) both;
        }
        @keyframes etSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .et-before-block {
          background: rgba(200,51,74,0.06);
          border: 1px solid rgba(200,51,74,0.15);
          border-radius: 14px; padding: 14px;
          margin-bottom: 10px;
        }
        .et-dark .et-before-block {
          background: rgba(200,51,74,0.08);
          border-color: rgba(200,51,74,0.2);
        }
        .et-block-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.8px;
          text-transform: uppercase; margin-bottom: 8px;
        }
        .et-before-block .et-block-label { color: #C8334A; }
        .et-block-text {
          font-size: 14px; line-height: 1.6; color: var(--ink, #1E0A10);
        }
        .et-dark .et-block-text { color: #F5E6EB; }

        .et-arrow-divider {
          display: flex; justify-content: center;
          margin: 8px 0;
          color: #2B8F50;
          animation: etBounce 1.5s ease-in-out infinite;
        }
        @keyframes etBounce {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(4px); }
        }

        .et-after-block {
          background: rgba(43,143,80,0.07);
          border: 1.5px solid rgba(43,143,80,0.25);
          border-radius: 14px; padding: 14px;
          margin-bottom: 10px;
        }
        .et-dark .et-after-block {
          background: rgba(43,143,80,0.1);
          border-color: rgba(76,175,82,0.25);
        }
        .et-after-block .et-block-label { color: #2B8F50; }
        .et-dark .et-after-block .et-block-label { color: #4CAF82; }

        /* Tips */
        .et-tips {
          background: rgba(43,143,80,0.06);
          border-radius: 12px; padding: 12px 14px;
          margin-bottom: 12px;
        }
        .et-dark .et-tips { background: rgba(76,175,82,0.08); }
        .et-tips-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.8px;
          text-transform: uppercase; color: #2B8F50; margin-bottom: 8px;
        }
        .et-dark .et-tips-label { color: #4CAF82; }
        .et-tip {
          font-size: 13px; line-height: 1.5;
          color: rgba(30,10,16,0.7); padding: 3px 0;
          display: flex; gap: 8px; align-items: flex-start;
        }
        .et-dark .et-tip { color: rgba(245,230,235,0.65); }
        .et-tip-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #2B8F50; flex-shrink: 0; margin-top: 6px;
        }
        .et-dark .et-tip-dot { background: #4CAF82; }

        /* Actions */
        .et-actions { display: flex; gap: 10px; }
        .et-copy-btn {
          flex: 1; padding: 12px;
          border-radius: 12px; border: 1.5px solid rgba(43,143,80,0.3);
          background: transparent; color: #2B8F50;
          font-size: 13px; font-weight: 600;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          cursor: pointer; transition: all 0.15s;
        }
        .et-dark .et-copy-btn { color: #4CAF82; border-color: rgba(76,175,82,0.3); }
        .et-send-btn {
          flex: 2; padding: 12px;
          border-radius: 12px; border: none;
          background: linear-gradient(135deg, #2B8F50 0%, #1A4A2E 100%);
          color: #FFFFFF; font-size: 13px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(43,143,80,0.3);
          transition: transform 0.15s;
        }
        .et-send-btn:active { transform: scale(0.96); }
        .et-send-btn:disabled { opacity: 0.5; transform: none; }
        .et-sent-badge {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 12px; border-radius: 12px;
          background: rgba(43,143,80,0.1); color: #2B8F50;
          font-size: 13px; font-weight: 600;
        }
        .et-dark .et-sent-badge { color: #4CAF82; background: rgba(76,175,82,0.1); }

        /* Error */
        .et-error {
          margin: 0 16px 16px;
          padding: 12px 14px; border-radius: 12px;
          background: rgba(200,51,74,0.08);
          border: 1px solid rgba(200,51,74,0.2);
          font-size: 13px; color: #C8334A;
        }

        /* Loading dots */
        .et-loading {
          display: flex; align-items: center; justify-content: center;
          gap: 6px; padding: 24px;
        }
        .et-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #2B8F50;
          animation: etDotBounce 1.4s ease-in-out infinite both;
        }
        .et-dot:nth-child(1) { animation-delay: 0s; }
        .et-dot:nth-child(2) { animation-delay: 0.2s; }
        .et-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes etDotBounce {
          0%,80%,100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Hero */}
      <div className="et-hero">
        <div className="et-hero-bg" />
        <div className="et-orb1" />
        <div className="et-orb2" />
        <div className="et-hero-content">
          <div className="et-hero-badge">
            <div className="et-hero-badge-dot" />
            ИИ-переводчик
          </div>
          <div className="et-hero-title">Переводчик эмоций</div>
          <div className="et-hero-sub">
            Грубое сообщение → тёплый диалог.<br />
            ИИ сохраняет смысл, убирает агрессию.
          </div>
        </div>
      </div>

      {/* Templates */}
      <div className="et-templates">
        <div className="et-templates-label">Частые ситуации</div>
        <div className="et-templates-scroll">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              className={`et-tpl-chip${selectedTemplate?.id === t.id ? ' active' : ''}`}
              onClick={() => useTemplate(t)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="et-input-area">
        <div className="et-input-label">Что хочешь сказать</div>
        <textarea
          className="et-textarea"
          placeholder="Напиши как есть, даже если резко..."
          value={inputText}
          onChange={e => { setInputText(e.target.value); setResult(null); setSent(false) }}
        />
        <button
          className="et-translate-btn"
          onClick={translate}
          disabled={!inputText.trim() || loading}
        >
          <SparkIcon size={17} />
          {loading ? 'Перевожу...' : 'Переформулировать'}
        </button>
      </div>

      {/* Error */}
      {error && <div className="et-error">{error}</div>}

      {/* Loading */}
      {loading && (
        <div className="et-loading">
          <div className="et-dot" />
          <div className="et-dot" />
          <div className="et-dot" />
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="et-result">
          {/* Before */}
          <div className="et-before-block">
            <div className="et-block-label">Было</div>
            <div className="et-block-text">{result.original}</div>
          </div>

          {/* Arrow */}
          <div className="et-arrow-divider">
            <ArrowDownIcon size={20} />
          </div>

          {/* After */}
          <div className="et-after-block">
            <div className="et-block-label">Стало</div>
            <div className="et-block-text">{result.rewritten}</div>
          </div>

          {/* Tips */}
          {result.tips?.length > 0 && (
            <div className="et-tips">
              <div className="et-tips-label">Совет от ИИ</div>
              {result.tips.map((tip, i) => (
                <div key={i} className="et-tip">
                  <div className="et-tip-dot" />
                  {tip}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="et-actions">
            <button className="et-copy-btn" onClick={copy}>
              {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
              {copied ? 'Скопировано' : 'Скопировать'}
            </button>
            {sent ? (
              <div className="et-sent-badge">
                <CheckIcon size={15} />
                Отправлено
              </div>
            ) : (
              <button className="et-send-btn" onClick={sendToPartner} disabled={sending}>
                <SendIcon size={15} />
                {sending ? 'Отправляю...' : 'Отправить партнёру'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
