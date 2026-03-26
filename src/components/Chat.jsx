import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function Chat({ session, profile }) {
  const [messages, setMessages] = useState([])
  const [newText, setNewText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [recording, setRecording] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [partnerProfile, setPartnerProfile] = useState(null)
  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  // Загрузка профиля партнёра
  useEffect(() => {
    if (profile?.partner_id) {
      supabase.from('profiles').select('*').eq('id', profile.partner_id).single()
        .then(({ data }) => { if (data) setPartnerProfile(data) })
    }
  }, [profile?.partner_id])

  // Загрузка сообщений
  useEffect(() => {
    loadMessages()

    // Realtime подписка
    const channel = supabase
      .channel('messages-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
          scrollToBottom()
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBtn(fromBottom > 200)
  }

  async function uploadFile(file, folder) {
    const fileExt = file.name?.split('.').pop() || 'webm'
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${folder}/${fileName}`

    const { error } = await supabase.storage
      .from('photos')
      .upload(filePath, file)

    if (error) throw error

    const { data } = supabase.storage
      .from('photos')
      .getPublicUrl(filePath)

    return data.publicUrl
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
      let photoUrl = null
      if (photoFile) {
        photoUrl = await uploadFile(photoFile, 'chat')
      }

      await supabase.from('messages').insert({
        user_id: session.user.id,
        text: newText.trim() || null,
        photo_url: photoUrl
      })

      setNewText('')
      cancelPhoto()
      scrollToBottom()
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

  // Видео-кружочек
  async function startVideoCircle() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 240, height: 240 },
        audio: true
      })

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm'
      })

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        const file = new File([blob], `circle-${Date.now()}.webm`, { type: 'video/webm' })

        setSending(true)
        try {
          const videoUrl = await uploadFile(file, 'circles')
          await supabase.from('messages').insert({
            user_id: session.user.id,
            video_url: videoUrl,
            is_video_circle: true
          })
          scrollToBottom()
        } catch (err) {
          console.error('Video upload error:', err)
        }
        setSending(false)
        setRecording(false)
      }

      mediaRecorder.start()
      setRecording(true)

      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop()
        }
      }, 60000)
    } catch (err) {
      console.error('Camera error:', err)
      alert('Нет доступа к камере')
    }
  }

  function stopVideoCircle() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
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
    } catch (err) {
      console.error('Video upload error:', err)
    }
    setSending(false)
    if (videoInputRef.current) videoInputRef.current.value = ''
  }

  async function deleteMessage(id) {
    await supabase.from('messages').delete().eq('id', id)
  }

  function formatTime(dateStr) {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDateSeparator(dateStr) {
    const d = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) return 'Сегодня'
    if (d.toDateString() === yesterday.toDateString()) return 'Вчера'
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  }

  function shouldShowDate(msg, index) {
    if (index === 0) return true
    const prev = new Date(messages[index - 1].created_at).toDateString()
    const curr = new Date(msg.created_at).toDateString()
    return prev !== curr
  }

  const isMyMessage = (msg) => msg.user_id === session.user.id

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ animation: 'heartbeatChat 1.4s ease-in-out infinite' }}>
          <svg viewBox="0 0 34 30" width="48" height="42" fill="none">
            <path d="M17 28C17 28 1 18 1 7.5C1 3.5 4.5 0.5 8.5 0.5C11.5 0.5 14 2 17 5C20 2 22.5 0.5 25.5 0.5C29.5 0.5 33 3.5 33 7.5C33 18 17 28 17 28Z" fill="#C8334A"/>
          </svg>
        </div>
        <style>{`@keyframes heartbeatChat { 0%,100%{transform:scale(1)} 15%{transform:scale(1.3)} 30%{transform:scale(1.05)} 45%{transform:scale(1.2)} }`}</style>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      position: 'relative',
    }}>
      <style>{`
        @keyframes pulseChat { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes msgIn { from{transform:translateY(8px) scale(0.95);opacity:0} to{transform:translateY(0) scale(1);opacity:1} }
        @keyframes glowSend { 0%,100%{box-shadow:0 0 8px rgba(200,51,74,0.4)} 50%{box-shadow:0 0 18px rgba(200,51,74,0.7)} }
      `}</style>

      {/* ── ШАПКА — прилипает к верху ── */}
      <div style={{
        flexShrink: 0,
        background: 'var(--surface)',
        borderBottom: '0.5px solid var(--border)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 10,
      }}>
        {/* Аватар партнёра с онлайн-точкой */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #C8334A, #8B1A2C)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {partnerProfile?.avatar_url ? (
              <img
                src={partnerProfile.avatar_url}
                alt={partnerProfile.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
                <circle cx="20" cy="16" r="8" fill="rgba(255,255,255,0.75)"/>
                <path d="M4 38c0-8.8 7.2-16 16-16s16 7.2 16 16" fill="rgba(255,255,255,0.55)"/>
              </svg>
            )}
          </div>
          {/* Онлайн-точка */}
          <div style={{
            position: 'absolute',
            bottom: 1,
            right: 1,
            width: 10,
            height: 10,
            background: '#4CAF50',
            borderRadius: '50%',
            border: '2px solid var(--surface)',
            animation: 'pulseChat 2s ease-in-out infinite',
          }}/>
        </div>

        {/* Имя и подпись */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--ink)',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {partnerProfile?.name || 'Наш чат'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
            только для нас двоих
          </div>
        </div>

        {/* Кнопка видеозвонка */}
        <button
          onClick={recording ? stopVideoCircle : startVideoCircle}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: recording ? 'rgba(200,51,74,0.15)' : 'rgba(200,51,74,0.08)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#C8334A',
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
        </button>
      </div>

      {/* ── СПИСОК СООБЩЕНИЙ — растягивается ── */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          WebkitOverflowScrolling: 'touch',
          background: 'var(--blush)',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
            <div style={{ marginBottom: 12 }}>
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none"
                stroke="var(--rose)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"/>
                <polyline points="2,5 12,13 22,5"/>
              </svg>
            </div>
            <p style={{ fontSize: 15 }}>Напишите первое сообщение!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={msg.id}>
              {/* Разделитель по дням */}
              {shouldShowDate(msg, index) && (
                <div style={{ textAlign: 'center', margin: '12px 0' }}>
                  <span style={{
                    background: 'rgba(200,51,74,0.08)',
                    padding: '4px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    color: 'var(--muted)',
                    fontWeight: 600,
                  }}>
                    {formatDateSeparator(msg.created_at)}
                  </span>
                </div>
              )}

              {/* Сообщение */}
              <div style={{
                display: 'flex',
                justifyContent: isMyMessage(msg) ? 'flex-end' : 'flex-start',
                marginBottom: 2,
              }}>
                <div
                  onClick={() => {
                    if (isMyMessage(msg) && confirm('Удалить сообщение?')) {
                      deleteMessage(msg.id)
                    }
                  }}
                  style={{
                    maxWidth: '78%',
                    borderRadius: isMyMessage(msg) ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    padding: msg.is_video_circle ? '4px' : (msg.photo_url && !msg.text ? '4px' : '8px 14px 6px'),
                    background: isMyMessage(msg)
                      ? 'linear-gradient(135deg, #C8334A, #8B1A2C)'
                      : 'var(--surface)',
                    color: isMyMessage(msg) ? 'white' : 'var(--ink)',
                    border: isMyMessage(msg) ? 'none' : '0.5px solid var(--border)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    cursor: isMyMessage(msg) ? 'pointer' : 'default',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    animation: 'msgIn 0.3s ease both',
                  }}
                >
                  {/* Видео-кружочек */}
                  {msg.is_video_circle && msg.video_url && (
                    <video
                      src={msg.video_url}
                      style={{ width: 200, height: 200, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
                      controls
                      playsInline
                      preload="metadata"
                    />
                  )}

                  {/* Фото */}
                  {msg.photo_url && (
                    <img
                      src={msg.photo_url}
                      alt=""
                      style={{
                        maxWidth: '100%',
                        maxHeight: 300,
                        borderRadius: msg.text ? 12 : 14,
                        display: 'block',
                        marginBottom: msg.text ? 6 : 0,
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
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Кнопка "вниз" */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          style={{
            position: 'absolute',
            bottom: 140,
            right: 20,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--surface)',
            border: '0.5px solid var(--border)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="var(--rose)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      )}

      {/* ── ПРЕВЬЮ ФОТО ── */}
      {photoPreview && (
        <div style={{
          flexShrink: 0,
          padding: '8px 16px',
          background: 'var(--surface)',
          borderTop: '0.5px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <img
            src={photoPreview}
            alt="Preview"
            style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 10 }}
          />
          <span style={{ fontSize: 13, color: 'var(--muted)', flex: 1 }}>
            Фото прикреплено
          </span>
          <button
            onClick={cancelPhoto}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── ИНДИКАТОР ЗАПИСИ КРУЖОЧКА ── */}
      {recording && (
        <div style={{
          flexShrink: 0,
          padding: '10px 16px',
          background: 'rgba(200,51,74,0.05)',
          borderTop: '0.5px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#C8334A',
            animation: 'pulseChat 1s infinite',
          }}/>
          <span style={{ fontSize: 14, color: '#C8334A', fontWeight: 500, fontFamily: 'var(--font-body)' }}>
            Запись кружочка...
          </span>
          <button
            onClick={stopVideoCircle}
            style={{
              padding: '6px 16px',
              background: 'linear-gradient(135deg, #C8334A, #8B1A2C)',
              color: 'white',
              border: 'none',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Отправить
          </button>
        </div>
      )}

      {/* ── ПОЛЕ ВВОДА — прилипает к низу ── */}
      <div style={{
        flexShrink: 0,
        background: 'var(--surface)',
        borderTop: '0.5px solid var(--border)',
        padding: '8px 12px',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 6,
      }}>
        {/* Кнопка emoji */}
        <button style={{
          background: 'none', border: 'none',
          cursor: 'pointer', padding: 8, borderRadius: '50%',
          display: 'flex', flexShrink: 0,
          color: 'var(--muted)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5"/>
            <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5"/>
          </svg>
        </button>

        {/* Поле ввода текста */}
        <div style={{
          flex: 1,
          background: 'var(--blush)',
          border: '0.5px solid var(--border)',
          borderRadius: 22,
          padding: '0 14px',
          display: 'flex',
          alignItems: 'flex-end',
        }}>
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Сообщение..."
            rows={1}
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              padding: '10px 0',
              fontSize: 15,
              fontFamily: 'var(--font-body)',
              color: 'var(--ink)',
              resize: 'none',
              outline: 'none',
              maxHeight: 100,
              lineHeight: 1.4,
            }}
            onInput={(e) => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
            }}
          />
        </div>

        {/* Кнопка фото */}
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: 'none', border: 'none',
            cursor: 'pointer', padding: 8, borderRadius: '50%',
            display: 'flex', flexShrink: 0,
            color: 'var(--rose)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoSelect}
          style={{ display: 'none' }}
        />

        {/* Кнопка голосового сообщения */}
        <button
          style={{
            background: 'none', border: 'none',
            cursor: 'pointer', padding: 8, borderRadius: '50%',
            display: 'flex', flexShrink: 0,
            color: 'var(--rose)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>

        {/* Кнопка видео-кружочка */}
        <button
          onClick={recording ? stopVideoCircle : startVideoCircle}
          style={{
            background: recording ? 'rgba(200,51,74,0.15)' : 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 8,
            borderRadius: '50%',
            display: 'flex',
            flexShrink: 0,
            color: 'var(--rose)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
        </button>
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoSelect}
          style={{ display: 'none' }}
        />

        {/* Кнопка отправки — показывается когда есть текст или фото */}
        {(newText.trim() || photoFile) && (
          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #C8334A, #8B1A2C)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              animation: 'glowSend 3s ease-in-out infinite',
              transition: 'transform 0.15s',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
