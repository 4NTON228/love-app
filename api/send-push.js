const webpush = require('web-push')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

webpush.setVapidDetails(
  'mailto:love-app@example.com',
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { title, body, senderId } = req.body

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .neq('user_id', senderId)

  if (!subs || subs.length === 0) return res.status(200).json({ sent: 0 })

  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub.subscription, JSON.stringify({ title, body }))
      sent++
    } catch (err) {
      if (err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }

  res.status(200).json({ sent })
}
