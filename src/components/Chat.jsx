import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const REACTIONS = ['❤️', '🔥', '😍', '😂', '👍', '💔']

// Добавляем глобальные стили в head
const addGlobalStyles = () => {
  const style = document.createElement('style')
  style.textContent = `
    * {
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
    }
    
    @keyframes msgIn {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    
    @keyframes heartbeat {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.05); opacity: 0.8; }
    }
    
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.2); opacity: 0.7; }
    }
    
    @keyframes glow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(200,51,74,0.4); }
      50% { box-shadow: 0 0 0 6px rgba(200,51,74,0); }
    }
    
    .message-animation {
      will-change: transform, opacity;
      transform: translateZ(0);
      backface-visibility: hidden;
    }
    
    ::-webkit-scrollbar {
      width: 4px;
    }
    
    ::-webkit-scrollbar-track {
      background: rgba(200,51,74,0.05);
    }
    
    ::-webkit-scrollbar-thumb {
      background: rgba(200,51,74,0.3);
      border-radius: 4px;
    }
  `
  document.head.appendChild(style)
}

function ContextMenu({ menu, onClose, onEdit, onDelete, onPin }) {
  if (!menu) return null
  
  // Исправляем позиционирование для iPhone
  const getPosition = () => {
    const top = Math.min(menu.y, window.innerHeight - 280)
    let left = 'auto'
    let right = 'auto'
    
    if (menu.isMyMsg) {
      const rightPos = Math.min(16, window.innerWidth - 220)
      right = rightPos > 0 ? rightPos : 16
    } else {
      const leftPos = Math.min(menu.x, window.innerWidth - 220)
      left = leftPos > 0 ? leftPos : 16
    }
    
    return { top, left, right }
  }
  
  const position = getPosition()
  
  const btn = {
    width: '100%', padding: '13px 16px',
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'none', border: 'none', cursor: 'pointer',
    borderBottom: '0.5px solid rgba(200,51,74,0.07)',
    fontFamily: 'inherit', fontSize: 15, color: '#1C0A0E', textAlign: 'left',
    WebkitTapHighlightColor: 'transparent',
  }
  
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}/>
      <div style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        right: position.right,
        zIndex: 201, background: '#fff', borderRadius: 18,
        border: '0.5px solid rgba(200,51,74,0.15)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
        overflow: 'hidden', minWidth: 200,
        transform: 'translateZ(0)',
      }}>
        {menu.isMyMsg && (
          <button style={btn} onClick={() => { onEdit(menu.msgId, menu.text); onClose() }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#C8334A" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z"/>
            </svg>
            Редактировать
          </button>
        )}
        <button style={btn} onClick={() => { onPin(menu.msgId); onClose() }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#C8334A" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="17" x2="12" y2="22"/>
            <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17z"/>
          </svg>
          Закрепить
        </button>
        {menu.isMyMsg && (
          <button style={{ ...btn, color: '#E24B4A', borderTop: '0.5px solid rgba(200,51,74,0.1)' }}
            onClick={() => { onDelete(menu.msgId); onClose() }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#E24B4A" strokeWidth="2" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
            Удалить
          </button>
        )}
      </div>
    </>
  )
}

function ReactionPicker({ onPick, onClose }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 198 }}/>
      <div style={{
        position: 'absolute', bottom: '110%', left: '50%',
        transform: 'translateX(-50%)',
        background: '#fff', borderRadius: 999, padding: '6px 10px',
        display: 'flex', gap: 4,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        border: '0.5px solid rgba(200,51,74,0.13)', zIndex: 199,
        whiteSpace: 'nowrap',
      }}>
        {REACTIONS.map(r => (
          <button key={r} onClick={() => { onPick(r); onClose() }} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 22, padding: '2px 4px', lineHeight: 1,
            WebkitTapHighlightColor: 'transparent',
          }}>{r}</button>
        ))}
      </div>
    </>
  )
}

