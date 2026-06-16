-- ================================================================
-- LOVE APP — SECURITY HARDENING (data-leak review)
-- 2026-06-16
--
-- Цели:
--   1. Закрыть анонимное перечисление файлов в публичном бакете photos.
--   2. Запретить роли anon вызывать чувствительные RPC-функции
--      (в т.ч. перечисление профилей по invite-коду).
--
-- Безопасно запускать повторно.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. STORAGE: только авторизованные могут листать объекты бакета.
--    Доступ по прямому публичному URL продолжает работать
--    (бакет public), но анонимный list/download закрыт.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "view_photos" ON storage.objects;
CREATE POLICY "view_photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos' AND auth.role() = 'authenticated');

-- ----------------------------------------------------------------
-- 2. RPC: убрать анонимный доступ к функциям, которые должны
--    вызываться только авторизованными пользователями.
--    Важно: по умолчанию EXECUTE выдан роли PUBLIC, поэтому
--    отзываем у PUBLIC и anon, а затем явно выдаём authenticated.
--    Главный риск утечки — find_profile_by_invite_code: она
--    возвращала имя/аватар/id по invite-коду любому анониму.
-- ----------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.find_profile_by_invite_code(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.find_profile_by_invite_code(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.connect_partner_by_invite(text)   FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.connect_partner_by_invite(text)   TO authenticated;

REVOKE EXECUTE ON FUNCTION public.sign_contract(uuid)               FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.sign_contract(uuid)               TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_user_account()             FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.delete_user_account()             TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_couple_start_date(date)       FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_couple_start_date(date)       TO authenticated;

-- Триггерная функция — не должна вызываться через REST вообще.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
