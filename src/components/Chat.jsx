import { useState, useEffect, useRef, useMemo, useCallback, memo } from ‘react’
import { supabase } from ‘../lib/supabase’

/* ════════════════════════════════════════
КОНСТАНТЫ
════════════════════════════════════════ */
const VALID_REACTIONS = new Set([‘❤️’,‘🔥’,‘😍’,‘😂’,‘👍’,‘💔’])
const GROUP_DIFF_SEC  = 121   // из tweb bubbleGroups.ts: newGroupDiff = 121
const SCROLL_THRESHOLD = 300  // из tweb bubbles.ts: SCROLLED_DOWN_THRESHOLD = 300

/* ════════════════════════════════════════
УТИЛИТЫ
════════════════════════════════════════ */
function pad(n) { return String(n).padStart(2, ‘0’) }

function fmtTime(d) {
const dt = new Date(d)
return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

function fmtDateSep(d) {
const dt = new Date(d), now = new Date()
const yest = new Date(now); yest.setDate(yest.getDate() - 1)
if (dt.toDateString() === now.toDateString())  return ‘Сегодня’
if (dt.toDateString() === yest.toDateString()) return ‘Вчера’
return dt.toLocaleDateString(‘ru-RU’, { day: ‘numeric’, month: ‘long’, year: ‘numeric’ })
}

function fmtDuration(sec) {
if (!sec) return ‘0:00’
return `${Math.floor(sec / 60)}:${pad(sec % 60)}`
}

function fmtRecordTime(sec) {
return `${Math.floor(sec / 60)}:${pad(sec % 60)}`
}

function diffDate(a, b) {
return new Date(a).toDateString() !== new Date(b).toDateString()
}

// Группировка: tweb newGroupDiff = 121 сек
function isSameGroup(m1, m2) {
if (!m1 || !m2) return false
if (m1.user_id !== m2.user_id) return false
const diff = Math.abs(new Date(m2.created_at) - new Date(m1.created_at)) / 1000
return diff <= GROUP_DIFF_SEC
}

// Показывать ли аватар (только у последнего в группе)
function needAvatar(msg, nextMsg, uid) {
if (msg.user_id === uid) return false
if (!nextMsg) return true
if (nextMsg.user_id !== msg.user_id) return true
if (diffDate(msg.created_at, nextMsg.created_at)) return true
return !isSameGroup(msg, nextMsg)
}

// Последнее в группе (хвостик)
function isLastInGroup(msg, nextMsg, uid) {
if (!nextMsg) return true
if (nextMsg.user_id !== msg.user_id) return true
if (diffDate(msg.created_at, nextMsg.created_at)) return true
return !isSameGroup(msg, nextMsg)
}

// Первое в группе (отступ сверху)
function isFirstInGroup(msg, prevMsg) {
if (!prevMsg) return true
if (prevMsg.user_id !== msg.user_id) return true
if (diffDate(prevMsg.created_at, msg.created_at)) return true
return !isSameGroup(prevMsg, msg)
}

function hasValidReactions(reactions) {
if (!reactions || typeof reactions !== ‘object’) return false
return Object.entries(reactions).some(([e, u]) =>
VALID_REACTIONS.has(e) && Array.isArray(u) && u.length > 0
)
}

// Форматирование текста (на основе tweb entities)
function parseText(text) {
if (!text) return ‘’
return text
.replace(/&/g, ‘&’).replace(/</g, ‘<’).replace(/>/g, ‘>’)
.replace(/**(.+?)**/gs, ‘<strong>$1</strong>’)
.replace(/*(.+?)*/gs, ‘<em>$1</em>’)
.replace(/**(.+?)**/gs, ‘<u>$1</u>’)
.replace(/~(.+?)~/gs, ‘<s>$1</s>’)
.replace(/`(.+?)`/g, ‘<code style="background:rgba(200,51,74,0.12);border-radius:4px;padding:1px 5px;font-family:monospace;font-size:13px">$1</code>’)
.replace(/[(.+?)]((https?://[^)]+))/g, ‘<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#C8334A;text-decoration:underline">$1</a>’)
.replace(/^> (.+)$/gm, ‘<blockquote style="border-left:3px solid #C8334A;margin:4px 0;padding:2px 8px;opacity:0.75">$1</blockquote>’)
.replace(/(https?://[^\s<]+)/g, ‘<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#C8334A;text-decoration:underline">$1</a>’)
}

// Сжатие фото: tweb max 1280px, quality 0.85
function compressImage(file) {
return new Promise(resolve => {
const img = new Image()
img.src = URL.createObjectURL(file)
img.onload = () => {
const ratio = Math.min(1280 / img.width, 1280 / img.height, 1)
const canvas = document.createElement(‘canvas’)
canvas.width  = Math.round(img.width  * ratio)
canvas.height = Math.round(img.height * ratio)
canvas.getContext(‘2d’).drawImage(img, 0, 0, canvas.width, canvas.height)
canvas.toBlob(blob => resolve(blob), ‘image/jpeg’, 0.85)
}
img.onerror = () => resolve(file)
})
}

/* ════════════════════════════════════════
VideoCircle (из roundVideoBubble.ts)
tweb: ANIMATION_TIME = 180ms, 180x180px
════════════════════════════════════════ */
const VideoCircle = memo(function VideoCircle({ url, isMine, time }) {
return (
<div style={{ position: ‘relative’, display: ‘inline-block’ }}>
<div style={{
width: 180, height: 180, borderRadius: ‘50%’, overflow: ‘hidden’,
border: `2.5px solid ${isMine ? '#C8334A' : 'rgba(200,51,74,0.25)'}`,
}}>
<video
src={url}
playsInline
controls
preload=“metadata”
style={{ width: ‘100%’, height: ‘100%’, objectFit: ‘cover’, display: ‘block’ }}
/>
</div>
<div style={{
position: ‘absolute’, bottom: 10, right: 10,
background: ‘rgba(0,0,0,0.55)’, borderRadius: 6,
padding: ‘2px 6px’, fontSize: 10, color: ‘white’,
pointerEvents: ‘none’,
}}>{time}</div>
</div>
)
})

/* ════════════════════════════════════════
VoiceMessage (из audio.ts)
tweb: waveform 63 бара SVG rect
Здесь используем 20 баров для простоты
════════════════════════════════════════ */
const WAVE_HEIGHTS = [3,5,8,12,16,20,14,8,5,10,18,14,9,6,12,16,8,5,3,6]

const VoiceMessage = memo(function VoiceMessage({ url, isMine, dark, duration, time }) {
const [playing,  setPlaying]  = useState(false)
const [progress, setProgress] = useState(0)
const audioRef = useRef(null)

const MUTED = dark ? ‘#8A5060’ : ‘#9A6070’

function getAudio() {
if (!audioRef.current) audioRef.current = new Audio(url)
return audioRef.current
}

function toggle() {
const a = getAudio()
if (playing) {
a.pause()
setPlaying(false)
} else {
a.play().catch(console.error)
setPlaying(true)
a.ontimeupdate = () => setProgress(a.currentTime / (a.duration || 1))
a.onended = () => { setPlaying(false); setProgress(0) }
}
}

useEffect(() => () => audioRef.current?.pause(), [])

return (
<div style={{
display: ‘flex’, alignItems: ‘center’, gap: 10,
padding: ‘8px 14px 8px 10px’,
background: isMine ? ‘linear-gradient(135deg,#C8334A,#8B1A2C)’ : (dark ? ‘#1E0A10’ : ‘#fff’),
borderRadius: 18, minWidth: 180,
border: isMine ? ‘none’ : ‘0.5px solid rgba(200,51,74,0.15)’,
}}>
<button onClick={toggle} style={{
width: 36, height: 36, borderRadius: ‘50%’, border: ‘none’, cursor: ‘pointer’,
background: isMine ? ‘rgba(255,255,255,0.22)’ : ‘rgba(200,51,74,0.1)’,
display: ‘flex’, alignItems: ‘center’, justifyContent: ‘center’, flexShrink: 0,
}}>
<svg viewBox=“0 0 24 24” width=“16” height=“16” fill={isMine ? ‘white’ : ‘#C8334A’}>
{playing
? <><rect x="6"  y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>
: <polygon points="5,3 19,12 5,21"/>
}
</svg>
</button>
<div style={{ flex: 1 }}>
<svg viewBox={`0 0 ${WAVE_HEIGHTS.length * 4} 22`} width=“80” height=“22” style={{ display: ‘block’ }}>
{WAVE_HEIGHTS.map((h, i) => (
<rect key={i}
x={i * 4} y={22 - h} width={3} height={h} rx={1}
fill={progress * WAVE_HEIGHTS.length > i
? (isMine ? ‘rgba(255,255,255,0.9)’ : ‘#C8334A’)
: (isMine ? ‘rgba(255,255,255,0.35)’ : ‘rgba(200,51,74,0.28)’)
}
/>
))}
</svg>
<div style={{ fontSize: 10, marginTop: 2,
color: isMine ? ‘rgba(255,255,255,0.6)’ : MUTED }}>
{fmtDuration(duration)} · {time}
</div>
</div>
</div>
)
})

/* ════════════════════════════════════════
ReplyPreview — превью цитируемого сообщения
════════════════════════════════════════ */
const ReplyPreview = memo(function ReplyPreview({ msg, isMine, dark, uid, partnerName, onClick }) {
const INK  = dark ? ‘#F5E8EA’ : ‘#1C0A0E’
const MUTED = dark ? ‘#8A5060’ : ‘#9A6070’
return (
<div onClick={onClick} style={{
display: ‘flex’, gap: 6, marginBottom: 4, cursor: onClick ? ‘pointer’ : ‘default’,
borderLeft: ‘3px solid #C8334A’, paddingLeft: 8,
opacity: 0.85,
}}>
<div style={{ flex: 1, minWidth: 0 }}>
<div style={{ fontSize: 11, color: ‘#C8334A’, fontWeight: 600, marginBottom: 1 }}>
{msg.user_id === uid ? ‘Вы’ : (partnerName || ‘Партнёр’)}
</div>
<div style={{
fontSize: 12, color: isMine ? ‘rgba(255,255,255,0.75)’ : MUTED,
overflow: ‘hidden’, textOverflow: ‘ellipsis’, whiteSpace: ‘nowrap’,
}}>
{msg.photo_url && !msg.text ? ‘Фото’ : (msg.text || ‘’)}
</div>
</div>
{msg.photo_url && (
<img src={msg.photo_url} style={{ width: 36, height: 36, borderRadius: 6, objectFit: ‘cover’, flexShrink: 0 }} />
)}
</div>
)
})

/* ════════════════════════════════════════
Reactions — чипсы с реакциями
════════════════════════════════════════ */
const Reactions = memo(function Reactions({ reactions, uid, onReact, msgId, isMine, dark }) {
const MUTED = dark ? ‘#8A5060’ : ‘#9A6070’
const valid = Object.entries(reactions).filter(([e, u]) =>
VALID_REACTIONS.has(e) && Array.isArray(u) && u.length > 0
)
if (!valid.length) return null
return (
<div style={{
display: ‘flex’, flexWrap: ‘wrap’, gap: 3, marginTop: 4,
justifyContent: isMine ? ‘flex-end’ : ‘flex-start’,
}}>
{valid.map(([emoji, users]) => {
const mine = users.includes(uid)
return (
<button key={emoji} onClick={() => onReact(msgId, emoji)} style={{
background: mine ? ‘rgba(200,51,74,0.15)’ : (dark ? ‘rgba(255,255,255,0.06)’ : ‘rgba(0,0,0,0.05)’),
border: mine ? ‘1px solid rgba(200,51,74,0.35)’ : ‘1px solid transparent’,
borderRadius: 999, padding: ‘2px 8px’, fontSize: 13, cursor: ‘pointer’,
display: ‘flex’, alignItems: ‘center’, gap: 3,
transition: ‘transform .12s’,
}}
onMouseEnter={e => e.currentTarget.style.transform = ‘scale(1.12)’}
onMouseLeave={e => e.currentTarget.style.transform = ‘scale(1)’}
>
{emoji}
<span style={{ fontSize: 11, color: MUTED }}>{users.length}</span>
</button>
)
})}
</div>
)
})

/* ════════════════════════════════════════
Message — отдельный компонент!
Хуки ЗДЕСЬ, НЕ в .map()
════════════════════════════════════════ */
const Message = memo(function Message({
msg, isMine, dark, uid, partnerName, partnerAvatar,
onLongPress, onReact,
isFirst, isLast, showAv,
replyMsg, onReplyClick,
messages,
}) {
const timerRef = useRef(null)
const movedRef = useRef(false)
const posRef   = useRef({ x: 0, y: 0 })
const lastTap  = useRef(0)

const SURF  = dark ? ‘#1E0A10’ : ‘#FFFFFF’
const INK   = dark ? ‘#F5E8EA’ : ‘#1C0A0E’
const MUTED = dark ? ‘#8A5060’ : ‘#9A6070’
const BDR   = dark ? ‘rgba(232,85,106,0.18)’ : ‘rgba(200,51,74,0.13)’

// borderRadius зависит от позиции в группе (как в tweb)
const radius = isMine
? (isLast ? ‘18px 18px 4px 18px’ : ‘18px 18px 8px 18px’)
: (isLast ? ‘18px 18px 18px 4px’ : ‘18px 18px 18px 8px’)

function startPress(x, y) {
movedRef.current = false
posRef.current = { x, y }
timerRef.current = setTimeout(() => {
if (!movedRef.current) onLongPress(msg, x, y)
}, 500)
}

function onMove(e) {
const t = e.touches?.[0] || e
const dx = Math.abs((t.clientX || 0) - posRef.current.x)
const dy = Math.abs((t.clientY || 0) - posRef.current.y)
if (dx > 10 || dy > 10) { movedRef.current = true; clearTimeout(timerRef.current) }
}

function endPress() { clearTimeout(timerRef.current) }

function handleTap() {
const now = Date.now()
if (now - lastTap.current < 280) {
onReact(msg.id, ‘❤️’)
lastTap.current = 0
} else {
lastTap.current = now
}
}

const validReactions = useMemo(() => {
if (!msg.reactions || typeof msg.reactions !== ‘object’) return {}
const r = {}
Object.entries(msg.reactions).forEach(([e, u]) => {
if (VALID_REACTIONS.has(e) && Array.isArray(u) && u.length > 0) r[e] = u
})
return r
}, [msg.reactions])

const replyData = useMemo(() => {
if (!msg.reply_to_id || !messages) return null
return messages.find(m => m.id === msg.reply_to_id) || null
}, [msg.reply_to_id, messages])

return (
<div style={{
display: ‘flex’,
justifyContent: isMine ? ‘flex-end’ : ‘flex-start’,
alignItems: ‘flex-end’,
gap: 6,
marginTop: isFirst ? 8 : 2,
paddingLeft: isMine ? 0 : 6,
paddingRight: isMine ? 6 : 0,
}}>
{/* Аватар партнёра (только у последнего в группе) */}
{!isMine && (
<div style={{
width: 28, height: 28, borderRadius: ‘50%’, flexShrink: 0,
overflow: ‘hidden’, marginBottom: 2,
background: showAv ? ‘linear-gradient(135deg,#C8334A,#8B1A2C)’ : ‘transparent’,
display: ‘flex’, alignItems: ‘center’, justifyContent: ‘center’,
visibility: showAv ? ‘visible’ : ‘hidden’,
}}>
{showAv && (partnerAvatar
? <img src={partnerAvatar} style={{ width: ‘100%’, height: ‘100%’, objectFit: ‘cover’ }} />
: <svg viewBox="0 0 40 40" width="28" height="28" fill="none">
<circle cx="20" cy="15" r="7" fill="rgba(255,255,255,0.82)" />
<path d="M5 37c0-8.3 6.7-15 15-15s15 6.7 15 15" fill="rgba(255,255,255,0.62)" />
</svg>
)}
</div>
)}

```
  {/* Пузырь + реакции */}
  <div
    data-msg-id={msg.id}
    onTouchStart={e => { const t = e.touches[0]; startPress(t.clientX, t.clientY) }}
    onTouchMove={onMove}
    onTouchEnd={() => { endPress(); handleTap() }}
    onTouchCancel={endPress}
    onMouseDown={e => startPress(e.clientX, e.clientY)}
    onMouseUp={endPress}
    onMouseLeave={endPress}
    onClick={handleTap}
    onContextMenu={e => { e.preventDefault(); onLongPress(msg, e.clientX, e.clientY) }}
    style={{
      maxWidth: '76%',
      WebkitUserSelect: 'none', userSelect: 'none',
      position: 'relative',
    }}
  >
    {/* Видео-кружочек */}
    {msg.is_video_circle && msg.video_url ? (
      <VideoCircle url={msg.video_url} isMine={isMine} time={fmtTime(msg.created_at)} />
    ) : msg.is_voice && msg.audio_url ? (
      /* Голосовое */
      <VoiceMessage
        url={msg.audio_url} isMine={isMine} dark={dark}
        duration={msg.duration} time={fmtTime(msg.created_at)}
      />
    ) : (
      /* Текст / фото */
      <div style={{
        display: 'inline-block',
        padding: msg.photo_url && !msg.text ? 3 : '8px 12px 6px',
        background: isMine ? 'linear-gradient(135deg,#C8334A,#8B1A2C)' : SURF,
        color: isMine ? 'white' : INK,
        borderRadius: radius,
        border: isMine ? 'none' : `0.5px solid ${BDR}`,
        fontSize: 15, lineHeight: 1.45,
        wordBreak: 'break-word', whiteSpace: 'pre-wrap',
        animation: 'msgIn 0.22s ease both',
        WebkitTransform: 'translateZ(0)', transform: 'translateZ(0)',
      }}>
        {/* Превью ответа внутри пузыря */}
        {replyData && (
          <ReplyPreview
            msg={replyData} isMine={isMine} dark={dark}
            uid={uid} partnerName={partnerName}
            onClick={onReplyClick ? () => onReplyClick(replyData.id) : undefined}
          />
        )}

        {msg.photo_url && (
          <img
            src={msg.photo_url}
            alt=""
            loading="lazy"
            style={{
              maxWidth: '100%', maxHeight: 280,
              borderRadius: msg.text ? 10 : (isLast ? 14 : 10),
              display: 'block', marginBottom: msg.text ? 6 : 0,
            }}
          />
        )}

        {msg.text && (
          <span
            dangerouslySetInnerHTML={{ __html: parseText(msg.text) }}
          />
        )}

        {msg.text && msg.edited_at && (
          <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 4 }}>ред.</span>
        )}

        <div style={{
          fontSize: 10, opacity: 0.55, textAlign: 'right',
          marginTop: 2, display: 'flex', alignItems: 'center',
          justifyContent: 'flex-end', gap: 2,
        }}>
          {fmtTime(msg.created_at)}
          {isMine && <span style={{ fontSize: 11 }}>✓</span>}
        </div>
      </div>
    )}

    {/* Реакции */}
    {hasValidReactions(validReactions) && (
      <Reactions
        reactions={validReactions} uid={uid}
        onReact={onReact} msgId={msg.id}
        isMine={isMine} dark={dark}
      />
    )}
  </div>
</div>
```

)
})

/* ════════════════════════════════════════
ContextMenu (из contextMenu.ts)
tweb: реакции вверху, меню по центру
════════════════════════════════════════ */
const ContextMenu = memo(function ContextMenu({
menu, dark, onClose, onEdit, onDelete, onPin, onReply, onReact,
}) {
if (!menu) return null

const ITEM_STYLE = {
width: ‘100%’, padding: ‘12px 16px’,
display: ‘flex’, alignItems: ‘center’, gap: 11,
background: ‘none’, border: ‘none’, cursor: ‘pointer’,
fontSize: 15, color: dark ? ‘#F5E8EA’ : ‘#1C0A0E’,
textAlign: ‘left’, fontFamily: ‘inherit’,
borderBottom: ‘0.5px solid rgba(200,51,74,0.07)’,
WebkitTapHighlightColor: ‘transparent’,
}

const SVG = ({ d, c = ‘#C8334A’ }) => (
<svg viewBox="0 0 24 24" width="17" height="17" fill="none"
stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
{d.map((p, i) => <path key={i} d={p} />)}
</svg>
)

return (
<>
<div onClick={onClose} style={{
position: ‘fixed’, inset: 0, zIndex: 300,
background: ‘rgba(0,0,0,0.42)’, backdropFilter: ‘blur(6px)’,
WebkitBackdropFilter: ‘blur(6px)’,
}} />
<div style={{
position: ‘fixed’,
top: ‘50%’, left: ‘50%’,
transform: ‘translate(-50%, -50%)’,
zIndex: 301,
background: dark ? ‘#1E0A10’ : ‘#fff’,
borderRadius: 18, overflow: ‘hidden’,
minWidth: 230,
boxShadow: ‘0 8px 40px rgba(0,0,0,0.28)’,
border: ‘0.5px solid rgba(200,51,74,0.14)’,
animation: ‘msgIn 0.18s ease both’,
}}>
{/* Реакции — верхний блок (как в tweb) */}
<div style={{
display: ‘flex’, gap: 2, padding: ‘10px 12px’,
borderBottom: ‘0.5px solid rgba(200,51,74,0.08)’,
justifyContent: ‘center’,
}}>
{[‘❤️’,‘🔥’,‘😍’,‘😂’,‘👍’,‘💔’].map(r => (
<button key={r}
onClick={() => { onReact(menu.msgId, r); onClose() }}
style={{
fontSize: 24, padding: ‘3px 5px’,
background: ‘none’, border: ‘none’, cursor: ‘pointer’,
borderRadius: 8, transition: ‘transform .15s’,
}}
onMouseEnter={e => e.currentTarget.style.transform = ‘scale(1.32)’}
onMouseLeave={e => e.currentTarget.style.transform = ‘scale(1)’}
>{r}</button>
))}
</div>

```
    {/* Ответить */}
    <button style={ITEM_STYLE} onClick={() => { onReply(menu.msgId); onClose() }}>
      <SVG d={['M9 17l-5-5 5-5','M4 12h11a4 4 0 010 8h-1']} />
      Ответить
    </button>

    {/* Редактировать — только своё */}
    {menu.isMe && (
      <button style={ITEM_STYLE} onClick={() => { onEdit(menu.msgId, menu.text); onClose() }}>
        <SVG d={['M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7','M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z']} />
        Редактировать
      </button>
    )}

    {/* Копировать */}
    {menu.text && (
      <button style={ITEM_STYLE} onClick={() => { navigator.clipboard?.writeText(menu.text); onClose() }}>
        <SVG d={['M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2','M16 2H8a2 2 0 000 4h8a2 2 0 000-4z']} />
        Копировать
      </button>
    )}

    {/* Закрепить */}
    <button style={ITEM_STYLE} onClick={() => { onPin(menu.msgId); onClose() }}>
      <SVG d={['M12 17v5','M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17z']} />
      {menu.isPinned ? 'Открепить' : 'Закрепить'}
    </button>

    {/* Удалить — только своё, красным */}
    {menu.isMe && (
      <button
        style={{ ...ITEM_STYLE, color: '#E24B4A', borderBottom: 'none' }}
        onClick={() => { onDelete(menu.msgId); onClose() }}
      >
        <SVG d={['M3 6h18','M19 6l-1 14H6L5 6','M10 11v6','M14 11v6','M9 6V4h6v2']} c="#E24B4A" />
        Удалить
      </button>
    )}
  </div>
</>
```

)
})

/* ════════════════════════════════════════
SearchOverlay
════════════════════════════════════════ */
const SearchOverlay = memo(function SearchOverlay({ messages, dark, onClose }) {
const [query, setQuery] = useState(’’)
const [idx,   setIdx]   = useState(0)

const SURF  = dark ? ‘#1E0A10’ : ‘#FFFFFF’
const INK   = dark ? ‘#F5E8EA’ : ‘#1C0A0E’
const MUTED = dark ? ‘#8A5060’ : ‘#9A6070’
const BDR   = dark ? ‘rgba(232,85,106,0.18)’ : ‘rgba(200,51,74,0.13)’

const results = useMemo(() => {
if (!query.trim()) return []
const q = query.toLowerCase()
return messages.filter(m => m.text?.toLowerCase().includes(q))
}, [query, messages])

function goTo(i) {
const msg = results[i]
if (!msg) return
setIdx(i)
const el = document.querySelector(`[data-msg-id="${msg.id}"]`)
el?.scrollIntoView({ behavior: ‘smooth’, block: ‘center’ })
}

useEffect(() => {
const onKey = e => {
if (e.key === ‘Escape’) onClose()
if (e.key === ‘ArrowUp’)   { e.preventDefault(); goTo(Math.max(0, idx - 1)) }
if (e.key === ‘ArrowDown’) { e.preventDefault(); goTo(Math.min(results.length - 1, idx + 1)) }
}
window.addEventListener(‘keydown’, onKey)
return () => window.removeEventListener(‘keydown’, onKey)
}, [idx, results.length])

function highlight(text) {
if (!text || !query.trim()) return text || ‘’
return text.replace(
new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, ‘gi’),
‘<mark style="background:rgba(200,51,74,0.3);border-radius:2px;padding:0 1px">$1</mark>’
)
}

return (
<div style={{
position: ‘absolute’, inset: 0, zIndex: 50,
background: SURF, display: ‘flex’, flexDirection: ‘column’,
}}>
<div style={{
padding: ‘10px 14px’, display: ‘flex’, alignItems: ‘center’, gap: 10,
borderBottom: `0.5px solid ${BDR}`, flexShrink: 0,
}}>
<button onClick={onClose} style={{
background: ‘none’, border: ‘none’, cursor: ‘pointer’,
color: ‘#C8334A’, fontSize: 20, lineHeight: 1, padding: ‘2px 4px’,
WebkitTapHighlightColor: ‘transparent’,
}}>←</button>
<input
autoFocus
value={query}
onChange={e => { setQuery(e.target.value); setIdx(0) }}
placeholder=“Поиск по сообщениям…”
style={{
flex: 1, border: ‘none’, background: ‘none’,
fontSize: 15, color: INK, outline: ‘none’,
fontFamily: “‘DM Sans’,sans-serif”,
}}
/>
{results.length > 0 && (
<div style={{ display: ‘flex’, alignItems: ‘center’, gap: 6, flexShrink: 0 }}>
<span style={{ fontSize: 12, color: MUTED }}>{idx + 1}/{results.length}</span>
<button onClick={() => goTo(Math.max(0, idx - 1))} style={{
background: ‘none’, border: ‘none’, cursor: ‘pointer’,
color: ‘#C8334A’, fontSize: 16, padding: ‘2px 4px’,
}}>↑</button>
<button onClick={() => goTo(Math.min(results.length - 1, idx + 1))} style={{
background: ‘none’, border: ‘none’, cursor: ‘pointer’,
color: ‘#C8334A’, fontSize: 16, padding: ‘2px 4px’,
}}>↓</button>
</div>
)}
</div>

```
  <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
    {query && results.length === 0 && (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: MUTED, fontSize: 14 }}>
        Ничего не найдено
      </div>
    )}
    {results.map((msg, i) => (
      <div key={msg.id} onClick={() => goTo(i)} style={{
        padding: '10px 16px',
        borderBottom: `0.5px solid ${BDR}`,
        background: i === idx ? 'rgba(200,51,74,0.08)' : 'none',
        cursor: 'pointer',
      }}>
        <div style={{ fontSize: 11, color: '#C8334A', marginBottom: 3 }}>
          {fmtDateSep(msg.created_at)}
        </div>
        <div style={{ fontSize: 14, color: INK }}
          dangerouslySetInnerHTML={{ __html: highlight(msg.text) || '' }}
        />
      </div>
    ))}
  </div>
</div>
```

)
})

/* ════════════════════════════════════════
ГЛАВНЫЙ КОМПОНЕНТ Chat
════════════════════════════════════════ */
export default function Chat({ session, profile, darkMode }) {
/* ── данные ── */
const [messages,      setMessages]      = useState([])
const [partner,       setPartner]       = useState(null)
const [loading,       setLoading]       = useState(true)
const [loadingMore,   setLoadingMore]   = useState(false)
const [allLoaded,     setAllLoaded]     = useState(false)

/* ── UI ── */
const [newText,       setNewText]       = useState(’’)
const [sending,       setSending]       = useState(false)
const [showDown,      setShowDown]      = useState(false)
const [showSearch,    setShowSearch]    = useState(false)
const [partnerTyping, setPartnerTyping] = useState(false)

/* ── медиа ── */
const [photoFile,     setPhotoFile]     = useState(null)
const [photoPreview,  setPhotoPreview]  = useState(null)
const [recording,     setRecording]     = useState(false)
const [voiceRec,      setVoiceRec]      = useState(false)
const [recSec,        setRecSec]        = useState(0)

/* ── действия с сообщениями ── */
const [editingId,     setEditingId]     = useState(null)
const [replyTo,       setReplyTo]       = useState(null)
const [ctxMenu,       setCtxMenu]       = useState(null)

/* ── refs ── */
const listRef       = useRef(null)
const endRef        = useRef(null)
const photoRef      = useRef(null)
const videoFileRef  = useRef(null)
const previewVidRef = useRef(null)
const recorderRef   = useRef(null)
const chunksRef     = useRef([])
const streamRef     = useRef(null)
const voiceRecRef   = useRef(null)
const voiceChunks   = useRef([])
const voiceStream   = useRef(null)
const typingTimer   = useRef(null)
const recTimer      = useRef(null)

const dark  = darkMode
const BG    = dark ? ‘#200A10’ : ‘#FBF0F2’
const SURF  = dark ? ‘#1E0A10’ : ‘#FFFFFF’
const SURF2 = dark ? ‘#3D1520’ : ‘#FBF0F2’
const INK   = dark ? ‘#F5E8EA’ : ‘#1C0A0E’
const MUTED = dark ? ‘#8A5060’ : ‘#9A6070’
const BDR   = dark ? ‘rgba(232,85,106,0.18)’ : ‘rgba(200,51,74,0.13)’
const GRAD  = ‘linear-gradient(135deg,#C8334A,#8B1A2C)’

const uid   = session?.user?.id

/* ── load on mount ── */
useEffect(() => {
loadMessages()
loadPartner()

```
const ch = supabase.channel('chat-main')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => {
    setMessages(prev => prev.find(m => m.id === p.new.id) ? prev : [...prev, p.new])
    setTimeout(scrollDown, 60)
  })
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, p => {
    setMessages(prev => prev.map(m => m.id === p.new.id ? p.new : m))
  })
  .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, p => {
    setMessages(prev => prev.filter(m => m.id !== p.old.id))
  })
  .subscribe()

return () => supabase.removeChannel(ch)
```

}, [])

/* ── typing subscriptions ── */
useEffect(() => {
if (!partner?.id) return
const ch = supabase.channel(‘typing-status’)
.on(‘postgres_changes’, {
event: ‘UPDATE’, schema: ‘public’, table: ‘typing_status’,
filter: `user_id=eq.${partner.id}`,
}, p => setPartnerTyping(!!p.new.is_typing))
.subscribe()
return () => supabase.removeChannel(ch)
}, [partner?.id])

/* ── functions ── */
async function loadMessages() {
const { data } = await supabase
.from(‘messages’).select(’*’)
.order(‘created_at’, { ascending: false })
.limit(50)
setMessages((data || []).reverse())
setLoading(false)
setTimeout(scrollDown, 120)
}

async function loadPartner() {
if (!profile?.partner_id) return
const { data } = await supabase
.from(‘profiles’).select(’*’).eq(‘id’, profile.partner_id).single()
setPartner(data)
}

async function loadMore() {
if (loadingMore || allLoaded || !messages.length) return
setLoadingMore(true)
const oldest = messages[0].created_at
const { data } = await supabase
.from(‘messages’).select(’*’)
.lt(‘created_at’, oldest)
.order(‘created_at’, { ascending: false })
.limit(50)
if (!data || data.length < 50) setAllLoaded(true)
setMessages(prev => […(data || []).reverse(), …prev])
setLoadingMore(false)
}

function scrollDown() { endRef.current?.scrollIntoView({ behavior: ‘smooth’ }) }

function handleScroll() {
const el = listRef.current; if (!el) return
const dist = el.scrollHeight - el.scrollTop - el.clientHeight
setShowDown(dist > SCROLL_THRESHOLD)
if (el.scrollTop < 100 && !loadingMore && !allLoaded) loadMore()
}

/* ── upload ── */
async function upload(file, folder) {
const ext  = file.name?.split(’.’).pop() || ‘bin’
const name = `${Date.now()}-${Math.random().toString(36).slice(6)}.${ext}`
const { error } = await supabase.storage.from(‘photos’).upload(`${folder}/${name}`, file)
if (error) throw error
return supabase.storage.from(‘photos’).getPublicUrl(`${folder}/${name}`).data.publicUrl
}

/* ── photo ── */
async function onPhotoChange(e) {
const file = e.target.files?.[0]; if (!file) return
const blob = await compressImage(file)
const compressed = new File([blob], file.name, { type: ‘image/jpeg’ })
setPhotoFile(compressed)
setPhotoPreview(URL.createObjectURL(compressed))
}

function cancelPhoto() {
setPhotoFile(null); setPhotoPreview(null)
if (photoRef.current) photoRef.current.value = ‘’
}

/* ── send ── */
async function handleSend() {
if (!newText.trim() && !photoFile) return
setSending(true)
try {
let photoUrl = null
if (photoFile) photoUrl = await upload(photoFile, ‘chat’)
if (editingId) {
await supabase.from(‘messages’)
.update({ text: newText.trim(), edited_at: new Date().toISOString() })
.eq(‘id’, editingId)
setEditingId(null)
} else {
await supabase.from(‘messages’).insert({
user_id: uid,
text: newText.trim() || null,
photo_url: photoUrl,
reply_to_id: replyTo?.id || null,
})
}
setNewText(’’); cancelPhoto(); setReplyTo(null); scrollDown()

```
  // Сброс typing
  clearTimeout(typingTimer.current)
  supabase.from('typing_status').upsert({ user_id: uid, is_typing: false, updated_at: new Date().toISOString() })
} catch (e) { console.error(e) }
setSending(false)
```

}

function handleKey(e) {
if (e.key === ‘Enter’ && !e.shiftKey) { e.preventDefault(); handleSend() }
if (e.key === ‘Escape’) { setReplyTo(null); setEditingId(null); setNewText(’’) }
}

/* ── typing indicator ── */
function handleTextChange(e) {
setNewText(e.target.value)
clearTimeout(typingTimer.current)
supabase.from(‘typing_status’).upsert({ user_id: uid, is_typing: true, updated_at: new Date().toISOString() })
typingTimer.current = setTimeout(() => {
supabase.from(‘typing_status’).upsert({ user_id: uid, is_typing: false, updated_at: new Date().toISOString() })
}, 3000)
}

/* ── video circle ── */
async function startRecord() {
try {
const stream = await navigator.mediaDevices.getUserMedia({
video: { facingMode: ‘user’, width: 300, height: 300 }, audio: true,
})
streamRef.current = stream
if (previewVidRef.current) {
previewVidRef.current.srcObject = stream
previewVidRef.current.play()
}
const mime = MediaRecorder.isTypeSupported(‘video/webm;codecs=vp9’)
? ‘video/webm;codecs=vp9’ : ‘video/webm’
const rec = new MediaRecorder(stream, { mimeType: mime })
recorderRef.current = rec
chunksRef.current   = []
let sec = 0
setRecSec(0)
recTimer.current = setInterval(() => { sec++; setRecSec(sec) }, 1000)

```
  rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
  rec.onstop = async () => {
    clearInterval(recTimer.current)
    stream.getTracks().forEach(t => t.stop())
    if (previewVidRef.current) previewVidRef.current.srcObject = null
    streamRef.current = null
    const blob = new Blob(chunksRef.current, { type: 'video/webm' })
    const file = new File([blob], `circle-${Date.now()}.webm`, { type: 'video/webm' })
    setSending(true)
    try {
      const url = await upload(file, 'circles')
      await supabase.from('messages').insert({ user_id: uid, video_url: url, is_video_circle: true })
      scrollDown()
    } catch (e) { console.error(e) }
    setSending(false); setRecording(false); setRecSec(0)
  }
  rec.start()
  setRecording(true)
  setTimeout(() => { if (recorderRef.current?.state === 'recording') recorderRef.current.stop() }, 60000)
} catch (e) { console.error(e); alert('Нет доступа к камере') }
```

}

function stopRecord() { if (recorderRef.current?.state === ‘recording’) recorderRef.current.stop() }

function cancelRecord() {
clearInterval(recTimer.current)
if (recorderRef.current?.state === ‘recording’) recorderRef.current.stop()
streamRef.current?.getTracks().forEach(t => t.stop())
if (previewVidRef.current) previewVidRef.current.srcObject = null
streamRef.current = null; chunksRef.current = []
setRecording(false); setRecSec(0)
}

async function onVideoFile(e) {
const file = e.target.files?.[0]; if (!file) return
setSending(true)
try {
const url = await upload(file, ‘circles’)
await supabase.from(‘messages’).insert({ user_id: uid, video_url: url, is_video_circle: true })
scrollDown()
} catch (e) { console.error(e) }
setSending(false)
if (videoFileRef.current) videoFileRef.current.value = ‘’
}

/* ── voice recording ── */
async function startVoice() {
try {
const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
voiceStream.current = stream
const mime = MediaRecorder.isTypeSupported(‘audio/webm;codecs=opus’)
? ‘audio/webm;codecs=opus’ : ‘audio/webm’
const rec = new MediaRecorder(stream, { mimeType: mime })
voiceRecRef.current = rec
voiceChunks.current = []
let sec = 0
setRecSec(0)
recTimer.current = setInterval(() => { sec++; setRecSec(sec) }, 1000)
rec.ondataavailable = e => { if (e.data.size > 0) voiceChunks.current.push(e.data) }
rec.onstop = async () => {
clearInterval(recTimer.current)
stream.getTracks().forEach(t => t.stop())
voiceStream.current = null
const blob = new Blob(voiceChunks.current, { type: ‘audio/webm’ })
const file = new File([blob], `voice-${Date.now()}.webm`, { type: ‘audio/webm’ })
setSending(true)
try {
const url = await upload(file, ‘voices’)
await supabase.from(‘messages’).insert({
user_id: uid, audio_url: url, is_voice: true, duration: sec,
})
scrollDown()
} catch (e) { console.error(e) }
setSending(false); setVoiceRec(false); setRecSec(0)
}
rec.start()
setVoiceRec(true)
} catch (e) { console.error(e); alert(‘Нет доступа к микрофону’) }
}

function stopVoice() {
clearInterval(recTimer.current)
if (voiceRecRef.current?.state === ‘recording’) voiceRecRef.current.stop()
}

/* ── message actions ── */
const deleteMsg = useCallback(async id => {
await supabase.from(‘messages’).delete().eq(‘id’, id)
}, [])

const pinMsg = useCallback(async id => {
const m = messages.find(x => x.id === id); if (!m) return
await supabase.from(‘messages’).update({ is_pinned: !m.is_pinned }).eq(‘id’, id)
}, [messages])

const addReact = useCallback(async (msgId, emoji) => {
if (!VALID_REACTIONS.has(emoji)) return
const m = messages.find(x => x.id === msgId); if (!m) return
const r = { …(m.reactions || {}) }
if (r[emoji]?.includes(uid)) {
r[emoji] = r[emoji].filter(x => x !== uid)
if (!r[emoji].length) delete r[emoji]
} else {
r[emoji] = […(r[emoji] || []), uid]
}
await supabase.from(‘messages’).update({ reactions: r }).eq(‘id’, msgId)
}, [messages, uid])

function openCtx(msg, x, y) {
setCtxMenu({
msgId: msg.id,
text:  msg.text || ‘’,
isMe:  msg.user_id === uid,
isPinned: !!msg.is_pinned,
x, y,
})
}

function scrollToMsg(id) {
const el = document.querySelector(`[data-msg-id="${id}"]`)
el?.scrollIntoView({ behavior: ‘smooth’, block: ‘center’ })
}

/* ── pinned ── */
const pinned = messages.find(m => m.is_pinned)

/* ── icon button helper ── */
const iconBtnStyle = (active) => ({
width: 36, height: 36, borderRadius: ‘50%’, border: ‘none’,
background: active ? GRAD : ‘rgba(200,51,74,0.09)’,
display: ‘flex’, alignItems: ‘center’, justifyContent: ‘center’,
cursor: ‘pointer’, flexShrink: 0,
WebkitTapHighlightColor: ‘transparent’,
transition: ‘transform .12s’,
})

/* ── LOADING ── */
if (loading) return (
<div style={{ display: ‘flex’, alignItems: ‘center’, justifyContent: ‘center’,
height: ‘100%’, background: BG }}>
<div style={{ animation: ‘heartbeat 1.4s ease-in-out infinite’ }}>
<svg viewBox="0 0 60 56" width="68" height="64" fill="none">
<path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z" fill="url(#hgr)"/>
<defs>
<linearGradient id="hgr" x1="0" y1="0" x2="60" y2="56" gradientUnits="userSpaceOnUse">
<stop offset="0%" stopColor="#E8556A"/>
<stop offset="100%" stopColor="#C8334A"/>
</linearGradient>
</defs>
</svg>
</div>
</div>
)

const pName   = partner?.name || (profile?.name === ‘Антон’ ? ‘Эльвира’ : ‘Антон’)
const pAvatar = partner?.avatar_url

/* ════════════════════════════════════════
RENDER
════════════════════════════════════════ */
return (
<div style={{
display: ‘flex’, flexDirection: ‘column’, height: ‘100%’,
background: BG, position: ‘relative’, overflow: ‘hidden’,
WebkitOverflowScrolling: ‘touch’,
}}>

```
  {/* ═══ ШАПКА ═══ */}
  <div style={{
    flexShrink: 0, background: SURF, borderBottom: `0.5px solid ${BDR}`,
    paddingTop: 'max(10px, env(safe-area-inset-top, 0px))',
    paddingBottom: 10, paddingLeft: 14, paddingRight: 14,
    display: 'flex', alignItems: 'center', gap: 11, zIndex: 20,
    WebkitTransform: 'translateZ(0)', transform: 'translateZ(0)',
  }}>
    {/* Аватар */}
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: 42, height: 42, borderRadius: '50%', overflow: 'hidden',
        background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {pAvatar
          ? <img src={pAvatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
              <circle cx="20" cy="15" r="7" fill="rgba(255,255,255,.85)" />
              <path d="M5 37c0-8.3 6.7-15 15-15s15 6.7 15 15" fill="rgba(255,255,255,.65)" />
            </svg>
        }
      </div>
      <div style={{
        width: 10, height: 10, background: '#4CAF50', borderRadius: '50%',
        border: `2px solid ${SURF}`, position: 'absolute', bottom: 1, right: 1,
        animation: 'pulse 2s ease-in-out infinite',
      }} />
    </div>

    {/* Имя + статус */}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontFamily: "'Cormorant Garamond',serif", fontSize: 16,
        fontWeight: 600, color: INK,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{pName}</div>
      <div style={{ fontSize: 11, color: partnerTyping ? '#4CAF50' : MUTED, transition: 'color .3s' }}>
        {partnerTyping ? 'печатает...' : 'только для нас двоих'}
      </div>
    </div>

    {/* Поиск */}
    <button style={iconBtnStyle(false)} onClick={() => setShowSearch(true)}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#C8334A" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    </button>

    {/* Видеозвонок */}
    <button style={iconBtnStyle(false)}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#C8334A" strokeWidth="2" strokeLinecap="round">
        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
      </svg>
    </button>
  </div>

  {/* ═══ ЗАКРЕПЛЁННОЕ ═══ */}
  {pinned && (
    <div style={{
      flexShrink: 0, background: dark ? 'rgba(200,51,74,0.07)' : 'rgba(200,51,74,0.04)',
      borderBottom: `0.5px solid rgba(200,51,74,0.12)`,
      padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{ width: 3, height: 34, background: '#C8334A', borderRadius: 3, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: '#C8334A', fontWeight: 500, marginBottom: 1 }}>Закреплено</div>
        <div style={{ fontSize: 13, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pinned.text || 'Фото'}
        </div>
      </div>
      <button onClick={() => pinMsg(pinned.id)} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: MUTED, fontSize: 18, lineHeight: 1, padding: '2px 4px',
        WebkitTapHighlightColor: 'transparent',
      }}>×</button>
    </div>
  )}

  {/* ═══ ПРЕДПРОСМОТР КРУЖОЧКА ═══ */}
  {recording && (
    <div style={{
      flexShrink: 0, background: SURF, borderBottom: `0.5px solid ${BDR}`,
      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%', overflow: 'hidden',
        border: '2px solid #C8334A', flexShrink: 0,
      }}>
        {/* transform scaleX(-1) — зеркало как в tweb */}
        <video ref={previewVidRef} muted autoPlay playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#C8334A',
            animation: 'pulse 1s ease-in-out infinite' }} />
          <span style={{ fontSize: 13, color: '#C8334A', fontWeight: 500 }}>
            {fmtRecordTime(recSec)}
          </span>
        </div>
        <div style={{ fontSize: 11, color: MUTED }}>Нажми «Отправить» когда закончишь</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={cancelRecord} style={{
          width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          WebkitTapHighlightColor: 'transparent',
        }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={MUTED} strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <button onClick={stopRecord} style={{
          padding: '8px 16px', borderRadius: 20, background: GRAD,
          color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}>Отправить</button>
      </div>
    </div>
  )}

  {/* ═══ ГОЛОСОВАЯ ЗАПИСЬ ═══ */}
  {voiceRec && (
    <div style={{
      flexShrink: 0, background: SURF, borderBottom: `0.5px solid ${BDR}`,
      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#C8334A',
          animation: 'pulse 0.8s ease-in-out infinite' }} />
        <span style={{ fontSize: 14, color: '#C8334A', fontWeight: 500 }}>
          {fmtRecordTime(recSec)}
        </span>
        <span style={{ fontSize: 12, color: MUTED, marginLeft: 4 }}>Запись голосового...</span>
      </div>
      <button onClick={stopVoice} style={{
        padding: '8px 16px', borderRadius: 20, background: GRAD,
        color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}>Отправить</button>
    </div>
  )}

  {/* ═══ СПИСОК СООБЩЕНИЙ ═══ */}
  <div ref={listRef} onScroll={handleScroll} style={{
    flex: 1, overflowY: 'auto', padding: '8px 8px 4px',
    display: 'flex', flexDirection: 'column',
    WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
    minHeight: 0,
  }}>
    {/* Подгрузка старых */}
    {loadingMore && (
      <div style={{ textAlign: 'center', padding: 10 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%',
          border: '2px solid #C8334A', borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
      </div>
    )}
    {allLoaded && messages.length > 0 && (
      <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 11, color: MUTED }}>
        Начало переписки
      </div>
    )}

    {messages.length === 0 && (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', flex: 1, gap: 14, opacity: 0.45 }}>
        <svg viewBox="0 0 60 56" width="56" height="52" fill="none">
          <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z"
            fill="rgba(200,51,74,0.38)" />
        </svg>
        <p style={{ fontSize: 14, color: MUTED, fontFamily: "'DM Sans',sans-serif" }}>
          Напишите первое сообщение
        </p>
      </div>
    )}

    {messages.map((msg, i) => {
      const isMine  = msg.user_id === uid
      const prev    = messages[i - 1]
      const next    = messages[i + 1]
      const showDate = i === 0 || diffDate(prev.created_at, msg.created_at)
      const first   = isFirstInGroup(msg, prev)
      const last    = isLastInGroup(msg, next, uid)
      const showAv  = needAvatar(msg, next, uid)

      return (
        <div key={msg.id}>
          {showDate && (
            <div style={{ textAlign: 'center', margin: '10px 0' }}>
              <span style={{
                background: 'rgba(200,51,74,0.09)', padding: '3px 14px',
                borderRadius: 20, fontSize: 11, color: MUTED,
                fontFamily: "'DM Sans',sans-serif",
              }}>
                {fmtDateSep(msg.created_at)}
              </span>
            </div>
          )}
          <Message
            msg={msg}
            isMine={isMine}
            dark={dark}
            uid={uid}
            partnerName={pName}
            partnerAvatar={pAvatar}
            onLongPress={openCtx}
            onReact={addReact}
            isFirst={first}
            isLast={last}
            showAv={showAv}
            messages={messages}
            onReplyClick={scrollToMsg}
          />
        </div>
      )
    })}
    <div ref={endRef} />
  </div>

  {/* Кнопка вниз */}
  {showDown && (
    <button onClick={scrollDown} style={{
      position: 'absolute', bottom: 76, right: 14,
      width: 38, height: 38, borderRadius: '50%',
      background: dark ? '#1E0A10' : '#fff',
      border: `0.5px solid ${BDR}`,
      boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', zIndex: 15,
      WebkitTapHighlightColor: 'transparent',
    }}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#C8334A" strokeWidth="2" strokeLinecap="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>
  )}

  {/* Контекстное меню */}
  <ContextMenu
    menu={ctxMenu} dark={dark}
    onClose={() => setCtxMenu(null)}
    onEdit={(id, t) => { setEditingId(id); setNewText(t) }}
    onDelete={deleteMsg}
    onPin={pinMsg}
    onReply={id => {
      const m = messages.find(x => x.id === id)
      if (m) setReplyTo({ id: m.id, text: m.text, user_id: m.user_id, photo_url: m.photo_url })
    }}
    onReact={addReact}
  />

  {/* Оверлей поиска */}
  {showSearch && (
    <SearchOverlay messages={messages} dark={dark} onClose={() => setShowSearch(false)} />
  )}

  {/* ═══ Превью ответа ═══ */}
  {replyTo && (
    <div style={{
      flexShrink: 0, padding: '6px 14px', background: SURF,
      borderTop: `0.5px solid ${BDR}`, display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{ width: 3, height: 34, background: '#C8334A', borderRadius: 3, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: '#C8334A', fontWeight: 500 }}>
          {replyTo.user_id === uid ? 'Вы' : pName}
        </div>
        <div style={{ fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {replyTo.photo_url && !replyTo.text ? 'Фото' : (replyTo.text || '')}
        </div>
      </div>
      <button onClick={() => setReplyTo(null)} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: MUTED, fontSize: 18, lineHeight: 1, padding: '2px 4px',
        WebkitTapHighlightColor: 'transparent',
      }}>×</button>
    </div>
  )}

  {/* ═══ Режим редактирования ═══ */}
  {editingId && (
    <div style={{
      flexShrink: 0, padding: '5px 14px',
      background: 'rgba(200,51,74,0.06)',
      borderTop: '0.5px solid rgba(200,51,74,0.15)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#C8334A" strokeWidth="2" strokeLinecap="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
        <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z"/>
      </svg>
      <span style={{ flex: 1, fontSize: 12, color: '#C8334A', fontFamily: "'DM Sans',sans-serif" }}>
        Редактирование
      </span>
      <button onClick={() => { setEditingId(null); setNewText('') }} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: MUTED, fontSize: 18, lineHeight: 1, padding: '2px 4px',
        WebkitTapHighlightColor: 'transparent',
      }}>×</button>
    </div>
  )}

  {/* ═══ Превью фото ═══ */}
  {photoPreview && (
    <div style={{
      flexShrink: 0, padding: '8px 14px', background: SURF,
      borderTop: `0.5px solid ${BDR}`, display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <img src={photoPreview} style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, color: MUTED }}>Фото прикреплено</span>
      <button onClick={cancelPhoto} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: MUTED, fontSize: 18, lineHeight: 1,
        WebkitTapHighlightColor: 'transparent',
      }}>×</button>
    </div>
  )}

  {/* ═══ ПОЛЕ ВВОДА ═══ */}
  <div style={{
    flexShrink: 0, background: SURF, borderTop: `0.5px solid ${BDR}`,
    padding: '8px 10px',
    paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
    display: 'flex', alignItems: 'flex-end', gap: 7,
    WebkitTransform: 'translateZ(0)', transform: 'translateZ(0)',
  }}>

    {/* Фото */}
    <button style={iconBtnStyle(false)} onClick={() => photoRef.current?.click()}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#C8334A" strokeWidth="2" strokeLinecap="round">
        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
    </button>
    <input ref={photoRef} type="file" accept="image/*" onChange={onPhotoChange} style={{ display: 'none' }} />

    {/* Кружочек */}
    <button style={{
      ...iconBtnStyle(recording),
      animation: recording ? 'glow 1.4s ease-in-out infinite' : 'none',
    }} onClick={recording ? stopRecord : startRecord}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
        stroke={recording ? 'white' : '#C8334A'} strokeWidth="2" strokeLinecap="round">
        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
      </svg>
    </button>
    <input ref={videoFileRef} type="file" accept="video/*" onChange={onVideoFile} style={{ display: 'none' }} />

    {/* Textarea */}
    <div style={{
      flex: 1, background: SURF2, borderRadius: 22,
      border: `0.5px solid ${BDR}`, padding: '0 14px',
      display: 'flex', alignItems: 'flex-end', minWidth: 0,
    }}>
      <textarea
        value={newText}
        onChange={handleTextChange}
        onKeyDown={handleKey}
        placeholder="Сообщение..."
        rows={1}
        style={{
          flex: 1, border: 'none', background: 'none',
          padding: '10px 0', fontSize: 16, // 16px — обязательно для iOS!
          fontFamily: "'DM Sans',sans-serif", color: INK,
          resize: 'none', outline: 'none', maxHeight: 120,
          lineHeight: 1.45, width: '100%', WebkitAppearance: 'none',
        }}
        onInput={e => {
          e.target.style.height = 'auto'
          e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
        }}
      />
    </div>

    {/* Голосовой — только когда textarea пустой и нет фото */}
    {!newText.trim() && !photoFile && (
      <button
        style={{
          ...iconBtnStyle(voiceRec),
          animation: voiceRec ? 'glow 0.8s ease-in-out infinite' : 'none',
        }}
        onMouseDown={startVoice}
        onMouseUp={stopVoice}
        onTouchStart={e => { e.preventDefault(); startVoice() }}
        onTouchEnd={e => { e.preventDefault(); stopVoice() }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
          stroke={voiceRec ? 'white' : '#C8334A'} strokeWidth="2" strokeLinecap="round">
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
          <path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>
    )}

    {/* Отправить — когда есть текст или фото */}
    {(newText.trim() || photoFile) && (
      <button
        onClick={handleSend}
        disabled={sending}
        style={{
          ...iconBtnStyle(true),
          opacity: sending ? 0.6 : 1,
          animation: 'glow 3s ease-in-out infinite',
        }}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    )}
  </div>

</div>
```

)
}
