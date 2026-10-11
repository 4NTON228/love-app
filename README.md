# Love App

Приватное веб-приложение для пар. Чат, Моменты, Планы, Календарь, Письма, AI-советник и многое другое — только для двоих.

---

## Стек

| Слой      | Технология                                                              |
| --------- | ----------------------------------------------------------------------- |
| Frontend  | React 18 + Vite                                                         |
| Backend   | Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions)      |
| Push      | Web Push API + VAPID                                                    |
| AI        | Edge Function `relationship-keeper` (Claude / OpenAI)                  |
| Deploy    | Vercel / Netlify                                                        |

---

## Быстрый старт

```bash
npm install
cp .env.example .env   # заполни переменные
npm run dev
```

---

## Переменные окружения (.env)

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_VAPID_PUBLIC_KEY=BJ...
```

> Секреты `SUPABASE_SERVICE_ROLE_KEY`, `AI_API_KEY`, `VAPID_PRIVATE_KEY` — только в Supabase → Edge Functions → Secrets.

---

## Supabase: настройка

### 1. SQL-миграции (в порядке даты)

```
supabase/migrations/20260413_final_complete.sql              — Таблицы + RLS
supabase/migrations/20260417_production_hardening.sql        — couples, индексы, RPCs
supabase/migrations/20260420_e2ee_schema.sql                 — E2EE поля (public_key, ciphertext, enc_meta)
```

### 2. Storage

Dashboard → Storage → New Bucket: `photos`, Public: ✓

### 3. Edge Functions

```bash
supabase functions deploy relationship-keeper
supabase functions deploy send-notification
supabase functions deploy process-time-capsules

