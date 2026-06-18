import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { sendPushNotification } from '../lib/push'

/* ── icons ── */
function IcoClose() {
  return (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>)
}
function IcoCamera() {
  return (<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>)
}
function IcoPlus() {
  return (<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>)
}
function IcoChevron({ dir }) {
  return (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{dir === 'left' ? <polyline points="15 6 9 12 15 18"/> : <polyline points="9 6 15 12 9 18"/>}</svg>)
}
function IcoTrash() {
  return (<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>)
}
function IcoCheck() {
  return (<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>)
}
function LoadingHeart() {
  return (
    <svg viewBox="0 0 60 56" width="44" height="40" fill="none">
      <style>{`@keyframes hbC{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}.hbC{animation:hbC 1.2s ease-in-out infinite;transform-origin:center}`}</style>
      <g className="hbC"><path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z" fill="rgba(255,141,160,0.5)" stroke="rgba(255,141,160,0.7)" strokeWidth="2"/></g>
    </svg>
  )
}

const MONTHS_FULL = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
const EMOJIS = ['❤️','🥰','🎉','🎂','🎬','🍕','✈️','🌅','🎵','💐','🏖️','🎄','🌸','🎭','🌙','⭐']

/* Mood of the day */
const DAY_MOODS = [
  { e: '🥰', label: 'Любовь' },
  { e: '😊', label: 'Хорошо' },
  { e: '😌', label: 'Спокойно' },
  { e: '🔥', label: 'Страсть' },
  { e: '😕', label: 'Так себе' },
  { e: '😢', label: 'Грустно' },
]
const MOOD_COLOR = { '🥰': '#ff5c7a', '😊': '#f7b94a', '😌': '#4cc6c0', '🔥': '#ff7a45', '😕': '#9aa0a6', '😢': '#5b8def' }

function sameMonthDay(dateStr, m, d) {
  if (!dateStr) return false
  const x = new Date(dateStr)
  return x.getMonth() === m && x.getDate() === d
}

