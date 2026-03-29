import { useState, useEffect, useRef, memo } from 'react'
import { supabase } from '../lib/supabase'

const REACTIONS = ['❤️','🔥','😍','😂','👍','💔']
const VALID_REACTIONS = new Set(REACTIONS)
const GROUP_DIFF_SECONDS = 121 // из tweb: newGroupDiff = 121

/* ─────────────────────────────────────────────────────────────────────────────
 * UTILS
 * ──────────────────────────────────────────────────────────────────────────── */
function pad(n) { return String(n).padStart(2,'0') }
function fmtTime(d) {
  const dt = new Date(d)
  return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
function fmtDateSep(d) {
  const dt = new Date(d), now = new Date()
  const y = new Date(now); y.setDate(y.getDate()-1)
  if (dt.toDateString()===now.toDateString()) return 'Сегодня'
  if (dt.toDateString()===y.toDateString()) return 'Вчера'
  return dt.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})
}
function diffDate(a,b) {
  return new Date(a).toDateString() !== new Date(b).toDateString()
}
function fmtDuration(sec) {
  if (!sec) return '0:00'
  const mins = Math.floor(sec / 60)
  const secs = sec % 60
  return `${mins}:${secs.toString().padStart(2,'0')}`
}
function fmtRecordTime(sec) {
  const mins = Math.floor(sec / 60)
  const secs = sec % 60
  return `${mins}:${secs.toString().padStart(2,'0')}`
}

// Группировка сообщений (как в tweb)
function isSameGroup(msg1, msg2) {
  if (!msg1 || !msg2) return false
  if (msg1.user_id !== msg2.user_id) return false
  const diff = Math.abs(new Date(msg2.created_at) - new Date(msg1.created_at)) / 1000
  return diff <= GROUP_DIFF_SECONDS
}

// Показывать аватар только у последнего в группе
function shouldShowAvatar(msg, nextMsg) {
  if (!nextMsg) return true
  if (nextMsg.user_id !== msg.user_id) return true
  if (diffDate(msg.created_at, nextMsg.created_at)) return true
  return false
}

// Проверка на валидные реакции (только emoji, не UUID)
function hasValidReactions(reactions) {
  if (!reactions) return false
  const validKeys = Object.keys(reactions).filter(k => VALID_REACTIONS.has(k))
  return validKeys.length > 0
}

