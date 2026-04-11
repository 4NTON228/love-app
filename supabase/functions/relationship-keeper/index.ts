// ══════════════════════════════════════════════════════════════
// relationship-keeper — Edge Function для ИИ-советчика
//
// Режимы работы:
//   1. Cron (раз в 6 часов): тело { type: 'cron' }
//      — генерирует вопрос дня Зеркала в 20:00
//      — рассчитывает метрики теплоты
//      — проверяет триггеры капсул времени
//      — находит незавершённые диалоги
//   2. AI-прокси: тело { messages: [{role, content}], model?, ... }
//      — использует xAI /v1/responses (модель: grok-4.20-reasoning)
//      — принимает OpenAI-формат, возвращает OpenAI-формат
//      — секрет AI_API_KEY задаётся в Supabase Dashboard → Secrets
// ══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush       from 'https://esm.sh/web-push@3.6.7'

// ── Заголовки CORS ────────────────────────────────────────────
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

// ── VAPID-ключи (те же что в send-notification) ───────────────
const VAPID_PUBLIC  = 'BJZU7YGUVM4c0w-tCFGqOdUXqzOTQoYXMOKrn_EHDBUV_eKx9tQtzXf7rgfmLkAhkfh45bEmtGuis8b8m5-BHVs'
const VAPID_PRIVATE = 'Drbxv8iXT2ryLjkGGhhyy3-_2NZTJ31AARv1F7zaCVE'
const VAPID_SUBJECT = 'mailto:admin@example.com'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

// ── Отправка web-push уведомления конкретному пользователю ────
// Берём подписки из таблицы push_subscriptions (как в send-notification).
// Если подписок нет — тихо игнорируем, не бросаем ошибку.
async function pushToUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  title: string,
  body: string,
) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return 0

  const payload = JSON.stringify({ title, body })
  const results = await Promise.allSettled(
    subs.map((row: { subscription: PushSubscriptionJSON }) =>
      webpush.sendNotification(row.subscription, payload),
    ),
  )

  // Удаляем протухшие подписки (410 Gone)
  const expired = results
    .map((r, i) => ({ r, sub: subs[i].subscription }))
    .filter(({ r }) => r.status === 'rejected' && (r as PromiseRejectedResult).reason?.statusCode === 410)

  if (expired.length > 0) {
    const endpoints = expired.map(({ sub }) => (sub as { endpoint: string }).endpoint)
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', endpoints)
      .eq('user_id', userId)
  }

  return results.filter(r => r.status === 'fulfilled').length
}

// ── Банк вопросов для Зеркала (30 вопросов) ──────────────────
const MIRROR_QUESTIONS: string[] = [
  'Что в нашем партнёре вдохновляет тебя больше всего прямо сейчас?',
  'Каким был наш лучший совместный день за последние месяцы?',
  'Какую мечту ты хочешь осуществить вместе с партнёром?',
  'Что ты больше всего ценишь в наших отношениях?',
  'Какой момент вместе ты будешь помнить всегда?',
  'Что партнёр делает, что неизменно поднимает тебе настроение?',
  'Какое приключение ты хочешь пережить с партнёром?',
  'Что тебя удивило в партнёре за последнее время?',
  'Какая наша традиция нравится тебе больше всего?',
  'Что бы ты хотел сказать партнёру, но ещё не сказал?',
  'Какое место в мире ты хочешь посетить вместе?',
  'Чем ты гордишься в нашей паре?',
  'Что делает тебя счастливым в тихие моменты вместе?',
  'Какое качество партнёра ты хочешь перенять?',
  'Как ты представляешь себе нашу жизнь через 5 лет?',
  'Что для тебя значит «дом»?',
  'Какую песню ты ассоциируешь с нашими отношениями?',
  'Что ты хочешь, чтобы партнёр знал о тебе лучше?',
  'Какой наш общий страх и как мы его преодолеваем?',
  'Что заставляет тебя чувствовать себя любимым?',
  'Какое наше первое совместное воспоминание самое дорогое?',
  'Что бы ты изменил в нашем распорядке дня?',
  'Какой подарок (не вещь) ты хотел бы получить от партнёра?',
  'Что делает конфликт в наших отношениях конструктивным?',
  'Какое маленькое действие партнёра значит для тебя больше всего?',
  'Что нас объединяет сильнее всего?',
  'Какую привычку ты хочешь развить вместе?',
  'Что ты чувствуешь, когда видишь партнёра после долгой разлуки?',
  'Какой разговор ты всё время откладываешь?',
  'Что ты хочешь, чтобы партнёр понял о твоих мечтах?',
]

