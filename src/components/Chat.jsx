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
    
    // Определяем ID получателя (партнёра)
    const partnerId = partnerProfile?.id || 'ab73068c-b71a-4a57-9fa0-867543f1a2b0' // ← ID твоей девушки
    
    const senderName = profile?.name || 'Кто-то'
    
    // Отправляем уведомление ПОЛУЧАТЕЛЮ, а не себе!
    sendPushNotification(
      senderName, 
      photoUrl ? '📷 Фото' : text, 
      partnerId,  // ← ID получателя (ВАЖНО!)
      myId        // ← ID отправителя
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
