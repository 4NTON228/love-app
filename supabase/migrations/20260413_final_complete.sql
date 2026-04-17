-- ================================================================
-- LOVE APP — ПОЛНЫЙ ФИНАЛЬНЫЙ SQL
-- Запускать ТОЛЬКО этот файл, все старые миграции заменяются
-- ================================================================

-- ================================================================
-- 1. ТАБЛИЦЫ
-- ================================================================

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT,                          -- nullable! заполняется при онбординге
  avatar_url      TEXT,
  partner_id      UUID REFERENCES auth.users(id),
  couple_start_date DATE,
  invite_code     TEXT UNIQUE,
  onboarding_done BOOLEAN DEFAULT FALSE,
  last_seen       TIMESTAMPTZ DEFAULT NOW(),
  birthday        DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Добавляем колонки если таблица уже существует
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invite_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS couple_start_date DATE;

-- Снимаем NOT NULL с name (главная причина падения регистрации)
ALTER TABLE profiles ALTER COLUMN name DROP NOT NULL;

-- Уникальный индекс на invite_code
CREATE UNIQUE INDEX IF NOT EXISTS profiles_invite_code_idx ON profiles(invite_code) WHERE invite_code IS NOT NULL;

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text            TEXT,
  photo_url       TEXT,
  video_url       TEXT,
  audio_url       TEXT,
  is_video_circle BOOLEAN DEFAULT FALSE,
  is_voice        BOOLEAN DEFAULT FALSE,
  duration        INTEGER,
  reply_to_id     UUID REFERENCES messages(id) ON DELETE SET NULL,
  edited_at       TIMESTAMPTZ,
  reactions       JSONB DEFAULT '{}',
  is_pinned       BOOLEAN DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_voice BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS duration INTEGER;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_video_circle BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- MOMENTS
CREATE TABLE IF NOT EXISTS moments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  photo_url   TEXT,
  mood        TEXT DEFAULT 'love',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- PLANS
CREATE TABLE IF NOT EXISTS plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  completed   BOOLEAN DEFAULT FALSE,
  category    TEXT DEFAULT 'dream',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- CALENDAR_EVENTS
CREATE TABLE IF NOT EXISTS calendar_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  event_date  DATE NOT NULL,
  photo_url   TEXT,
  emoji       TEXT DEFAULT '❤️',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- COUPLE_SETTINGS
CREATE TABLE IF NOT EXISTS couple_settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  love_message TEXT DEFAULT 'Я тебя люблю ❤️',
  next_meeting TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- TYPING_STATUS
CREATE TABLE IF NOT EXISTS typing_status (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_typing  BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PUSH_SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Уникальный индекс на user_id (один девайс = одна подписка)
DELETE FROM push_subscriptions
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM push_subscriptions
  ORDER BY user_id, created_at DESC
);
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON push_subscriptions(user_id);

-- SYNC_MIRROR
CREATE TABLE IF NOT EXISTS sync_mirror (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id          UUID NOT NULL,
  question            TEXT NOT NULL,
  answer              TEXT,
  answered_at         TIMESTAMPTZ,
  partner_answer      TEXT,
  partner_answered_at TIMESTAMPTZ,
  is_matched          BOOLEAN NOT NULL DEFAULT false,
  spark_earned        BOOLEAN NOT NULL DEFAULT false,
  mirror_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, partner_id, mirror_date)
);
CREATE INDEX IF NOT EXISTS idx_sync_mirror_user ON sync_mirror(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_mirror_partner ON sync_mirror(partner_id, created_at DESC);

-- TIME_CAPSULES
CREATE TABLE IF NOT EXISTS time_capsules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id   UUID NOT NULL,
  message      TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('date','days','fight')),
  trigger_date TIMESTAMPTZ,
  trigger_days INTEGER,
  is_sent      BOOLEAN NOT NULL DEFAULT false,
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_time_capsules_pending
  ON time_capsules(is_sent, trigger_type, trigger_date) WHERE is_sent = false;

