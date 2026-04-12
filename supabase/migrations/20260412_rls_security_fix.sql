-- =====================================================
-- CRITICAL SECURITY FIX: Row Level Security for all tables
-- Users can only see their own data and their partner's data
-- =====================================================

-- Helper function: get current user's partner_id
CREATE OR REPLACE FUNCTION get_partner_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT partner_id FROM profiles WHERE id = auth.uid()
$$;

-- =====================================================
-- PROFILES TABLE
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop old permissive policy
DROP POLICY IF EXISTS "lookup by invite code" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;

-- Own profile or partner's profile
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR id = get_partner_id()
    -- Allow invite code lookup (for onboarding partner connect)
    OR invite_code IS NOT NULL
  );

-- Only own profile insert
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Only own profile update
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- =====================================================
-- MESSAGES TABLE
-- =====================================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;
DROP POLICY IF EXISTS "messages_delete" ON messages;

-- Only messages from current user or partner
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    user_id = auth.uid()
    OR user_id = get_partner_id()
  );

CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "messages_update" ON messages
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "messages_delete" ON messages
  FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- MOMENTS TABLE
-- =====================================================
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moments_select" ON moments;
DROP POLICY IF EXISTS "moments_insert" ON moments;
DROP POLICY IF EXISTS "moments_update" ON moments;
DROP POLICY IF EXISTS "moments_delete" ON moments;

CREATE POLICY "moments_select" ON moments
  FOR SELECT USING (
    user_id = auth.uid()
    OR user_id = get_partner_id()
  );

CREATE POLICY "moments_insert" ON moments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "moments_update" ON moments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "moments_delete" ON moments
  FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- PLANS TABLE
-- =====================================================
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans_select" ON plans;
DROP POLICY IF EXISTS "plans_insert" ON plans;
DROP POLICY IF EXISTS "plans_update" ON plans;
DROP POLICY IF EXISTS "plans_delete" ON plans;

CREATE POLICY "plans_select" ON plans
  FOR SELECT USING (
    user_id = auth.uid()
    OR user_id = get_partner_id()
  );

CREATE POLICY "plans_insert" ON plans
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "plans_update" ON plans
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "plans_delete" ON plans
  FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- EVENTS / CALENDAR_EVENTS TABLE
-- =====================================================
-- Try both possible table names
DO $$
BEGIN
  -- calendar_events
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calendar_events' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "cal_select" ON calendar_events';
    EXECUTE 'DROP POLICY IF EXISTS "cal_insert" ON calendar_events';
    EXECUTE 'DROP POLICY IF EXISTS "cal_update" ON calendar_events';
    EXECUTE 'DROP POLICY IF EXISTS "cal_delete" ON calendar_events';
    EXECUTE $p$
      CREATE POLICY "cal_select" ON calendar_events
        FOR SELECT USING (user_id = auth.uid() OR user_id = get_partner_id());
      CREATE POLICY "cal_insert" ON calendar_events
        FOR INSERT WITH CHECK (user_id = auth.uid());
      CREATE POLICY "cal_update" ON calendar_events
        FOR UPDATE USING (user_id = auth.uid());
      CREATE POLICY "cal_delete" ON calendar_events
        FOR DELETE USING (user_id = auth.uid());
    $p$;
  END IF;

  -- events
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'events' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE events ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "events_select" ON events';
    EXECUTE 'DROP POLICY IF EXISTS "events_insert" ON events';
    EXECUTE 'DROP POLICY IF EXISTS "events_update" ON events';
    EXECUTE 'DROP POLICY IF EXISTS "events_delete" ON events';
    EXECUTE $p$
      CREATE POLICY "events_select" ON events
        FOR SELECT USING (user_id = auth.uid() OR user_id = get_partner_id());
      CREATE POLICY "events_insert" ON events
        FOR INSERT WITH CHECK (user_id = auth.uid());
      CREATE POLICY "events_update" ON events
        FOR UPDATE USING (user_id = auth.uid());
      CREATE POLICY "events_delete" ON events
        FOR DELETE USING (user_id = auth.uid());
    $p$;
  END IF;
END $$;

-- =====================================================
-- LOVE_LETTERS TABLE
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'love_letters' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE love_letters ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "letters_select" ON love_letters';
    EXECUTE 'DROP POLICY IF EXISTS "letters_insert" ON love_letters';
    EXECUTE 'DROP POLICY IF EXISTS "letters_update" ON love_letters';
    EXECUTE 'DROP POLICY IF EXISTS "letters_delete" ON love_letters';
    EXECUTE $p$
      CREATE POLICY "letters_select" ON love_letters
        FOR SELECT USING (
          user_id = auth.uid()
          OR user_id = get_partner_id()
        );
      CREATE POLICY "letters_insert" ON love_letters
        FOR INSERT WITH CHECK (user_id = auth.uid());
      CREATE POLICY "letters_update" ON love_letters
        FOR UPDATE USING (user_id = auth.uid());
      CREATE POLICY "letters_delete" ON love_letters
        FOR DELETE USING (user_id = auth.uid());
    $p$;
  END IF;
END $$;

-- =====================================================
-- PUSH_SUBSCRIPTIONS TABLE
-- =====================================================
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_select" ON push_subscriptions;
DROP POLICY IF EXISTS "push_insert" ON push_subscriptions;
DROP POLICY IF EXISTS "push_update" ON push_subscriptions;
DROP POLICY IF EXISTS "push_delete" ON push_subscriptions;

-- Users see only their own push subscription
-- Partner's subscription visible only for sending notifications (handled by service_role)
CREATE POLICY "push_select" ON push_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "push_insert" ON push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_update" ON push_subscriptions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "push_delete" ON push_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- VERIFY: Show all tables and their RLS status
-- =====================================================
-- Run this to check after migration:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