// ── Эмодзи-паттерн для подсчёта плотности ──────────────────
const EMOJI_REGEX =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}]/gu

// ── «Мы»-слова (русский язык) ────────────────────────────────
const WE_WORDS = /\b(мы|нас|нам|наш|наша|наше|наши|нашу|нашего|нашей|нашим|нашими)\b/gi

// ══════════════════════════════════════════════════════════════
// Главный обработчик
// ══════════════════════════════════════════════════════════════
Deno.serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors })
  }

  try {
    const body = await req.json().catch(() => ({}))

    // ── Режим 1: OpenAI-совместимый прокси (к Grok или другому AI) ──
    if (body.messages && Array.isArray(body.messages)) {
      return handleAIProxy(body)
    }

    // ── Режим 2: Задачи обслуживания (cron или ручной вызов) ──
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const taskType = body.type ?? 'cron'
    const results: Record<string, unknown> = {}

    if (taskType === 'cron' || taskType === 'mirror') {
      results.mirror = await generateDailyMirrorQuestions(supabase)
    }
    if (taskType === 'cron' || taskType === 'metrics') {
      results.metrics = await updateWarmthMetrics(supabase)
    }
    if (taskType === 'cron' || taskType === 'capsules') {
      results.capsules = await checkTimeCapsules(supabase)
    }
    if (taskType === 'cron' || taskType === 'dialogs') {
      results.dialogs = await findUnfinishedDialogs(supabase)
    }

    return new Response(JSON.stringify({ ok: true, ...results }), { headers: cors })
  } catch (err) {
    console.error('[relationship-keeper] error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: cors },
    )
  }
})