-- WARMTH_METRICS
CREATE TABLE IF NOT EXISTS warmth_metrics (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id       UUID NOT NULL,
  date             DATE NOT NULL DEFAULT CURRENT_DATE,
  warmth_index     NUMERIC(4,3) NOT NULL DEFAULT 0.500,
  avg_response_time INTEGER NOT NULL DEFAULT 0,
  avg_length       INTEGER NOT NULL DEFAULT 0,
  emoji_density    NUMERIC(4,3) NOT NULL DEFAULT 0.000,
  we_ratio         NUMERIC(4,3) NOT NULL DEFAULT 0.000,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_warmth_metrics_user ON warmth_metrics(user_id, date DESC);

-- AI_ADVISOR_SETTINGS
CREATE TABLE IF NOT EXISTS ai_advisor_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  proactivity         INTEGER NOT NULL DEFAULT 70 CHECK (proactivity BETWEEN 0 AND 100),
  quiet_day           INTEGER NOT NULL DEFAULT 0 CHECK (quiet_day BETWEEN -1 AND 6),
  dialog_ignored      INTEGER NOT NULL DEFAULT 0,
  mirror_ignored      INTEGER NOT NULL DEFAULT 0,
  capsule_ignored     INTEGER NOT NULL DEFAULT 0,
  dialog_muted_until  TIMESTAMPTZ,
  mirror_muted_until  TIMESTAMPTZ,
  capsule_muted_until TIMESTAMPTZ,
  last_advice_at      TIMESTAMPTZ,
  sync_streak         INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status               TEXT NOT NULL DEFAULT 'inactive',
  plan                 TEXT NOT NULL DEFAULT 'premium',
  price_rub            INTEGER NOT NULL DEFAULT 299,
  started_at           TIMESTAMPTZ,
  expires_at           TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,
  yk_payment_id        TEXT,
  yk_payment_method_id TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions(user_id);

-- PAYMENT_EVENTS
CREATE TABLE IF NOT EXISTS payment_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  yk_payment_id   TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  amount_rub      INTEGER,
  raw             JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- STORAGE
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "upload_photos" ON storage.objects;
DROP POLICY IF EXISTS "view_photos" ON storage.objects;
CREATE POLICY "upload_photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'photos' AND auth.role() = 'authenticated');
CREATE POLICY "view_photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');

-- ================================================================
-- 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
-- ================================================================

-- Возвращает partner_id текущего пользователя
CREATE OR REPLACE FUNCTION get_partner_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT partner_id FROM profiles WHERE id = auth.uid()
$$;

-- Поиск профиля по инвайт-коду (минуя RLS — нужен при связывании пары)
CREATE OR REPLACE FUNCTION find_profile_by_invite_code(code text)
RETURNS TABLE (id uuid, name text, avatar_url text)
LANGUAGE sql SECURITY DEFINER
SET search_path = public AS $$
  SELECT id, name, avatar_url
  FROM profiles
  WHERE invite_code = lower(trim(code))
  LIMIT 1;
$$;

-- Полное удаление аккаунта
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE profiles SET partner_id = NULL WHERE partner_id = uid;
  DELETE FROM push_subscriptions  WHERE user_id = uid;
  DELETE FROM typing_status       WHERE user_id = uid;
  DELETE FROM messages            WHERE user_id = uid;
  DELETE FROM moments             WHERE user_id = uid;
  DELETE FROM plans               WHERE user_id = uid;
  DELETE FROM calendar_events     WHERE user_id = uid;
  DELETE FROM couple_settings     WHERE user_id = uid;
  DELETE FROM ai_advisor_settings WHERE user_id = uid;
  DELETE FROM sync_mirror         WHERE user_id = uid OR partner_id = uid;
  DELETE FROM time_capsules       WHERE user_id = uid OR partner_id = uid;
  DELETE FROM warmth_metrics      WHERE user_id = uid OR partner_id = uid;
  DELETE FROM subscriptions       WHERE user_id = uid;
  DELETE FROM payment_events      WHERE user_id = uid;
  DELETE FROM profiles            WHERE id = uid;
  DELETE FROM auth.users          WHERE id = uid;
END;
$$;

-- Авто-создание профиля при регистрации
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, onboarding_done)
  VALUES (NEW.id, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ================================================================
-- 3. RLS — сброс ВСЕХ старых политик и создание новых
-- ================================================================

-- Макрос: сбросить все политики таблицы
DO $$ DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles','messages','moments','plans','calendar_events',
        'couple_settings','typing_status','push_subscriptions',
        'sync_mirror','time_capsules','warmth_metrics',
        'ai_advisor_settings','subscriptions','payment_events'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- PROFILES
-- Видит только свой профиль + профиль партнёра
-- НЕТ "invite_code IS NOT NULL" — это была дыра
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "p_sel" ON profiles FOR SELECT
  USING (id = auth.uid() OR id = get_partner_id());
CREATE POLICY "p_ins" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());
CREATE POLICY "p_upd" ON profiles FOR UPDATE
  USING (id = auth.uid());
CREATE POLICY "p_del" ON profiles FOR DELETE
  USING (id = auth.uid());

