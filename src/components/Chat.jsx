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

function IcoSend() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

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
        {msg.text && (
          <div
            style={{ color: COLOR, fontSize: 15, lineHeight: 1.45, wordBreak: 'break-word' }}
            dangerouslySetInnerHTML={{ __html: parseText(msg.text) }}
          />
        )}
        <div style={{ fontSize: 11, color: isMine ? 'rgba(255,255,255,0.6)' : MUTED, marginTop: 4, textAlign: 'right' }}>
          {fmtTime(msg.created_at)}
        </div>
      </div>
    </div>
  )
})

export default function Chat({ session, profile, darkMode }) {
  const [messages, setMessages] = useState([])
  const [partner, setPartner] = useState(null)
  const [newText, setNewText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showDown, setShowDown] = useState(false)
  
  const listRef = useRef(null)
  const endRef = useRef(null)
  const uid = session?.user?.id
  
  const BG = darkMode ? '#200A10' : '#FBF0F2'
  const SURF = darkMode ? '#1E0A10' : '#FFFFFF'
  const SURF2 = darkMode ? '#3D1520' : '#FBF0F2'
  const INK = darkMode ? '#F5E8EA' : '#1C0A0E'
  const MUTED = darkMode ? '#8A5060' : '#9A6070'
  const GRAD = 'linear-gradient(135deg, #C8334A, #8B1A2C)'

  useEffect(() => {
    if (profile?.partner_id) {
      supabase.from('profiles').select('*').eq('id', profile.partner_id).single().then(({ data }) => {
        if (data) setPartner(data)
      })
    }
  }, [profile])

  const loadMessages = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(100)
    setMessages(data || [])
    setLoading(false)
    setTimeout(() => endRef.current?.scrollIntoView(), 100)
  }, [])

  const sendMessage = async () => {
    if (!newText.trim() || sending) return
    setSending(true)
    await supabase.from('messages').insert({ user_id: uid, text: newText.trim() })
    setNewText('')
    setSending(false)
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    setShowDown(el.scrollHeight - el.scrollTop - el.clientHeight > 300)
  }, [])

  useEffect(() => {
    loadMessages()
    const channel = supabase.channel('chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => [...prev, payload.new])
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
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
      <div style={{
        background: SURF,
        borderBottom: '1px solid rgba(0,0,0,0.1)',
        padding: `max(50px, env(safe-area-inset-top, 0px)) 16px 12px`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: partner?.avatar_url ? `url(${partner.avatar_url}) center/cover` : GRAD }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 600, color: INK }}>{partner?.name || 'Партнёр'}</div>
          <div style={{ fontSize: 12, color: MUTED }}>онлайн</div>
        </div>
      </div>

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
          <button onClick={() => endRef.current?.scrollIntoView({ behavior: 'smooth' })} style={{
            position: 'sticky', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            background: GRAD, border: 'none', borderRadius: 20, padding: '8px 16px',
            color: 'white', fontSize: 12, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>↓ Новые сообщения</button>
        )}
      </div>

      <div style={{
        background: SURF,
        borderTop: '1px solid rgba(0,0,0,0.1)',
        padding: `10px 12px calc(10px + env(safe-area-inset-bottom, 0px))`,
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder="Сообщение..."
            style={{
              flex: 1,
              background: SURF2,
              border: '1px solid rgba(0,0,0,0.1)',
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
          <button
            onClick={sendMessage}
            disabled={sending || !newText.trim()}
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
              opacity: sending || !newText.trim() ? 0.5 : 1,
            }}
          >
            <IcoSend />
          </button>
        </div>
      </div>
    </div>
  )
}
