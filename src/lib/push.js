import { supabase } from './supabase'

// Функция для конвертации VAPID ключа
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export async function subscribeToPush(userId) {
  if (!('Notification' in window)) return false;
  
  try {
    console.log('📱 Запрашиваем разрешение...');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('❌ Нет разрешения');
      return false;
    }
    
    console.log('✅ Разрешение получено');
    
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    
    if (!sub) {
      console.log('📦 Создаём новую подписку...');
      
      // Получаем VAPID ключ из переменных окружения
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      console.log('VAPID ключ:', vapidKey ? 'найден' : 'не найден');
      
      if (!vapidKey) {
        throw new Error('VAPID ключ не найден в переменных окружения');
      }
      
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });
    }
    
    console.log('✅ Подписка создана:', sub);
    
    // Сохраняем в Supabase
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        subscription: sub.toJSON(),
        updated_at: new Date().toISOString()
      });
    
    if (error) throw error;
    console.log('✅ Подписка сохранена в Supabase');
    return true;
    
  } catch (err) {
    console.error('❌ Ошибка подписки:', err);
    return false;
  }
}

export async function sendPushNotification(title, body, recipientId, senderId) {
  try {
    console.log('📨 Отправка уведомления:', { title, body, recipientId });
    
    // Получаем текущую сессию
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.error('❌ Нет активной сессии');
      return;
    }

    // Вызываем Edge Function
    const response = await fetch(
      'https://bqyisdgwtgxxomukozko.supabase.co/functions/v1/send-notification',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title,
          body,
          recipientId
        })
      }
    );

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Уведомление отправлено через Edge Function:', result);
    } else {
      const error = await response.text();
      console.error('❌ Ошибка от Edge Function:', error);
    }
  } catch (err) {
    console.error('❌ Ошибка при вызове Edge Function:', err);
  }
}
