import { useState, useEffect } from 'react'

const heartShapes = [
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
]

const gradients = [
  ['#FF6B8A', '#FF2D55'],
  ['#F472B6', '#DB2777'],
  ['#C084FC', '#9333EA'],
  ['#818CF8', '#6366F1'],
]

export default function FloatingHearts() {
  const [hearts, setHearts] = useState([])

  useEffect(() => {
    const interval = setInterval(() => {
      const newHeart = {
        id: Date.now() + Math.random(),
        left: 5 + Math.random() * 90,
        size: 16 + Math.random() * 24,
        duration: 10 + Math.random() * 10,
        delay: Math.random() * 2,
        gradient: gradients[Math.floor(Math.random() * gradients.length)],
        opacity: 0.3 + Math.random() * 0.4,
      }

      setHearts(prev => [...prev.slice(-6), newHeart])
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 0,
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes floatHeart {
          0% {
            transform: translateY(100vh) rotate(0deg) scale(0.5);
            opacity: 0;
          }
          10% {
            opacity: var(--heart-opacity);
          }
          90% {
            opacity: var(--heart-opacity);
          }
          100% {
            transform: translateY(-20vh) rotate(360deg) scale(0.3);
            opacity: 0;
          }
        }
      `}</style>
      
      {hearts.map(heart => (
        <svg
          key={heart.id}
          viewBox="0 0 24 24"
          style={{
            position: 'absolute',
            left: `${heart.left}%`,
            bottom: '-50px',
            width: `${heart.size}px`,
            height: `${heart.size}px`,
            animation: `floatHeart ${heart.duration}s ease-in forwards`,
            animationDelay: `${heart.delay}s`,
            filter: 'blur(0.5px)',
            '--heart-opacity': heart.opacity,
          }}
        >
          <defs>
            <linearGradient id={`grad-${heart.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={heart.gradient[0]} />
              <stop offset="100%" stopColor={heart.gradient[1]} />
            </linearGradient>
          </defs>
          <path
            d={heartShapes[0]}
            fill={`url(#grad-${heart.id})`}
            opacity="0.8"
          />
        </svg>
      ))}
    </div>
  )
}
