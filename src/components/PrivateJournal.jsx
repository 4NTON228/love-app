import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── SVG Icons ────────────────────────────────────────────────
function PenIcon({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function _SparkIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  )
}

function ArrowRightIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12,5 19,12 12,19" />
    </svg>
  )
}

function TrashIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  )
}

function LockIcon({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  )
}

function MessageIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
}

const MOOD_OPTIONS = [
  { value: 1, label: 'Тяжело', color: '#C8334A' },
  { value: 2, label: 'Грустно', color: '#E8753A' },
  { value: 3, label: 'Нейтрально', color: '#8899AA' },
  { value: 4, label: 'Хорошо', color: '#4CAF82' },
  { value: 5, label: 'Отлично', color: '#2B8FD8' },
]

const _REFLECTION_PROMPTS = [
  'Что именно вызывает это чувство?',
  'Что тебе сейчас больше всего нужно?',
  'Как бы ты описал это состояние в двух словах?',
  'Что поможет тебе почувствовать себя лучше?',
  'Что ты хочешь, чтобы твой партнёр понял?',
  'Какой шаг ты можешь сделать прямо сейчас?',
]

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

export default function PrivateJournal({ session, profile: _profile, darkMode, onConvertToMessage }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [writing, setWriting] = useState(false)
  const [text, setText] = useState('')
  const [mood, setMood] = useState(3)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const textareaRef = useRef(null)

  const loadEntries = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('private_journal')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setEntries(data ?? [])
    setLoading(false)
  }, [session.user.id])

  useEffect(() => { loadEntries() }, [loadEntries])

  async function save() {
    if (!text.trim() || saving) return
    setSaving(true)
    const { data, error } = await supabase
      .from('private_journal')
      .insert({ user_id: session.user.id, content: text.trim(), mood })
      .select()
      .single()

    if (!error && data) {
      setEntries(prev => [data, ...prev])
      setText('')
      setMood(3)
      setWriting(false)
      // Auto-generate AI reflection
      generateReflection(data.id, data.content)
    }
    setSaving(false)
  }

  async function generateReflection(entryId, content) {
    setAiLoading(true)
    try {
      const { data } = await supabase.functions.invoke('relationship-keeper', {
        body: {
          messages: [
            {
              role: 'system',
              content: 'Ты заботливый психолог. Прочитай запись в личный дневник и задай 1-2 глубоких вопроса для рефлексии. Помоги человеку лучше понять свои чувства. Будь тёплым и ненавязчивым. Максимум 3 предложения.',
            },
            { role: 'user', content: `Запись в дневнике:\n${content}` },
          ],
        },
      })
      const reflection = data?.choices?.[0]?.message?.content
      if (reflection) {
        await supabase
          .from('private_journal')
          .update({ ai_reflection: reflection })
          .eq('id', entryId)
        setEntries(prev =>
          prev.map(e => e.id === entryId ? { ...e, ai_reflection: reflection } : e),
        )
      }
    } catch (_) { /* silent */ }
    setAiLoading(false)
  }

  async function deleteEntry(id) {
    await supabase.from('private_journal').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  function handleConvert(entry) {
    if (onConvertToMessage) onConvertToMessage(entry.content)
  }

  const dk = darkMode ? ' pj-dark' : ''

  return (
    <div className={`pj${dk}`}>
      <style>{`
        .pj {
          min-height: 100%;
          background: var(--surface, #FFFFFF);
          color: var(--ink, #1E0A10);
        }
        .pj-dark { background: #0A0206; color: #F5E6EB; }

        /* Hero */
        .pj-hero {
          position: relative;
          padding: 28px 24px 32px;
          overflow: hidden;
        }
        .pj-hero-bg {
          position: absolute; inset: 0;
          background: linear-gradient(150deg, #1A0A2E 0%, #2D1B4E 50%, #0A0206 100%);
        }
        .pj-orb1 {
          position: absolute; top: -30px; right: -20px;
          width: 160px; height: 160px; border-radius: 50%;
          background: radial-gradient(circle, rgba(123,63,190,0.5) 0%, transparent 70%);
          animation: pjFloat1 8s ease-in-out infinite;
        }
        .pj-orb2 {
          position: absolute; bottom: -20px; left: 10px;
          width: 100px; height: 100px; border-radius: 50%;
          background: radial-gradient(circle, rgba(200,51,74,0.3) 0%, transparent 70%);
          animation: pjFloat2 11s ease-in-out infinite;
        }
        @keyframes pjFloat1 {
          0%,100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(-10px, 12px) scale(1.08); }
        }
        @keyframes pjFloat2 {
          0%,100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(8px,-10px) scale(1.05); }
        }
        .pj-hero-content { position: relative; z-index: 1; }
        .pj-hero-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18);
          border-radius: 99px; padding: 4px 12px;
          font-size: 11px; font-weight: 600; letter-spacing: 0.8px;
          text-transform: uppercase; color: rgba(255,255,255,0.8);
          margin-bottom: 14px;
        }
        .pj-hero-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #B87FFF;
          animation: pjPulse 2s ease-in-out infinite;
        }
        @keyframes pjPulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.6); }
        }
        .pj-hero-title {
          font-family: var(--font-head, Georgia, serif);
          font-size: 28px; font-weight: 700; color: #FFFFFF;
          line-height: 1.2; margin-bottom: 8px;
        }
        .pj-hero-sub {
          font-size: 13px; color: rgba(255,255,255,0.55); line-height: 1.5;
          display: flex; align-items: center; gap: 6px;
        }

        /* Write button */
        .pj-write-btn {
          margin: 16px;
          width: calc(100% - 32px);
          padding: 14px;
          border-radius: 16px;
          border: none;
          background: linear-gradient(135deg, #7B3FBE 0%, #3D1A6B 100%);
          color: #FFFFFF;
          font-size: 15px; font-weight: 600;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          cursor: pointer;
          box-shadow: 0 6px 20px rgba(123,63,190,0.35);
          transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
          position: relative; overflow: hidden;
        }
        .pj-write-btn:active { transform: scale(0.96); }
        .pj-write-btn::after {
          content: '';
          position: absolute; top: 0; left: -100%;
          width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          animation: pjShimmer 2.5s ease-in-out infinite;
        }
        @keyframes pjShimmer {
          0% { left: -100%; }
          100% { left: 200%; }
        }

        /* Compose form */
        .pj-compose {
          margin: 0 16px 16px;
          background: var(--blush, #FBF0F2);
          border-radius: 20px;
          padding: 20px;
          animation: pjSlideDown 0.3s cubic-bezier(0.2,1,0.4,1) both;
        }
        .pj-dark .pj-compose { background: #1A0830; }
        @keyframes pjSlideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pj-compose-label {
          font-size: 12px; font-weight: 600; letter-spacing: 0.6px;
          text-transform: uppercase; color: #7B3FBE; margin-bottom: 10px;
        }
        .pj-dark .pj-compose-label { color: #B87FFF; }

        .pj-textarea {
          width: 100%; min-height: 120px;
          border: 1.5px solid rgba(123,63,190,0.2);
          border-radius: 12px; padding: 12px;
          font-size: 15px; line-height: 1.6;
          background: transparent;
          color: inherit; resize: none; outline: none;
          font-family: inherit;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .pj-textarea:focus { border-color: #7B3FBE; }
        .pj-dark .pj-textarea { border-color: rgba(184,127,255,0.25); }

        /* Mood selector */
        .pj-mood-row {
          display: flex; gap: 8px; margin: 12px 0;
          flex-wrap: wrap;
        }
        .pj-mood-btn {
          flex: 1; min-width: 56px;
          padding: 7px 4px; border-radius: 10px;
          border: 1.5px solid transparent;
          font-size: 11px; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
          background: rgba(123,63,190,0.08);
          color: var(--ink, #1E0A10);
        }
        .pj-dark .pj-mood-btn { color: #F5E6EB; background: rgba(184,127,255,0.1); }
        .pj-mood-btn.active {
          color: #FFFFFF;
          transform: scale(1.05);
        }

        .pj-compose-actions {
          display: flex; gap: 10px; margin-top: 12px;
        }
        .pj-cancel-btn {
          flex: 1; padding: 11px;
          border-radius: 12px; border: 1.5px solid rgba(123,63,190,0.25);
          background: transparent; color: #7B3FBE;
          font-size: 14px; font-weight: 600; cursor: pointer;
        }
        .pj-dark .pj-cancel-btn { color: #B87FFF; }
        .pj-save-btn {
          flex: 2; padding: 11px;
          border-radius: 12px; border: none;
          background: linear-gradient(135deg, #7B3FBE 0%, #3D1A6B 100%);
          color: #FFFFFF; font-size: 14px; font-weight: 600; cursor: pointer;
          transition: opacity 0.2s;
        }
        .pj-save-btn:disabled { opacity: 0.5; }

        /* Entries list */
        .pj-entries { padding: 0 16px 24px; }
        .pj-section-title {
          font-size: 12px; font-weight: 700; letter-spacing: 0.8px;
          text-transform: uppercase; color: #7B3FBE; margin-bottom: 12px;
        }
        .pj-dark .pj-section-title { color: #B87FFF; }

        .pj-entry {
          background: var(--blush, #FBF0F2);
          border-radius: 18px; padding: 16px;
          margin-bottom: 12px;
          animation: pjEntryIn 0.35s cubic-bezier(0.2,1,0.4,1) both;
          cursor: pointer;
          transition: transform 0.15s;
        }
        .pj-dark .pj-entry { background: #1A0830; }
        .pj-entry:active { transform: scale(0.98); }
        @keyframes pjEntryIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .pj-entry-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 8px;
        }
        .pj-entry-meta {
          display: flex; align-items: center; gap: 8px;
        }
        .pj-mood-dot {
          width: 10px; height: 10px; border-radius: 50%;
          flex-shrink: 0;
        }
        .pj-entry-date {
          font-size: 11px; color: rgba(30,10,16,0.45);
        }
        .pj-dark .pj-entry-date { color: rgba(245,230,235,0.4); }
        .pj-entry-delete {
          background: none; border: none; cursor: pointer;
          color: rgba(200,51,74,0.4); padding: 4px;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .pj-entry:hover .pj-entry-delete { opacity: 1; }

        .pj-entry-text {
          font-size: 14px; line-height: 1.6;
          color: var(--ink, #1E0A10);
          white-space: pre-wrap;
        }
        .pj-dark .pj-entry-text { color: #F5E6EB; }
        .pj-entry-text.collapsed {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* AI reflection */
        .pj-reflection {
          margin-top: 12px;
          padding: 12px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(123,63,190,0.08) 0%, rgba(61,26,107,0.06) 100%);
          border-left: 2.5px solid #7B3FBE;
          animation: pjSlideDown 0.3s cubic-bezier(0.2,1,0.4,1) both;
        }
        .pj-dark .pj-reflection {
          background: rgba(184,127,255,0.08);
          border-left-color: #B87FFF;
        }
        .pj-reflection-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.7px;
          text-transform: uppercase; color: #7B3FBE; margin-bottom: 6px;
        }
        .pj-dark .pj-reflection-label { color: #B87FFF; }
        .pj-reflection-text {
          font-size: 13px; line-height: 1.55;
          color: rgba(30,10,16,0.75);
          font-style: italic;
        }
        .pj-dark .pj-reflection-text { color: rgba(245,230,235,0.7); }

        /* Convert button */
        .pj-convert-btn {
          display: inline-flex; align-items: center; gap: 6px;
          margin-top: 10px;
          padding: 7px 14px; border-radius: 99px;
          border: 1.5px solid rgba(123,63,190,0.3);
          background: transparent; color: #7B3FBE;
          font-size: 12px; font-weight: 600; cursor: pointer;
          transition: all 0.15s;
        }
        .pj-convert-btn:active { transform: scale(0.95); }
        .pj-dark .pj-convert-btn { color: #B87FFF; border-color: rgba(184,127,255,0.3); }

        /* Loading */
        .pj-loading {
          display: flex; align-items: center; justify-content: center;
          padding: 48px; color: rgba(123,63,190,0.5);
        }
        .pj-empty {
          text-align: center; padding: 40px 24px;
          color: rgba(30,10,16,0.35);
        }
        .pj-dark .pj-empty { color: rgba(245,230,235,0.3); }
        .pj-empty-icon { margin-bottom: 12px; opacity: 0.4; }
        .pj-empty-text { font-size: 14px; line-height: 1.5; }
      `}</style>

      {/* Hero */}
      <div className="pj-hero">
        <div className="pj-hero-bg" />
        <div className="pj-orb1" />
        <div className="pj-orb2" />
        <div className="pj-hero-content">
          <div className="pj-hero-badge">
            <div className="pj-hero-badge-dot" />
            Только для тебя
          </div>
          <div className="pj-hero-title">Личный дневник</div>
          <div className="pj-hero-sub">
            <LockIcon size={13} />
            Записи видны только тебе — не партнёру
          </div>
        </div>
      </div>

      {/* Write button or compose form */}
      {!writing ? (
        <button className="pj-write-btn" onClick={() => { setWriting(true); setTimeout(() => textareaRef.current?.focus(), 50) }}>
          <PenIcon size={18} />
          Написать запись
        </button>
      ) : (
        <div className="pj-compose">
          <div className="pj-compose-label">Как ты себя чувствуешь?</div>
          <div className="pj-mood-row">
            {MOOD_OPTIONS.map(m => (
              <button
                key={m.value}
                className={`pj-mood-btn${mood === m.value ? ' active' : ''}`}
                style={mood === m.value ? { background: m.color, borderColor: m.color } : {}}
                onClick={() => setMood(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            className="pj-textarea"
            placeholder="Напиши всё, что у тебя на душе..."
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <div className="pj-compose-actions">
            <button className="pj-cancel-btn" onClick={() => { setWriting(false); setText(''); setMood(3) }}>
              Отмена
            </button>
            <button className="pj-save-btn" onClick={save} disabled={!text.trim() || saving}>
              {saving ? 'Сохраняю...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      {/* Entries */}
      <div className="pj-entries">
        {entries.length > 0 && (
          <div className="pj-section-title">Записи</div>
        )}

        {loading ? (
          <div className="pj-loading">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
            </svg>
          </div>
        ) : entries.length === 0 ? (
          <div className="pj-empty">
            <div className="pj-empty-icon">
              <PenIcon size={36} />
            </div>
            <div className="pj-empty-text">
              Твой дневник пуст.<br />Напиши первую запись — выплесни всё, что на душе.
            </div>
          </div>
        ) : (
          entries.map((entry, i) => {
            const isExpanded = expandedId === entry.id
            const moodColor = MOOD_OPTIONS.find(m => m.value === entry.mood)?.color ?? '#8899AA'
            return (
              <div
                key={entry.id}
                className="pj-entry"
                style={{ animationDelay: `${i * 0.05}s` }}
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
              >
                <div className="pj-entry-header">
                  <div className="pj-entry-meta">
                    <div className="pj-mood-dot" style={{ background: moodColor }} />
                    <span className="pj-entry-date">{formatDate(entry.created_at)}</span>
                  </div>
                  <button
                    className="pj-entry-delete"
                    onClick={e => { e.stopPropagation(); deleteEntry(entry.id) }}
                    aria-label="Удалить"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>

                <div className={`pj-entry-text${isExpanded ? '' : ' collapsed'}`}>
                  {entry.content}
                </div>

                {isExpanded && (
                  <>
                    {entry.ai_reflection ? (
                      <div className="pj-reflection">
                        <div className="pj-reflection-label">Вопрос для рефлексии</div>
                        <div className="pj-reflection-text">{entry.ai_reflection}</div>
                      </div>
                    ) : aiLoading ? (
                      <div className="pj-reflection">
                        <div className="pj-reflection-label">ИИ думает...</div>
                      </div>
                    ) : null}

                    {onConvertToMessage && (
                      <button className="pj-convert-btn" onClick={e => { e.stopPropagation(); handleConvert(entry) }}>
                        <MessageIcon size={13} />
                        Перевести в сообщение
                        <ArrowRightIcon size={13} />
                      </button>
                    )}
                  </>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
