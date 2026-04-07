// ══════════════════════════════════════════════════════════════
// WarmthBarometer — Эмоциональный барометр
//
// Анализирует последние 20 сообщений пары и показывает:
//   • Уровень: «внимание» / «нейтрально» / «тепло»
// На основе: длины сообщений, эмодзи, «мы»-слов, времени ответа.
// Обновляется в реальном времени. При нажатии — детали.
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Паттерн поиска эмодзи (unicode ranges)
const EMOJI_RE =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}]/gu

// «Мы»-слова — индикатор близости
const WE_RE = /\b(мы|нас|нам|наш|наша|наше|наши|нашу|нашего|нашей|нашим|нашими)\b/gi

// ── Расчёт индекса теплоты из массива сообщений ──────────────
function calcWarmth(messages) {
  if (!messages || messages.length === 0) return { index: 0.5, details: {} }

  const texts = messages.map(m => m.text ?? '')

  // Средняя длина
  const avgLength = texts.length > 0
    ? Math.round(texts.reduce((s, t) => s + t.length, 0) / texts.length)
    : 0

  // Плотность эмодзи
  const withEmoji  = texts.filter(t => { EMOJI_RE.lastIndex = 0; return EMOJI_RE.test(t) }).length
  const emojiDens  = texts.length > 0 ? withEmoji / texts.length : 0

  // Частота «мы»-слов
  const withWe = texts.filter(t => { WE_RE.lastIndex = 0; return WE_RE.test(t) }).length
  const weRatio = texts.length > 0 ? withWe / texts.length : 0

  // Среднее время ответа (секунды)
  let totalRT = 0, rtSamples = 0
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].user_id !== messages[i - 1].user_id) {
      const diff =
        (new Date(messages[i - 1].created_at) - new Date(messages[i].created_at)) / 1000
      if (diff > 0 && diff < 86400) { totalRT += diff; rtSamples++ }
    }
  }
  const avgRT = rtSamples > 0 ? Math.round(totalRT / rtSamples) : 0

  // Взвешенный индекс
  const lengthScore   = Math.min(avgLength / 80, 1)   * 0.25
  const emojiScore    = Math.min(emojiDens, 1)          * 0.30
  const weScore       = Math.min(weRatio * 4, 1)        * 0.25
  const responseScore = avgRT > 0
    ? Math.max(0, 1 - avgRT / 1800) * 0.20
    : 0.10

  const index = +Math.min(1, Math.max(0,
    lengthScore + emojiScore + weScore + responseScore,
  )).toFixed(3)

  return {
    index,
    details: { avgLength, emojiDens, weRatio, avgRT },
  }
}

// ── Уровень по индексу ────────────────────────────────────────
function warmthLevel(idx) {
  if (idx < 0.35) return { label: 'Внимание',   color: '#E8556A', bg: 'rgba(232,85,106,0.1)' }
  if (idx < 0.65) return { label: 'Нейтрально', color: '#C8A84B', bg: 'rgba(200,168,75,0.1)' }
  return               { label: 'Тепло',       color: '#4CAF50', bg: 'rgba(76,175,80,0.1)' }
}

