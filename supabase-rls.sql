-- ================================================
-- ПРАВИЛА БЕЗОПАСНОСТИ (Row Level Security)
-- Выполни в Supabase SQL Editor ПОСЛЕ создания таблиц
-- ================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE couple_settings ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "view_profiles" ON profiles FOR SELECT
  USING (auth.uid() = id OR id = (SELECT partner_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "update_profiles" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "insert_profiles" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- CALENDAR
CREATE POLICY "view_calendar" ON calendar_events FOR SELECT
  USING (auth.uid() = user_id OR user_id = (SELECT partner_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "insert_calendar" ON calendar_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_calendar" ON calendar_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_calendar" ON calendar_events FOR DELETE USING (auth.uid() = user_id);

-- MOMENTS
CREATE POLICY "view_moments" ON moments FOR SELECT
  USING (auth.uid() = user_id OR user_id = (SELECT partner_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "insert_moments" ON moments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_moments" ON moments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_moments" ON moments FOR DELETE USING (auth.uid() = user_id);

-- PLANS
CREATE POLICY "view_plans" ON plans FOR SELECT
  USING (auth.uid() = user_id OR user_id = (SELECT partner_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "insert_plans" ON plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_plans" ON plans FOR UPDATE
  USING (auth.uid() = user_id OR user_id = (SELECT partner_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "delete_plans" ON plans FOR DELETE USING (auth.uid() = user_id);

-- COUPLE SETTINGS
CREATE POLICY "view_settings" ON couple_settings FOR SELECT
  USING (auth.uid() = user_id OR user_id = (SELECT partner_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "insert_settings" ON couple_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_settings" ON couple_settings FOR UPDATE
  USING (auth.uid() = user_id OR user_id = (SELECT partner_id FROM profiles WHERE id = auth.uid()));

-- STORAGE
CREATE POLICY "upload_photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'photos' AND auth.role() = 'authenticated');
CREATE POLICY "view_photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'photos');
