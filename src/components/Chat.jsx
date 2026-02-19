import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Send, Image, Video, X, ArrowDown, Mic, Play, Pause } from 'lucide-react'

export default function Chat({ session, profile }) {
  const [messages, setMessages] = useState([])
  const [newText, setNewText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [recording, setRecording] = useState(false)
  const [recordingType, setRecordingType] = useState(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [playingAudio, setPlayingAudio] = useState(null)
  const [cameraStream, setCameraStream] = useState(null)

  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const videoPreviewRef = useRef(null)
  const audioRefs = useRef({})
  const longPressRef = useRef(null)

  useEffect(() => {
    loadMessages()
    const channel = supabase
      .channel('messages-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
          setTimeout(scrollToBottom, 100)
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        }
      )
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
    setTimeout(scrollToBottom, 200)
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
    const fileExt = file.name?.split('.').pop() || 'webm'
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${folder}/${fileName}`
    const { error } = await supabase.storage.from('photos').upload(filePath, file)
    if (error) throw error
    const { data } = supabase.storage.from('photos').getPublicUrl(filePath)
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
      if (photoFile) photoUrl = await uploadFile(photoFile, 'chat')
      await supabase.from('messages').insert({
        user_id: session.user.id,
        text: newText.trim() || null,
        photo_url: photoUrl
      })
      setNewText('')
      cancelPhoto()
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

  async function startVideoCircle() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 240, height: 240 },
        audio: true
      })
      setCameraStream(stream)
      setTimeout(() => {
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream
          videoPreviewRef.current.play()
        }
      }, 100)

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9' : 'video/webm'
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setCameraStream(null)
        clearInterval(timerRef.current)
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        if (blob.size < 1000) {
          setRecording(false); setRecordingType(null); setRecordingTime(0); return
        }
        const file = new File([blob], `circle-${Date.now()}.webm`, { type: 'video/webm' })
        setSending(true)
        try {
          const videoUrl = await uploadFile(file, 'circles')
          await supabase.from('messages').insert({
            user_id: session.user.id, video_url: videoUrl, is_video_circle: true
          })
        } catch (err) { console.error('Video upload error:', err) }
        setSending(false); setRecording(false); setRecordingType(null); setRecordingTime(0)
      }
      mediaRecorder.start()
      setRecording(true); setRecordingType('video'); setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
      }, 60000)
    } catch (err) {
      console.error('Camera error:', err)
      alert('Нет доступа к камере')
    }
  }

  async function startVoiceMessage() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm'
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        clearInterval(timerRef.current)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size < 1000) {
          setRecording(false); setRecordingType(null); setRecordingTime(0); return
        }
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
        setSending(true)
        try {
          const audioUrl = await uploadFile(file, 'voice')
          await supabase.from('messages').insert({
            user_id: session.user.id, video_url: audioUrl,
            is_video_circle: false, text: '🎤 Голосовое сообщение'
          })
        } catch (err) { console.error('Voice upload error:', err) }
        setSending(false); setRecording(false); setRecordingType(null); setRecordingTime(0)
      }
      mediaRecorder.start()
      setRecording(true); setRecordingType('audio'); setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch (err) {
      console.error('Mic error:', err)
      alert('Нет доступа к микрофону')
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
  }

  function cancelRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = () => {
        if (cameraStream) cameraStream.getTracks().forEach(t => t.stop())
        setCameraStream(null)
      }
      mediaRecorderRef.current.stop()
    }
    clearInterval(timerRef.current)
    setRecording(false); setRecordingType(null); setRecordingTime(0)
  }

  function handleLongPressStart(msg) {
    if (!isMyMessage(msg)) return
    longPressRef.current = setTimeout(() => {
      if (confirm('Удалить сообщение?')) deleteMessage(msg.id)
      longPressRef.current = null
    }, 600)
  }
  function handleLongPressEnd() {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null }
  }
  async function deleteMessage(id) {
    await supabase.from('messages').delete().eq('id', id)
  }

  function toggleAudio(msgId, url) {
    const cur = audioRefs.current[msgId]
    if (cur) {
      if (playingAudio === msgId) { cur.pause(); setPlayingAudio(null) }
      else { cur.play(); setPlayingAudio(msgId) }
    } else {
      Object.values(audioRefs.current).forEach(a => a?.pause())
      const audio = new Audio(url)
      audioRefs.current[msgId] = audio
      audio.onended = () => setPlayingAudio(null)
      audio.play()
      setPlayingAudio(msgId)
    }
  }

  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }
  function formatRecordingTime(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }
  function formatDateSeparator(dateStr) {
    const d = new Date(dateStr), today = new Date()
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Сегодня'
    if (d.toDateString() === yesterday.toDateString()) return 'Вчера'
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  }
  function shouldShowDate(msg, i) {
    if (i === 0) return true
    return new Date(messages[i - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString()
  }

  const isMyMessage = (msg) => msg.user_id === session.user.id
  const isVoiceMessage = (msg) => msg.video_url && !msg.is_video_circle && msg.text === '🎤 Голосовое сообщение'

  if (loading) return <div className="empty-state"><div className="loading-heart">💕</div></div>

  return (
    <div className="chat-container">
      {/* ШАПКА */}
      <div className="chat-header">
        <div className="chat-header-avatar">💕</div>
        <div>
          <div className="chat-header-title">Наш чат</div>
          <div className="chat-header-subtitle">Только для нас двоих 💕</div>
        </div>
      </div>

      {/* СООБЩЕНИЯ */}
      <div ref={chatContainerRef} onScroll={handleScroll} className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>💌</div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600 }}>Напишите первое сообщение!</p>
          </div>
        ) : messages.map((msg, index) => (
          <div key={msg.id}>
            {shouldShowDate(msg, index) && (
              <div className="chat-date-separator">
                <span>{formatDateSeparator(msg.created_at)}</span>
              </div>
            )}
            <div className={`chat-msg-row ${isMyMessage(msg) ? 'mine' : 'theirs'}`}>
              <div
                onTouchStart={() => handleLongPressStart(msg)}
                onTouchEnd={handleLongPressEnd}
                onMouseDown={() => handleLongPressStart(msg)}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
                className="chat-msg-wrapper"
              >
                {/* ВИДЕО-КРУЖОЧЕК */}
                {msg.is_video_circle && msg.video_url ? (
                  <div className="chat-video-circle-wrapper">
                    <video
                      src={msg.video_url}
                      className={`chat-video-circle ${isMyMessage(msg) ? 'mine' : 'theirs'}`}
                      playsInline
                      preload="metadata"
                      onClick={(e) => { const v = e.target; v.paused ? v.play() : v.pause() }}
                    />
                    <div className="chat-video-circle-time">{formatTime(msg.created_at)}</div>
                  </div>

                /* ГОЛОСОВОЕ */
                ) : isVoiceMessage(msg) ? (
                  <div className={`chat-bubble ${isMyMessage(msg) ? 'mine' : 'theirs'}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '160px', padding: '10px 14px' }}>
                    <button onClick={() => toggleAudio(msg.id, msg.video_url)} className={`chat-voice-btn ${isMyMessage(msg) ? 'mine' : 'theirs'}`}>
                      {playingAudio === msg.id ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <div style={{ flex: 1 }}>
                      <div className="chat-voice-wave">
                        {Array.from({ length: 18 }, (_, i) => (
                          <div key={i} className={`chat-voice-bar ${isMyMessage(msg) ? 'mine' : 'theirs'}`}
                            style={{ height: `${6 + Math.sin(i * 0.8) * 8 + Math.random() * 4}px` }} />
                        ))}
                      </div>
                    </div>
                    <div className="chat-msg-time">{formatTime(msg.created_at)}</div>
                  </div>

                /* ТЕКСТ / ФОТО */
                ) : (
                  <div className={`chat-bubble ${isMyMessage(msg) ? 'mine' : 'theirs'} ${msg.photo_url && !msg.text ? 'photo-only' : ''}`}>
                    {msg.photo_url && (
                      <img src={msg.photo_url} alt="" className="chat-photo" loading="lazy" />
                    )}
                    {msg.text && <div className="chat-text">{msg.text}</div>}
                    <div className="chat-msg-time">{formatTime(msg.created_at)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Кнопка вниз */}
      {showScrollBtn && (
        <button onClick={scrollToBottom} className="chat-scroll-btn">
          <ArrowDown size={18} color="var(--primary)" />
        </button>
      )}

      {/* Превью фото */}
      {photoPreview && (
        <div className="chat-photo-preview">
          <img src={photoPreview} alt="" />
          <span>Фото прикреплено</span>
          <button onClick={cancelPhoto}><X size={20} color="#999" /></button>
        </div>
      )}

      {/* Панель записи */}
      {recording && (
        <div className="chat-recording-panel">
          {recordingType === 'video' && (
            <div style={{ position: 'relative' }}>
              <video ref={videoPreviewRef} muted playsInline className="chat-recording-preview" />
              <div className="chat-recording-timer">{formatRecordingTime(recordingTime)}</div>
            </div>
          )}
          {recordingType === 'audio' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="chat-recording-mic-icon"><Mic size={24} color="#E8466A" /></div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary)' }}>Запись голосового...</div>
                <div style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{formatRecordingTime(recordingTime)}</div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={cancelRecording} className="chat-rec-cancel-btn">Отмена</button>
            <button onClick={stopRecording} className="chat-rec-send-btn"><Send size={16} /> Отправить</button>
          </div>
        </div>
      )}

      {/* Поле ввода */}
      {!recording && (
        <div className="chat-input-bar">
          <button onClick={() => fileInputRef.current?.click()} className="chat-input-icon-btn">
            <Image size={22} color="var(--primary)" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />
          <div className="chat-input-field">
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Сообщение..."
              rows={1}
              onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px' }}
            />
          </div>
          {(newText.trim() || photoFile) ? (
            <button onClick={handleSend} disabled={sending} className="chat-send-btn active">
              <Send size={20} color="white" />
            </button>
          ) : (
            <>
              <button onClick={startVoiceMessage} className="chat-input-icon-btn">
                <Mic size={22} color="var(--primary)" />
              </button>
              <button onClick={startVideoCircle} className="chat-input-icon-btn">
                <Video size={22} color="var(--primary)" />
              </button>
            </>
          )}
        </div>
      )}

      <style>{`
        .chat-container {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 90px;
          display: flex;
          flex-direction: column;
          z-index: 5;
          background: #FFF5F7;
        }
        .chat-header {
          padding: 12px 16px;
          padding-top: calc(12px + env(safe-area-inset-top, 0px));
          background: linear-gradient(135deg, #E8466A, #F06292);
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
          box-shadow: 0 2px 12px rgba(232,70,106,0.3);
        }
        .chat-header-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          background: rgba(255,255,255,0.25);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; flex-shrink: 0;
        }
        .chat-header-title {
          font-family: var(--font-display); font-weight: 700;
          font-size: 17px; color: white;
        }
        .chat-header-subtitle {
          font-size: 12px; color: rgba(255,255,255,0.8);
        }
        .chat-messages {
          flex: 1; overflow-y: auto; overflow-x: hidden;
          padding: 12px 10px;
          display: flex; flex-direction: column; gap: 3px;
          -webkit-overflow-scrolling: touch;
          background: linear-gradient(180deg, #FFF5F7 0%, #F8EEF0 100%);
        }
        .chat-empty {
          text-align: center; padding: 60px 20px; color: var(--text-muted);
        }
        .chat-date-separator {
          text-align: center; margin: 14px 0 8px;
        }
        .chat-date-separator span {
          background: rgba(232,70,106,0.08); padding: 5px 16px;
          border-radius: 20px; font-size: 12px; color: var(--primary); font-weight: 600;
        }
        .chat-msg-row {
          display: flex; margin-bottom: 2px;
        }
        .chat-msg-row.mine { justify-content: flex-end; }
        .chat-msg-row.theirs { justify-content: flex-start; }
        .chat-msg-wrapper {
          max-width: 75%; overflow: hidden;
        }
        .chat-bubble {
          overflow: hidden; word-break: break-word;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .chat-bubble.mine {
          border-radius: 18px 18px 4px 18px;
          padding: 8px 12px 6px;
          background: linear-gradient(135deg, #E8466A, #F06292);
          color: white;
        }
        .chat-bubble.theirs {
          border-radius: 18px 18px 18px 4px;
          padding: 8px 12px 6px;
          background: white;
          color: var(--text);
        }
        .chat-bubble.photo-only {
          padding: 4px;
        }
        .chat-photo {
          max-width: 100%; max-height: 280px;
          border-radius: 14px; display: block;
        }
        .chat-bubble.mine .chat-photo + .chat-text,
        .chat-bubble.theirs .chat-photo + .chat-text {
          margin-top: 6px;
        }
        .chat-text {
          font-size: 15px; line-height: 1.4; white-space: pre-wrap;
        }
        .chat-msg-time {
          font-size: 11px; opacity: 0.55; text-align: right; margin-top: 2px;
        }

        /* Видео-кружочек */
        .chat-video-circle-wrapper { position: relative; }
        .chat-video-circle {
          width: 180px; height: 180px; border-radius: 50%;
          object-fit: cover; display: block; border: 3px solid;
          cursor: pointer;
        }
        .chat-video-circle.mine { border-color: #E8466A; }
        .chat-video-circle.theirs { border-color: #F7A8B8; }
        .chat-video-circle-time {
          position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%);
          background: rgba(0,0,0,0.5); border-radius: 10px;
          padding: 2px 8px; font-size: 11px; color: white;
        }

        /* Голосовое сообщение */
        .chat-voice-btn {
          width: 34px; height: 34px; border-radius: 50%;
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .chat-voice-btn.mine { background: rgba(255,255,255,0.25); color: white; }
        .chat-voice-btn.theirs { background: rgba(232,70,106,0.1); color: var(--primary); }
        .chat-voice-wave {
          display: flex; align-items: center; gap: 2px; height: 20px;
        }
        .chat-voice-bar {
          width: 3px; border-radius: 2px;
        }
        .chat-voice-bar.mine { background: rgba(255,255,255,0.6); }
        .chat-voice-bar.theirs { background: rgba(232,70,106,0.3); }

        /* Кнопка вниз */
        .chat-scroll-btn {
          position: fixed; bottom: 130px; right: 14px;
          width: 38px; height: 38px; border-radius: 50%;
          background: white; border: none;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; z-index: 10;
        }

        /* Превью фото */
        .chat-photo-preview {
          padding: 8px 14px; background: white;
          border-top: 1px solid #eee;
          display: flex; align-items: center; gap: 10px; flex-shrink: 0;
        }
        .chat-photo-preview img {
          width: 50px; height: 50px; object-fit: cover; border-radius: 8px;
        }
        .chat-photo-preview span {
          font-size: 13px; color: var(--text-light); flex: 1;
        }
        .chat-photo-preview button {
          background: none; border: none; cursor: pointer; padding: 4px;
        }

        /* Панель записи */
        .chat-recording-panel {
          padding: 16px; background: white;
          border-top: 1px solid rgba(232,70,106,0.1);
          display: flex; flex-direction: column;
          align-items: center; gap: 12px; flex-shrink: 0;
        }
        .chat-recording-preview {
          width: 140px; height: 140px; border-radius: 50%;
          object-fit: cover; border: 4px solid #E8466A;
          animation: recordPulse 2s ease-in-out infinite;
        }
        .chat-recording-timer {
          position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%);
          background: #E8466A; border-radius: 12px;
          padding: 3px 12px; font-size: 13px; color: white; font-weight: 700;
        }
        .chat-recording-mic-icon {
          width: 48px; height: 48px; border-radius: 50%;
          background: rgba(232,70,106,0.1);
          display: flex; align-items: center; justify-content: center;
          animation: recordPulse 1.5s ease-in-out infinite;
        }
        .chat-rec-cancel-btn {
          padding: 10px 24px; background: #F5F0F3; border: none;
          border-radius: 24px; font-size: 14px; font-weight: 600;
          font-family: var(--font-body); color: var(--text-light); cursor: pointer;
        }
        .chat-rec-send-btn {
          padding: 10px 24px; background: linear-gradient(135deg, #E8466A, #F06292);
          border: none; border-radius: 24px; font-size: 14px; font-weight: 700;
          font-family: var(--font-body); color: white; cursor: pointer;
          display: flex; align-items: center; gap: 6px;
        }

        /* Поле ввода */
        .chat-input-bar {
          padding: 8px 10px;
          background: white;
          border-top: 1px solid rgba(232,70,106,0.06);
          display: flex; align-items: flex-end; gap: 4px; flex-shrink: 0;
        }
        .chat-input-icon-btn {
          background: none; border: none; cursor: pointer;
          padding: 8px; border-radius: 50%; display: flex; flex-shrink: 0;
        }
        .chat-input-field {
          flex: 1; background: #F5F0F3; border-radius: 22px;
          padding: 0 14px; display: flex; align-items: flex-end;
          min-width: 0;
        }
        .chat-input-field textarea {
          flex: 1; border: none; background: none;
          padding: 10px 0; font-size: 15px;
          font-family: var(--font-body); color: var(--text);
          resize: none; outline: none; max-height: 100px; line-height: 1.4;
          width: 100%;
        }
        .chat-send-btn {
          border: none; cursor: pointer; padding: 10px;
          border-radius: 50%; display: flex; flex-shrink: 0;
        }
        .chat-send-btn.active {
          background: linear-gradient(135deg, #E8466A, #F06292);
        }

        @keyframes recordPulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(232,70,106,0.2); }
          50% { box-shadow: 0 0 0 8px rgba(232,70,106,0.3), 0 0 20px rgba(232,70,106,0.2); }
        }
      `}</style>
    </div>
  )
}
