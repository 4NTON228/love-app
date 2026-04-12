-- =====================================================
-- RLS SECURITY FIX v2
-- Проблема: OR invite_code IS NOT NULL давал доступ ко ВСЕМ профилям
-- Решение: строгие политики + RPC функция для поиска по invite_code
-- =====================================================

-- Helper: получить partner_id текущего пользователя
CREATE OR REPLACE FUNCTION get_partner_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT partner_id FROM profiles WHERE id = auth.uid()
$$;

-- Helper: поиск профиля по invite_code (обходит RLS, возвращает минимум полей)
CREATE OR REPLACE FUNCTION find_profile_by_invite_code(code text)
RETURNS TABLE (id uuid, name text, avatar_url text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id, name, avatar_url FROM public.profiles
  WHERE invite_code = lower(trim(code))
  LIMIT 1;
$$;

-- =====================================================
-- PROFILES — удаляем ВСЕ политики и создаём строгие
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON profiles'; END LOOP;
END $$;

-- Только свой профиль и профиль партнёра
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  id = auth.uid() OR id = get_partner_id()
);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (id = auth.uid());

-- =====================================================
-- MESSAGES — удаляем ВСЕ политики
-- =====================================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='messages'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON messages'; END LOOP;
END $$;

CREATE POLICY "messages_select" ON messages FOR SELECT USING (
  user_id = auth.uid() OR user_id = get_partner_id()
);
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "messages_update" ON messages FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "messages_delete" ON messages FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- MOMENTS — удаляем ВСЕ политики
-- =====================================================
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='moments'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON moments'; END LOOP;
END $$;

CREATE POLICY "moments_select" ON moments FOR SELECT USING (
  user_id = auth.uid() OR user_id = get_partner_id()
);
CREATE POLICY "moments_insert" ON moments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "moments_update" ON moments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "moments_delete" ON moments FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- PLANS — удаляем ВСЕ политики
-- =====================================================
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='plans'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON plans'; END LOOP;
END $$;

CREATE POLICY "plans_select" ON plans FOR SELECT USING (
  user_id = auth.uid() OR user_id = get_partner_id()
);
CREATE POLICY "plans_insert" ON plans FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "plans_update" ON plans FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "plans_delete" ON plans FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- LOVE_LETTERS — удаляем ВСЕ политики
-- =====================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='love_letters' AND table_schema='public') THEN
    EXECUTE 'ALTER TABLE love_letters ENABLE ROW LEVEL SECURITY';
    DECLARE r record; BEGIN
      FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='love_letters'
      LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON love_letters'; END LOOP;
    END;
    EXECUTE $p$
      CREATE POLICY "letters_select" ON love_letters FOR SELECT USING (user_id = auth.uid() OR user_id = get_partner_id());
      CREATE POLICY "letters_insert" ON love_letters FOR INSERT WITH CHECK (user_id = auth.uid());
      CREATE POLICY "letters_update" ON love_letters FOR UPDATE USING (user_id = auth.uid());
      CREATE POLICY "letters_delete" ON love_letters FOR DELETE USING (user_id = auth.uid());
    $p$;
  END IF;
END $$;

-- =====================================================
-- CALENDAR_EVENTS / EVENTS
-- =====================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='calendar_events' AND table_schema='public') THEN
    EXECUTE 'ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY';
    DECLARE r record; BEGIN
      FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='calendar_events'
      LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON calendar_events'; END LOOP;
    END;
    EXECUTE $p$
      CREATE POLICY "cal_select" ON calendar_events FOR SELECT USING (user_id = auth.uid() OR user_id = get_partner_id());
      CREATE POLICY "cal_insert" ON calendar_events FOR INSERT WITH CHECK (user_id = auth.uid());
      CREATE POLICY "cal_update" ON calendar_events FOR UPDATE USING (user_id = auth.uid());
      CREATE POLICY "cal_delete" ON calendar_events FOR DELETE USING (user_id = auth.uid());
    $p$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='events' AND table_schema='public') THEN
    EXECUTE 'ALTER TABLE events ENABLE ROW LEVEL SECURITY';
    DECLARE r record; BEGIN
      FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='events'
      LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON events'; END LOOP;
    END;
    EXECUTE $p$
      CREATE POLICY "events_select" ON events FOR SELECT USING (user_id = auth.uid() OR user_id = get_partner_id());
      CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (user_id = auth.uid());
      CREATE POLICY "events_update" ON events FOR UPDATE USING (user_id = auth.uid());
      CREATE POLICY "events_delete" ON events FOR DELETE USING (user_id = auth.uid());
    $p$;
  END IF;
END $$;

-- =====================================================
-- PUSH_SUBSCRIPTIONS
-- =====================================================
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='push_subscriptions'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON push_subscriptions'; END LOOP;
END $$;

CREATE POLICY "push_select" ON push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "push_insert" ON push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_update" ON push_subscriptions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "push_delete" ON push_subscriptions FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- ПРОВЕРКА: список таблиц и статус RLS
-- =====================================================
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
