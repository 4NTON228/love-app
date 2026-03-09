import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const MONTHS_RU = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']
const MONTHS_FULL = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
const EMOJIS = ['❤️','🥰','🎉','🎂','🎬','🍕','✈️','🌅','🎵','💐','🏖️','🎄','🌸','🎭','🌙','⭐']

function getDaysUntil(dateStr) {
  const target = new Date(dateStr)
  const now = new Date()
  now.setHours(0,0,0,0)
  target.setHours(0,0,0,0)
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24))
  return diff
}

function formatEventDate(dateStr) {
  const d = new Date(dateStr)
  return {
    day: d.getDate(),
    month: MONTHS_RU[d.getMonth()],
    monthFull: MONTHS_FULL[d.getMonth()],
    year: d.getFullYear(),
  }
}

export default function Calendar({ session, profile }) {
  const [events, setEvents] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lightbox, setLightbox] = useState(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [emoji, setEmoji] = useState('❤️')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  useEffect(() => { loadEvents() }, [])

  async function loadEvents() {
    const { data } = await supabase.from('calendar_events').select('*').order('event_date', { ascending: false })
    setEvents(data || [])
    setLoading(false)
  }

  async function uploadPhoto(file) {
    const ext = file.name.split('.').pop()
    const path = `calendar/${Date.now()}-${Math.random().toString(36).slice(7)}.${ext}`
    const { error } = await supabase.storage.from('photos').upload(path, file)
    if (error) throw error
    return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
  }

  function handlePhotoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title || !eventDate) return
    setSaving(true)
    try {
      let photoUrl = null
      if (photo) photoUrl = await uploadPhoto(photo)
      const { error } = await supabase.from('calendar_events').insert({
        user_id: session.user.id, title, description, event_date: eventDate, emoji, photo_url: photoUrl
      })
      if (!error) { resetForm(); setShowModal(false); loadEvents() }
    } catch (err) { console.error(err) }
    setSaving(false)
  }

  async function deleteEvent(id) {
    if (!confirm('Удалить это событие?')) return
    await supabase.from('calendar_events').delete().eq('id', id)
    loadEvents()
  }

  function resetForm() {
    setTitle(''); setDescription(''); setEventDate(''); setEmoji('❤️'); setPhoto(null); setPhotoPreview(null)
  }

  const today = new Date()
  today.setHours(0,0,0,0)
  const upcoming = events.filter(e => new Date(e.event_date) >= today).sort((a,b) => new Date(a.event_date) - new Date(b.event_date))
  const past = events.filter(e => new Date(e.event_date) < today).sort((a,b) => new Date(b.event_date) - new Date(a.event_date))

  return (
    <>
      <style>{`
        .cal-wrap { padding: 0 0 120px; }
        .cal-header {
          background: linear-gradient(160deg, #e8466a 0%, #c84b8b 50%, #9b4dca 100%);
          padding: 60px 20px 24px;
          border-radius: 0 0 32px 32px;
          margin-bottom: 18px;
          box-shadow: 0 8px 32px rgba(200,75,139,0.3);
        }
        .cal-header-title {
          font-family: var(--font-display);
          font-size: 26px;
          color: white;
          margin-bottom: 4px;
        }
        .cal-header-sub {
          font-size: 13px;
          color: rgba(255,255,255,0.65);
          font-family: var(--font-body);
        }
        .cal-add-btn {
          margin-top: 16px;
          background: rgba(255,255,255,0.2);
          backdrop-filter: blur(8px);
          border: 1.5px solid rgba(255,255,255,0.3);
          border-radius: 14px;
          color: white;
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 14px;
          padding: 12px 24px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .cal-section-label {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: var(--text-muted);
          padding: 0 16px;
          margin: 10px 0 6px;
        }

        .cal-event-card {
          margin: 0 14px 12px;
          background: var(--bg-card);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: var(--shadow);
          animation: calIn 0.4s ease both;
          display: flex;
          flex-direction: column;
        }
        @keyframes calIn {
          from { opacity:0; transform: translateY(16px); }
          to   { opacity:1; transform: translateY(0); }
        }
        .cal-event-photo-wrap {
          position: relative;
          cursor: pointer;
        }
        .cal-event-photo {
          width: 100%;
          height: 160px;
          object-fit: cover;
          display: block;
        }
        .cal-event-badge {
          position: absolute;
          top: 10px;
          right: 10px;
          background: linear-gradient(135deg, #e8466a, #c84b8b);
          color: white;
          border-radius: 12px;
          padding: 5px 10px;
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 700;
          box-shadow: 0 2px 10px rgba(0,0,0,0.25);
        }
        .cal-event-badge.past {
          background: rgba(0,0,0,0.45);
        }
        .cal-event-body {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 14px 16px;
        }
        .cal-date-pill {
          flex-shrink: 0;
          width: 50px;
          background: linear-gradient(135deg, #ffeef4, #ffe0ea);
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px 4px;
        }
        .app.dark .cal-date-pill { background: rgba(200,75,139,0.15); }
        .cal-date-day {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 700;
          color: #c84b8b;
          line-height: 1;
        }
        .cal-date-month {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 700;
          color: #c84b8b;
          text-transform: uppercase;
          opacity: 0.75;
        }
        .cal-event-info { flex: 1; min-width: 0; }
        .cal-event-title {
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 15px;
          color: var(--text);
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .cal-event-desc {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.5;
          margin-bottom: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .cal-event-countdown {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgba(232,70,106,0.08);
          color: var(--primary);
          border-radius: 8px;
          padding: 3px 8px;
          font-size: 12px;
          font-weight: 600;
          font-family: var(--font-body);
        }
        .cal-event-countdown.today {
          background: linear-gradient(135deg, #e8466a, #c84b8b);
          color: white;
        }
        .cal-event-countdown.past-label {
          background: rgba(0,0,0,0.05);
          color: var(--text-muted);
        }
        .app.dark .cal-event-countdown.past-label { background: rgba(255,255,255,0.06); }
        .cal-del-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 18px;
          cursor: pointer;
          padding: 4px;
          border-radius: 8px;
          flex-shrink: 0;
          align-self: flex-start;
        }
        .cal-del-btn:active { background: rgba(232,70,106,0.1); color: var(--primary); }

        /* dark */
        .app.dark .cal-event-card { background: #2A2540; }
        .app.dark .cal-event-title { color: #EDE4F0; }

        /* lightbox */
        .cal-lightbox {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.9);
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cal-lightbox img {
          max-width: 95%;
          max-height: 90vh;
          object-fit: contain;
          border-radius: 8px;
        }
        .cal-lightbox-close {
          position: absolute;
          top: calc(16px + var(--safe-top,0px));
          right: 16px;
          background: rgba(255,255,255,0.15);
          border: none;
          border-radius: 50%;
          width: 40px; height: 40px;
          color: white;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cal-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 60px 20px;
          gap: 12px;
        }
        .cal-empty-emoji { font-size: 60px; }
        .cal-empty-text {
          font-family: var(--font-body);
          font-size: 15px;
          color: var(--text-muted);
          text-align: center;
          line-height: 1.6;
        }
      `}</style>

      <div className="cal-wrap">
        <div className="cal-header">
          <div className="cal-header-title">📅 Наш календарь</div>
          <div className="cal-header-sub">{events.length} событий · {upcoming.length} предстоящих</div>
          <button className="cal-add-btn" onClick={() => setShowModal(true)}>＋ Добавить событие</button>
        </div>

        {loading ? (
          <div className="cal-empty"><div className="loading-heart">💕</div></div>
        ) : events.length === 0 ? (
          <div className="cal-empty">
            <div className="cal-empty-emoji">📅</div>
            <p className="cal-empty-text">Пока нет событий.<br />Добавьте первое воспоминание!</p>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <div className="cal-section-label">Предстоящие</div>
                {upcoming.map((ev, i) => <EventCard key={ev.id} event={ev} idx={i} session={session} onDelete={deleteEvent} onPhoto={setLightbox} />)}
              </>
            )}
            {past.length > 0 && (
              <>
                <div className="cal-section-label">Прошедшие</div>
                {past.map((ev, i) => <EventCard key={ev.id} event={ev} idx={i} session={session} onDelete={deleteEvent} onPhoto={setLightbox} past />)}
              </>
            )}
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="cal-lightbox" onClick={() => setLightbox(null)}>
          <button className="cal-lightbox-close">✕</button>
          <img src={lightbox} alt="" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal">
            <div className="modal-handle" />
            <h2 className="modal-title">📅 Новое событие</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Название</label>
                <input className="form-input" type="text" placeholder="Наше первое свидание" value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Дата</label>
                <input className="form-input" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Описание</label>
                <textarea className="form-textarea" placeholder="Что делали, какие эмоции..." value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Эмодзи</label>
                <div className="emoji-select">
                  {EMOJIS.map(e => (
                    <button key={e} type="button" className={`emoji-option${emoji === e ? ' selected' : ''}`} onClick={() => setEmoji(e)}>{e}</button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Фото</label>
                <label className="form-file-label">
                  📷 {photo ? photo.name : 'Выбрать фото'}
                  <input type="file" accept="image/*" onChange={handlePhotoSelect} />
                </label>
                {photoPreview && <img className="photo-preview" src={photoPreview} alt="Preview" />}
              </div>
              <button className="form-submit" type="submit" disabled={saving}>
                {saving ? 'Сохраняем...' : 'Сохранить ❤️'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function EventCard({ event, idx, session, onDelete, onPhoto, past = false }) {
  const { day, month } = formatEventDate(event.event_date)
  const daysUntil = getDaysUntil(event.event_date)
  const daysAgo = Math.abs(daysUntil)

  let badgeText = ''
  let badgeClass = ''
  if (daysUntil === 0) { badgeText = '🎉 Сегодня!'; badgeClass = 'today' }
  else if (daysUntil > 0) { badgeText = `через ${daysUntil} дн`; badgeClass = '' }
  else { badgeText = `${daysAgo} дн назад`; badgeClass = 'past-label' }

  return (
    <div className="cal-event-card" style={{ animationDelay: `${idx * 0.05}s` }}>
      {event.photo_url && (
        <div className="cal-event-photo-wrap" onClick={() => onPhoto(event.photo_url)}>
          <img className="cal-event-photo" src={event.photo_url} alt={event.title} loading="lazy" />
          <div className={`cal-event-badge${past ? ' past' : ''}`}>{badgeText}</div>
        </div>
      )}
      <div className="cal-event-body">
        <div className="cal-date-pill">
          <div className="cal-date-day">{day}</div>
          <div className="cal-date-month">{month}</div>
        </div>
        <div className="cal-event-info">
          <div className="cal-event-title">
            <span>{event.emoji}</span>
            <span>{event.title}</span>
          </div>
          {event.description && <div className="cal-event-desc">{event.description}</div>}
          {!event.photo_url && (
            <span className={`cal-event-countdown${daysUntil === 0 ? ' today' : past ? ' past-label' : ''}`}>
              {badgeText}
            </span>
          )}
        </div>
        <button className="cal-del-btn" onClick={() => onDelete(event.id)}>🗑️</button>
      </div>
    </div>
  )
}
