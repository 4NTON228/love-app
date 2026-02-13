import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Pencil, LogOut, Timer, Save, Check } from 'lucide-react'

const QUOTES = [
  'Любовь — это когда хочешь просыпаться рядом каждый день',
  'Ты — моя любимая привычка',
  'С тобой даже молчание — это разговор',
  'Ты делаешь мою жизнь красивой',
  'Рядом с тобой я дома',
  'Ты мой любимый повод для улыбки',
  'Каждый день с тобой — это подарок',
  'Я люблю тебя не за то, кто ты, а за то, кто я, когда рядом с тобой',
  'Ты — лучшее, что случилось в моей жизни',
  'Моё сердце выбирает тебя каждый день',
  'С тобой каждый момент становится особенным',
  'Ты — моя тихая радость и громкое счастье',
  'Люблю тебя сильнее, чем вчера, но меньше, чем завтра',
  'Ты мой любимый человек на этой планете',
  'С тобой я хочу делить каждый рассвет',
  'Ты — причина, по которой я верю в любовь',
  'Мне не нужен весь мир. Мне нужен ты',
  'Ты заставляешь моё сердце петь',
  'С тобой я чувствую себя самым счастливым человеком',
  'Ты — моя судьба и мой выбор одновременно',
  'Быть с тобой — это лучшее приключение',
  'Ты делаешь обычные дни волшебными',
  'Я хочу быть рядом с тобой всегда',
  'Каждое твоё прикосновение — маленькое чудо',
  'Ты — ответ на все мои мечты',
  'С тобой я нашёл/нашла дом для своего сердца',
  'Ты — мой лучший друг и моя большая любовь',
  'Рядом с тобой весь мир становится ярче',
  'Спасибо, что ты есть у меня',
  'Ты — самое прекрасное совпадение в моей жизни'
]

function getDailyQuote() {
  const today = new Date()
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24))
  return QUOTES[dayOfYear % QUOTES.length]
}

function getDaysCount(startDate) {
  if (!startDate) return 0
  const start = new Date(startDate)
  const now = new Date()
  const diff = now - start
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function getTimeUntil(targetDate) {
  if (!targetDate) return null
  const now = new Date()
  const target = new Date(targetDate)
  const diff = target - now
  if (diff <= 0) return null
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000)
  }
}

// Конвертируем локальное datetime-local в UTC ISO строку
function localToUTC(localDatetime) {
  if (!localDatetime) return null
  const d = new Date(localDatetime)
  return d.toISOString()
}

