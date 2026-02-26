-- ================================================
-- ПОЛНЫЙ SQL ДЛЯ LOVE APP
-- Копируй ЦЕЛИКОМ в SQL Editor и нажми Run
-- Безопасно запускать повторно
-- ================================================

-- ==========================================
-- 1. PROFILES
-- ==========================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  partner_id UUID REFERENCES auth.users(id),
  couple_start_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DROP POLICY IF EXISTS "select_profiles" ON profiles;
DROP POLICY IF EXISTS "view_profiles" ON profiles;
DROP POLICY IF EXISTS "update_profiles" ON profiles;
DROP POLICY IF EXISTS "insert_profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own and partner profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_profiles" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "update_profiles" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "insert_profiles" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ==========================================
-- 2. COUPLE_SETTINGS
-- ==========================================
CREATE TABLE IF NOT EXISTS couple_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  love_message TEXT DEFAULT 'Я тебя люблю ❤️',
  next_meeting TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP POLICY IF EXISTS "select_settings" ON couple_settings;
DROP POLICY IF EXISTS "view_settings" ON couple_settings;
DROP POLICY IF EXISTS "insert_settings" ON couple_settings;
DROP POLICY IF EXISTS "update_settings" ON couple_settings;
DROP POLICY IF EXISTS "delete_settings" ON couple_settings;
DROP POLICY IF EXISTS "Couple can view settings" ON couple_settings;
DROP POLICY IF EXISTS "Couple can update settings" ON couple_settings;
DROP POLICY IF EXISTS "Users can insert settings" ON couple_settings;
ALTER TABLE couple_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_settings" ON couple_settings
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "insert_settings" ON couple_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_settings" ON couple_settings
  FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "delete_settings" ON couple_settings
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 3. CALENDAR_EVENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  photo_url TEXT,
  emoji TEXT DEFAULT '❤️',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DROP POLICY IF EXISTS "select_calendar" ON calendar_events;
DROP POLICY IF EXISTS "view_calendar" ON calendar_events;
DROP POLICY IF EXISTS "insert_calendar" ON calendar_events;
DROP POLICY IF EXISTS "update_calendar" ON calendar_events;
DROP POLICY IF EXISTS "delete_calendar" ON calendar_events;
DROP POLICY IF EXISTS "Couple can view calendar" ON calendar_events;
DROP POLICY IF EXISTS "Users can insert calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Users can update own calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Users can delete own calendar events" ON calendar_events;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_calendar" ON calendar_events
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "insert_calendar" ON calendar_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_calendar" ON calendar_events
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_calendar" ON calendar_events
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 4. MOMENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS moments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  photo_url TEXT,
  mood TEXT DEFAULT 'love',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DROP POLICY IF EXISTS "select_moments" ON moments;
DROP POLICY IF EXISTS "view_moments" ON moments;
DROP POLICY IF EXISTS "insert_moments" ON moments;
DROP POLICY IF EXISTS "update_moments" ON moments;
DROP POLICY IF EXISTS "delete_moments" ON moments;
DROP POLICY IF EXISTS "Couple can view moments" ON moments;
DROP POLICY IF EXISTS "Users can insert moments" ON moments;
DROP POLICY IF EXISTS "Users can update own moments" ON moments;
DROP POLICY IF EXISTS "Users can delete own moments" ON moments;
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_moments" ON moments
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "insert_moments" ON moments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_moments" ON moments
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_moments" ON moments
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 5. PLANS
-- ==========================================
CREATE TABLE IF NOT EXISTS plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  category TEXT DEFAULT 'dream',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DROP POLICY IF EXISTS "select_plans" ON plans;
DROP POLICY IF EXISTS "view_plans" ON plans;
DROP POLICY IF EXISTS "insert_plans" ON plans;
DROP POLICY IF EXISTS "update_plans" ON plans;
DROP POLICY IF EXISTS "delete_plans" ON plans;
DROP POLICY IF EXISTS "Couple can view plans" ON plans;
DROP POLICY IF EXISTS "Users can insert plans" ON plans;
DROP POLICY IF EXISTS "Couple can update plans" ON plans;
DROP POLICY IF EXISTS "Users can delete own plans" ON plans;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_plans" ON plans
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "insert_plans" ON plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_plans" ON plans
  FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "delete_plans" ON plans
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 6. MESSAGES (чат)
-- ==========================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  text TEXT,
  photo_url TEXT,
  video_url TEXT,
  is_video_circle BOOLEAN DEFAULT FALSE,
  is_voice BOOLEAN DEFAULT FALSE,
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ,
  reactions JSONB DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Добавляем колонки если таблица уже существует
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_voice BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

DROP POLICY IF EXISTS "select_messages" ON messages;
DROP POLICY IF EXISTS "insert_messages" ON messages;
DROP POLICY IF EXISTS "update_messages" ON messages;
DROP POLICY IF EXISTS "delete_messages" ON messages;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_messages" ON messages
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "insert_messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_messages" ON messages
  FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "delete_messages" ON messages
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 7. PUSH_SUBSCRIPTIONS (уведомления)
-- ==========================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DROP POLICY IF EXISTS "select_push" ON push_subscriptions;
DROP POLICY IF EXISTS "insert_push" ON push_subscriptions;
DROP POLICY IF EXISTS "delete_push" ON push_subscriptions;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_push" ON push_subscriptions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "insert_push" ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_push" ON push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 8. STORAGE
-- ==========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "upload_photos" ON storage.objects;
DROP POLICY IF EXISTS "view_photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view photos" ON storage.objects;
CREATE POLICY "upload_photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'photos' AND auth.role() = 'authenticated');
CREATE POLICY "view_photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');

-- ==========================================
-- 9. ДАННЫЕ
-- ==========================================
DELETE FROM couple_settings;
INSERT INTO couple_settings (user_id, love_message, next_meeting)
VALUES
  ('ab73068c-b71a-4a57-9fa0-867543f1a2b0', 'Эльвира, ты — самое прекрасное, что случилось в моей жизни ❤️', '2026-03-01T18:00:00Z'),
  ('6a9fee91-73c3-4deb-963f-78f758576479', 'Спасибо, что ты есть. Ты делаешь мою жизнь волшебной ❤️', '2026-03-01T18:00:00Z');

UPDATE profiles
SET couple_start_date = '2025-10-17'
WHERE id IN ('ab73068c-b71a-4a57-9fa0-867543f1a2b0', '6a9fee91-73c3-4deb-963f-78f758576479');

-- ==========================================
-- 10. ПРОВЕРКА
-- ==========================================
SELECT 'profiles' as table_name, count(*) as rows FROM profiles
UNION ALL
SELECT 'couple_settings', count(*) FROM couple_settings
UNION ALL
SELECT 'calendar_events', count(*) FROM calendar_events
UNION ALL
SELECT 'moments', count(*) FROM moments
UNION ALL
SELECT 'plans', count(*) FROM plans
UNION ALL
SELECT 'messages', count(*) FROM messages
UNION ALL
SELECT 'push_subscriptions', count(*) FROM push_subscriptions;
