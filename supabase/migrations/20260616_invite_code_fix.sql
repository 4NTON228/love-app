-- ================================================================
-- LOVE APP — INVITE CODE FIX (регистрация/приглашения)
-- 2026-06-16
--
-- Проблема: на проде отсутствовал BEFORE INSERT триггер генерации
-- invite_code, поэтому новые профили создавались с invite_code = NULL,
-- а клиент генерировал код в ВЕРХНЕМ регистре. Все RPC сравнивают код
-- через lower(), из-за чего приглашения никогда не находились
-- («Код приглашения не найден»).
--
-- Решение: серверная автогенерация кода (всегда нижний регистр) +
-- нормализация существующих кодов.
-- Безопасно запускать повторно.
-- ================================================================

-- 1. Функция генерации/нормализации invite_code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.invite_code IS NULL OR length(trim(NEW.invite_code)) = 0 THEN
    NEW.invite_code := lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  ELSE
    NEW.invite_code := lower(trim(NEW.invite_code));
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Триггер: каждый новый профиль получает стабильный код в нижнем регистре
DROP TRIGGER IF EXISTS trg_invite_code ON profiles;
CREATE TRIGGER trg_invite_code
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION generate_invite_code();

-- 3. Нормализуем существующие коды и заполняем пустые
UPDATE profiles
SET invite_code = lower(invite_code)
WHERE invite_code IS NOT NULL AND invite_code <> lower(invite_code);

UPDATE profiles
SET invite_code = lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE invite_code IS NULL OR length(trim(invite_code)) = 0;
