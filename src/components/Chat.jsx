import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

/* ── Context menu component ── */
function ContextMenu({ menu, onEdit, onDelete, onPin, onClose }) {
  if (!menu) return null
  const top = Math.min(menu.y, (typeof window !== 'undefined' ? window.innerHeight : 600) - 180)
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.25)',
          backdropFilter: 'blur(4px)',
        }}
      />
      <div style={{
        position: 'fixed',
        top: top,
        left: menu.isMyMsg ? 'auto' : Math.min(menu.x, (typeof window !== 'undefined' ? window.innerWidth : 400) - 200),
        right: menu.isMyMsg ? 14 : 'auto',
        zIndex: 301,
        background: 'var(--surface, #fff)',
        borderRadius: 16,
        border: '0.5px solid rgba(200,51,74,0.15)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        overflow: 'hidden',
        minWidth: 186,
        animation: 'ctxIn 0.18s cubic-bezier(0.34,1.56,0.64,1) both',
      }}>
        <style>{`@keyframes ctxIn { from{opacity:0;transform:scale(0.88)} to{opacity:1;transform:scale(1)} }`}</style>

        {menu.isMyMsg && (
          <button
            onClick={() => { onEdit(menu.msgId, menu.text); onClose() }}
            style={ctxBtnStyle}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
              stroke="#C8334A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z"/>
            </svg>
            Редактировать
          </button>
        )}

        <button
          onClick={() => { onPin(menu.msgId); onClose() }}
          style={ctxBtnStyle}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
            stroke="#C8334A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="17" x2="12" y2="22"/>
            <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17z"/>
          </svg>
          Закрепить
        </button>

        {menu.isMyMsg && (
          <button
            onClick={() => { onDelete(menu.msgId); onClose() }}
            style={{ ...ctxBtnStyle, color: '#E24B4A', borderBottom: 'none' }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
              stroke="#E24B4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
            </svg>
            Удалить
          </button>
        )}
      </div>
    </>
  )
}

const ctxBtnStyle = {
  width: '100%', padding: '13px 16px',
  display: 'flex', alignItems: 'center', gap: 10,
  background: 'none', border: 'none', cursor: 'pointer',
  borderBottom: '0.5px solid rgba(200,51,74,0.08)',
  fontFamily: 'var(--font-body)', fontSize: 14,
  color: 'var(--ink, #1C0A0E)', textAlign: 'left',
}

