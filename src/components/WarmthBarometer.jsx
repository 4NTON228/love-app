import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

/* eslint-disable no-misleading-character-class */
const EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}]/gu
/* eslint-enable no-misleading-character-class */
const WE_RE    = /\b(мы|нас|нам|наш|наша|наше|наши|нашу|нашего|нашей|нашим|нашими)\b/gi

function calcWarmth(messages) {
  if (!messages || messages.length === 0) return { index: 0.5, details: {} }
  const texts = messages.map(m => m.text ?? '')
  const avgLength = texts.reduce((s, t) => s + t.length, 0) / texts.length
  const withEmoji = texts.filter(t => { EMOJI_RE.lastIndex = 0; return EMOJI_RE.test(t) }).length
  const emojiDens = withEmoji / texts.length
  const withWe    = texts.filter(t => { WE_RE.lastIndex = 0; return WE_RE.test(t) }).length
  const weRatio   = withWe / texts.length
  // Messages must be sorted ascending by created_at for correct RT calculation
  let totalRT = 0, rtSamples = 0
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].user_id !== messages[i - 1].user_id) {
      // diff: time between consecutive messages from different users
      const diff = (new Date(messages[i].created_at) - new Date(messages[i - 1].created_at)) / 1000
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
  if (idx < 0.35) return { label: 'Внимание',   color: '#E8556A', colorDark: '#FF6B80', track: '#E8556A' }
  if (idx < 0.65) return { label: 'Нейтрально', color: '#C8A84B', colorDark: '#FFD166', track: '#C8A84B' }
  return               { label: 'Тепло',        color: '#4CAF50', colorDark: '#66BB6A', track: '#4CAF50' }
}

function fmtTime(s) {
  if (s < 60) return `${s}с`
  if (s < 3600) return `${Math.round(s / 60)}мин`
  return `${Math.round(s / 3600)}ч`
}

// SVG icon components — no emoji
function SnowflakeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#FF6B80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
      <polyline points="12 6 9 9 12 6 15 9" />
      <polyline points="18 12 15 9 18 12 15 15" />
      <polyline points="12 18 9 15 12 18 15 15" />
      <polyline points="6 12 9 15 6 12 9 9" />
    </svg>
  )
}

function CloudSunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#FFD166" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="13" r="4" />
      <path d="M13 13a4 4 0 10-4-4" />
      <path d="M17.5 13H18a3 3 0 000-6 3 3 0 00-5.5-1.5" />
      <line x1="19" y1="4" x2="19.5" y2="3.5" />
      <line x1="21" y1="7" x2="22" y2="7" />
      <line x1="19" y1="10" x2="19.5" y2="10.5" />
    </svg>
  )
}

function FlameIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#66BB6A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A4.5 4.5 0 0012 19a4.5 4.5 0 004.5-4.5c0-2-1-3.5-2.5-5C13 11 12 9 12 7c-1 2-3.5 4-3.5 7.5z" />
      <path d="M12 7c0-1.5-.5-3-1.5-4C9 5 8 7 8 9.5A4.5 4.5 0 0012 14" />
    </svg>
  )
}

function WarningTriangleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#FF6B80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#66BB6A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
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
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden
      style={{ opacity: 0, animation: 'wbGaugeIn 0.6s 0.3s ease both' }}>
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

    // ascending order required for correct response-time calculation in calcWarmth
    const { data: msgs } = await supabase.from('messages').select('user_id, text, created_at')
      .or(`user_id.eq.${userId},user_id.eq.${partnerId}`)
      .order('created_at', { ascending: true }).limit(50)
    if (msgs && msgs.length >= 3) setWarmth(calcWarmth(msgs))
    else if (msgs) setLoading(false)
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

  function LevelIcon() {
    const idx = warmth.index
    if (idx < 0.35) return <SnowflakeIcon />
    if (idx < 0.65) return <CloudSunIcon />
    return <FlameIcon />
  }

  return (
    <div className={`wb-page${darkMode ? ' wb-dark' : ''}`}>
      <style>{`
        .wb-page { background: var(--surface, #fff); min-height: 100%; }
        .wb-dark { background: #0A0206; }

        @keyframes wbFloat1 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-18px) scale(1.04); }
        }
        @keyframes wbFloat2 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(14px) scale(0.97); }
        }
        @keyframes wbGaugeIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes wbSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes wbSpin { to { transform: rotate(360deg); } }
        @keyframes wbShimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        /* Hero */
        .wb-hero {
          position: relative; overflow: hidden;
          padding: 28px 20px 0;
          background: linear-gradient(160deg, #4A2200 0%, #2A1200 50%, #0A0302 100%);
        }
        .wb-hero-orb1 {
          position: absolute; top: -40px; right: -40px;
          width: 200px; height: 200px; border-radius: 50%;
          background: radial-gradient(circle, rgba(232,117,58,0.4) 0%, transparent 70%);
          animation: wbFloat1 6s ease-in-out infinite;
          pointer-events: none;
        }
        .wb-hero-orb2 {
          position: absolute; bottom: 10px; left: -60px;
          width: 160px; height: 160px; border-radius: 50%;
          background: radial-gradient(circle, rgba(200,51,74,0.25) 0%, transparent 70%);
          animation: wbFloat2 8s ease-in-out infinite;
          pointer-events: none;
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
          display: flex; align-items: center; gap: 10px;
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
          border-radius: 22px; padding: 16px;
          background: var(--surface, #ffffff);
          border: 1px solid rgba(200,51,74,0.08);
          box-shadow: 0 2px 14px rgba(0,0,0,0.06);
          opacity: 0;
          animation: wbSlideUp 0.45s ease both;
        }
        .wb-dark .wb-stat {
          background: #150509;
          border-color: rgba(232,117,58,0.15);
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }
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
          opacity: 0;
          animation: wbSlideUp 0.4s ease both;
        }
        .wb-dark .wb-hint { color: #F5E6EB; }
        .wb-hint-bad  { background: rgba(232,85,106,0.07); }
        .wb-hint-good { background: rgba(76,175,80,0.07); }
        .wb-hint-icon { flex-shrink: 0; margin-top: 2px; display: flex; }

        /* No partner */
        .wb-empty { text-align: center; padding: 60px 20px; }
        .wb-empty-title { font-size: 16px; font-weight: 700; color: var(--ink, #1E0A10); margin-bottom: 8px; }
        .wb-dark .wb-empty-title { color: #F5E6EB; }
        .wb-empty-text { font-size: 14px; color: var(--muted, #9A6070); line-height: 1.5; }

        /* Loading — spinning ring with gradient border-top */
        .wb-loading { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 60px 20px; }
        .wb-loading-ring {
          width: 48px; height: 48px; border-radius: 50%;
          border: 3px solid rgba(232,117,58,0.15); border-top-color: #E8753A;
          animation: wbSpin 0.9s linear infinite;
        }
        .wb-loading-text {
          font-size: 14px; color: var(--muted, #9A6070);
          background: linear-gradient(90deg, #9A6070 0%, #E8753A 50%, #9A6070 100%);
          background-size: 200% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: wbShimmer 2s linear infinite;
        }
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
            <div className="wb-hero-orb1" />
            <div className="wb-hero-orb2" />
            <div className="wb-hero-tag">
              <svg viewBox="0 0 8 8" width="8" height="8" fill="rgba(255,255,255,0.7)"><circle cx="4" cy="4" r="4" /></svg>
              Барометр теплоты
            </div>
            <div className="wb-hero-label">Сейчас в отношениях</div>
            <div className="wb-hero-level" style={{ color: level.colorDark ?? level.color }}>
              <LevelIcon />
              {level.label}
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
                  <div className="wb-stat" style={{ animationDelay: '0s' }}>
                    <div className="wb-stat-val">{warmth.details.avgLength ?? 0}</div>
                    <div className="wb-stat-bar-wrap">
                      <div className="wb-stat-bar" style={{ width: `${Math.min((warmth.details.avgLength ?? 0) / 100 * 100, 100)}%`, background: level.color }} />
                    </div>
                    <div className="wb-stat-label">символов в среднем</div>
                  </div>
                  <div className="wb-stat" style={{ animationDelay: '0.05s' }}>
                    <div className="wb-stat-val">{warmth.details.avgRT ? fmtTime(warmth.details.avgRT) : '—'}</div>
                    <div className="wb-stat-bar-wrap">
                      <div className="wb-stat-bar" style={{ width: `${Math.max(0, 100 - (warmth.details.avgRT ?? 0) / 3600 * 100)}%`, background: level.color }} />
                    </div>
                    <div className="wb-stat-label">среднее время ответа</div>
                  </div>
                  <div className="wb-stat" style={{ animationDelay: '0.1s' }}>
                    <div className="wb-stat-val">{Math.round((warmth.details.emojiDens ?? 0) * 100)}%</div>
                    <div className="wb-stat-bar-wrap">
                      <div className="wb-stat-bar" style={{ width: `${Math.round((warmth.details.emojiDens ?? 0) * 100)}%`, background: level.color }} />
                    </div>
                    <div className="wb-stat-label">сообщений с эмодзи</div>
                  </div>
                  <div className="wb-stat" style={{ animationDelay: '0.15s' }}>
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
                    <div
                      key={i}
                      className={`wb-hint ${h.bad ? 'wb-hint-bad' : 'wb-hint-good'}`}
                      style={{ animationDelay: `${i * 0.07}s` }}
                    >
                      <span className="wb-hint-icon">
                        {h.bad ? <WarningTriangleIcon /> : <CheckCircleIcon />}
                      </span>
                      {h.text}
                    </div>
                  ))}
                </div>
              </>
            )}

            {hints.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  <FlameIcon />
                </div>
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
