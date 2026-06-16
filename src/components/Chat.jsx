import { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { sendPushNotification } from '../lib/push'
import { useCrypto } from '../hooks/useCrypto'
import { encryptMessage, safeDecryptWithKeys, isMessageEncrypted } from '../lib/crypto'

const REACTIONS = ['❤️','🔥','😍','😂','👍','💔']
const VALID_REACTIONS = new Set(REACTIONS)
const GROUP_DIFF_SECONDS = 121
const GRAD = 'var(--bubble-mine, linear-gradient(135deg, #C8334A, #8B1A2C))'
const WAVE_H = [
  3,5,8,6,4,7,11,15,19,22,17,13,8,5,7,12,18,24,28,24,19,14,9,
  6,4,8,13,19,25,30,26,21,16,11,7,5,9,15,21,27,30,25,19,13,8,
  5,8,13,18,22,26,22,17,12,7,4,6,10,14,18,13,8,5
]

/* ─────────────────────────────────────────────────────────────────────────────
 * UTILS
 * ──────────────────────────────────────────────────────────────────────────── */
function pad(n) { return String(n).padStart(2,'0') }

function fmtTime(d) {
  const dt = new Date(d)
  return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

function fmtDateSep(d) {
  const dt = new Date(d)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (dt.toDateString() === now.toDateString()) return 'Сегодня'
  if (dt.toDateString() === yesterday.toDateString()) return 'Вчера'
  return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function diffDate(a, b) {
  return new Date(a).toDateString() !== new Date(b).toDateString()
}

function fmtDuration(sec) {
  if (!sec) return '0:00'
  const mins = Math.floor(sec / 60)
  const secs = sec % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function _fmtRecordTime(sec) {
  const mins = Math.floor(sec / 60)
  const secs = sec % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function fmtLastSeen(ts) {
  if (!ts) return 'не в сети'
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return 'в сети'
  if (diff < 3600) return `был(а) ${Math.floor(diff / 60)} мин. назад`
  if (diff < 86400) return `был(а) ${Math.floor(diff / 3600)} ч. назад`
  return 'был(а) давно'
}

function isOnline(ts) {
  if (!ts) return false
  return (Date.now() - new Date(ts).getTime()) < 120000
}

function isSameGroup(msg1, msg2) {
  if (!msg1 || !msg2) return false
  if (msg1.user_id !== msg2.user_id) return false
  const diff = Math.abs(new Date(msg2.created_at) - new Date(msg1.created_at)) / 1000
  return diff <= GROUP_DIFF_SECONDS
}

function isLastInGroup(msg, nextMsg) {
  return !isSameGroup(msg, nextMsg)
}

function isFirstInGroup(msg, prevMsg) {
  return !isSameGroup(prevMsg, msg)
}

function needAvatar(msg, nextMsg, uid) {
  if (msg.user_id === uid) return false
  if (!nextMsg) return true
  if (nextMsg.user_id !== msg.user_id) return true
  if (diffDate(msg.created_at, nextMsg.created_at)) return true
  return false
}

function _shouldShowAvatar(msg, nextMsg) {
  if (!nextMsg) return true
  if (nextMsg.user_id !== msg.user_id) return true
  if (diffDate(msg.created_at, nextMsg.created_at)) return true
  return false
}

function hasValidReactions(reactions) {
  if (!reactions) return false
  const validKeys = Object.keys(reactions).filter(k => VALID_REACTIONS.has(k))
  return validKeys.length > 0
}

function parseText(text) {
  if (!text) return ''
  let s = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(200,51,74,0.1);border-radius:4px;padding:1px 5px;font-family:monospace;font-size:13px">$1</code>')
    .replace(/\[(.+?)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#C8334A;text-decoration:underline">$1</a>')
    .replace(/^&gt; (.+)$/gm, '<blockquote style="border-left:3px solid #C8334A;margin:4px 0;padding:2px 8px;opacity:0.8">$1</blockquote>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#C8334A;text-decoration:underline">$1</a>')
}

async function compressImage(file) {
  return new Promise(resolve => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.src = objectUrl
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement('canvas')
      const maxSize = 1280
      let width = img.width
      let height = img.height
      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width)
        width = maxSize
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height)
        height = maxSize
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    }
  })
}

/* ─────────────────────────────────────────────────────────────────────────────
 * COMPONENTS
 * ──────────────────────────────────────────────────────────────────────────── */

function Avatar({ url, size }) {
  const [err, setErr] = useState(false)
  const s = size || 40
  return (
    <div style={{
      width: s, height: s, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
      background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      {url && !err
        ? <img src={url} onError={() => setErr(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <svg viewBox="0 0 40 40" width={s} height={s} fill="none">
            <circle cx="20" cy="15" r="7" fill="rgba(255,255,255,.85)" />
            <path d="M5 37c0-8.3 6.7-15 15-15s15 6.7 15 15" fill="rgba(255,255,255,.65)" />
          </svg>
      }
    </div>
  )
}

const VideoCircle = memo(function VideoCircle({ url, isMine, time, readAt }) {
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded]     = useState(false)
  const videoRef      = useRef(null)
  const touchStart    = useRef(0)

  function toggle() {
    const v = videoRef.current
    if (!v) return
    if (playing) {
      v.pause()
      setPlaying(false)
    } else {
      if (ended) { v.currentTime = 0; setEnded(false) }
      v.play().catch(() => {})
      setPlaying(true)
    }
  }

  useEffect(() => () => videoRef.current?.pause(), [])

  const showOverlay = !playing

  return (
    <div
      onTouchStart={_e => { touchStart.current = Date.now() }}
      onTouchEnd={e => {
        const dur = Date.now() - touchStart.current
        if (dur < 400) { e.stopPropagation(); toggle() }
        // долгое нажатие — не перехватываем, родитель откроет контекстное меню
      }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); toggle() }}
      style={{
        position: 'relative', display: 'inline-block',
        cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      {/* круг */}
      <div style={{
        width: 180, height: 180, borderRadius: '50%', overflow: 'hidden',
        border: `2.5px solid ${isMine ? '#C8334A' : 'rgba(200,51,74,0.35)'}`,
        boxShadow: '0 2px 16px rgba(0,0,0,0.22)'
      }}>
        <video
          ref={videoRef}
          src={url}
          playsInline
          preload="metadata"
          onEnded={() => { setPlaying(false); setEnded(true) }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>

      {/* overlay: play / replay */}
      {showOverlay && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'rgba(0,0,0,0.32)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 2px rgba(255,255,255,0.18)'
          }}>
            {ended
              ? /* replay icon */
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10"/>
                    <path d="M3.51 15a9 9 0 1 0 .49-4.65"/>
                  </svg>
              : /* play icon */
                <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
                    <polygon points="7,4 20,12 7,20"/>
                  </svg>
            }
          </div>
        </div>
      )}

      {/* время + галочки */}
      <div style={{
        position: 'absolute', bottom: 12, right: 14,
        background: 'rgba(0,0,0,0.55)', borderRadius: 6,
        padding: '2px 7px', fontSize: 10, color: 'white', pointerEvents: 'none',
        fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4
      }}>
        {time}
        {isMine && (
          readAt
            ? <svg viewBox="0 0 20 9" width="18" height="8" fill="none">
                <path d="M1 4.5l3 3L11 1" stroke="#4FC3F7" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 4.5l3 3L17 1" stroke="#4FC3F7" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            : <svg viewBox="0 0 20 9" width="18" height="8" fill="none">
                <path d="M1 4.5l3 3L11 1" stroke="rgba(255,255,255,0.8)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 4.5l3 3L17 1" stroke="rgba(255,255,255,0.4)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
        )}
      </div>
    </div>
  )
})

const VoiceMessage = memo(function VoiceMessage({ url, isMine, dark, duration, time, readAt }) {
  const [playing, setPlaying]   = useState(false)
  const [progress, setProgress] = useState(0)
  const audioRef = useRef(null)
  const MUTED_C = dark ? '#8A5060' : '#9A6070'
  const BAR_W = 2, BAR_GAP = 1, BAR_MAX_H = 28
  const svgW = WAVE_H.length * (BAR_W + BAR_GAP)

  function toggle() {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else {
      a.play().catch(err => console.error('audio play error:', err))
    }
  }
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onPlay    = () => setPlaying(true)
    const onPause   = () => setPlaying(false)
    const onEnded   = () => { setPlaying(false); setProgress(0) }
    const onTimeUpd = () => setProgress(a.currentTime / (a.duration || 1))
    a.addEventListener('play',       onPlay)
    a.addEventListener('pause',      onPause)
    a.addEventListener('ended',      onEnded)
    a.addEventListener('timeupdate', onTimeUpd)
    return () => {
      a.pause()
      a.removeEventListener('play',       onPlay)
      a.removeEventListener('pause',      onPause)
      a.removeEventListener('ended',      onEnded)
      a.removeEventListener('timeupdate', onTimeUpd)
    }
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 14px 8px 10px', borderRadius: 18, minWidth: 220,
      background: isMine ? 'var(--bubble-mine, linear-gradient(135deg, #C8334A, #8B1A2C))' : (dark ? '#1E0A10' : '#fff'),
      border: isMine ? 'none' : '0.5px solid rgba(200,51,74,0.15)' }}>
      {/* скрытый audio элемент — нужен для надёжного воспроизведения на iOS */}
      <audio ref={audioRef} src={url} preload="none" style={{ display: 'none' }} />
      <button onClick={toggle} style={{ width: 36, height: 36, borderRadius: '50%',
        border: 'none', cursor: 'pointer', flexShrink: 0,
        background: isMine ? 'rgba(255,255,255,0.22)' : 'rgba(200,51,74,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill={isMine ? 'white' : '#C8334A'}>
          {playing
            ? <><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>
            : <polygon points="5,3 19,12 5,21"/>}
        </svg>
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <svg viewBox={`0 0 ${svgW} ${BAR_MAX_H}`} width={svgW} height={BAR_MAX_H} style={{ display: 'block', maxWidth: '100%' }}>
          {WAVE_H.map((h, i) => (
            <rect
              key={i}
              x={i * (BAR_W + BAR_GAP)}
              y={BAR_MAX_H - h}
              width={BAR_W}
              height={h}
              rx={1}
              fill={
                progress * WAVE_H.length > i
                  ? (isMine ? 'rgba(255,255,255,0.92)' : '#C8334A')
                  : (isMine ? 'rgba(255,255,255,0.30)' : 'rgba(200,51,74,0.22)')
              }
            />
          ))}
        </svg>
        <div style={{ fontSize: 10, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4,
          color: isMine ? 'rgba(255,255,255,0.65)' : MUTED_C }}>
          <span>{fmtDuration(duration || 0)} · {time}</span>
          {isMine && (
            readAt
              ? <svg viewBox="0 0 20 9" width="18" height="8" fill="none">
                  <path d="M1 4.5l3 3L11 1" stroke="#4FC3F7" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 4.5l3 3L17 1" stroke="#4FC3F7" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              : <svg viewBox="0 0 20 9" width="18" height="8" fill="none">
                  <path d="M1 4.5l3 3L11 1" stroke="rgba(255,255,255,0.7)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 4.5l3 3L17 1" stroke="rgba(255,255,255,0.35)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
          )}
        </div>
      </div>
    </div>
  )
})

const ReplyPreview = memo(function ReplyPreview({ msg, isMine, dark, uid, partnerName }) {
  const MUTED_C = dark ? '#8A5060' : '#9A6070'
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 5,
      borderLeft: '3px solid #C8334A', paddingLeft: 8, opacity: 0.82 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: '#C8334A', fontWeight: 600, marginBottom: 1 }}>
          {msg.user_id === uid ? 'Вы' : (partnerName || 'Партнёр')}
        </div>
        <div style={{ fontSize: 12, color: isMine ? 'rgba(255,255,255,0.72)' : MUTED_C,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {msg.photo_url && !msg.text ? 'Фото' : (msg.text || '')}
        </div>
      </div>
      {msg.photo_url && (
        <img src={msg.photo_url} style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}/>
      )}
    </div>
  )
})

const Reactions = memo(function Reactions({ reactions, uid, onReact, msgId, isMine, dark }) {
  const valid = Object.entries(reactions).filter(([e]) => VALID_REACTIONS.has(e))
  if (valid.length === 0) return null

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3,
      justifyContent: isMine ? 'flex-end' : 'flex-start'
    }}>
      {valid.map(([emoji, users]) => users.length > 0 && (
        <button
          key={emoji}
          onClick={() => onReact(msgId, emoji)}
          style={{
            background: users.includes(uid)
              ? 'rgba(200,51,74,0.2)'
              : (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
            border: users.includes(uid)
              ? '1px solid rgba(200,51,74,0.5)'
              : '1px solid transparent',
            borderRadius: 999, padding: '3px 10px', fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {emoji}
          <span style={{ fontSize: 11, color: dark ? '#C4909A' : '#9A6070' }}>
            {users.length}
          </span>
        </button>
      ))}
    </div>
  )
})

const TextBubble = memo(function TextBubble({ msg, isMine, dark, radius, bg, color, replyData, uid, partnerName, onPhotoOpen }) {
  const onlyPhoto = msg.photo_url && !msg.text && !msg._decryptFailed
  if (msg._decryptFailed) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 12px', background: bg, borderRadius: radius,
        border: '0.5px solid rgba(200,51,74,0.3)', maxWidth: '72vw',
        fontSize: 13, color: dark ? 'rgba(245,232,234,0.5)' : 'rgba(28,10,14,0.45)',
        fontStyle: 'italic',
      }}>
        🔒 Не удалось расшифровать сообщение
      </div>
    )
  }
  return (
    <div style={{
      display: 'inline-block',
      padding: onlyPhoto && !replyData ? 3 : '10px 14px 8px',
      background: bg,
      color: color,
      borderRadius: radius,
      border: isMine ? 'none' : `0.5px solid rgba(200,51,74,0.15)`,
      boxShadow: dark ? '0 1px 4px rgba(0,0,0,0.18)' : '0 1px 4px rgba(0,0,0,0.08)',
      fontSize: 15, lineHeight: 1.45,
      wordBreak: 'break-word', whiteSpace: 'pre-wrap',
      maxWidth: '72vw',
      animation: 'msgIn 0.2s ease both',
    }}>
      {replyData && (
        <ReplyPreview msg={replyData} isMine={isMine} dark={dark} uid={uid} partnerName={partnerName} />
      )}
      {msg.photo_url && (
        <img
          src={msg.photo_url}
          alt=""
          loading="lazy"
          onClick={e => { e.stopPropagation(); onPhotoOpen?.(msg.photo_url) }}
          onError={e => { e.target.style.display = 'none' }}
          style={{
            maxWidth: '100%', maxHeight: 280,
            borderRadius: msg.text ? 10 : 14,
            display: 'block', marginBottom: msg.text ? 6 : 0,
            marginTop: replyData ? 6 : 0,
            cursor: 'pointer',
          }}
        />
      )}
      {msg.text && (
        <span dangerouslySetInnerHTML={{ __html: parseText(msg.text) }} />
      )}
      <div style={{
        fontSize: 10, opacity: 0.65, textAlign: 'right', marginTop: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3
      }}>
        {msg.edited_at && <span style={{ fontSize: 10 }}>ред.</span>}
        {fmtTime(msg.created_at)}
        {isMine && (
          msg.read_at
            ? <svg viewBox="0 0 20 9" width="20" height="9" fill="none">
                <path d="M1 4.5l3 3L11 1" stroke="#4FC3F7" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 4.5l3 3L17 1" stroke="#4FC3F7" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            : <svg viewBox="0 0 20 9" width="20" height="9" fill="none">
                <path d="M1 4.5l3 3L11 1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 4.5l3 3L17 1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
              </svg>
        )}
      </div>
    </div>
  )
})