// ── SVG полукруговой барометр ─────────────────────────────────
function Gauge({ index }) {
  // Полукруг: arc от 180° до 0° (слева направо)
  // index 0→0°, index 1→180°
  const R = 56
  const CX = 70, CY = 70
  const startAngle = Math.PI   // 180° — левая точка
  const endAngle   = 0          // 0°   — правая точка

  // Описываем arc для фона (полный полукруг)
  function arcPath(from, to, r) {
    const x1 = CX + r * Math.cos(from)
    const y1 = CY + r * Math.sin(from)
    const x2 = CX + r * Math.cos(to)
    const y2 = CY + r * Math.sin(to)
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
  }

  // Угол стрелки: от π до 0 в зависимости от index
  const needleAngle = Math.PI - index * Math.PI
  const needleX = CX + (R - 8) * Math.cos(needleAngle)
  const needleY = CY + (R - 8) * Math.sin(needleAngle)

  const level = warmthLevel(index)

  return (
    <svg viewBox="0 0 140 80" width="140" height="80" aria-hidden="true">
      {/* Фоновый трек (серый) */}
      <path
        d={arcPath(startAngle, endAngle, R)}
        fill="none"
        stroke="var(--blush-2)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Сегмент «внимание» (0 – 0.35) — красный */}
      <path
        d={arcPath(Math.PI, Math.PI * (1 - 0.35), R)}
        fill="none" stroke="#E8556A" strokeWidth="10" strokeLinecap="butt" opacity="0.5"
      />
      {/* Сегмент «нейтрально» (0.35 – 0.65) — жёлтый */}
      <path
        d={arcPath(Math.PI * (1 - 0.35), Math.PI * (1 - 0.65), R)}
        fill="none" stroke="#C8A84B" strokeWidth="10" strokeLinecap="butt" opacity="0.5"
      />
      {/* Сегмент «тепло» (0.65 – 1.0) — зелёный */}
      <path
        d={arcPath(Math.PI * (1 - 0.65), endAngle, R)}
        fill="none" stroke="#4CAF50" strokeWidth="10" strokeLinecap="butt" opacity="0.5"
      />
      {/* Активный прогресс */}
      <path
        d={arcPath(startAngle, Math.PI - index * Math.PI, R)}
        fill="none" stroke={level.color} strokeWidth="10" strokeLinecap="round"
        style={{ transition: 'all 0.6s ease' }}
      />
      {/* Стрелка */}
      <line
        x1={CX} y1={CY}
        x2={needleX} y2={needleY}
        stroke={level.color} strokeWidth="2.5" strokeLinecap="round"
        style={{ transition: 'all 0.6s ease' }}
      />
      {/* Центр стрелки */}
      <circle cx={CX} cy={CY} r="4" fill={level.color}
        style={{ transition: 'fill 0.6s ease' }} />
    </svg>
  )
}

// ── Форматирование времени ────────────────────────────────────
function fmtTime(seconds) {
  if (seconds < 60)  return `${seconds}с`
  if (seconds < 3600) return `${Math.round(seconds / 60)}мин`
  return `${Math.round(seconds / 3600)}ч`
}