supabase secrets set AI_API_KEY=sk-...
supabase secrets set AI_MODEL=grok-4.20-reasoning      # модель выбирает сервер, не клиент
supabase secrets set VAPID_PUBLIC_KEY=...
supabase secrets set VAPID_PRIVATE_KEY=...
supabase secrets set VAPID_SUBJECT=mailto:you@example.com
supabase secrets set CRON_SECRET=$(openssl rand -hex 32)  # см. supabase-cron-secret.sql
```

> Cron-функции (`daily-reminders`, `meeting-reminder`, `check-contracts`,
> `process-time-capsules`, cron-режим `relationship-keeper`) принимают вызов
> только с заголовком `x-cron-secret` = `CRON_SECRET` или с service_role ключом.
> AI-прокси (`relationship-keeper` с `messages`, `rewrite-message`) — только с JWT пользователя.

### 4. Расписание капсул времени (pg_cron)

```sql
SELECT cron.schedule('capsules', '0 * * * *', $$
    SELECT net.http_post(
        url := 'https://<ref>.supabase.co/functions/v1/process-time-capsules',
        headers := jsonb_build_object('x-cron-secret',
            (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'))
    )
$$);
```

### 5. VAPID-ключи

```bash
npx web-push generate-vapid-keys
# Публичный → VITE_VAPID_PUBLIC_KEY в .env
# Приватный → supabase secrets set VAPID_PRIVATE_KEY=...
```

### 6. Заполнить couple_id для старых записей

```sql
INSERT INTO couples (user_a, user_b)
SELECT LEAST(id, partner_id), GREATEST(id, partner_id)
FROM profiles WHERE partner_id IS NOT NULL AND id < partner_id
ON CONFLICT DO NOTHING;
```

---

## Команды

```bash
npm run dev        # dev-сервер
npm run build      # сборка
npm run preview    # предпросмотр
npm run lint       # ESLint
```

---

## Производительность

- **Lazy loading**: все вкладки кроме Home загружаются через `React.lazy()` + `Suspense` — первый экран быстрее.
- **Сжатие изображений**: перед загрузкой фото сжимается до 1600px / 85% (полное) и 320px / 75% (thumbnail). Thumbnail загружается в списках, полное фото — только по тапу.
- **Object URL**: все `blob:` URL ревокируются через `URL.revokeObjectURL()` при закрытии превью или смене файла — нет утечек памяти.
- **Узкие запросы**: все SELECT явно перечисляют нужные колонки вместо `*` — меньше трафика и сериализации.
- **Индекс**: `messages_created_at_idx` (DESC) ускоряет курсорную пагинацию чата.

---

## Шифрование (E2EE)

### Схема

```
ECDH P-256  →  HKDF-SHA-256  →  AES-GCM-256
```

Используется исключительно **Web Crypto API** (SubtleCrypto) — нулевые внешние зависимости, доступен в любом современном браузере.

### Ключевые файлы

| Файл                    | Назначение                                                    |
| ----------------------- | ------------------------------------------------------------- |
| `src/lib/crypto.js`     | Все крипто-примитивы (генерация, деривация, шифрование)       |
| `src/lib/mediaUtils.js` | Сжатие изображений + зашифрованная загрузка в Storage         |
| `src/hooks/useCrypto.js`| React-хук жизненного цикла ключей                             |

### Жизненный цикл ключей

1. При первом запуске генерируется пара ключей ECDH P-256 (`generateIdentityKeys`).
2. Публичный ключ (JWK) сохраняется в `profiles.public_key` на сервере.
3. **Приватный ключ никогда не покидает устройство** — хранится в `localStorage` как JWK (Phase 1).
4. Когда партнёр тоже инициализировал E2EE, `useCrypto` получает его публичный ключ и вычисляет `roomKey` через ECDH → HKDF.
5. `roomKey` — non-extractable `CryptoKey`, существует только в JS-heap.

### Формат зашифрованного сообщения

```json
{ "v": 1, "alg": "AESGCM256", "iv": "<base64>", "ct": "<base64>" }
```

Хранится в колонке `messages.ciphertext`. Колонка `text` при этом `NULL` (DB constraint гарантирует взаимоисключение).

### Шифрование фото

1. Генерируется одноразовый `fileKey` (AES-GCM-256).
2. Файл шифруется `fileKey`.
3. `fileKey` экспортируется и оборачивается `roomKey` → сохраняется в `photo_enc_meta.file_key_enc`.
4. Thumbnail шифруется отдельно с собственным IV.

---

## Модель угроз

### Что видит сервер (Supabase)

- Метаданные: `user_id`, `partner_id`, `created_at`, размер файла, количество сообщений.
- Зашифрованный blob (`ciphertext`, зашифрованные байты в Storage).
- Публичные ключи пользователей.

### Чего сервер **не видит**

- Текст зашифрованных сообщений.
- Содержимое зашифрованных фото.
- Приватные ключи (хранятся только в `localStorage` клиента).

### Угрозы, которые E2EE **не закрывает**

| Угроза                               | Статус                                                        |
| ------------------------------------ | ------------------------------------------------------------- |
| Компрометация устройства             | Вне модели — злоумышленник с доступом к браузеру читает всё   |
| Замена публичного ключа на сервере   | Возможна при взломе Supabase; TOFU-верификация не реализована |
| Plaintext-сообщения (до E2EE)        | Остаются на сервере в открытом виде                           |
| Метаданные                           | Не скрыты (кто, когда, сколько)                               |

---

## Совместимость (backward compat)

| Версия данных         | Поведение                                                      |
| --------------------- | -------------------------------------------------------------- |
| `is_encrypted=false`  | Показывается как обычный текст                                 |
| `is_encrypted=true`, нет `roomKey` | Сообщение скрыто до инициализации ключей    |
| Ошибка дешифрования   | Показывается «🔒 Не удалось расшифровать сообщение»           |
| Партнёр без E2EE      | Чат работает в plaintext-режиме (roomKey = null)               |

---

## Push и AI под E2EE

- **Push**: тело уведомления всегда «Новое сообщение» — plaintext-контент никогда не передаётся в FCM/APNs.
- **AI-советник**: Edge Function `relationship-keeper` **не имеет доступа** к зашифрованным сообщениям. Под E2EE AI работает только с публичным контекстом (статистика, настройки пары).

---

## Таблицы

`profiles`, `couples`, `messages`, `moments`, `plans`, `calendar_events`,
`couple_settings`, `love_letters`, `contracts`, `private_journal`, `sync_mirror`,
`time_capsules`, `warmth_metrics`, `ai_advisor_settings`, `typing_status`,
`push_subscriptions`, `subscriptions`, `payment_events`

### E2EE колонки (миграция 20260420)

| Таблица           | Новые колонки                                                        |
| ----------------- | -------------------------------------------------------------------- |
| `profiles`        | `public_key TEXT`, `encryption_version INT`                          |
| `messages`        | `is_encrypted BOOL`, `ciphertext TEXT`, `thumb_url TEXT`, `photo_enc_meta JSONB` |
| `moments`         | `thumb_url TEXT`, `is_encrypted BOOL`, `photo_enc_meta JSONB`, `thumb_enc_meta JSONB` |
| `calendar_events` | `thumb_url TEXT`, `is_encrypted BOOL`, `photo_enc_meta JSONB`        |

---

## Безопасность

- RLS на всех таблицах.
- `private_journal` — строго только владелец.
- `connect_partner_by_invite(code)` — атомарный RPC, нельзя подключить чужую пару.
- `sign_contract(id)` — только `partner_id` может подписать свой контракт.
- DB constraint `messages_text_xor_cipher` — запрещает одновременно `text IS NOT NULL AND ciphertext IS NOT NULL`.

---

## Известные ограничения

1. Капсулы времени требуют `pg_cron` для автодоставки.
2. Push в iOS Safari только в PWA (Add to Home Screen).
3. `couple_id` добавлен как nullable — старые записи нужно мигрировать вручную (см. п. 6 выше).
4. AI-функции требуют работающей Edge Function с `AI_API_KEY`.
5. **Phase 1**: приватный ключ хранится как raw JWK в `localStorage`. При очистке хранилища ключ теряется — история станет нечитаемой.

---

## Роадмап Phase 2

- [ ] Обернуть приватный ключ PBKDF2-ключом из PIN/пароля (защита при утечке localStorage).
- [ ] TOFU-верификация публичного ключа партнёра (fingerprint comparison).
- [ ] Зашифрованная загрузка фото в Moments и Calendar (UI уже готов, `mediaUtils.processAndUpload` реализован).
- [ ] Key rotation при смене устройства.
- [ ] Экспорт/импорт ключевого материала между устройствами (QR-код или passphrase backup).
