import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { Send, Image, Video, X, ArrowDown, Mic, Play, Pause, Reply, Edit3, Trash2, Pin, Smile, Check, CheckCheck, Copy, RotateCcw, PinOff, Forward } from 'lucide-react'
import { sendPushNotification } from '../lib/push'  // ← ИМПОРТ ДОБАВЛЕН!

const REACTION_EMOJIS = ['❤️', '🔥', '😂', '👍', '😍', '😢', '🎉', '💋']

export default function Chat({ session, profile, darkMode }) {
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
  const [reactionBurst, setReactionBurst] = useState(null)
  const [swipeStart, setSwipeStart] = useState({})
  const [swipeOffset, setSwipeOffset] = useState({})
  const [unreadCount, setUnreadCount] = useState(0)
  const [partnerLastReadAt, setPartnerLastReadAt] = useState(null)
  const [partnerProfile, setPartnerProfile] = useState(null)
  const [showMedia, setShowMedia] = useState(false)
  const [mediaTab, setMediaTab] = useState('photos')
  const [lightbox, setLightbox] = useState(null)

  const messagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const videoPreviewRef = useRef(null)
  const cameraStreamRef = useRef(null)
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
          if (isAtBottom || payload.new.user_id === myId) { setTimeout(scrollToBottom, 100); if (payload.new.user_id !== myId) setTimeout(updateLastRead, 300) }
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
        const readTimes = others.flatMap(k => state[k] || []).map(s => s.lastReadAt).filter(Boolean)
        if (readTimes.length > 0) setPartnerLastReadAt(readTimes[readTimes.length - 1])
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceCh.track({ typing: false, online: true, lastReadAt: new Date().toISOString() })
        }
      })

    return () => {
      supabase.removeChannel(msgChannel)
      supabase.removeChannel(presenceCh)
      if (cameraStreamRef.current) { cameraStreamRef.current.getTracks().forEach(t => t.stop()); cameraStreamRef.current = null }
      if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
      clearInterval(timerRef.current)
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
    setTimeout(updateLastRead, 600)
    const { data: profiles } = await supabase.from('profiles').select('*').neq('id', myId).limit(1)
    if (profiles?.[0]) setPartnerProfile(profiles[0])
  }

  async function updateLastRead() {
    if (presenceChannelRef.current) {
      await presenceChannelRef.current.track({ typing: false, online: true, lastReadAt: new Date().toISOString() })
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setUnreadCount(0)
    updateLastRead()
  }

  function handleScroll() {
    const el = chatContainerRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBtn(dist > 200)
    if (dist < 50) { setUnreadCount(0); updateLastRead() }
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
      
      const { data: newMsg } = await supabase.from('messages').insert({
        user_id: myId,
        text: text || null,
        photo_url: photoUrl,
        reply_to_id: replyTo?.id || null,
        reactions: {}
      }).select().single()
      
      // ID Эльвиры (получатель)
      const elviraId = 'ab73068c-b71a-4a57-9fa0-867543f1a2b0'
      const senderName = profile?.name || 'Кто-то'
      
      // ОТПРАВКА УВЕДОМЛЕНИЯ ЭЛЬВИРЕ
      sendPushNotification(
        senderName, 
        photoUrl ? '📷 Фото' : text, 
        elviraId,  // ← ВАЖНО: теперь всегда Эльвира
        myId
      )
      
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
    const wasSet = reactions[myId] === emoji
    if (wasSet) {
      delete reactions[myId]
    } else {
      reactions[myId] = emoji
      // Trigger cinematic burst
      const id = Date.now()
      setReactionBurst({ emoji, id })
      setTimeout(() => setReactionBurst(b => b?.id === id ? null : b), 1000)
    }
    await supabase.from('messages').update({ reactions }).eq('id', msgId)
    setReactionPickerFor(null)
    setContextMenu(null)
  }

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

  function setupMediaRecorder(stream) {
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
    const mediaRecorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = mediaRecorder
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null
      cameraStreamRef.current = null
      setCameraStream(null)
      clearInterval(timerRef.current)
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      if (blob.size < 1000) { setRecording(false); setRecordingType(null); setRecordingTime(0); return }
      const file = new File([blob], `circle-${Date.now()}.webm`, { type: 'video/webm' })
      setSending(true)
      try {
        const videoUrl = await uploadFile(file, 'circles')
        await supabase.from('messages').insert({ user_id: myId, video_url: videoUrl, is_video_circle: true, reactions: {} })
        sendPushNotification(profile?.name || 'Кто-то', '🔵 Видео-кружочек', elviraId, myId)
      } catch {}
      setSending(false); setRecording(false); setRecordingType(null); setRecordingTime(0)
    }
    return mediaRecorder
  }

  async function startVideoCircle() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode, width: 240, height: 240 }, audio: true })
      cameraStreamRef.current = stream
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
    if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach(t => t.stop())
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null
    const newMode = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(newMode)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newMode, width: 240, height: 240 }, audio: true })
      cameraStreamRef.current = stream
      setCameraStream(stream)
      if (videoPreviewRef.current) { videoPreviewRef.current.srcObject = stream; videoPreviewRef.current.play() }
      const mr = setupMediaRecorder(stream)
      mr.start()
    } catch { alert('Не удалось переключить камеру') }
  }

  async function startVoiceMessage() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      cameraStreamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        cameraStreamRef.current = null
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
          sendPushNotification(profile?.name || 'Кто-то', '🎤 Голосовое сообщение', elviraId, myId)
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
      mediaRecorderRef.current.onstop = () => {
        if (cameraStreamRef.current) { cameraStreamRef.current.getTracks().forEach(t => t.stop()); cameraStreamRef.current = null }
        if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null
        setCameraStream(null)
      }
      mediaRecorderRef.current.stop()
    } else {
      if (cameraStreamRef.current) { cameraStreamRef.current.getTracks().forEach(t => t.stop()); cameraStreamRef.current = null }
      if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null
      setCameraStream(null)
    }
    clearInterval(timerRef.current)
    setRecording(false); setRecordingType(null); setRecordingTime(0)
  }

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

  if (loading) return <div className="tg-loading"><svg viewBox="0 0 40 36" width="48" height="48"><path d="M20 34S3 22 3 11a9 9 0 0116-5.66A9 9 0 0137 11c0 11-17 23-17 23z" fill="var(--theme-accent,#E8466A)" opacity="0.9"/></svg></div>

  return (
    <>
    <div className="tg-chat" onClick={() => { closeContextMenu(); setShowEmojiPicker(false) }}>

      <div className="tg-header" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setShowMedia(true) }}>
        <div className="tg-header-avatar">
          {partnerProfile?.avatar_url
            ? <img src={partnerProfile.avatar_url} alt="" />
            : <svg viewBox="0 0 40 40" width="28" height="28" fill="none"><circle cx="20" cy="16" r="8" fill="rgba(255,255,255,0.8)"/><path d="M4 38c0-8.8 7.2-16 16-16s16 7.2 16 16" fill="rgba(255,255,255,0.6)"/></svg>
          }
        </div>
        <div className="tg-header-info" style={{ flex: 1 }}>
          <div className="tg-header-name">{partnerProfile?.name || 'Наш чат'}</div>
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
        <button className="tg-header-video-btn" onClick={e => e.stopPropagation()} style={{ marginLeft: 'auto' }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        </button>
      </div>

      {pinnedMessage && (
        <div className="tg-pinned" onClick={() => {
          const el = document.getElementById(`msg-${pinnedMessage.id}`)
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }}>
          <div className="tg-pinned-bar" />
          <div className="tg-pinned-content">
            <div className="tg-pinned-label">Закреплено</div>
            <div className="tg-pinned-text">{pinnedMessage.text || (pinnedMessage.photo_url ? '📷 Фото' : pinnedMessage.is_video_circle ? '🔵 Кружочек' : '🎤 Голосовое')}</div>
          </div>
          <button className="tg-pinned-close" onClick={(e) => { e.stopPropagation(); pinMessage(pinnedMessage) }}>
            <X size={16} />
          </button>
        </div>
      )}

      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="tg-messages"
        onClick={closeContextMenu}
      >
        {messages.length === 0 ? (
          <div className="tg-empty">
            <svg viewBox="0 0 64 64" width="64" height="64" fill="none" style={{ marginBottom: 12, opacity: 0.5 }}>
              <rect x="4" y="12" width="56" height="40" rx="6" stroke="white" strokeWidth="2.5"/>
              <path d="M4 18l28 20 28-20" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M26 36l-18 14M38 36l18 14" stroke="white" strokeWidth="2" strokeOpacity="0.6"/>
            </svg>
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
                {offset > 20 && (
                  <div className="tg-swipe-reply-icon" style={{ opacity: Math.min(offset / 60, 1) }}>
                    <Reply size={18} color="#E8466A" />
                  </div>
                )}

                {msg.is_video_circle && msg.video_url ? (
                  <div className={`tg-circle-wrap ${mine ? 'mine' : 'theirs'}`}>
                    <video
                      src={msg.video_url}
                      className="tg-circle-video"
                      playsInline preload="metadata"
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); setLightbox({ type: 'video', url: msg.video_url }) }}
                    />
                    <div className="tg-circle-time">
                      {formatTime(msg.created_at)}
                      {mine && <span className={`tg-tick ${partnerLastReadAt && new Date(msg.created_at) <= new Date(partnerLastReadAt) ? 'read' : ''}`}>{partnerLastReadAt && new Date(msg.created_at) <= new Date(partnerLastReadAt) ? '✓✓' : '✓'}</span>}
                    </div>
                  </div>

                ) : voice ? (
                  <div className={`tg-bubble ${mine ? 'mine' : 'theirs'} voice ${lastInGroup ? 'tail' : ''}`}>
                    {replyMsg && <ReplyPreview msg={replyMsg} mine={mine} myId={myId} myName={profile?.name} partnerName={partnerProfile?.name} />}
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
                            {mine && <span className={`tg-tick ${partnerLastReadAt && new Date(msg.created_at) <= new Date(partnerLastReadAt) ? 'read' : ''}`}>{partnerLastReadAt && new Date(msg.created_at) <= new Date(partnerLastReadAt) ? ' ✓✓' : ' ✓'}</span>}
                          </span>
                        </div>
                      </div>
                    </div>
                    {rxDisplay.length > 0 && <ReactionsBar reactions={rxDisplay} msgId={msg.id} onAdd={addReaction} />}
                  </div>

                ) : (
                  <div className={`tg-bubble ${mine ? 'mine' : 'theirs'} ${msg.photo_url && !msg.text ? 'photo-only' : ''} ${lastInGroup ? 'tail' : ''}`}>
                    {replyMsg && <ReplyPreview msg={replyMsg} mine={mine} myId={myId} myName={profile?.name} partnerName={partnerProfile?.name} />}
                    {msg.photo_url && (
                      <img src={msg.photo_url} alt="" className="tg-photo" loading="lazy"
                        style={{ cursor: 'zoom-in' }}
                        onClick={(e) => { e.stopPropagation(); setLightbox({ type: 'photo', url: msg.photo_url }) }}
                      />
                    )}
                    {msg.text && <div className="tg-text" onTouchStart={(e) => { e.stopPropagation(); handleLongPressEnd() }} onMouseDown={(e) => e.stopPropagation()}>{msg.text}</div>}
                    <div className="tg-meta">
                      {msg.edited_at && <span className="tg-edited">изм.</span>}
                      <span className="tg-time">{formatTime(msg.created_at)}</span>
                      {mine && (
                        <span className={`tg-tick ${partnerLastReadAt && new Date(msg.created_at) <= new Date(partnerLastReadAt) ? 'read' : ''}`}>
                          {partnerLastReadAt && new Date(msg.created_at) <= new Date(partnerLastReadAt) ? '✓✓' : '✓'}
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

      {showScrollBtn && (
        <button onClick={scrollToBottom} className="tg-scroll-btn">
          <ArrowDown size={18} />
          {unreadCount > 0 && <span className="tg-scroll-badge">{unreadCount}</span>}
        </button>
      )}

      {contextMenu && (
        <div className="tg-ctx-overlay" onClick={closeContextMenu}>
          <div className="tg-ctx-menu" onClick={e => e.stopPropagation()}>
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

      {replyTo && (
        <div className="tg-reply-bar">
          <div className="tg-reply-bar-line" />
          <div className="tg-reply-bar-content">
            <div className="tg-reply-bar-name">{isMine(replyTo) ? (profile?.name || 'Вы') : (partnerProfile?.name || 'Партнёр')}</div>
            <div className="tg-reply-bar-text">{replyTo.text || (replyTo.photo_url ? '📷 Фото' : replyTo.is_video_circle ? '🔵 Кружочек' : '🎤 Голосовое')}</div>
          </div>
          <button onClick={() => setReplyTo(null)} className="tg-reply-bar-close"><X size={18} /></button>
        </div>
      )}

      {editingMsg && (
        <div className="tg-reply-bar editing">
          <div className="tg-reply-bar-line edit" />
          <div className="tg-reply-bar-content">
            <div className="tg-reply-bar-name edit">Редактирование</div>
            <div className="tg-reply-bar-text">{editingMsg.text}</div>
          </div>
          <button onClick={() => { setEditingMsg(null); setNewText('') }} className="tg-reply-bar-close"><X size={18} /></button>
        </div>
      )}

      {photoPreview && (
        <div className="tg-photo-preview-bar">
          <img src={photoPreview} alt="" />
          <span>Фото прикреплено</span>
          <button onClick={cancelPhoto}><X size={20} /></button>
        </div>
      )}

      {recording && (
        <div className="tg-recording-panel">
          {recordingType === 'video' && (
            <div style={{ position: 'relative' }}>
              <video ref={videoPreviewRef} muted playsInline className="tg-rec-preview" style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
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
            {recordingType === 'video' && <button onClick={switchCamera} className="tg-rec-switch"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg></button>}
            <button onClick={stopRecording} className="tg-rec-send"><Send size={16} /> Отправить</button>
          </div>
        </div>
      )}

      {!recording && (
        <div className="tg-input-bar">
          {showEmojiPicker && (
            <div className="tg-emoji-picker" onClick={e => e.stopPropagation()}>
              {['😍','❤️','🔥','💋','💕','😘','🥰','😂','👍','😊','🎉','✨','💫','🌹','🦋','💌','😭','🤗','💯','🫶','💪','🙈','😏','🥺','🤩','😇','💝','🌸','🍀','🌙'].map(e => (
                <button key={e} className="tg-emoji-btn" onClick={() => { setNewText(t => t + e); setShowEmojiPicker(false); inputRef.current?.focus() }}>
                  {e}
                </button>
              ))}
            </div>
          )}
          <button onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(v => !v) }} className="tg-input-icon-btn">
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

      <TGStyles partnerOnline={partnerOnline} />
    </div>

    {showMedia && createPortal(
      <MediaSection
        messages={messages}
        myId={myId}
        myName={profile?.name}
        partnerName={partnerProfile?.name}
        onClose={() => setShowMedia(false)}
        onPlayAudio={toggleAudio}
        playingAudio={playingAudio}
        audioProgress={audioProgress}
        audioDuration={audioDuration}
        formatAudioTime={formatAudioTime}
        formatTime={formatTime}
        darkMode={darkMode}
        onOpenPhoto={(url) => { setShowMedia(false); setLightbox({ type: 'photo', url }) }}
        onOpenVideo={(url) => { setShowMedia(false); setLightbox({ type: 'video', url }) }}
      />,
      document.body
    )}

    {lightbox && createPortal(
      <div className="tg-lightbox" onClick={() => setLightbox(null)}>
        {lightbox.type === 'photo'
          ? <img src={lightbox.url} alt="" className="tg-lightbox-img" onClick={e => e.stopPropagation()} />
          : <video src={lightbox.url} className="tg-lightbox-video" controls autoPlay playsInline onClick={e => e.stopPropagation()} />
        }
        <button className="tg-lightbox-close" onClick={() => setLightbox(null)}><X size={24} /></button>
      </div>,
      document.body
    )}

    {/* REACTION BURST */}
    {reactionBurst && <ReactionBurst key={reactionBurst.id} emoji={reactionBurst.emoji} />}
    </>
  )
}

function MediaSection({ messages, myId, myName, partnerName, onClose, onPlayAudio, playingAudio, audioProgress, audioDuration, formatAudioTime, formatTime, darkMode, onOpenPhoto, onOpenVideo }) {
  const [tab, setTab] = useState('photos')

  const photos = messages.filter(m => m.photo_url)
  const circles = messages.filter(m => m.is_video_circle && m.video_url)
  const voices = messages.filter(m => m.video_url && !m.is_video_circle && (m.is_voice || m.text === '🎤 Голосовое сообщение'))
  const links = messages.filter(m => m.text && /https?:\/\/\S+/.test(m.text))
    .flatMap(m => {
      const urls = m.text.match(/https?:\/\/\S+/g) || []
      return urls.map(url => ({ url, msg: m }))
    })

  const tabs = [
    { id: 'photos', label: '📷 Фото', count: photos.length },
    { id: 'circles', label: '🔵 Кружочки', count: circles.length },
    { id: 'voices', label: '🎤 Голосовые', count: voices.length },
    { id: 'links', label: '🔗 Ссылки', count: links.length },
  ]

  function getSenderName(msg) {
    return msg.user_id === myId ? (myName || 'Вы') : (partnerName || 'Партнёр')
  }

  return (
    <div className={`tg-media-overlay${darkMode ? ' dark' : ''}`} onClick={onClose}>
      <div className="tg-media-panel" onClick={e => e.stopPropagation()}>
        <div className="tg-media-header">
          <span className="tg-media-title">Медиафайлы</span>
          <button className="tg-media-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="tg-media-tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`tg-media-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label} {t.count > 0 && <span className="tg-media-tab-count">{t.count}</span>}
            </button>
          ))}
        </div>
        <div className="tg-media-content">
          {tab === 'photos' && (
            photos.length === 0 ? (
              <div className="tg-media-empty">📷<p>Нет фотографий</p></div>
            ) : (
              <div className="tg-media-grid">
                {photos.map(m => (
                  <div key={m.id} className="tg-media-photo-cell" onClick={() => onOpenPhoto && onOpenPhoto(m.photo_url)}>
                    <img src={m.photo_url} alt="" loading="lazy" />
                    <span className="tg-media-cell-time">{formatTime(m.created_at)}</span>
                  </div>
                ))}
              </div>
            )
          )}
          {tab === 'circles' && (
            circles.length === 0 ? (
              <div className="tg-media-empty">🔵<p>Нет видео-кружочков</p></div>
            ) : (
              <div className="tg-media-grid">
                {circles.map(m => (
                  <div key={m.id} className="tg-media-photo-cell" onClick={() => onOpenVideo && onOpenVideo(m.video_url)}>
                    <video src={m.video_url} className="tg-media-circle-thumb" playsInline preload="metadata" />
                    <span className="tg-media-cell-time">{formatTime(m.created_at)}</span>
                  </div>
                ))}
              </div>
            )
          )}
          {tab === 'voices' && (
            voices.length === 0 ? (
              <div className="tg-media-empty">🎤<p>Нет голосовых</p></div>
            ) : (
              <div className="tg-media-list">
                {voices.map(m => (
                  <div key={m.id} className="tg-media-voice-item">
                    <button className="tg-media-voice-play" onClick={() => onPlayAudio(m.id, m.video_url)}>
                      {playingAudio === m.id ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <div className="tg-media-voice-info">
                      <span className="tg-media-voice-name">{getSenderName(m)}</span>
                      <span className="tg-media-voice-dur">{formatAudioTime(audioDuration[m.id]) || '—'}</span>
                    </div>
                    <span className="tg-media-voice-time">{formatTime(m.created_at)}</span>
                  </div>
                ))}
              </div>
            )
          )}
          {tab === 'links' && (
            links.length === 0 ? (
              <div className="tg-media-empty">🔗<p>Нет ссылок</p></div>
            ) : (
              <div className="tg-media-list">
                {links.map(({ url, msg }, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="tg-media-link-item">
                    <span className="tg-media-link-icon">🔗</span>
                    <div className="tg-media-link-info">
                      <span className="tg-media-link-url">{url}</span>
                      <span className="tg-media-link-from">{getSenderName(msg)} · {formatTime(msg.created_at)}</span>
                    </div>
                  </a>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function ReactionBurst({ emoji }) {
  const particles = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * 360 + Math.random() * 15
    const dist = 90 + Math.random() * 80
    const size = 20 + Math.random() * 18
    const rad = (angle * Math.PI) / 180
    return { angle, dist, size, bx: Math.cos(rad) * dist, by: Math.sin(rad) * dist, delay: Math.random() * 0.12 }
  })
  return (
    <>
      <style>{`
        @keyframes rxBurst {
          0%   { opacity: 1; transform: translate(0, 0) scale(1.3); }
          80%  { opacity: 0.7; }
          100% { opacity: 0; transform: translate(var(--rbx), var(--rby)) scale(0.2); }
        }
        .rx-burst-overlay {
          position: fixed; inset: 0; z-index: 400;
          pointer-events: none;
          display: flex; align-items: center; justify-content: center;
        }
        .rx-particle {
          position: absolute;
          animation: rxBurst 0.85s cubic-bezier(0.22,1,0.36,1) forwards;
          animation-delay: var(--rd, 0s);
          font-size: var(--rs, 24px);
          line-height: 1;
          user-select: none;
        }
      `}</style>
      <div className="rx-burst-overlay">
        {particles.map((p, i) => (
          <div key={i} className="rx-particle" style={{
            '--rbx': `${p.bx}px`,
            '--rby': `${p.by}px`,
            '--rs': `${p.size}px`,
            '--rd': `${p.delay}s`,
          }}>
            {emoji}
          </div>
        ))}
      </div>
    </>
  )
}

function ReplyPreview({ msg, mine, myId, myName, partnerName }) {
  const isVoice = msg.video_url && !msg.is_video_circle && (msg.is_voice || msg.text === '🎤 Голосовое сообщение')
  const text = msg.text || (msg.photo_url ? '📷 Фото' : msg.is_video_circle ? '🔵 Кружочек' : isVoice ? '🎤 Голосовое' : '')
  const senderName = msg.user_id === myId ? (myName || 'Вы') : (partnerName || 'Партнёр')
  return (
    <div className={`tg-reply-preview ${mine ? 'mine' : 'theirs'}`}>
      <div className="tg-reply-preview-line" />
      <div className="tg-reply-preview-body">
        <div className="tg-reply-preview-name">{senderName}</div>
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
        background: linear-gradient(180deg, #1A1025 0%, #0D0D15 100%);
        z-index: 5;
        overflow: hidden;
      }
      .tg-chat::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: radial-gradient(circle, rgba(255,255,255,0.012) 1px, transparent 1px);
        background-size: 24px 24px;
        pointer-events: none;
        z-index: 0;
      }
      .tg-loading {
        display: flex; align-items: center; justify-content: center;
        height: 100vh; background: #0D0D15;
      }
      .tg-header {
        position: relative; z-index: 10;
        padding: 10px 16px;
        padding-top: calc(10px + env(safe-area-inset-top, 0px));
        background: var(--theme-gradient, linear-gradient(135deg, #E8466A, #9C27B0));
        display: flex; align-items: center; gap: 12px;
        flex-shrink: 0;
        box-shadow: 0 2px 20px rgba(0,0,0,0.4);
        min-height: 70px;
      }
      .tg-header-avatar {
        width: 42px; height: 42px; border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; overflow: hidden;
        border: 2px solid rgba(255,255,255,0.35);
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }
      .tg-header-avatar img { width: 100%; height: 100%; object-fit: cover; }
      .tg-header-name {
        font-weight: 700; font-size: 17px; color: white;
        font-family: var(--font-display);
      }
      .tg-header-status { font-size: 12px; color: rgba(255,255,255,0.75); margin-top: 1px; }
      .tg-header-video-btn {
        background: rgba(255,255,255,0.15); border: none; border-radius: 50%;
        width: 36px; height: 36px; flex-shrink: 0; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        -webkit-tap-highlight-color: transparent;
      }
      .tg-header-video-btn:active { background: rgba(255,255,255,0.25); }
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
      .tg-pinned {
        position: relative; z-index: 9;
        display: flex; align-items: center; gap: 10px;
        padding: 8px 14px;
        background: rgba(255,255,255,0.06);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid rgba(255,255,255,0.06);
        cursor: pointer; flex-shrink: 0;
      }
      .tg-pinned-bar { width: 3px; height: 32px; background: var(--theme-accent, #E8466A); border-radius: 3px; flex-shrink: 0; }
      .tg-pinned-content { flex: 1; min-width: 0; }
      .tg-pinned-label { font-size: 11px; font-weight: 700; color: var(--theme-accent, #E8466A); margin-bottom: 2px; }
      .tg-pinned-text { font-size: 13px; color: rgba(255,255,255,0.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .tg-pinned-close { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.4); padding: 4px; }
      .tg-messages {
        flex: 1; overflow-y: auto; overflow-x: hidden;
        padding: 8px 10px 12px;
        display: flex; flex-direction: column;
        gap: 0;
        -webkit-overflow-scrolling: touch;
        position: relative; z-index: 1;
        background:
          radial-gradient(circle at 50% 0%, rgba(255,255,255,0.015) 1px, transparent 1px),
          linear-gradient(180deg,
            color-mix(in srgb, var(--theme-accent, #E8466A) 8%, #0D0D15) 0%,
            #0D0D15 28%,
            #0D0D15 72%,
            color-mix(in srgb, var(--theme-accent, #E8466A) 5%, #0D0D15) 100%
          );
        background-size: 24px 24px, 100% 100%;
      }
      .tg-messages::-webkit-scrollbar { display: none; }
      .tg-empty {
        text-align: center; padding: 60px 20px;
        color: rgba(255,255,255,0.5); margin: auto;
      }
      .tg-empty p { font-size: 16px; font-family: var(--font-display); margin-top: 8px; color: rgba(255,255,255,0.5); }
      .tg-date-sep {
        text-align: center; margin: 12px 0 6px; pointer-events: none;
      }
      .tg-date-sep span {
        background: rgba(255,255,255,0.1); backdrop-filter: blur(8px);
        padding: 4px 14px; border-radius: 14px;
        font-size: 12px; color: rgba(255,255,255,0.7); font-weight: 600;
        border: 1px solid rgba(255,255,255,0.08);
      }
      .tg-msg-row {
        display: flex; align-items: flex-end; margin-bottom: 2px;
        position: relative; user-select: none;
      }
      .tg-msg-row.mine { justify-content: flex-end; padding-right: 6px; }
      .tg-msg-row.theirs { justify-content: flex-start; padding-left: 6px; }
      .tg-msg-row.grouped { margin-bottom: 1px; }
      .tg-swipe-reply-icon {
        position: absolute; left: -30px;
        display: flex; align-items: center; justify-content: center;
      }
      .tg-bubble {
        max-width: 78%;
        word-break: break-word;
        position: relative;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      }
      .tg-bubble.mine {
        background: var(--theme-gradient, linear-gradient(135deg, #E8466A, #9C27B0));
        color: white;
        border-radius: 20px 20px 4px 20px;
        padding: 8px 12px 6px;
        box-shadow: 0 2px 12px rgba(var(--theme-accent-rgb, 232,70,106), 0.3);
      }
      .tg-bubble.theirs {
        background: rgba(255,255,255,0.08);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.92);
        border-radius: 20px 20px 20px 4px;
        padding: 8px 12px 6px;
      }
      .tg-bubble.mine.tail {
        border-radius: 20px 20px 4px 20px;
      }
      .tg-bubble.mine.tail::after {
        content: '';
        position: absolute;
        bottom: 0; right: -7px;
        width: 12px; height: 16px;
        background: var(--theme-accent, #E8466A);
        clip-path: polygon(0 0, 0 100%, 100% 100%);
      }
      .tg-bubble.theirs.tail {
        border-radius: 20px 20px 20px 4px;
      }
      .tg-bubble.theirs.tail::after {
        content: '';
        position: absolute;
        bottom: 0; left: -7px;
        width: 12px; height: 16px;
        background: rgba(255,255,255,0.08);
        clip-path: polygon(100% 0, 0 100%, 100% 100%);
      }
      .tg-bubble.photo-only { padding: 3px; }
      .tg-photo {
        max-width: 100%; max-height: 300px;
        border-radius: 15px; display: block;
      }
      .tg-text { font-size: 15px; line-height: 1.45; white-space: pre-wrap; user-select: text; -webkit-user-select: text; color: white; }
      .tg-bubble.theirs .tg-text { color: rgba(255,255,255,0.92); }
      .tg-meta {
        display: flex; align-items: center; justify-content: flex-end;
        gap: 3px; margin-top: 3px;
      }
      .tg-edited { font-size: 10px; opacity: 0.6; color: rgba(255,255,255,0.7); }
      .tg-time { font-size: 11px; opacity: 0.65; color: rgba(255,255,255,0.7); }
      .tg-tick { font-size: 11px; opacity: 0.65; color: rgba(255,255,255,0.7); }
      .tg-tick.read { opacity: 1; color: #4FC3F7; }
      .tg-circle-wrap {
        position: relative; display: inline-block;
      }
      .tg-circle-wrap.mine { margin-right: 6px; }
      .tg-circle-wrap.theirs { margin-left: 6px; }
      .tg-circle-video {
        width: 180px; height: 180px; border-radius: 50%;
        object-fit: cover; display: block;
        box-shadow: 0 0 0 3px var(--theme-accent, #E8466A), 0 4px 20px rgba(0,0,0,0.5);
        cursor: pointer;
      }
      .tg-circle-time {
        position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
        background: rgba(0,0,0,0.5); border-radius: 10px;
        padding: 2px 8px; font-size: 11px; color: white;
        display: flex; gap: 4px; align-items: center;
      }
      .tg-bubble.voice { min-width: 200px; max-width: 78%; }
      .tg-voice-inner {
        display: flex; align-items: center; gap: 10px;
      }
      .tg-voice-play-btn {
        width: 38px; height: 38px; border-radius: 50%; border: none;
        cursor: pointer; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        backdrop-filter: blur(8px);
      }
      .tg-bubble.mine .tg-voice-play-btn { background: rgba(255,255,255,0.22); color: white; }
      .tg-bubble.theirs .tg-voice-play-btn { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.85); border: 1px solid rgba(255,255,255,0.12); }
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
      .tg-voice-fill.theirs { background: var(--theme-accent, #E8466A); }
      .tg-voice-wave {
        display: flex; align-items: center; gap: 2px; width: 100%;
      }
      .tg-wave-bar {
        width: 2px; border-radius: 2px; flex: 1; min-width: 2px;
      }
      .tg-wave-bar.mine { background: rgba(255,255,255,0.35); }
      .tg-wave-bar.theirs { background: rgba(255,255,255,0.2); }
      .tg-voice-footer {
        display: flex; justify-content: space-between; align-items: center;
        margin-top: 2px;
      }
      .tg-voice-duration { font-size: 11px; opacity: 0.65; color: rgba(255,255,255,0.7); }
      .tg-msg-time { font-size: 11px; opacity: 0.65; color: rgba(255,255,255,0.7); }
      .tg-typing-bubble { padding: 10px 16px; }
      .tg-typing-indicator {
        display: flex; gap: 4px; align-items: center;
      }
      .tg-typing-indicator span {
        width: 7px; height: 7px; border-radius: 50%;
        background: rgba(255,255,255,0.4);
        animation: tgBounce 1.2s ease-in-out infinite;
      }
      .tg-typing-indicator span:nth-child(2) { animation-delay: 0.15s; }
      .tg-typing-indicator span:nth-child(3) { animation-delay: 0.3s; }
      @keyframes tgBounce {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-6px); }
      }
      .tg-scroll-btn {
        position: fixed; bottom: 170px; right: 14px;
        width: 42px; height: 42px; border-radius: 50%;
        background: rgba(30,20,50,0.85); backdrop-filter: blur(12px);
        border: 1px solid rgba(255,255,255,0.12); cursor: pointer;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 20; color: rgba(255,255,255,0.8);
      }
      .tg-scroll-badge {
        position: absolute; top: -4px; right: -4px;
        background: var(--theme-accent, #E8466A); color: white;
        border-radius: 10px; font-size: 10px; font-weight: 700;
        padding: 1px 5px; min-width: 18px; text-align: center;
      }
      .tg-ctx-overlay {
        position: fixed; inset: 0; z-index: 100;
        background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
      }
      .tg-ctx-menu {
        background: rgba(28,20,45,0.97); backdrop-filter: blur(20px);
        border-radius: 18px; overflow: hidden;
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 16px 48px rgba(0,0,0,0.6);
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
      .tg-ctx-divider { height: 1px; background: rgba(255,255,255,0.08); }
      .tg-ctx-item {
        width: 100%; padding: 13px 18px;
        display: flex; align-items: center; gap: 12px;
        background: none; border: none; cursor: pointer;
        font-size: 15px; font-family: var(--font-body);
        color: rgba(255,255,255,0.85); text-align: left;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }
      .tg-ctx-item:last-child { border-bottom: none; }
      .tg-ctx-item:active { background: rgba(255,255,255,0.06); }
      .tg-ctx-item.danger { color: #FF6B8A; }
      .tg-reply-preview {
        display: flex; gap: 6px; margin-bottom: 6px;
        padding: 6px 8px; border-radius: 8px;
        cursor: pointer;
      }
      .tg-reply-preview.mine { background: rgba(255,255,255,0.15); }
      .tg-reply-preview.theirs { background: rgba(255,255,255,0.06); }
      .tg-reply-preview-line {
        width: 3px; border-radius: 2px; flex-shrink: 0;
        background: var(--theme-accent, #E8466A);
      }
      .tg-reply-preview.mine .tg-reply-preview-line { background: rgba(255,255,255,0.7); }
      .tg-reply-preview-body { flex: 1; min-width: 0; }
      .tg-reply-preview-name { font-size: 12px; font-weight: 700; color: var(--theme-accent, #E8466A); margin-bottom: 2px; }
      .tg-reply-preview.mine .tg-reply-preview-name { color: rgba(255,255,255,0.9); }
      .tg-reply-preview-text { font-size: 12px; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: rgba(255,255,255,0.7); }
      .tg-reply-photo-thumb { width: 32px; height: 32px; object-fit: cover; border-radius: 6px; float: right; margin-left: 6px; }
      .tg-reply-bar {
        display: flex; align-items: center; gap: 10px;
        padding: 8px 14px;
        background: rgba(15,10,25,0.9); backdrop-filter: blur(12px);
        border-top: 1px solid rgba(255,255,255,0.06);
        flex-shrink: 0; position: relative; z-index: 5;
      }
      .tg-reply-bar-line { width: 3px; height: 32px; background: var(--theme-accent, #E8466A); border-radius: 3px; flex-shrink: 0; }
      .tg-reply-bar-line.edit { background: #4FC3F7; }
      .tg-reply-bar-content { flex: 1; min-width: 0; }
      .tg-reply-bar-name { font-size: 12px; font-weight: 700; color: var(--theme-accent, #E8466A); margin-bottom: 2px; }
      .tg-reply-bar-name.edit { color: #4FC3F7; }
      .tg-reply-bar-text { font-size: 13px; color: rgba(255,255,255,0.5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .tg-reply-bar-close { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.4); padding: 4px; }
      .tg-photo-preview-bar {
        padding: 8px 14px;
        background: rgba(15,10,25,0.9); backdrop-filter: blur(12px);
        border-top: 1px solid rgba(255,255,255,0.06);
        display: flex; align-items: center; gap: 10px; flex-shrink: 0;
      }
      .tg-photo-preview-bar img { width: 48px; height: 48px; object-fit: cover; border-radius: 8px; }
      .tg-photo-preview-bar span { font-size: 13px; color: rgba(255,255,255,0.6); flex: 1; }
      .tg-photo-preview-bar button { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.4); }
      .tg-recording-panel {
        padding: 16px;
        background: rgba(15,10,25,0.95); backdrop-filter: blur(20px);
        border-top: 1px solid rgba(255,255,255,0.06);
        display: flex; flex-direction: column;
        align-items: center; gap: 12px; flex-shrink: 0;
      }
      .tg-rec-preview {
        width: 140px; height: 140px; border-radius: 50%;
        object-fit: cover;
        box-shadow: 0 0 0 4px var(--theme-accent, #E8466A), 0 0 20px rgba(var(--theme-accent-rgb,232,70,106),0.4);
        animation: tgPulse 1.5s ease-in-out infinite;
      }
      .tg-rec-timer {
        position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%);
        background: var(--theme-accent, #E8466A); border-radius: 12px;
        padding: 3px 12px; font-size: 13px; color: white; font-weight: 700;
      }
      .tg-rec-audio {
        display: flex; align-items: center; gap: 14px;
      }
      .tg-rec-mic-pulse {
        width: 52px; height: 52px; border-radius: 50%;
        background: rgba(255,255,255,0.08);
        display: flex; align-items: center; justify-content: center;
        animation: tgPulse 1.5s ease-in-out infinite;
      }
      @keyframes tgPulse {
        0%, 100% { box-shadow: 0 0 0 4px rgba(232,70,106,0.2); }
        50% { box-shadow: 0 0 0 10px rgba(232,70,106,0.1); }
      }
      .tg-rec-actions { display: flex; gap: 10px; }
      .tg-rec-cancel {
        padding: 10px 22px;
        background: rgba(255,255,255,0.08); backdrop-filter: blur(8px);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 22px; font-size: 14px; font-weight: 600;
        font-family: var(--font-body); color: rgba(255,255,255,0.7); cursor: pointer;
      }
      .tg-rec-switch {
        padding: 10px 16px;
        background: rgba(255,255,255,0.08); backdrop-filter: blur(8px);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 22px; font-size: 18px; cursor: pointer;
        color: rgba(255,255,255,0.8);
        display: flex; align-items: center; justify-content: center;
      }
      .tg-rec-send {
        padding: 10px 22px; background: var(--theme-gradient, linear-gradient(135deg, #E8466A, #9C27B0));
        border: none; border-radius: 22px; font-size: 14px; font-weight: 700;
        font-family: var(--font-body); color: white; cursor: pointer;
        display: flex; align-items: center; gap: 6px;
      }
      .tg-input-bar {
        padding: 8px 10px;
        padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
        background: rgba(15,10,25,0.95); backdrop-filter: blur(20px);
        border-top: 1px solid rgba(255,255,255,0.06);
        display: flex; align-items: flex-end; gap: 4px;
        flex-shrink: 0; position: relative; z-index: 5;
      }
      .tg-input-icon-btn {
        background: none; border: none; cursor: pointer;
        padding: 8px; border-radius: 50%;
        display: flex; flex-shrink: 0;
        -webkit-tap-highlight-color: transparent;
        color: rgba(255,255,255,0.5);
      }
      .tg-input-icon-btn:active { background: rgba(255,255,255,0.06); }
      .tg-input-field {
        flex: 1; background: rgba(255,255,255,0.08); border-radius: 22px;
        border: 1px solid rgba(255,255,255,0.08);
        padding: 0 14px; display: flex; align-items: flex-end;
        min-width: 0;
      }
      .tg-input-field textarea {
        flex: 1; border: none; background: none;
        padding: 10px 0; font-size: 15px;
        font-family: var(--font-body); color: rgba(255,255,255,0.9);
        resize: none; outline: none; max-height: 120px; line-height: 1.4;
        width: 100%;
      }
      .tg-input-field textarea::placeholder { color: rgba(255,255,255,0.3); }
      .tg-send-btn {
        width: 42px; height: 42px;
        background: var(--theme-gradient, linear-gradient(135deg, #E8466A, #9C27B0));
        border: none; cursor: pointer; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; box-shadow: 0 2px 12px rgba(0,0,0,0.3);
      }
      .tg-emoji-picker {
        position: absolute; bottom: calc(100% + 8px); left: 8px;
        background: rgba(28,20,45,0.97); backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
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
      .tg-emoji-btn:active { background: rgba(255,255,255,0.08); }
      .tg-reactions {
        display: flex; flex-wrap: wrap; gap: 4px;
        margin-top: 4px;
      }
      .tg-reaction {
        display: flex; align-items: center; gap: 3px;
        padding: 2px 8px; border-radius: 12px;
        background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
        font-size: 14px; cursor: pointer;
      }
      .tg-reaction.mine {
        background: rgba(var(--theme-accent-rgb,232,70,106), 0.2);
        border-color: rgba(var(--theme-accent-rgb,232,70,106), 0.4);
      }
      .tg-reaction span { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.7); }
      .tg-media-btn {
        background: rgba(255,255,255,0.2); border: none; border-radius: 50%;
        width: 36px; height: 36px; cursor: pointer; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.2s;
      }
      .tg-media-btn:active { background: rgba(255,255,255,0.35); }
      .tg-media-overlay {
        position: fixed; inset: 0; z-index: 300;
        background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
        display: flex; align-items: stretch;
        animation: fadeIn 0.2s ease;
      }
      .tg-media-panel {
        width: 100%; height: 100%;
        background: #1A1025; border-radius: 0;
        display: flex; flex-direction: column;
        animation: slideUp 0.3s ease;
        overflow: hidden;
        padding-top: env(safe-area-inset-top, 0px);
      }
      .tg-media-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 20px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        flex-shrink: 0;
      }
      .tg-media-title { font-weight: 700; font-size: 17px; font-family: var(--font-display); color: rgba(255,255,255,0.9); }
      .tg-media-close { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.4); padding: 4px; }
      .tg-media-tabs {
        display: flex; gap: 0; overflow-x: auto; flex-shrink: 0;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        padding: 0 12px;
      }
      .tg-media-tabs::-webkit-scrollbar { display: none; }
      .tg-media-tab {
        background: none; border: none; cursor: pointer;
        padding: 10px 12px; font-size: 13px; font-weight: 600;
        color: rgba(255,255,255,0.4); white-space: nowrap;
        border-bottom: 2px solid transparent;
        font-family: var(--font-body);
        display: flex; align-items: center; gap: 5px;
        transition: color 0.2s;
      }
      .tg-media-tab.active { color: var(--theme-accent, #E8466A); border-bottom-color: var(--theme-accent, #E8466A); }
      .tg-media-tab-count {
        background: var(--theme-accent, #E8466A); color: white;
        font-size: 10px; padding: 1px 6px; border-radius: 10px;
      }
      .tg-media-content { flex: 1; overflow-y: auto; padding: 12px; }
      .tg-media-content::-webkit-scrollbar { display: none; }
      .tg-media-empty {
        text-align: center; padding: 40px 20px;
        color: rgba(255,255,255,0.3); font-size: 40px;
      }
      .tg-media-empty p { font-size: 15px; margin-top: 8px; color: rgba(255,255,255,0.4); }
      .tg-media-grid {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px;
      }
      .tg-media-photo-cell {
        position: relative; aspect-ratio: 1; overflow: hidden;
        border-radius: 8px; display: block;
      }
      .tg-media-photo-cell img {
        width: 100%; height: 100%; object-fit: cover;
        transition: transform 0.2s;
      }
      .tg-media-photo-cell:active img { transform: scale(0.95); }
      .tg-media-circle-thumb {
        width: 100%; height: 100%; object-fit: cover; border-radius: 50%;
        cursor: pointer;
      }
      .tg-media-cell-time {
        position: absolute; bottom: 4px; right: 6px;
        font-size: 10px; color: white; font-weight: 600;
        text-shadow: 0 1px 3px rgba(0,0,0,0.5);
      }
      .tg-media-list { display: flex; flex-direction: column; gap: 2px; }
      .tg-media-voice-item {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 12px; border-radius: 12px;
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.05);
      }
      .tg-media-voice-play {
        width: 38px; height: 38px; border-radius: 50%;
        background: var(--theme-gradient, linear-gradient(135deg,#E8466A,#9C27B0)); color: white; border: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .tg-media-voice-info { flex: 1; }
      .tg-media-voice-name { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.85); display: block; }
      .tg-media-voice-dur { font-size: 12px; color: rgba(255,255,255,0.4); }
      .tg-media-voice-time { font-size: 11px; color: rgba(255,255,255,0.4); }
      .tg-media-link-item {
        display: flex; align-items: center; gap: 12px; padding: 10px 12px;
        border-radius: 12px; background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.05);
        text-decoration: none; color: inherit;
      }
      .tg-media-link-icon { font-size: 20px; flex-shrink: 0; }
      .tg-media-link-info { flex: 1; min-width: 0; }
      .tg-media-link-url {
        font-size: 13px; color: #4FC3F7; display: block;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .tg-media-link-from { font-size: 11px; color: rgba(255,255,255,0.4); }
      .tg-lightbox {
        position: fixed; inset: 0; z-index: 500;
        background: rgba(0,0,0,0.92); backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center;
        animation: fadeIn 0.2s ease;
      }
      .tg-lightbox-img {
        max-width: 96vw; max-height: 88vh;
        object-fit: contain; border-radius: 8px;
        animation: tgLbIn 0.25s ease;
      }
      .tg-lightbox-video {
        max-width: 96vw; max-height: 88vh;
        border-radius: 8px; animation: tgLbIn 0.25s ease;
      }
      @keyframes tgLbIn {
        from { transform: scale(0.88); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      .tg-lightbox-close {
        position: absolute; top: 16px; right: 16px;
        background: rgba(255,255,255,0.15); border: none; border-radius: 50%;
        width: 44px; height: 44px; cursor: pointer; color: white;
        display: flex; align-items: center; justify-content: center;
        z-index: 501;
      }
      .tg-media-photo-cell { cursor: pointer; }
    `}</style>
  )
}
