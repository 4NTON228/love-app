-- Добавляем поля онбординга и инвайт-кода в профили
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS invite_code   text UNIQUE,
  ADD COLUMN IF NOT EXISTS onboarding_done boolean DEFAULT false;

-- Генерируем invite_code для существующих пользователей
UPDATE profiles
SET invite_code = lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE invite_code IS NULL;

-- Для новых пользователей — автогенерация через trigger
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invite_code ON profiles;
CREATE TRIGGER trg_invite_code
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION generate_invite_code();

-- Индекс для быстрого поиска по инвайт-коду
CREATE INDEX IF NOT EXISTS idx_profiles_invite_code ON profiles(invite_code);

-- Разрешаем искать профиль по invite_code (для принятия инвайта)
CREATE POLICY IF NOT EXISTS "lookup by invite code" ON profiles
  FOR SELECT USING (true);  -- любой авторизованный пользователь может найти профиль по коду
