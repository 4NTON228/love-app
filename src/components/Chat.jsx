import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Send, Image, Video, X, ArrowDown } from 'lucide-react'

export default function Chat({ session, profile }) {
  const [messages, setMessages] = useState([])
  const [newText, setNewText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [recording, setRecording] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

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
            // Проверяем что сообщения ещё нет в списке
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

  // Загрузка фото
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

  // Отправка сообщения
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

      // Автостоп через 60 секунд
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

  // Видео из галереи как кружочек
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

  // Удаление сообщения
  async function deleteMessage(id) {
    await supabase.from('messages').delete().eq('id', id)
  }

  // Форматирование времени
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

  // Группировка по дням
  function shouldShowDate(msg, index) {
    if (index === 0) return true
    const prev = new Date(messages[index - 1].created_at).toDateString()
    const curr = new Date(msg.created_at).toDateString()
    return prev !== curr
  }

  const isMyMessage = (msg) => msg.user_id === session.user.id
  const getAuthorName = (msg) => {
    if (msg.user_id === session.user.id) return profile?.name || 'Я'
    return msg.user_id === profile?.partner_id
      ? (profile?.name === 'Антон' ? 'Эльвира' : 'Антон')
      : 'Партнёр'
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="loading-heart">💕</div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 80px)',
      marginLeft: '-20px',
      marginRight: '-20px',
      paddingTop: '0'
    }}>
      {/* Шапка чата */}
      <div style={{
        padding: '12px 20px',
        background: 'white',
        borderBottom: '1px solid rgba(232,70,106,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'var(--gradient)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px'
        }}>
          💕
        </div>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '17px'
          }}>
            Наш чат
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-muted)'
          }}>
            Только для нас двоих
          </div>
        </div>
      </div>

      {/* Список сообщений */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          WebkitOverflowScrolling: 'touch',
          background: '#F8F0F2'
        }}
      >
        {messages.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'var(--text-muted)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>💌</div>
            <p>Напишите первое сообщение!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={msg.id}>
              {/* Разделитель по дням */}
              {shouldShowDate(msg, index) && (
                <div style={{
                  textAlign: 'center',
                  margin: '12px 0',
                }}>
                  <span style={{
                    background: 'rgba(0,0,0,0.08)',
                    padding: '4px 14px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    color: '#666',
                    fontWeight: 600
                  }}>
                    {formatDateSeparator(msg.created_at)}
                  </span>
                </div>
              )}

              {/* Сообщение */}
              <div style={{
                display: 'flex',
                justifyContent: isMyMessage(msg) ? 'flex-end' : 'flex-start',
                marginBottom: '2px'
              }}>
                <div
                  onClick={() => {
                    if (isMyMessage(msg) && confirm('Удалить сообщение?')) {
                      deleteMessage(msg.id)
                    }
                  }}
                  style={{
                    maxWidth: '78%',
                    borderRadius: isMyMessage(msg)
                      ? '18px 18px 4px 18px'
                      : '18px 18px 18px 4px',
                    padding: msg.is_video_circle ? '4px' : (msg.photo_url && !msg.text ? '4px' : '8px 14px 6px'),
                    background: isMyMessage(msg)
                      ? 'linear-gradient(135deg, #E8466A, #F06292)'
                      : 'white',
                    color: isMyMessage(msg) ? 'white' : 'var(--text)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    cursor: isMyMessage(msg) ? 'pointer' : 'default',
                    overflow: 'hidden',
                    wordBreak: 'break-word'
                  }}
                >
                  {/* Видео-кружочек */}
                  {msg.is_video_circle && msg.video_url && (
                    <video
                      src={msg.video_url}
                      style={{
                        width: '200px',
                        height: '200px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        display: 'block'
                      }}
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
                        maxHeight: '300px',
                        borderRadius: msg.text ? '12px' : '14px',
                        display: 'block',
                        marginBottom: msg.text ? '6px' : '0'
                      }}
                      loading="lazy"
                    />
                  )}

                  {/* Текст */}
                  {msg.text && (
                    <div style={{
                      fontSize: '15px',
                      lineHeight: '1.4',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {msg.text}
                    </div>
                  )}

                  {/* Время */}
                  {!msg.is_video_circle && (
                    <div style={{
                      fontSize: '11px',
                      opacity: 0.6,
                      textAlign: 'right',
                      marginTop: '2px',
                      lineHeight: 1
                    }}>
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
            bottom: '140px',
            right: '20px',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'white',
            border: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10
          }}
        >
          <ArrowDown size={20} color="var(--primary)" />
        </button>
      )}

      {/* Превью фото */}
      {photoPreview && (
        <div style={{
          padding: '8px 16px',
          background: 'white',
          borderTop: '1px solid #eee',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0
        }}>
          <img
            src={photoPreview}
            alt="Preview"
            style={{
              width: '60px',
              height: '60px',
              objectFit: 'cover',
              borderRadius: '8px'
            }}
          />
          <span style={{ fontSize: '13px', color: 'var(--text-light)', flex: 1 }}>
            Фото прикреплено
          </span>
          <button
            onClick={cancelPhoto}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={20} color="#999" />
          </button>
        </div>
      )}

      {/* Индикатор записи видео */}
      {recording && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(232,70,106,0.05)',
          borderTop: '1px solid #eee',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          flexShrink: 0
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: '#E8466A',
            animation: 'pulse 1s infinite'
          }} />
          <span style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: 600 }}>
            Запись кружочка...
          </span>
          <button
            onClick={stopVideoCircle}
            style={{
              padding: '8px 20px',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer'
            }}
          >
            Отправить
          </button>
        </div>
      )}

      {/* Поле ввода */}
      <div style={{
        padding: '8px 12px',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
        background: 'white',
        borderTop: '1px solid rgba(232,70,106,0.08)',
        display: 'flex',
        alignItems: 'flex-end',
        gap: '8px',
        flexShrink: 0
      }}>
        {/* Кнопка фото */}
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            flexShrink: 0
          }}
        >
          <Image size={24} color="var(--primary)" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoSelect}
          style={{ display: 'none' }}
        />

        {/* Кнопка видео-кружочка */}
        <button
          onClick={recording ? stopVideoCircle : startVideoCircle}
          style={{
            background: recording ? 'var(--primary)' : 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            flexShrink: 0
          }}
        >
          <Video size={24} color={recording ? 'white' : 'var(--primary)'} />
        </button>
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoSelect}
          style={{ display: 'none' }}
        />

        {/* Поле ввода текста */}
        <div style={{
          flex: 1,
          background: '#F5F0F3',
          borderRadius: '22px',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'flex-end'
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
              fontSize: '15px',
              fontFamily: 'var(--font-body)',
              color: 'var(--text)',
              resize: 'none',
              outline: 'none',
              maxHeight: '100px',
              lineHeight: '1.4'
            }}
            onInput={(e) => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
            }}
          />
        </div>

        {/* Кнопка отправить */}
        <button
          onClick={handleSend}
          disabled={sending || (!newText.trim() && !photoFile)}
          style={{
            background: (newText.trim() || photoFile) ? 'var(--gradient-warm)' : '#E8E0E6',
            border: 'none',
            cursor: (newText.trim() || photoFile) ? 'pointer' : 'default',
            padding: '10px',
            borderRadius: '50%',
            display: 'flex',
            flexShrink: 0,
            transition: 'all 0.2s ease'
          }}
        >
          <Send size={20} color="white" />
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
