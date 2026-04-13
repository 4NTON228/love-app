-- ================================================================
-- ПОЛНАЯ ЗАЩИТА ДАННЫХ — запустить в Supabase SQL Editor
-- Версия: финальная. Заменяет все предыдущие RLS-миграции.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
-- ----------------------------------------------------------------

-- Возвращает partner_id текущего пользователя (используется внутри политик)
CREATE OR REPLACE FUNCTION get_partner_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
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

-- Полное удаление аккаунта (клиент не может удалить auth.users напрямую)
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Отвязываем партнёра
  UPDATE profiles SET partner_id = NULL WHERE partner_id = uid;

  -- Удаляем все данные пользователя
  DELETE FROM push_subscriptions  WHERE user_id = uid;
  DELETE FROM typing_status       WHERE user_id = uid;
  DELETE FROM messages            WHERE user_id = uid;
  DELETE FROM moments             WHERE user_id = uid;
  DELETE FROM plans               WHERE user_id = uid;
  DELETE FROM calendar_events     WHERE user_id = uid;
  DELETE FROM love_letters        WHERE user_id = uid;
  DELETE FROM couple_settings     WHERE user_id = uid;
  DELETE FROM private_journal     WHERE user_id = uid;
  DELETE FROM ai_advisor_settings WHERE user_id = uid;
  DELETE FROM sync_mirror         WHERE user_id = uid OR partner_id = uid;
  DELETE FROM time_capsules       WHERE user_id = uid OR partner_id = uid;
  DELETE FROM warmth_metrics      WHERE user_id = uid OR partner_id = uid;
  DELETE FROM contracts           WHERE creator_id = uid OR partner_id = uid;
  DELETE FROM subscriptions       WHERE user_id = uid;
  DELETE FROM payment_events      WHERE user_id = uid;
  DELETE FROM profiles            WHERE id = uid;

  -- Удаляем auth-пользователя
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- ----------------------------------------------------------------
-- 2. АВТО-СОЗДАНИЕ ПРОФИЛЯ ПРИ РЕГИСТРАЦИИ
-- ----------------------------------------------------------------
-- Гарантирует что каждый новый пользователь (email / Google / VK)
-- сразу получает запись в profiles с partner_id = NULL

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
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

-- ----------------------------------------------------------------
-- 3. ВСПОМОГАТЕЛЬНЫЙ МАКРОС: сбрасываем ВСЕ политики таблицы
-- ----------------------------------------------------------------
-- Используем DO-блок перед каждой таблицей чтобы не было конфликтов

-- ================================================================
-- 4. RLS-ПОЛИТИКИ ДЛЯ КАЖДОЙ ТАБЛИЦЫ
-- ================================================================

-- ── PROFILES ──────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', r.policyname); END LOOP;
END $$;
-- Пользователь видит только свой профиль и профиль партнёра
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (id = auth.uid() OR id = get_partner_id());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid());
CREATE POLICY "profiles_delete" ON profiles FOR DELETE
  USING (id = auth.uid());

-- ── MESSAGES ──────────────────────────────────────────────────
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='messages'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON messages', r.policyname); END LOOP;
END $$;
-- Видит только сообщения своей пары (свои + партнёра)
CREATE POLICY "messages_select" ON messages FOR SELECT
  USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "messages_insert" ON messages FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "messages_update" ON messages FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "messages_delete" ON messages FOR DELETE
  USING (user_id = auth.uid());

-- ── MOMENTS ───────────────────────────────────────────────────
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='moments'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON moments', r.policyname); END LOOP;
END $$;
CREATE POLICY "moments_select" ON moments FOR SELECT
  USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "moments_insert" ON moments FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "moments_update" ON moments FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "moments_delete" ON moments FOR DELETE
  USING (user_id = auth.uid());

-- ── PLANS ─────────────────────────────────────────────────────
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='plans'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON plans', r.policyname); END LOOP;
END $$;
CREATE POLICY "plans_select" ON plans FOR SELECT
  USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "plans_insert" ON plans FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "plans_update" ON plans FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "plans_delete" ON plans FOR DELETE
  USING (user_id = auth.uid());

-- ── CALENDAR_EVENTS ───────────────────────────────────────────
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='calendar_events'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON calendar_events', r.policyname); END LOOP;
END $$;
CREATE POLICY "calendar_events_select" ON calendar_events FOR SELECT
  USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "calendar_events_insert" ON calendar_events FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "calendar_events_update" ON calendar_events FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "calendar_events_delete" ON calendar_events FOR DELETE
  USING (user_id = auth.uid());

-- ── LOVE_LETTERS ──────────────────────────────────────────────
ALTER TABLE love_letters ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='love_letters'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON love_letters', r.policyname); END LOOP;
END $$;
CREATE POLICY "love_letters_select" ON love_letters FOR SELECT
  USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "love_letters_insert" ON love_letters FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "love_letters_update" ON love_letters FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "love_letters_delete" ON love_letters FOR DELETE
  USING (user_id = auth.uid());