// Конвертируем UTC из базы в локальное значение для input
function utcToLocalInput(utcString) {
  if (!utcString) return ''
  const d = new Date(utcString)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

export default function Home({ session, profile }) {
  const [settings, setSettings] = useState(null)
  const [editingMessage, setEditingMessage] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [editingTimer, setEditingTimer] = useState(false)
  const [newMeetingDate, setNewMeetingDate] = useState('')
  const [countdown, setCountdown] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedNotice, setSavedNotice] = useState(null) // 'timer' | 'message' | null

  // Показываем уведомление "Сохранено" на 2 секунды
  function showSaved(type) {
    setSavedNotice(type)
    setTimeout(() => setSavedNotice(null), 2000)
  }

  // ==========================================
  // ЗАГРУЗКА НАСТРОЕК — берём данные обоих партнёров
  // и используем самую свежую дату встречи
  // ==========================================
  const loadSettings = useCallback(async () => {
    if (!session?.user?.id) return

    // Загружаем настройки обоих партнёров одним запросом
    const userIds = [session.user.id]
    if (profile?.partner_id) userIds.push(profile.partner_id)

    const { data: allSettings } = await supabase
      .from('couple_settings')
      .select('*')
      .in('user_id', userIds)

    if (!allSettings || allSettings.length === 0) {
      setSettings(null)
      return
    }

    // Находим свои настройки (для love_message)
    const mySettings = allSettings.find(s => s.user_id === session.user.id)
    const partnerSettings = allSettings.find(s => s.user_id === profile?.partner_id)

    // Для таймера — берём самую свежую дату среди обоих
    // (тот кто последний обновил — та дата и актуальна)
    let latestMeeting = null
    let latestUpdated = null

    for (const s of allSettings) {
      if (s.next_meeting) {
        const updatedAt = new Date(s.updated_at || s.created_at || 0)
        if (!latestUpdated || updatedAt > latestUpdated) {
          latestMeeting = s.next_meeting
          latestUpdated = updatedAt
        }
      }
    }

    // Собираем итоговые настройки
    const merged = {
      id: mySettings?.id || null,
      user_id: session.user.id,
      love_message: mySettings?.love_message || partnerSettings?.love_message || '',
      next_meeting: latestMeeting,
      updated_at: latestUpdated?.toISOString() || null
    }

    setSettings(merged)
    setNewMessage(merged.love_message)
    setNewMeetingDate(utcToLocalInput(merged.next_meeting))
  }, [session?.user?.id, profile?.partner_id])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // ==========================================
  // ТАЙМЕР — обновляется каждую секунду
  // ==========================================
  useEffect(() => {
    if (!settings?.next_meeting) {
      setCountdown(null)
      return
    }
    const tick = () => setCountdown(getTimeUntil(settings.next_meeting))
    tick() // сразу показываем
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [settings?.next_meeting])

  // ==========================================
  // СОХРАНЕНИЕ ЛЮБОВНОГО СООБЩЕНИЯ
  // ==========================================
  async function saveLoveMessage() {
    setSaving(true)

    const { data: existing } = await supabase
      .from('couple_settings')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('couple_settings')
        .update({ love_message: newMessage, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('couple_settings')
        .insert({ user_id: session.user.id, love_message: newMessage })
    }

    setSettings(prev => ({ ...prev, love_message: newMessage }))
    setEditingMessage(false)
    setSaving(false)
    showSaved('message')
  }

  // ==========================================
  // СОХРАНЕНИЕ ТАЙМЕРА — обновляем У ОБОИХ!
  // ==========================================
  async function saveNextMeeting() {
    setSaving(true)

    // Конвертируем локальное время в UTC для хранения
    const utcDate = localToUTC(newMeetingDate)
    const now = new Date().toISOString()

    // 1. Обновляем/создаём СВОЮ запись
    const { data: myExisting } = await supabase
      .from('couple_settings')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (myExisting) {
      await supabase
        .from('couple_settings')
        .update({ next_meeting: utcDate, updated_at: now })
        .eq('id', myExisting.id)
    } else {
      await supabase
        .from('couple_settings')
        .insert({ user_id: session.user.id, next_meeting: utcDate })
    }

    // 2. Обновляем запись ПАРТНЁРА (чтобы синхронизировать)
    if (profile?.partner_id) {
      const { data: partnerExisting } = await supabase
        .from('couple_settings')
        .select('id')
        .eq('user_id', profile.partner_id)
        .maybeSingle()

      if (partnerExisting) {
        await supabase
          .from('couple_settings')
          .update({ next_meeting: utcDate, updated_at: now })
          .eq('id', partnerExisting.id)
      } else {
        await supabase
          .from('couple_settings')
          .insert({ user_id: profile.partner_id, next_meeting: utcDate })
      }
    }

    // 3. Обновляем локальное состояние сразу
    setSettings(prev => ({ ...prev, next_meeting: utcDate, updated_at: now }))
    setEditingTimer(false)
    setSaving(false)
    showSaved('timer')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const daysCount = getDaysCount(profile?.couple_start_date)
  const todayFormatted = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })

  return (
    <div>
      <div className="home-header">
        <h1 className="home-greeting">
          Когда ты рядом, мир становится ярче 🌙
        </h1>
        <p className="home-date">{todayFormatted}</p>
      </div>

      {/* Любовное сообщение */}
      <div className="love-message-card">
        {/* Уведомление "Сохранено" */}
        {savedNotice === 'message' && (
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(255,255,255,0.3)', borderRadius: '20px',
            padding: '4px 14px', fontSize: '13px', color: 'white',
            display: 'flex', alignItems: 'center', gap: '4px', zIndex: 3,
            animation: 'fadeIn 0.3s ease'
          }}>
            <Check size={14} /> Сохранено!
          </div>
        )}

        {editingMessage ? (
          <div style={{ position: 'relative', zIndex: 1 }}>
            <textarea
              className="form-textarea"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '2px solid rgba(255,255,255,0.4)',
                minHeight: '100px',
                fontSize: '18px',
                textAlign: 'center'
              }}
              placeholder="Напиши что-то красивое..."
              autoFocus
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'center' }}>
              <button
                className="form-submit"
                onClick={saveLoveMessage}
                disabled={saving}
                style={{ width: 'auto', padding: '10px 24px', fontSize: '14px' }}
              >
                {saving ? '💕 Сохраняем...' : (
                  <><Save size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />Сохранить</>
                )}
              </button>
              <button
                onClick={() => setEditingMessage(false)}
                style={{
                  padding: '10px 24px',
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              className="love-message-edit-btn"
              onClick={() => setEditingMessage(true)}
            >
              <Pencil size={16} />
            </button>
            <p className="love-message-text">
              {settings?.love_message || 'Ты — лучшее, что случилось в моей жизни ❤️'}
            </p>
          </>
        )}
      </div>

      {/* Статистика */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-emoji">💑</div>
          <div className="stat-value">{daysCount}</div>
          <div className="stat-label">
            {daysCount === 1 ? 'день' : daysCount < 5 ? 'дня' : 'дней'} вместе
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-emoji">💝</div>
          <div className="stat-value">{Math.floor(daysCount / 7)}</div>
          <div className="stat-label">
            {Math.floor(daysCount / 7) === 1 ? 'неделя' : 'недель'} любви
          </div>
        </div>
      </div>

      {/* Таймер до встречи */}
      <div className="timer-card">
        <div className="timer-title">⏰ До следующей встречи</div>

        {/* Уведомление "Сохранено" */}
        {savedNotice === 'timer' && (
          <div style={{
            background: 'rgba(232, 70, 106, 0.1)', borderRadius: '20px',
            padding: '6px 16px', fontSize: '13px', color: 'var(--primary)',
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            marginBottom: '10px', animation: 'fadeIn 0.3s ease'
          }}>
            <Check size={14} /> Сохранено для обоих!
          </div>
        )}

        {editingTimer ? (
          <div>
            <input
              className="form-input"
              type="datetime-local"
              value={newMeetingDate}
              onChange={(e) => setNewMeetingDate(e.target.value)}
              style={{ textAlign: 'center', marginBottom: '12px' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                className="form-submit"
                onClick={saveNextMeeting}
                disabled={saving}
                style={{ width: 'auto', padding: '10px 20px', fontSize: '14px' }}
              >
                {saving ? '💕 Сохраняем...' : 'Сохранить'}
              </button>
              <button
                className="timer-set-btn"
                onClick={() => setEditingTimer(false)}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : countdown ? (
          <>
            <div className="timer-values">
              <div className="timer-unit">
                <div className="timer-number">{countdown.days}</div>
                <div className="timer-label">дн</div>
              </div>
              <div className="timer-unit">
                <div className="timer-number">{countdown.hours}</div>
                <div className="timer-label">ч</div>
              </div>
              <div className="timer-unit">
                <div className="timer-number">{String(countdown.minutes).padStart(2, '0')}</div>
                <div className="timer-label">мин</div>
              </div>
              <div className="timer-unit">
                <div className="timer-number">{String(countdown.seconds).padStart(2, '0')}</div>
                <div className="timer-label">сек</div>
              </div>
            </div>
            <button className="timer-set-btn" onClick={() => setEditingTimer(true)}>
              Изменить
            </button>
          </>
        ) : settings?.next_meeting ? (
          <div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '12px', fontSize: '14px' }}>
              Время встречи прошло 💕
            </p>
            <button className="timer-set-btn" onClick={() => setEditingTimer(true)}>
              Установить новую
            </button>
          </div>
        ) : (
          <div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '12px', fontSize: '14px' }}>
              Когда ваша следующая встреча?
            </p>
            <button className="timer-set-btn" onClick={() => setEditingTimer(true)}>
              <Timer size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Установить
            </button>
          </div>
        )}
      </div>

      {/* Ежедневная фраза */}
      <div className="quote-card">
        <div className="quote-emoji">🌸</div>
        <p className="quote-text">«{getDailyQuote()}»</p>
      </div>

      <button className="logout-btn" onClick={handleLogout}>
        <LogOut size={18} />
        Выйти
      </button>
    </div>
  )
}
