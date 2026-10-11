// Ограничения на сообщения, которые клиент отправляет в AI-прокси.

const ROLES = new Set(['system', 'user', 'assistant'])
const MAX_MESSAGES = 20
const MAX_CHARS = 4000

export type AIMessage = { role: string; content: string }

export function sanitizeAIMessages(raw: unknown): AIMessage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((m) => m && ROLES.has(m.role) && typeof m.content === 'string')
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
}
