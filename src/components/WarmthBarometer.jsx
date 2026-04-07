import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}]/gu
const WE_RE    = /\b(мы|нас|нам|наш|наша|наше|наши|нашу|нашего|нашей|нашим|нашими)\b/gi

function calcWarmth(messages) {
  if (!messages || messages.length === 0) return { index: 0.5, details: {} }
  const texts = messages.map(m => m.text ?? '')
  const avgLength = texts.reduce((s, t) => s + t.length, 0) / texts.length
  const withEmoji = texts.filter(t => { EMOJI_RE.lastIndex = 0; return EMOJI_RE.test(t) }).length
  const emojiDens = withEmoji / texts.length
  const withWe    = texts.filter(t => { WE_RE.lastIndex = 0; return WE_RE.test(t) }).length
  const weRatio   = withWe / texts.length
  let totalRT = 0, rtSamples = 0
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].user_id !== messages[i - 1].user_id) {
      const diff = (new Date(messages[i - 1].created_at) - new Date(messages[i].created_at)) / 1000
      if (diff > 0 && diff < 86400) { totalRT += diff; rtSamples++ }
    }
  }
  const avgRT = rtSamples > 0 ? Math.round(totalRT / rtSamples) : 0
  const index = +Math.min(1, Math.max(0,
    Math.min(avgLength / 80, 1) * 0.25 +
    Math.min(emojiDens, 1) * 0.30 +
    Math.min(weRatio * 4, 1) * 0.25 +
    (avgRT > 0 ? Math.max(0, 1 - avgRT / 1800) * 0.20 : 0.10)
  )).toFixed(3)
  return { index, details: { avgLength: Math.round(avgLength), emojiDens, weRatio, avgRT } }
}

function warmthLevel(idx) {
  if (idx < 0.35) return { label: 'Внимание',   emoji: '❄️', color: '#E8556A', colorDark: '#FF6B80', track: '#E8556A' }
  if (idx < 0.65) return { label: 'Нейтрально', emoji: '🌤', color: '#C8A84B', colorDark: '#FFD166', track: '#C8A84B' }
  return               { label: 'Тепло',       emoji: '🔥', color: '#4CAF50', colorDark: '#66BB6A', track: '#4CAF50' }
}

function fmtTime(s) {
  if (s < 60) return `${s}с`
  if (s < 3600) return `${Math.round(s / 60)}мин`
  return `${Math.round(s / 3600)}ч`
}