// ══════════════════════════════════════════════════════════════
// 1. Генерация вопроса дня для игры Зеркало
//    Запускается в 20:00 по UTC (настраивается в cron Supabase).
//    Для каждой пары создаётся одна запись на сегодня.
// ══════════════════════════════════════════════════════════════
async function generateDailyMirrorQuestions(supabase: ReturnType<typeof createClient>) {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // Выбираем вопрос дня детерминированно по номеру дня года
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  )
  const question = MIRROR_QUESTIONS[dayOfYear % MIRROR_QUESTIONS.length]

  // Загружаем все профили, у которых есть partner_id
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, partner_id')
    .not('partner_id', 'is', null)

  if (error) throw error

  let created = 0

  // Создаём записи для каждой уникальной пары (по одной на пару)
  const seenPairs = new Set<string>()
  for (const p of profiles ?? []) {
    const pairKey = [p.id, p.partner_id].sort().join(':')
    if (seenPairs.has(pairKey)) continue
    seenPairs.add(pairKey)

    // Проверяем, существует ли уже вопрос на сегодня
    const { data: existing } = await supabase
      .from('sync_mirror')
      .select('id')
      .eq('user_id', p.id)
      .eq('partner_id', p.partner_id)
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${today}T23:59:59Z`)
      .maybeSingle()

    if (existing) continue

    const { error: insertErr } = await supabase.from('sync_mirror').insert({
      user_id: p.id,
      partner_id: p.partner_id,
      question,
    })

    if (!insertErr) {
      created++
      // Уведомляем обоих участников пары
      await pushToUser(supabase, p.id,        'Зеркало', `Вопрос дня: ${question.slice(0, 60)}...`)
      await pushToUser(supabase, p.partner_id, 'Зеркало', `Вопрос дня: ${question.slice(0, 60)}...`)
    }
  }

  return { question, created, date: today }
}

// ══════════════════════════════════════════════════════════════
// 2. Расчёт метрик теплоты
//    По последним 20 сообщениям каждой пары.
// ══════════════════════════════════════════════════════════════
async function updateWarmthMetrics(supabase: ReturnType<typeof createClient>) {
  const today = new Date().toISOString().slice(0, 10)

  // Загружаем пары (уникальные)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, partner_id')
    .not('partner_id', 'is', null)

  let updated = 0
  const seenPairs = new Set<string>()

  for (const p of profiles ?? []) {
    const pairKey = [p.id, p.partner_id].sort().join(':')
    if (seenPairs.has(pairKey)) continue
    seenPairs.add(pairKey)

    // Последние 20 сообщений пары
    const { data: msgs } = await supabase
      .from('messages')
      .select('user_id, text, created_at')
      .or(`user_id.eq.${p.id},user_id.eq.${p.partner_id}`)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!msgs || msgs.length < 2) continue

    const metrics = calcWarmthMetrics(msgs, p.id, p.partner_id)

    // Upsert метрик для обоих участников пары
    for (const [userId, partnerId] of [
      [p.id, p.partner_id],
      [p.partner_id, p.id],
    ]) {
      const userMsgs = msgs.filter((m) => m.user_id === userId)
      const userMetrics = calcWarmthMetrics(userMsgs.length > 0 ? userMsgs : msgs, userId, partnerId)

      await supabase.from('warmth_metrics').upsert(
        {
          user_id: userId,
          partner_id: partnerId,
          date: today,
          warmth_index: userMetrics.warmthIndex,
          avg_response_time: metrics.avgResponseTime,
          avg_length: userMetrics.avgLength,
          emoji_density: userMetrics.emojiDensity,
          we_ratio: userMetrics.weRatio,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,date' },
      )
      updated++
    }
  }

  return { updated, date: today }
}

// ── Вспомогательная функция расчёта метрик ────────────────────
function calcWarmthMetrics(
  msgs: Array<{ user_id: string; text: string | null; created_at: string }>,
  userId: string,
  _partnerId: string,
) {
  const texts = msgs.map((m) => m.text ?? '')

  // Средняя длина сообщений
  const totalLen = texts.reduce((s, t) => s + t.length, 0)
  const avgLength = texts.length > 0 ? Math.round(totalLen / texts.length) : 0

  // Плотность эмодзи
  const withEmoji = texts.filter((t) => EMOJI_REGEX.test(t)).length
  const emojiDensity = texts.length > 0 ? +(withEmoji / texts.length).toFixed(3) : 0

  // Частота «мы»-слов
  const withWe = texts.filter((t) => WE_WORDS.test(t)).length
  const weRatio = texts.length > 0 ? +(withWe / texts.length).toFixed(3) : 0

  // Среднее время ответа (секунды между сменой собеседника)
  let totalResponseTime = 0
  let responseSamples = 0
  for (let i = 1; i < msgs.length; i++) {
    if (msgs[i].user_id !== msgs[i - 1].user_id) {
      const diff =
        (new Date(msgs[i - 1].created_at).getTime() - new Date(msgs[i].created_at).getTime()) /
        1000
      if (diff > 0 && diff < 86400) {
        totalResponseTime += diff
        responseSamples++
      }
    }
  }
  const avgResponseTime =
    responseSamples > 0 ? Math.round(totalResponseTime / responseSamples) : 0

  // Итоговый индекс теплоты (взвешенная сумма)
  const lengthScore = Math.min(avgLength / 80, 1) * 0.25
  const emojiScore = emojiDensity * 0.3
  const weScore = Math.min(weRatio * 4, 1) * 0.25
  // Быстрые ответы (< 5 минут) дают высокий балл
  const responseScore =
    avgResponseTime > 0
      ? Math.max(0, 1 - avgResponseTime / (60 * 30)) * 0.2
      : 0.1

  const warmthIndex = +Math.min(
    1,
    Math.max(0, lengthScore + emojiScore + weScore + responseScore),
  ).toFixed(3)

  return { avgLength, emojiDensity, weRatio, avgResponseTime, warmthIndex }
}

// ══════════════════════════════════════════════════════════════
// 3. Проверка триггеров капсул времени
// ══════════════════════════════════════════════════════════════
async function checkTimeCapsules(supabase: ReturnType<typeof createClient>) {
  const now = new Date()
  let fired = 0

  // ── Тип 'date': наступила дата отправки ──────────────────
  const { data: dateCapsules } = await supabase
    .from('time_capsules')
    .select('*')
    .eq('is_sent', false)
    .eq('trigger_type', 'date')
    .lte('trigger_date', now.toISOString())

  for (const cap of dateCapsules ?? []) {
    await sendCapsule(supabase, cap)
    fired++
  }

  // ── Тип 'days': прошло N дней с создания ─────────────────
  const { data: daysCapsules } = await supabase
    .from('time_capsules')
    .select('*')
    .eq('is_sent', false)
    .eq('trigger_type', 'days')

  for (const cap of daysCapsules ?? []) {
    if (!cap.trigger_days) continue
    const sendAt = new Date(cap.created_at)
    sendAt.setDate(sendAt.getDate() + cap.trigger_days)
    if (now >= sendAt) {
      await sendCapsule(supabase, cap)
      fired++
    }
  }

  // ── Тип 'fight': нет сообщений 8+ часов (необычное молчание) ─
  const { data: fightCapsules } = await supabase
    .from('time_capsules')
    .select('*')
    .eq('is_sent', false)
    .eq('trigger_type', 'fight')

  for (const cap of fightCapsules ?? []) {
    // Проверяем последнее сообщение пары
    const { data: lastMsg } = await supabase
      .from('messages')
      .select('created_at')
      .or(`user_id.eq.${cap.user_id},user_id.eq.${cap.partner_id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!lastMsg) continue

    const silenceHours =
      (now.getTime() - new Date(lastMsg.created_at).getTime()) / 3600000

    // Обычная активность: считаем среднее за последние 7 дней
    const { data: recentMsgs } = await supabase
      .from('messages')
      .select('created_at')
      .or(`user_id.eq.${cap.user_id},user_id.eq.${cap.partner_id}`)
      .gte('created_at', new Date(now.getTime() - 7 * 86400000).toISOString())
      .order('created_at', { ascending: false })

    // Если за 7 дней было хотя бы 14 сообщений (~2/день) и молчание > 8ч
    if ((recentMsgs?.length ?? 0) >= 14 && silenceHours >= 8) {
      await sendCapsule(supabase, cap)
      fired++
    }
  }

  return { fired }
}

