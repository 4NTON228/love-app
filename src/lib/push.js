import { supabase } from './supabase'

export async function subscribeToPush(userId) {
  if (!('Notification' in window)) return false;
  
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
    
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true
      });
    }
    
    // Сохраняем в Supabase
    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      subscription: sub.toJSON(),
      updated_at: new Date().toISOString()
    });
    
    console.log('✅ Подписка сохранена');
    return true;
  } catch (err) {
    console.error('Ошибка:', err);
    return false;
  }
}

export async function sendPushNotification(title, body, recipientId) {
  console.log('Отправка через свой сервер');
}