// Big SVG gauge — center at bottom, arc opens upward
function BigGauge({ index }) {
  const W = 240, H = 130
  const CX = 120, CY = 124, R = 96

  function pt(t) {
    const rad = ((180 + t * 180) * Math.PI) / 180
    return [CX + R * Math.cos(rad), CY + R * Math.sin(rad)]
  }
  function seg(t1, t2) {
    const [x1, y1] = pt(t1)
    const [x2, y2] = pt(t2)
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`
  }

  const level = warmthLevel(index)
  const [nx, ny] = pt(index)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden>
      {/* Track */}
      <path d={seg(0, 1)} fill="none" stroke="rgba(200,51,74,0.08)" strokeWidth="16" strokeLinecap="round" />
      {/* Zone colors */}
      <path d={seg(0, 0.35)}    fill="none" stroke="#E8556A" strokeWidth="16" strokeLinecap="butt" opacity="0.3" />
      <path d={seg(0.35, 0.65)} fill="none" stroke="#C8A84B" strokeWidth="16" strokeLinecap="butt" opacity="0.3" />
      <path d={seg(0.65, 1)}    fill="none" stroke="#4CAF50" strokeWidth="16" strokeLinecap="butt" opacity="0.3" />
      {/* Active arc */}
      {index > 0 && (
        <path d={seg(0, index)} fill="none" stroke={level.color} strokeWidth="16" strokeLinecap="round" opacity="0.9" />
      )}
      {/* Needle */}
      <line
        x1={CX} y1={CY}
        x2={(nx + CX * 0.08).toFixed(1)} y2={(ny + CY * 0.08).toFixed(1)}
        stroke={level.color} strokeWidth="3" strokeLinecap="round"
        style={{ transition: 'all 0.7s cubic-bezier(0.4,0,0.2,1)' }}
      />
      {/* Center dot */}
      <circle cx={CX} cy={CY} r="7" fill={level.color} opacity="0.9" />
      <circle cx={CX} cy={CY} r="3" fill="white" />
      {/* Zone labels */}
      <text x="18" y={H - 6} fontSize="10" fill="#E8556A" opacity="0.7" fontFamily="sans-serif" fontWeight="600"></text>
      <text x={W - 18} y={H - 6} fontSize="10" fill="#4CAF50" opacity="0.7" fontFamily="sans-serif" fontWeight="600" textAnchor="end"></text>
    </svg>
  )
}

export default function WarmthBarometer({ session, profile, darkMode }) {
  const userId    = session?.user?.id
  const partnerId = profile?.partner_id

  const [warmth,   setWarmth]   = useState({ index: 0.5, details: {} })
  const [prev,     setPrev]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const prevRef = useRef(null)

  const compute = useCallback(async () => {
    if (!userId || !partnerId) { setLoading(false); return }
    const today = new Date().toISOString().slice(0, 10)
    const { data: metric } = await supabase.from('warmth_metrics').select('*')
      .eq('user_id', userId).eq('date', today).maybeSingle()

    if (metric) {
      if (prevRef.current !== null && prevRef.current !== metric.warmth_index) setPrev(prevRef.current)
      prevRef.current = metric.warmth_index
      setWarmth({ index: metric.warmth_index, details: { avgLength: metric.avg_length, emojiDens: metric.emoji_density, weRatio: metric.we_ratio, avgRT: metric.avg_response_time } })
      setLoading(false); return
    }

    const { data: msgs } = await supabase.from('messages').select('user_id, text, created_at')
      .or(`user_id.eq.${userId},user_id.eq.${partnerId}`)
      .order('created_at', { ascending: false }).limit(20)
    if (msgs?.length > 0) setWarmth(calcWarmth(msgs))
    setLoading(false)
  }, [userId, partnerId])

  useEffect(() => { compute() }, [compute])

  useEffect(() => {
    if (!userId || !partnerId) return
    const ch = supabase.channel('warmth-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => setTimeout(compute, 500))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [userId, partnerId, compute])

  const level = warmthLevel(warmth.index)
  const delta = prev !== null ? warmth.index - prev : null

  function buildHints() {
    const d = warmth.details
    if (!d || Object.keys(d).length === 0) return []
    const hints = []
    if (d.avgLength < 20) hints.push({ text: 'Ответы стали короче', bad: true })
    if (d.emojiDens < 0.1) hints.push({ text: 'Эмодзи почти исчезли', bad: true })
    if (d.avgRT > 1800) hints.push({ text: `Долгие паузы — ${fmtTime(d.avgRT)} в среднем`, bad: true })
    if (d.weRatio < 0.05) hints.push({ text: 'Редко говорите «мы»', bad: true })
    if (d.avgLength > 80) hints.push({ text: 'Сообщения длинные и содержательные', bad: false })
    if (d.emojiDens > 0.4) hints.push({ text: 'Много эмодзи — хороший знак', bad: false })
    if (d.avgRT < 120) hints.push({ text: 'Отвечаете очень быстро', bad: false })
    return hints
  }

  const hints = buildHints()

  const pct = Math.round(warmth.index * 100)

  return (
    <div className={`wb-page${darkMode ? ' wb-dark' : ''}`}>
      <style>{`
        .wb-page { background: var(--surface, #fff); min-height: 100%; }
        .wb-dark { background: #0A0206; }

        /* Hero */
        .wb-hero {
          position: relative; overflow: hidden;
          padding: 28px 20px 0;
          background: linear-gradient(160deg, #4A2200 0%, #2A1200 50%, #0A0302 100%);
        }
        .wb-hero-orb {
          position: absolute; top: -40px; right: -40px;
          width: 200px; height: 200px; border-radius: 50%;
          background: radial-gradient(circle, rgba(232,117,58,0.4) 0%, transparent 70%);
        }
        .wb-hero-tag {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
          border-radius: 99px; padding: 4px 12px;
          font-size: 11px; font-weight: 700; letter-spacing: 0.8px;
          text-transform: uppercase; color: rgba(255,255,255,0.7);
          margin-bottom: 16px; position: relative; z-index: 1;
        }
        .wb-hero-label {
          font-family: var(--font-head, Georgia, serif);
          font-size: 17px; font-weight: 700;
          color: rgba(255,255,255,0.6); margin-bottom: 4px;
          position: relative; z-index: 1;
        }
        .wb-hero-level {
          font-family: var(--font-head, Georgia, serif);
          font-size: 36px; font-weight: 800;
          line-height: 1.1; margin-bottom: 4px;
          position: relative; z-index: 1;
          transition: color 0.5s;
        }
        .wb-hero-pct {
          font-size: 15px; font-weight: 600; opacity: 0.7;
          position: relative; z-index: 1; margin-bottom: 4px;
        }
        .wb-hero-delta {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 13px; font-weight: 700;
          position: relative; z-index: 1;
        }
        .wb-gauge-wrap {
          display: flex; justify-content: center; margin-top: 8px;
          position: relative; z-index: 1;
        }

        /* Body */
        .wb-body { padding: 20px 16px; }

        /* Stats grid */
        .wb-stats-label {
          font-size: 11px; font-weight: 800; letter-spacing: 0.8px;
          text-transform: uppercase; color: var(--muted, #9A6070);
          margin-bottom: 12px;
        }
        .wb-stats-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 10px; margin-bottom: 20px;
        }
        .wb-stat {
          border-radius: 18px; padding: 16px;
          background: var(--blush, #FBF0F2);
          border: 1px solid var(--border, rgba(200,51,74,0.08));
        }
        .wb-dark .wb-stat { background: #180810; border-color: rgba(232,117,58,0.15); }
        .wb-stat-val {
          font-family: var(--font-head, Georgia, serif);
          font-size: 26px; font-weight: 800; line-height: 1;
          color: var(--ink, #1E0A10); margin-bottom: 4px;
        }
        .wb-dark .wb-stat-val { color: #F5E6EB; }
        .wb-stat-bar-wrap {
          height: 4px; background: var(--border, rgba(200,51,74,0.1));
          border-radius: 99px; overflow: hidden; margin: 6px 0;
        }
        .wb-stat-bar { height: 100%; border-radius: 99px; transition: width 0.6s ease; }
        .wb-stat-label { font-size: 11px; color: var(--muted, #9A6070); font-weight: 600; letter-spacing: 0.3px; }

        /* Hints */
        .wb-hints-label {
          font-size: 11px; font-weight: 800; letter-spacing: 0.8px;
          text-transform: uppercase; color: var(--muted, #9A6070);
          margin-bottom: 12px;
        }
        .wb-hints-list { display: flex; flex-direction: column; gap: 8px; }
        .wb-hint {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 12px 14px; border-radius: 14px;
          font-size: 14px; line-height: 1.4;
          color: var(--ink, #1E0A10);
        }
        .wb-dark .wb-hint { color: #F5E6EB; }
        .wb-hint-bad  { background: rgba(232,85,106,0.07); }
        .wb-hint-good { background: rgba(76,175,80,0.07); }
        .wb-hint-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }

        /* No partner */
        .wb-empty { text-align: center; padding: 60px 20px; }
        .wb-empty-title { font-size: 16px; font-weight: 700; color: var(--ink, #1E0A10); margin-bottom: 8px; }
        .wb-dark .wb-empty-title { color: #F5E6EB; }
        .wb-empty-text { font-size: 14px; color: var(--muted, #9A6070); line-height: 1.5; }

        /* Loading */
        .wb-loading { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 60px 20px; }
        .wb-loading-ring {
          width: 48px; height: 48px; border-radius: 50%;
          border: 3px solid rgba(232,117,58,0.15); border-top-color: #E8753A;
          animation: wbSpin 0.9s linear infinite;
        }
        @keyframes wbSpin { to { transform: rotate(360deg); } }
        .wb-loading-text { font-size: 14px; color: var(--muted, #9A6070); }
      `}</style>

      {loading ? (
        <div className="wb-loading">
          <div className="wb-loading-ring" />
          <div className="wb-loading-text">Анализирую переписку...</div>
        </div>
      ) : !partnerId ? (
        <div className="wb-empty">
          <div className="wb-empty-title">Партнёр не подключён</div>
          <div className="wb-empty-text">Добавьте партнёра в настройках — тогда появится барометр общения.</div>
        </div>
      ) : (
        <>
          {/* Hero */}
          <div className="wb-hero">
            <div className="wb-hero-orb" />
            <div className="wb-hero-tag">
              <svg viewBox="0 0 8 8" width="8" height="8" fill="rgba(255,255,255,0.7)"><circle cx="4" cy="4" r="4" /></svg>
              Барометр теплоты
            </div>
            <div className="wb-hero-label">Сейчас в отношениях</div>
            <div className="wb-hero-level" style={{ color: level.colorDark ?? level.color }}>
              {level.emoji} {level.label}
            </div>
            <div className="wb-hero-pct" style={{ color: level.colorDark ?? level.color }}>
              {pct}% тепла
            </div>
            {delta !== null && (
              <div className="wb-hero-delta" style={{ color: delta >= 0 ? '#66BB6A' : '#FF6B80' }}>
                {delta >= 0 ? '▲' : '▼'} {Math.round(Math.abs(delta) * 100)}% с прошлого раза
              </div>
            )}
            <div className="wb-gauge-wrap">
              <BigGauge index={warmth.index} />
            </div>
          </div>

          <div className="wb-body">
            {/* Stats grid */}
            {warmth.details && Object.keys(warmth.details).length > 0 && (
              <>
                <div className="wb-stats-label">Статистика</div>
                <div className="wb-stats-grid">
                  <div className="wb-stat">
                    <div className="wb-stat-val">{warmth.details.avgLength ?? 0}</div>
                    <div className="wb-stat-bar-wrap">
                      <div className="wb-stat-bar" style={{ width: `${Math.min((warmth.details.avgLength ?? 0) / 100 * 100, 100)}%`, background: level.color }} />
                    </div>
                    <div className="wb-stat-label">символов в среднем</div>
                  </div>
                  <div className="wb-stat">
                    <div className="wb-stat-val">{warmth.details.avgRT ? fmtTime(warmth.details.avgRT) : '—'}</div>
                    <div className="wb-stat-bar-wrap">
                      <div className="wb-stat-bar" style={{ width: `${Math.max(0, 100 - (warmth.details.avgRT ?? 0) / 3600 * 100)}%`, background: level.color }} />
                    </div>
                    <div className="wb-stat-label">среднее время ответа</div>
                  </div>
                  <div className="wb-stat">
                    <div className="wb-stat-val">{Math.round((warmth.details.emojiDens ?? 0) * 100)}%</div>
                    <div className="wb-stat-bar-wrap">
                      <div className="wb-stat-bar" style={{ width: `${Math.round((warmth.details.emojiDens ?? 0) * 100)}%`, background: level.color }} />
                    </div>
                    <div className="wb-stat-label">сообщений с эмодзи</div>
                  </div>
                  <div className="wb-stat">
                    <div className="wb-stat-val">{Math.round((warmth.details.weRatio ?? 0) * 100)}%</div>
                    <div className="wb-stat-bar-wrap">
                      <div className="wb-stat-bar" style={{ width: `${Math.round((warmth.details.weRatio ?? 0) * 100)}%`, background: level.color }} />
                    </div>
                    <div className="wb-stat-label">«мы»-слов</div>
                  </div>
                </div>
              </>
            )}

            {/* Hints */}
            {hints.length > 0 && (
              <>
                <div className="wb-hints-label">Наблюдения</div>
                <div className="wb-hints-list">
                  {hints.map((h, i) => (
                    <div key={i} className={`wb-hint ${h.bad ? 'wb-hint-bad' : 'wb-hint-good'}`}>
                      <span className="wb-hint-icon">{h.bad ? '⚠️' : '✅'}</span>
                      {h.text}
                    </div>
                  ))}
                </div>
              </>
            )}

            {hints.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔥</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink, #1E0A10)', marginBottom: 6 }}>Всё отлично!</div>
                <div style={{ fontSize: 14, color: 'var(--muted, #9A6070)' }}>Общение живое и тёплое</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