const Message = memo(function Message({
  msg, isMine, dark, uid, partnerName, partnerAvatar: _partnerAvatar,
  onLongPress, onReact, onReply, onPhotoOpen,
  isFirst: _isFirst, isLast, showAv: _showAv,
  messages,
}) {
  const readAt = msg.read_at || null
  const timerRef    = useRef(null)
  const movedRef    = useRef(false)
  const posRef      = useRef({ x: 0, y: 0 })
  const lastTap     = useRef(0)
  const bubbleRef   = useRef(null)
  const swipeStartX = useRef(0)
  const swipingRef  = useRef(false)
  const isTouchRef  = useRef(false)
  const [swipeDx, setSwipeDx] = useState(0)

  const replyData = useMemo(() =>
    msg.reply_to_id ? (messages?.find(m => m.id === msg.reply_to_id) || null) : null
  , [msg.reply_to_id, messages])

  const radius = isMine
    ? (isLast ? '18px 18px 4px 18px' : '18px 18px 8px 18px')
    : (isLast ? '18px 18px 18px 4px' : '18px 18px 18px 8px')

  const bubbleBg    = isMine ? 'var(--bubble-mine, linear-gradient(135deg, #C8334A, #8B1A2C))' : (dark ? '#1E0A10' : '#FFFFFF')
  const bubbleColor = isMine ? 'white' : (dark ? '#F5E8EA' : '#1C0A0E')

  function startPress(x, y) {
    movedRef.current = false
    posRef.current = { x, y }
    timerRef.current = setTimeout(() => {
      if (!movedRef.current) {
        navigator.vibrate?.(8)
        onLongPress(msg)
      }
    }, 490)
  }
  function onMovePress(e) {
    const t = e.touches?.[0] || e
    if (Math.abs(t.clientX - posRef.current.x) > 10 || Math.abs(t.clientY - posRef.current.y) > 10) {
      movedRef.current = true
      clearTimeout(timerRef.current)
    }
  }
  function endPress() { clearTimeout(timerRef.current) }
  function handleTap() {
    const now = Date.now()
    if (now - lastTap.current < 300) onReact(msg.id, '❤️')
    lastTap.current = now
  }

  // swipe to reply
  function onSwipeStart(e) {
    swipeStartX.current = e.touches[0].clientX
    swipingRef.current = true
  }
  function onSwipeMove(e) {
    if (!swipingRef.current) return
    const dx = e.touches[0].clientX - swipeStartX.current
    const rightDir = isMine ? dx < 0 : dx > 0
    if (!rightDir) return
    const clamped = Math.min(Math.abs(dx), 68) * (isMine ? -1 : 1)
    setSwipeDx(clamped)
    if (bubbleRef.current) bubbleRef.current.style.transform = `translateX(${clamped}px)`
  }
  function onSwipeEnd() {
    if (!swipingRef.current) return
    swipingRef.current = false
    if (Math.abs(swipeDx) >= 55) {
      navigator.vibrate?.(10)
      onReply?.(msg.id)
    }
    setSwipeDx(0)
    if (bubbleRef.current) {
      bubbleRef.current.style.transition = 'transform 0.2s cubic-bezier(0.25,1,0.5,1)'
      bubbleRef.current.style.transform  = 'translateX(0)'
      setTimeout(() => { if (bubbleRef.current) bubbleRef.current.style.transition = '' }, 220)
    }
  }

  return (
    <div style={{ position: 'relative', WebkitUserSelect: 'none', userSelect: 'none' }}>
      {/* reply arrow hint */}
      {Math.abs(swipeDx) > 18 && (
        <div style={{
          position: 'absolute', top: '50%', transform: 'translateY(-50%)',
          [isMine ? 'right' : 'left']: Math.abs(swipeDx) + 6,
          width: 26, height: 26, borderRadius: '50%',
          background: 'rgba(200,51,74,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: Math.min(Math.abs(swipeDx) / 55, 1),
          pointerEvents: 'none', zIndex: 1,
        }}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#C8334A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 17 4 12 9 7"/><line x1="20" y1="12" x2="4" y2="12"/>
          </svg>
        </div>
      )}

      <div
        ref={bubbleRef}
        onTouchStart={e => { isTouchRef.current = true; const t = e.touches[0]; startPress(t.clientX, t.clientY); onSwipeStart(e) }}
        onTouchMove={e => { onMovePress(e); onSwipeMove(e) }}
        onTouchEnd={() => { endPress(); handleTap(); onSwipeEnd(); setTimeout(() => { isTouchRef.current = false }, 500) }}
        onTouchCancel={() => { endPress(); onSwipeEnd(); setTimeout(() => { isTouchRef.current = false }, 500) }}
        onMouseDown={e => { if (!isTouchRef.current) startPress(e.clientX, e.clientY) }}
        onMouseMove={e => { if (!isTouchRef.current) onMovePress(e) }}
        onMouseUp={() => { if (!isTouchRef.current) { endPress(); handleTap() } }}
        onMouseLeave={endPress}
        onContextMenu={e => { e.preventDefault(); onLongPress(msg) }}
      >
        {msg.is_video_circle && msg.video_url ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: isMine ? 'flex-end' : 'flex-start' }}>
            {replyData && (
              <div style={{
                padding: '7px 12px', borderRadius: 14, maxWidth: 220,
                background: isMine ? 'linear-gradient(135deg,#C8334A,#8B1A2C)' : (dark ? '#1E0A10' : '#fff'),
                border: isMine ? 'none' : '0.5px solid rgba(200,51,74,0.15)',
              }}>
                <ReplyPreview msg={replyData} isMine={isMine} dark={dark} uid={uid} partnerName={partnerName} />
              </div>
            )}
            <VideoCircle url={msg.video_url} isMine={isMine} time={fmtTime(msg.created_at)} readAt={readAt} />
          </div>
        ) : msg.is_voice && msg.audio_url ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {replyData && (
              <div style={{
                padding: '7px 12px', borderRadius: 14, maxWidth: 240,
                background: isMine ? 'linear-gradient(135deg,#C8334A,#8B1A2C)' : (dark ? '#1E0A10' : '#fff'),
                border: isMine ? 'none' : '0.5px solid rgba(200,51,74,0.15)',
              }}>
                <ReplyPreview msg={replyData} isMine={isMine} dark={dark} uid={uid} partnerName={partnerName} />
              </div>
            )}
            <VoiceMessage url={msg.audio_url} isMine={isMine} duration={msg.duration} time={fmtTime(msg.created_at)} dark={dark} readAt={readAt} />
          </div>
        ) : (
          <TextBubble
            msg={msg} isMine={isMine} dark={dark} radius={radius} bg={bubbleBg} color={bubbleColor}
            replyData={replyData} uid={uid} partnerName={partnerName} onPhotoOpen={onPhotoOpen}
          />
        )}

        {hasValidReactions(msg.reactions) && (
          <Reactions reactions={msg.reactions} uid={uid} onReact={onReact} msgId={msg.id} isMine={isMine} dark={dark} />
        )}
      </div>
    </div>
  )
})

