import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'

const SLIDE_MS = 5200

function plural(n, one, few, many) {
  const a = n % 10, b = n % 100
  if (a === 1 && b !== 11) return one
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return few
  return many
}

const MOOD_LABEL = { '🥰': 'любовь', '😊': 'радость', '😌': 'спокойствие', '🔥': 'страсть', '😕': 'задумчивость', '😢': 'нежность' }

/**
 * LoveStory — full-screen cinematic recap of the couple ("Наша история").
 */
export default function LoveStory({ session, profile, partnerName, coupleStart, onClose }) {
  const uid = session?.user?.id
  const pid = profile?.partner_id

  const [data, setData] = useState(null)
  const [idx, setIdx] = useState(0)
  const touchRef = useRef(null)

  useEffect(() => {
    let on = true
    ;(async () => {
      const ids = [uid, pid].filter(Boolean)
      const scoped = q => ids.length <= 1 ? q.eq('user_id', uid) : q.in('user_id', ids)
      const [mo, ev, pl, md] = await Promise.all([
        scoped(supabase.from('moments').select('photo_url,thumb_url,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(9)),
        scoped(supabase.from('calendar_events').select('title,emoji', { count: 'exact' }).order('event_date', { ascending: false }).limit(1)),
        scoped(supabase.from('plans').select('id', { count: 'exact' }).eq('completed', true)),
        scoped(supabase.from('day_moods').select('mood')),
      ])
      if (!on) return
      const moodCount = {}
      ;(md.data || []).forEach(m => { if (m.mood) moodCount[m.mood] = (moodCount[m.mood] || 0) + 1 })
      let topMood = null, mx = 0
      Object.entries(moodCount).forEach(([e, c]) => { if (c > mx) { mx = c; topMood = e } })
      setData({
        photos: mo.data || [],
        photoCount: mo.count || (mo.data?.length ?? 0),
        eventCount: ev.count || 0,
        topEvent: ev.data?.[0] || null,
        plansDone: pl.count || 0,
        topMood,
      })
    })()
    return () => { on = false }
  }, [uid, pid])

  // lock body scroll
  useEffect(() => {
    const y = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${y}px`
    document.body.style.width = '100%'
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, y)
    }
  }, [])

  const days = useMemo(() => {
    if (!coupleStart) return null
    return Math.max(0, Math.floor((Date.now() - new Date(coupleStart).getTime()) / 86400000))
  }, [coupleStart])

  const slides = useMemo(() => {
    if (!data) return []
    const s = []
    s.push({ key: 'cover', grad: 'linear-gradient(165deg,#3d1838,#7b2d49,#bd5552)' })
    if (days != null) s.push({ key: 'days', grad: 'linear-gradient(165deg,#5e2545,#a0414f,#cb6650)' })
    if (data.photoCount > 0) s.push({ key: 'photos', grad: 'linear-gradient(165deg,#2a1230,#6a2747,#bd5552)' })
    if (data.eventCount > 0) s.push({ key: 'events', grad: 'linear-gradient(165deg,#3d1838,#92384e,#cb6650)' })
    if (data.plansDone > 0) s.push({ key: 'plans', grad: 'linear-gradient(165deg,#2a1230,#7b2d49,#d2715f)' })
    if (data.topMood) s.push({ key: 'mood', grad: 'linear-gradient(165deg,#451f3f,#a0414f,#e09a6f)' })
    s.push({ key: 'finale', grad: 'linear-gradient(165deg,#3d1838,#7b2d49,#cb6650)' })
    return s
  }, [data, days])

  const last = idx >= slides.length - 1

  const next = useCallback(() => { setIdx(i => (i < slides.length - 1 ? i + 1 : i)) }, [slides.length])
  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), [])

  function onTouchStart(e) { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  function onTouchEnd(e) {
    if (!touchRef.current) return
    const dx = e.changedTouches[0].clientX - touchRef.current.x
    const dy = e.changedTouches[0].clientY - touchRef.current.y
    touchRef.current = null
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose()
  }

  if (!data) {
    return createPortal(
      <div className="ls-root" style={{ background: 'linear-gradient(165deg,#3d1838,#7b2d49,#bd5552)' }}>
        <div className="ls-loader" />
        <style>{LS_CSS}</style>
      </div>, document.body)
  }

  const slide = slides[idx]
  const myName = profile?.name || 'Ты'

  return createPortal(
    <div className="ls-root" style={{ background: slide.grad }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <style>{LS_CSS}</style>

      {/* progress */}
      <div className="ls-progress">
        {slides.map((_, i) => (
          <div key={i} className="ls-pg">
            {i < idx && <div className="ls-pg-f done" />}
            {i === idx && !last && <div key={idx} className="ls-pg-f act" style={{ animationDuration: `${SLIDE_MS}ms` }} onAnimationEnd={next} />}
            {i === idx && last && <div className="ls-pg-f done" />}
          </div>
        ))}
      </div>

      <button className="ls-close" onClick={onClose} aria-label="Закрыть">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      {/* tap zones */}
      <div className="ls-tap ls-tap-l" onClick={prev} />
      <div className="ls-tap ls-tap-r" onClick={next} />

      {/* slide content */}
      <div className="ls-stage" key={slide.key}>
        {slide.key === 'cover' && (
          <div className="ls-c ls-center">
            <div className="ls-eyebrow ls-in d0">Наша история</div>
            <div className="ls-hearts ls-in d1">♥</div>
            <h1 className="ls-title ls-in d2">{myName} <span className="ls-amp">&</span> {partnerName}</h1>
            <div className="ls-sub ls-in d3">маленький фильм про вас двоих</div>
          </div>
        )}
        {slide.key === 'days' && (
          <div className="ls-c ls-center">
            <div className="ls-eyebrow ls-in d0">Вместе уже</div>
            <div className="ls-big ls-in d1">{days}</div>
            <div className="ls-bigsub ls-in d2">{plural(days, 'день', 'дня', 'дней')}</div>
            <div className="ls-sub ls-in d3">и каждый из них — ваш</div>
          </div>
        )}
        {slide.key === 'photos' && (
          <div className="ls-c">
            <div className="ls-eyebrow ls-in d0">Ваши кадры</div>
            <div className="ls-num ls-in d1">{data.photoCount}</div>
            <div className="ls-numsub ls-in d2">{plural(data.photoCount, 'момент', 'момента', 'моментов')} сохранено</div>
            <div className="ls-collage ls-in d3">
              {data.photos.slice(0, 6).map((p, i) => (
                <div className="ls-cell" key={i} style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
                  {(p.thumb_url || p.photo_url)
                    ? <img src={p.thumb_url || p.photo_url} alt="" />
                    : <span>♥</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {slide.key === 'events' && (
          <div className="ls-c ls-center">
            <div className="ls-eyebrow ls-in d0">Вы пережили</div>
            <div className="ls-big ls-in d1">{data.eventCount}</div>
            <div className="ls-bigsub ls-in d2">{plural(data.eventCount, 'событие', 'события', 'событий')}</div>
            {data.topEvent && <div className="ls-chip ls-in d3">{data.topEvent.emoji || '✨'} {data.topEvent.title}</div>}
          </div>
        )}
        {slide.key === 'plans' && (
          <div className="ls-c ls-center">
            <div className="ls-eyebrow ls-in d0">Мечты сбываются</div>
            <div className="ls-big ls-in d1">{data.plansDone}</div>
            <div className="ls-bigsub ls-in d2">{plural(data.plansDone, 'план исполнен', 'плана исполнено', 'планов исполнено')}</div>
            <div className="ls-sub ls-in d3">вместе — всё по силам</div>
          </div>
        )}
        {slide.key === 'mood' && (
          <div className="ls-c ls-center">
            <div className="ls-eyebrow ls-in d0">Чаще всего у вас</div>
            <div className="ls-mood ls-in d1">{data.topMood}</div>
            <div className="ls-bigsub ls-in d2">{MOOD_LABEL[data.topMood] || 'тепло'}</div>
          </div>
        )}
        {slide.key === 'finale' && (
          <div className="ls-c ls-center">
            <div className="ls-hearts big ls-in d0">♥</div>
            <h2 className="ls-fin ls-in d1">И это только<br/>начало вашей истории</h2>
            <div className="ls-sub ls-in d2">{myName} & {partnerName}</div>
            <button className="ls-btn ls-in d3" onClick={onClose}>Закрыть</button>
          </div>
        )}
      </div>

      {/* floating hearts ambiance */}
      <div className="ls-amb" aria-hidden="true">
        {[8, 22, 40, 58, 74, 90].map((l, i) => (
          <span key={i} style={{ left: `${l}%`, animationDelay: `${i * 1.3}s`, fontSize: `${10 + (i % 3) * 6}px` }}>♥</span>
        ))}
      </div>
    </div>,
    document.body
  )
}

const LS_CSS = `
  .ls-root {
    position: fixed; inset: 0; z-index: 5000;
    overflow: hidden; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-body, sans-serif);
    touch-action: none;
  }
  .ls-loader { width: 40px; height: 40px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.25); border-top-color: #fff; animation: lsSpin 0.9s linear infinite; }
  @keyframes lsSpin { to { transform: rotate(360deg); } }

  .ls-progress { position: absolute; top: calc(env(safe-area-inset-top,0px) + 12px); left: 12px; right: 12px; z-index: 10; display: flex; gap: 5px; }
  .ls-pg { flex: 1; height: 3px; border-radius: 3px; background: rgba(255,255,255,0.28); overflow: hidden; }
  .ls-pg-f { height: 100%; width: 100%; border-radius: 3px; background: #fff; transform: scaleX(0); transform-origin: left; }
  .ls-pg-f.done { transform: scaleX(1); }
  .ls-pg-f.act { animation: lsFill linear forwards; }
  @keyframes lsFill { from { transform: scaleX(0); } to { transform: scaleX(1); } }

  .ls-close { position: absolute; top: calc(env(safe-area-inset-top,0px) + 22px); right: 16px; z-index: 12; width: 38px; height: 38px; border-radius: 50%; background: rgba(0,0,0,0.3); backdrop-filter: blur(8px); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; }

  .ls-tap { position: absolute; top: 0; bottom: 0; width: 30%; z-index: 8; }
  .ls-tap-l { left: 0; } .ls-tap-r { right: 0; }

  .ls-stage { position: relative; z-index: 6; width: 100%; padding: 0 28px; }
  .ls-c { display: grid; gap: 8px; }
  .ls-center { justify-items: center; text-align: center; }

  .ls-eyebrow { font-size: 13px; letter-spacing: 0.28em; text-transform: uppercase; color: rgba(255,255,255,0.7); }
  .ls-title { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600; font-size: clamp(38px,12vw,64px); line-height: 1.02; margin: 6px 0; text-shadow: 0 4px 30px rgba(0,0,0,0.35); }
  .ls-amp { color: #ffd9a8; font-style: italic; }
  .ls-sub { font-size: 15px; color: rgba(255,255,255,0.82); }
  .ls-hearts { font-size: 40px; color: #fff; filter: drop-shadow(0 6px 18px rgba(255,120,150,0.6)); animation: lsBeat 1.3s ease-in-out infinite; }
  .ls-hearts.big { font-size: 64px; }

  .ls-big { font-family: "Helvetica Neue", Arial, sans-serif; font-weight: 800; font-size: clamp(86px,30vw,150px); line-height: 0.9; letter-spacing: -0.04em; text-shadow: 0 10px 40px rgba(0,0,0,0.4); font-variant-numeric: tabular-nums; }
  .ls-bigsub { font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(26px,7vw,38px); }
  .ls-num { font-family: "Helvetica Neue", Arial, sans-serif; font-weight: 800; font-size: clamp(60px,20vw,110px); line-height: 0.9; letter-spacing: -0.04em; }
  .ls-numsub { font-size: 15px; color: rgba(255,255,255,0.82); margin-bottom: 6px; }
  .ls-mood { font-size: clamp(90px,30vw,150px); line-height: 1; animation: lsBeat 1.4s ease-in-out infinite; }

  .ls-chip { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 999px; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.28); font-size: 15px; font-weight: 600; max-width: 80vw; }
  .ls-fin { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600; font-size: clamp(28px,8vw,42px); line-height: 1.15; margin: 4px 0; }
  .ls-btn { margin-top: 14px; padding: 13px 28px; border-radius: 999px; border: none; background: #fff; color: #b2364f; font-weight: 700; font-size: 15px; cursor: pointer; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }

  .ls-collage { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-top: 14px; width: 100%; max-width: 360px; margin-left: auto; margin-right: auto; }
  .ls-cell { aspect-ratio: 1; border-radius: 14px; overflow: hidden; background: rgba(255,255,255,0.12); display: flex; align-items: center; justify-content: center; opacity: 0; animation: lsPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
  .ls-cell img { width: 100%; height: 100%; object-fit: cover; }
  @keyframes lsPop { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }

  .ls-in { opacity: 0; animation: lsUp 0.7s cubic-bezier(0.22,1,0.36,1) forwards; }
  .ls-in.d0 { animation-delay: 0.05s; } .ls-in.d1 { animation-delay: 0.2s; }
  .ls-in.d2 { animation-delay: 0.38s; } .ls-in.d3 { animation-delay: 0.56s; }
  @keyframes lsUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes lsBeat { 0%,100% { transform: scale(1); } 18% { transform: scale(1.18); } 36% { transform: scale(1); } }

  .ls-amb { position: absolute; inset: 0; z-index: 1; pointer-events: none; overflow: hidden; }
  .ls-amb span { position: absolute; bottom: -30px; color: rgba(255,255,255,0.18); animation: lsFloat 9s ease-in infinite; }
  @keyframes lsFloat { 0% { transform: translateY(0); opacity: 0; } 12% { opacity: 1; } 100% { transform: translateY(-105vh) rotate(40deg); opacity: 0; } }
`
