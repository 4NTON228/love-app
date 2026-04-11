// ══════════════════════════════════════════════════════════════
// InsightsWidget — Страница советов ИИ
// Показывает персональный анализ и советы по отношениям
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── SVG-иконки ──────────────────────────────────────────────

function SparkleIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color} stroke="none">
      <path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2z" />
      <path d="M19 15l.8 2.7 2.7.8-2.7.8L19 22l-.8-2.7-2.7-.8 2.7-.8L19 15z" opacity=".6"/>
      <path d="M5 3l.5 1.7 1.7.5-1.7.5L5 7l-.5-1.7L2.8 4.7l1.7-.5L5 3z" opacity=".5"/>
    </svg>
  )
}

function HeartIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color} stroke="none">
      <path d="M12 21C12 21 3 14.5 3 8.5 3 5.4 5.4 3 8.5 3c1.7 0 3.3.8 4.4 2 1.1-1.2 2.7-2 4.4-2C20.6 3 23 5.4 23 8.5c0 6-9 12.5-9 12.5H12z" />
    </svg>
  )
}

function ChatIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
}

function MirrorIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="10" rx="7" ry="9" />
      <path d="M9 21h6M12 19v2" />
    </svg>
  )
}

function ThermIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" />
    </svg>
  )
}

function RefreshIcon({ size = 18, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23,4 23,10 17,10" />
      <path d="M20.5 15a9 9 0 11-2.5-9L23 10" />
    </svg>
  )
}

// ── Типы советов ─────────────────────────────────────────────
const TYPE_META = {
  dialog:  { label: 'Диалог',   Icon: ChatIcon,   color: '#C8334A', bg: 'rgba(200,51,74,0.1)' },
  mirror:  { label: 'Зеркало',  Icon: MirrorIcon, color: '#7B3FBE', bg: 'rgba(123,63,190,0.1)' },
  warmth:  { label: 'Теплота',  Icon: ThermIcon,  color: '#E8753A', bg: 'rgba(232,117,58,0.1)' },
  ai:      { label: 'ИИ-совет', Icon: SparkleIcon, color: '#2B8FD8', bg: 'rgba(43,143,216,0.1)' },
}

// Готовые советы для демонстрации без AI
const PRESET_TIPS = [
  { type: 'ai', title: 'Маленькие жесты', text: 'Отношения поддерживаются не большими событиями, а мелочами: утреннее сообщение, неожиданная похвала, совместный ритуал. Выберите одну небольшую привычку на эту неделю.' },
  { type: 'ai', title: 'Активное слушание', text: 'Когда партнёр говорит о чём-то важном — уберите телефон. Полное внимание на 5 минут дороже часа разговора вполуха.' },
  { type: 'ai', title: 'Благодарность вслух', text: 'Скажите партнёру за что вы ему/ей благодарны прямо сегодня. Конкретно, не абстрактно — «спасибо, что помог с...» работает лучше чем «ты хороший».' },
  { type: 'mirror', title: 'Синхронность мыслей', text: 'Ответьте на вопрос дня в зеркале — это помогает понять как вы оба смотрите на одно и то же событие. Нередко ответы удивляют.' },
  { type: 'dialog', title: 'Незавершённые темы', text: 'Если в чате оборвался разговор — вернитесь к нему. «Мы так и не договорили про...» — часто лучшее начало для важного разговора.' },
  { type: 'warmth', title: 'Качество VS количество', text: 'Дело не в том сколько сообщений в день — а в том насколько они содержательные. Один вдумчивый ответ лучше десяти «ок».' },
]