const PhotoLightbox = memo(function PhotoLightbox({ url, onClose }) {
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.93)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <img
        src={url}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '96vw', maxHeight: '88dvh', borderRadius: 12, objectFit: 'contain' }}
      />
      <button onClick={onClose} style={{
        position: 'absolute', top: 'max(16px, env(safe-area-inset-top, 16px))', right: 16,
        width: 36, height: 36, borderRadius: '50%',
        background: 'rgba(255,255,255,0.14)', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
})

const ContextMenu = memo(function ContextMenu({ menu, dark, onClose, onEdit, onDelete, onPin, onCopy: _onCopy, onReply, onReact }) {
  if (!menu) return null

  const menuBg    = dark ? '#1E0A10' : '#fff'
  const menuColor = dark ? '#F5E8EA' : '#1C0A0E'
  const divColor  = dark ? 'rgba(232,85,106,0.1)' : 'rgba(200,51,74,0.08)'

  const btnStyle = {
    width: '100%', padding: '13px 18px',
    display: 'flex', alignItems: 'center', gap: 13,
    background: 'none', border: 'none', borderBottom: `0.5px solid ${divColor}`,
    cursor: 'pointer', fontSize: 15, color: menuColor,
    textAlign: 'left', fontFamily: 'inherit',
  }

  const Icon = ({ d, stroke }) => (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={stroke || '#C8334A'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 301,
        background: menuBg,
        borderRadius: 22,
        overflow: 'hidden',
        minWidth: 252,
        maxWidth: 'calc(100vw - 48px)',
        boxShadow: dark
          ? '0 16px 56px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(232,85,106,0.18)'
          : '0 16px 56px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(200,51,74,0.12)',
        animation: 'ctxIn 0.18s cubic-bezier(0.34,1.56,0.64,1) both'
      }}>
        {/* Реакции */}
        <div style={{
          display: 'flex', justifyContent: 'space-around',
          padding: '12px 8px 10px',
          borderBottom: `0.5px solid ${divColor}`,
        }}>
          {REACTIONS.map(r => (
            <button
              key={r}
              onClick={() => { onReact(menu.msgId, r); onClose() }}
              style={{ fontSize: 24, padding: '4px 6px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 10, transition: 'transform 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.35)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
            >{r}</button>
          ))}
        </div>

        {/* Действия */}
        <button style={btnStyle} onClick={() => { onReply(menu.msgId); onClose() }}>
          <Icon d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          Ответить
        </button>

        {menu.isMe && menu.text && (
          <button style={btnStyle} onClick={() => { onEdit(menu.msgId, menu.text); onClose() }}>
            <Icon d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z" />
            Редактировать
          </button>
        )}

        {menu.text && (
          <button style={btnStyle} onClick={() => { navigator.clipboard?.writeText(menu.text); onClose() }}>
            <Icon d="M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2M16 2H8a2 2 0 00-2 2v0a2 2 0 002 2h8a2 2 0 002-2v0a2 2 0 00-2-2z" />
            Копировать
          </button>
        )}

        <button
          style={{ ...btnStyle, borderBottom: menu.isMe ? `0.5px solid ${divColor}` : 'none' }}
          onClick={() => { onPin(menu.msgId); onClose() }}
        >
          <Icon d="M12 17v5M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17z" />
          {menu.isPinned ? 'Открепить' : 'Закрепить'}
        </button>

        {menu.isMe && (
          <button
            style={{ ...btnStyle, color: '#E0404A', borderBottom: 'none' }}
            onClick={() => { onDelete(menu.msgId); onClose() }}
          >
            <Icon d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="#E0404A" />
            Удалить
          </button>
        )}
      </div>
    </>
  )
})

