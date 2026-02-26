const webpush = require('web-push')
const { createClient } = require('@supabase/supabase-js')

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { title, body, senderId } = JSON.parse(event.body)

    // Получаем partner_id отправителя
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('partner_id')
      .eq('id', senderId)
      .single()

    if (!senderProfile?.partner_id) {
      return { statusCode: 200, body: 'No partner' }
    }

    // Получаем подписку партнёра
    const { data: subRecord } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', senderProfile.partner_id)
      .single()

    if (!subRecord?.subscription) {
      return { statusCode: 200, body: 'No subscription' }
    }

    await webpush.sendNotification(
      subRecord.subscription,
      JSON.stringify({ title, body })
    )

    return { statusCode: 200, body: 'OK' }
  } catch (err) {
    console.error('send-push error:', err)
    return { statusCode: 500, body: err.message }
  }
}