// ── Отправить капсулу в чат + push-уведомление партнёру ──────
async function sendCapsule(
  supabase: ReturnType<typeof createClient>,
  cap: Record<string, unknown>,
) {
  const preview = (cap.message as string).slice(0, 60).trim()

  // Создаём сообщение в чате с пометкой «Капсула времени»
  await supabase.from('messages').insert({
    user_id: cap.user_id,
    text: `[Капсула времени]\n${cap.message}`,
    created_at: new Date().toISOString(),
  })

  // Помечаем капсулу как отправленную
  await supabase
    .from('time_capsules')
    .update({ is_sent: true, sent_at: new Date().toISOString() })
    .eq('id', cap.id)

  // Уведомляем партнёра о прибытии капсулы
  await pushToUser(
    supabase,
    cap.partner_id as string,
    'Капсула времени',
    `Тебе пришло письмо из прошлого: «${preview}...»`,
  )
}

// ══════════════════════════════════════════════════════════════
// 4. Поиск незавершённых диалогов (вопрос без ответа > 12 часов)
// ══════════════════════════════════════════════════════════════
async function findUnfinishedDialogs(supabase: ReturnType<typeof createClient>) {
  const cutoff = new Date(Date.now() - 12 * 3600000).toISOString()
  const found: Array<{ userId: string; partnerId: string; topic: string; messageId: string }> = []

  // Ищем сообщения с вопросительным знаком, без ответа 12+ часов
  const { data: questions } = await supabase
    .from('messages')
    .select('id, user_id, text, created_at')
    .like('text', '%?%')
    .lte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!questions) return { found: 0 }

  for (const q of questions) {
    // Получаем партнёра
    const { data: profile } = await supabase
      .from('profiles')
      .select('partner_id')
      .eq('id', q.user_id)
      .maybeSingle()

    if (!profile?.partner_id) continue

    // Проверяем: есть ли ответ партнёра после этого вопроса?
    const { data: reply } = await supabase
      .from('messages')
      .select('id')
      .eq('user_id', profile.partner_id)
      .gt('created_at', q.created_at)
      .limit(1)
      .maybeSingle()

    if (!reply) {
      // Укорачиваем тему до 60 символов
      const topic = (q.text ?? '').slice(0, 60).replace(/\n/g, ' ').trim()
      found.push({
        userId: profile.partner_id,   // уведомляем партнёра
        partnerId: q.user_id,
        topic,
        messageId: q.id,
      })

      // Тихий push-напоминалка партнёру о незавершённом диалоге
      await pushToUser(
        supabase,
        profile.partner_id,
        'Незавершённый разговор',
        `Тебя ждёт ответ: «${topic}»`,
      )

      // Сохраняем инсайт для InsightsWidget (через таблицу ai_advisor_insights)
      // На упрощённом уровне обновляем флаг в ai_advisor_settings
      await supabase.from('ai_advisor_settings').upsert(
        { user_id: profile.partner_id },
        { onConflict: 'user_id', ignoreDuplicates: true },
      )
    }
  }

  return { found: found.length, dialogs: found.slice(0, 5) }
}

