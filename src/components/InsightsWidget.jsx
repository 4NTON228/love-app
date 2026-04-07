// ══════════════════════════════════════════════════════════════
// InsightsWidget — Ненавязчивый ИИ-советчик
//
// Правила ненавязчивости:
//   • Не чаще 1 совета в день
//   • Сначала виджет, не пуш
//   • «Не сейчас»: после 3 игноров тип советов замолкает на 7 дней
//   • Ползунок проактивности 0–100% в настройках
//   • Один тихий день в неделю без советов
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ── SVG-иконки ─────────────────────────────────────────────

function BrainIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 017 4.5v0A2.5 2.5 0 014.5 7v0A2.5 2.5 0 012 9.5v5A2.5 2.5 0 004.5 17v0A2.5 2.5 0 007 19.5v0A2.5 2.5 0 009.5 22h5a2.5 2.5 0 002.5-2.5v0a2.5 2.5 0 002.5-2.5v0a2.5 2.5 0 002.5-2.5v-5A2.5 2.5 0 0019.5 7v0A2.5 2.5 0 0017 4.5v0A2.5 2.5 0 0014.5 2z"/>
      <path d="M9.5 7v0a2 2 0 012-2v0M12 5v14M9.5 17v0a2 2 0 012 2v0"/>
    </svg>
  )
}

function BubbleIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
}