-- MESSAGES — только своей пары
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "m_sel" ON messages FOR SELECT
  USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "m_ins" ON messages FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "m_upd" ON messages FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "m_del" ON messages FOR DELETE
  USING (user_id = auth.uid());

-- MOMENTS — только своей пары
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mo_sel" ON moments FOR SELECT
  USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "mo_ins" ON moments FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "mo_upd" ON moments FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "mo_del" ON moments FOR DELETE
  USING (user_id = auth.uid());

-- PLANS — только своей пары
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pl_sel" ON plans FOR SELECT
  USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "pl_ins" ON plans FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "pl_upd" ON plans FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "pl_del" ON plans FOR DELETE
  USING (user_id = auth.uid());

-- CALENDAR_EVENTS — только своей пары
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ce_sel" ON calendar_events FOR SELECT
  USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "ce_ins" ON calendar_events FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "ce_upd" ON calendar_events FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "ce_del" ON calendar_events FOR DELETE
  USING (user_id = auth.uid());

-- COUPLE_SETTINGS — только своей пары
ALTER TABLE couple_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_sel" ON couple_settings FOR SELECT
  USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "cs_ins" ON couple_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "cs_upd" ON couple_settings FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "cs_del" ON couple_settings FOR DELETE
  USING (user_id = auth.uid());

-- TYPING_STATUS — только своей пары
-- НЕТ "FOR SELECT USING (true)" — это была дыра
ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ts_sel" ON typing_status FOR SELECT
  USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "ts_ins" ON typing_status FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "ts_upd" ON typing_status FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "ts_del" ON typing_status FOR DELETE
  USING (user_id = auth.uid());

-- PUSH_SUBSCRIPTIONS — только свои (партнёру не нужно видеть)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_all" ON push_subscriptions FOR ALL
  USING (user_id = auth.uid());

-- SYNC_MIRROR
ALTER TABLE sync_mirror ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sm_sel" ON sync_mirror FOR SELECT
  USING (user_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "sm_ins" ON sync_mirror FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "sm_upd" ON sync_mirror FOR UPDATE
  USING (user_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "sm_del" ON sync_mirror FOR DELETE
  USING (user_id = auth.uid());

-- TIME_CAPSULES
ALTER TABLE time_capsules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tc_sel" ON time_capsules FOR SELECT
  USING (user_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "tc_ins" ON time_capsules FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "tc_upd" ON time_capsules FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "tc_del" ON time_capsules FOR DELETE
  USING (user_id = auth.uid());

-- WARMTH_METRICS
ALTER TABLE warmth_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wm_sel" ON warmth_metrics FOR SELECT
  USING (user_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "wm_ins" ON warmth_metrics FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "wm_upd" ON warmth_metrics FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "wm_del" ON warmth_metrics FOR DELETE
  USING (user_id = auth.uid());

-- AI_ADVISOR_SETTINGS — только свои
ALTER TABLE ai_advisor_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aa_all" ON ai_advisor_settings FOR ALL
  USING (user_id = auth.uid());

-- SUBSCRIPTIONS — только свои
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub_own" ON subscriptions FOR ALL
  USING (user_id = auth.uid());
-- Edge Functions работают через service_role (RLS для них не применяется)

-- PAYMENT_EVENTS — только свои
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pe_own" ON payment_events FOR ALL
  USING (user_id = auth.uid());

-- Необязательная таблица love_letters
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='love_letters') THEN
    EXECUTE 'ALTER TABLE love_letters ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS ll_sel ON love_letters';
    EXECUTE 'DROP POLICY IF EXISTS ll_ins ON love_letters';
    EXECUTE 'DROP POLICY IF EXISTS ll_upd ON love_letters';
    EXECUTE 'DROP POLICY IF EXISTS ll_del ON love_letters';
    EXECUTE 'CREATE POLICY ll_sel ON love_letters FOR SELECT USING (user_id = auth.uid() OR user_id = get_partner_id())';
    EXECUTE 'CREATE POLICY ll_ins ON love_letters FOR INSERT WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY ll_upd ON love_letters FOR UPDATE USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY ll_del ON love_letters FOR DELETE USING (user_id = auth.uid())';
  END IF;
END $$;

-- Необязательная таблица private_journal
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='private_journal') THEN
    EXECUTE 'ALTER TABLE private_journal ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS pj_all ON private_journal';
    EXECUTE 'CREATE POLICY pj_all ON private_journal FOR ALL USING (user_id = auth.uid())';
  END IF;
END $$;

-- ================================================================
-- 4. ПРОВЕРКА
-- ================================================================
SELECT tablename, rowsecurity AS rls
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