-- ── COUPLE_SETTINGS ───────────────────────────────────────────
ALTER TABLE couple_settings ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='couple_settings'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON couple_settings', r.policyname); END LOOP;
END $$;
CREATE POLICY "couple_settings_select" ON couple_settings FOR SELECT
  USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "couple_settings_insert" ON couple_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "couple_settings_update" ON couple_settings FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "couple_settings_delete" ON couple_settings FOR DELETE
  USING (user_id = auth.uid());

-- ── TYPING_STATUS ─────────────────────────────────────────────
ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='typing_status'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON typing_status', r.policyname); END LOOP;
END $$;
CREATE POLICY "typing_status_select" ON typing_status FOR SELECT
  USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "typing_status_insert" ON typing_status FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "typing_status_update" ON typing_status FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "typing_status_delete" ON typing_status FOR DELETE
  USING (user_id = auth.uid());

-- ── PUSH_SUBSCRIPTIONS ────────────────────────────────────────
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='push_subscriptions'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON push_subscriptions', r.policyname); END LOOP;
END $$;
-- Push-подписки видит только сам пользователь (партнёру не нужно)
CREATE POLICY "push_subscriptions_all" ON push_subscriptions FOR ALL
  USING (user_id = auth.uid());

-- ── PRIVATE_JOURNAL ───────────────────────────────────────────
ALTER TABLE private_journal ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='private_journal'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON private_journal', r.policyname); END LOOP;
END $$;
-- ТОЛЬКО свои записи — партнёр не видит никогда
CREATE POLICY "private_journal_all" ON private_journal FOR ALL
  USING (user_id = auth.uid());

-- ── AI_ADVISOR_SETTINGS ───────────────────────────────────────
ALTER TABLE ai_advisor_settings ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='ai_advisor_settings'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON ai_advisor_settings', r.policyname); END LOOP;
END $$;
CREATE POLICY "ai_advisor_settings_all" ON ai_advisor_settings FOR ALL
  USING (user_id = auth.uid());

-- ── SYNC_MIRROR ───────────────────────────────────────────────
ALTER TABLE sync_mirror ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='sync_mirror'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON sync_mirror', r.policyname); END LOOP;
END $$;
CREATE POLICY "sync_mirror_select" ON sync_mirror FOR SELECT
  USING (user_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "sync_mirror_insert" ON sync_mirror FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "sync_mirror_update" ON sync_mirror FOR UPDATE
  USING (user_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "sync_mirror_delete" ON sync_mirror FOR DELETE
  USING (user_id = auth.uid());

-- ── TIME_CAPSULES ─────────────────────────────────────────────
ALTER TABLE time_capsules ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='time_capsules'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON time_capsules', r.policyname); END LOOP;
END $$;
CREATE POLICY "time_capsules_select" ON time_capsules FOR SELECT
  USING (user_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "time_capsules_insert" ON time_capsules FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "time_capsules_update" ON time_capsules FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "time_capsules_delete" ON time_capsules FOR DELETE
  USING (user_id = auth.uid());

-- ── WARMTH_METRICS ────────────────────────────────────────────
ALTER TABLE warmth_metrics ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='warmth_metrics'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON warmth_metrics', r.policyname); END LOOP;
END $$;
CREATE POLICY "warmth_metrics_select" ON warmth_metrics FOR SELECT
  USING (user_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "warmth_metrics_insert" ON warmth_metrics FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "warmth_metrics_update" ON warmth_metrics FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "warmth_metrics_delete" ON warmth_metrics FOR DELETE
  USING (user_id = auth.uid());

-- ── CONTRACTS ─────────────────────────────────────────────────
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='contracts'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON contracts', r.policyname); END LOOP;
END $$;
CREATE POLICY "contracts_select" ON contracts FOR SELECT
  USING (creator_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "contracts_insert" ON contracts FOR INSERT
  WITH CHECK (creator_id = auth.uid());
CREATE POLICY "contracts_update" ON contracts FOR UPDATE
  USING (creator_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "contracts_delete" ON contracts FOR DELETE
  USING (creator_id = auth.uid());

-- ── SUBSCRIPTIONS ─────────────────────────────────────────────
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='subscriptions'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON subscriptions', r.policyname); END LOOP;
END $$;
CREATE POLICY "subscriptions_all" ON subscriptions FOR ALL
  USING (user_id = auth.uid());

-- ── PAYMENT_EVENTS ────────────────────────────────────────────
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='payment_events'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON payment_events', r.policyname); END LOOP;
END $$;
CREATE POLICY "payment_events_all" ON payment_events FOR ALL
  USING (user_id = auth.uid());

-- ================================================================
-- 5. ПРОВЕРКА — должны видеть rowsecurity=true у ВСЕХ таблиц
-- ================================================================
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ================================================================
-- 6. ПРОВЕРКА ИЗОЛЯЦИИ (выполни от имени пользователя)
-- Должно вернуть ТОЛЬКО данные твоего аккаунта + партнёра:
-- ================================================================
-- SELECT count(*) FROM messages;      -- только твои + партнёра
-- SELECT count(*) FROM moments;       -- только твои + партнёра
-- SELECT count(*) FROM calendar_events; -- только твои + партнёра
-- SELECT count(*) FROM plans;         -- только твои + партнёра
-- SELECT count(*) FROM love_letters;  -- только твои + партнёра
