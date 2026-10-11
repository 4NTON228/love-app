// Нативные push через Expo Push Service (APNs / FCM).
// Токен кладём в push_subscriptions.subscription как { expo_token } —
// send-notification отличает его от web-push подписки.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPush(userId: string, { prompt = false }: { prompt?: boolean } = {}): Promise<string | null> {
  if (!Device.isDevice) return null; // симулятор/эмулятор без push

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Сообщения и напоминания',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
      lightColor: '#D04F66',
    });
  }

  // Как в вебе: разрешение спрашиваем только по явному действию (переключатель в профиле)
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && prompt) ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return null;

  // projectId появляется в app.json после `eas init`
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('push_subscriptions').upsert(
      { user_id: userId, subscription: { expo_token: token, platform: Platform.OS }, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
    return token;
  } catch (e) {
    console.warn('[push]', e);
    return null;
  }
}

/** Есть ли сохранённый push-токен этого пользователя (аналог Notification.permission === 'granted') */
export async function isPushEnabled(userId: string): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return false;
  const { data } = await supabase.from('push_subscriptions').select('subscription').eq('user_id', userId).maybeSingle();
  return !!(data?.subscription as { expo_token?: string } | undefined)?.expo_token;
}

/** Отписка: удаляем подписку на сервере (как sub.unsubscribe() + delete в вебе) */
export async function unregisterPush(userId: string) {
  await supabase.from('push_subscriptions').delete().eq('user_id', userId);
}

export async function pushPermissionDenied() {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return status === 'denied' && !canAskAgain;
}