const SearchOverlay = memo(function SearchOverlay({ messages, dark, onClose }) {
  const [query, setQuery] = useState('')
  const [idx, setIdx]     = useState(0)

  const SURF_S  = dark ? '#1E0A10' : '#FFFFFF'
  const INK_S   = dark ? '#F5E8EA' : '#1C0A0E'
  const MUTED_S = dark ? '#8A5060' : '#9A6070'
  const BDR_S   = dark ? 'rgba(232,85,106,0.18)' : 'rgba(200,51,74,0.13)'

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return messages.filter(m => m.text?.toLowerCase().includes(q))
  }, [query, messages])

  const goTo = useCallback((i) => {
    const msg = results[i]; if (!msg) return
    setIdx(i)
    document.querySelector(`[data-msg-id="${msg.id}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [results])

  useEffect(() => {
    const fn = e => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowUp')   { e.preventDefault(); goTo(Math.max(0, idx - 1)) }
      if (e.key === 'ArrowDown') { e.preventDefault(); goTo(Math.min(results.length - 1, idx + 1)) }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [idx, results.length, onClose, goTo])

  function highlight(text) {
    if (!text || !query.trim()) return text || ''
    const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return text.replace(new RegExp(`(${safe})`, 'gi'),
      '<mark style="background:rgba(200,51,74,0.3);border-radius:2px;padding:0 1px">$1</mark>')
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: SURF_S, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `0.5px solid ${BDR_S}`, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none',
          cursor: 'pointer', color: '#C8334A', fontSize: 22, lineHeight: 1, padding: '2px 4px' }}>←</button>
        <input autoFocus value={query} onChange={e => { setQuery(e.target.value); setIdx(0) }}
          placeholder="Поиск по сообщениям..."
          style={{ flex: 1, border: 'none', background: 'none', fontSize: 15,
            color: INK_S, outline: 'none', fontFamily: "'DM Sans',sans-serif" }}/>
        {results.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: MUTED_S }}>{idx + 1}/{results.length}</span>
            <button onClick={() => goTo(Math.max(0, idx - 1))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C8334A', fontSize: 18 }}>↑</button>
            <button onClick={() => goTo(Math.min(results.length - 1, idx + 1))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C8334A', fontSize: 18 }}>↓</button>
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {query && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: MUTED_S, fontSize: 14 }}>
            Ничего не найдено
          </div>
        )}
        {results.map((msg, i) => (
          <div key={msg.id} onClick={() => goTo(i)} style={{
            padding: '10px 16px', borderBottom: `0.5px solid ${BDR_S}`,
            background: i === idx ? 'rgba(200,51,74,0.08)' : 'none', cursor: 'pointer' }}>
            <div style={{ fontSize: 11, color: '#C8334A', marginBottom: 3 }}>{fmtDateSep(msg.created_at)}</div>
            <div style={{ fontSize: 14, color: INK_S }}
              dangerouslySetInnerHTML={{ __html: highlight(msg.text) }}/>
          </div>
        ))}
      </div>
    </div>
  )
})

/* ─────────────────────────────────────────────────────────────────────────────
 * ICON BUTTON
 * ──────────────────────────────────────────────────────────────────────────── */
function IconBtn({ onClick, icon, active, glow, onMouseDown, onMouseUp, onTouchStart, onTouchEnd }) {
  const stroke = active ? 'white' : '#C8334A'
  const iconMap = {
    camera: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={stroke} strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
    video:  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={stroke} strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
    mic:    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={stroke} strokeWidth="2"><path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3"/></svg>,
  }
  const baseStyle = {
    width: 36, height: 36, borderRadius: '50%',
    background: active ? 'linear-gradient(135deg, #C8334A, #8B1A2C)' : 'rgba(200,51,74,0.09)',
    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0, transition: 'transform 0.15s',
    animation: glow ? 'glow 1.5s ease-in-out infinite' : 'none'
  }
  const handlers = {}
  if (onMouseDown) handlers.onMouseDown = onMouseDown
  if (onMouseUp)   handlers.onMouseUp   = onMouseUp
  if (onTouchStart) handlers.onTouchStart = onTouchStart
  if (onTouchEnd)  handlers.onTouchEnd  = onTouchEnd
  return <button onClick={onClick} style={baseStyle} {...handlers}>{iconMap[icon]}</button>
}

/* ─────────────────────────────────────────────────────────────────────────────
 * MAIN CHAT COMPONENT
 * ──────────────────────────────────────────────────────────────────────────── */
export default function Chat({ session, profile, darkMode }) {
  const [messages, setMessages] = useState([])
  const [partner, setPartner] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [allLoaded, setAllLoaded] = useState(false)

  const [newText, setNewText] = useState('')
  const [sending, setSending] = useState(false)
  const [showDown, setShowDown] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [partnerRecording, setPartnerRecording] = useState(null) // 'voice' | 'video' | null
  const broadcastRef = useRef(null)

  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [recording, setRecording] = useState(false)
  const [voiceRec, setVoiceRec] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)

  const [editingId, setEditingId] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [ctxMenu, setCtxMenu] = useState(null)
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [partnerLastSeen, setPartnerLastSeen] = useState(null)

  const listRef = useRef(null)
  const endRef = useRef(null)
  const photoRef = useRef(null)
  const videoFileRef = useRef(null)
  const previewVidRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const cancelledRef = useRef(false)
  const typingTimer = useRef(null)
  const recTimer = useRef(null)
  const voiceRecRef = useRef(null)
  const voiceChunks = useRef([])
  const voiceStream = useRef(null)
  const voiceSecRef = useRef(0)
  const voiceCancelledRef = useRef(false)

  // ── E2EE ────────────────────────────────────────────────────────────────────
  const { roomKey, roomKeys } = useCrypto(session, profile)

  // Enrich a raw DB message with decrypted text (mutates a copy, never original)
  const decryptMsg = useCallback(async (m) => {
    if (!isMessageEncrypted(m)) return m
    if (!roomKeys?.length) return { ...m, _decryptFailed: false, _legacy: false }
    const { ok, text } = await safeDecryptWithKeys(m.ciphertext, roomKeys)
    return ok
      ? { ...m, text }          // text field now holds plaintext — no other component changes needed
      : { ...m, text: null, _decryptFailed: true }
  }, [roomKeys])

  const decryptBatch = useCallback(
    (msgs) => Promise.all((msgs || []).map(decryptMsg)),
    [decryptMsg],
  )

  // Долгоживущая realtime-подписка создаётся один раз и иначе захватила бы
  // устаревший decryptMsg (с roomKey=null). Ref всегда указывает на актуальную
  // функцию — поэтому сообщения, пришедшие до готовности ключа шифрования,
  // расшифровываются сразу, а не остаются пустыми до перезагрузки страницы.
  const decryptMsgRef = useRef(decryptMsg)
  useEffect(() => { decryptMsgRef.current = decryptMsg }, [decryptMsg])

  // Re-decrypt all messages whenever the room keys become available / change
  useEffect(() => {
    if (!roomKeys?.length || !messages.length) return
    decryptBatch(messages).then(setMessages)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKeys])
  // ─────────────────────────────────────────────────────────────────────────────

  const dark = darkMode
  const BG = dark ? '#200A10' : '#FBF0F2'
  const SURF = dark ? '#1E0A10' : '#FFFFFF'
  const SURF2 = dark ? '#3D1520' : '#FBF0F2'
  const INK = dark ? '#F5E8EA' : '#1C0A0E'
  const MUTED = dark ? '#8A5060' : '#9A6070'
  const BDR = dark ? 'rgba(232,85,106,0.18)' : 'rgba(200,51,74,0.13)'
  const ROSE = 'var(--rose, #C8334A)'
  const GRAD = 'var(--bubble-mine, linear-gradient(135deg, #C8334A, #8B1A2C))'
  const uid = session?.user?.id
  const pid = profile?.partner_id

  // Фильтр только своей пары (uid + partner_id)
  function applyPairFilter(query) {
    if (pid) return query.or(`user_id.eq.${uid},user_id.eq.${pid}`)
    return query.eq('user_id', uid)
  }

  async function loadMessages() {
    const { data } = await applyPairFilter(
      supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(50)
    )
    const raw = data ? data.reverse() : []
    setMessages(await decryptBatch(raw))
    setLoading(false)
    setTimeout(scrollToBottom, 100)
  }

  async function loadMore() {
    if (loadingMore || allLoaded || !messages.length) return
    setLoadingMore(true)
    const oldest = messages[0].created_at
    const { data } = await applyPairFilter(
      supabase.from('messages').select('*').lt('created_at', oldest)
        .order('created_at', { ascending: false }).limit(50)
    )
    if (!data || data.length < 50) setAllLoaded(true)
    if (data && data.length) {
      const decrypted = await decryptBatch(data.reverse())
      setMessages(prev => [...decrypted, ...prev])
    }
    setLoadingMore(false)
  }

  async function loadPartner() {
    if (!profile?.partner_id) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profile.partner_id)
      .single()
    setPartner(data)
    setPartnerLastSeen(data?.last_seen || null)
  }

  async function updateLastSeen() {
    if (!uid) return
    await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', uid)
  }

  async function markMessagesRead(msgs, partnerId) {
    if (!partnerId) return
    const unread = msgs.filter(m => m.user_id === partnerId && !m.read_at)
    if (!unread.length) return
    await supabase.from('messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unread.map(m => m.id))
  }

  useEffect(() => {
    if (!uid) return
    loadMessages()
    loadPartner()
    updateLastSeen()

    const lastSeenTimer = setInterval(() => {
      if (document.visibilityState === 'visible') updateLastSeen()
    }, 30000)
    const onFocus = () => updateLastSeen()
    const onVisible = () => { if (document.visibilityState === 'visible') updateLastSeen() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)

    const channel = supabase.channel('chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => {
        // Игнорируем сообщения чужих пар
        if (p.new.user_id !== uid && p.new.user_id !== pid) return
        // Decrypt before adding to state (use ref for the current room key)
        decryptMsgRef.current(p.new).then(decrypted => {
          setMessages(prev => {
            if (prev.find(m => m.id === decrypted.id)) return prev
            return [...prev, decrypted]
          })
        })
        // пометить прочитанным — СНАРУЖИ state updater
        if (p.new.user_id !== uid) {
          supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', p.new.id)
        }
        setTimeout(scrollToBottom, 60)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, p => {
        setMessages(prev => prev.filter(m => m.id !== p.old.id))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, p => {
        if (p.new.user_id !== uid && p.new.user_id !== pid) return
        // Re-decrypt on edit (use ref for the current room key)
        decryptMsgRef.current(p.new).then(decrypted => {
          setMessages(prev => prev.map(m => m.id === decrypted.id ? decrypted : m))
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      clearInterval(lastSeenTimer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  // Перезапускаем загрузку + realtime-подписку, когда становится известен
  // partner_id (pid). Иначе при гонке (чат смонтирован до подгрузки пары)
  // фильтр и realtime-обработчик захватывают устаревший pid=null и не
  // показывают сообщения партнёра.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, pid])

  useEffect(() => {
    if (!partner?.id) return

    // Помечаем уже загруженные сообщения как прочитанные
    markMessagesRead(messages, partner.id)

    const typingChannel = supabase.channel(`typing-${partner.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'typing_status',
        filter: `user_id=eq.${partner.id}`
      }, p => setPartnerTyping(p.new?.is_typing ?? false))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles',
        filter: `id=eq.${partner.id}`
      }, p => setPartnerLastSeen(p.new.last_seen))
      .subscribe()

    // Broadcast канал для typing + записи (без задержки DB)
    const bcChannel = supabase.channel(`user-activity`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId === partner.id) setPartnerTyping(!!payload.value)
      })
      .on('broadcast', { event: 'recording' }, ({ payload }) => {
        if (payload.userId === partner.id) setPartnerRecording(payload.kind || null)
      })
      .subscribe()
    broadcastRef.current = bcChannel

    return () => {
      supabase.removeChannel(typingChannel)
      supabase.removeChannel(bcChannel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner?.id])

  // подключаем стрим к превью-видео ПОСЛЕ того как recording=true и элемент отрендерился
  useEffect(() => {
    if (recording && streamRef.current && previewVidRef.current) {
      previewVidRef.current.srcObject = streamRef.current
      previewVidRef.current.muted = true
      previewVidRef.current.play().catch(() => {})
    }
  }, [recording])

  function scrollToBottom() {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function handleScroll() {
    const el = listRef.current
    if (!el) return
    const distToEnd = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowDown(distToEnd > 300)
    if (el.scrollTop < 100 && !loadingMore && !allLoaded) {
      loadMore()
    }
  }

  async function upload(file, folder) {
    const ext = file.name?.split('.').pop() || 'webm'
    const name = `${Date.now()}-${Math.random().toString(36).slice(6)}.${ext}`
    const { error } = await supabase.storage.from('photos').upload(`${folder}/${name}`, file)
    if (error) throw error
    return supabase.storage.from('photos').getPublicUrl(`${folder}/${name}`).data.publicUrl
  }

  async function handleSend() {
    if (!newText.trim() && !photoFile) return
    clearTimeout(typingTimer.current)
    supabase.from('typing_status').upsert({ user_id: uid, is_typing: false, updated_at: new Date().toISOString() })
    setSending(true)
    try {
      let photoUrl = null
      if (photoFile) {
        photoUrl = await upload(photoFile, 'chat')
      }
      if (editingId) {
        await supabase
          .from('messages')
          .update({ text: newText.trim(), edited_at: new Date().toISOString() })
          .eq('id', editingId)
        setEditingId(null)
      } else {
        const plainText = newText.trim() || null
        let msgData = { user_id: uid, photo_url: photoUrl }
        if (replyTo) msgData.reply_to_id = replyTo.id

        if (roomKey && plainText) {
          // ── Encrypted send ──────────────────────────────────────────────
          const ciphertext = await encryptMessage(plainText, roomKey)
          msgData = { ...msgData, ciphertext, is_encrypted: true, text: null }
        } else {
          // ── Legacy plaintext send ───────────────────────────────────────
          msgData.text = plainText
        }

        const { data: inserted, error: insErr } = await supabase.from('messages').insert(msgData).select().single()
        if (insErr) throw insErr

        // Optimistic: add to local state immediately (with plaintext for our own display)
        if (inserted) {
          const localMsg = roomKey && plainText
            ? { ...inserted, text: plainText }  // show our own message decrypted
            : inserted
          setMessages(prev => prev.find(m => m.id === localMsg.id) ? prev : [...prev, localMsg])
        }

        setReplyTo(null)
        scrollToBottom()
        if (partner?.id) {
          // Never send plaintext content in push — E2EE-safe generic notification
          const pushBody = photoUrl && !plainText ? '📷 Фото' : '💬 Новое сообщение'
          sendPushNotification(`💬 ${profile?.name || 'Сообщение'}`, pushBody, partner.id, uid).catch(() => {})
        }
      }
      setNewText('')
      cancelPhoto()
    } catch (e) { console.error(e) }
    setSending(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      if (editingId) setEditingId(null)
      if (replyTo) setReplyTo(null)
      setNewText('')
    }
  }

  async function onPhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    const compressedFile = new File([compressed], file.name, { type: 'image/jpeg' })
    setPhotoFile(compressedFile)
    setPhotoPreview(URL.createObjectURL(compressedFile))
  }

  function cancelPhoto() {
    setPhotoFile(null)
    setPhotoPreview(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return null })
    if (photoRef.current) photoRef.current.value = ''
  }

  async function onVideoFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSending(true)
    try {
      const url = await upload(file, 'circles')
      await supabase.from('messages').insert({
        user_id: uid,
        video_url: url,
        is_video_circle: true
      })
    } catch (e) { console.error(e) }
    setSending(false)
    if (videoFileRef.current) videoFileRef.current.value = ''
  }

  // ── video circle recording ────────────────────────────────────────────────
  async function startRecord() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 300, height: 300 }, audio: true
      })
      streamRef.current = stream
      // srcObject присваивается в useEffect после setRecording(true)
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9' : 'video/webm'
      const rec = new MediaRecorder(stream, { mimeType: mime })
      recorderRef.current = rec
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        if (previewVidRef.current) previewVidRef.current.srcObject = null
        streamRef.current = null
        clearInterval(recTimer.current)
        if (cancelledRef.current) { cancelledRef.current = false; setRecording(false); setRecordSeconds(0); return }
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        if (blob.size < 1000) { setRecording(false); setRecordSeconds(0); return }
        const file = new File([blob], `circle-${Date.now()}.webm`, { type: 'video/webm' })
        setSending(true)
        try {
          const url = await upload(file, 'circles')
          const { error: insErr } = await supabase.from('messages').insert({ user_id: uid, video_url: url, is_video_circle: true })
          if (insErr) throw insErr
          const { data: latest } = await supabase.from('messages').select('*').eq('user_id', uid).eq('video_url', url).limit(1)
          if (latest?.[0]) setMessages(prev => prev.find(m => m.id === latest[0].id) ? prev : [...prev, latest[0]])
          scrollToBottom()
          if (partner?.id) sendPushNotification(`💬 ${profile?.name || 'Сообщение'}`, '📹 Видео-сообщение', partner.id, uid).catch(() => {})
        } catch (e) { console.error(e) }
        broadcastRef.current?.send({ type: 'broadcast', event: 'recording', payload: { userId: uid, kind: null } })
        setSending(false)
        setRecording(false)
        setRecordSeconds(0)
      }
      setRecording(true)
      broadcastRef.current?.send({ type: 'broadcast', event: 'recording', payload: { userId: uid, kind: 'video' } })
      setRecordSeconds(0)
      clearInterval(recTimer.current)
      recTimer.current = setInterval(() => setRecordSeconds(s => s + 1), 1000)
      // небольшая задержка — даём React отрендерить видео-элемент, потом стартуем
      setTimeout(() => {
        rec.start()
        setTimeout(() => { if (recorderRef.current?.state === 'recording') recorderRef.current.stop() }, 60000)
      }, 80)
    } catch (e) { console.error(e); alert('Нет доступа к камере') }
  }

  function stopRecord() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    clearInterval(recTimer.current)
  }

  function cancelRecord() {
    cancelledRef.current = true
    clearInterval(recTimer.current)
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (previewVidRef.current) previewVidRef.current.srcObject = null
    chunksRef.current = []
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    setRecording(false)
    setRecordSeconds(0)
  }

  // ── spec-named voice wrappers ──────────────────────────────────────────────
  async function startVoice() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      voiceStream.current = stream

      // iOS Safari поддерживает только audio/mp4, Android/Chrome — webm/opus
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : ''

      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream)

      voiceRecRef.current = rec
      voiceChunks.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) voiceChunks.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        voiceStream.current = null
        clearInterval(recTimer.current)
        const sec = voiceSecRef.current
        voiceSecRef.current = 0
        if (voiceCancelledRef.current) {
          voiceCancelledRef.current = false
          voiceChunks.current = []
          setVoiceRec(false); setRecordSeconds(0); return
        }
        const mimeType = rec.mimeType || mime || 'audio/webm'
        const blob = new Blob(voiceChunks.current, { type: mimeType })
        voiceChunks.current = []
        if (blob.size < 100) { setVoiceRec(false); setRecordSeconds(0); return }
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType })
        setSending(true)
        try {
          const url = await upload(file, 'voices')
          const { error: insErr } = await supabase.from('messages').insert({ user_id: uid, audio_url: url, is_voice: true, duration: sec })
          if (insErr) throw insErr
          const { data: latest } = await supabase.from('messages').select('*').eq('user_id', uid).eq('audio_url', url).limit(1)
          if (latest?.[0]) setMessages(prev => prev.find(m => m.id === latest[0].id) ? prev : [...prev, latest[0]])
          scrollToBottom()
          if (partner?.id) sendPushNotification(`💬 ${profile?.name || 'Сообщение'}`, '🎤 Голосовое сообщение', partner.id, uid).catch(() => {})
        } catch (e) { console.error('voice send error:', e); alert('Ошибка отправки: ' + e.message) }
        broadcastRef.current?.send({ type: 'broadcast', event: 'recording', payload: { userId: uid, kind: null } })
        setSending(false)
        setVoiceRec(false)
        setRecordSeconds(0)
      }
      rec.start(100)
      broadcastRef.current?.send({ type: 'broadcast', event: 'recording', payload: { userId: uid, kind: 'voice' } })
      setVoiceRec(true)
      setRecordSeconds(0)
      voiceSecRef.current = 0
      clearInterval(recTimer.current)
      recTimer.current = setInterval(() => { voiceSecRef.current++; setRecordSeconds(s => s + 1) }, 1000)
    } catch (e) { console.error(e); alert('Нет доступа к микрофону: ' + e.message) }
  }

  function stopVoice() {
    clearInterval(recTimer.current)
    const rec = voiceRecRef.current
    if (!rec) return
    try {
      if (rec.state === 'recording') rec.requestData()
      if (rec.state !== 'inactive') rec.stop()
    } catch (e) { console.error('stopVoice error:', e) }
  }

  function cancelVoice() {
    voiceCancelledRef.current = true
    clearInterval(recTimer.current)
    if (voiceStream.current) { voiceStream.current.getTracks().forEach(t => t.stop()); voiceStream.current = null }
    if (voiceRecRef.current?.state === 'recording') voiceRecRef.current.stop()
    else { setVoiceRec(false); setRecordSeconds(0) }
  }

  async function deleteMsg(id) {
    await supabase.from('messages').delete().eq('id', id)
  }

  async function pinMsg(id) {
    const msg = messages.find(m => m.id === id)
    if (!msg) return
    await supabase
      .from('messages')
      .update({ is_pinned: !msg.is_pinned })
      .eq('id', id)
  }

  async function addReact(msgId, emoji) {
    if (!VALID_REACTIONS.has(emoji)) return
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return
    const reactions = { ...(msg.reactions || {}) }
    if (reactions[emoji]?.includes(uid)) {
      reactions[emoji] = reactions[emoji].filter(id => id !== uid)
      if (!reactions[emoji].length) delete reactions[emoji]
    } else {
      reactions[emoji] = [...(reactions[emoji] || []), uid]
    }
    await supabase
      .from('messages')
      .update({ reactions })
      .eq('id', msgId)
  }

  function onLongPress(msg) {
    setCtxMenu({ msgId: msg.id, text: msg.text || '', isMe: msg.user_id === uid, isPinned: !!msg.is_pinned })
  }

  function _onDoubleTap(id) {
    addReact(id, '❤️')
  }

  function onReply(msgId) {
    const msg = messages.find(m => m.id === msgId)
    if (msg) setReplyTo({ id: msg.id, text: msg.text, user_id: msg.user_id, photo_url: msg.photo_url })
  }

  function getReplyMessage(replyId) {
    return messages.find(m => m.id === replyId)
  }

  function copyText(text) {
    navigator.clipboard?.writeText(text)
  }

  function sendTyping(isTyping) {
    broadcastRef.current?.send({
      type: 'broadcast', event: 'typing',
      payload: { userId: uid, value: isTyping }
    })
  }

  function handleTextChange(e) {
    setNewText(e.target.value)
    clearTimeout(typingTimer.current)
    sendTyping(true)
    typingTimer.current = setTimeout(() => {
      sendTyping(false)
    }, 3000)
  }

  const pinnedMsg = messages.find(m => m.is_pinned)
  const partnerName = partner?.name || (pid ? 'Партнёр' : 'Партнёр не подключён')
  const partnerAvatar = partner?.avatar_url

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: BG }}>
        <div style={{ animation: 'heartbeat 1.4s ease-in-out infinite' }}>
          <svg viewBox="0 0 60 56" width="64" height="60" fill="none">
            <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z" fill="url(#grad)" />
            <defs><linearGradient id="grad" x1="0" y1="0" x2="60" y2="56"><stop offset="0%" stopColor="#E8556A" /><stop offset="100%" stopColor="#C8334A" /></linearGradient></defs>
          </svg>
        </div>
      </div>
    )
  }

  if (!pid) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', background: BG, padding: '40px 32px', textAlign: 'center', gap: 16 }}>
        <div style={{ fontSize: 56 }}>💬</div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: INK }}>
          Партнёр не подключён
        </div>
        <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.5 }}>
          Пригласите партнёра через настройки, чтобы начать общение
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG, position: 'relative', overflow: 'hidden' }}>

      <div style={{
        flexShrink: 0, background: SURF, borderBottom: `0.5px solid ${BDR}`,
        paddingTop: 'max(10px, env(safe-area-inset-top, 0px))',
        paddingBottom: 10, paddingLeft: 16, paddingRight: 16,
        display: 'flex', alignItems: 'center', gap: 12, zIndex: 20,
        transform: 'translateZ(0)'
      }}>
        <Avatar url={partnerAvatar} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 600, color: INK }}>
            {partnerName}
          </div>
          <div style={{ fontSize: 11, transition: 'color .3s',
            color: (partnerTyping || partnerRecording) ? '#4CAF50' : isOnline(partnerLastSeen) ? '#4CAF50' : MUTED }}>
            {partnerRecording === 'voice' ? 'записывает голосовое...'
              : partnerRecording === 'video' ? 'записывает кружочек...'
              : partnerTyping ? 'печатает...'
              : fmtLastSeen(partnerLastSeen)}
          </div>
        </div>
        <button onClick={() => setShowSearch(true)} style={{ width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(200,51,74,0.09)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#C8334A" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
        <button style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={MUTED} strokeWidth="2">
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
        </button>
      </div>

      {pinnedMsg && (
        <div style={{
          flexShrink: 0, background: dark ? 'rgba(200,51,74,0.1)' : 'rgba(200,51,74,0.05)',
          borderBottom: `0.5px solid rgba(200,51,74,0.12)`, padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <div style={{ width: 3, height: 36, background: ROSE, borderRadius: 3, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: ROSE, fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke={ROSE} strokeWidth="2">
                <path d="M12 17v5 M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17z"/>
              </svg>
              Закреплено
            </div>
            <div style={{ fontSize: 13, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pinnedMsg.text || 'Фото'}
            </div>
          </div>
          <button onClick={() => pinMsg(pinnedMsg.id)} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{
          flex: 1, overflowY: 'auto', padding: '12px 10px',
          display: 'flex', flexDirection: 'column', gap: 2,
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, opacity: 0.5 }}>
            <svg viewBox="0 0 60 56" width="52" height="48" fill="none">
              <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z" fill="rgba(200,51,74,0.35)" />
            </svg>
            <p style={{ fontSize: 14, color: MUTED }}>Напишите первое сообщение</p>
          </div>
        ) : messages.map((msg, i) => {
          const prevMsg = messages[i - 1]
          const nextMsg = messages[i + 1]
          const isMine = msg.user_id === uid
          const showDate = i === 0 || diffDate(prevMsg?.created_at, msg.created_at)
          const isFirst = isFirstInGroup(msg, prevMsg)
          const isLast = isLastInGroup(msg, nextMsg)
          const showAv = needAvatar(msg, nextMsg, uid)
          const _replyMsg = msg.reply_to_id ? getReplyMessage(msg.reply_to_id) : null

          return (
            <div key={msg.id} data-msg-id={msg.id}>
              {showDate && (
                <div style={{ textAlign: 'center', margin: '12px 0 8px' }}>
                  <span style={{
                    background: dark ? 'rgba(200,51,74,0.15)' : 'rgba(200,51,74,0.08)',
                    padding: '4px 16px', borderRadius: 20, fontSize: 11, color: MUTED
                  }}>
                    {fmtDateSep(msg.created_at)}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
                {!isMine && showAv && (
                  <div style={{ marginRight: 8, marginTop: 4 }}>
                    <Avatar url={partnerAvatar} size={32} />
                  </div>
                )}
                {!isMine && !showAv && <div style={{ width: 40 }} />}
                <Message
                  msg={msg}
                  isMine={isMine}
                  dark={dark}
                  uid={uid}
                  partnerName={partnerName}
                  partnerAvatar={partnerAvatar}
                  onLongPress={onLongPress}
                  onReact={addReact}
                  onReply={onReply}
                  onPhotoOpen={url => setLightboxUrl(url)}
                  isFirst={isFirst}
                  isLast={isLast}
                  showAv={showAv}
                  messages={messages}
                />
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {showDown && (
        <button
          onClick={scrollToBottom}
          style={{
            position: 'absolute', bottom: 80, right: 14,
            width: 38, height: 38, borderRadius: '50%',
            background: dark ? '#1E0A10' : '#fff', border: `0.5px solid ${BDR}`,
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 15
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={ROSE} strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {lightboxUrl && <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      <ContextMenu
        menu={ctxMenu}
        dark={dark}
        onClose={() => setCtxMenu(null)}
        onEdit={(id, text) => { setEditingId(id); setNewText(text); setReplyTo(null) }}
        onDelete={deleteMsg}
        onPin={pinMsg}
        onCopy={copyText}
        onReact={addReact}
        onReply={id => {
          const m = messages.find(x => x.id === id)
          if (m) setReplyTo({ id: m.id, text: m.text, user_id: m.user_id, photo_url: m.photo_url })
          setCtxMenu(null)
        }}
      />

      {showSearch && <SearchOverlay messages={messages} dark={dark} onClose={() => setShowSearch(false)} />}

      {replyTo && (
        <div style={{
          flexShrink: 0, padding: '6px 14px', background: SURF,
          borderTop: `0.5px solid ${BDR}`, display: 'flex', alignItems: 'center', gap: 8
        }}>
          <div style={{ width: 3, height: 34, background: ROSE, borderRadius: 3, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: ROSE, fontWeight: 600 }}>
              {replyTo.user_id === uid ? 'Вы' : (partner?.name || 'Партнёр')}
            </div>
            <div style={{ fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {replyTo.photo_url && !replyTo.text ? 'Фото' : (replyTo.text || '')}
            </div>
          </div>
          {replyTo.photo_url && (
            <img src={replyTo.photo_url} style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
          )}
          <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 20, lineHeight: 1, padding: '2px 6px' }}>×</button>
        </div>
      )}

      {editingId && (
        <div style={{
          flexShrink: 0, padding: '8px 14px', background: dark ? 'rgba(200,51,74,0.1)' : 'rgba(200,51,74,0.06)',
          borderTop: `0.5px solid rgba(200,51,74,0.15)`, display: 'flex', alignItems: 'center', gap: 10
        }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={ROSE} strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z"/>
          </svg>
          <span style={{ flex: 1, fontSize: 12, color: ROSE, fontWeight: 500 }}>Редактирование сообщения</span>
          <button onClick={() => { setEditingId(null); setNewText('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 18, lineHeight: 1, padding: '2px 6px' }}>×</button>
        </div>
      )}

      {photoPreview && (
        <div style={{
          flexShrink: 0, padding: '8px 14px', background: SURF,
          borderTop: `0.5px solid ${BDR}`, display: 'flex', alignItems: 'center', gap: 10
        }}>
          <img src={photoPreview} style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 10 }} />
          <span style={{ flex: 1, fontSize: 13, color: MUTED }}>Фото прикреплено</span>
          <button onClick={cancelPhoto} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {recording && (
        <div style={{
          flexShrink: 0, background: dark ? '#1A0810' : '#fff0f3',
          borderBottom: `0.5px solid rgba(200,51,74,0.15)`,
          padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12
        }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden',
            border: `2px solid ${ROSE}`, flexShrink: 0, background: '#000', position: 'relative' }}>
            <video ref={previewVidRef} autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: ROSE, animation: 'pulse 1s infinite' }}/>
              <span style={{ fontSize: 13, color: INK, fontFamily: 'monospace' }}>
                {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, '0')}
              </span>
            </div>
            <div style={{ fontSize: 11, color: MUTED }}>Запись кружочка...</div>
          </div>
          <button onClick={cancelRecord} style={{ background: 'none', border: 'none', cursor: 'pointer',
            padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={MUTED} strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <button onClick={stopRecord} style={{
            width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(200,51,74,0.4)'
          }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      )}

      {voiceRec && (
        <div style={{
          flexShrink: 0, background: dark ? '#1A0810' : '#fff0f3',
          borderBottom: `0.5px solid rgba(200,51,74,0.15)`,
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12
        }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: GRAD, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.2s infinite' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"/>
              <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: ROSE, fontWeight: 600 }}>Запись голосового...</div>
            <div style={{ fontSize: 11, color: MUTED, fontFamily: 'monospace' }}>
              {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, '0')}
            </div>
          </div>
          {/* Отмена */}
          <button onClick={cancelVoice} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={MUTED} strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          {/* Отправить */}
          <button onClick={stopVoice} style={{
            width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(200,51,74,0.4)'
          }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      )}

      <div style={{
        flexShrink: 0, background: SURF, borderTop: `0.5px solid ${BDR}`,
        padding: '8px 10px', paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', alignItems: 'flex-end', gap: 7,
        transform: 'translateZ(0)'
      }}>
        <IconBtn onClick={() => photoRef.current?.click()} icon="camera" />
        <input ref={photoRef} type="file" accept="image/*" onChange={onPhotoChange} style={{ display: 'none' }} />

        <button
          onClick={recording ? stopRecord : startRecord}
          style={{
            width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
            background: recording ? GRAD : 'rgba(200,51,74,0.09)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: recording ? 'glow 1.4s ease-in-out infinite' : 'none'
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
            stroke={recording ? 'white' : '#C8334A'} strokeWidth="2">
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
        </button>
        <input ref={videoFileRef} type="file" accept="video/*" onChange={onVideoFile} style={{ display: 'none' }} />

        <div style={{
          flex: 1, background: SURF2, borderRadius: 22, border: `0.5px solid ${BDR}`,
          padding: '0 14px', display: 'flex', alignItems: 'flex-end'
        }}>
          <textarea
            value={newText}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={replyTo ? "Напишите ответ..." : "Сообщение..."}
            rows={1}
            style={{
              flex: 1, border: 'none', background: 'none', padding: '10px 0',
              fontSize: 16, fontFamily: "'DM Sans', sans-serif", color: INK,
              resize: 'none', outline: 'none', maxHeight: 120, lineHeight: 1.45
            }}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
        </div>

        {!newText.trim() && !photoFile && !recording && !voiceRec && (
          <button
            onClick={startVoice}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
              background: voiceRec ? GRAD : 'rgba(200,51,74,0.09)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: voiceRec ? 'glow 0.8s ease-in-out infinite' : 'none'
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
              stroke={voiceRec ? 'white' : '#C8334A'} strokeWidth="2">
              <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"/>
              <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3"/>
            </svg>
          </button>
        )}

        {(newText.trim() || photoFile) && (
          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              background: GRAD, cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: sending ? 0.6 : 1
            }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="white" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </div>

      <style>{`
        @keyframes msgIn {
          from { opacity: 0; transform: translateY(6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
        @keyframes ctxIn {
          from { transform: translate(-50%, -50%) scale(0.88); opacity: 0; }
          to   { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(200,51,74,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(200,51,74,0); }
        }
        @keyframes heartbeat {
          0%,100%{transform:scale(1)} 15%{transform:scale(1.3)} 30%{transform:scale(1.05)} 45%{transform:scale(1.2)}
        }
      `}</style>
    </div>
  )
}
