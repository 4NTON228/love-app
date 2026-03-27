import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { supabase } from '../lib/supabase'

const REACTIONS = ['❤️','🔥','😍','😂','👍','💔']
const VALID_REACTIONS = new Set(REACTIONS)

/* ─── utils ─── */
function pad(n) { return String(n).padStart(2,'0') }
function fmtTime(d) {
  const dt = new Date(d)
  return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
function fmtDateSep(d) {
  const dt = new Date(d), now = new Date()
  const y = new Date(now); y.setDate(y.getDate()-1)
  if (dt.toDateString()===now.toDateString()) return 'Сегодня'
  if (dt.toDateString()===y.toDateString()) return 'Вчера'
  return dt.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})
}
function diffDate(a,b) {
  return new Date(a).toDateString()!==new Date(b).toDateString()
}

/* ─── ContextMenu (исправленное позиционирование - всегда над навигацией) ─── */
const ContextMenu = memo(({ menu, onClose, onEdit, onDelete, onPin, onCopy, onReact }) => {
  if (!menu) return null
  
  // Исправляем позиционирование - меню всегда в центре или над навигацией
  const getPosition = () => {
    const viewportHeight = window.innerHeight
    const menuHeight = 320 // примерная высота меню
    const navHeight = 56 + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom')) || 0)
    
    // Центрируем меню
    let top = (viewportHeight - menuHeight) / 2
    
    // Если меню выходит за границы, корректируем
    if (top < 20) top = 20
    if (top + menuHeight > viewportHeight - navHeight - 10) {
      top = viewportHeight - menuHeight - navHeight - 10
    }
    
    // Горизонтальное центрирование
    const left = (window.innerWidth - 240) / 2
    
    return { top, left, right: 'auto' }
  }
  
  const position = getPosition()
  
  const S = {
    overlay:{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(8px)' },
    box:{ 
      position:'fixed', 
      zIndex:301, 
      background:'#fff', 
      borderRadius:20, 
      overflow:'hidden', 
      width:260,
      boxShadow:'0 12px 48px rgba(0,0,0,0.25)',
      border:'.5px solid rgba(200,51,74,0.15)',
      top: position.top,
      left: position.left,
      right: position.right,
    },
    reactions:{ display:'flex', gap:6, padding:'14px 16px', borderBottom:'.5px solid rgba(200,51,74,0.08)', justifyContent:'center' },
    remoji:{ fontSize:28, cursor:'pointer', padding:'4px 8px', borderRadius:12, transition:'transform .15s', WebkitUserSelect:'none' },
    btn:{ width:'100%', padding:'14px 18px', display:'flex', alignItems:'center', gap:12, background:'none', border:'none',
      cursor:'pointer', fontSize:16, color:'#1C0A0E', textAlign:'left', fontFamily:'inherit',
      borderBottom:'.5px solid rgba(200,51,74,0.07)' },
    del:{ color:'#E24B4A', borderBottom:'none' }
  }
  
  const Ico = ({d,s=2,c='#C8334A'}) => (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={c} strokeWidth={s} strokeLinecap="round" strokeLinejoin="round">
      {d.map((p,i)=><path key={i} d={p}/>)}
    </svg>
  )
  
  return (
    <>
      <div style={S.overlay} onClick={onClose}/>
      <div style={S.box}>
        <div style={S.reactions}>
          {REACTIONS.map(r=>(
            <span key={r} style={S.remoji}
              onMouseEnter={e=>e.currentTarget.style.transform='scale(1.3)'}
              onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
              onClick={()=>{onReact(menu.msgId,r);onClose()}}>{r}</span>
          ))}
        </div>
        {menu.isMe && (
          <button style={S.btn} onClick={()=>{onEdit(menu.msgId,menu.text);onClose()}}>
            <Ico d={['M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7','M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z']}/>
            Редактировать
          </button>
        )}
        <button style={S.btn} onClick={()=>{onCopy(menu.text);onClose()}}>
          <Ico d={['M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2','M16 2H8a2 2 0 00-2 2v0a2 2 0 002 2h8a2 2 0 002-2v0a2 2 0 00-2-2z']}/>
          Копировать
        </button>
        <button style={S.btn} onClick={()=>{onPin(menu.msgId);onClose()}}>
          <Ico d={['M12 17v5','M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17z']}/>
          Закрепить
        </button>
        {menu.isMe && (
          <button style={{...S.btn, ...S.del}} onClick={()=>{onDelete(menu.msgId);onClose()}}>
            <Ico d={['M3 6h18','M19 6l-1 14H6L5 6','M10 11v6','M14 11v6','M9 6V4h6v2']} c="#E24B4A"/>
            Удалить
          </button>
        )}
      </div>
    </>
  )
})

/* ─── Bubble ─── */
const Bubble = memo(({ msg, isMine, dark, uid, onLongPress, onDoubleClick, onReact, partnerAvatar, showAvatar }) => {
  const SURF = dark ? '#1E0A10' : '#fff'
  const INK  = dark ? '#F5E8EA' : '#1C0A0E'
  const BDR  = 'rgba(200,51,74,0.15)'
  const validReacts = msg.reactions
    ? Object.entries(msg.reactions).filter(([e,u])=>VALID_REACTIONS.has(e)&&Array.isArray(u)&&u.length>0)
    : []

  const timerRef = useRef(null)
  const movedRef = useRef(false)

  function onTouchStart(e) {
    movedRef.current = false
    const t = e.touches[0]
    timerRef.current = setTimeout(()=>{
      if (!movedRef.current) onLongPress(msg, t.clientX, t.clientY)
    }, 500)
  }
  function onTouchMove() { movedRef.current = true; clearTimeout(timerRef.current) }
  function onTouchEnd() { clearTimeout(timerRef.current) }
  function onMouseDown(e) {
    timerRef.current = setTimeout(()=> onLongPress(msg, e.clientX, e.clientY), 500)
  }
  function onMouseUp() { clearTimeout(timerRef.current) }

  return (
    <div style={{ 
      display:'flex', 
      justifyContent:isMine?'flex-end':'flex-start',
      marginBottom:2, 
      paddingLeft:isMine?0:8, 
      paddingRight:isMine?8:0, 
      alignItems:'flex-end', 
      gap:6 
    }}>

      {!isMine && (
        <div style={{ 
          width:28, height:28, borderRadius:'50%', flexShrink:0,
          background:showAvatar?'linear-gradient(135deg,#C8334A,#8B1A2C)':'transparent',
          overflow:'hidden', display:'flex', alignItems:'center', 
          justifyContent:'center', marginBottom:2 
        }}>
          {showAvatar && (partnerAvatar
            ? <img src={partnerAvatar} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            : <svg viewBox="0 0 40 40" width="28" height="28" fill="none">
                <circle cx="20" cy="15" r="7" fill="rgba(255,255,255,0.8)"/>
                <path d="M5 37c0-8.3 6.7-15 15-15s15 6.7 15 15" fill="rgba(255,255,255,0.6)"/>
              </svg>
          )}
        </div>
      )}

      <div 
        style={{ maxWidth:'76%', WebkitUserSelect:'none', userSelect:'none', position:'relative' }}
        onTouchStart={onTouchStart} 
        onTouchMove={onTouchMove} 
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown} 
        onMouseUp={onMouseUp} 
        onMouseLeave={onMouseUp}
        onDoubleClick={()=>onDoubleClick(msg.id)}
      >

        {msg.is_video_circle && msg.video_url ? (
          <div style={{ 
            width:180, height:180, borderRadius:'50%', overflow:'hidden',
            border:`2.5px solid ${isMine?'#C8334A':BDR}`, position:'relative' 
          }}>
            <video 
              src={msg.video_url} 
              playsInline 
              controls 
              preload="metadata"
              style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
            />
          </div>
        ) : (
          <div style={{
            display:'inline-block',
            padding: msg.photo_url&&!msg.text ? 3 : '8px 12px 6px',
            background: isMine ? 'linear-gradient(135deg,#C8334A,#8B1A2C)' : SURF,
            color: isMine ? '#fff' : INK,
            borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            border: isMine ? 'none' : `.5px solid ${BDR}`,
            fontSize:15, 
            lineHeight:1.45,
            wordBreak:'break-word', 
            whiteSpace:'pre-wrap',
            animation:'msgIn .25s ease both',
            WebkitTransform:'translateZ(0)', 
            transform:'translateZ(0)',
          }}>
            {msg.photo_url && (
              <img 
                src={msg.photo_url} 
                alt="" 
                loading="lazy"
                style={{ 
                  maxWidth:'100%', 
                  maxHeight:280, 
                  borderRadius:msg.text?10:14,
                  display:'block', 
                  marginBottom:msg.text?6:0 
                }}
              />
            )}
            {msg.text && (
              <span>
                {msg.text}
                {msg.edited_at && <span style={{fontSize:10,opacity:.5,marginLeft:4}}>ред.</span>}
              </span>
            )}
            <div style={{ 
              fontSize:10, 
              opacity:.55, 
              textAlign:'right', 
              marginTop:2,
              display:'flex', 
              alignItems:'center', 
              justifyContent:'flex-end', 
              gap:2 
            }}>
              {fmtTime(msg.created_at)}
              {isMine && <span style={{fontSize:11}}>✓</span>}
            </div>
          </div>
        )}

        {validReacts.length > 0 && (
          <div style={{ 
            display:'flex', 
            flexWrap:'wrap', 
            gap:3, 
            marginTop:3,
            justifyContent:isMine?'flex-end':'flex-start' 
          }}>
            {validReacts.map(([emoji,users])=>(
              <button 
                key={emoji} 
                onClick={()=>onReact(msg.id,emoji)} 
                style={{
                  background: users.includes(uid) 
                    ? 'rgba(200,51,74,0.15)' 
                    : (dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.05)'),
                  border: users.includes(uid) 
                    ? '1px solid rgba(200,51,74,0.35)' 
                    : '1px solid transparent',
                  borderRadius:999, 
                  padding:'2px 8px', 
                  fontSize:13, 
                  cursor:'pointer',
                  display:'flex', 
                  alignItems:'center', 
                  gap:3, 
                  transition:'transform .15s',
                  WebkitTapHighlightColor:'transparent',
                }}
              >
                {emoji}
                <span style={{fontSize:11,color:dark?'#C4909A':'#9A6070'}}>
                  {users.length}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

/* ─── Main Chat ─── */
export default function Chat({ session, profile, darkMode }) {
  const [messages,   setMessages]   = useState([])
  const [newText,    setNewText]    = useState('')
  const [sending,    setSending]    = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [photoFile,  setPhotoFile]  = useState(null)
  const [photoPreview,setPhotoPreview]=useState(null)
  const [recording,  setRecording]  = useState(false)
  const [editingId,  setEditingId]  = useState(null)
  const [ctxMenu,    setCtxMenu]    = useState(null)
  const [showDown,   setShowDown]   = useState(false)
  const [partner,    setPartner]    = useState(null)

  const endRef     = useRef(null)
  const listRef    = useRef(null)
  const fileRef    = useRef(null)
  const videoRef   = useRef(null)
  const recRef     = useRef(null)
  const chunksRef  = useRef([])
  const streamRef  = useRef(null)
  const previewRef = useRef(null)

  const dark = darkMode
  const BG   = dark ? '#200A10' : '#FBF0F2'
  const SURF = dark ? '#1E0A10' : '#fff'
  const INK  = dark ? '#F5E8EA' : '#1C0A0E'
  const BDR  = 'rgba(200,51,74,0.13)'
  const uid  = session?.user?.id

  useEffect(()=>{
    loadMessages()
    loadPartner()
    const ch = supabase.channel('chat')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},p=>{
        setMessages(prev=> prev.find(m=>m.id===p.new.id) ? prev : [...prev,p.new])
        setTimeout(scrollDown,60)
      })
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'messages'},p=>{
        setMessages(prev=>prev.filter(m=>m.id!==p.old.id))
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'messages'},p=>{
        setMessages(prev=>prev.map(m=>m.id===p.new.id?p.new:m))
      })
      .subscribe()
    return ()=>supabase.removeChannel(ch)
  },[])

  async function loadMessages(){
    const {data}=await supabase.from('messages').select('*')
      .order('created_at',{ascending:true}).limit(200)
    setMessages(data||[])
    setLoading(false)
    setTimeout(scrollDown,120)
  }

  async function loadPartner(){
    if (!profile?.partner_id) return
    const {data}=await supabase.from('profiles').select('*').eq('id',profile.partner_id).single()
    setPartner(data)
  }

  function scrollDown(){ endRef.current?.scrollIntoView({behavior:'smooth'}) }

  function onScroll(){
    const el=listRef.current; if(!el) return
    setShowDown(el.scrollHeight-el.scrollTop-el.clientHeight>180)
  }

  async function upload(file,folder){
    const ext=file.name?.split('.').pop()||'webm'
    const name=`${Date.now()}-${Math.random().toString(36).slice(6)}.${ext}`
    const {error}=await supabase.storage.from('photos').upload(`${folder}/${name}`,file)
    if(error) throw error
    return supabase.storage.from('photos').getPublicUrl(`${folder}/${name}`).data.publicUrl
  }

  async function handleSend(){
    if(!newText.trim()&&!photoFile) return
    setSending(true)
    try{
      let photoUrl=null
      if(photoFile) photoUrl=await upload(photoFile,'chat')
      if(editingId){
        await supabase.from('messages').update({text:newText.trim(),edited_at:new Date().toISOString()}).eq('id',editingId)
        setEditingId(null)
      } else {
        await supabase.from('messages').insert({user_id:uid,text:newText.trim()||null,photo_url:photoUrl})
      }
      setNewText(''); cancelPhoto(); scrollDown()
    } catch(e){ console.error(e) }
    setSending(false)
  }

  function handleKey(e){
    if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); handleSend() }
    if(e.key==='Escape'&&editingId){ setEditingId(null); setNewText('') }
  }

  function onPhotoChange(e){
    const f=e.target.files?.[0]; if(!f) return
    setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f))
  }
  function cancelPhoto(){
    setPhotoFile(null); setPhotoPreview(null)
    if(fileRef.current) fileRef.current.value=''
  }

  // Исправленная запись видео - большой кружочек внизу
  async function startRecord(){
    try{
      const stream=await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user', 
          width: { ideal: 300 }, 
          height: { ideal: 300 } 
        }, 
        audio: true 
      })
      streamRef.current=stream
      
      // Показываем предпросмотр себя в большом кружочке
      if(previewRef.current){ 
        previewRef.current.srcObject = stream
        previewRef.current.muted = true
        previewRef.current.play()
      }
      
      const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm'
      const rec=new MediaRecorder(stream,{mimeType:mime})
      recRef.current=rec
      chunksRef.current=[]
      
      rec.ondataavailable=e=>{ if(e.data.size>0) chunksRef.current.push(e.data) }
      rec.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop())
        if(previewRef.current) previewRef.current.srcObject=null
        streamRef.current=null
        
        const blob=new Blob(chunksRef.current,{type:'video/webm'})
        const file=new File([blob],`circle-${Date.now()}.webm`,{type:'video/webm'})
        setSending(true)
        try{
          const url=await upload(file,'circles')
          await supabase.from('messages').insert({
            user_id:uid,
            video_url:url,
            is_video_circle:true
          })
          scrollDown()
        }catch(e){ console.error(e) }
        setSending(false)
        setRecording(false)
      }
      rec.start()
      setRecording(true)
      
      // Авто-остановка через 60 секунд
      setTimeout(()=>{ 
        if(recRef.current?.state==='recording') recRef.current.stop()
      }, 60000)
    }catch(e){ 
      console.error(e)
      alert('Нет доступа к камере. Проверьте разрешения в настройках браузера.')
    }
  }

  function stopRecord(){ 
    if(recRef.current?.state==='recording') {
      recRef.current.stop()
    }
  }

  function cancelRecord(){
    if(recRef.current?.state==='recording') {
      recRef.current.stop()
    }
    if(streamRef.current) {
      streamRef.current.getTracks().forEach(t=>t.stop())
      streamRef.current=null
    }
    if(previewRef.current) previewRef.current.srcObject=null
    chunksRef.current=[]
    setRecording(false)
  }

  async function onVideoFile(e){
    const f=e.target.files?.[0]; if(!f) return
    setSending(true)
    try{
      const url=await upload(f,'circles')
      await supabase.from('messages').insert({user_id:uid,video_url:url,is_video_circle:true})
      scrollDown()
    }catch(e){ console.error(e) }
    setSending(false)
    if(videoRef.current) videoRef.current.value=''
  }

  async function deleteMsg(id){ 
    await supabase.from('messages').delete().eq('id',id) 
  }

  async function pinMsg(id){
    const m=messages.find(x=>x.id===id); if(!m) return
    await supabase.from('messages').update({is_pinned:!m.is_pinned}).eq('id',id)
  }

  async function addReact(msgId,emoji){
    if(!VALID_REACTIONS.has(emoji)) return
    const m=messages.find(x=>x.id===msgId); if(!m) return
    const r={...(m.reactions||{})}
    if(r[emoji]?.includes(uid)){
      r[emoji]=r[emoji].filter(x=>x!==uid)
      if(!r[emoji].length) delete r[emoji]
    } else {
      r[emoji]=[...(r[emoji]||[]),uid]
    }
    await supabase.from('messages').update({reactions:r}).eq('id',msgId)
  }

  function onLongPress(msg,x,y){
    setCtxMenu({msgId:msg.id,text:msg.text||'',x,y,isMe:msg.user_id===uid})
  }

  function onDoubleTap(id){ addReact(id,'❤️') }

  function copyText(t){ navigator.clipboard?.writeText(t) }

  const pinned = messages.find(m=>m.is_pinned)
  const pName = partner?.name || (profile?.name==='Антон'?'Эльвира':'Антон')
  const pAvatar = partner?.avatar_url

  const iconBtn = { 
    width:36,height:36,borderRadius:'50%',
    background:'rgba(200,51,74,0.09)',
    border:'none',
    display:'flex',
    alignItems:'center',
    justifyContent:'center',
    cursor:'pointer',
    flexShrink:0,
    WebkitTapHighlightColor:'transparent',
    transition:'transform .15s'
  }

  if(loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',
      height:'100%',background:BG,flexDirection:'column',gap:14}}>
      <div style={{animation:'heartbeat 1.4s ease-in-out infinite'}}>
        <svg viewBox="0 0 60 56" width="64" height="60" fill="none">
          <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z" fill="url(#hg)"/>
          <defs><linearGradient id="hg" x1="0" y1="0" x2="60" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E8556A"/><stop offset="100%" stopColor="#C8334A"/>
          </linearGradient></defs>
        </svg>
      </div>
    </div>
  )

  return (
    <div style={{
      display:'flex',
      flexDirection:'column',
      height:'100%',
      background:BG,
      position:'relative',
      overflow:'hidden',
      WebkitOverflowScrolling:'touch'
    }}>

      {/* ШАПКА */}
      <div style={{
        flexShrink:0,
        background:SURF,
        borderBottom:`.5px solid ${BDR}`,
        paddingTop:'max(10px, env(safe-area-inset-top, 0px))',
        paddingBottom:10,
        paddingLeft:14,
        paddingRight:14,
        display:'flex',
        alignItems:'center',
        gap:11,
        zIndex:20,
        WebkitTransform:'translateZ(0)',
        transform:'translateZ(0)'
      }}>
        <div style={{position:'relative',flexShrink:0}}>
          <div style={{
            width:42,height:42,borderRadius:'50%',overflow:'hidden',
            background:'linear-gradient(135deg,#C8334A,#8B1A2C)',
            display:'flex',alignItems:'center',justifyContent:'center'
          }}>
            {pAvatar
              ? <img src={pAvatar} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
                  <circle cx="20" cy="15" r="7" fill="rgba(255,255,255,.85)"/>
                  <path d="M5 37c0-8.3 6.7-15 15-15s15 6.7 15 15" fill="rgba(255,255,255,.65)"/>
                </svg>
            }
          </div>
          <div style={{
            width:10,height:10,background:'#4CAF50',borderRadius:'50%',
            border:`2px solid ${SURF}`,position:'absolute',bottom:1,right:1,
            animation:'pulse 2s ease-in-out infinite'
          }}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{
            fontFamily:"'Cormorant Garamond',serif",
            fontSize:16,
            fontWeight:600,
            color:INK,
            overflow:'hidden',
            textOverflow:'ellipsis',
            whiteSpace:'nowrap'
          }}>
            {pName}
          </div>
          <div style={{fontSize:11,color:'#4CAF50'}}>только для нас двоих</div>
        </div>
        <button style={iconBtn}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#C8334A" strokeWidth="2" strokeLinecap="round">
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
        </button>
      </div>

      {/* Закреплённое сообщение */}
      {pinned && (
        <div style={{
          flexShrink:0,
          background:dark?'rgba(200,51,74,0.08)':'rgba(200,51,74,0.05)',
          borderBottom:`.5px solid rgba(200,51,74,0.12)`,
          padding:'6px 14px',
          display:'flex',
          alignItems:'center',
          gap:8
        }}>
          <div style={{width:3,height:32,background:'#C8334A',borderRadius:3,flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,color:'#C8334A',fontWeight:500,marginBottom:1}}>Закреплено</div>
            <div style={{
              fontSize:13,
              color:INK,
              overflow:'hidden',
              textOverflow:'ellipsis',
              whiteSpace:'nowrap'
            }}>
              {pinned.text||'Фото'}
            </div>
          </div>
          <button onClick={()=>pinMsg(pinned.id)} style={{...iconBtn,background:'none',width:28,height:28}}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#9A6070" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* СООБЩЕНИЯ */}
      <div ref={listRef} onScroll={onScroll} style={{
        flex:1,
        overflowY:'auto',
        padding:'10px 8px',
        display:'flex',
        flexDirection:'column',
        gap:1,
        WebkitOverflowScrolling:'touch',
        scrollbarWidth:'thin',
        minHeight:0
      }}>
        {messages.length===0 && (
          <div style={{
            display:'flex',
            flexDirection:'column',
            alignItems:'center',
            justifyContent:'center',
            flex:1,
            gap:12,
            opacity:.45
          }}>
            <svg viewBox="0 0 60 56" width="52" height="48" fill="none">
              <path d="M30 52C30 52 3 35 3 16C3 8 9.5 2 18 2C22.5 2 26.5 4.5 30 9C33.5 4.5 37.5 2 42 2C50.5 2 57 8 57 16C57 35 30 52 30 52Z"
                fill="rgba(200,51,74,0.35)"/>
            </svg>
            <p style={{fontSize:14,color:'#9A6070',fontFamily:"'DM Sans',sans-serif"}}>Напишите первое сообщение</p>
          </div>
        )}

        {messages.map((msg,i)=>{
          const isMine = msg.user_id===uid
          const showDate = i===0||diffDate(messages[i-1].created_at,msg.created_at)
          const nextMsg = messages[i+1]
          const showAvatar = !isMine && (!nextMsg || nextMsg.user_id===uid || diffDate(msg.created_at,nextMsg.created_at))
          return (
            <div key={msg.id}>
              {showDate && (
                <div style={{textAlign:'center',margin:'10px 0'}}>
                  <span style={{
                    background:'rgba(200,51,74,0.09)',
                    padding:'3px 14px',
                    borderRadius:20,
                    fontSize:11,
                    color:'#9A6070',
                    fontFamily:"'DM Sans',sans-serif"
                  }}>
                    {fmtDateSep(msg.created_at)}
                  </span>
                </div>
              )}
              <Bubble
                msg={msg}
                isMine={isMine}
                dark={dark}
                uid={uid}
                onLongPress={onLongPress}
                onDoubleClick={onDoubleTap}
                onReact={addReact}
                partnerAvatar={pAvatar}
                showAvatar={showAvatar}
              />
            </div>
          )
        })}
        <div ref={endRef}/>
      </div>

      {/* Кнопка вниз */}
      {showDown && (
        <button onClick={scrollDown} style={{
          position:'absolute',
          bottom:80,
          right:14,
          width:38,
          height:38,
          borderRadius:'50%',
          background:dark?'#1E0A10':'#fff',
          border:`.5px solid ${BDR}`,
          boxShadow:'0 2px 12px rgba(0,0,0,0.15)',
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          cursor:'pointer',
          zIndex:15,
          WebkitTapHighlightColor:'transparent'
        }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#C8334A" strokeWidth="2" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      )}

      {/* Контекстное меню - теперь в центре */}
      <ContextMenu 
        menu={ctxMenu} 
        onClose={()=>setCtxMenu(null)}
        onEdit={(id,t)=>{setEditingId(id);setNewText(t)}}
        onDelete={deleteMsg}
        onPin={pinMsg}
        onCopy={copyText}
        onReact={addReact}
      />

      {/* Превью фото */}
      {photoPreview && (
        <div style={{
          flexShrink:0,
          padding:'8px 14px',
          background:SURF,
          borderTop:`.5px solid ${BDR}`,
          display:'flex',
          alignItems:'center',
          gap:10
        }}>
          <img src={photoPreview} style={{width:54,height:54,objectFit:'cover',borderRadius:10}}/>
          <span style={{flex:1,fontSize:13,color:'#9A6070'}}>Фото прикреплено</span>
          <button onClick={cancelPhoto} style={{...iconBtn,background:'none',width:30,height:30}}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9A6070" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* Режим редактирования */}
      {editingId && (
        <div style={{
          flexShrink:0,
          padding:'5px 14px',
          background:'rgba(200,51,74,0.07)',
          borderTop:'0.5px solid rgba(200,51,74,0.15)',
          display:'flex',
          alignItems:'center',
          gap:8
        }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#C8334A" strokeWidth="2" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z"/>
          </svg>
          <span style={{flex:1,fontSize:12,color:'#C8334A',fontFamily:"'DM Sans',sans-serif"}}>
            Редактирование
          </span>
          <button onClick={()=>{setEditingId(null);setNewText('')}}
            style={{...iconBtn,background:'none',width:28,height:28}}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#9A6070" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* ЗАПИСЬ КРУЖОЧКА - БОЛЬШОЙ КРУГ ВНИЗУ */}
      {recording && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 50,
          animation: 'slideUp 0.3s ease',
        }}>
          <div style={{
            width: 200,
            height: 200,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '4px solid #C8334A',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            background: '#000',
            position: 'relative',
          }}>
            <video 
              ref={previewRef} 
              autoPlay 
              playsInline 
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
              }}
            />
            {/* Анимация записи */}
            <div style={{
              position: 'absolute',
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(0,0,0,0.6)',
              padding: '6px 14px',
              borderRadius: 20,
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#C8334A',
                animation: 'pulse 1s ease-in-out infinite',
              }}/>
              <span style={{ fontSize: 12, color: 'white' }}>Запись...</span>
            </div>
          </div>
          
          {/* Кнопки управления */}
          <div style={{
            position: 'absolute',
            bottom: -60,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 24,
            padding: '12px 20px',
            background: SURF,
            borderTop: `.5px solid ${BDR}`,
          }}>
            <button onClick={cancelRecord} style={{
              ...iconBtn,
              width: 48,
              height: 48,
              background: 'rgba(200,51,74,0.1)',
              borderRadius: '50%',
            }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#9A6070" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <button onClick={stopRecord} style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#C8334A,#8B1A2C)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(200,51,74,0.4)',
            }}>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" strokeWidth="2">
                <rect x="6" y="6" width="12" height="12" fill="white" stroke="none"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ПОЛЕ ВВОДА */}
      <div style={{
        flexShrink:0,
        background:SURF,
        borderTop:`.5px solid ${BDR}`,
        padding:'8px 10px',
        paddingBottom:'calc(8px + env(safe-area-inset-bottom, 0px))',
        display:'flex',
        alignItems:'flex-end',
        gap:7,
        WebkitTransform:'translateZ(0)',
        transform:'translateZ(0)',
        zIndex: recording ? 10 : 20,
      }}>

        <button 
          onClick={()=>fileRef.current?.click()} 
          style={iconBtn}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#C8334A" strokeWidth="2" strokeLinecap="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPhotoChange} style={{display:'none'}}/>

        <button 
          onClick={recording?stopRecord:startRecord}
          style={{
            ...iconBtn,
            background:recording?'linear-gradient(135deg,#C8334A,#8B1A2C)':'rgba(200,51,74,0.09)',
            animation:recording?'glow 1.5s ease-in-out infinite':'none'
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
            stroke={recording?'white':'#C8334A'} strokeWidth="2" strokeLinecap="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
        </button>
        <input ref={videoRef} type="file" accept="video/*" onChange={onVideoFile} style={{display:'none'}}/>

        <div style={{
          flex:1,
          background:dark?'#3D1520':'#FBF0F2',
          borderRadius:22,
          border:`.5px solid ${BDR}`,
          padding:'0 14px',
          display:'flex',
          alignItems:'flex-end',
          minWidth:0
        }}>
          <textarea
            value={newText}
            onChange={e=>setNewText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Сообщение..."
            rows={1}
            style={{
              flex:1,
              border:'none',
              background:'none',
              padding:'10px 0',
              fontSize:16,
              fontFamily:"'DM Sans',sans-serif",
              color:INK,
              resize:'none',
              outline:'none',
              maxHeight:100,
              lineHeight:1.4,
              WebkitAppearance:'none',
              width:'100%'
            }}
            onInput={e=>{
              e.target.style.height='auto'
              e.target.style.height=Math.min(e.target.scrollHeight,100)+'px'
            }}
          />
        </div>

        <button 
          onClick={handleSend}
          disabled={sending||(!newText.trim()&&!photoFile)}
          style={{
            ...iconBtn,
            background:(newText.trim()||photoFile)
              ? 'linear-gradient(135deg,#C8334A,#8B1A2C)'
              : 'rgba(200,51,74,0.15)',
            animation:(newText.trim()||photoFile)
              ? 'glow 3s ease-in-out infinite'
              : 'none',
            transition:'all .2s',
            opacity:sending ? 0.6 : 1
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
