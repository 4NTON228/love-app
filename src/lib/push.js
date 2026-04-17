import { supabase } from './supabase'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

const isPushSupported =
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator &&
  'PushManager' in window

export async function subscribeToPush(userId) {
  if (!isPushSupported) return false

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const reg = await navigator.serviceWorker.ready

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      console.warn('VAPID key missing — set VITE_VAPID_PUBLIC_KEY in .env')
      return false
    }

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { user_id: userId, subscription: sub.toJSON(), updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    if (error) {
      // Fallback for tables without updated_at column
      if (error.code === '42703') {
        await supabase
          .from('push_subscriptions')
          .upsert({ user_id: userId, subscription: sub.toJSON() }, { onConflict: 'user_id' })
      } else {
        console.warn('Push subscription save error:', error.code, error.message)
      }
    }

    return true
  } catch (err) {
    console.warn('Push subscription error:', err.message)
    return false
  }
}

/**
 * Send a push notification to the current user's partner.
 * recipientId MUST be profile.partner_id — caller is responsible for validation.
 */
export async function sendPushNotification(title, body, recipientId) {
  if (!recipientId) return

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Safety: never send to self
    if (recipientId === session.user.id) {
      console.warn('sendPushNotification: recipientId matches sender — skipped')
      return
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const response = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ title, body, recipientId }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.warn('Push notification error:', text)
    }
  } catch (err) {
    console.warn('Push notification exception:', err.message)
  }
}