// Форматирование текста (жирный, курсив, код, ссылки, цитаты)
function parseText(text) {
  if (!text) return null
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(200,51,74,0.1);border-radius:4px;padding:1px 5px;font-family:monospace;font-size:13px">$1</code>')
    .replace(/\[(.+?)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#C8334A;text-decoration:underline">$1</a>')
    .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid #C8334A;margin:4px 0;padding:2px 8px;opacity:0.8">$1</blockquote>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#C8334A;text-decoration:underline">$1</a>')
}

// Сжатие фото (max 1280px, quality 0.85)
async function compressImage(file) {
  return new Promise(resolve => {
    const img = new Image()
    img.src = URL.createObjectURL(file)
    img.onload = () => {
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

// Видео-кружочек (отображение)
const VideoCircle = memo(({ url, isMine, time }) => {
  const videoRef = useRef(null)
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{
        width: 180, height: 180, borderRadius: '50%', overflow: 'hidden',
        border: `2.5px solid ${isMine ? '#C8334A' : 'rgba(200,51,74,0.25)'}`,
      }}>
        <video
          ref={videoRef}
          src={url}
          playsInline
          controls
          preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
      <div style={{
        position: 'absolute', bottom: 8, right: 8,
        background: 'rgba(0,0,0,0.55)', borderRadius: 6,
        padding: '2px 6px', fontSize: 10, color: 'white'
      }}>{time}</div>
    </div>
  )
})

// Голосовое сообщение (20 баров waveform)
const VoiceMessage = memo(({ url, isMine, duration, time, dark }) => {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const audioRef = useRef(null)
  const bars = [3,5,8,12,16,20,14,8,5,10,18,14,9,6,12,16,8,5,3,6]

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  function toggle() {
    if (!audioRef.current) {
      audioRef.current = new Audio(url)
      audioRef.current.ontimeupdate = () => {
        setProgress(audioRef.current.currentTime / audioRef.current.duration)
      }
      audioRef.current.onended = () => {
        setPlaying(false)
        setProgress(0)
      }
    }
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }

  const SURF = dark ? '#1E0A10' : '#fff'
  const GRAD = 'linear-gradient(135deg, #C8334A, #8B1A2C)'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
      background: isMine ? GRAD : SURF,
      borderRadius: '18px', minWidth: 200,
      border: isMine ? 'none' : `0.5px solid rgba(200,51,74,0.15)`,
    }}>
      <button onClick={toggle} style={{
        width: 36, height: 36, borderRadius: '50%',
        background: isMine ? 'rgba(255,255,255,0.2)' : 'rgba(200,51,74,0.1)',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill={isMine ? 'white' : '#C8334A'}>
          {playing
            ? <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>
            : <polygon points="5,3 19,12 5,21"/>}
        </svg>
      </button>
      <div style={{ flex: 1 }}>
        <svg viewBox="0 0 80 20" width="80" height="20">
          {bars.map((h, i) => {
            const active = progress * 20 > i
            const fill = active
              ? (isMine ? 'rgba(255,255,255,0.9)' : '#C8334A')
              : (isMine ? 'rgba(255,255,255,0.4)' : 'rgba(200,51,74,0.3)')
            return (
              <rect key={i} x={i * 4} y={20 - h} width={3} height={h} rx={1} fill={fill} />
            )
          })}
        </svg>
        <div style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.6)' : '#9A6070', marginTop: 2 }}>
          {fmtDuration(duration)} · {time}
        </div>
      </div>
    </div>
  )
})

// Превью ответа на сообщение
const ReplyPreview = memo(({ replyMsg, isMine, dark }) => {
  const text = replyMsg.text || 'Фото'
  return (
    <div style={{
      marginBottom: 4, padding: '4px 8px', borderRadius: 8,
      background: isMine ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
      borderLeft: `3px solid #C8334A`,
      fontSize: 12,
      color: isMine ? 'rgba(255,255,255,0.7)' : '#9A6070',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>Ответ:</div>
      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {text.length > 50 ? text.slice(0, 50) + '...' : text}
      </div>
    </div>
  )
})

// Реакции
const Reactions = memo(({ reactions, uid, onReact, msgId, isMine, dark }) => {
  const valid = Object.entries(reactions)
    .filter(([e]) => VALID_REACTIONS.has(e))

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

// Текстовый пузырь (с форматированием)
const TextBubble = memo(({ msg, isMine, dark, radius, bg, color }) => {
  return (
    <div style={{
      display: 'inline-block',
      padding: msg.photo_url && !msg.text ? 3 : '10px 14px 8px',
      background: bg,
      color: color,
      borderRadius: radius,
      border: isMine ? 'none' : `0.5px solid rgba(200,51,74,0.15)`,
      boxShadow: dark ? '0 1px 2px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.05)',
      fontSize: 15, lineHeight: 1.45,
      wordBreak: 'break-word', whiteSpace: 'pre-wrap',
    }}>
      {msg.photo_url && (
        <img
          src={msg.photo_url}
          alt=""
          loading="lazy"
          style={{
            maxWidth: '100%', maxHeight: 280,
            borderRadius: msg.text ? 10 : 14,
            display: 'block', marginBottom: msg.text ? 6 : 0
          }}
        />
      )}
      {msg.text && (
        <span dangerouslySetInnerHTML={{ __html: parseText(msg.text) }} />
      )}
      <div style={{
        fontSize: 10, opacity: 0.55, textAlign: 'right', marginTop: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2
      }}>
        {fmtTime(msg.created_at)}
        {isMine && <span style={{ fontSize: 11 }}>✓</span>}
        {msg.edited_at && <span style={{ fontSize: 10, marginLeft: 4 }}>ред.</span>}
      </div>
    </div>
  )
})

// Основной компонент сообщения
const Message = memo(({
  msg, isMine, dark, uid, partner, partnerAvatar,
  onLongPress, onDoubleClick, onReact,
  isLast, // последнее в группе — показываем аватар и хвостик
  replyMsg, // сообщение на которое отвечаем
}) => {
  const timerRef = useRef(null)
  const movedRef = useRef(false)
  const posRef = useRef({ x: 0, y: 0 })
  const lastTap = useRef(0)

  const radius = isMine
    ? (isLast ? '18px 18px 4px 18px' : '18px 18px 8px 18px')
    : (isLast ? '18px 18px 18px 4px' : '18px 18px 18px 8px')

  const bubbleBg = isMine
    ? 'linear-gradient(135deg, #C8334A, #8B1A2C)'
    : (dark ? '#1E0A10' : '#FFFFFF')
  const bubbleColor = isMine ? 'white' : (dark ? '#F5E8EA' : '#1C0A0E')

  function startPress(x, y) {
    movedRef.current = false
    posRef.current = { x, y }
    timerRef.current = setTimeout(() => {
      if (!movedRef.current) onLongPress(msg, x, y)
    }, 500)
  }

  function onMove(e) {
    const t = e.touches?.[0] || e
    const dx = Math.abs(t.clientX - posRef.current.x)
    const dy = Math.abs(t.clientY - posRef.current.y)
    if (dx > 10 || dy > 10) {
      movedRef.current = true
      clearTimeout(timerRef.current)
    }
  }

  function endPress() {
    clearTimeout(timerRef.current)
  }

  function handleTap() {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      onDoubleClick(msg.id)
    }
    lastTap.current = now
  }

  return (
    <div
      onTouchStart={e => { const t = e.touches[0]; startPress(t.clientX, t.clientY) }}
      onTouchMove={onMove}
      onTouchEnd={() => { endPress(); handleTap() }}
      onTouchCancel={endPress}
      onMouseDown={e => startPress(e.clientX, e.clientY)}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onClick={handleTap}
      onContextMenu={e => { e.preventDefault(); onLongPress(msg, e.clientX, e.clientY) }}
      style={{ WebkitUserSelect: 'none', userSelect: 'none', position: 'relative' }}
    >
      {/* Превью ответа */}
      {replyMsg && <ReplyPreview replyMsg={replyMsg} isMine={isMine} dark={dark} />}

      {/* Тип сообщения */}
      {msg.is_video_circle && msg.video_url ? (
        <VideoCircle url={msg.video_url} isMine={isMine} time={fmtTime(msg.created_at)} />
      ) : msg.is_voice && msg.audio_url ? (
        <VoiceMessage url={msg.audio_url} isMine={isMine} duration={msg.duration} time={fmtTime(msg.created_at)} dark={dark} />
      ) : (
        <TextBubble msg={msg} isMine={isMine} dark={dark} radius={radius} bg={bubbleBg} color={bubbleColor} />
      )}

      {/* Реакции */}
      {hasValidReactions(msg.reactions) && (
        <Reactions reactions={msg.reactions} uid={uid} onReact={onReact} msgId={msg.id} isMine={isMine} dark={dark} />
      )}
    </div>
  )
})

// Контекстное меню (по центру экрана)
const ContextMenu = memo(({ menu, onClose, onEdit, onDelete, onPin, onCopy, onReply, onReact }) => {
  if (!menu) return null

  const menuStyle = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 301,
    background: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    minWidth: 240,
    boxShadow: '0 12px 48px rgba(0,0,0,0.25)',
    border: '0.5px solid rgba(200,51,74,0.12)',
    animation: 'slideUp 0.2s ease both'
  }

  const btnStyle = {
    width: '100%', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12,
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 15,
    color: '#1C0A0E', textAlign: 'left', fontFamily: 'inherit',
    borderBottom: '0.5px solid rgba(200,51,74,0.07)'
  }

  const Icon = ({ d }) => (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="#C8334A" strokeWidth={1.8}>
      <path d={d} />
    </svg>
  )

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)'
        }}
      />
      <div style={menuStyle}>
        {/* Реакции сверху */}
        <div style={{
          display: 'flex', gap: 4, padding: '10px 14px',
          borderBottom: '0.5px solid rgba(200,51,74,0.08)', justifyContent: 'center'
        }}>
          {REACTIONS.map(r => (
            <button
              key={r}
              onClick={() => { onReact(menu.msgId, r); onClose() }}
              style={{
                fontSize: 26, padding: '4px 8px', background: 'none', border: 'none',
                cursor: 'pointer', borderRadius: 10, transition: 'transform 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >{r}</button>
          ))}
        </div>

        <button style={btnStyle} onClick={() => { onReply(menu.msgId); onClose() }}>
          <Icon d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          Ответить
        </button>

        {menu.isMe && (
          <button style={btnStyle} onClick={() => { onEdit(menu.msgId, menu.text); onClose() }}>
            <Icon d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z" />
            Редактировать
          </button>
        )}

        {menu.text && (
          <button style={btnStyle} onClick={() => { navigator.clipboard?.writeText(menu.text); onClose() }}>
            <Icon d="M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2 M16 2H8a2 2 0 00-2 2v0a2 2 0 002 2h8a2 2 0 002-2v0a2 2 0 00-2-2z" />
            Копировать
          </button>
        )}

        <button style={btnStyle} onClick={() => { onPin(menu.msgId); onClose() }}>
          <Icon d="M12 17v5 M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17z" />
          {menu.isPinned ? 'Открепить' : 'Закрепить'}
        </button>

        {menu.isMe && (
          <button
            style={{ ...btnStyle, color: '#E24B4A', borderBottom: 'none' }}
            onClick={() => { onDelete(menu.msgId); onClose() }}
          >
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="#E24B4A" strokeWidth={1.8}>
              <path d="M3 6h18 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6 M9 6V4h6v2" />
            </svg>
            Удалить
          </button>
        )}
      </div>
    </>
  )
})

// Оверлей поиска
const SearchOverlay = memo(({ messages, onClose }) => {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  const results = messages.filter(m => m.text?.toLowerCase().includes(query.toLowerCase()))

  function goTo(i) {
    const msg = results[i]
    if (!msg) return
    const el = document.querySelector(`[data-msg-id="${msg.id}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setIndex(i)
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'var(--bg-card, #FFFFFF)',
      display: 'flex', flexDirection: 'column'
    }}>
      <div style={{
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '0.5px solid rgba(200,51,74,0.13)'
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>←</button>
        <input
          autoFocus
          value={query}
          onChange={e => { setQuery(e.target.value); setIndex(0) }}
          placeholder="Поиск..."
          style={{
            flex: 1, border: 'none', background: 'none',
            fontSize: 16, outline: 'none', color: 'var(--ink, #1C0A0E)'
          }}
        />
        {results.length > 0 && (
          <>
            <span style={{ fontSize: 12, color: '#9A6070' }}>{index + 1}/{results.length}</span>
            <button onClick={() => goTo(Math.max(0, index - 1))}>↑</button>
            <button onClick={() => goTo(Math.min(results.length - 1, index + 1))}>↓</button>
          </>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {results.map((msg, i) => (
          <div
            key={msg.id}
            onClick={() => goTo(i)}
            style={{
              padding: '12px 16px', borderBottom: '0.5px solid rgba(200,51,74,0.08)',
              background: i === index ? 'rgba(200,51,74,0.08)' : 'none', cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: 11, color: '#C8334A', marginBottom: 4 }}>{fmtDateSep(msg.created_at)}</div>
            <div
              style={{ fontSize: 14, color: 'var(--ink, #1C0A0E)' }}
              dangerouslySetInnerHTML={{
                __html: msg.text?.replace(
                  new RegExp(`(${query})`, 'gi'),
                  '<mark style="background:rgba(200,51,74,0.3);border-radius:2px">$1</mark>'
                ) || ''
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
})

/* ─────────────────────────────────────────────────────────────────────────────
 * MAIN CHAT COMPONENT
 * ──────────────────────────────────────────────────────────────────────────── */
export default function Chat({ session, profile, darkMode }) {
  // Данные
  const [messages, setMessages] = useState([])
  const [partner, setPartner] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [allLoaded, setAllLoaded] = useState(false)

  // UI
  const [newText, setNewText] = useState('')
  const [sending, setSending] = useState(false)
  const [showDown, setShowDown] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [partnerTyping, setPartnerTyping] = useState(false)

  // Медиа
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [recording, setRecording] = useState(false)
  const [voiceRecording, setVoiceRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)

  // Действия с сообщениями
  const [editingId, setEditingId] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [ctxMenu, setCtxMenu] = useState(null)

  // Refs
  const listRef = useRef(null)
  const endRef = useRef(null)
  const photoRef = useRef(null)
  const videoFileRef = useRef(null)
  const previewVideoRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const typingTimer = useRef(null)
  const recordTimer = useRef(null)

  const dark = darkMode
  const BG = dark ? '#200A10' : '#FBF0F2'
  const SURF = dark ? '#1E0A10' : '#FFFFFF'
  const SURF2 = dark ? '#3D1520' : '#FBF0F2'
  const INK = dark ? '#F5E8EA' : '#1C0A0E'
  const MUTED = dark ? '#8A5060' : '#9A6070'
  const BDR = dark ? 'rgba(232,85,106,0.18)' : 'rgba(200,51,74,0.13)'
  const ROSE = '#C8334A'
  const GRAD = 'linear-gradient(135deg, #C8334A, #8B1A2C)'
  const uid = session?.user?.id

  /* ─────────────────────────────────────────────────────────────────────────
   * DATA LOADING
   * ─────────────────────────────────────────────────────────────────────── */
  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setMessages((data || []).reverse())
    setLoading(false)
    setTimeout(scrollToBottom, 100)
  }

  async function loadMore() {
    if (loadingMore || allLoaded || !messages.length) return
    setLoadingMore(true)
    const oldest = messages[0].created_at
    const { data } = await supabase
      .from('messages')
      .select('*')
      .lt('created_at', oldest)
      .order('created_at', { ascending: false })
      .limit(50)
    if (!data || data.length < 50) setAllLoaded(true)
    if (data && data.length) {
      setMessages(prev => [...(data.reverse()), ...prev])
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
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * REALTIME
   * ─────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!uid) return
    loadMessages()
    loadPartner()

    const channel = supabase.channel('chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => {
        setMessages(prev => prev.find(m => m.id === p.new.id) ? prev : [...prev, p.new])
        setTimeout(scrollToBottom, 60)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, p => {
        setMessages(prev => prev.filter(m => m.id !== p.old.id))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, p => {
        setMessages(prev => prev.map(m => m.id === p.new.id ? p.new : m))
      })
      .subscribe()

    // Typing indicator
    const typingChannel = supabase.channel('typing')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'typing_status',
        filter: `user_id=eq.${partner?.id}`
      }, p => setPartnerTyping(p.new.is_typing))
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(typingChannel)
    }
  }, [uid, partner?.id])

  /* ─────────────────────────────────────────────────────────────────────────
   * SCROLL
   * ─────────────────────────────────────────────────────────────────────── */
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

  /* ─────────────────────────────────────────────────────────────────────────
   * UPLOAD
   * ─────────────────────────────────────────────────────────────────────── */
  async function upload(file, folder) {
    const ext = file.name?.split('.').pop() || 'webm'
    const name = `${Date.now()}-${Math.random().toString(36).slice(6)}.${ext}`
    const { error } = await supabase.storage.from('photos').upload(`${folder}/${name}`, file)
    if (error) throw error
    return supabase.storage.from('photos').getPublicUrl(`${folder}/${name}`).data.publicUrl
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * SEND MESSAGE
   * ─────────────────────────────────────────────────────────────────────── */
  async function handleSend() {
    if (!newText.trim() && !photoFile) return
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
        const msgData = {
          user_id: uid,
          text: newText.trim() || null,
          photo_url: photoUrl
        }
        if (replyTo) {
          msgData.reply_to_id = replyTo.id
        }
        await supabase.from('messages').insert(msgData)
        setReplyTo(null)
      }
      setNewText('')
      cancelPhoto()
      scrollToBottom()
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

  /* ─────────────────────────────────────────────────────────────────────────
   * PHOTO
   * ─────────────────────────────────────────────────────────────────────── */
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
    setPhotoPreview(null)
    if (photoRef.current) photoRef.current.value = ''
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * VIDEO CIRCLE (запись)
   * ─────────────────────────────────────────────────────────────────────── */
  async function startVideoRecord() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 360 }, height: { ideal: 360 } },
        audio: true
      })
      streamRef.current = stream
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream
        previewVideoRef.current.muted = true
        previewVideoRef.current.play()
      }
      const mime = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm'
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        if (previewVideoRef.current) previewVideoRef.current.srcObject = null
        streamRef.current = null
        const blob = new Blob(chunksRef.current, { type: mime })
        if (blob.size < 1000) {
          setRecording(false)
          return
        }
        const ext = mime === 'video/mp4' ? 'mp4' : 'webm'
        const file = new File([blob], `circle-${Date.now()}.${ext}`, { type: mime })
        setSending(true)
        try {
          const url = await upload(file, 'circles')
          await supabase.from('messages').insert({
            user_id: uid,
            video_url: url,
            is_video_circle: true
          })
          scrollToBottom()
        } catch (e) { console.error(e) }
        setSending(false)
        setRecording(false)
      }
      recorder.start()
      setRecording(true)
      setRecordSeconds(0)
      recordTimer.current = setInterval(() => {
        setRecordSeconds(s => s + 1)
      }, 1000)
      setTimeout(() => {
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      }, 60000)
    } catch (e) {
      console.error(e)
      alert('Нет доступа к камере')
    }
  }

  function stopVideoRecord() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
    if (recordTimer.current) clearInterval(recordTimer.current)
  }

  function cancelVideoRecord() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (previewVideoRef.current) previewVideoRef.current.srcObject = null
    if (recordTimer.current) clearInterval(recordTimer.current)
    chunksRef.current = []
    setRecording(false)
    setRecordSeconds(0)
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
      scrollToBottom()
    } catch (e) { console.error(e) }
    setSending(false)
    if (videoFileRef.current) videoFileRef.current.value = ''
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * VOICE MESSAGE (запись)
   * ─────────────────────────────────────────────────────────────────────── */
  async function startVoiceRecord() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size < 1000) {
          setVoiceRecording(false)
          return
        }
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
        setSending(true)
        try {
          const url = await upload(file, 'voices')
          await supabase.from('messages').insert({
            user_id: uid,
            audio_url: url,
            is_voice: true,
            duration: recordSeconds
          })
          scrollToBottom()
        } catch (e) { console.error(e) }
        setSending(false)
        setVoiceRecording(false)
      }
      recorder.start()
      setVoiceRecording(true)
      setRecordSeconds(0)
      recordTimer.current = setInterval(() => {
        setRecordSeconds(s => s + 1)
      }, 1000)
    } catch (e) {
      console.error(e)
      alert('Нет доступа к микрофону')
    }
  }

  function stopVoiceRecord() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
    if (recordTimer.current) clearInterval(recordTimer.current)
  }

  function cancelVoiceRecord() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (recordTimer.current) clearInterval(recordTimer.current)
    chunksRef.current = []
    setVoiceRecording(false)
    setRecordSeconds(0)
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * MESSAGE ACTIONS
   * ─────────────────────────────────────────────────────────────────────── */
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

  function onLongPress(msg, x, y) {
    setCtxMenu({
      msgId: msg.id,
      text: msg.text || '',
      x, y,
      isMe: msg.user_id === uid,
      isPinned: msg.is_pinned || false
    })
  }

  function onDoubleTap(id) {
    addReact(id, '❤️')
  }

  function onReply(msgId) {
    const msg = messages.find(m => m.id === msgId)
    if (msg) setReplyTo({ id: msg.id, text: msg.text || 'Фото', user_id: msg.user_id })
  }

  function getReplyMessage(replyId) {
    return messages.find(m => m.id === replyId)
  }

  function copyText(text) {
    navigator.clipboard?.writeText(text)
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * TYPING INDICATOR
   * ─────────────────────────────────────────────────────────────────────── */
  async function sendTyping(isTyping) {
    await supabase.from('typing_status').upsert({
      user_id: uid,
      is_typing: isTyping,
      updated_at: new Date().toISOString()
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

  /* ─────────────────────────────────────────────────────────────────────────
   * RENDER
   * ─────────────────────────────────────────────────────────────────────── */
  const pinnedMsg = messages.find(m => m.is_pinned)
  const partnerName = partner?.name || (profile?.name === 'Антон' ? 'Эльвира' : 'Антон')
  const partnerAvatar = partner?.avatar_url

  // Иконка кнопки
  const IconBtn = ({ onClick, icon, active, glow, onMouseDown, onMouseUp, onTouchStart, onTouchEnd }) => {
    const iconMap = {
      camera: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={active ? 'white' : ROSE} strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
      video: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={active ? 'white' : ROSE} strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
      mic: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={active ? 'white' : ROSE} strokeWidth="2"><path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3"/></svg>,
      send: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    }
    const baseStyle = {
      width: 36, height: 36, borderRadius: '50%',
      background: active ? GRAD : 'rgba(200,51,74,0.09)',
      border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', flexShrink: 0, transition: 'transform 0.15s',
      animation: glow ? 'glow 1.5s ease-in-out infinite' : 'none'
    }
    const handlers = {}
    if (onMouseDown) handlers.onMouseDown = onMouseDown
    if (onMouseUp) handlers.onMouseUp = onMouseUp
    if (onTouchStart) handlers.onTouchStart = onTouchStart
    if (onTouchEnd) handlers.onTouchEnd = onTouchEnd
    return (
      <button onClick={onClick} style={baseStyle} {...handlers}>
        {iconMap[icon]}
      </button>
    )
  }

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG, position: 'relative', overflow: 'hidden' }}>

      {/* HEADER */}
      <div style={{
        flexShrink: 0, background: SURF, borderBottom: `0.5px solid ${BDR}`,
        paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
        paddingBottom: 12, paddingLeft: 16, paddingRight: 16,
        display: 'flex', alignItems: 'center', gap: 12, zIndex: 20
      }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', overflow: 'hidden',
            background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {partnerAvatar
              ? <img src={partnerAvatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
                  <circle cx="20" cy="15" r="7" fill="rgba(255,255,255,.85)" />
                  <path d="M5 37c0-8.3 6.7-15 15-15s15 6.7 15 15" fill="rgba(255,255,255,.65)" />
                </svg>
            }
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 600, color: INK }}>
            {partnerName}
          </div>
          <div style={{ fontSize: 11, color: partnerTyping ? '#4CAF50' : MUTED }}>
            {partnerTyping ? 'печатает...' : 'наша история'}
          </div>
        </div>
        <button onClick={() => setShowSearch(true)} style={IconBtn({ icon: 'camera' }).style}>
          🔍
        </button>
      </div>

      {/* PINNED MESSAGE */}
      {pinnedMsg && (
        <div style={{
          flexShrink: 0, background: dark ? 'rgba(200,51,74,0.1)' : 'rgba(200,51,74,0.05)',
          borderBottom: `0.5px solid rgba(200,51,74,0.12)`, padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <div style={{ width: 3, height: 36, background: ROSE, borderRadius: 3, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: ROSE, fontWeight: 600, marginBottom: 2 }}>📌 Закреплено</div>
            <div style={{ fontSize: 13, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pinnedMsg.text || 'Фото'}
            </div>
          </div>
          <button onClick={() => pinMsg(pinnedMsg.id)} style={{ ...IconBtn({ icon: 'camera' }).style, background: 'none', width: 30, height: 30 }}>
            ✕
          </button>
        </div>
      )}

      {/* REPLY INDICATOR */}
      {replyTo && (
        <div style={{
          flexShrink: 0, padding: '6px 14px', background: SURF,
          borderTop: `0.5px solid ${BDR}`, display: 'flex', alignItems: 'center', gap: 8
        }}>
          <div style={{ width: 3, height: 32, background: ROSE, borderRadius: 3 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: ROSE, fontWeight: 500 }}>
              {replyTo.user_id === uid ? 'Вы' : partnerName}
            </div>
            <div style={{ fontSize: 13, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {replyTo.text}
            </div>
          </div>
          <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* EDITING INDICATOR */}
      {editingId && (
        <div style={{
          flexShrink: 0, padding: '6px 14px', background: 'rgba(200,51,74,0.07)',
          borderTop: `0.5px solid rgba(200,51,74,0.15)`, display: 'flex', alignItems: 'center', gap: 8
        }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={ROSE}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z"/></svg>
          <span style={{ flex: 1, fontSize: 12, color: ROSE }}>Редактирование</span>
          <button onClick={() => { setEditingId(null); setNewText('') }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* MESSAGES */}
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
          const isMine = msg.user_id === uid
          const nextMsg = messages[i + 1]
          const showDate = i === 0 || diffDate(messages[i - 1]?.created_at, msg.created_at)
          const showAvatar = !isMine && shouldShowAvatar(msg, nextMsg)
          const isLastInGroup = !isSameGroup(msg, nextMsg)
          const replyMsg = msg.reply_to_id ? getReplyMessage(msg.reply_to_id) : null

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
                {!isMine && showAvatar && (
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: GRAD, overflow: 'hidden', marginRight: 8, marginTop: 4
                  }}>
                    {partnerAvatar
                      ? <img src={partnerAvatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <svg viewBox="0 0 40 40" width="32" height="32" fill="none">
                          <circle cx="20" cy="15" r="7" fill="rgba(255,255,255,0.8)" />
                          <path d="M5 37c0-8.3 6.7-15 15-15s15 6.7 15 15" fill="rgba(255,255,255,0.6)" />
                        </svg>
                    }
                  </div>
                )}
                <Message
                  msg={msg}
                  isMine={isMine}
                  dark={dark}
                  uid={uid}
                  partner={partner}
                  partnerAvatar={partnerAvatar}
                  onLongPress={onLongPress}
                  onDoubleClick={onDoubleTap}
                  onReact={addReact}
                  isLast={isLastInGroup}
                  replyMsg={replyMsg}
                />
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {/* SCROLL DOWN BUTTON */}
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

      {/* CONTEXT MENU */}
      <ContextMenu
        menu={ctxMenu}
        onClose={() => setCtxMenu(null)}
        onEdit={(id, text) => { setEditingId(id); setNewText(text) }}
        onDelete={deleteMsg}
        onPin={pinMsg}
        onCopy={copyText}
        onReact={addReact}
        onReply={onReply}
      />

      {/* SEARCH OVERLAY */}
      {showSearch && (
        <SearchOverlay messages={messages} onClose={() => setShowSearch(false)} />
      )}

      {/* PHOTO PREVIEW */}
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

      {/* VIDEO RECORDING OVERLAY */}
      {recording && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '40px 20px', paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
          animation: 'slideUp 0.3s ease'
        }}>
          <div style={{
            width: 260, height: 260, borderRadius: '50%', overflow: 'hidden',
            border: `4px solid ${ROSE}`, background: '#000', position: 'relative', marginBottom: 30
          }}>
            <video
              ref={previewVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                transform: 'scaleX(-1)'
              }}
            />
            <div style={{
              position: 'absolute', top: 16, right: 16,
              background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: 20,
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: ROSE, animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: 12, color: 'white' }}>ЗАПИСЬ</span>
            </div>
            <div style={{
              position: 'absolute', bottom: 16, left: 16,
              background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: 20,
              fontSize: 14, color: 'white', fontFamily: 'monospace'
            }}>
              {fmtRecordTime(recordSeconds)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 40 }}>
            <button onClick={cancelVideoRecord} style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <button onClick={stopVideoRecord} style={{
              width: 70, height: 70, borderRadius: '50%',
              background: GRAD, border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(200,51,74,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth="2">
                <rect x="6" y="6" width="12" height="12" fill="white" stroke="none" />
              </svg>
            </button>
          </div>
          <div style={{ marginTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
            Нажмите «Отправить», чтобы отправить кружочек<br />или «✕», чтобы отменить
          </div>
        </div>
      )}

      {/* VOICE RECORDING OVERLAY */}
      {voiceRecording && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '40px 20px', paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
          animation: 'slideUp 0.3s ease'
        }}>
          <div style={{
            width: 120, height: 120, borderRadius: '50%',
            background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 30, animation: 'pulse 1.5s infinite'
          }}>
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="white" strokeWidth="1.5">
              <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3" />
            </svg>
          </div>
          <div style={{
            fontSize: 28, fontWeight: 700, color: 'white', fontFamily: 'monospace', marginBottom: 20
          }}>
            {fmtRecordTime(recordSeconds)}
          </div>
          <div style={{ display: 'flex', gap: 40 }}>
            <button onClick={cancelVoiceRecord} style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <button onClick={stopVoiceRecord} style={{
              width: 70, height: 70, borderRadius: '50%',
              background: GRAD, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" strokeWidth="2">
                <rect x="6" y="6" width="12" height="12" fill="white" stroke="none" />
              </svg>
            </button>
          </div>
          <div style={{ marginTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
            Нажмите «Отправить», чтобы отправить голосовое<br />или «✕», чтобы отменить
          </div>
        </div>
      )}

      {/* INPUT BAR */}
      <div style={{
        flexShrink: 0, background: SURF, borderTop: `0.5px solid ${BDR}`,
        padding: '8px 10px', paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', alignItems: 'flex-end', gap: 7
      }}>
        <IconBtn onClick={() => photoRef.current?.click()} icon="camera" />
        <input ref={photoRef} type="file" accept="image/*" onChange={onPhotoChange} style={{ display: 'none' }} />

        <IconBtn
          onClick={recording ? stopVideoRecord : startVideoRecord}
          active={recording}
          glow={recording}
          icon="video"
        />
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

        {!newText.trim() && !photoFile && !recording && !voiceRecording && (
          <IconBtn
            onMouseDown={startVoiceRecord}
            onMouseUp={stopVoiceRecord}
            onTouchStart={startVoiceRecord}
            onTouchEnd={stopVoiceRecord}
            icon="mic"
            active={voiceRecording}
          />
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
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
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
