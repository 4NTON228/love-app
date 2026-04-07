-- ══════════════════════════════════════════════════════════════
-- ИИ-советчик: таблицы, индексы и RLS-политики
-- ══════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────
-- 1. Игра Зеркало (sync_mirror)
--    Одна запись на пару в день. user_id — кто создал запись,
--    partner_id — второй участник. Ответы хранятся в одной строке.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sync_mirror (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id      UUID         NOT NULL,
  question        TEXT         NOT NULL,
  -- ответ того, кто user_id
  answer          TEXT,
  answered_at     TIMESTAMPTZ,
  -- ответ того, кто partner_id
  partner_answer  TEXT,
  partner_answered_at TIMESTAMPTZ,
  -- совпали ли ответы (проставляет edge function или клиент)
  is_matched      BOOLEAN      NOT NULL DEFAULT false,
  -- начислено ли «искру» за синхронизацию
  spark_earned    BOOLEAN      NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- одна запись на пару в день
  UNIQUE (user_id, partner_id, (created_at::date))
);

CREATE INDEX IF NOT EXISTS idx_sync_mirror_user_date
  ON public.sync_mirror(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_mirror_partner_date
  ON public.sync_mirror(partner_id, created_at DESC);

ALTER TABLE public.sync_mirror ENABLE ROW LEVEL SECURITY;

-- Каждый видит строки, где он является user_id или partner_id
CREATE POLICY "sync_mirror_select" ON public.sync_mirror
  FOR SELECT USING (
    auth.uid() = user_id OR auth.uid() = partner_id
  );

CREATE POLICY "sync_mirror_insert" ON public.sync_mirror
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Оба партнёра могут записать свой ответ
CREATE POLICY "sync_mirror_update" ON public.sync_mirror
  FOR UPDATE USING (
    auth.uid() = user_id OR auth.uid() = partner_id
  );

-- ──────────────────────────────────────────────────────────────
-- 2. Капсулы времени (time_capsules)
--    Письма с отложенной отправкой; триггер: дата, дни или ссора.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.time_capsules (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id    UUID         NOT NULL,
  message       TEXT         NOT NULL,
  -- тип триггера: конкретная дата / через N дней / при ссоре
  trigger_type  TEXT         NOT NULL CHECK (trigger_type IN ('date', 'days', 'fight')),
  trigger_date  TIMESTAMPTZ,            -- для типа 'date'
  trigger_days  INTEGER,                -- для типа 'days'
  is_sent       BOOLEAN      NOT NULL DEFAULT false,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_capsules_pending
  ON public.time_capsules(is_sent, trigger_type, trigger_date)
  WHERE is_sent = false;

ALTER TABLE public.time_capsules ENABLE ROW LEVEL SECURITY;

-- Автор видит все свои капсулы; партнёр видит только отправленные
CREATE POLICY "time_capsules_author" ON public.time_capsules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "time_capsules_partner_sent" ON public.time_capsules
  FOR SELECT USING (
    auth.uid() = partner_id AND is_sent = true
  );

CREATE POLICY "time_capsules_insert" ON public.time_capsules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "time_capsules_update" ON public.time_capsules
  FOR UPDATE USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 3. Метрики теплоты (warmth_metrics)
--    Рассчитываются edge function раз в 6 часов по последним
--    20 сообщениям пары. Одна строка на пользователя в день.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.warmth_metrics (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id        UUID          NOT NULL,
  date              DATE          NOT NULL DEFAULT CURRENT_DATE,
  -- итоговый индекс теплоты 0.0 (холодно) … 1.0 (горячо)
  warmth_index      NUMERIC(4,3)  NOT NULL DEFAULT 0.500,
  -- среднее время ответа пользователя (секунды)
  avg_response_time INTEGER       NOT NULL DEFAULT 0,
  -- средняя длина сообщений (символы)
  avg_length        INTEGER       NOT NULL DEFAULT 0,
  -- доля сообщений, содержащих эмодзи
  emoji_density     NUMERIC(4,3)  NOT NULL DEFAULT 0.000,
  -- доля сообщений со словами «мы / нас / нам / наш»
  we_ratio          NUMERIC(4,3)  NOT NULL DEFAULT 0.000,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_warmth_metrics_user_date
  ON public.warmth_metrics(user_id, date DESC);

ALTER TABLE public.warmth_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warmth_metrics_select" ON public.warmth_metrics
  FOR SELECT USING (
    auth.uid() = user_id OR auth.uid() = partner_id
  );

CREATE POLICY "warmth_metrics_insert" ON public.warmth_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "warmth_metrics_update" ON public.warmth_metrics
  FOR UPDATE USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 4. Настройки ИИ-советчика (ai_advisor_settings)
--    Проактивность, тихий день, счётчики игнорирования.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_advisor_settings (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID         NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- ползунок проактивности 0–100
  proactivity           INTEGER      NOT NULL DEFAULT 70
                                     CHECK (proactivity BETWEEN 0 AND 100),
  -- день недели без советов: 0=вс, 1=пн … 6=сб; -1 = отключено
  quiet_day             INTEGER      NOT NULL DEFAULT 0
                                     CHECK (quiet_day BETWEEN -1 AND 6),
  -- счётчики игнорирований по типам (сбрасываются при нажатии)
  dialog_ignored        INTEGER      NOT NULL DEFAULT 0,
  mirror_ignored        INTEGER      NOT NULL DEFAULT 0,
  capsule_ignored       INTEGER      NOT NULL DEFAULT 0,
  -- до каких пор тип советов заглушён
  dialog_muted_until    TIMESTAMPTZ,
  mirror_muted_until    TIMESTAMPTZ,
  capsule_muted_until   TIMESTAMPTZ,
  -- метка последнего показанного совета (не чаще 1 в день)
  last_advice_at        TIMESTAMPTZ,
  -- серия дней подряд с синхронностью Зеркала
  sync_streak           INTEGER      NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_advisor_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_settings_self" ON public.ai_advisor_settings
  FOR ALL USING (auth.uid() = user_id);
