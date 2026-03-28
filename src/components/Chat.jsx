import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

function fmtTime(date) {
  const d = new Date(date)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
  return new Date(a).toDateString() !== new Date(b).toDateString()
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }
  return text.replace(/[&<>"']/g, m => map[m])
}

function parseText(text) {
  if (!text) return ''
  let escaped = escapeHtml(text)
  escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#C8334A;text-decoration:none;">$1</a>')
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700;">$1</strong>')
  escaped = escaped.replace(/\*(.+?)\*/g, '<em style="font-style:italic;">$1</em>')
  escaped = escaped.replace(/`(.+?)`/g, '<code style="background:rgba(0,0,0,0.08);padding:2px 6px;border-radius:6px;font-family:monospace;">$1</code>')
  escaped = escaped.replace(/^&gt;\s(.+)$/gm, '<div style="border-left:3px solid #C8334A;padding-left:12px;margin:4px 0;">$1</div>')
  return escaped
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

async function uploadFile(file, folder) {
  const ext = file.name.split('.').pop()
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(7)}.${ext}`
  const { error } = await supabase.storage.from('photos').upload(path, file)
  if (error) throw error
  return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
}

function IcoSend() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function IcoPhoto() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <circle cx="8.5" cy="10.5" r="2.5" />
      <path d="M21 15l-5-4-3 3-4-4-5 5" />
    </svg>
  )
}

// ========== ВИДЕО-КРУЖОЧЕК ==========
const VideoCircle = React.memo(function VideoCircle({ url, isMine, time }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{
        width: 180, height: 180, borderRadius: '50%', overflow: 'hidden',
        border: `2.5px solid ${isMine ? '#C8334A' : 'rgba(200,51,74,0.25)'}`,
      }}>
        <video src={url} playsInline controls preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
      <div style={{
        position: 'absolute', bottom: 10, right: 10,
        background: 'rgba(0,0,0,0.55)', borderRadius: 6,
        padding: '2px 6px', fontSize: 10, color: 'white', pointerEvents: 'none',
      }}>{time}</div>
    </div>
  )
})

// ========== ГОЛОСОВОЕ СООБЩЕНИЕ ==========
const WAVE_H = [3, 5, 8, 12, 16, 20, 14, 8, 5, 10, 18, 14, 9, 6, 12, 16, 8, 5, 3, 6]

const VoiceMessage = React.memo(function VoiceMessage({ url, isMine, dark, duration, time }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const audioRef = useRef(null)
  const MUTED = dark ? '#8A5060' : '#9A6070'
  const GRAD = 'linear-gradient(135deg, #C8334A, #8B1A2C)'

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
      a.onended = () => {
        setPlaying(false)
        setProgress(0)
      }
    }
  }

  useEffect(() => () => audioRef.current?.pause(), [])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 8px 10px',
      background: isMine ? GRAD : (dark ? '#1E0A10' : '#fff'),
      borderRadius: 18, minWidth: 180,
      border: isMine ? 'none' : '0.5px solid rgba(200,51,74,0.15)'
    }}>
      <button onClick={toggle} style={{
        width: 36, height: 36, borderRadius: '50%', border: 'none',
        cursor: 'pointer', flexShrink: 0,
        background: isMine ? 'rgba(255,255,255,0.22)' : 'rgba(200,51,74,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill={isMine ? 'white' : '#C8334A'}>
          {playing
            ? <><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></>
            : <polygon points="5,3 19,12 5,21" />}
        </svg>
      </button>
      <div style={{ flex: 1 }}>
        <svg viewBox={`0 0 ${WAVE_H.length * 4} 22`} width="80" height="22" style={{ display: 'block' }}>
          {WAVE_H.map((h, i) => (
            <rect key={i} x={i * 4} y={22 - h} width={3} height={h} rx={1}
              fill={progress * WAVE_H.length > i
                ? (isMine ? 'rgba(255,255,255,0.9)' : '#C8334A')
                : (isMine ? 'rgba(255,255,255,0.32)' : 'rgba(200,51,74,0.25)')} />
          ))}
        </svg>
        <div style={{
          fontSize: 10, marginTop: 2,
          color: isMine ? 'rgba(255,255,255,0.58)' : MUTED
        }}>
          {Math.floor((duration || 0) / 60)}:{String((duration || 0) % 60).padStart(2, '0')} · {time}
        </div>
      </div>
    </div>
  )
})

// ========== СООБЩЕНИЕ ==========
const Message = React.memo(function Message({ msg, isMine, dark, partnerName, partnerAvatar, isFirst, isLast, showAv }) {
  const GRAD = 'linear-gradient(135deg, #C8334A, #8B1A2C)'
  const BG = isMine ? GRAD : (dark ? '#1E0A10' : '#FFFFFF')
  const COLOR = isMine ? '#FFFFFF' : (dark ? '#F5E8EA' : '#1C0A0E')
  const MUTED = dark ? '#8A5060' : '#9A6070'

  const borderRadius = isMine
    ? isLast ? '18px 18px 4px 18px' : '18px 18px 8px 18px'
    : isLast ? '18px 18px 18px 4px' : '18px 18px 18px 8px'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isMine ? 'flex-end' : 'flex-start',
      marginTop: isFirst ? 12 : 4,
      marginBottom: isLast ? 12 : 2,
      paddingLeft: !isMine && showAv ? 48 : 16,
      paddingRight: isMine ? 16 : 16,
    }}>
      {!isMine && showAv && (
        <div style={{
          position: 'absolute',
          left: 12,
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: partnerAvatar ? `url(${partnerAvatar}) center/cover` : GRAD,
          marginTop: -8,
        }} />
      )}

      <div style={{
        maxWidth: '75%',
        background: BG,
        borderRadius,
        padding: '8px 12px',
      }}>
        {/* Видео-кружочек */}
        {msg.is_video_circle && msg.video_url ? (
          <VideoCircle url={msg.video_url} isMine={isMine} time={fmtTime(msg.created_at)} />
        ) : msg.is_voice && msg.audio_url ? (
          /* Голосовое сообщение */
          <VoiceMessage
            url={msg.audio_url}
            isMine={isMine}
            dark={dark}
            duration={msg.duration}
            time={fmtTime(msg.created_at)}
          />
        ) : msg.photo_url ? (
          <img
            src={msg.photo_url}
            alt=""
            style={{ maxWidth: 280, maxHeight: 280, borderRadius: 12, cursor: 'pointer' }}
          />
        ) : msg.text ? (
          <div
            style={{ color: COLOR, fontSize: 15, lineHeight: 1.45, wordBreak: 'break-word' }}
            dangerouslySetInnerHTML={{ __html: parseText(msg.text) }}
          />
        ) : null}

        <div style={{
          fontSize: 11,
          color: isMine ? 'rgba(255,255,255,0.6)' : MUTED,
          marginTop: 4,
          textAlign: 'right'
        }}>
          {fmtTime(msg.created_at)}
          {msg.edited_at && <span style={{ marginLeft: 4 }}>(ред.)</span>}
        </div>
      </div>
    </div>
  )
})

// ========== ОСНОВНОЙ КОМПОНЕНТ ==========
export default function Chat({ session, profile, darkMode }) {
  const [messages, setMessages] = useState([])
  const [partner, setPartner] = useState(null)
  const [newText, setNewText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showDown, setShowDown] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  // Video circle states
  const [recording, setRecording] = useState(false)
  const [recSec, setRecSec] = useState(0)
  const previewVidRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const recTimer = useRef(null)
  const videoFileRef = useRef(null)

  // Voice states
  const [voiceRec, setVoiceRec] = useState(false)
  const voiceRecRef = useRef(null)
  const voiceChunks = useRef([])
  const voiceStream = useRef(null)

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

  useEffect(() => {
    if (profile?.partner_id) {
      supabase.from('profiles').select('*').eq('id', profile.partner_id).single().then(({ data }) => {
        if (data) setPartner(data)
      })
    }
  }, [profile])

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages(data || [])
    setLoading(false)
    setTimeout(() => endRef.current?.scrollIntoView(), 100)
  }, [])

  const scrollDown = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendMessage = async () => {
    if ((!newText.trim() && !photoFile) || sending) return

    setSending(true)
    try {
      let photoUrl = null
      if (photoFile) {
        photoUrl = await uploadFile(photoFile, 'chat')
      }

      await supabase.from('messages').insert({
        user_id: uid,
        text: newText.trim() || null,
        photo_url: photoUrl
      })

      setNewText('')
      setPhotoFile(null)
      setPhotoPreview(null)
      setTimeout(scrollDown, 100)
    } catch (err) {
      console.error(err)
    }
    setSending(false)
  }

  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    setShowDown(el.scrollHeight - el.scrollTop - el.clientHeight > 300)
  }, [])

  // ========== ВИДЕО-КРУЖОЧЕК ==========
  async function startRecord() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 300, height: 300 },
        audio: true
      })
      streamRef.current = stream
      if (previewVidRef.current) {
        previewVidRef.current.srcObject = stream
        previewVidRef.current.play()
      }

      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm'
      const rec = new MediaRecorder(stream, { mimeType: mime })
      recorderRef.current = rec
      chunksRef.current = []

      let sec = 0
      setRecSec(0)
      recTimer.current = setInterval(() => {
        sec++
        setRecSec(sec)
      }, 1000)

      rec.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      rec.onstop = async () => {
        clearInterval(recTimer.current)
        stream.getTracks().forEach(t => t.stop())
        if (previewVidRef.current) previewVidRef.current.srcObject = null
        streamRef.current = null

        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        const file = new File([blob], `circle-${Date.now()}.webm`, { type: 'video/webm' })

        setSending(true)
        try {
          const url = await uploadFile(file, 'circles')
          await supabase.from('messages').insert({
            user_id: uid,
            video_url: url,
            is_video_circle: true
          })
          scrollDown()
        } catch (e) {
          console.error(e)
        }
        setSending(false)
        setRecording(false)
        setRecSec(0)
      }

      rec.start()
      setRecording(true)

      // Auto-stop after 60 seconds
      setTimeout(() => {
        if (recorderRef.current?.state === 'recording') {
          recorderRef.current.stop()
        }
      }, 60000)
    } catch (err) {
      console.error('Failed to start recording:', err)
      alert('Нет доступа к камере')
    }
  }

  function stopRecord() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
  }

  function cancelRecord() {
    clearInterval(recTimer.current)
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (previewVidRef.current) previewVidRef.current.srcObject = null
    streamRef.current = null
    chunksRef.current = []
    setRecording(false)
    setRecSec(0)
  }

  async function onVideoFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSending(true)
    try {
      const url = await uploadFile(file, 'circles')
      await supabase.from('messages').insert({
        user_id: uid,
        video_url: url,
        is_video_circle: true
      })
      scrollDown()
    } catch (err) {
      console.error(err)
    }
    setSending(false)
    if (videoFileRef.current) videoFileRef.current.value = ''
  }

  // ========== ГОЛОСОВЫЕ ==========
  async function startVoice() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      voiceStream.current = stream

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const rec = new MediaRecorder(stream, { mimeType: mime })
      voiceRecRef.current = rec
      voiceChunks.current = []

      let sec = 0
      recTimer.current = setInterval(() => {
        sec++
        setRecSec(sec)
      }, 1000)

      rec.ondataavailable = e => {
        if (e.data.size > 0) voiceChunks.current.push(e.data)
      }

      rec.onstop = async () => {
        clearInterval(recTimer.current)
        stream.getTracks().forEach(t => t.stop())
        voiceStream.current = null

        const blob = new Blob(voiceChunks.current, { type: 'audio/webm' })
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })

        setSending(true)
        try {
          const url = await uploadFile(file, 'voices')
          await supabase.from('messages').insert({
            user_id: uid,
            audio_url: url,
            is_voice: true,
            duration: sec
          })
          scrollDown()
        } catch (err) {
          console.error(err)
        }
        setSending(false)
        setVoiceRec(false)
        setRecSec(0)
      }

      rec.start()
      setVoiceRec(true)
    } catch (err) {
      console.error(err)
      alert('Нет доступа к микрофону')
    }
  }

  function stopVoice() {
    clearInterval(recTimer.current)
    if (voiceRecRef.current?.state === 'recording') {
      voiceRecRef.current.stop()
    }
  }

  useEffect(() => {
    loadMessages()

    const channel = supabase.channel('chat')
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

  const groupedMessages = messages.map((msg, i) => {
    const prev = messages[i - 1]
    const next = messages[i + 1]
    const showDate = i === 0 || diffDate(msg.created_at, prev?.created_at)
    const isFirst = isFirstInGroup(msg, prev)
    const isLast = isLastInGroup(msg, next, uid)
    const showAv = needAvatar(msg, next, uid)
    return { msg, showDate, isFirst, isLast, showAv }
  })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BG }}>
      {/* Header */}
      <div style={{
        background: SURF,
        borderBottom: `0.5px solid ${BDR}`,
        padding: `max(50px, env(safe-area-inset-top, 0px)) 16px 12px`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: partner?.avatar_url ? `url(${partner.avatar_url}) center/cover` : GRAD,
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: INK }}>
            {partner?.name || 'Партнёр'}
          </div>
          <div style={{ fontSize: 12, color: MUTED }}>онлайн</div>
        </div>
      </div>

      {/* Video recording preview */}
      {recording && (
        <div style={{
          flexShrink: 0, padding: '10px 14px', background: SURF,
          borderBottom: `0.5px solid ${BDR}`, display: 'flex', alignItems: 'center', gap: 12
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', overflow: 'hidden',
            border: '2px solid #C8334A', flexShrink: 0
          }}>
            <video ref={previewVidRef} muted autoPlay playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: '#C8334A',
                animation: 'pulse 1s ease-in-out infinite'
              }} />
              <span style={{ fontSize: 13, color: '#C8334A', fontWeight: 500 }}>
                {Math.floor(recSec / 60)}:{String(recSec % 60).padStart(2, '0')}
              </span>
            </div>
            <div style={{ fontSize: 11, color: MUTED }}>Нажми «Отправить» когда закончишь</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={cancelRecord} style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'rgba(0,0,0,0.08)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={MUTED} strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <button onClick={stopRecord} style={{
              padding: '8px 16px', borderRadius: 20,
              background: GRAD, color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}>
              Отправить
            </button>
          </div>
        </div>
      )}

      {/* Voice recording preview */}
      {voiceRec && (
        <div style={{
          flexShrink: 0, padding: '10px 14px', background: SURF,
          borderBottom: `0.5px solid ${BDR}`, display: 'flex', alignItems: 'center', gap: 10
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', background: '#C8334A',
            animation: 'pulse 0.8s ease-in-out infinite'
          }} />
          <span style={{ fontSize: 14, color: '#C8334A', fontWeight: 500 }}>
            {Math.floor(recSec / 60)}:{String(recSec % 60).padStart(2, '0')}
          </span>
          <span style={{ fontSize: 12, color: MUTED, flex: 1 }}>Запись голосового...</span>
          <button onClick={stopVoice} style={{
            padding: '7px 16px', borderRadius: 20,
            background: GRAD, color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}>
            Отправить
          </button>
        </div>
      )}

      {/* Photo preview */}
      {photoPreview && (
        <div style={{
          background: SURF2,
          borderBottom: `1px solid ${BDR}`,
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <img src={photoPreview} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
          <div style={{ flex: 1, fontSize: 13, color: MUTED }}>Фото прикреплено</div>
          <button onClick={() => { setPhotoFile(null); setPhotoPreview(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Messages list */}
      <div ref={listRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: MUTED }}>Загрузка...</div>
        ) : (
          groupedMessages.map(({ msg, showDate, isFirst, isLast, showAv }) => (
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
                isFirst={isFirst}
                isLast={isLast}
                showAv={showAv}
              />
            </div>
          ))
        )}
        <div ref={endRef} />
        {showDown && (
          <button onClick={scrollDown} style={{
            position: 'sticky', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            background: GRAD, border: 'none', borderRadius: 20, padding: '8px 16px',
            color: 'white', fontSize: 12, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>↓ Новые сообщения</button>
        )}
      </div>

      {/* Input area */}
      <div style={{
        background: SURF,
        borderTop: `0.5px solid ${BDR}`,
        padding: `10px 12px calc(10px + env(safe-area-inset-bottom, 0px))`,
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          {/* Photo button */}
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

          {/* Video circle button */}
          <button
            onClick={recording ? stopRecord : startRecord}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: recording ? GRAD : 'rgba(200,51,74,0.09)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              animation: recording ? 'glow 1.4s ease-in-out infinite' : 'none'
            }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
              stroke={recording ? 'white' : '#C8334A'} strokeWidth="2" strokeLinecap="round">
              <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
          </button>
          <input ref={videoFileRef} type="file" accept="video/*" onChange={onVideoFile} style={{ display: 'none' }} />

          <textarea
            value={newText}
            onChange={e => setNewText(e.target.value)}
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
              minHeight: 40,
            }}
            rows={1}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          />

          {/* Voice or Send button */}
          {!newText.trim() && !photoFile && !recording && !voiceRec ? (
            <button
              style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: voiceRec ? GRAD : 'rgba(200,51,74,0.09)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                animation: voiceRec ? 'glow 0.8s ease-in-out infinite' : 'none'
              }}
              onMouseDown={startVoice}
              onMouseUp={stopVoice}
              onTouchStart={e => { e.preventDefault(); startVoice() }}
              onTouchEnd={e => { e.preventDefault(); stopVoice() }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                stroke={voiceRec ? 'white' : '#C8334A'} strokeWidth="2" strokeLinecap="round">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={sending || (!newText.trim() && !photoFile)}
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
                opacity: sending || (!newText.trim() && !photoFile) ? 0.5 : 1,
              }}
            >
              <IcoSend />
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(200,51,74,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(200,51,74,0); }
        }
      `}</style>
    </div>
  )
}
