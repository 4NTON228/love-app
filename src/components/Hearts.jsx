import { useState, useEffect } from 'react'

const heartEmojis = ['❤️', '💕', '💗', '💖', '💝', '🩷', '💘']

export default function Hearts() {
  const [hearts, setHearts] = useState([])

  useEffect(() => {
    const interval = setInterval(() => {
      const newHeart = {
        id: Date.now() + Math.random(),
        left: Math.random() * 100,
        emoji: heartEmojis[Math.floor(Math.random() * heartEmojis.length)],
        duration: 8 + Math.random() * 12,
        size: 14 + Math.random() * 16,
        delay: Math.random() * 2
      }

      setHearts(prev => {
        const updated = [...prev, newHeart]
        // Максимум 8 сердечек одновременно
        return updated.slice(-8)
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="hearts-container">
      {hearts.map(heart => (
        <div
          key={heart.id}
          className="floating-heart"
          style={{
            left: `${heart.left}%`,
            fontSize: `${heart.size}px`,
            animationDuration: `${heart.duration}s`,
            animationDelay: `${heart.delay}s`
          }}
        >
          {heart.emoji}
        </div>
      ))}
    </div>
  )
}
