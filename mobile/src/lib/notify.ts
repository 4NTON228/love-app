import { supabase, SUPABASE_URL } from './supabase';

/** Порт sendPushNotification из src/lib/push.js: Edge Function send-notification. */
export async function sendPushNotification(title: string, body: string, recipientId: string | null | undefined) {
  if (!recipientId) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || recipientId === session.user.id) return;
    await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ title, body, recipientId }),
    });
  } catch { /* push не обязателен */ }
}