function CapsuleSmIcon({ size = 18, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function MirrorSmIcon({ size = 18, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="10" rx="7" ry="9" />
      <path d="M9 21h6" />
      <path d="M12 19v2" />
    </svg>
  )
}

function CloseIcon({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ── Типы инсайтов ─────────────────────────────────────────
const INSIGHT_TYPES = {
  dialog:  { label: 'Диалог',       icon: BubbleIcon,   muteField: 'dialog_muted_until',  ignoreField: 'dialog_ignored' },
  mirror:  { label: 'Зеркало',      icon: MirrorSmIcon, muteField: 'mirror_muted_until',  ignoreField: 'mirror_ignored' },
  capsule: { label: 'Капсула',      icon: CapsuleSmIcon, muteField: 'capsule_muted_until', ignoreField: 'capsule_ignored' },
  warmth:  { label: 'Барометр',     icon: BrainIcon,    muteField: 'dialog_muted_until',  ignoreField: 'dialog_ignored' },
}

// ── Проверка: тихий день ──────────────────────────────────
function isQuietDay(quietDay) {
  if (quietDay === -1) return false
  return new Date().getDay() === quietDay
}

// ── Основной компонент ────────────────────────────────────
export default function InsightsWidget({
  session, profile, onOpenMirror, onOpenCapsule, onNavigateChat,
}) {
  const userId    = session?.user?.id
  const partnerId = profile?.partner_id

  const [insight,   setInsight]   = useState(null)   // текущий показываемый инсайт
  const [settings,  setSettings]  = useState(null)
  const [dismissed, setDismissed] = useState(false)   // скрыт до следующего монтирования
  const [animOut,   setAnimOut]   = useState(false)   // анимация ухода
  const timerRef = useRef(null)

  // ── Загрузка настроек и генерация инсайта ────────────────
  const loadInsight = useCallback(async () => {
    if (!userId) return

    // Получаем настройки ИИ
    let { data: s } = await supabase
      .from('ai_advisor_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    // Инициализируем настройки, если их нет
    if (!s) {
      const { data: created } = await supabase
        .from('ai_advisor_settings')
        .insert({ user_id: userId })
        .select()
        .single()
      s = created
    }

    setSettings(s)
    if (!s) return

    // Проверки ненавязчивости
    const now = new Date()

    // Тихий день
    if (isQuietDay(s.quiet_day)) return

    // Проактивность: если 0% — никогда не показываем
    if (s.proactivity === 0) return

    // Не чаще 1 совета в день
    if (s.last_advice_at) {
      const lastDate = new Date(s.last_advice_at).toDateString()
      if (lastDate === now.toDateString()) return
    }

    // Рандомизация по уровню проактивности (выше % → более частые советы)
    if (Math.random() * 100 > s.proactivity) return

    // ── Проверяем каждый тип инсайта ─────────────────────

    // 1. Диалог без ответа 12+ часов
    if (!isMuted(s, 'dialog_muted_until')) {
      const cutoff = new Date(now.getTime() - 12 * 3600000).toISOString()
      const { data: questions } = await supabase
        .from('messages')
        .select('id, text, created_at')
        .eq('user_id', userId)
        .like('text', '%?%')
        .lte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(1)

      if (questions?.[0]) {
        const q = questions[0]
        // Нет ответа партнёра после вопроса?
        const { data: reply } = await supabase
          .from('messages')
          .select('id')
          .eq('user_id', partnerId)
          .gt('created_at', q.created_at)
          .limit(1)
          .maybeSingle()

        if (!reply) {
          const topic = (q.text ?? '').slice(0, 55).replace(/\n/g, ' ').trim()
          setInsight({
            type: 'dialog',
            title: 'Незавершённый разговор',
            text: `Вы обсуждали «${topic}...» — диалог оборвался. Напомнить партнёру?`,
            actions: ['remind', 'later', 'never'],
            messageId: q.id,
          })
          return
        }
      }
    }

    // 2. Зеркало: вопрос дня ещё не отвечен
    if (!isMuted(s, 'mirror_muted_until') && partnerId) {
      const today = new Date().toISOString().slice(0, 10)
      const { data: mirror } = await supabase
        .from('sync_mirror')
        .select('*')
        .or(`user_id.eq.${userId},partner_id.eq.${userId}`)
        .gte('created_at', `${today}T00:00:00Z`)
        .lt('created_at', `${today}T23:59:59Z`)
        .limit(1)
        .maybeSingle()

      const isOwner = mirror?.user_id === userId
      const myAns   = mirror ? (isOwner ? mirror.answer : mirror.partner_answer) : null

      if (mirror && !myAns) {
        setInsight({
          type: 'mirror',
          title: 'Вопрос дня ждёт',
          text: `«${mirror.question.slice(0, 70)}...» — твой ответ ещё не записан.`,
          actions: ['open_mirror', 'later'],
        })
        return
      }
    }

    // 3. Барометр в «красной зоне» — нет инсайта о барометре
    const today2 = new Date().toISOString().slice(0, 10)
    const { data: metric } = await supabase
      .from('warmth_metrics')
      .select('warmth_index, avg_length, emoji_density, avg_response_time')
      .eq('user_id', userId)
      .eq('date', today2)
      .maybeSingle()

    if (metric && metric.warmth_index < 0.35 && !isMuted(s, 'dialog_muted_until')) {
      setInsight({
        type: 'warmth',
        title: 'Барометр в зоне внимания',
        text: buildWarmthHint(metric),
        actions: ['open_chat', 'later'],
      })
      return
    }

    // Нет инсайтов — ничего не показываем
  }, [userId, partnerId])

  useEffect(() => { loadInsight() }, [loadInsight])

  // Автоскрытие через 12 секунд (ненавязчивость)
  useEffect(() => {
    if (!insight) return
    timerRef.current = setTimeout(() => hide('auto'), 12000)
    return () => clearTimeout(timerRef.current)
  }, [insight])

  // ── Проверка: заглушён ли тип ─────────────────────────
  function isMuted(s, muteField) {
    if (!s?.[muteField]) return false
    return new Date(s[muteField]) > new Date()
  }

  // ── Скрыть виджет ────────────────────────────────────
  function hide(reason) {
    clearTimeout(timerRef.current)
    setAnimOut(true)
    setTimeout(() => {
      setInsight(null)
      setDismissed(true)
      setAnimOut(false)
    }, 250)

    if (reason === 'auto' || reason === 'later') {
      // Обновляем метку последнего совета
      if (userId) {
        supabase.from('ai_advisor_settings')
          .upsert(
            { user_id: userId, last_advice_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { onConflict: 'user_id' },
          )
          .then(() => {})
      }
    }
  }

  // ── «Не сейчас» — с подсчётом игнорирований ──────────
  async function handleLater() {
    if (!userId || !insight) { hide('later'); return }
    const type = INSIGHT_TYPES[insight.type]
    if (!type || !settings) { hide('later'); return }

    const newCount = (settings[type.ignoreField] ?? 0) + 1
    const update = {
      [type.ignoreField]: newCount,
      last_advice_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // После 3 игноров — заглушить на 7 дней
    if (newCount >= 3) {
      const muteUntil = new Date(Date.now() + 7 * 86400000).toISOString()
      update[type.muteField]   = muteUntil
      update[type.ignoreField] = 0
    }

    await supabase.from('ai_advisor_settings').upsert(
      { user_id: userId, ...update },
      { onConflict: 'user_id' },
    )

    hide('later')
  }

  // ── «Больше не показывать» (тип) ─────────────────────
  async function handleNever() {
    if (!userId || !insight) { hide('never'); return }
    const type = INSIGHT_TYPES[insight.type]
    if (!type) { hide('never'); return }

    // Заглушить навсегда (на год)
    const muteUntil = new Date(Date.now() + 365 * 86400000).toISOString()
    await supabase.from('ai_advisor_settings').upsert(
      {
        user_id: userId,
        [type.muteField]: muteUntil,
        [type.ignoreField]: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    hide('never')
  }

  // ── «Напомнить» партнёру (для диалогов) ──────────────
  async function handleRemind() {
    if (!userId || !partnerId || !insight?.messageId) {
      hide('auto'); return
    }
    // Отправляем мягкое напоминание в чат
    const { data: origMsg } = await supabase
      .from('messages')
      .select('text')
      .eq('id', insight.messageId)
      .maybeSingle()

    if (origMsg) {
      await supabase.from('messages').insert({
        user_id: userId,
        text: `Кстати, я ещё жду твоего ответа — «${(origMsg.text ?? '').slice(0, 60).trim()}»`,
        created_at: new Date().toISOString(),
      })
      if (onNavigateChat) onNavigateChat('chat')
    }

    await supabase.from('ai_advisor_settings').upsert(
      { user_id: userId, last_advice_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    hide('remind')
  }

  // ── Подсказка барометра ───────────────────────────────
  function buildWarmthHint(m) {
    const parts = []
    if (m.avg_length < 15) parts.push('ответы стали короче')
    if (m.emoji_density < 0.1) parts.push('исчезли эмодзи')
    if (m.avg_response_time > 3600) parts.push('долгое молчание между сообщениями')
    if (parts.length === 0) return 'Качество общения снизилось. Напиши партнёру что-нибудь тёплое?'
    return `Заметно: ${parts.join(', ')}. Написать партнёру?`
  }

  if (!insight || dismissed) return null

  const TypeIcon = INSIGHT_TYPES[insight.type]?.icon ?? BrainIcon

  return (
    <>
      <style>{`
        .iw-card {
          background: var(--surface);
          border-radius: var(--radius-lg, 20px);
          border: 0.5px solid var(--border);
          box-shadow: var(--shadow-md);
          overflow: hidden; position: relative;
          animation: ${animOut ? 'iwOut' : 'iwIn'} 0.25s ease both;
        }
        @keyframes iwIn {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes iwOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-8px) scale(0.97); }
        }
        .app.dark .iw-card { background: var(--surface-2); }
        /* Декоративная полоска сверху */
        .iw-stripe {
          height: 3px;
          background: var(--gradient);
        }
        .iw-body { padding: 14px 16px 16px; }
        .iw-top {
          display: flex; align-items: flex-start;
          justify-content: space-between; gap: 8px; margin-bottom: 10px;
        }
        .iw-title-row {
          display: flex; align-items: center; gap: 8px;
        }
        .iw-icon {
          width: 32px; height: 32px; border-radius: 10px;
          background: rgba(200,51,74,0.08);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; color: var(--rose);
        }
        .iw-title {
          font-size: 14px; font-weight: 700; color: var(--ink);
        }
        .iw-close {
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--blush); border: none;
          display: flex; align-items: center; justify-content: center;
          color: var(--text-muted); cursor: pointer; flex-shrink: 0;
        }
        .app.dark .iw-close { background: #3D1520; }
        .iw-text {
          font-size: 13px; color: var(--text-muted); line-height: 1.5;
          margin-bottom: 14px;
        }
        .iw-actions {
          display: flex; flex-wrap: wrap; gap: 7px;
        }
        .iw-btn {
          flex: 1; min-width: 80px;
          padding: 9px 12px; border-radius: 12px; border: none;
          font-family: var(--font-body); font-size: 13px; font-weight: 600;
          cursor: pointer; transition: opacity 0.15s, transform 0.1s;
          white-space: nowrap;
        }
        .iw-btn:active { transform: scale(0.96); opacity: 0.88; }
        .iw-btn-primary {
          background: var(--gradient); color: white;
          box-shadow: 0 3px 12px rgba(139,26,44,0.25);
        }
        .iw-btn-ghost {
          background: var(--blush);
          color: var(--text-muted);
        }
        .app.dark .iw-btn-ghost { background: #3D1520; }
        .iw-btn-text {
          background: transparent;
          color: var(--text-muted); font-size: 12px; font-weight: 500;
          flex: none; padding: 9px 8px;
        }
        /* Ползунок проактивности — если открыты настройки */
        .iw-settings-row {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 16px 14px;
          border-top: 1px solid var(--border);
        }
        .iw-settings-label {
          font-size: 11px; color: var(--text-muted);
          white-space: nowrap;
        }
        .iw-slider {
          flex: 1; accent-color: var(--rose);
          height: 3px; cursor: pointer;
        }
      `}</style>

      <div className="iw-card">
        <div className="iw-stripe" />
        <div className="iw-body">
          <div className="iw-top">
            <div className="iw-title-row">
              <div className="iw-icon">
                <TypeIcon size={16} color="var(--rose)" />
              </div>
              <span className="iw-title">{insight.title}</span>
            </div>
            <button className="iw-close" onClick={() => hide('auto')} aria-label="Закрыть">
              <CloseIcon size={12} />
            </button>
          </div>

          <p className="iw-text">{insight.text}</p>

          <div className="iw-actions">
            {/* Кнопка «Напомнить» — для диалогов */}
            {insight.actions.includes('remind') && (
              <button className="iw-btn iw-btn-primary" onClick={handleRemind}>
                Напомнить
              </button>
            )}

            {/* Кнопка «Открыть зеркало» */}
            {insight.actions.includes('open_mirror') && (
              <button
                className="iw-btn iw-btn-primary"
                onClick={() => { hide('auto'); onOpenMirror?.() }}
              >
                Ответить
              </button>
            )}

            {/* Кнопка «Написать в чат» */}
            {insight.actions.includes('open_chat') && (
              <button
                className="iw-btn iw-btn-primary"
                onClick={() => { hide('auto'); onNavigateChat?.('chat') }}
              >
                Написать
              </button>
            )}

            {/* «Не сейчас» */}
            {insight.actions.includes('later') && (
              <button className="iw-btn iw-btn-ghost" onClick={handleLater}>
                Не сейчас
              </button>
            )}

            {/* «Больше не показывать» */}
            {insight.actions.includes('never') && (
              <button className="iw-btn iw-btn-text" onClick={handleNever}>
                Не показывать
              </button>
            )}
          </div>
        </div>

        {/* Ползунок проактивности (компактный, прямо в виджете) */}
        {settings && (
          <div className="iw-settings-row">
            <span className="iw-settings-label">Проактивность</span>
            <input
              type="range"
              className="iw-slider"
              min={0}
              max={100}
              step={10}
              value={settings.proactivity ?? 70}
              onChange={async e => {
                const v = +e.target.value
                setSettings(s => ({ ...s, proactivity: v }))
                await supabase.from('ai_advisor_settings').upsert(
                  { user_id: userId, proactivity: v, updated_at: new Date().toISOString() },
                  { onConflict: 'user_id' },
                )
              }}
            />
            <span className="iw-settings-label" style={{ minWidth: 28, textAlign: 'right' }}>
              {settings.proactivity ?? 70}%
            </span>
          </div>
        )}
      </div>
    </>
  )
}
