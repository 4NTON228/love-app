import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const COUPLE_START = new Date('2025-10-17T00:00:00')

function getRelationshipTime(start) {
  const now = new Date()
  const diff = now - start
  const totalDays = Math.floor(diff / (1000 * 60 * 60 * 24))
  const years = Math.floor(totalDays / 365)
  const months = Math.floor((totalDays % 365) / 30)
  const weeks = Math.floor((totalDays % 30) / 7)
  const days = totalDays % 7
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  return { totalDays, years, months, weeks, days, hours, minutes, seconds }
}

export default function LoveClock() {
  const [time, setTime] = useState(getRelationshipTime(COUPLE_START))
  const [photos, setPhotos] = useState([])
  const canvasRef = useRef(null)
  const particlesRef = useRef([])
  const rafRef = useRef(null)

  const pad = n => String(n).padStart(2, '0')

  // Live counter
  useEffect(() => {
    const id = setInterval(() => setTime(getRelationshipTime(COUPLE_START)), 1000)
    return () => clearInterval(id)
  }, [])

  // Load moment photos
  useEffect(() => {
    supabase.from('moments').select('photo_url').not('photo_url', 'is', null).limit(12).then(({ data }) => {
      if (data) setPhotos(data.map(m => m.photo_url).filter(Boolean))
    })
  }, [])

  // Particle canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let W = canvas.width = canvas.offsetWidth || 320
    let H = canvas.height = canvas.offsetHeight || 400

    const initParticles = () => {
      particlesRef.current = Array.from({ length: 60 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 1 + Math.random() * 2.5,
        dx: (Math.random() - 0.5) * 0.4,
        dy: -0.3 - Math.random() * 0.5,
        a: Math.random(),
        da: 0.005 + Math.random() * 0.01,
      }))
    }
    initParticles()

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      for (const p of particlesRef.current) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,180,210,${p.a})`
        ctx.fill()
        p.x += p.dx; p.y += p.dy; p.a -= p.da
        if (p.y < -5 || p.a <= 0) {
          p.x = Math.random() * W; p.y = H + 5
          p.a = 0.4 + Math.random() * 0.6; p.da = 0.004 + Math.random() * 0.008
        }
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // Clock hands angles
  const now = new Date()
  const hAngle = ((now.getHours() % 12) / 12) * 360 + (now.getMinutes() / 60) * 30
  const mAngle = (now.getMinutes() / 60) * 360 + (now.getSeconds() / 60) * 6
  const sAngle = (now.getSeconds() / 60) * 360

  // Photo ring positions
  const photoRing = photos.slice(0, 8)

  return (
    <>
      <style>{`
        .clock-wrap {
          min-height: 100%;
          background: linear-gradient(160deg, #1a0a2e 0%, #2d1457 40%, #6b1a6e 80%, #e8466a 100%);
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 70px 20px 120px;
        }
        .clock-particles {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .clock-title {
          font-family: var(--font-display);
          font-size: 28px;
          color: white;
          text-align: center;
          margin-bottom: 6px;
          position: relative;
          z-index: 1;
        }
        .clock-subtitle {
          font-family: var(--font-body);
          font-size: 13px;
          color: rgba(255,255,255,0.55);
          text-align: center;
          margin-bottom: 32px;
          position: relative;
          z-index: 1;
        }

        /* ---- SVG clock ---- */
        .clock-svg-wrap {
          position: relative;
          width: 280px;
          height: 280px;
          z-index: 1;
        }
        .clock-svg { width: 280px; height: 280px; }

        /* Photo ring */
        .photo-ring-img {
          position: absolute;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid rgba(255,255,255,0.8);
          box-shadow: 0 2px 12px rgba(0,0,0,0.4);
        }
        .photo-ring-placeholder {
          position: absolute;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(255,255,255,0.12);
          border: 2px dashed rgba(255,255,255,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }

        /* ---- Time breakdown cards ---- */
        .clock-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          width: 100%;
          max-width: 320px;
          margin-top: 32px;
          position: relative;
          z-index: 1;
        }
        .clock-card {
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 18px;
          padding: 16px;
          text-align: center;
          animation: fadeInUp 0.5s ease both;
        }
        @keyframes fadeInUp {
          from { opacity:0; transform: translateY(16px); }
          to   { opacity:1; transform: translateY(0); }
        }
        .clock-card-val {
          font-family: var(--font-display);
          font-size: 34px;
          font-weight: 700;
          color: white;
          line-height: 1;
        }
        .clock-card-lbl {
          font-family: var(--font-body);
          font-size: 11px;
          color: rgba(255,255,255,0.55);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-top: 4px;
        }

        /* ---- Live clock ---- */
        .clock-live {
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 20px;
          padding: 14px 28px;
          margin-top: 14px;
          font-family: 'Courier New', monospace;
          font-size: 32px;
          font-weight: 700;
          color: white;
          letter-spacing: 4px;
          position: relative;
          z-index: 1;
          text-align: center;
        }
        .clock-total {
          margin-top: 10px;
          font-family: var(--font-body);
          font-size: 14px;
          color: rgba(255,255,255,0.6);
          text-align: center;
          position: relative;
          z-index: 1;
        }
      `}</style>

      <canvas ref={canvasRef} className="clock-particles" />

      <div className="clock-wrap">
        <div className="clock-title">Часы любви ❤️</div>
        <div className="clock-subtitle">с 17 октября 2025 года</div>

        {/* SVG Analog Clock */}
        <div className="clock-svg-wrap">
          {/* Photo ring */}
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * 2 * Math.PI - Math.PI / 2
            const R = 126
            const cx = 140 + R * Math.cos(angle) - 22
            const cy = 140 + R * Math.sin(angle) - 22
            const photo = photoRing[i]
            return photo ? (
              <img key={i} className="photo-ring-img" src={photo} alt="" style={{ left: cx, top: cy }} />
            ) : (
              <div key={i} className="photo-ring-placeholder" style={{ left: cx, top: cy }}>💕</div>
            )
          })}

          <svg className="clock-svg" viewBox="0 0 280 280">
            {/* Outer glow ring */}
            <circle cx="140" cy="140" r="100" fill="none" stroke="rgba(232,70,106,0.25)" strokeWidth="2" />
            <circle cx="140" cy="140" r="88" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

            {/* Hour markers */}
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i / 12) * 2 * Math.PI - Math.PI / 2
              const x1 = 140 + 80 * Math.cos(a), y1 = 140 + 80 * Math.sin(a)
              const x2 = 140 + 72 * Math.cos(a), y2 = 140 + 72 * Math.sin(a)
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.45)" strokeWidth={i % 3 === 0 ? 2 : 1} strokeLinecap="round" />
            })}

            {/* Hour hand — heart tip */}
            <g transform={`rotate(${hAngle}, 140, 140)`}>
              <line x1="140" y1="140" x2="140" y2="82" stroke="white" strokeWidth="4" strokeLinecap="round" />
              <text x="140" y="76" textAnchor="middle" fontSize="14" fill="#ff6b8a">❤️</text>
            </g>
            {/* Minute hand */}
            <g transform={`rotate(${mAngle}, 140, 140)`}>
              <line x1="140" y1="140" x2="140" y2="66" stroke="rgba(255,180,210,0.9)" strokeWidth="3" strokeLinecap="round" />
              <text x="140" y="60" textAnchor="middle" fontSize="11" fill="#ffb6d9">🩷</text>
            </g>
            {/* Second hand */}
            <g transform={`rotate(${sAngle}, 140, 140)`}>
              <line x1="140" y1="160" x2="140" y2="58" stroke="#ff6b8a" strokeWidth="1.5" strokeLinecap="round" />
            </g>
            {/* Centre dot */}
            <circle cx="140" cy="140" r="5" fill="white" />
            <circle cx="140" cy="140" r="2.5" fill="#e8466a" />
          </svg>
        </div>

        {/* Live digital */}
        <div className="clock-live">
          {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(time.seconds)}
        </div>
        <div className="clock-total">{time.totalDays} дней вместе</div>

        {/* Breakdown grid */}
        <div className="clock-grid">
          {time.years > 0 && (
            <div className="clock-card" style={{ animationDelay: '0s' }}>
              <div className="clock-card-val">{time.years}</div>
              <div className="clock-card-lbl">лет</div>
            </div>
          )}
          <div className="clock-card" style={{ animationDelay: '0.05s' }}>
            <div className="clock-card-val">{time.months}</div>
            <div className="clock-card-lbl">месяцев</div>
          </div>
          <div className="clock-card" style={{ animationDelay: '0.1s' }}>
            <div className="clock-card-val">{time.weeks}</div>
            <div className="clock-card-lbl">недель</div>
          </div>
          <div className="clock-card" style={{ animationDelay: '0.15s' }}>
            <div className="clock-card-val">{time.days}</div>
            <div className="clock-card-lbl">дней</div>
          </div>
          <div className="clock-card" style={{ animationDelay: '0.2s' }}>
            <div className="clock-card-val">{pad(time.hours)}</div>
            <div className="clock-card-lbl">часов</div>
          </div>
          <div className="clock-card" style={{ animationDelay: '0.25s' }}>
            <div className="clock-card-val">{pad(time.minutes)}</div>
            <div className="clock-card-lbl">минут</div>
          </div>
        </div>
      </div>
    </>
  )
}
