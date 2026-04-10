// ══════════════════════════════════════════════════════════════
// rewrite-message — Edge Function: Переводчик эмоций
//
// Принимает:
//   { message: string, context?: string, template?: string }
//
// Возвращает:
//   { original: string, rewritten: string, tips: string[] }
//
// Использует xAI Grok через /v1/responses
// ══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const SYSTEM_PROMPT = `Ты эксперт по ненасильственному общению и эмоциональному интеллекту в отношениях.

Твоя задача — переформулировать сообщение так, чтобы оно:
1. Сохраняло исходный смысл и суть просьбы
2. Убирало агрессию, обвинения, пассивную агрессию
3. Выражало чувства через «я-высказывания»
4. Приглашало к диалогу, а не к защите
5. Звучало тепло и уважительно

Отвечай ТОЛЬКО в формате JSON (без markdown-блоков):
{
  "rewritten": "переформулированное сообщение",
  "tips": ["краткий совет 1", "краткий совет 2"]
}

Правила:
- Сохраняй живой разговорный тон, не делай речь официальной
- Максимум 2 совета, каждый до 10 слов
- Если сообщение уже корректное — верни его как есть, добавь позитивный совет
- Отвечай на том же языке, что и входное сообщение (чаще всего — русский)`

async function callGrok(message: string, context?: string, template?: string): Promise<{
  rewritten: string
  tips: string[]
}> {
  const aiKey = Deno.env.get('AI_API_KEY') ?? ''

  if (!aiKey) {
    // Fallback: basic rewrite without AI
    return {
      rewritten: message,
      tips: ['Добавь AI_API_KEY для умного переформулирования'],
    }
  }

  let userInput = `Исходное сообщение: "${message}"`
  if (context) userInput += `\nКонтекст ситуации: ${context}`
  if (template) userInput += `\nПаттерн общения: ${template}`

  const xaiBody = {
    model: 'grok-3-mini-fast',
    input: userInput,
    system: SYSTEM_PROMPT,
  }

  const response = await fetch('https://api.x.ai/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiKey}`,
    },
    body: JSON.stringify(xaiBody),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`xAI error ${response.status}: ${err}`)
  }

  const data = await response.json()

  // Extract text from xAI response format
  let text = ''
  try {
    const outputItem = (data.output ?? []).find(
      (o: Record<string, unknown>) => o.type === 'message',
    )
    const contentItem = (outputItem?.content ?? []).find(
      (c: Record<string, unknown>) => c.type === 'output_text',
    )
    text = contentItem?.text ?? ''
  } catch (_) {
    text = data.text ?? data.content ?? ''
  }

  // Parse JSON from response
  try {
    // Strip markdown code blocks if present
    const cleaned = text.replace(/^```json\s*/m, '').replace(/```\s*$/m, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      rewritten: parsed.rewritten ?? message,
      tips: Array.isArray(parsed.tips) ? parsed.tips.slice(0, 2) : [],
    }
  } catch (_) {
    // If JSON parse fails, use the raw text as rewritten
    return {
      rewritten: text || message,
      tips: [],
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { message, context, template } = body as {
      message?: string
      context?: string
      template?: string
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'message is required' }),
        { status: 400, headers: cors },
      )
    }

    const result = await callGrok(message.trim(), context, template)

    return new Response(
      JSON.stringify({
        original: message.trim(),
        rewritten: result.rewritten,
        tips: result.tips,
      }),
      { status: 200, headers: cors },
    )
  } catch (err) {
    console.error('[rewrite-message] error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: cors },
    )
  }
})
