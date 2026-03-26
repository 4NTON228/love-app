const { createClient } = require('@supabase/supabase-js')

// Этот файл теперь просто проксирует запросы в Supabase Edge Function
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  }

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  // Только POST
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ error: 'Method not allowed' }) 
    }
  }

  try {
    // Получаем данные из запроса
    const { title, body, recipientId, senderId } = JSON.parse(event.body)
    
    if (!recipientId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'recipientId is required' })
      }
    }

    // Создаем клиент Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    )

    // Получаем сессию из заголовка Authorization
    const authHeader = event.headers.authorization || event.headers.Authorization
    const token = authHeader?.replace('Bearer ', '')

    // Вызываем Edge Function в Supabase
    const response = await fetch(
      'https://bqyisdgwtgxxomukozko.supabase.co/functions/v1/send-notification',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          body,
          recipientId
        })
      }
    )

    const data = await response.text()
    
    return {
      statusCode: response.status,
      headers,
      body: data
    }

  } catch (error) {
    console.error('Proxy error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    }
  }
}