/* ── Main component ── */
export default function Chat({ session, profile }) {
  const [messages,     setMessages]     = useState([])
  const [newText,      setNewText]      = useState('')
  const [sending,      setSending]      = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile,    setPhotoFile]    = useState(null)
  const [recording,    setRecording]    = useState(false)
  const [showScrollBtn,setShowScrollBtn]= useState(false)
  const [partnerProfile,setPartnerProfile] = useState(null)
  const [contextMenu,  setContextMenu]  = useState(null)
  const [editingId,    setEditingId]    = useState(null)
  const [pinnedIds,    setPinnedIds]    = useState(new Set())

  const messagesEndRef   = useRef(null)
  const chatContainerRef = useRef(null)
  const fileInputRef     = useRef(null)
  const videoInputRef    = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef        = useRef([])

  /* Загрузка профиля партнёра */
  useEffect(() => {
    if (profile?.partner_id) {
      supabase.from('profiles').select('*').eq('id', profile.partner_id).single()
        .then(({ data }) => { if (data) setPartnerProfile(data) })
    }
  }, [profile?.partner_id])

  /* Загрузка сообщений + realtime */
  useEffect(() => {
    loadMessages()

    const channel = supabase
      .channel('messages-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
        scrollToBottom()
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(200)
    setMessages(data || [])
    setLoading(false)
    setTimeout(scrollToBottom, 100)
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
    const ext  = file.name?.split('.').pop() || 'webm'
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const path = `${folder}/${name}`
    const { error } = await supabase.storage.from('photos').upload(path, file)
    if (error) throw error
    return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
  }

  function handlePhotoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function cancelPhoto() {
    setPhotoFile(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSend() {
    if (!newText.trim() && !photoFile) return
    setSending(true)
    try {
      if (editingId) {
        /* Редактирование существующего сообщения */
        await supabase.from('messages').update({ text: newText.trim() }).eq('id', editingId)
        setEditingId(null)
      } else {
        let photoUrl = null
        if (photoFile) photoUrl = await uploadFile(photoFile, 'chat')
        await supabase.from('messages').insert({
          user_id:   session.user.id,
          text:      newText.trim() || null,
          photo_url: photoUrl,
        })
        cancelPhoto()
        scrollToBottom()
      }
      setNewText('')
    } catch (err) {
      console.error('Send error:', err)
    }
    setSending(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  /* Видео-кружочек с камеры */
  async function startVideoCircle() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 240, height: 240 },
        audio: true,
      })
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9' : 'video/webm',
      })
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        const file = new File([blob], `circle-${Date.now()}.webm`, { type: 'video/webm' })
        setSending(true)
        try {
          const videoUrl = await uploadFile(file, 'circles')
          await supabase.from('messages').insert({
            user_id: session.user.id, video_url: videoUrl, is_video_circle: true,
          })
          scrollToBottom()
        } catch (err) { console.error('Video upload error:', err) }
        setSending(false)
        setRecording(false)
      }
      mr.start()
      setRecording(true)
      setTimeout(() => { if (mr.state === 'recording') mr.stop() }, 60000)
    } catch (err) {
      console.error('Camera error:', err)
      alert('Нет доступа к камере')
    }
  }

  function stopVideoCircle() {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
  }

  async function handleVideoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setSending(true)
    try {
      const videoUrl = await uploadFile(file, 'circles')
      await supabase.from('messages').insert({
        user_id: session.user.id, video_url: videoUrl, is_video_circle: true,
      })
      scrollToBottom()
    } catch (err) { console.error('Video upload error:', err) }
    setSending(false)
    if (videoInputRef.current) videoInputRef.current.value = ''
  }

  async function deleteMessage(id) {
    await supabase.from('messages').delete().eq('id', id)
  }

  function pinMessage(id) {
    setPinnedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDateSeparator(dateStr) {
    const d   = new Date(dateStr)
    const now = new Date()
    const yes = new Date(now); yes.setDate(yes.getDate() - 1)
    if (d.toDateString() === now.toDateString()) return 'Сегодня'
    if (d.toDateString() === yes.toDateString()) return 'Вчера'
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  }

  function shouldShowDate(msg, index) {
    if (index === 0) return true
    return new Date(messages[index - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString()
  }

  const isMyMessage = (msg) => msg.user_id === session.user.id

  /* ── Loading state ── */
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--blush)' }}>
        <div style={{ animation: 'hbChat 1.4s ease-in-out infinite' }}>
          <svg viewBox="0 0 34 30" width="52" height="46" fill="none">
            <path d="M17 28C17 28 1 18 1 7.5C1 3.5 4.5 0.5 8.5 0.5C11.5 0.5 14 2 17 5C20 2 22.5 0.5 25.5 0.5C29.5 0.5 33 3.5 33 7.5C33 18 17 28 17 28Z" fill="#C8334A"/>
          </svg>
        </div>
        <style>{`@keyframes hbChat { 0%,100%{transform:scale(1)} 15%{transform:scale(1.3)} 30%{transform:scale(1.05)} 45%{transform:scale(1.2)} }`}</style>
      </div>
    )
  }

  /* ── Render ── */
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100dvh - env(safe-area-inset-top, 0px) - 56px - env(safe-area-inset-bottom, 0px))',
      position: 'relative',
      background: 'var(--blush)',
    }}>
      <style>{`
        @keyframes pulseChat  { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes msgIn      { from{transform:translateY(8px) scale(0.96);opacity:0} to{transform:translateY(0) scale(1);opacity:1} }
        @keyframes glowSend   { 0%,100%{box-shadow:0 0 8px rgba(200,51,74,0.35)} 50%{box-shadow:0 0 20px rgba(200,51,74,0.65)} }
        .chat-msg-wrap { -webkit-user-select:none; user-select:none; -webkit-touch-callout:none; }
      `}</style>

      {/* ═══ 1. ШАПКА ═══ */}
      <div style={{
        flexShrink: 0,
        background: 'var(--surface)',
        borderBottom: '0.5px solid rgba(200,51,74,0.13)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 10,
      }}>
        {/* Аватар с онлайн-точкой */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            background: 'linear-gradient(135deg, #C8334A, #8B1A2C)',
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {partnerProfile?.avatar_url
              ? <img src={partnerProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
                  <circle cx="20" cy="16" r="7" fill="rgba(255,255,255,0.8)"/>
                  <path d="M6 36c0-7.7 6.3-14 14-14s14 6.3 14 14" fill="rgba(255,255,255,0.6)"/>
                </svg>
            }
          </div>
          <div style={{
            position: 'absolute', bottom: 1, right: 1,
            width: 10, height: 10,
            background: '#4CAF50', borderRadius: '50%',
            border: '2px solid var(--surface)',
            animation: 'pulseChat 2s ease-in-out infinite',
          }}/>
        </div>

        {/* Имя и статус */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 17, fontWeight: 600,
            color: 'var(--ink)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {partnerProfile?.name || 'Эльвира'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
            только для нас двоих
          </div>
        </div>

        {/* Видеозвонок */}
        <button
          onClick={startVideoCircle}
          style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'rgba(200,51,74,0.1)',
            border: '0.5px solid rgba(200,51,74,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, color: '#C8334A',
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
        </button>
      </div>

      {/* ═══ 2. СПИСОК СООБЩЕНИЙ ═══ */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          background: 'var(--blush)',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
            <div style={{ marginBottom: 12 }}>
              <svg viewBox="0 0 24 24" width="52" height="52" fill="none"
                stroke="var(--rose)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"/>
                <polyline points="2,5 12,13 22,5"/>
              </svg>
            </div>
            <p style={{ fontSize: 15 }}>Напишите первое сообщение!</p>
          </div>
        ) : messages.map((msg, index) => {
          const isMine   = isMyMessage(msg)
          const isPinned = pinnedIds.has(msg.id)

          /* Long-press via plain timer — no hook inside map */
          let _lpTimer = null
          const lpStart = (e) => {
            const t = e.touches?.[0] || e
            _lpTimer = setTimeout(() => {
              setContextMenu({ msgId: msg.id, text: msg.text || '', x: t.clientX, y: t.clientY, isMyMsg: isMine })
            }, 480)
          }
          const lpCancel = () => clearTimeout(_lpTimer)

          return (
            <div key={msg.id}>
              {/* Разделитель дат */}
              {shouldShowDate(msg, index) && (
                <div style={{ textAlign: 'center', margin: '12px 0' }}>
                  <span style={{
                    background: 'rgba(200,51,74,0.08)',
                    padding: '3px 14px', borderRadius: 20,
                    fontSize: 12, color: 'var(--muted)', fontWeight: 600,
                  }}>
                    {formatDateSeparator(msg.created_at)}
                  </span>
                </div>
              )}

              {/* Закреплено */}
              {isPinned && (
                <div style={{ textAlign: isMine ? 'right' : 'left', marginBottom: 2 }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                      style={{ verticalAlign: 'middle', marginRight: 3 }}>
                      <line x1="12" y1="17" x2="12" y2="22"/>
                      <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17z"/>
                    </svg>
                    Закреплено
                  </span>
                </div>
              )}

              {/* Пузырь */}
              <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
                <div
                  className="chat-msg-wrap"
                  onMouseDown={lpStart} onMouseUp={lpCancel} onMouseLeave={lpCancel}
                  onTouchStart={lpStart} onTouchEnd={lpCancel} onTouchMove={lpCancel}
                  style={{
                    maxWidth: '78%',
                    borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    padding: msg.is_video_circle ? 4 : (msg.photo_url && !msg.text ? 4 : '8px 14px 6px'),
                    background: isMine ? 'linear-gradient(135deg, #C8334A, #8B1A2C)' : 'var(--surface)',
                    color: isMine ? 'white' : 'var(--ink)',
                    border: isMine ? 'none' : '0.5px solid rgba(200,51,74,0.13)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                    cursor: 'default',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    animation: 'msgIn 0.25s ease both',
                  }}
                >
                  {/* Видео-кружочек */}
                  {msg.is_video_circle && msg.video_url && (
                    <video
                      src={msg.video_url}
                      style={{ width: 200, height: 200, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
                      controls playsInline preload="metadata"
                    />
                  )}

                  {/* Фото */}
                  {msg.photo_url && (
                    <img
                      src={msg.photo_url} alt=""
                      style={{
                        maxWidth: '100%', maxHeight: 300,
                        borderRadius: msg.text ? 12 : 14,
                        display: 'block', marginBottom: msg.text ? 6 : 0,
                      }}
                      loading="lazy"
                    />
                  )}

                  {/* Текст */}
                  {msg.text && (
                    <div style={{ fontSize: 15, lineHeight: 1.45 }}>
                      {msg.text}
                    </div>
                  )}

                  {/* Время */}
                  {!msg.is_video_circle && (
                    <div style={{ fontSize: 11, opacity: 0.6, textAlign: 'right', marginTop: 2, lineHeight: 1 }}>
                      {formatTime(msg.created_at)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Кнопка "вниз" */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          style={{
            position: 'absolute', bottom: 140, right: 16,
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--surface)',
            border: '0.5px solid var(--border)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 10,
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
            stroke="#C8334A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      )}

      {/* ═══ 3. ПРЕВЬЮ ФОТО ═══ */}
      {photoPreview && (
        <div style={{
          flexShrink: 0, padding: '8px 14px',
          background: 'var(--surface)',
          borderTop: '0.5px solid rgba(200,51,74,0.1)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <img src={photoPreview} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8 }} />
          <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>Фото прикреплено</span>
          <button onClick={cancelPhoto} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
              stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* ═══ 4. ИНДИКАТОР ЗАПИСИ ═══ */}
      {recording && (
        <div style={{
          flexShrink: 0, padding: '10px 16px',
          background: 'rgba(200,51,74,0.05)',
          borderTop: '0.5px solid rgba(200,51,74,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: '#C8334A', animation: 'pulseChat 1s infinite',
          }}/>
          <span style={{ fontSize: 13, color: '#C8334A', fontWeight: 500 }}>
            Запись кружочка...
          </span>
          <button onClick={stopVideoCircle} style={{
            padding: '6px 16px',
            background: 'linear-gradient(135deg, #C8334A, #8B1A2C)',
            color: 'white', border: 'none', borderRadius: 20,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            Отправить
          </button>
        </div>
      )}

      {/* ═══ 5. СТРОКА РЕДАКТИРОВАНИЯ ═══ */}
      {editingId && (
        <div style={{
          flexShrink: 0, padding: '6px 14px',
          background: 'rgba(200,51,74,0.06)',
          borderTop: '0.5px solid rgba(200,51,74,0.12)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
            stroke="#C8334A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z"/>
          </svg>
          <span style={{ fontSize: 12, color: '#C8334A', flex: 1 }}>Редактирование сообщения</span>
          <button onClick={() => { setEditingId(null); setNewText('') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--muted)' }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* ═══ 6. ПОЛЕ ВВОДА ═══ */}
      <div style={{
        flexShrink: 0,
        background: 'var(--surface)',
        borderTop: '0.5px solid rgba(200,51,74,0.13)',
        padding: '8px 10px',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 6,
      }}>
        {/* Фото */}
        <button
          onClick={() => fileInputRef.current?.click()}
          style={iconBtnStyle}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
            stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*"
          onChange={handlePhotoSelect} style={{ display: 'none' }}/>

        {/* Видео-кружочек */}
        <button
          onClick={recording ? stopVideoCircle : startVideoCircle}
          style={{
            ...iconBtnStyle,
            background: recording ? '#C8334A' : 'var(--blush)',
            color: recording ? 'white' : '#C8334A',
          }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
            stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
        </button>
        <input ref={videoInputRef} type="file" accept="video/*"
          onChange={handleVideoSelect} style={{ display: 'none' }}/>

        {/* Textarea */}
        <div style={{
          flex: 1,
          background: 'var(--blush)',
          borderRadius: 22,
          border: '0.5px solid rgba(200,51,74,0.13)',
          padding: '0 14px',
          display: 'flex', alignItems: 'flex-end',
        }}>
          <textarea
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Сообщение..."
            rows={1}
            style={{
              flex: 1, border: 'none', background: 'none',
              padding: '9px 0', fontSize: 15,
              fontFamily: 'var(--font-body)', color: 'var(--ink)',
              resize: 'none', outline: 'none',
              maxHeight: 100, lineHeight: 1.4,
            }}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
            }}
          />
        </div>

        {/* Микрофон */}
        <button style={iconBtnStyle}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
            stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>

        {/* Отправить */}
        <button
          onClick={handleSend}
          disabled={sending || (!newText.trim() && !photoFile)}
          style={{
            width: 38, height: 38, borderRadius: '50%',
            background: (newText.trim() || photoFile)
              ? 'linear-gradient(135deg, #C8334A, #8B1A2C)'
              : 'rgba(200,51,74,0.18)',
            border: 'none', cursor: (newText.trim() || photoFile) ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.2s',
            animation: (newText.trim() || photoFile) ? 'glowSend 3s ease-in-out infinite' : 'none',
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
            stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>

      {/* ═══ КОНТЕКСТНОЕ МЕНЮ ═══ */}
      <ContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        onEdit={(id, text) => { setEditingId(id); setNewText(text) }}
        onDelete={deleteMessage}
        onPin={pinMessage}
      />
    </div>
  )
}

const iconBtnStyle = {
  width: 36, height: 36, borderRadius: '50%',
  background: 'var(--blush)', border: 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', flexShrink: 0, color: '#C8334A',
}
