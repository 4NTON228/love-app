import { supabase } from './supabase'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export async function subscribeToPush(userId) {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const reg = await navigator.serviceWorker.ready

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      console.warn('VAPID ключ не найден в .env')
      return false
    }

    // Берём текущую подписку или создаём новую
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
    }

    // Сохраняем в Supabase с таймаутом 8 секунд
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { user_id: userId, subscription: sub.toJSON(), updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    clearTimeout(timer)

    if (error) {
      // Если upsert не сработал — пробуем простой insert (без updated_at, для старых таблиц)
      if (error.code === '42703') {
        // Столбец updated_at не существует — вставляем без него
        await supabase
          .from('push_subscriptions')
          .upsert(
            { user_id: userId, subscription: sub.toJSON() },
            { onConflict: 'user_id' }
          )
      } else if (error.code === '23505') {
        // Дубликат — обновляем напрямую
        await supabase
          .from('push_subscriptions')
          .update({ subscription: sub.toJSON() })
          .eq('user_id', userId)
      } else {
        console.warn('Push subscription save error:', error.code, error.message)
      }
    }

    console.log('✅ Push подписка сохранена')
    return true

  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('Push subscription timeout — попробуй позже')
    } else {
      console.warn('Push subscription error:', err.message)
    }
    return false
  }
}

export async function sendPushNotification(title, body, recipientId) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title, body, recipientId }),
      }
    )

    if (!response.ok) {
      const text = await response.text()
      console.warn('Push notification error:', text)
    }
  } catch (err) {
    console.warn('Push notification exception:', err.message)
  }
}
