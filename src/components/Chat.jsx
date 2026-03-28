import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'

/* ── UTILS ── */
function pad(n) { return String(n).padStart(2, '0') }

function fmtTime(date) {
  const d = new Date(date)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtDateSep(date) {
  const d = new Date(date)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  
  if (target.getTime() === today.getTime()) return 'Сегодня'
  if (target.getTime() === yesterday.getTime()) return 'Вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function diffDate(a, b) {
  const d1 = new Date(a)
  const d2 = new Date(b)
  return d1.toDateString() !== d2.toDateString()
}

function isSameGroup(m1, m2) {
  if (!m1 || !m2) return false
  if (m1.user_id !== m2.user_id) return false
  return Math.abs(new Date(m2.created_at) - new Date(m1.created_at)) / 1000 <= 121
}

function isLastInGroup(msg, nextMsg, uid) {
  if (!nextMsg) return true
  if (msg.user_id !== nextMsg.user_id) return true
  return false
}

function isFirstInGroup(msg, prevMsg) {
  if (!prevMsg) return true
  if (msg.user_id !== prevMsg.user_id) return true
  return false
}

function needAvatar(msg, nextMsg, uid) {
  if (msg.user_id === uid) return false
  if (!nextMsg) return true
  if (msg.user_id !== nextMsg.user_id) return true
  return false
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

function parseText(text) {
  if (!text) return ''
  let escaped = escapeHtml(text)
  
  // Ссылки [text](url)
  escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#C8334A;text-decoration:none;">$1</a>')
  
  // Жирный **text**
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700;">$1</strong>')
  
  // Курсив *text*
  escaped = escaped.replace(/\*(.+?)\*/g, '<em style="font-style:italic;">$1</em>')
  
  // Код `text`
  escaped = escaped.replace(/`(.+?)`/g, '<code style="background:rgba(0,0,0,0.08);padding:2px 6px;border-radius:6px;font-family:monospace;">$1</code>')
  
  // Цитата > text
  escaped = escaped.replace(/^&gt;\s(.+)$/gm, '<div style="border-left:3px solid #C8334A;padding-left:12px;margin:4px 0;color:rgba(0,0,0,0.6);">$1</div>')
  
  return escaped
}

async function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        const maxSize = 1280
        
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        } else if (height > maxSize) {
          width = (width * maxSize) / height
          height = maxSize
        }
        
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }))
        }, 'image/jpeg', 0.85)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

const VALID_REACTIONS = new Set(['❤️', '🔥', '😍', '😂', '👍', '💔'])

function hasValidReactions(reactions) {
  if (!reactions) return false
  const keys = Object.keys(reactions)
  return keys.some(k => VALID_REACTIONS.has(k))
}

/* ── SVG ICONS ── */
function IcoPhoto() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <circle cx="8.5" cy="10.5" r="2.5" />
      <path d="M21 15l-5-4-3 3-4-4-5 5" />
    </svg>
  )
}

function IcoCircle() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </svg>
  )
}

function IcoMic() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  )
}

function IcoSend() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function IcoClose() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IcoReply() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="3 11 9 5 9 9 15 9 15 13 9 13 9 17 3 11" />
    </svg>
  )
}

function IcoEdit() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z" />
    </svg>
  )
}

function IcoCopy() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function IcoPin() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1V4h-8v2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z" />
    </svg>
  )
}

function IcoDelete() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

function IcoVideo() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="6" width="16" height="12" rx="2" />
      <polygon points="22 8 18 12 22 16 22 8" />
    </svg>
  )
}

function IcoReaction({ emoji, size = 28 }) {
  return (
    <span style={{ fontSize: size, lineHeight: 1 }}>{emoji}</span>
  )
}