export default function WarmthBarometer({ session, profile, darkMode }) {
  const userId    = session?.user?.id
  const partnerId = profile?.partner_id

  // ── Состояние ─────────────────────────────────────────────
  const [warmth,    setWarmth]    = useState({ index: 0.5, details: {} })
  const [prev,      setPrev]      = useState(null)   // предыдущий индекс для сравнения
  const [expanded,  setExpanded]  = useState(false)
  const [loading,   setLoading]   = useState(true)
  const prevRef = useRef(null)

  // ── Загрузка и расчёт ────────────────────────────────────
  const compute = useCallback(async () => {
    if (!userId || !partnerId) { setLoading(false); return }

    // Пробуем взять готовые метрики из БД (рассчитаны edge function)
    const today = new Date().toISOString().slice(0, 10)
    const { data: metric } = await supabase
      .from('warmth_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle()

    if (metric) {
      // Сохраняем предыдущее значение для сравнения
      if (prevRef.current !== null && prevRef.current !== metric.warmth_index) {
        setPrev(prevRef.current)
      }
      prevRef.current = metric.warmth_index

      setWarmth({
        index: metric.warmth_index,
        details: {
          avgLength:  metric.avg_length,
          emojiDens:  metric.emoji_density,
          weRatio:    metric.we_ratio,
          avgRT:      metric.avg_response_time,
        },
      })
      setLoading(false)
      return
    }

    // Нет метрики в БД — считаем на клиенте по последним 20 сообщениям
    const { data: msgs } = await supabase
      .from('messages')
      .select('user_id, text, created_at')
      .or(`user_id.eq.${userId},user_id.eq.${partnerId}`)
      .order('created_at', { ascending: false })
      .limit(20)

    if (msgs && msgs.length > 0) {
      const w = calcWarmth(msgs)
      setWarmth(w)
    }

    setLoading(false)
  }, [userId, partnerId])

  useEffect(() => { compute() }, [compute])

  // Реалтайм — обновляем при новых сообщениях
  useEffect(() => {
    if (!userId || !partnerId) return
    const channel = supabase
      .channel('warmth-realtime')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
      }, () => {
        // Небольшая задержка, чтобы сообщение успело попасть в БД
        setTimeout(compute, 500)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [userId, partnerId, compute])

  const level = warmthLevel(warmth.index)

  // ── Дельта изменения ──────────────────────────────────────
  const delta = prev !== null ? warmth.index - prev : null

  // ── Подсказки (почему такой уровень) ─────────────────────
  function buildHints() {
    const hints = []
    const d = warmth.details
    if (!d || Object.keys(d).length === 0) return hints

    if (d.avgLength < 20)
      hints.push('Ответы короче обычного')
    if (d.emojiDens < 0.1)
      hints.push('Эмодзи почти исчезли')
    if (d.avgRT > 1800)
      hints.push(`Среднее время ответа: ${fmtTime(d.avgRT)}`)
    if (d.weRatio < 0.05)
      hints.push('Реже говорите «мы»')
    if (d.avgLength > 80 && d.emojiDens > 0.4)
      hints.push('Сообщения длинные и тёплые')
    if (d.avgRT < 120)
      hints.push('Отвечаете очень быстро')

    return hints
  }

  const hints = buildHints()

  return (
    <>
      <style>{`
        .wb-card {
          background: var(--surface);
          border-radius: var(--radius-lg, 20px);
          border: 0.5px solid var(--border);
          padding: 16px 20px 14px;
          box-shadow: var(--shadow);
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
          user-select: none;
          position: relative; overflow: hidden;
        }
        .app.dark .wb-card { background: var(--surface-2); }
        .wb-card:active { transform: scale(0.99); }
        .wb-header {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 4px;
        }
        .wb-title {
          font-size: 12px; font-weight: 700;
          letter-spacing: 0.5px; text-transform: uppercase;
          color: var(--text-muted);
        }
        .wb-badge {
          display: flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 20px;
          font-size: 12px; font-weight: 700;
          transition: background 0.5s, color 0.5s;
        }
        .wb-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
        }
        .wb-main {
          display: flex; align-items: center; gap: 12px;
        }
        .wb-gauge { flex-shrink: 0; margin-left: -8px; }
        .wb-info { flex: 1; }
        .wb-level {
          font-family: var(--font-display);
          font-size: 22px; font-weight: 700; font-style: italic;
          transition: color 0.5s;
          line-height: 1.1;
        }
        .wb-sub {
          font-size: 12px; color: var(--text-muted);
          margin-top: 3px; line-height: 1.4;
        }
        .wb-delta {
          font-size: 11px; font-weight: 700;
          display: inline-flex; align-items: center; gap: 2px;
        }
        .wb-expand-icon {
          position: absolute; bottom: 10px; right: 16px;
          color: var(--text-muted); transition: transform 0.25s;
        }
        .wb-expand-icon.open { transform: rotate(180deg); }

        /* Детали */
        .wb-details {
          overflow: hidden;
          transition: max-height 0.3s ease, opacity 0.3s ease;
          max-height: 0; opacity: 0;
        }
        .wb-details.open {
          max-height: 300px; opacity: 1;
        }
        .wb-details-inner {
          padding-top: 14px;
          border-top: 1px solid var(--border);
          margin-top: 12px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .wb-hint {
          display: flex; align-items: center; gap: 8px;
          font-size: 13px; color: var(--text-muted); line-height: 1.3;
        }
        .wb-hint-dot {
          width: 5px; height: 5px; border-radius: 50%;
          flex-shrink: 0; background: var(--rose);
        }
        .wb-stats-row {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 8px; margin-top: 4px;
        }
        .wb-stat {
          background: var(--blush);
          border-radius: 12px; padding: 10px 12px;
          display: flex; flex-direction: column; gap: 2px;
        }
        .app.dark .wb-stat { background: #3D1520; }
        .wb-stat-val {
          font-family: var(--font-display);
          font-size: 18px; font-weight: 700; color: var(--ink);
          line-height: 1;
        }
        .wb-stat-label {
          font-size: 10px; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.4px;
        }
        .wb-loading {
          display: flex; align-items: center; justify-content: center;
          height: 80px; color: var(--text-muted); font-size: 13px;
        }
      `}</style>

      <div
        className="wb-card"
        onClick={() => setExpanded(v => !v)}
        role="button"
        aria-expanded={expanded}
      >
        {/* Заголовок */}
        <div className="wb-header">
          <span className="wb-title">Барометр</span>
          <div
            className="wb-badge"
            style={{ background: level.bg, color: level.color }}
          >
            <div className="wb-badge-dot" style={{ background: level.color }} />
            {level.label}
          </div>
        </div>

        {loading ? (
          <div className="wb-loading">
            <span style={{ animation: 'pulse 1.5s infinite' }}>Анализирую...</span>
          </div>
        ) : (
          <>
            <div className="wb-main">
              {/* SVG-барометр */}
              <div className="wb-gauge">
                <Gauge index={warmth.index} />
              </div>
              <div className="wb-info">
                <div className="wb-level" style={{ color: level.color }}>
                  {level.label}
                </div>
                <div className="wb-sub">
                  По последним 20 сообщениям
                  {delta !== null && (
                    <>
                      {' '}·{' '}
                      <span
                        className="wb-delta"
                        style={{ color: delta >= 0 ? '#4CAF50' : '#E8556A' }}
                      >
                        {/* Стрелка вверх/вниз */}
                        <svg viewBox="0 0 10 10" width="10" height="10" fill="currentColor">
                          {delta >= 0
                            ? <polygon points="5,1 9,9 1,9" />
                            : <polygon points="5,9 9,1 1,1" />}
                        </svg>
                        {Math.round(Math.abs(delta) * 100)}%
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Иконка раскрытия */}
            <div className={`wb-expand-icon${expanded ? ' open' : ''}`}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {/* Детали */}
            <div className={`wb-details${expanded ? ' open' : ''}`}>
              <div className="wb-details-inner">
                {hints.length > 0 ? (
                  hints.map((h, i) => (
                    <div key={i} className="wb-hint">
                      <div className="wb-hint-dot" />
                      {h}
                    </div>
                  ))
                ) : (
                  <div className="wb-hint">
                    <div className="wb-hint-dot" style={{ background: '#4CAF50' }} />
                    Всё хорошо, общение живое
                  </div>
                )}

                {/* Мини-статистика */}
                {warmth.details && Object.keys(warmth.details).length > 0 && (
                  <div className="wb-stats-row">
                    <div className="wb-stat">
                      <span className="wb-stat-val">
                        {warmth.details.avgLength ?? 0}
                      </span>
                      <span className="wb-stat-label">сим. в среднем</span>
                    </div>
                    <div className="wb-stat">
                      <span className="wb-stat-val">
                        {warmth.details.avgRT ? fmtTime(warmth.details.avgRT) : '—'}
                      </span>
                      <span className="wb-stat-label">среднее ответа</span>
                    </div>
                    <div className="wb-stat">
                      <span className="wb-stat-val">
                        {Math.round((warmth.details.emojiDens ?? 0) * 100)}%
                      </span>
                      <span className="wb-stat-label">с эмодзи</span>
                    </div>
                    <div className="wb-stat">
                      <span className="wb-stat-val">
                        {Math.round((warmth.details.weRatio ?? 0) * 100)}%
                      </span>
                      <span className="wb-stat-label">«мы»-слов</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