function Message({ msg, isMine, dark, session, onContextMenu, reactionFor, setReactionFor, formatTime, addReaction }) {
  const timerRef = useRef(null)
  const pressStartRef = useRef({ x: 0, y: 0 })
  const SURF   = dark ? '#1E0A10' : '#FFFFFF'
  const INK    = dark ? '#F5E8EA' : '#1C0A0E'
  const BORDER = 'rgba(200,51,74,0.13)'

  function startPress(x, y) {
    pressStartRef.current = { x, y }
    timerRef.current = setTimeout(() => {
      onContextMenu({ msgId: msg.id, text: msg.text || '', x, y, isMyMsg: isMine })
    }, 600) // Увеличиваем для надежности
  }
  
  function endPress() { 
    clearTimeout(timerRef.current) 
  }
  
  function handleTouchMove(e) {
    if (!timerRef.current) return
    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - pressStartRef.current.x)
    const dy = Math.abs(touch.clientY - pressStartRef.current.y)
    if (dx > 10 || dy > 10) {
      clearTimeout(timerRef.current)
    }
  }

  return (
    <div
      onMouseDown={e => startPress(e.clientX, e.clientY)}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onTouchStart={e => { 
        const t = e.touches[0]
        startPress(t.clientX, t.clientY)
      }}
      onTouchMove={handleTouchMove}
      onTouchEnd={endPress}
      onTouchCancel={endPress}
      onDoubleClick={() => setReactionFor(msg.id)}
      style={{ 
        position: 'relative', 
        WebkitUserSelect: 'none', 
        userSelect: 'none',
        transform: 'translateZ(0)',
      }}
    >
      {msg.is_video_circle && msg.video_url ? (
        <div style={{ 
          width: 180, 
          height: 180, 
          borderRadius: '50%', 
          overflow: 'hidden', 
          border: `2px solid ${isMine ? '#C8334A' : BORDER}`,
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
        }}>
          <video 
            src={msg.video_url} 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
              WebkitUserSelect: 'none',
            }} 
            controls 
            playsInline 
            preload="metadata"
          />
        </div>
      ) : (
        <div style={{
          maxWidth: '78%', wordBreak: 'break-word', whiteSpace: 'pre-wrap',
          padding: msg.photo_url && !msg.text ? '3px' : '8px 14px 6px',
          background: isMine ? 'linear-gradient(135deg,#C8334A,#8B1A2C)' : SURF,
          color: isMine ? 'white' : INK,
          borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          border: isMine ? 'none' : `0.5px solid ${BORDER}`,
          fontSize: 15, lineHeight: 1.45,
          animation: 'msgIn 0.25s ease both',
          transform: 'translateZ(0)',
        }}>
          {msg.photo_url && (
            <img src={msg.photo_url} alt="" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: msg.text ? 12 : 16, display: 'block', marginBottom: msg.text ? 6 : 0 }} loading="lazy"/>
          )}
          {msg.text && (
            <div>{msg.text}{msg.edited_at && <span style={{ fontSize: 10, opacity: .55, marginLeft: 4 }}>ред.</span>}</div>
          )}
          <div style={{ fontSize: 10, opacity: .55, textAlign: 'right', marginTop: 2 }}>
            {formatTime(msg.created_at)}{isMine && <span style={{ marginLeft: 3 }}>✓</span>}
          </div>
        </div>
      )}

      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
          {Object.entries(msg.reactions).map(([emoji, users]) => users.length > 0 && (
            <button key={emoji} onClick={() => addReaction(msg.id, emoji)} style={{
              background: users.includes(session.user.id) ? 'rgba(200,51,74,0.15)' : 'rgba(0,0,0,0.06)',
              border: users.includes(session.user.id) ? '1px solid rgba(200,51,74,0.3)' : '1px solid transparent',
              borderRadius: 999, padding: '2px 7px', fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 3,
              WebkitTapHighlightColor: 'transparent',
            }}>
              {emoji}<span style={{ fontSize: 11, color: '#9A6070' }}>{users.length}</span>
            </button>
          ))}
        </div>
      )}

      {reactionFor === msg.id && (
        <ReactionPicker onPick={(emoji) => addReaction(msg.id, emoji)} onClose={() => setReactionFor(null)}/>
      )}
    </div>
  )
}