/* ── CONTEXT MENU ── */
function ContextMenu({ x, y, msg, isMine, onReact, onReply, onEdit, onCopy, onPin, onDelete, onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(6px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 16,
          padding: 12,
          minWidth: 200,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Reactions row */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          {['❤️', '🔥', '😍', '😂', '👍', '💔'].map(emoji => (
            <button
              key={emoji}
              onClick={() => { onReact(msg.id, emoji); onClose() }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 28,
                cursor: 'pointer',
                padding: 4,
                transition: 'transform 0.1s',
              }}
              onMouseDown={e => e.target.style.transform = 'scale(0.9)'}
              onMouseUp={e => e.target.style.transform = 'scale(1)'}
            >
              {emoji}
            </button>
          ))}
        </div>
        
        {/* Actions */}
        <div style={{ marginTop: 8 }}>
          <MenuItem icon={<IcoReply />} label="Ответить" onClick={() => { onReply(msg); onClose() }} />
          {isMine && <MenuItem icon={<IcoEdit />} label="Редактировать" onClick={() => { onEdit(msg); onClose() }} />}
          {msg.text && <MenuItem icon={<IcoCopy />} label="Копировать" onClick={() => { onCopy(msg.text); onClose() }} />}
          <MenuItem icon={<IcoPin />} label={msg.is_pinned ? "Открепить" : "Закрепить"} onClick={() => { onPin(msg.id); onClose() }} />
          {isMine && <MenuItem icon={<IcoDelete />} label="Удалить" onClick={() => { onDelete(msg.id); onClose() }} danger />}
        </div>
      </div>
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '10px 12px',
        background: 'none',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        color: danger ? '#E24B4A' : '#1C0A0E',
        fontSize: 15,
        fontFamily: 'DM Sans, sans-serif',
        transition: 'background 0.1s',
      }}
      onMouseDown={e => e.target.style.background = 'rgba(0,0,0,0.05)'}
      onMouseUp={e => e.target.style.background = 'none'}
    >
      <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

/* ── MESSAGE COMPONENT ── */
const Message = React.memo(function Message({
  msg, isMine, dark, partnerName, partnerAvatar,
  onLongPress, onReact, onReply, onEdit, onCopy, onPin, onDelete,
  isFirst, isLast, showAv, messages, replyMsg
}) {
  const timerRef = useRef(null)
  const movedRef = useRef(false)
  const posRef = useRef({ x: 0, y: 0 })
  const lastTapRef = useRef(0)

  const bg = isMine ? GRAD : (dark ? SURF : '#FFFFFF')
  const color = isMine ? '#FFFFFF' : INK
  
  const borderRadius = isMine
    ? isLast ? '18px 18px 4px 18px' : '18px 18px 8px 18px'
    : isLast ? '18px 18px 18px 4px' : '18px 18px 18px 8px'

  const handleTouchStart = (e) => {
    movedRef.current = false
    const touch = e.touches[0]
    posRef.current = { x: touch.clientX, y: touch.clientY }
    timerRef.current = setTimeout(() => {
      if (!movedRef.current) onLongPress()
    }, 500)
  }

  const handleTouchMove = (e) => {
    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - posRef.current.x)
    const dy = Math.abs(touch.clientY - posRef.current.y)
    if (dx > 10 || dy > 10) {
      movedRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }

  const handleTouchEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  const handleDoubleTap = () => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      onReact(msg.id, '❤️')
    }
    lastTapRef.current = now
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMine ? 'flex-end' : 'flex-start',
        marginTop: isFirst ? 12 : 4,
        marginBottom: isLast ? 12 : 2,
        paddingLeft: !isMine && showAv ? 48 : 16,
        paddingRight: isMine ? 16 : 16,
      }}
    >
      {/* Avatar */}
      {!isMine && showAv && (
        <div
          style={{
            position: 'absolute',
            left: 12,
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: partnerAvatar ? `url(${partnerAvatar}) center/cover` : GRAD,
            marginTop: -8,
          }}
        />
      )}
      
      {/* Reply preview */}
      {msg.reply_to_id && replyMsg && (
        <div
          style={{
            background: dark ? SURF2 : '#F2F2F2',
            borderRadius: 12,
            padding: '6px 10px',
            marginBottom: 4,
            maxWidth: 260,
            borderLeft: `3px solid ${GRAD}`,
          }}
        >
          <div style={{ fontSize: 12, color: '#C8334A', fontWeight: 600 }}>
            {replyMsg.user_id === msg.user_id ? 'Вы' : partnerName}
          </div>
          <div style={{ fontSize: 13, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {replyMsg.text?.slice(0, 60)}
          </div>
        </div>
      )}
      
      {/* Bubble */}
      <div
        style={{
          maxWidth: '75%',
          background: bg,
          borderRadius,
          padding: '8px 12px',
          position: 'relative',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleDoubleTap}
      >
        {/* Photo/video content */}
        {msg.is_video_circle && msg.video_url ? (
          <video
            src={msg.video_url}
            style={{ width: 180, height: 180, borderRadius: '50%', objectFit: 'cover' }}
            controls
          />
        ) : msg.photo_url ? (
          <img
            src={msg.photo_url}
            alt=""
            style={{ maxWidth: 280, maxHeight: 280, borderRadius: 12, cursor: 'pointer' }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : msg.text ? (
          <div
            style={{ color, fontSize: 15, lineHeight: 1.45, wordBreak: 'break-word' }}
            dangerouslySetInnerHTML={{ __html: parseText(msg.text) }}
          />
        ) : null}
        
        {/* Time */}
        <div style={{ fontSize: 11, color: isMine ? 'rgba(255,255,255,0.6)' : MUTED, marginTop: 4, textAlign: 'right' }}>
          {fmtTime(msg.created_at)}
          {msg.edited_at && <span style={{ marginLeft: 4 }}>(ред.)</span>}
        </div>
      </div>
      
      {/* Reactions */}
      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginTop: 2, marginRight: 4 }}>
          {Object.entries(msg.reactions).map(([emoji, users]) => (
            VALID_REACTIONS.has(emoji) && users.length > 0 && (
              <button
                key={emoji}
                onClick={() => onReact(msg.id, emoji)}
                style={{
                  background: dark ? SURF2 : '#F0F0F0',
                  borderRadius: 20,
                  padding: '2px 6px',
                  fontSize: 13,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>{emoji}</span>
                <span style={{ fontSize: 11, color: MUTED }}>{users.length}</span>
              </button>
            )
          ))}
        </div>
      )}
    </div>
  )
})