function keyOf(d) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export default function Calendar({ session, profile }) {
  const uid = session?.user?.id
  const pid = profile?.partner_id

  const [events, setEvents] = useState([])
  const [photos, setPhotos] = useState([])
  const [plans, setPlans] = useState([])
  const [moods, setMoods] = useState([])
  const [special, setSpecial] = useState({ partnerName: '', partnerBday: null, coupleStart: null, nextMeeting: null })
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() } })
  const [selected, setSelected] = useState(() => keyOf(new Date()))
  const [lightbox, setLightbox] = useState(null)

  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [emoji, setEmoji] = useState('❤️')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  const load = useCallback(async () => {
    const ids = [uid, pid].filter(Boolean)
    if (!ids.length) { setLoading(false); return }
    const scoped = (q) => ids.length === 1 ? q.eq('user_id', ids[0]) : q.in('user_id', ids)
    const [ev, mo, pl, md] = await Promise.all([
      scoped(supabase.from('calendar_events').select('*')),
      scoped(supabase.from('moments').select('id,title,photo_url,thumb_url,created_at,mood')),
      scoped(supabase.from('plans').select('id,title,completed,completed_at,created_at')),
      scoped(supabase.from('day_moods').select('id,user_id,day,mood,note')),
    ])
    setEvents(ev.data || [])
    setPhotos(mo.data || [])
    setPlans(pl.data || [])
    setMoods(md.data || [])

    // Special dates: partner birthday, couple anniversary, next meeting
    try {
      const [partnerRes, coupleRes, setRes] = await Promise.all([
        pid ? supabase.from('profiles').select('name,birthday').eq('id', pid).maybeSingle() : Promise.resolve({ data: null }),
        profile?.couple_id ? supabase.from('couples').select('start_date,couple_start_date').eq('id', profile.couple_id).maybeSingle() : Promise.resolve({ data: null }),
        profile?.couple_id
          ? supabase.from('couple_settings').select('next_meeting').eq('couple_id', profile.couple_id).maybeSingle()
          : supabase.from('couple_settings').select('next_meeting').eq('user_id', uid).maybeSingle(),
      ])
      setSpecial({
        partnerName: partnerRes.data?.name || 'Партнёр',
        partnerBday: partnerRes.data?.birthday || null,
        coupleStart: coupleRes.data?.start_date || coupleRes.data?.couple_start_date || profile?.couple_start_date || null,
        nextMeeting: setRes.data?.next_meeting || null,
      })
    } catch (_e) { /* optional */ }

    setLoading(false)
  }, [uid, pid, profile?.couple_id, profile?.couple_start_date])

  useEffect(() => { load() }, [load])

  /* day -> { events, photos, plans, moods } */
  const byDay = useMemo(() => {
    const map = {}
    const add = (k, type, item) => { (map[k] ??= { events: [], photos: [], plans: [], moods: [] })[type].push(item) }
    events.forEach(e => e.event_date && add(keyOf(e.event_date), 'events', e))
    photos.forEach(p => p.created_at && add(keyOf(p.created_at), 'photos', p))
    plans.forEach(p => { if (p.completed && p.completed_at) add(keyOf(p.completed_at), 'plans', p) })
    moods.forEach(m => m.day && add(keyOf(m.day), 'moods', m))
    return map
  }, [events, photos, plans, moods])

  async function saveMood(emoji) {
    const day = selected
    const mine = moods.find(m => m.user_id === uid && keyOf(m.day) === day)
    const next = mine && mine.mood === emoji ? null : emoji  // tap again to clear
    // optimistic
    setMoods(prev => {
      const rest = prev.filter(m => !(m.user_id === uid && keyOf(m.day) === day))
      return next ? [...rest, { id: mine?.id || `tmp-${day}`, user_id: uid, day, mood: next }] : rest
    })
    if (next) {
      const payload = { user_id: uid, day, mood: next, updated_at: new Date().toISOString() }
      if (profile?.couple_id) payload.couple_id = profile.couple_id
      await supabase.from('day_moods').upsert(payload, { onConflict: 'user_id,day' })
    } else if (mine?.id) {
      await supabase.from('day_moods').delete().eq('user_id', uid).eq('day', day)
    }
  }

  /* grid cells (Monday-first) */
  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1)
    const lead = (first.getDay() + 6) % 7
    const days = new Date(view.y, view.m + 1, 0).getDate()
    const arr = []
    for (let i = 0; i < lead; i++) arr.push(null)
    for (let d = 1; d <= days; d++) arr.push(keyOf(new Date(view.y, view.m, d)))
    return arr
  }, [view])

  const todayKey = keyOf(new Date())
  const sel = byDay[selected] || { events: [], photos: [], plans: [], moods: [] }
  const selDate = new Date(selected)
  const myMood = sel.moods.find(m => m.user_id === uid)?.mood || null
  const partnerMood = sel.moods.find(m => m.user_id !== uid)?.mood || null
  const WD_FULL = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота']

  function yearsWord(n) {
    const a = n % 10, b = n % 100
    if (a === 1 && b !== 11) return 'год'
    if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return 'года'
    return 'лет'
  }
  function specialsFor(key) {
    const d = new Date(key), m = d.getMonth(), day = d.getDate()
    const out = []
    if (sameMonthDay(profile?.birthday, m, day)) out.push({ icon: '🎂', label: 'Твой день рождения' })
    if (sameMonthDay(special.partnerBday, m, day)) out.push({ icon: '🎂', label: `День рождения · ${special.partnerName}` })
    if (sameMonthDay(special.coupleStart, m, day)) {
      const years = d.getFullYear() - new Date(special.coupleStart).getFullYear()
      out.push({ icon: '💍', label: years > 0 ? `Годовщина · ${years} ${yearsWord(years)}` : 'Начало отношений' })
    }
    if (special.nextMeeting && keyOf(special.nextMeeting) === key) out.push({ icon: '📍', label: 'Встреча' })
    return out
  }
  const selSpecials = specialsFor(selected)

  const monthStats = useMemo(() => {
    let ev = 0, ph = 0, pl = 0; const mc = {}
    Object.entries(byDay).forEach(([k, v]) => {
      const d = new Date(k)
      if (d.getMonth() !== view.m || d.getFullYear() !== view.y) return
      ev += v.events.length; ph += v.photos.length; pl += v.plans.length
      v.moods.forEach(m => { if (m.mood) mc[m.mood] = (mc[m.mood] || 0) + 1 })
    })
    let top = null, max = 0
    Object.entries(mc).forEach(([e, c]) => { if (c > max) { max = c; top = e } })
    return { ev, ph, pl, top }
  }, [byDay, view])

  const memories = useMemo(() => {
    const d = new Date(selected), m = d.getMonth(), day = d.getDate(), y = d.getFullYear()
    const out = []
    events.forEach(e => { if (sameMonthDay(e.event_date, m, day) && new Date(e.event_date).getFullYear() < y) out.push({ t: 'e', it: e }) })
    photos.forEach(p => { if (sameMonthDay(p.created_at, m, day) && new Date(p.created_at).getFullYear() < y) out.push({ t: 'p', it: p }) })
    return out
  }, [selected, events, photos])

  function shiftMonth(delta) {
    setView(v => {
      const d = new Date(v.y, v.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  async function uploadPhoto(file) {
    const ext = file.name.split('.').pop()
    const path = `calendar/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from('photos').upload(path, file)
    if (error) throw error
    return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
  }
  function handlePhotoSelect(e) {
    const f = e.target.files[0]
    if (!f) return
    setPhoto(f); setPhotoPreview(URL.createObjectURL(f))
  }
  function openAdd() {
    setEventDate(selected)
    setShowModal(true)
  }
  async function handleSubmit(e) {
    e.preventDefault()
    if (!title || !eventDate) return
    setSaving(true)
    try {
      let photoUrl = null
      if (photo) photoUrl = await uploadPhoto(photo)
      const { error } = await supabase.from('calendar_events').insert({
        user_id: session.user.id, title, description, event_date: eventDate, emoji, photo_url: photoUrl,
      })
      if (!error) {
        setTitle(''); setDescription(''); setEventDate(''); setEmoji('❤️'); setPhoto(null); setPhotoPreview(null)
        setShowModal(false); load()
        if (profile?.partner_id) {
          sendPushNotification(`📅 ${profile?.name || 'Партнёр'} · Новое событие`, `${emoji || '📅'} ${title}`, profile.partner_id, session.user.id).catch(() => {})
        }
      }
    } catch (err) { console.error(err) }
    setSaving(false)
  }
  async function deleteEvent(id) {
    if (!confirm('Удалить это событие?')) return
    await supabase.from('calendar_events').delete().eq('id', id)
    load()
  }

  return (
    <>
      <style>{`
        .cal-wrap { padding: 0 0 130px; }
        .cal-header {
          background: linear-gradient(165deg, #5e2545 0%, #92384e 44%, #bd5552 76%, #cb6650 100%);
          padding: calc(env(safe-area-inset-top,0px) + 40px) 20px 26px;
          border-radius: 0 0 30px 30px;
          box-shadow: 0 12px 40px rgba(60,20,40,0.45);
          position: relative; overflow: hidden;
        }
        .cal-header::after { content:''; position:absolute; inset:0; background: radial-gradient(ellipse at 80% 0%, rgba(255,210,150,0.28), transparent 55%); pointer-events:none; }
        .cal-h-title { font-family: var(--font-display); font-size: 26px; color:#fff; }
        .cal-h-sub { font-size: 13px; color: rgba(255,255,255,0.7); font-family: var(--font-body); margin-top: 2px; }
        .cal-add-btn {
          margin-top: 14px; width: 100%;
          background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.28);
          border-radius: 14px; color: #fff; font-family: var(--font-body); font-weight: 500; font-size: 14px;
          padding: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .cal-add-btn:active { background: rgba(255,255,255,0.26); }

        .cal-card {
          margin: 16px 14px 0; padding: 14px;
          border-radius: 22px;
          background: var(--surface, #1f0e16);
          border: 1px solid var(--border, rgba(255,255,255,0.07));
          box-shadow: var(--shadow-card, 0 2px 16px rgba(0,0,0,0.4));
        }
        .cal-monthbar { display:flex; align-items:center; justify-content:space-between; margin-bottom: 12px; }
        .cal-month-title { font-family: var(--font-display); font-size: 21px; color: var(--text); }
        .cal-nav-btn {
          width: 36px; height: 36px; border-radius: 12px; border: none; cursor: pointer;
          background: var(--surface-2, rgba(255,255,255,0.06)); color: var(--text);
          display:flex; align-items:center; justify-content:center;
        }
        .cal-nav-btn:active { background: rgba(255,141,160,0.18); }

        .cal-weekdays { display:grid; grid-template-columns: repeat(7,1fr); margin-bottom: 4px; }
        .cal-weekday { text-align:center; font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; }
        .cal-grid { display:grid; grid-template-columns: repeat(7,1fr); gap: 2px; }
        .cal-cell {
          aspect-ratio: 1; border: none; background: none; cursor: pointer; position: relative;
          display:flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
          border-radius: 12px; color: var(--text); font-family: var(--font-body); font-size: 14px;
          -webkit-tap-highlight-color: transparent;
        }
        .cal-cell.empty { pointer-events: none; }
        .cal-cell.today { color: #ff8da0; font-weight: 700; }
        .cal-cell.sel { background: linear-gradient(160deg, #ff8da0, #d8456b); color: #fff; font-weight: 700; }
        .cal-cell.sel .cal-dot { box-shadow: 0 0 0 1px rgba(255,255,255,0.6); }
        .cal-dots { display:flex; gap: 3px; height: 5px; }
        .cal-dot { width: 5px; height: 5px; border-radius: 50%; }
        .cal-dot.ev { background: #ff8da0; }
        .cal-dot.ph { background: #5ec6c6; }
        .cal-dot.pl { background: #54df86; }

        .cal-card { animation: calCardIn 0.32s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes calCardIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .cal-cell-mood { position: absolute; top: 3px; right: 5px; font-size: 11px; line-height: 1; }
        .cal-day-title { font-family: var(--font-display); font-size: 20px; color: var(--text); margin-bottom: 12px; display:flex; align-items:baseline; gap:8px; }
        .cal-day-wd { font-family: var(--font-body); font-size: 12px; color: var(--text-muted); text-transform: capitalize; }

        /* mood of the day */
        .cal-mood-box { padding: 12px; border-radius: 16px; background: var(--surface-2, rgba(255,255,255,0.05)); margin-bottom: 14px; }
        .cal-mood-q { font-size: 12px; color: var(--text-muted); font-family: var(--font-body); margin-bottom: 8px; }
        .cal-mood-row { display:flex; gap: 6px; justify-content: space-between; }
        .cal-mood-btn {
          flex: 1; aspect-ratio: 1; max-width: 46px;
          border-radius: 12px; border: 1.5px solid transparent;
          background: rgba(255,255,255,0.06); cursor: pointer;
          font-size: 20px; line-height: 1;
          transition: transform 0.15s ease, background 0.2s, border-color 0.2s;
          -webkit-tap-highlight-color: transparent;
        }
        .cal-mood-btn:active { transform: scale(0.88); }
        .cal-mood-btn.on { background: rgba(255,141,160,0.22); border-color: rgba(255,141,160,0.7); transform: scale(1.06); }
        .cal-mood-partner { margin-top: 9px; font-size: 12px; color: var(--text-soft, var(--text-muted)); font-family: var(--font-body); }
        .cal-row {
          display:flex; align-items:center; gap: 12px; padding: 10px 0;
          border-bottom: 1px solid var(--border, rgba(255,255,255,0.06));
        }
        .cal-row:last-child { border-bottom: none; }
        .cal-row-emoji { font-size: 22px; width: 42px; height: 42px; display:flex; align-items:center; justify-content:center; border-radius:12px; background: var(--surface-2, rgba(255,255,255,0.06)); flex-shrink:0; }
        .cal-row-thumb { width: 46px; height: 46px; border-radius: 12px; object-fit: cover; flex-shrink: 0; cursor: pointer; }
        .cal-row-mid { flex: 1; min-width: 0; }
        .cal-row-name { font-size: 14px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cal-row-sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
        .cal-row-tag { font-size: 10px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; padding: 3px 7px; border-radius: 7px; }
        .cal-row-tag.ev { background: rgba(255,141,160,0.18); color: #ff8da0; }
        .cal-row-tag.ph { background: rgba(94,198,198,0.18); color: #7ad6d6; }
        .cal-row-tag.pl { background: rgba(84,223,134,0.16); color: #6fe29a; }
        .cal-check { width: 26px; height: 26px; border-radius: 50%; background: linear-gradient(135deg,#43d97a,#1f9e54); color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .cal-del { background:none; border:none; color: var(--text-muted); cursor:pointer; padding:4px; flex-shrink:0; }
        .cal-del:active { color:#ff8da0; }
        .cal-empty-day { text-align:center; padding: 18px 0; color: var(--text-muted); font-size: 13px; font-family: var(--font-body); }

        .cal-legend { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin: 12px 14px 0; }
        .cal-leg { display:flex; align-items:center; gap:5px; font-size: 11px; color: var(--text-muted); font-family: var(--font-body); }

        /* month summary */
        .cal-summary { display:grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin: 14px 14px 0; }
        .cal-sum-cell {
          background: var(--surface, #1f0e16); border: 1px solid var(--border, rgba(255,255,255,0.07));
          border-radius: 16px; padding: 12px 6px; text-align: center;
          display:flex; flex-direction:column; align-items:center; gap:3px;
        }
        .cal-sum-num { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 22px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
        .cal-sum-mood { font-size: 22px; }
        .cal-sum-lbl { font-size: 9.5px; letter-spacing: 0.4px; text-transform: uppercase; color: var(--text-muted); }

        /* special day */
        .cal-cell.special { box-shadow: inset 0 0 0 1.5px rgba(255,210,120,0.6); }
        .cal-cell-sp { position:absolute; top:2px; right:4px; font-size: 11px; }
        .cal-special {
          display:flex; align-items:center; gap:10px; padding: 11px 12px; margin-bottom: 10px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(255,210,120,0.16), rgba(255,141,160,0.12));
          border: 1px solid rgba(255,210,120,0.35);
        }
        .cal-special-ic { font-size: 20px; }
        .cal-special-lbl { font-size: 14px; font-weight: 600; color: var(--text); font-family: var(--font-body); }

        /* memories */
        .cal-memories { margin-top: 8px; padding-top: 12px; border-top: 1px dashed var(--border, rgba(255,255,255,0.1)); }
        .cal-mem-title { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 6px; }

        .cal-loading { display:flex; justify-content:center; padding: 50px; }

        .cal-lightbox {
          position: fixed; inset: 0; z-index: 4000;
          display:flex; align-items:center; justify-content:center;
          padding: 24px;
          background: rgba(8,3,6,0.86);
          backdrop-filter: blur(22px) saturate(120%);
          -webkit-backdrop-filter: blur(22px) saturate(120%);
          animation: lbFade 0.22s ease;
        }
        @keyframes lbFade { from { opacity: 0; } to { opacity: 1; } }
        .cal-lightbox img {
          max-width: 100%; max-height: 82vh; object-fit: contain;
          border-radius: 18px;
          box-shadow: 0 30px 90px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.08);
          animation: lbZoom 0.32s cubic-bezier(0.22,1,0.36,1);
        }
        @keyframes lbZoom { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .cal-lightbox-close {
          position:absolute; top: calc(18px + var(--safe-top,0px)); right:18px;
          background: rgba(255,255,255,0.14); backdrop-filter: blur(10px);
          border:1px solid rgba(255,255,255,0.18); border-radius:50%;
          width:42px; height:42px; color:#fff; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
        }
        .cal-lightbox-close:active { transform: scale(0.92); }
        .cal-lightbox-hint {
          position:absolute; bottom: calc(28px + env(safe-area-inset-bottom,0px)); left:0; right:0;
          text-align:center; color: rgba(255,255,255,0.45);
          font-size: 12px; font-family: var(--font-body, sans-serif);
          pointer-events:none;
        }
      `}</style>

      <div className="cal-wrap">
        <div className="cal-header">
          <div className="cal-h-title">Наш календарь</div>
          <div className="cal-h-sub">{events.length} событий · {photos.length} фото · {plans.filter(p => p.completed).length} выполнено</div>
          <button className="cal-add-btn" onClick={openAdd}><IcoPlus /> Добавить событие</button>
        </div>

        {loading ? (
          <div className="cal-loading"><LoadingHeart /></div>
        ) : (
          <>
            {/* Month grid */}
            <div className="cal-card">
              <div className="cal-monthbar">
                <button className="cal-nav-btn" onClick={() => shiftMonth(-1)} aria-label="Назад"><IcoChevron dir="left" /></button>
                <div className="cal-month-title">{MONTHS_FULL[view.m]} {view.y}</div>
                <button className="cal-nav-btn" onClick={() => shiftMonth(1)} aria-label="Вперёд"><IcoChevron dir="right" /></button>
              </div>
              <div className="cal-weekdays">
                {WEEKDAYS.map(w => <div key={w} className="cal-weekday">{w}</div>)}
              </div>
              <div className="cal-grid">
                {cells.map((k, i) => {
                  if (!k) return <div key={`e${i}`} className="cal-cell empty" />
                  const d = byDay[k]
                  const day = Number(k.slice(8))
                  const isSel = k === selected
                  const isToday = k === todayKey
                  const moodE = d?.moods?.length ? d.moods[0].mood : null
                  const sp = specialsFor(k)
                  const tint = moodE ? MOOD_COLOR[moodE] : null
                  const style = (!isSel && tint) ? { background: `${tint}26` } : undefined
                  return (
                    <button
                      key={k}
                      className={`cal-cell${isSel ? ' sel' : ''}${isToday && !isSel ? ' today' : ''}${sp.length ? ' special' : ''}`}
                      style={style}
                      onClick={() => setSelected(k)}
                    >
                      {sp.length > 0 && <span className="cal-cell-sp">{sp[0].icon}</span>}
                      {moodE && !sp.length && <span className="cal-cell-mood">{moodE}</span>}
                      <span>{day}</span>
                      <span className="cal-dots">
                        {d?.events.length > 0 && <span className="cal-dot ev" />}
                        {d?.photos.length > 0 && <span className="cal-dot ph" />}
                        {d?.plans.length > 0 && <span className="cal-dot pl" />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Month summary */}
            <div className="cal-summary">
              <div className="cal-sum-cell"><span className="cal-sum-num">{monthStats.ev}</span><span className="cal-sum-lbl">событий</span></div>
              <div className="cal-sum-cell"><span className="cal-sum-num">{monthStats.ph}</span><span className="cal-sum-lbl">фото</span></div>
              <div className="cal-sum-cell"><span className="cal-sum-num">{monthStats.pl}</span><span className="cal-sum-lbl">выполнено</span></div>
              <div className="cal-sum-cell"><span className="cal-sum-num cal-sum-mood">{monthStats.top || '—'}</span><span className="cal-sum-lbl">настрой</span></div>
            </div>

            <div className="cal-legend">
              <span className="cal-leg"><span className="cal-dot ev" /> События</span>
              <span className="cal-leg"><span className="cal-dot ph" /> Фото</span>
              <span className="cal-leg"><span className="cal-dot pl" /> Планы</span>
              <span className="cal-leg">🎂💍 Особые</span>
            </div>

            {/* Selected day detail */}
            <div className="cal-card" key={selected}>
              <div className="cal-day-title">{selDate.getDate()} {MONTHS_GEN[selDate.getMonth()]}<span className="cal-day-wd">{WD_FULL[selDate.getDay()]}</span></div>

              {selSpecials.map((s, i) => (
                <div className="cal-special" key={i}>
                  <span className="cal-special-ic">{s.icon}</span>
                  <span className="cal-special-lbl">{s.label}</span>
                </div>
              ))}

              {/* Mood of the day */}
              <div className="cal-mood-box">
                <div className="cal-mood-q">Каким был день?</div>
                <div className="cal-mood-row">
                  {DAY_MOODS.map(m => (
                    <button
                      key={m.e}
                      className={`cal-mood-btn${myMood === m.e ? ' on' : ''}`}
                      onClick={() => saveMood(m.e)}
                      title={m.label}
                    >{m.e}</button>
                  ))}
                </div>
                {partnerMood && (
                  <div className="cal-mood-partner">{partnerMood} — настроение партнёра</div>
                )}
              </div>

              {sel.events.length === 0 && sel.photos.length === 0 && sel.plans.length === 0 ? (
                <div className="cal-empty-day">В этот день нет событий, фото и планов</div>
              ) : (
                <>
                  {sel.events.map(ev => (
                    <div className="cal-row" key={`ev${ev.id}`}>
                      {ev.photo_url
                        ? <img className="cal-row-thumb" src={ev.photo_url} alt="" onClick={() => setLightbox(ev.photo_url)} />
                        : <span className="cal-row-emoji">{ev.emoji || '📅'}</span>}
                      <div className="cal-row-mid">
                        <div className="cal-row-name">{ev.title}</div>
                        {ev.description && <div className="cal-row-sub">{ev.description}</div>}
                      </div>
                      <span className="cal-row-tag ev">Событие</span>
                      {ev.user_id === session.user.id && (
                        <button className="cal-del" onClick={() => deleteEvent(ev.id)} aria-label="Удалить"><IcoTrash /></button>
                      )}
                    </div>
                  ))}
                  {sel.photos.map(p => (
                    <div className="cal-row" key={`ph${p.id}`}>
                      {(p.thumb_url || p.photo_url)
                        ? <img className="cal-row-thumb" src={p.thumb_url || p.photo_url} alt="" onClick={() => setLightbox(p.photo_url || p.thumb_url)} />
                        : <span className="cal-row-emoji">📷</span>}
                      <div className="cal-row-mid">
                        <div className="cal-row-name">{p.title || 'Момент'}</div>
                      </div>
                      <span className="cal-row-tag ph">Фото</span>
                    </div>
                  ))}
                  {sel.plans.map(p => (
                    <div className="cal-row" key={`pl${p.id}`}>
                      <span className="cal-check"><IcoCheck /></span>
                      <div className="cal-row-mid">
                        <div className="cal-row-name">{p.title}</div>
                        <div className="cal-row-sub">Выполнено</div>
                      </div>
                      <span className="cal-row-tag pl">План</span>
                    </div>
                  ))}
                </>
              )}

              {memories.length > 0 && (
                <div className="cal-memories">
                  <div className="cal-mem-title">✨ В этот день раньше</div>
                  {memories.map((mm, i) => {
                    const it = mm.it
                    const yr = new Date(mm.t === 'e' ? it.event_date : it.created_at).getFullYear()
                    const img = mm.t === 'e' ? it.photo_url : (it.thumb_url || it.photo_url)
                    return (
                      <div className="cal-row" key={`mem${i}`}>
                        {img
                          ? <img className="cal-row-thumb" src={img} alt="" onClick={() => setLightbox(mm.t === 'e' ? it.photo_url : (it.photo_url || it.thumb_url))} />
                          : <span className="cal-row-emoji">{mm.t === 'e' ? (it.emoji || '📅') : '📷'}</span>}
                        <div className="cal-row-mid">
                          <div className="cal-row-name">{it.title || 'Момент'}</div>
                          <div className="cal-row-sub">{yr}</div>
                        </div>
                        <span className="cal-row-tag ph">{new Date().getFullYear() - yr} {yearsWord(new Date().getFullYear() - yr)} назад</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {lightbox && createPortal(
        <div className="cal-lightbox" onClick={() => setLightbox(null)}>
          <button className="cal-lightbox-close" onClick={() => setLightbox(null)}><IcoClose /></button>
          <img src={lightbox} alt="" onClick={e => e.stopPropagation()} />
          <div className="cal-lightbox-hint">нажмите, чтобы закрыть</div>
        </div>,
        document.body
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal">
            <div className="modal-handle" />
            <h2 className="modal-title">Новое событие</h2>
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
                  <IcoCamera /> {photo ? photo.name : 'Выбрать фото'}
                  <input type="file" accept="image/*" onChange={handlePhotoSelect} />
                </label>
                {photoPreview && <img className="photo-preview" src={photoPreview} alt="Preview" />}
              </div>
              <button className="form-submit" type="submit" disabled={saving}>
                {saving ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