export default function InsightsWidget({ session, profile, darkMode }) {
  const userId    = session?.user?.id
  const partnerId = profile?.partner_id

  const [dataInsights, setDataInsights] = useState([])
  const [aiText, setAiText]             = useState(null)
  const [generating, setGenerating]     = useState(false)
  const [loadingData, setLoadingData]   = useState(true)
  const [error, setError]               = useState(null)
  const [tipIdx, setTipIdx]             = useState(() => Math.floor(Math.random() * PRESET_TIPS.length))

  // ── Загрузка данных и генерация статичных инсайтов ───────
  const loadDataInsights = useCallback(async () => {
    if (!userId) { setLoadingData(false); return }
    setLoadingData(true)
    const insights = []
    const now = new Date()

    try {
      // 1. Проверяем зеркало сегодня
      if (partnerId) {
        const today = now.toISOString().slice(0, 10)
        const { data: mirror } = await supabase
          .from('sync_mirror')
          .select('*')
          .or(`user_id.eq.${userId},partner_id.eq.${userId}`)
          .gte('created_at', `${today}T00:00:00Z`)
          .limit(1)
          .maybeSingle()

        if (mirror) {
          const isOwner = mirror.user_id === userId
          const myAns   = isOwner ? mirror.answer : mirror.partner_answer
          const theirAns = isOwner ? mirror.partner_answer : mirror.answer
          if (!myAns) {
            insights.push({
              id: 'mirror_unanswered',
              type: 'mirror',
              title: 'Вопрос дня ждёт ответа',
              text: `«${(mirror.question || '').slice(0, 80)}» — ты ещё не ответил(а).`,
              priority: 2,
            })
          } else if (myAns && !theirAns) {
            insights.push({
              id: 'mirror_waiting',
              type: 'mirror',
              title: 'Ждём партнёра',
              text: 'Ты ответил(а) на вопрос дня. Партнёр ещё не ответил — ответы откроются когда оба напишут.',
              priority: 1,
            })
          } else if (myAns && theirAns) {
            insights.push({
              id: 'mirror_done',
              type: 'mirror',
              title: mirror.is_matched ? '✨ Ответы совпали!' : 'Зеркало заполнено',
              text: mirror.is_matched
                ? 'Сегодня ваши ответы на вопрос дня оказались похожими. Это +1 к синхронности.'
                : 'Оба ответили на вопрос дня — хорошо! Разные взгляды тоже ценны.',
              priority: 0,
            })
          }
        } else {
          insights.push({
            id: 'mirror_missing',
            type: 'mirror',
            title: 'Зеркало сегодня не открыто',
            text: 'Вопрос дня ещё не появился. Зайди в раздел «Зеркало» — там будет вопрос для вас обоих.',
            priority: 1,
          })
        }
      }

      // 2. Проверяем барометр теплоты
      const { data: metric } = await supabase
        .from('warmth_metrics')
        .select('warmth_index, avg_length, emoji_density, avg_response_time')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (metric) {
        const wi = metric.warmth_index ?? 0
        let warmthText = ''
        if (wi >= 0.7) warmthText = 'Ваш барометр в зелёной зоне — общение живое и тёплое. Так держать!'
        else if (wi >= 0.4) warmthText = 'Общение в норме. Небольшой жест — эмодзи, вопрос или воспоминание — сделает его теплее.'
        else {
          const parts = []
          if (metric.avg_length < 15) parts.push('короткие ответы')
          if (metric.emoji_density < 0.05) parts.push('мало эмодзи')
          if (metric.avg_response_time > 7200) parts.push('долгие паузы')
          warmthText = `Барометр показывает охлаждение${parts.length ? ': ' + parts.join(', ') : ''}. Напиши партнёру что-то тёплое?`
        }
        insights.push({
          id: 'warmth_status',
          type: 'warmth',
          title: wi >= 0.7 ? 'Тепло в отношениях' : wi >= 0.4 ? 'Общение в норме' : 'Барометр в зоне внимания',
          text: warmthText,
          priority: wi < 0.4 ? 2 : 0,
        })
      }

      // 3. Незавершённый диалог
      if (partnerId) {
        const cutoff = new Date(now.getTime() - 8 * 3600000).toISOString()
        const { data: questions } = await supabase
          .from('messages')
          .select('id, text, created_at')
          .eq('user_id', userId)
          .ilike('text', '%?%')
          .lte('created_at', cutoff)
          .order('created_at', { ascending: false })
          .limit(1)

        if (questions?.[0]) {
          const { data: reply } = await supabase
            .from('messages')
            .select('id')
            .eq('user_id', partnerId)
            .gt('created_at', questions[0].created_at)
            .limit(1)
            .maybeSingle()

          if (!reply) {
            insights.push({
              id: 'dialog_unanswered',
              type: 'dialog',
              title: 'Вопрос без ответа',
              text: `«${(questions[0].text || '').slice(0, 70).replace(/\n/g, ' ')}...» — партнёр ещё не ответил. Может напомнить?`,
              priority: 2,
            })
          }
        }
      }

      // Сортируем по приоритету
      insights.sort((a, b) => b.priority - a.priority)
      setDataInsights(insights)
    } catch (e) {
      console.error('InsightsWidget load error:', e)
    } finally {
      setLoadingData(false)
    }
  }, [userId, partnerId])

  useEffect(() => { loadDataInsights() }, [loadDataInsights])

  // ── Генерация AI-совета через edge function ───────────────
  async function generateAIAdvice() {
    if (!userId) return
    setGenerating(true)
    setError(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('relationship-keeper', {
        body: {
          action: 'ai_advice',
          userId,
          partnerId,
          context: {
            hasPartner: !!partnerId,
            insights: dataInsights.map(i => i.title).join(', '),
          },
        },
      })

      if (fnErr) throw fnErr
      if (data?.advice) {
        setAiText(data.advice)
      } else {
        // Фолбэк — полезный готовый совет
        const next = (tipIdx + 1) % PRESET_TIPS.length
        setTipIdx(next)
        setAiText(PRESET_TIPS[next].text)
      }
    } catch {
      // Показываем следующий готовый совет
      const next = (tipIdx + 1) % PRESET_TIPS.length
      setTipIdx(next)
      setAiText(PRESET_TIPS[next].text)
    } finally {
      setGenerating(false)
    }
  }

  const tip = PRESET_TIPS[tipIdx]

  return (
    <div className={`insights-page${darkMode ? ' insights-dark' : ''}`}>
      <style>{`
        .insights-page {
          padding: 20px 16px;
          padding-bottom: 32px;
        }

        /* ── AI generate block ── */
        .ins-ai-block {
          border-radius: 24px;
          background: linear-gradient(135deg, #1A3A5C 0%, #0D1F33 100%);
          padding: 24px 20px;
          margin-bottom: 20px;
          position: relative;
          overflow: hidden;
        }
        .ins-ai-block::before {
          content: '';
          position: absolute;
          top: -30px; right: -30px;
          width: 120px; height: 120px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(43,143,216,0.3) 0%, transparent 70%);
        }
        .ins-ai-header {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 12px;
        }
        .ins-ai-icon {
          width: 40px; height: 40px; border-radius: 12px;
          background: rgba(43,143,216,0.2);
          display: flex; align-items: center; justify-content: center;
          color: #5BB8FF;
        }
        .ins-ai-label {
          font-size: 12px; font-weight: 600; letter-spacing: 0.5px;
          text-transform: uppercase; color: rgba(91,184,255,0.8);
          margin-bottom: 2px;
        }
        .ins-ai-title {
          font-size: 15px; font-weight: 700; color: #FFFFFF;
        }
        .ins-ai-text {
          font-size: 14px; line-height: 1.6;
          color: rgba(255,255,255,0.8);
          margin-bottom: 16px;
        }
        .ins-ai-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%;
          padding: 12px;
          border-radius: 14px;
          background: rgba(43,143,216,0.25);
          border: 1px solid rgba(43,143,216,0.4);
          color: #5BB8FF;
          font-size: 14px; font-weight: 600;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: background 0.2s;
        }
        .ins-ai-btn:active { background: rgba(43,143,216,0.4); }
        .ins-ai-btn:disabled { opacity: 0.5; }
        .ins-ai-spin {
          animation: insSpin 1s linear infinite;
        }
        @keyframes insSpin { to { transform: rotate(360deg); } }

        /* ── Section label ── */
        .ins-section-label {
          font-size: 11px; font-weight: 700; letter-spacing: 0.8px;
          text-transform: uppercase;
          color: var(--muted, #9A6070);
          margin: 0 4px 12px;
        }

        /* ── Insight cards ── */
        .ins-card {
          border-radius: 22px;
          padding: 16px;
          margin-bottom: 10px;
          border: 1px solid rgba(200,51,74,0.09);
          background: rgba(255,255,255,0.96);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.9);
          display: flex; gap: 12px; align-items: flex-start;
          animation: insCardIn 0.3s ease both;
        }
        @keyframes insCardIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .insights-dark .ins-card {
          background: rgba(18,5,10,0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-color: rgba(200,51,74,0.14);
          box-shadow: 0 8px 28px rgba(0,0,0,0.45);
        }
        .ins-card-icon {
          width: 38px; height: 38px; border-radius: 11px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .ins-card-body { flex: 1; min-width: 0; }
        .ins-card-title {
          font-size: 14px; font-weight: 700;
          color: var(--ink, #1E0A10);
          margin-bottom: 4px;
        }
        .insights-dark .ins-card-title { color: #F5E6EB; }
        .ins-card-text {
          font-size: 13px; line-height: 1.55;
          color: var(--text-muted, #6B3A48);
        }
        .insights-dark .ins-card-text { color: #C4909A; }

        /* ── Daily tip ── */
        .ins-tip {
          border-radius: 18px;
          padding: 16px;
          background: var(--blush, #FBF0F2);
          border: 1px solid var(--border, rgba(200,51,74,0.1));
          display: flex; gap: 12px; align-items: flex-start;
        }
        .insights-dark .ins-tip {
          background: #2A0D16;
          border-color: rgba(200,51,74,0.18);
        }
        .ins-tip-icon {
          width: 38px; height: 38px; border-radius: 11px;
          background: rgba(200,51,74,0.1);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          color: var(--rose, #C8334A);
        }
        .ins-tip-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.6px;
          text-transform: uppercase;
          color: var(--rose, #C8334A); margin-bottom: 3px;
        }
        .ins-tip-title {
          font-size: 14px; font-weight: 700;
          color: var(--ink, #1E0A10);
          margin-bottom: 4px;
        }
        .insights-dark .ins-tip-title { color: #F5E6EB; }
        .ins-tip-text {
          font-size: 13px; line-height: 1.55;
          color: var(--text-muted, #6B3A48);
        }
        .insights-dark .ins-tip-text { color: #C4909A; }

        /* ── Loading skeleton ── */
        .ins-skeleton {
          border-radius: 18px;
          height: 90px;
          background: linear-gradient(90deg,
            var(--blush, #FBF0F2) 25%,
            rgba(200,51,74,0.06) 50%,
            var(--blush, #FBF0F2) 75%);
          background-size: 200% 100%;
          animation: insSkeleton 1.4s ease-in-out infinite;
          margin-bottom: 10px;
        }
        @keyframes insSkeleton {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* ── ИИ-блок ── */}
      <div className="ins-ai-block">
        <div className="ins-ai-header">
          <div className="ins-ai-icon">
            <SparkleIcon size={22} color="#5BB8FF" />
          </div>
          <div>
            <div className="ins-ai-label">Персональный совет</div>
            <div className="ins-ai-title">Советник ИИ</div>
          </div>
        </div>
        <p className="ins-ai-text">
          {aiText || tip.text}
        </p>
        <button className="ins-ai-btn" onClick={generateAIAdvice} disabled={generating}>
          <span className={generating ? 'ins-ai-spin' : ''}>
            <RefreshIcon size={16} color="#5BB8FF" />
          </span>
          {generating ? 'Анализирую...' : 'Получить новый совет'}
        </button>
      </div>

      {/* ── Аналитика по данным ── */}
      <div className="ins-section-label">Анализ по вашим данным</div>

      {loadingData ? (
        <>
          <div className="ins-skeleton" />
          <div className="ins-skeleton" style={{ height: 70, opacity: 0.6 }} />
        </>
      ) : dataInsights.length === 0 ? (
        <div className="ins-card" style={{ justifyContent: 'center' }}>
          <div className="ins-card-body" style={{ textAlign: 'center' }}>
            <div className="ins-card-title">Всё хорошо</div>
            <div className="ins-card-text">Нет срочных рекомендаций. Продолжайте общаться!</div>
          </div>
        </div>
      ) : (
        dataInsights.map((ins, i) => {
          const meta = TYPE_META[ins.type] || TYPE_META.ai
          const { Icon } = meta
          return (
            <div key={ins.id} className="ins-card" style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="ins-card-icon" style={{ background: meta.bg }}>
                <Icon size={18} color={meta.color} />
              </div>
              <div className="ins-card-body">
                <div className="ins-card-title">{ins.title}</div>
                <div className="ins-card-text">{ins.text}</div>
              </div>
            </div>
          )
        })
      )}

      {/* ── Совет дня ── */}
      <div style={{ marginTop: 20, marginBottom: 8 }} className="ins-section-label">Совет дня</div>
      <div className="ins-tip">
        <div className="ins-tip-icon">
          <HeartIcon size={18} color="var(--rose, #C8334A)" />
        </div>
        <div>
          <div className="ins-tip-label">Для вас</div>
          <div className="ins-tip-title">{tip.title}</div>
          <div className="ins-tip-text">{tip.text}</div>
        </div>
      </div>
    </div>
  )
}