/* ── MAIN CHAT COMPONENT ── */
export default function Chat({ session, profile, darkMode }) {
  const [messages, setMessages] = useState([])
  const [partner, setPartner] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [allLoaded, setAllLoaded] = useState(false)
  const [newText, setNewText] = useState('')
  const [sending, setSending] = useState(false)
  const [showDown, setShowDown] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [ctxMenu, setCtxMenu] = useState(null)
  const [pinnedMsg, setPinnedMsg] = useState(null)
  
  const listRef = useRef(null)
  const endRef = useRef(null)
  const photoRef = useRef(null)
  
  const uid = session?.user?.id
  const BG = darkMode ? '#200A10' : '#FBF0F2'
  const SURF = darkMode ? '#1E0A10' : '#FFFFFF'
  const SURF2 = darkMode ? '#3D1520' : '#FBF0F2'
  const INK = darkMode ? '#F5E8EA' : '#1C0A0E'
  const MUTED = darkMode ? '#8A5060' : '#9A6070'
  const BDR = darkMode ? 'rgba(232,85,106,0.18)' : 'rgba(200,51,74,0.13)'
  const GRAD = 'linear-gradient(135deg, #C8334A, #8B1A2C)'
  
  // Load partner info
  useEffect(() => {
    if (profile?.partner_id) {
      supabase.from('profiles').select('*').eq('id', profile.partner_id).single().then(({ data }) => {
        setPartner(data)
      })
    }
  }, [profile])
  
  // Load messages
  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setMessages((data || []).reverse())
    setLoading(false)
    setTimeout(() => {
      if (endRef.current) endRef.current.scrollIntoView({ behavior: 'auto' })
    }, 100)
  }, [])
  
  // Load more
  const loadMore = useCallback(async () => {
    if (loadingMore || allLoaded || !messages.length) return
    setLoadingMore(true)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .lt('created_at', messages[0].created_at)
      .order('created_at', { ascending: false })
      .limit(50)
    if (!data || data.length < 50) setAllLoaded(true)
    setMessages(prev => [...(data || []).reverse(), ...prev])
    setLoadingMore(false)
  }, [loadingMore, allLoaded, messages])
  
  // Scroll handler
  const handleScroll = useCallback((e) => {
    const el = e.currentTarget
    if (!el) return
    setShowDown(el.scrollHeight - el.scrollTop - el.clientHeight > 300)
    if (el.scrollTop < 100 && !loadingMore && !allLoaded) loadMore()
  }, [loadingMore, allLoaded, loadMore])
  
  const scrollDown = () => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' })
  }
  
  // Upload photo
  const uploadPhoto = async (file) => {
    const compressed = await compressImage(file)
    const ext = compressed.name.split('.').pop()
    const path = `chat/${Date.now()}-${Math.random().toString(36).slice(7)}.${ext}`
    const { error } = await supabase.storage.from('photos').upload(path, compressed)
    if (error) throw error
    return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
  }
  
  // Send message
  const sendMessage = async () => {
    if ((!newText.trim() && !photoFile) || sending) return
    
    setSending(true)
    try {
      let photoUrl = null
      if (photoFile) {
        photoUrl = await uploadPhoto(photoFile)
      }
      
      const msgData = {
        user_id: uid,
        text: newText.trim() || null,
        photo_url: photoUrl,
        reply_to_id: replyTo?.id || null,
      }
      
      if (editingId) {
        await supabase.from('messages').update({
          text: msgData.text,
          edited_at: new Date().toISOString(),
        }).eq('id', editingId)
      } else {
        await supabase.from('messages').insert(msgData)
      }
      
      setNewText('')
      setPhotoFile(null)
      setPhotoPreview(null)
      setReplyTo(null)
      setEditingId(null)
      setTimeout(scrollDown, 100)
    } catch (err) {
      console.error(err)
    }
    setSending(false)
  }
  
  // Delete message
  const deleteMsg = async (id) => {
    await supabase.from('messages').delete().eq('id', id)
  }
  
  // Pin message
  const pinMsg = async (id) => {
    const msg = messages.find(m => m.id === id)
    await supabase.from('messages').update({ is_pinned: !msg?.is_pinned }).eq('id', id)
    if (!msg?.is_pinned) {
      const { data } = await supabase.from('messages').select('*').eq('id', id).single()
      setPinnedMsg(data)
    } else {
      setPinnedMsg(null)
    }
  }
  
  // Add/remove reaction
  const addReact = async (msgId, emoji) => {
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return
    
    let reactions = msg.reactions || {}
    const users = reactions[emoji] || []
    
    if (users.includes(uid)) {
      reactions[emoji] = users.filter(id => id !== uid)
      if (reactions[emoji].length === 0) delete reactions[emoji]
    } else {
      reactions[emoji] = [...users, uid]
    }
    
    await supabase.from('messages').update({ reactions }).eq('id', msgId)
  }
  
  // Copy text
  const copyText = (text) => {
    navigator.clipboard.writeText(text)
  }
  
  // Real-time subscription
  useEffect(() => {
    loadMessages()
    
    const channel = supabase.channel('chat-v1')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => [...prev, payload.new])
        setTimeout(scrollDown, 100)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .subscribe()
    
    return () => { supabase.removeChannel(channel) }
  }, [loadMessages])
  
  // Load pinned message
  useEffect(() => {
    supabase.from('messages').select('*').eq('is_pinned', true).single().then(({ data }) => {
      if (data) setPinnedMsg(data)
    })
  }, [])
  
  // Group messages
  const groupedMessages = useMemo(() => {
    return messages.map((msg, i) => {
      const prev = messages[i - 1]
      const next = messages[i + 1]
      const showDate = i === 0 || diffDate(msg.created_at, prev.created_at)
      const isFirst = isFirstInGroup(msg, prev)
      const isLast = isLastInGroup(msg, next, uid)
      const showAv = needAvatar(msg, next, uid)
      const replyMsg = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null
      return { msg, showDate, isFirst, isLast, showAv, replyMsg }
    })
  }, [messages, uid])
  
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG }}>
      {/* Header */}
      <div style={{
        background: SURF,
        borderBottom: `0.5px solid ${BDR}`,
        padding: `max(10px, env(safe-area-inset-top, 0px)) 16px 10px`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transform: 'translateZ(0)',
      }}>
        <div style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: partner?.avatar_url ? `url(${partner?.avatar_url}) center/cover` : GRAD,
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#4CAF50',
            border: `2px solid ${SURF}`,
          }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 18, fontWeight: 600, color: INK }}>
            {partner?.name || 'Партнёр'}
          </div>
          <div style={{ fontSize: 12, color: MUTED }}>онлайн</div>
        </div>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED }}>
          <IcoVideo />
        </button>
      </div>
      
      {/* Pinned message */}
      {pinnedMsg && (
        <div style={{
          background: SURF2,
          borderBottom: `1px solid ${BDR}`,
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{ width: 3, height: 24, background: '#C8334A', borderRadius: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#C8334A' }}>Закреплено</div>
            <div style={{ fontSize: 13, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {pinnedMsg.text}
            </div>
          </div>
          <button onClick={() => setPinnedMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <IcoClose />
          </button>
        </div>
      )}
      
      {/* Messages list */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: MUTED }}>Загрузка...</div>
        ) : (
          groupedMessages.map(({ msg, showDate, isFirst, isLast, showAv, replyMsg }) => (
            <div key={msg.id}>
              {showDate && (
                <div style={{ textAlign: 'center', margin: '16px 0' }}>
                  <span style={{ background: SURF2, padding: '4px 12px', borderRadius: 12, fontSize: 12, color: MUTED }}>
                    {fmtDateSep(msg.created_at)}
                  </span>
                </div>
              )}
              <Message
                msg={msg}
                isMine={msg.user_id === uid}
                dark={darkMode}
                partnerName={partner?.name}
                partnerAvatar={partner?.avatar_url}
                onLongPress={() => setCtxMenu(msg)}
                onReact={addReact}
                onReply={setReplyTo}
                onEdit={(m) => { setEditingId(m.id); setNewText(m.text); setReplyTo(null) }}
                onCopy={copyText}
                onPin={pinMsg}
                onDelete={deleteMsg}
                isFirst={isFirst}
                isLast={isLast}
                showAv={showAv}
                messages={messages}
                replyMsg={replyMsg}
              />
            </div>
          ))
        )}
        <div ref={endRef} />
        
        {showDown && (
          <button
            onClick={scrollDown}
            style={{
              position: 'sticky',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              background: GRAD,
              border: 'none',
              borderRadius: 20,
              padding: '8px 16px',
              color: 'white',
              fontSize: 12,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            ↓ Новые сообщения
          </button>
        )}
      </div>
      
      {/* Reply/Edit preview */}
      {(replyTo || editingId) && (
        <div style={{
          background: SURF2,
          borderTop: `1px solid ${BDR}`,
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{ width: 3, height: 24, background: '#C8334A', borderRadius: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#C8334A' }}>
              {replyTo ? 'Ответ' : 'Редактирование'}
            </div>
            <div style={{ fontSize: 13, color: MUTED }}>
              {replyTo?.text || newText}
            </div>
          </div>
          <button onClick={() => { setReplyTo(null); setEditingId(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <IcoClose />
          </button>
        </div>
      )}
      
      {/* Photo preview */}
      {photoPreview && (
        <div style={{
          background: SURF2,
          borderTop: `1px solid ${BDR}`,
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <img src={photoPreview} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
          <div style={{ flex: 1, fontSize: 13, color: MUTED }}>Фото прикреплено</div>
          <button onClick={() => { setPhotoFile(null); setPhotoPreview(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <IcoClose />
          </button>
        </div>
      )}
      
      {/* Input area */}
      <div style={{
        background: SURF,
        borderTop: `0.5px solid ${BDR}`,
        padding: `8px 16px calc(8px + env(safe-area-inset-bottom, 0px))`,
        transform: 'translateZ(0)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <button
            onClick={() => photoRef.current?.click()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 8 }}
          >
            <IcoPhoto />
          </button>
          <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
            const file = e.target.files[0]
            if (file) {
              setPhotoFile(file)
              setPhotoPreview(URL.createObjectURL(file))
            }
          }} />
          
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Сообщение..."
            style={{
              flex: 1,
              background: SURF2,
              border: `0.5px solid ${BDR}`,
              borderRadius: 20,
              padding: '10px 16px',
              fontSize: 16,
              fontFamily: 'DM Sans, sans-serif',
              color: INK,
              resize: 'none',
              outline: 'none',
              maxHeight: 100,
            }}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
          />
          
          {!newText.trim() && !photoFile ? (
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 8 }}>
              <IcoMic />
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={sending}
              style={{
                background: GRAD,
                border: 'none',
                borderRadius: 28,
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'white',
              }}
            >
              <IcoSend />
            </button>
          )}
        </div>
      </div>
      
      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          msg={ctxMenu}
          isMine={ctxMenu.user_id === uid}
          onReact={addReact}
          onReply={setReplyTo}
          onEdit={(m) => { setEditingId(m.id); setNewText(m.text); setReplyTo(null); setCtxMenu(null) }}
          onCopy={copyText}
          onPin={pinMsg}
          onDelete={deleteMsg}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}
