const webpush = require('web-push')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:love-app@example.com',
  process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

// Netlify Functions format
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let title, body, senderId
  try {
    const parsed = JSON.parse(event.body)
    title = parsed.title
    body = parsed.body
    senderId = parsed.senderId
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .neq('user_id', senderId)

  if (!subs || subs.length === 0) {
    return { statusCode: 200, headers, body: JSON.stringify({ sent: 0 }) }
  }

  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        sub.subscription,
        JSON.stringify({ title, body })
      )
      sent++
    } catch (err) {
      if (err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }

  return { statusCode: 200, headers, body: JSON.stringify({ sent }) }
}
