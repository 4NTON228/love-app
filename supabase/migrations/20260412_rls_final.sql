-- ================================================================
-- ФИНАЛЬНАЯ МИГРАЦИЯ БЕЗОПАСНОСТИ
-- Включает RLS на ВСЕХ таблицах + удаление аккаунта
-- ================================================================

-- Helper функции
CREATE OR REPLACE FUNCTION get_partner_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT partner_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION find_profile_by_invite_code(code text)
RETURNS TABLE (id uuid, name text, avatar_url text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, avatar_url FROM profiles
  WHERE invite_code = lower(trim(code)) LIMIT 1;
$$;

-- Функция полного удаления аккаунта (вызывается клиентом)
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  -- Удаляем auth пользователя
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- ================================================================
-- Макрос: удаляем ВСЕ политики таблицы и включаем RLS
-- ================================================================

-- PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', r.policyname); END LOOP;
END $$;
CREATE POLICY "p_sel" ON profiles FOR SELECT USING (id = auth.uid() OR id = get_partner_id());
CREATE POLICY "p_ins" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "p_upd" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "p_del" ON profiles FOR DELETE USING (id = auth.uid());

-- MESSAGES
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='messages'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON messages', r.policyname); END LOOP;
END $$;
CREATE POLICY "m_sel" ON messages FOR SELECT USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "m_ins" ON messages FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "m_upd" ON messages FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "m_del" ON messages FOR DELETE USING (user_id = auth.uid());

-- MOMENTS
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='moments'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON moments', r.policyname); END LOOP;
END $$;
CREATE POLICY "mo_sel" ON moments FOR SELECT USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "mo_ins" ON moments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "mo_upd" ON moments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "mo_del" ON moments FOR DELETE USING (user_id = auth.uid());

-- PLANS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='plans'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON plans', r.policyname); END LOOP;
END $$;
CREATE POLICY "pl_sel" ON plans FOR SELECT USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "pl_ins" ON plans FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "pl_upd" ON plans FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "pl_del" ON plans FOR DELETE USING (user_id = auth.uid());

-- CALENDAR_EVENTS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='calendar_events'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON calendar_events', r.policyname); END LOOP;
END $$;
CREATE POLICY "ce_sel" ON calendar_events FOR SELECT USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "ce_ins" ON calendar_events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ce_upd" ON calendar_events FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "ce_del" ON calendar_events FOR DELETE USING (user_id = auth.uid());

-- LOVE_LETTERS
ALTER TABLE love_letters ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='love_letters'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON love_letters', r.policyname); END LOOP;
END $$;
CREATE POLICY "ll_sel" ON love_letters FOR SELECT USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "ll_ins" ON love_letters FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ll_upd" ON love_letters FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "ll_del" ON love_letters FOR DELETE USING (user_id = auth.uid());

-- COUPLE_SETTINGS (партнёр тоже должен видеть настройки)
ALTER TABLE couple_settings ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='couple_settings'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON couple_settings', r.policyname); END LOOP;
END $$;
CREATE POLICY "cs_sel" ON couple_settings FOR SELECT USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "cs_ins" ON couple_settings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "cs_upd" ON couple_settings FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "cs_del" ON couple_settings FOR DELETE USING (user_id = auth.uid());

-- TYPING_STATUS (статус печатания — видит только партнёр)
ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='typing_status'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON typing_status', r.policyname); END LOOP;
END $$;
CREATE POLICY "ts_sel" ON typing_status FOR SELECT USING (user_id = auth.uid() OR user_id = get_partner_id());
CREATE POLICY "ts_ins" ON typing_status FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ts_upd" ON typing_status FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "ts_del" ON typing_status FOR DELETE USING (user_id = auth.uid());

-- PUSH_SUBSCRIPTIONS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='push_subscriptions'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON push_subscriptions', r.policyname); END LOOP;
END $$;
CREATE POLICY "ps_sel" ON push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ps_ins" ON push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ps_upd" ON push_subscriptions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "ps_del" ON push_subscriptions FOR DELETE USING (user_id = auth.uid());

-- PRIVATE_JOURNAL (только свой)
ALTER TABLE private_journal ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='private_journal'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON private_journal', r.policyname); END LOOP;
END $$;
CREATE POLICY "pj_all" ON private_journal FOR ALL USING (user_id = auth.uid());

-- AI_ADVISOR_SETTINGS (только свои)
ALTER TABLE ai_advisor_settings ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='ai_advisor_settings'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON ai_advisor_settings', r.policyname); END LOOP;
END $$;
CREATE POLICY "aa_all" ON ai_advisor_settings FOR ALL USING (user_id = auth.uid());

-- SYNC_MIRROR
ALTER TABLE sync_mirror ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='sync_mirror'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON sync_mirror', r.policyname); END LOOP;
END $$;
CREATE POLICY "sm_sel" ON sync_mirror FOR SELECT USING (user_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "sm_ins" ON sync_mirror FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "sm_upd" ON sync_mirror FOR UPDATE USING (user_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "sm_del" ON sync_mirror FOR DELETE USING (user_id = auth.uid());

-- TIME_CAPSULES
ALTER TABLE time_capsules ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='time_capsules'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON time_capsules', r.policyname); END LOOP;
END $$;
CREATE POLICY "tc_sel" ON time_capsules FOR SELECT USING (user_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "tc_ins" ON time_capsules FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "tc_upd" ON time_capsules FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "tc_del" ON time_capsules FOR DELETE USING (user_id = auth.uid());

-- WARMTH_METRICS
ALTER TABLE warmth_metrics ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='warmth_metrics'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON warmth_metrics', r.policyname); END LOOP;
END $$;
CREATE POLICY "wm_sel" ON warmth_metrics FOR SELECT USING (user_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "wm_ins" ON warmth_metrics FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "wm_upd" ON warmth_metrics FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "wm_del" ON warmth_metrics FOR DELETE USING (user_id = auth.uid());

-- CONTRACTS
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='contracts'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON contracts', r.policyname); END LOOP;
END $$;
CREATE POLICY "co_sel" ON contracts FOR SELECT USING (creator_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "co_ins" ON contracts FOR INSERT WITH CHECK (creator_id = auth.uid());
CREATE POLICY "co_upd" ON contracts FOR UPDATE USING (creator_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "co_del" ON contracts FOR DELETE USING (creator_id = auth.uid());

-- SUBSCRIPTIONS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='subscriptions'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON subscriptions', r.policyname); END LOOP;
END $$;
CREATE POLICY "sub_all" ON subscriptions FOR ALL USING (user_id = auth.uid());

-- PAYMENT_EVENTS
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='payment_events'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON payment_events', r.policyname); END LOOP;
END $$;
CREATE POLICY "pe_all" ON payment_events FOR ALL USING (user_id = auth.uid());

-- ================================================================
-- ПРОВЕРКА РЕЗУЛЬТАТА
-- ================================================================
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' ORDER BY tablename;
