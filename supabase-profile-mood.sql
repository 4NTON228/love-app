-- ==========================================
-- PROFILES — shared mood/status
-- Lets each partner set a current mood that the other sees on the home
-- screen. Reading is covered by the existing "view_profiles" policy
-- (self or partner); writing by "update_profiles" (auth.uid() = id).
-- ==========================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mood    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mood_at TIMESTAMPTZ;
