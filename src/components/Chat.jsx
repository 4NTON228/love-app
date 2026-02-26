import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Send, Image, Video, X, ArrowDown, Mic, Play, Pause, Reply, Edit3, Trash2, Pin, Smile, Check, CheckCheck, Copy, RotateCcw, PinOff, Forward } from 'lucide-react'
import { sendPushNotification } from '../lib/push'

const REACTION_EMOJIS = ['❤️', '🔥', '😂', '👍', '😍', '😢', '🎉', '💋']

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
  const [audioProgress, setAudioProgress] = useState({})
  const [audioDuration, setAudioDuration] = useState({})
  const [cameraStream, setCameraStream] = useState(null)
  const [facingMode, setFacingMode] = useState('user')
  const [replyTo, setReplyTo] = useState(null)
  const [editingMsg, setEditingMsg] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [partnerOnline, setPartnerOnline] = useState(false)
  const [pinnedMessage, setPinnedMessage] = useState(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [reactionPickerFor, setReactionPickerFor] = useState(null)
  const [swipeStart, setSwipeStart] = useState({})
  const [swipeOffset, setSwipeOffset] = useState({})
  const [unreadCount, setUnreadCount] = useState(0)

  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const videoPreviewRef = useRef(null)
  const audioRefs = useRef({})
  const longPressRef = useRef(null)
  const typingChannelRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const inputRef = useRef(null)
  const presenceChannelRef = useRef(null)

  const myId = session.user.id

  useEffect(() => {
    loadMessages()

    const msgChannel = supabase
      .channel('tg-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev
            const updated = [...prev, payload.new]
            if (payload.new.user_id !== myId) {
              const el = chatContainerRef.current
              const isAtBottom = !el || (el.scrollHeight - el.scrollTop - el.clientHeight < 150)
              if (!isAtBottom) setUnreadCount(c => c + 1)
            }
            return updated
          })
          const el = chatContainerRef.current
          const isAtBottom = !el || (el.scrollHeight - el.scrollTop - el.clientHeight < 150)
          if (isAtBottom || payload.new.user_id === myId) setTimeout(scrollToBottom, 100)
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
          if (payload.new.is_pinned) setPinnedMessage(payload.new)
          else setPinnedMessage(prev => prev?.id === payload.new.id ? null : prev)
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
          setPinnedMessage(prev => prev?.id === payload.old.id ? null : prev)
        }
      )
      .subscribe()

    // Presence channel for typing & online
    const presenceCh = supabase.channel('chat-presence', {
      config: { presence: { key: myId } }
    })
    presenceChannelRef.current = presenceCh
    presenceCh
      .on('presence', { event: 'sync' }, () => {
        const state = presenceCh.presenceState()
        const others = Object.keys(state).filter(k => k !== myId)
        setPartnerOnline(others.length > 0)
        const isTyping = others.some(k => state[k]?.some?.(s => s.typing))
        setPartnerTyping(isTyping)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceCh.track({ typing: false, online: true })
        }
      })

    return () => {
      supabase.removeChannel(msgChannel)
      supabase.removeChannel(presenceCh)
    }
  }, [])

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(200)
    const msgs = data || []
    setMessages(msgs)
    setLoading(false)
    const pinned = msgs.findLast(m => m.is_pinned)
    if (pinned) setPinnedMessage(pinned)
    setTimeout(scrollToBottom, 200)
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setUnreadCount(0)
  }

  function handleScroll() {
    const el = chatContainerRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBtn(dist > 200)
    if (dist < 50) setUnreadCount(0)
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
    const text = editingMsg ? newText.trim() : newText.trim()
    if (!text && !photoFile) return

    if (editingMsg) {
      await supabase.from('messages').update({
        text: text || null,
        edited_at: new Date().toISOString()
      }).eq('id', editingMsg.id)
      setEditingMsg(null)
      setNewText('')
      return
    }

    setSending(true)
    try {
      let photoUrl = null
      if (photoFile) photoUrl = await uploadFile(photoFile, 'chat')
      await supabase.from('messages').insert({
        user_id: myId,
        text: text || null,
        photo_url: photoUrl,
        reply_to_id: replyTo?.id || null,
        reactions: {}
      })
      const senderName = profile?.name || 'Кто-то'
      sendPushNotification(senderName, photoUrl ? '📷 Фото' : text, myId)
      setNewText('')
      cancelPhoto()
      setReplyTo(null)
    } catch (err) {
      console.error('Send error:', err)
    }
    setSending(false)
    stopTyping()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      setEditingMsg(null)
      setReplyTo(null)
      setNewText('')
    }
  }

  async function handleTyping() {
    if (presenceChannelRef.current) {
      await presenceChannelRef.current.track({ typing: true, online: true })
    }
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(stopTyping, 2000)
  }

  async function stopTyping() {
    clearTimeout(typingTimeoutRef.current)
    if (presenceChannelRef.current) {
      await presenceChannelRef.current.track({ typing: false, online: true })
    }
  }

  // Context menu
  function openContextMenu(e, msg) {
    e.preventDefault()
    e.stopPropagation()
    const isMine = msg.user_id === myId
    setContextMenu({ msg, isMine })
    setReactionPickerFor(null)
  }

  function closeContextMenu() {
    setContextMenu(null)
    setReactionPickerFor(null)
  }

  function startEdit(msg) {
    setEditingMsg(msg)
    setNewText(msg.text || '')
    setContextMenu(null)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function startReply(msg) {
    setReplyTo(msg)
    setContextMenu(null)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  async function deleteMessage(id) {
    await supabase.from('messages').delete().eq('id', id)
    setContextMenu(null)
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text) } catch {}
    setContextMenu(null)
  }

  async function pinMessage(msg) {
    // Unpin previous
    const prev = messages.find(m => m.is_pinned)
    if (prev) await supabase.from('messages').update({ is_pinned: false }).eq('id', prev.id)
    const newPinned = !msg.is_pinned
    await supabase.from('messages').update({ is_pinned: newPinned }).eq('id', msg.id)
    setPinnedMessage(newPinned ? msg : null)
    setContextMenu(null)
  }

  async function addReaction(msgId, emoji) {
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return
    const reactions = { ...(msg.reactions || {}) }
    if (reactions[myId] === emoji) {
      delete reactions[myId]
    } else {
      reactions[myId] = emoji
    }
    await supabase.from('messages').update({ reactions }).eq('id', msgId)
    setReactionPickerFor(null)
    setContextMenu(null)
  }

  // Swipe to reply
  function handleTouchStart(e, msgId) {
    setSwipeStart(prev => ({ ...prev, [msgId]: e.touches[0].clientX }))
  }
  function handleTouchMove(e, msgId) {
    const startX = swipeStart[msgId]
    if (startX == null) return
    const dx = e.touches[0].clientX - startX
    if (dx > 0 && dx < 80) {
      setSwipeOffset(prev => ({ ...prev, [msgId]: dx }))
    }
  }
  function handleTouchEnd(e, msg) {
    const offset = swipeOffset[msg.id] || 0
    if (offset > 50) startReply(msg)
    setSwipeOffset(prev => ({ ...prev, [msg.id]: 0 }))
    setSwipeStart(prev => ({ ...prev, [msg.id]: null }))
  }

  // Long press
  function handleLongPressStart(e, msg) {
    longPressRef.current = setTimeout(() => {
      openContextMenu(e, msg)
      longPressRef.current = null
    }, 500)
  }
  function handleLongPressEnd() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }

  // Audio player
  function toggleAudio(msgId, url) {
    const cur = audioRefs.current[msgId]
    if (cur) {
      if (playingAudio === msgId) { cur.pause(); setPlayingAudio(null) }
      else {
        Object.values(audioRefs.current).forEach(a => a?.pause())
        setPlayingAudio(null)
        cur.play(); setPlayingAudio(msgId)
      }
    } else {
      Object.values(audioRefs.current).forEach(a => a?.pause())
      setPlayingAudio(null)
      const audio = new Audio(url)
      audioRefs.current[msgId] = audio
      audio.onloadedmetadata = () => {
        setAudioDuration(prev => ({ ...prev, [msgId]: audio.duration }))
      }
      audio.ontimeupdate = () => {
        setAudioProgress(prev => ({ ...prev, [msgId]: audio.currentTime }))
      }
      audio.onended = () => { setPlayingAudio(null); setAudioProgress(prev => ({ ...prev, [msgId]: 0 })) }
      audio.play()
      setPlayingAudio(msgId)
    }
  }

  function seekAudio(msgId, ratio) {
    const audio = audioRefs.current[msgId]
    if (audio && audioDuration[msgId]) {
      audio.currentTime = ratio * audioDuration[msgId]
    }
  }

  // Video & voice recording
  function setupMediaRecorder(stream) {
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
    const mediaRecorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = mediaRecorder
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      setCameraStream(null)
      clearInterval(timerRef.current)
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      if (blob.size < 1000) { setRecording(false); setRecordingType(null); setRecordingTime(0); return }
      const file = new File([blob], `circle-${Date.now()}.webm`, { type: 'video/webm' })
      setSending(true)
      try {
        const videoUrl = await uploadFile(file, 'circles')
        await supabase.from('messages').insert({ user_id: myId, video_url: videoUrl, is_video_circle: true, reactions: {} })
        sendPushNotification(profile?.name || 'Кто-то', '🔵 Видео-кружочек', myId)
      } catch {}
      setSending(false); setRecording(false); setRecordingType(null); setRecordingTime(0)
    }
    return mediaRecorder
  }

  async function startVideoCircle() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode, width: 240, height: 240 }, audio: true })
      setCameraStream(stream)
      setTimeout(() => { if (videoPreviewRef.current) { videoPreviewRef.current.srcObject = stream; videoPreviewRef.current.play() } }, 100)
      chunksRef.current = []
      const mr = setupMediaRecorder(stream)
      mr.start()
      setRecording(true); setRecordingType('video'); setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
      setTimeout(() => { if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop() }, 60000)
    } catch { alert('Нет доступа к камере') }
  }

  async function switchCamera() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = () => {}
      mediaRecorderRef.current.stop()
    }
    if (cameraStream) cameraStream.getTracks().forEach(t => t.stop())
    const newMode = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(newMode)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newMode, width: 240, height: 240 }, audio: true })
      setCameraStream(stream)
      if (videoPreviewRef.current) { videoPreviewRef.current.srcObject = stream; videoPreviewRef.current.play() }
      const mr = setupMediaRecorder(stream)
      mr.start()
    } catch { alert('Не удалось переключить камеру') }
  }

  async function startVoiceMessage() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        clearInterval(timerRef.current)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size < 1000) { setRecording(false); setRecordingType(null); setRecordingTime(0); return }
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
        setSending(true)
        try {
          const audioUrl = await uploadFile(file, 'voice')
          await supabase.from('messages').insert({
            user_id: myId, video_url: audioUrl, is_video_circle: false, is_voice: true,
            reply_to_id: replyTo?.id || null, reactions: {}
          })
          sendPushNotification(profile?.name || 'Кто-то', '🎤 Голосовое сообщение', myId)
          setReplyTo(null)
        } catch {}
        setSending(false); setRecording(false); setRecordingType(null); setRecordingTime(0)
      }
      mediaRecorder.start()
      setRecording(true); setRecordingType('audio'); setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch { alert('Нет доступа к микрофону') }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
  }

  function cancelRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = () => { if (cameraStream) cameraStream.getTracks().forEach(t => t.stop()); setCameraStream(null) }
      mediaRecorderRef.current.stop()
    }
    clearInterval(timerRef.current)
    setRecording(false); setRecordingType(null); setRecordingTime(0)
  }

  // Helpers
  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }
  function formatAudioTime(s) {
    if (!s || isNaN(s)) return '0:00'
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }
  function formatRecTime(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }
  function formatDateSep(dateStr) {
    const d = new Date(dateStr)
    const today = new Date(), yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Сегодня'
    if (d.toDateString() === yesterday.toDateString()) return 'Вчера'
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  }
  function shouldShowDate(msg, i) {
    if (i === 0) return true
    return new Date(messages[i - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString()
  }
  function isGrouped(msg, i) {
    if (i === 0) return false
    const prev = messages[i - 1]
    return prev.user_id === msg.user_id && !shouldShowDate(msg, i) &&
      (new Date(msg.created_at) - new Date(prev.created_at)) < 60000
  }
  function isLastInGroup(msg, i) {
    if (i === messages.length - 1) return true
    const next = messages[i + 1]
    return next.user_id !== msg.user_id || shouldShowDate(next, i + 1) ||
      (new Date(next.created_at) - new Date(msg.created_at)) >= 60000
  }

  const isMine = (msg) => msg.user_id === myId
  const isVoice = (msg) => (msg.video_url && !msg.is_video_circle && (msg.is_voice || msg.text === '🎤 Голосовое сообщение'))

  function getReactionsDisplay(msg) {
    const r = msg.reactions || {}
    const counts = {}
    Object.values(r).forEach(e => { counts[e] = (counts[e] || 0) + 1 })
    return Object.entries(counts).map(([emoji, count]) => ({ emoji, count, mine: r[myId] === emoji }))
  }

  function getReplyMsg(msg) {
    if (!msg.reply_to_id) return null
    return messages.find(m => m.id === msg.reply_to_id)
  }

  if (loading) return <div className="tg-loading"><div className="loading-heart">💕</div></div>

  return (
    <div className="tg-chat" onClick={() => { closeContextMenu(); setShowEmojiPicker(false) }}>

      {/* HEADER */}
      <div className="tg-header">
        <div className="tg-header-avatar">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : '💕'}
        </div>
        <div className="tg-header-info">
          <div className="tg-header-name">Наш чат 💕</div>
          <div className="tg-header-status">
            {partnerTyping ? (
              <span className="tg-typing-status">
                печатает<span className="tg-typing-dots"><span/><span/><span/></span>
              </span>
            ) : partnerOnline ? (
              <span style={{ color: '#4FC3F7' }}>онлайн</span>
            ) : (
              <span>только для нас двоих</span>
            )}
          </div>
        </div>
      </div>

      {/* PINNED MESSAGE */}
      {pinnedMessage && (
        <div className="tg-pinned" onClick={() => {
          const el = document.getElementById(`msg-${pinnedMessage.id}`)
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }}>
          <div className="tg-pinned-bar" />
          <div className="tg-pinned-content">
            <div className="tg-pinned-label">📌 Закреплено</div>
            <div className="tg-pinned-text">{pinnedMessage.text || (pinnedMessage.photo_url ? '📷 Фото' : pinnedMessage.is_video_circle ? '🔵 Кружочек' : '🎤 Голосовое')}</div>
          </div>
          <button className="tg-pinned-close" onClick={(e) => { e.stopPropagation(); pinMessage(pinnedMessage) }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* MESSAGES */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="tg-messages"
        onClick={closeContextMenu}
      >
        {messages.length === 0 ? (
          <div className="tg-empty">
            <div style={{ fontSize: 56, marginBottom: 12 }}>💌</div>
            <p>Напишите первое сообщение!</p>
          </div>
        ) : messages.map((msg, index) => {
          const mine = isMine(msg)
          const voice = isVoice(msg)
          const grouped = isGrouped(msg, index)
          const lastInGroup = isLastInGroup(msg, index)
          const replyMsg = getReplyMsg(msg)
          const rxDisplay = getReactionsDisplay(msg)
          const offset = swipeOffset[msg.id] || 0

          return (
            <div key={msg.id}>
              {shouldShowDate(msg, index) && (
                <div className="tg-date-sep"><span>{formatDateSep(msg.created_at)}</span></div>
              )}

              <div
                id={`msg-${msg.id}`}
                className={`tg-msg-row ${mine ? 'mine' : 'theirs'} ${grouped ? 'grouped' : ''}`}
                style={{ transform: offset ? `translateX(${offset}px)` : undefined, transition: offset ? 'none' : 'transform 0.2s ease' }}
                onTouchStart={(e) => { handleTouchStart(e, msg.id); handleLongPressStart(e, msg) }}
                onTouchMove={(e) => handleTouchMove(e, msg.id)}
                onTouchEnd={(e) => { handleTouchEnd(e, msg); handleLongPressEnd() }}
                onMouseDown={(e) => handleLongPressStart(e, msg)}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
                onContextMenu={(e) => openContextMenu(e, msg)}
              >
                {/* Swipe reply indicator */}
                {offset > 20 && (
                  <div className="tg-swipe-reply-icon" style={{ opacity: Math.min(offset / 60, 1) }}>
                    <Reply size={18} color="#E8466A" />
                  </div>
                )}

                {/* VIDEO CIRCLE */}
                {msg.is_video_circle && msg.video_url ? (
                  <div className={`tg-circle-wrap ${mine ? 'mine' : 'theirs'}`}>
                    <video
                      src={msg.video_url}
                      className="tg-circle-video"
                      playsInline preload="metadata"
                      onClick={(e) => { const v = e.target; v.paused ? v.play() : v.pause() }}
                    />
                    <div className="tg-circle-time">
                      {formatTime(msg.created_at)}
                      {mine && <span className="tg-tick">{partnerOnline ? '✓✓' : '✓'}</span>}
                    </div>
                  </div>

                ) : voice ? (
                  /* VOICE MESSAGE */
                  <div className={`tg-bubble ${mine ? 'mine' : 'theirs'} voice ${lastInGroup ? 'tail' : ''}`}>
                    {replyMsg && <ReplyPreview msg={replyMsg} mine={mine} />}
                    <div className="tg-voice-inner">
                      <button className="tg-voice-play-btn" onClick={() => toggleAudio(msg.id, msg.video_url)}>
                        {playingAudio === msg.id ? <Pause size={18} /> : <Play size={18} />}
                      </button>
                      <div className="tg-voice-right">
                        <div
                          className="tg-voice-progress-wrap"
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            seekAudio(msg.id, (e.clientX - rect.left) / rect.width)
                          }}
                        >
                          <div className="tg-voice-track">
                            <div
                              className={`tg-voice-fill ${mine ? 'mine' : 'theirs'}`}
                              style={{ width: `${audioDuration[msg.id] ? (audioProgress[msg.id] || 0) / audioDuration[msg.id] * 100 : 0}%` }}
                            />
                            <div className="tg-voice-wave">
                              {Array.from({ length: 30 }, (_, i) => (
                                <div
                                  key={i}
                                  className={`tg-wave-bar ${mine ? 'mine' : 'theirs'}`}
                                  style={{ height: `${4 + Math.abs(Math.sin(i * 0.7 + msg.id?.charCodeAt(0)) * 14)}px` }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="tg-voice-footer">
                          <span className="tg-voice-duration">
                            {playingAudio === msg.id ? formatAudioTime(audioProgress[msg.id]) : formatAudioTime(audioDuration[msg.id])}
                          </span>
                          <span className="tg-msg-time">
                            {formatTime(msg.created_at)}
                            {mine && <span className={`tg-tick ${partnerOnline ? 'read' : ''}`}>{partnerOnline ? ' ✓✓' : ' ✓'}</span>}
                          </span>
                        </div>
                      </div>
                    </div>
                    {rxDisplay.length > 0 && <ReactionsBar reactions={rxDisplay} msgId={msg.id} onAdd={addReaction} />}
                  </div>

                ) : (
                  /* TEXT / PHOTO BUBBLE */
                  <div className={`tg-bubble ${mine ? 'mine' : 'theirs'} ${msg.photo_url && !msg.text ? 'photo-only' : ''} ${lastInGroup ? 'tail' : ''}`}>
                    {replyMsg && <ReplyPreview msg={replyMsg} mine={mine} />}
                    {msg.photo_url && (
                      <img src={msg.photo_url} alt="" className="tg-photo" loading="lazy" />
                    )}
                    {msg.text && <div className="tg-text">{msg.text}</div>}
                    <div className="tg-meta">
                      {msg.edited_at && <span className="tg-edited">изм.</span>}
                      <span className="tg-time">{formatTime(msg.created_at)}</span>
                      {mine && (
                        <span className={`tg-tick ${partnerOnline ? 'read' : ''}`}>
                          {partnerOnline ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                    {rxDisplay.length > 0 && <ReactionsBar reactions={rxDisplay} msgId={msg.id} onAdd={addReaction} />}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Typing indicator */}
        {partnerTyping && (
          <div className="tg-msg-row theirs" style={{ marginBottom: 8 }}>
            <div className="tg-bubble theirs tail tg-typing-bubble">
              <div className="tg-typing-indicator">
                <span/><span/><span/>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* SCROLL TO BOTTOM */}
      {showScrollBtn && (
        <button onClick={scrollToBottom} className="tg-scroll-btn">
          <ArrowDown size={18} />
          {unreadCount > 0 && <span className="tg-scroll-badge">{unreadCount}</span>}
        </button>
      )}

      {/* CONTEXT MENU */}
      {contextMenu && (
        <div className="tg-ctx-overlay" onClick={closeContextMenu}>
          <div className="tg-ctx-menu" onClick={e => e.stopPropagation()}>
            {/* Reaction row */}
            <div className="tg-ctx-reactions">
              {REACTION_EMOJIS.map(emoji => (
                <button key={emoji} className="tg-ctx-reaction-btn" onClick={() => addReaction(contextMenu.msg.id, emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
            <div className="tg-ctx-divider" />
            <button className="tg-ctx-item" onClick={() => startReply(contextMenu.msg)}>
              <Reply size={18} /> Ответить
            </button>
            {contextMenu.msg.text && (
              <button className="tg-ctx-item" onClick={() => copyText(contextMenu.msg.text)}>
                <Copy size={18} /> Копировать
              </button>
            )}
            {contextMenu.isMine && contextMenu.msg.text && (
              <button className="tg-ctx-item" onClick={() => startEdit(contextMenu.msg)}>
                <Edit3 size={18} /> Редактировать
              </button>
            )}
            <button className="tg-ctx-item" onClick={() => pinMessage(contextMenu.msg)}>
              {contextMenu.msg.is_pinned ? <><PinOff size={18} /> Открепить</> : <><Pin size={18} /> Закрепить</>}
            </button>
            {contextMenu.isMine && (
              <button className="tg-ctx-item danger" onClick={() => {
                if (confirm('Удалить сообщение?')) deleteMessage(contextMenu.msg.id)
              }}>
                <Trash2 size={18} /> Удалить
              </button>
            )}
          </div>
        </div>
      )}

      {/* REPLY PREVIEW BAR */}
      {replyTo && (
        <div className="tg-reply-bar">
          <div className="tg-reply-bar-line" />
          <div className="tg-reply-bar-content">
            <div className="tg-reply-bar-name">{isMine(replyTo) ? 'Вы' : (profile?.name || 'Партнёр')}</div>
            <div className="tg-reply-bar-text">{replyTo.text || (replyTo.photo_url ? '📷 Фото' : replyTo.is_video_circle ? '🔵 Кружочек' : '🎤 Голосовое')}</div>
          </div>
          <button onClick={() => setReplyTo(null)} className="tg-reply-bar-close"><X size={18} /></button>
        </div>
      )}

      {/* EDIT PREVIEW BAR */}
      {editingMsg && (
        <div className="tg-reply-bar editing">
          <div className="tg-reply-bar-line edit" />
          <div className="tg-reply-bar-content">
            <div className="tg-reply-bar-name edit">✏️ Редактирование</div>
            <div className="tg-reply-bar-text">{editingMsg.text}</div>
          </div>
          <button onClick={() => { setEditingMsg(null); setNewText('') }} className="tg-reply-bar-close"><X size={18} /></button>
        </div>
      )}

      {/* PHOTO PREVIEW */}
      {photoPreview && (
        <div className="tg-photo-preview-bar">
          <img src={photoPreview} alt="" />
          <span>Фото прикреплено</span>
          <button onClick={cancelPhoto}><X size={20} /></button>
        </div>
      )}

      {/* RECORDING PANEL */}
      {recording && (
        <div className="tg-recording-panel">
          {recordingType === 'video' && (
            <div style={{ position: 'relative' }}>
              <video ref={videoPreviewRef} muted playsInline className="tg-rec-preview" />
              <div className="tg-rec-timer">{formatRecTime(recordingTime)}</div>
            </div>
          )}
          {recordingType === 'audio' && (
            <div className="tg-rec-audio">
              <div className="tg-rec-mic-pulse"><Mic size={24} color="#E8466A" /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>Запись...</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{formatRecTime(recordingTime)}</div>
              </div>
            </div>
          )}
          <div className="tg-rec-actions">
            <button onClick={cancelRecording} className="tg-rec-cancel">Отмена</button>
            {recordingType === 'video' && <button onClick={switchCamera} className="tg-rec-switch">🔄</button>}
            <button onClick={stopRecording} className="tg-rec-send"><Send size={16} /> Отправить</button>
          </div>
        </div>
      )}

      {/* INPUT BAR */}
      {!recording && (
        <div className="tg-input-bar">
          <button onClick={() => setShowEmojiPicker(v => !v)} className="tg-input-icon-btn">
            <Smile size={22} color={showEmojiPicker ? 'var(--primary)' : '#8B7088'} />
          </button>
          <div className="tg-input-field">
            <textarea
              ref={inputRef}
              value={newText}
              onChange={(e) => { setNewText(e.target.value); handleTyping() }}
              onKeyDown={handleKeyDown}
              placeholder={editingMsg ? 'Редактировать сообщение...' : 'Сообщение...'}
              rows={1}
              onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
            />
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="tg-input-icon-btn">
            <Image size={22} color="#8B7088" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />
          {(newText.trim() || photoFile || editingMsg) ? (
            <button onClick={handleSend} disabled={sending} className="tg-send-btn">
              <Send size={20} color="white" />
            </button>
          ) : (
            <>
              <button onClick={startVoiceMessage} className="tg-input-icon-btn">
                <Mic size={22} color="#8B7088" />
              </button>
              <button onClick={startVideoCircle} className="tg-input-icon-btn">
                <Video size={22} color="#8B7088" />
              </button>
            </>
          )}
        </div>
      )}

      {/* EMOJI PICKER */}
      {showEmojiPicker && (
        <div className="tg-emoji-picker" onClick={e => e.stopPropagation()}>
          {['😍','❤️','🔥','💋','💕','😘','🥰','😂','👍','😊','🎉','✨','💫','🌹','🦋','💌','😭','🤗','💯','🫶','💪','🙈','😏','🥺','🤩','😇','💝','🌸','🍀','🌙'].map(e => (
            <button key={e} className="tg-emoji-btn" onClick={() => { setNewText(t => t + e); setShowEmojiPicker(false); inputRef.current?.focus() }}>
              {e}
            </button>
          ))}
        </div>
      )}

      <TGStyles partnerOnline={partnerOnline} />
    </div>
  )
}

function ReplyPreview({ msg, mine }) {
  const isVoice = msg.video_url && !msg.is_video_circle && (msg.is_voice || msg.text === '🎤 Голосовое сообщение')
  const text = msg.text || (msg.photo_url ? '📷 Фото' : msg.is_video_circle ? '🔵 Кружочек' : isVoice ? '🎤 Голосовое' : '')
  return (
    <div className={`tg-reply-preview ${mine ? 'mine' : 'theirs'}`}>
      <div className="tg-reply-preview-line" />
      <div className="tg-reply-preview-body">
        <div className="tg-reply-preview-name">{msg._senderName || 'Сообщение'}</div>
        {msg.photo_url && <img src={msg.photo_url} alt="" className="tg-reply-photo-thumb" />}
        <div className="tg-reply-preview-text">{text}</div>
      </div>
    </div>
  )
}

function ReactionsBar({ reactions, msgId, onAdd }) {
  return (
    <div className="tg-reactions">
      {reactions.map(({ emoji, count, mine }) => (
        <button key={emoji} className={`tg-reaction ${mine ? 'mine' : ''}`} onClick={() => onAdd(msgId, emoji)}>
          {emoji} {count > 1 && <span>{count}</span>}
        </button>
      ))}
    </div>
  )
}

function TGStyles() {
  return (
    <style>{`
      .tg-chat {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 110px;
        display: flex; flex-direction: column;
        background: #FFF0F4;
        z-index: 5;
        overflow: hidden;
      }
      /* TG background pattern */
      .tg-chat::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: radial-gradient(circle, rgba(232,70,106,0.06) 1px, transparent 1px);
        background-size: 20px 20px;
        pointer-events: none;
        z-index: 0;
      }
      .tg-loading {
        display: flex; align-items: center; justify-content: center;
        height: 100vh; background: var(--bg);
      }
      /* HEADER */
      .tg-header {
        position: relative; z-index: 10;
        padding: 10px 16px;
        padding-top: calc(10px + env(safe-area-inset-top, 0px));
        background: linear-gradient(135deg, #E8466A, #F06292);
        display: flex; align-items: center; gap: 12px;
        flex-shrink: 0;
        box-shadow: 0 2px 12px rgba(232,70,106,0.3);
      }
      .tg-header-avatar {
        width: 42px; height: 42px; border-radius: 50%;
        background: rgba(255,255,255,0.25);
        display: flex; align-items: center; justify-content: center;
        font-size: 20px; flex-shrink: 0; overflow: hidden;
        border: 2px solid rgba(255,255,255,0.4);
      }
      .tg-header-avatar img { width: 100%; height: 100%; object-fit: cover; }
      .tg-header-name {
        font-weight: 700; font-size: 17px; color: white;
        font-family: var(--font-display);
      }
      .tg-header-status { font-size: 12px; color: rgba(255,255,255,0.8); margin-top: 1px; }
      .tg-typing-status { display: flex; align-items: center; gap: 2px; }
      .tg-typing-dots {
        display: inline-flex; gap: 2px; align-items: center; margin-left: 2px;
      }
      .tg-typing-dots span {
        width: 4px; height: 4px; border-radius: 50%;
        background: rgba(255,255,255,0.8);
        animation: tgDot 1.2s ease-in-out infinite;
      }
      .tg-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
      .tg-typing-dots span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes tgDot {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
        30% { transform: translateY(-4px); opacity: 1; }
      }
      /* PINNED */
      .tg-pinned {
        position: relative; z-index: 9;
        display: flex; align-items: center; gap: 10px;
        padding: 8px 14px; background: white;
        border-bottom: 1px solid rgba(232,70,106,0.1);
        cursor: pointer; flex-shrink: 0;
      }
      .tg-pinned-bar { width: 3px; height: 32px; background: var(--primary); border-radius: 3px; flex-shrink: 0; }
      .tg-pinned-content { flex: 1; min-width: 0; }
      .tg-pinned-label { font-size: 11px; font-weight: 700; color: var(--primary); margin-bottom: 2px; }
      .tg-pinned-text { font-size: 13px; color: var(--text-light); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .tg-pinned-close { background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px; }
      /* MESSAGES AREA */
      .tg-messages {
        flex: 1; overflow-y: auto; overflow-x: hidden;
        padding: 8px 10px 12px;
        display: flex; flex-direction: column;
        gap: 0;
        -webkit-overflow-scrolling: touch;
        position: relative; z-index: 1;
      }
      .tg-messages::-webkit-scrollbar { display: none; }
      .tg-empty {
        text-align: center; padding: 60px 20px;
        color: var(--text-muted); margin: auto;
      }
      .tg-empty p { font-size: 16px; font-family: var(--font-display); margin-top: 8px; }
      /* DATE SEPARATOR */
      .tg-date-sep {
        text-align: center; margin: 12px 0 6px; pointer-events: none;
      }
      .tg-date-sep span {
        background: rgba(0,0,0,0.15); backdrop-filter: blur(8px);
        padding: 4px 14px; border-radius: 14px;
        font-size: 12px; color: white; font-weight: 600;
      }
      /* MESSAGE ROW */
      .tg-msg-row {
        display: flex; align-items: flex-end; margin-bottom: 2px;
        position: relative; user-select: none;
      }
      .tg-msg-row.mine { justify-content: flex-end; padding-right: 6px; }
      .tg-msg-row.theirs { justify-content: flex-start; padding-left: 6px; }
      .tg-msg-row.grouped { margin-bottom: 1px; }
      /* SWIPE REPLY ICON */
      .tg-swipe-reply-icon {
        position: absolute; left: -30px;
        display: flex; align-items: center; justify-content: center;
      }
      /* BUBBLES */
      .tg-bubble {
        max-width: 78%;
        word-break: break-word;
        position: relative;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }
      .tg-bubble.mine {
        background: linear-gradient(135deg, #E8466A, #F06292);
        color: white;
        border-radius: 18px 18px 4px 18px;
        padding: 8px 12px 6px;
      }
      .tg-bubble.theirs {
        background: white;
        color: var(--text);
        border-radius: 18px 18px 18px 4px;
        padding: 8px 12px 6px;
      }
      /* TAILS — only on last in group */
      .tg-bubble.mine.tail {
        border-radius: 18px 18px 4px 18px;
      }
      .tg-bubble.mine.tail::after {
        content: '';
        position: absolute;
        bottom: 0; right: -7px;
        width: 12px; height: 16px;
        background: #F06292;
        clip-path: polygon(0 0, 0 100%, 100% 100%);
      }
      .tg-bubble.theirs.tail {
        border-radius: 18px 18px 18px 4px;
      }
      .tg-bubble.theirs.tail::after {
        content: '';
        position: absolute;
        bottom: 0; left: -7px;
        width: 12px; height: 16px;
        background: white;
        clip-path: polygon(100% 0, 0 100%, 100% 100%);
      }
      .tg-bubble.photo-only { padding: 3px; }
      .tg-photo {
        max-width: 100%; max-height: 300px;
        border-radius: 15px; display: block;
      }
      .tg-text { font-size: 15px; line-height: 1.45; white-space: pre-wrap; }
      .tg-meta {
        display: flex; align-items: center; justify-content: flex-end;
        gap: 3px; margin-top: 3px;
      }
      .tg-edited { font-size: 10px; opacity: 0.6; }
      .tg-time { font-size: 11px; opacity: 0.65; }
      .tg-tick { font-size: 11px; opacity: 0.65; }
      .tg-tick.read { opacity: 1; color: #4FC3F7; }
      .tg-bubble.mine .tg-time, .tg-bubble.mine .tg-tick, .tg-bubble.mine .tg-edited { color: rgba(255,255,255,0.85); }
      /* VIDEO CIRCLE */
      .tg-circle-wrap {
        position: relative; display: inline-block;
      }
      .tg-circle-wrap.mine { margin-right: 6px; }
      .tg-circle-wrap.theirs { margin-left: 6px; }
      .tg-circle-video {
        width: 180px; height: 180px; border-radius: 50%;
        object-fit: cover; display: block;
        border: 3px solid #E8466A; cursor: pointer;
      }
      .tg-circle-time {
        position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
        background: rgba(0,0,0,0.5); border-radius: 10px;
        padding: 2px 8px; font-size: 11px; color: white;
        display: flex; gap: 4px; align-items: center;
      }
      /* VOICE MESSAGE */
      .tg-bubble.voice { min-width: 200px; max-width: 78%; }
      .tg-voice-inner {
        display: flex; align-items: center; gap: 10px;
      }
      .tg-voice-play-btn {
        width: 38px; height: 38px; border-radius: 50%; border: none;
        cursor: pointer; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
      }
      .tg-bubble.mine .tg-voice-play-btn { background: rgba(255,255,255,0.25); color: white; }
      .tg-bubble.theirs .tg-voice-play-btn { background: rgba(232,70,106,0.12); color: var(--primary); }
      .tg-voice-right { flex: 1; min-width: 0; }
      .tg-voice-progress-wrap {
        cursor: pointer; padding: 6px 0;
      }
      .tg-voice-track {
        position: relative; height: 20px; display: flex; align-items: center;
      }
      .tg-voice-fill {
        position: absolute; left: 0; top: 50%; transform: translateY(-50%);
        height: 3px; border-radius: 2px; z-index: 2; transition: width 0.1s;
      }
      .tg-voice-fill.mine { background: rgba(255,255,255,0.9); }
      .tg-voice-fill.theirs { background: var(--primary); }
      .tg-voice-wave {
        display: flex; align-items: center; gap: 2px; width: 100%;
      }
      .tg-wave-bar {
        width: 2px; border-radius: 2px; flex: 1; min-width: 2px;
      }
      .tg-wave-bar.mine { background: rgba(255,255,255,0.4); }
      .tg-wave-bar.theirs { background: rgba(232,70,106,0.25); }
      .tg-voice-footer {
        display: flex; justify-content: space-between; align-items: center;
        margin-top: 2px;
      }
      .tg-voice-duration { font-size: 11px; opacity: 0.65; }
      .tg-msg-time { font-size: 11px; opacity: 0.65; }
      /* TYPING BUBBLE */
      .tg-typing-bubble { padding: 10px 16px; }
      .tg-typing-indicator {
        display: flex; gap: 4px; align-items: center;
      }
      .tg-typing-indicator span {
        width: 7px; height: 7px; border-radius: 50%;
        background: #C0A0A8;
        animation: tgBounce 1.2s ease-in-out infinite;
      }
      .tg-typing-indicator span:nth-child(2) { animation-delay: 0.15s; }
      .tg-typing-indicator span:nth-child(3) { animation-delay: 0.3s; }
      @keyframes tgBounce {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-6px); }
      }
      /* SCROLL BUTTON */
      .tg-scroll-btn {
        position: fixed; bottom: 170px; right: 14px;
        width: 42px; height: 42px; border-radius: 50%;
        background: white; border: none;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 20; color: var(--primary);
      }
      .tg-scroll-badge {
        position: absolute; top: -4px; right: -4px;
        background: var(--primary); color: white;
        border-radius: 10px; font-size: 10px; font-weight: 700;
        padding: 1px 5px; min-width: 18px; text-align: center;
      }
      /* CONTEXT MENU */
      .tg-ctx-overlay {
        position: fixed; inset: 0; z-index: 100;
        background: rgba(0,0,0,0.3); backdrop-filter: blur(2px);
        display: flex; align-items: center; justify-content: center;
      }
      .tg-ctx-menu {
        background: white; border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 8px 40px rgba(0,0,0,0.25);
        min-width: 200px;
        animation: tgCtxIn 0.15s ease;
      }
      @keyframes tgCtxIn {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
      }
      .tg-ctx-reactions {
        display: flex; padding: 12px 10px;
        gap: 6px; justify-content: center;
      }
      .tg-ctx-reaction-btn {
        font-size: 24px; background: none; border: none; cursor: pointer;
        width: 40px; height: 40px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        transition: transform 0.15s;
      }
      .tg-ctx-reaction-btn:active { transform: scale(0.8); }
      .tg-ctx-divider { height: 1px; background: #f0f0f0; }
      .tg-ctx-item {
        width: 100%; padding: 13px 18px;
        display: flex; align-items: center; gap: 12px;
        background: none; border: none; cursor: pointer;
        font-size: 15px; font-family: var(--font-body);
        color: var(--text); text-align: left;
        border-bottom: 1px solid #fafafa;
      }
      .tg-ctx-item:last-child { border-bottom: none; }
      .tg-ctx-item:active { background: #f8f8f8; }
      .tg-ctx-item.danger { color: #E8466A; }
      /* REPLY PREVIEW inside bubble */
      .tg-reply-preview {
        display: flex; gap: 6px; margin-bottom: 6px;
        padding: 6px 8px; border-radius: 8px;
        cursor: pointer;
      }
      .tg-reply-preview.mine { background: rgba(255,255,255,0.15); }
      .tg-reply-preview.theirs { background: rgba(232,70,106,0.08); }
      .tg-reply-preview-line {
        width: 3px; border-radius: 2px; flex-shrink: 0;
        background: var(--primary);
      }
      .tg-reply-preview.mine .tg-reply-preview-line { background: rgba(255,255,255,0.7); }
      .tg-reply-preview-body { flex: 1; min-width: 0; }
      .tg-reply-preview-name { font-size: 12px; font-weight: 700; color: var(--primary); margin-bottom: 2px; }
      .tg-reply-preview.mine .tg-reply-preview-name { color: rgba(255,255,255,0.9); }
      .tg-reply-preview-text { font-size: 12px; opacity: 0.75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .tg-reply-photo-thumb { width: 32px; height: 32px; object-fit: cover; border-radius: 6px; float: right; margin-left: 6px; }
      /* REPLY BAR */
      .tg-reply-bar {
        display: flex; align-items: center; gap: 10px;
        padding: 8px 14px; background: white;
        border-top: 1px solid rgba(232,70,106,0.1);
        flex-shrink: 0; position: relative; z-index: 5;
      }
      .tg-reply-bar-line { width: 3px; height: 32px; background: var(--primary); border-radius: 3px; flex-shrink: 0; }
      .tg-reply-bar-line.edit { background: #2196F3; }
      .tg-reply-bar-content { flex: 1; min-width: 0; }
      .tg-reply-bar-name { font-size: 12px; font-weight: 700; color: var(--primary); margin-bottom: 2px; }
      .tg-reply-bar-name.edit { color: #2196F3; }
      .tg-reply-bar-text { font-size: 13px; color: var(--text-light); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .tg-reply-bar-close { background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px; }
      /* PHOTO PREVIEW BAR */
      .tg-photo-preview-bar {
        padding: 8px 14px; background: white;
        border-top: 1px solid #eee;
        display: flex; align-items: center; gap: 10px; flex-shrink: 0;
      }
      .tg-photo-preview-bar img { width: 48px; height: 48px; object-fit: cover; border-radius: 8px; }
      .tg-photo-preview-bar span { font-size: 13px; color: var(--text-light); flex: 1; }
      .tg-photo-preview-bar button { background: none; border: none; cursor: pointer; color: var(--text-muted); }
      /* RECORDING */
      .tg-recording-panel {
        padding: 16px; background: white;
        border-top: 1px solid rgba(232,70,106,0.1);
        display: flex; flex-direction: column;
        align-items: center; gap: 12px; flex-shrink: 0;
      }
      .tg-rec-preview {
        width: 140px; height: 140px; border-radius: 50%;
        object-fit: cover; border: 4px solid #E8466A;
        animation: tgPulse 1.5s ease-in-out infinite;
        transform: scaleX(-1);
      }
      .tg-rec-timer {
        position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%);
        background: #E8466A; border-radius: 12px;
        padding: 3px 12px; font-size: 13px; color: white; font-weight: 700;
      }
      .tg-rec-audio {
        display: flex; align-items: center; gap: 14px;
      }
      .tg-rec-mic-pulse {
        width: 52px; height: 52px; border-radius: 50%;
        background: rgba(232,70,106,0.1);
        display: flex; align-items: center; justify-content: center;
        animation: tgPulse 1.5s ease-in-out infinite;
      }
      @keyframes tgPulse {
        0%, 100% { box-shadow: 0 0 0 4px rgba(232,70,106,0.15); }
        50% { box-shadow: 0 0 0 10px rgba(232,70,106,0.25); }
      }
      .tg-rec-actions { display: flex; gap: 10px; }
      .tg-rec-cancel {
        padding: 10px 22px; background: #F5F0F3; border: none;
        border-radius: 22px; font-size: 14px; font-weight: 600;
        font-family: var(--font-body); color: var(--text-light); cursor: pointer;
      }
      .tg-rec-switch {
        padding: 10px 16px; background: #F5F0F3; border: none;
        border-radius: 22px; font-size: 18px; cursor: pointer;
      }
      .tg-rec-send {
        padding: 10px 22px; background: linear-gradient(135deg, #E8466A, #F06292);
        border: none; border-radius: 22px; font-size: 14px; font-weight: 700;
        font-family: var(--font-body); color: white; cursor: pointer;
        display: flex; align-items: center; gap: 6px;
      }
      /* INPUT BAR */
      .tg-input-bar {
        padding: 8px 10px;
        padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
        background: white;
        border-top: 1px solid rgba(232,70,106,0.06);
        display: flex; align-items: flex-end; gap: 4px;
        flex-shrink: 0; position: relative; z-index: 5;
      }
      .tg-input-icon-btn {
        background: none; border: none; cursor: pointer;
        padding: 8px; border-radius: 50%;
        display: flex; flex-shrink: 0;
        -webkit-tap-highlight-color: transparent;
      }
      .tg-input-field {
        flex: 1; background: #F5F0F3; border-radius: 22px;
        padding: 0 14px; display: flex; align-items: flex-end;
        min-width: 0;
      }
      .tg-input-field textarea {
        flex: 1; border: none; background: none;
        padding: 10px 0; font-size: 15px;
        font-family: var(--font-body); color: var(--text);
        resize: none; outline: none; max-height: 120px; line-height: 1.4;
        width: 100%;
      }
      .tg-send-btn {
        width: 42px; height: 42px;
        background: linear-gradient(135deg, #E8466A, #F06292);
        border: none; cursor: pointer; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; box-shadow: 0 2px 8px rgba(232,70,106,0.35);
      }
      /* EMOJI PICKER */
      .tg-emoji-picker {
        position: absolute; bottom: calc(100% + 8px); left: 8px;
        background: white; border-radius: 16px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.18);
        padding: 12px;
        display: flex; flex-wrap: wrap; gap: 4px;
        max-width: calc(100% - 16px);
        z-index: 50;
        animation: tgCtxIn 0.15s ease;
      }
      .tg-emoji-btn {
        font-size: 22px; background: none; border: none;
        cursor: pointer; width: 36px; height: 36px;
        border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
      }
      .tg-emoji-btn:active { background: #f0f0f0; }
      /* REACTIONS */
      .tg-reactions {
        display: flex; flex-wrap: wrap; gap: 4px;
        margin-top: 4px;
      }
      .tg-reaction {
        display: flex; align-items: center; gap: 3px;
        padding: 2px 8px; border-radius: 12px;
        background: rgba(0,0,0,0.06); border: 1px solid transparent;
        font-size: 14px; cursor: pointer;
      }
      .tg-reaction.mine {
        background: rgba(232,70,106,0.12);
        border-color: rgba(232,70,106,0.3);
      }
      .tg-reaction span { font-size: 12px; font-weight: 600; }
    `}</style>
  )
}