// ══════════════════════════════════════════════════════════════
// 5. Прокси к xAI Grok через нативный эндпоинт /v1/responses
//
//    Формат запроса (от клиента — OpenAI-совместимый):
//      { messages: [{role, content}, ...], model?, ... }
//
//    Формат к xAI API:
//      POST https://api.x.ai/v1/responses
//      { model, input, system, ... }
//
//    Ответ возвращается в OpenAI-совместимом формате,
//    чтобы клиентский код не пришлось менять.
// ══════════════════════════════════════════════════════════════
async function handleAIProxy(body: Record<string, unknown>): Promise<Response> {
  // Ключ добавляется через:
  //   supabase secrets set AI_API_KEY=xai-...
  // или Dashboard → Edge Functions → Secrets → AI_API_KEY
  const aiKey = Deno.env.get('AI_API_KEY')
  if (!aiKey) {
    return new Response(
      JSON.stringify({ error: 'AI_API_KEY не настроен. Добавь ключ xAI в Supabase Dashboard → Settings → Edge Functions → Secrets' }),
      { status: 500, headers: cors },
    )
  }

  const messages = (body.messages ?? []) as Array<{ role: string; content: string }>
  const model    = (body.model as string) ?? 'grok-4.20-reasoning'

  // Системный промпт советчика по отношениям
  const systemPrompt =
    'Ты тактичный советчик по отношениям. ' +
    'Отвечай по-русски, кратко и тепло. ' +
    'Не навязывай советы — предлагай мягко. ' +
    'Избегай клише. Фокусируйся на конкретной ситуации пары. ' +
    'Максимум 2-3 предложения.'

  // Собираем input: объединяем все user/assistant сообщения в строку
  // (кроме system — он идёт отдельным полем)
  const conversationParts = messages
    .filter(m => m.role !== 'system')
    .map(m => {
      const who = m.role === 'user' ? 'Пользователь' : 'Ассистент'
      return `${who}: ${m.content}`
    })
    .join('\n')

  // Если клиент прислал свой system-промпт — добавляем к нашему
  const clientSystem = messages.find(m => m.role === 'system')?.content ?? ''
  const fullSystem   = clientSystem ? `${systemPrompt}\n\n${clientSystem}` : systemPrompt

  // Вызов xAI /v1/responses
  const xaiBody: Record<string, unknown> = {
    model,
    input: conversationParts || 'Привет',
    system: fullSystem,
  }

  // Передаём reasoning effort если явно указан
  if (body.reasoning_effort) xaiBody.reasoning_effort = body.reasoning_effort

  const upstream = await fetch('https://api.x.ai/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiKey}`,
    },
    body: JSON.stringify(xaiBody),
  })

  const xaiData = await upstream.json()

  if (!upstream.ok) {
    return new Response(JSON.stringify(xaiData), {
      status: upstream.status,
      headers: cors,
    })
  }

  // Конвертируем ответ xAI в OpenAI-совместимый формат
  // xAI /v1/responses возвращает: { output: [{type:"message", content:[{type:"output_text",text:"..."}]}], ... }
  let assistantText = ''
  try {
    const outputItem = (xaiData.output ?? []).find(
      (o: Record<string, unknown>) => o.type === 'message',
    )
    const contentItem = (outputItem?.content ?? []).find(
      (c: Record<string, unknown>) => c.type === 'output_text',
    )
    assistantText = contentItem?.text ?? ''
  } catch (_) {
    // Fallback: пробуем вытащить текст напрямую
    assistantText = xaiData.text ?? xaiData.content ?? JSON.stringify(xaiData)
  }

  // Оборачиваем в OpenAI Chat Completions формат
  const openaiCompat = {
    id:      xaiData.id ?? `chatcmpl-${Date.now()}`,
    object:  'chat.completion',
    model,
    choices: [{
      index:         0,
      message:       { role: 'assistant', content: assistantText },
      finish_reason: 'stop',
    }],
    usage: xaiData.usage ?? {},
    // Поле для reasoning-моделей (если есть)
    ...(xaiData.usage?.reasoning_tokens
      ? { reasoning_tokens: xaiData.usage.reasoning_tokens }
      : {}),
  }

  return new Response(JSON.stringify(openaiCompat), {
    status: 200,
    headers: cors,
  })
}