export default function Chat({ session, profile, darkMode }) {
  const [messages, setMessages]           = useState([])
  const [newText, setNewText]             = useState('')
  const [sending, setSending]             = useState(false)
  const [loading, setLoading]             = useState(true)
  const [photoPreview, setPhotoPreview]   = useState(null)
  const [photoFile, setPhotoFile]         = useState(null)
  const [recording, setRecording]         = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [editingId, setEditingId]         = useState(null)
  const [contextMenu, setContextMenu]     = useState(null)
  const [reactionFor, setReactionFor]     = useState(null)
  const [partnerProfile, setPartnerProfile] = useState(null)
  const [keyboardVisible, setKeyboardVisible] = useState(false)

  const messagesEndRef   = useRef(null)
  const chatContainerRef = useRef(null)
  const fileInputRef     = useRef(null)
  const videoInputRef    = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef        = useRef([])
  const previewStreamRef = useRef(null)
  const previewVideoRef  = useRef(null)

  const dark   = darkMode
  const BG     = dark ? '#200A10' : '#FBF0F2'
  const SURF   = dark ? '#1E0A10' : '#FFFFFF'
  const INK    = dark ? '#F5E8EA' : '#1C0A0E'
  const BORDER = 'rgba(200,51,74,0.13)'

  // Добавляем глобальные стили при монтировании
  useEffect(() => {
    addGlobalStyles()
  }, [])

  // Обработка клавиатуры для iPhone
  useEffect(() => {
    const handleResize = () => {
      const isKeyboard = document.activeElement?.tagName === 'TEXTAREA' ||
                         document.activeElement?.tagName === 'INPUT'
      if (isKeyboard) {
        setKeyboardVisible(true)
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      } else {
        setKeyboardVisible(false)
      }
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    loadMessages()
    loadPartner()
    const channel = supabase.channel('chat-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
        setMessages(prev => prev.find(m => m.id === p.new.id) ? prev : [...prev, p.new])
        setTimeout(scrollToBottom, 50)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (p) => {
        setMessages(prev => prev.filter(m => m.id !== p.old.id))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => {
        setMessages(prev => prev.map(m => m.id === p.new.id ? p.new : m))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function loadMessages() {
    const { data } = await supabase.from('messages').select('*')
      .order('created_at', { ascending: true }).limit(200)
    setMessages(data || [])
    setLoading(false)
    setTimeout(scrollToBottom, 100)
  }

  async function loadPartner() {
    if (!profile?.partner_id) return
    const { data } = await supabase.from('profiles').select('*').eq('id', profile.partner_id).single()
    setPartnerProfile(data)
  }

  function scrollToBottom() { 
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) 
  }

  function handleScroll() {
    const el = chatContainerRef.current
    if (!el) return
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200)
  }

  async function uploadFile(file, folder) {
    const ext = file.name?.split('.').pop() || 'webm'
    const name = `${Date.now()}-${Math.random().toString(36).slice(7)}.${ext}`
    const { error } = await supabase.storage.from('photos').upload(`${folder}/${name}`, file)
    if (error) throw error
    return supabase.storage.from('photos').getPublicUrl(`${folder}/${name}`).data.publicUrl
  }

  function handlePhotoSelect(e) {
    const file = e.target.files[0]; if (!file) return
    setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file))
  }

  function cancelPhoto() {
    setPhotoFile(null); setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSend() {
    if (!newText.trim() && !photoFile) return
    setSending(true)
    try {
      let photoUrl = null
      if (photoFile) photoUrl = await uploadFile(photoFile, 'chat')
      if (editingId) {
        await supabase.from('messages').update({ text: newText.trim(), edited_at: new Date().toISOString() }).eq('id', editingId)
        setEditingId(null)
      } else {
        await supabase.from('messages').insert({ user_id: session.user.id, text: newText.trim() || null, photo_url: photoUrl })
      }
      setNewText(''); cancelPhoto(); scrollToBottom()
    } catch (err) { console.error(err) }
    setSending(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    if (e.key === 'Escape' && editingId) { setEditingId(null); setNewText('') }
  }

  async function startVideoCircle() {
    try {
      // Проверка поддержки
      if (!MediaRecorder.isTypeSupported('video/webm') && 
          !MediaRecorder.isTypeSupported('video/mp4')) {
        alert('Ваш браузер не поддерживает запись видео')
        return
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user', 
          width: { ideal: 300 }, 
          height: { ideal: 300 } 
        }, 
        audio: true 
      })
      
      previewStreamRef.current = stream
      if (previewVideoRef.current) { 
        previewVideoRef.current.srcObject = stream
        previewVideoRef.current.play()
      }
      
      const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        if (previewVideoRef.current) previewVideoRef.current.srcObject = null
        previewStreamRef.current = null
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const ext = mimeType === 'video/mp4' ? 'mp4' : 'webm'
        const file = new File([blob], `circle-${Date.now()}.${ext}`, { type: mimeType })
        setSending(true)
        try {
          const videoUrl = await uploadFile(file, 'circles')
          await supabase.from('messages').insert({ 
            user_id: session.user.id, 
            video_url: videoUrl, 
            is_video_circle: true 
          })
          scrollToBottom()
        } catch (err) { console.error(err) }
        setSending(false)
        setRecording(false)
      }
      
      recorder.start()
      setRecording(true)
      
      setTimeout(() => { 
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop()
        }
      }, 60000)
    } catch (err) { 
      console.error(err)
      alert('Нет доступа к камере. Проверьте разрешения в настройках Safari.')
    }
  }

  function stopVideoCircle() { 
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  function cancelVideoCircle() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (previewStreamRef.current) { 
      previewStreamRef.current.getTracks().forEach(t => t.stop())
      previewStreamRef.current = null 
    }
    if (previewVideoRef.current) previewVideoRef.current.srcObject = null
    chunksRef.current = []
    setRecording(false)
  }

  async function handleVideoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setSending(true)
    try {
      const videoUrl = await uploadFile(file, 'circles')
      await supabase.from('messages').insert({ 
        user_id: session.user.id, 
        video_url: videoUrl, 
        is_video_circle: true 
      })
      scrollToBottom()
    } catch (err) { console.error(err) }
    setSending(false)
    if (videoInputRef.current) videoInputRef.current.value = ''
  }

  async function deleteMessage(id) { 
    await supabase.from('messages').delete().eq('id', id) 
  }

  async function pinMessage(id) {
    const msg = messages.find(m => m.id === id)
    if (!msg) return
    await supabase.from('messages').update({ is_pinned: !msg.is_pinned }).eq('id', id)
  }

  async function addReaction(msgId, emoji) {
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return
    const reactions = { ...(msg.reactions || {}) }
    const uid = session.user.id
    if (reactions[emoji]?.includes(uid)) {
      reactions[emoji] = reactions[emoji].filter(id => id !== uid)
      if (!reactions[emoji].length) delete reactions[emoji]
    } else {
      reactions[emoji] = [...(reactions[emoji] || []), uid]
    }
    await supabase.from('messages').update({ reactions }).eq('id', msgId)
  }

  function formatTime(d) { 
    return new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) 
  }

  function formatDateSep(d) {
    const date = new Date(d)
    const today = new Date()
    const yest = new Date(today)
    yest.setDate(yest.getDate() - 1)
    if (date.toDateString() === today.toDateString()) return 'Сегодня'
    if (date.toDateString() === yest.toDateString()) return 'Вчера'
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  }

  function shouldShowDate(msg, i) {
    if (i === 0) return true
    return new Date(messages[i - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString()
  }

  const isMe = (msg) => msg.user_id === session.user.id
  const pName = partnerProfile?.name || (profile?.name === 'Антон' ? 'Эльвира' : 'Антон')
  const pAvatar = partnerProfile?.avatar_url

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: BG }}>
      <div style={{ animation: 'heartbeat 1.4s ease-in-out infinite' }}>
        <svg viewBox="0 0 60 56" width="56" height="52" fill="none">
          <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z" fill="url(#lhg)"/>
          <defs><linearGradient id="lhg" x1="0" y1="0" x2="60" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E8556A"/><stop offset="100%" stopColor="#C8334A"/>
          </linearGradient></defs>
        </svg>
      </div>
    </div>
  )

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      background: BG, 
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* ШАПКА */}
      <div style={{ 
        flexShrink: 0, 
        background: SURF, 
        borderBottom: `0.5px solid ${BORDER}`, 
        padding: '10px 16px', 
        paddingTop: 'calc(10px + env(safe-area-inset-top, 20px))', 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12, 
        zIndex: 10 
      }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ 
            width: 42, height: 42, borderRadius: '50%', 
            overflow: 'hidden', 
            background: 'linear-gradient(135deg,#C8334A,#8B1A2C)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            {pAvatar
              ? <img src={pAvatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              : <svg viewBox="0 0 40 40" width="38" height="38" fill="none">
                  <circle cx="20" cy="16" r="7" fill="rgba(255,255,255,0.85)"/>
                  <path d="M6 36c0-7.7 6.3-14 14-14s14 6.3 14 14" fill="rgba(255,255,255,0.65)"/>
                </svg>
            }
          </div>
          <div style={{ 
            width: 10, height: 10, background: '#4CAF50', borderRadius: '50%', 
            border: `2px solid ${SURF}`, position: 'absolute', bottom: 1, right: 1,
            animation: 'pulse 2s ease-in-out infinite' 
          }}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 600, color: INK }}>
            {pName}
          </div>
          <div style={{ fontSize: 11, color: '#9A6070' }}>только для нас двоих</div>
        </div>
        <button style={{ 
          width: 38, height: 38, borderRadius: '50%', 
          background: 'rgba(200,51,74,0.1)', border: 'none', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent' 
        }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#C8334A" strokeWidth="2" strokeLinecap="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
        </button>
      </div>

      {/* ПРЕДПРОСМОТР КРУЖОЧКА */}
      {recording && (
        <div style={{ 
          flexShrink: 0, padding: '12px 16px', background: SURF, 
          borderBottom: `0.5px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12 
        }}>
          <div style={{ 
            width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', 
            border: '2px solid #C8334A', flexShrink: 0,
            transform: 'translateZ(0)',
          }}>
            <video ref={previewVideoRef} muted autoPlay playsInline style={{ 
              width: '100%', height: '100%', objectFit: 'cover' 
            }}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ 
                width: 8, height: 8, borderRadius: '50%', background: '#C8334A', 
                animation: 'pulse 1s ease-in-out infinite' 
              }}/>
              <span style={{ fontSize: 13, color: '#C8334A', fontWeight: 500 }}>Запись...</span>
            </div>
            <div style={{ fontSize: 11, color: '#9A6070' }}>Нажми «Отправить» когда закончишь</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={cancelVideoCircle} style={{ 
              width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.08)', 
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', 
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent' 
            }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9A6070" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <button onClick={stopVideoCircle} style={{ 
              padding: '8px 16px', borderRadius: 20, 
              background: 'linear-gradient(135deg,#C8334A,#8B1A2C)', 
              color: 'white', border: 'none', fontSize: 13, fontWeight: 600, 
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent' 
            }}>
              Отправить
            </button>
          </div>
        </div>
      )}

      {/* СООБЩЕНИЯ */}
      <div 
        ref={chatContainerRef} 
        onScroll={handleScroll} 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '10px 14px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 3, 
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          scrollbarWidth: 'thin',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ 
            display: 'flex', flexDirection: 'column', alignItems: 'center', 
            justifyContent: 'center', flex: 1, gap: 12, opacity: 0.5 
          }}>
            <svg viewBox="0 0 60 56" width="48" height="44" fill="none">
              <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z" fill="rgba(200,51,74,0.3)"/>
            </svg>
            <p style={{ fontSize: 14, color: '#9A6070' }}>Напишите первое сообщение</p>
          </div>
        ) : messages.map((msg, i) => (
          <div key={msg.id}>
            {shouldShowDate(msg, i) && (
              <div style={{ textAlign: 'center', margin: '10px 0' }}>
                <span style={{ 
                  background: 'rgba(200,51,74,0.08)', padding: '3px 12px', 
                  borderRadius: 20, fontSize: 11, color: '#9A6070' 
                }}>
                  {formatDateSep(msg.created_at)}
                </span>
              </div>
            )}
            <div style={{ 
              display: 'flex', 
              justifyContent: isMe(msg) ? 'flex-end' : 'flex-start', 
              marginBottom: 2 
            }}>
              <Message
                msg={msg} isMine={isMe(msg)} dark={dark} session={session}
                onContextMenu={setContextMenu} reactionFor={reactionFor}
                setReactionFor={setReactionFor} formatTime={formatTime} addReaction={addReaction}
              />
            </div>
          </div>
        ))}
        <div ref={messagesEndRef}/>
      </div>

      {/* КНОПКА ВНИЗ */}
      {showScrollBtn && (
        <button onClick={scrollToBottom} style={{ 
          position: 'absolute', bottom: keyboardVisible ? 90 : 80, right: 16, 
          width: 36, height: 36, borderRadius: '50%', background: '#fff', 
          border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          cursor: 'pointer', zIndex: 10, WebkitTapHighlightColor: 'transparent' 
        }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#C8334A" strokeWidth="2" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      )}

      {/* КОНТЕКСТНОЕ МЕНЮ */}
      <ContextMenu 
        menu={contextMenu} 
        onClose={() => setContextMenu(null)} 
        onEdit={(id, text) => { setEditingId(id); setNewText(text) }} 
        onDelete={deleteMessage} 
        onPin={pinMessage}
      />

      {/* ПРЕВЬЮ ФОТО */}
      {photoPreview && (
        <div style={{ 
          flexShrink: 0, padding: '8px 14px', background: SURF, 
          borderTop: `0.5px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10 
        }}>
          <img src={photoPreview} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8 }}/>
          <span style={{ fontSize: 12, color: '#9A6070', flex: 1 }}>Фото прикреплено</span>
          <button onClick={cancelPhoto} style={{ 
            background: 'none', border: 'none', cursor: 'pointer', 
            color: '#9A6070', padding: 4, WebkitTapHighlightColor: 'transparent' 
          }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* РЕЖИМ РЕДАКТИРОВАНИЯ */}
      {editingId && (
        <div style={{ 
          flexShrink: 0, padding: '6px 14px', background: 'rgba(200,51,74,0.06)', 
          borderTop: '0.5px solid rgba(200,51,74,0.15)', display: 'flex', alignItems: 'center', gap: 8 
        }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#C8334A" strokeWidth="2" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z"/>
          </svg>
          <span style={{ flex: 1, fontSize: 12, color: '#C8334A' }}>Редактирование сообщения</span>
          <button onClick={() => { setEditingId(null); setNewText('') }} style={{ 
            background: 'none', border: 'none', cursor: 'pointer', 
            color: '#9A6070', WebkitTapHighlightColor: 'transparent' 
          }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* ПОЛЕ ВВОДА */}
      <div style={{ 
        flexShrink: 0, background: SURF, borderTop: `0.5px solid ${BORDER}`, 
        padding: '8px 12px', 
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 20px))', 
        display: 'flex', alignItems: 'flex-end', gap: 8 
      }}>
        <button onClick={() => fileInputRef.current?.click()} style={{ 
          width: 36, height: 36, borderRadius: '50%', background: 'rgba(200,51,74,0.08)', 
          border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          cursor: 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent' 
        }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#C8334A" strokeWidth="2" strokeLinecap="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }}/>

        <button onClick={recording ? stopVideoCircle : startVideoCircle} style={{ 
          width: 36, height: 36, borderRadius: '50%', 
          background: recording ? 'linear-gradient(135deg,#C8334A,#8B1A2C)' : 'rgba(200,51,74,0.08)', 
          border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          cursor: 'pointer', flexShrink: 0, 
          animation: recording ? 'glow 1.5s ease-in-out infinite' : 'none',
          WebkitTapHighlightColor: 'transparent',
        }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={recording ? 'white' : '#C8334A'} strokeWidth="2" strokeLinecap="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
        </button>
        <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} style={{ display: 'none' }}/>

        <div style={{ 
          flex: 1, background: dark ? '#3D1520' : '#FBF0F2', borderRadius: 22, 
          border: `0.5px solid ${BORDER}`, padding: '0 14px', 
          display: 'flex', alignItems: 'flex-end' 
        }}>
          <textarea 
            value={newText} 
            onChange={e => setNewText(e.target.value)} 
            onKeyDown={handleKeyDown} 
            placeholder="Сообщение..." 
            rows={1}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            style={{
              flex: 1, border: 'none', background: 'none', padding: '10px 0',
              fontSize: 16, // Важно: минимум 16px для предотвращения зума
              fontFamily: "'DM Sans',sans-serif", color: INK,
              resize: 'none', outline: 'none', maxHeight: 100, lineHeight: 1.4,
              WebkitAppearance: 'none',
              WebkitFontSmoothing: 'antialiased',
            }}
            onInput={e => { 
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
            }}
          />
        </div>

        <button 
          onClick={handleSend} 
          disabled={sending || (!newText.trim() && !photoFile)} 
          style={{ 
            width: 36, height: 36, borderRadius: '50%', 
            background: (newText.trim() || photoFile) 
              ? 'linear-gradient(135deg,#C8334A,#8B1A2C)' 
              : 'rgba(200,51,74,0.15)', 
            border: 'none', cursor: 'pointer', flexShrink: 0, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            transition: 'all 0.2s', 
            animation: (newText.trim() || photoFile) ? 'glow 3s ease-in-out infinite' : 'none',
            WebkitTapHighlightColor: 'transparent',
            opacity: (newText.trim() || photoFile) ? 1 : 0.6,
          }}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>

    </div>
  )
}
