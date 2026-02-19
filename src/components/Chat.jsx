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
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)', marginLeft: '-20px', marginRight: '-20px', marginTop: '-16px' }}>
      {/* ШАПКА */}
      <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg, #E8466A, #F06292)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, boxShadow: '0 2px 12px rgba(232,70,106,0.3)' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>💕</div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px', color: 'white' }}>Наш чат</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>Только для нас двоих 💕</div>
        </div>
      </div>

      {/* СООБЩЕНИЯ */}
      <div ref={chatContainerRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '3px', WebkitOverflowScrolling: 'touch', background: 'linear-gradient(180deg, #FFF5F7 0%, #F8EEF0 100%)' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>💌</div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600 }}>Напишите первое сообщение!</p>
          </div>
        ) : messages.map((msg, index) => (
          <div key={msg.id}>
            {shouldShowDate(msg, index) && (
              <div style={{ textAlign: 'center', margin: '14px 0 8px' }}>
                <span style={{ background: 'rgba(232,70,106,0.08)', padding: '5px 16px', borderRadius: '20px', fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>
                  {formatDateSeparator(msg.created_at)}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: isMyMessage(msg) ? 'flex-end' : 'flex-start', marginBottom: '2px' }}>
              <div
                onTouchStart={() => handleLongPressStart(msg)}
                onTouchEnd={handleLongPressEnd}
                onMouseDown={() => handleLongPressStart(msg)}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
                style={{ maxWidth: '80%', minWidth: msg.is_video_circle ? 'auto' : '80px' }}
              >
                {msg.is_video_circle && msg.video_url ? (
                  <div style={{ position: 'relative' }}>
                    <video src={msg.video_url} style={{ width: '200px', height: '200px', borderRadius: '50%', objectFit: 'cover', display: 'block', border: '3px solid', borderColor: isMyMessage(msg) ? '#E8466A' : '#F7A8B8' }} playsInline preload="metadata"
                      onClick={(e) => { const v = e.target; v.paused ? v.play() : v.pause() }} />
                    <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.5)', borderRadius: '10px', padding: '2px 8px', fontSize: '11px', color: 'white' }}>
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                ) : isVoiceMessage(msg) ? (
                  <div style={{ borderRadius: isMyMessage(msg) ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', background: isMyMessage(msg) ? 'linear-gradient(135deg, #E8466A, #F06292)' : 'white', color: isMyMessage(msg) ? 'white' : 'var(--text)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '10px', minWidth: '180px' }}>
                    <button onClick={() => toggleAudio(msg.id, msg.video_url)} style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isMyMessage(msg) ? 'rgba(255,255,255,0.25)' : 'rgba(232,70,106,0.1)' }}>
                      {playingAudio === msg.id ? <Pause size={16} color={isMyMessage(msg) ? 'white' : 'var(--primary)'} /> : <Play size={16} color={isMyMessage(msg) ? 'white' : 'var(--primary)'} />}
                    </button>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '20px' }}>
                        {Array.from({ length: 20 }, (_, i) => (
                          <div key={i} style={{ width: '3px', borderRadius: '2px', height: `${6 + Math.sin(i * 0.8) * 8 + Math.random() * 4}px`, background: isMyMessage(msg) ? 'rgba(255,255,255,0.6)' : 'rgba(232,70,106,0.3)' }} />
                        ))}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', opacity: 0.7, flexShrink: 0 }}>{formatTime(msg.created_at)}</div>
                  </div>
                ) : (
                  <div style={{ borderRadius: isMyMessage(msg) ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: msg.photo_url && !msg.text ? '4px' : '8px 14px 6px', background: isMyMessage(msg) ? 'linear-gradient(135deg, #E8466A, #F06292)' : 'white', color: isMyMessage(msg) ? 'white' : 'var(--text)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', wordBreak: 'break-word' }}>
                    {msg.photo_url && <img src={msg.photo_url} alt="" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: msg.text ? '12px' : '14px', display: 'block', marginBottom: msg.text ? '6px' : '0' }} loading="lazy" />}
                    {msg.text && <div style={{ fontSize: '15px', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{msg.text}</div>}
                    <div style={{ fontSize: '11px', opacity: 0.55, textAlign: 'right', marginTop: '2px' }}>{formatTime(msg.created_at)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {showScrollBtn && (
        <button onClick={scrollToBottom} style={{ position: 'absolute', bottom: '130px', right: '16px', width: '38px', height: '38px', borderRadius: '50%', background: 'white', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
          <ArrowDown size={18} color="var(--primary)" />
        </button>
      )}

      {photoPreview && (
        <div style={{ padding: '8px 16px', background: 'white', borderTop: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <img src={photoPreview} alt="" style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '8px' }} />
          <span style={{ fontSize: '13px', color: 'var(--text-light)', flex: 1 }}>Фото прикреплено</span>
          <button onClick={cancelPhoto} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><X size={20} color="#999" /></button>
        </div>
      )}

      {recording && (
        <div style={{ padding: '16px', background: 'white', borderTop: '1px solid rgba(232,70,106,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {recordingType === 'video' && (
            <div style={{ position: 'relative' }}>
              <video ref={videoPreviewRef} muted playsInline style={{ width: '160px', height: '160px', borderRadius: '50%', objectFit: 'cover', border: '4px solid #E8466A', animation: 'recordPulse 2s ease-in-out infinite' }} />
              <div style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)', background: '#E8466A', borderRadius: '12px', padding: '3px 12px', fontSize: '13px', color: 'white', fontWeight: 700 }}>{formatRecordingTime(recordingTime)}</div>
            </div>
          )}
          {recordingType === 'audio' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(232,70,106,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'recordPulse 1.5s ease-in-out infinite' }}>
                <Mic size={24} color="#E8466A" />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary)' }}>Запись голосового...</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{formatRecordingTime(recordingTime)}</div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={cancelRecording} style={{ padding: '10px 24px', background: '#F5F0F3', border: 'none', borderRadius: '24px', fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-body)', color: 'var(--text-light)', cursor: 'pointer' }}>Отмена</button>
            <button onClick={stopRecording} style={{ padding: '10px 24px', background: 'var(--gradient-warm)', border: 'none', borderRadius: '24px', fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-body)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Send size={16} /> Отправить</button>
          </div>
        </div>
      )}

      {!recording && (
        <div style={{ padding: '8px 10px', paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))', background: 'white', borderTop: '1px solid rgba(232,70,106,0.06)', display: 'flex', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
          <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', flexShrink: 0 }}>
            <Image size={22} color="var(--primary)" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />
          <div style={{ flex: 1, background: '#F5F0F3', borderRadius: '22px', padding: '0 14px', display: 'flex', alignItems: 'flex-end' }}>
            <textarea value={newText} onChange={(e) => setNewText(e.target.value)} onKeyDown={handleKeyDown} placeholder="Сообщение..." rows={1}
              style={{ flex: 1, border: 'none', background: 'none', padding: '10px 0', fontSize: '15px', fontFamily: 'var(--font-body)', color: 'var(--text)', resize: 'none', outline: 'none', maxHeight: '100px', lineHeight: '1.4' }}
              onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px' }} />
          </div>
          {(newText.trim() || photoFile) ? (
            <button onClick={handleSend} disabled={sending} style={{ background: 'var(--gradient-warm)', border: 'none', cursor: 'pointer', padding: '10px', borderRadius: '50%', display: 'flex', flexShrink: 0 }}>
              <Send size={20} color="white" />
            </button>
          ) : (
            <>
              <button onClick={startVoiceMessage} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', flexShrink: 0 }}>
                <Mic size={22} color="var(--primary)" />
              </button>
              <button onClick={startVideoCircle} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', flexShrink: 0 }}>
                <Video size={22} color="var(--primary)" />
              </button>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes recordPulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(232,70,106,0.2); }
          50% { box-shadow: 0 0 0 8px rgba(232,70,106,0.3), 0 0 20px rgba(232,70,106,0.2); }
        }
      `}</style>
    </div>
  )
}
