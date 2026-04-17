-- ================================================================
-- LOVE APP — PRODUCTION HARDENING MIGRATION
-- Добавляет: таблицу couples, индексы, sign_contract RPC,
-- connect_partner_by_invite RPC, contracts таблицу
-- ================================================================

-- ================================================================
-- 1. ТАБЛИЦА COUPLES — нормальная модель пары
-- ================================================================

CREATE TABLE IF NOT EXISTS couples (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','dissolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Гарантируем уникальность пары независимо от порядка user_a/user_b
  CONSTRAINT couples_unique_pair CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);

ALTER TABLE couples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "couples_read" ON couples FOR SELECT
  USING (user_a = auth.uid() OR user_b = auth.uid());
CREATE POLICY "couples_insert" ON couples FOR INSERT
  WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());
CREATE POLICY "couples_update" ON couples FOR UPDATE
  USING (user_a = auth.uid() OR user_b = auth.uid());

-- couple_id для обратной совместимости: вычисляем по user_a/user_b
-- Добавляем couple_id к основным таблицам (nullable для backward compat)
ALTER TABLE messages        ADD COLUMN IF NOT EXISTS couple_id UUID REFERENCES couples(id) ON DELETE SET NULL;
ALTER TABLE moments         ADD COLUMN IF NOT EXISTS couple_id UUID REFERENCES couples(id) ON DELETE SET NULL;
ALTER TABLE plans           ADD COLUMN IF NOT EXISTS couple_id UUID REFERENCES couples(id) ON DELETE SET NULL;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS couple_id UUID REFERENCES couples(id) ON DELETE SET NULL;
ALTER TABLE couple_settings ADD COLUMN IF NOT EXISTS couple_id UUID REFERENCES couples(id) ON DELETE SET NULL;
ALTER TABLE sync_mirror     ADD COLUMN IF NOT EXISTS couple_id UUID REFERENCES couples(id) ON DELETE SET NULL;
ALTER TABLE warmth_metrics  ADD COLUMN IF NOT EXISTS couple_id UUID REFERENCES couples(id) ON DELETE SET NULL;
ALTER TABLE time_capsules   ADD COLUMN IF NOT EXISTS couple_id UUID REFERENCES couples(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='love_letters') THEN
    EXECUTE 'ALTER TABLE love_letters ADD COLUMN IF NOT EXISTS couple_id UUID REFERENCES couples(id) ON DELETE SET NULL';
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='contracts') THEN
    EXECUTE 'ALTER TABLE contracts ADD COLUMN IF NOT EXISTS couple_id UUID REFERENCES couples(id) ON DELETE SET NULL';
  END IF;
END $$;

-- ================================================================
-- 2. ТАБЛИЦА CONTRACTS
-- ================================================================

CREATE TABLE IF NOT EXISTS contracts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  couple_id         UUID REFERENCES couples(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  condition         TEXT NOT NULL,
  consequence       TEXT,
  period_days       INTEGER NOT NULL DEFAULT 30,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','cancelled')),
  signed_by_creator BOOLEAN NOT NULL DEFAULT true,
  signed_by_partner BOOLEAN NOT NULL DEFAULT false,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ct_sel" ON contracts;
DROP POLICY IF EXISTS "ct_ins" ON contracts;
DROP POLICY IF EXISTS "ct_upd" ON contracts;
DROP POLICY IF EXISTS "ct_del" ON contracts;

CREATE POLICY "ct_sel" ON contracts FOR SELECT
  USING (creator_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "ct_ins" ON contracts FOR INSERT
  WITH CHECK (creator_id = auth.uid());
CREATE POLICY "ct_upd" ON contracts FOR UPDATE
  -- partner можно подписать; creator может cancel
  USING (creator_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "ct_del" ON contracts FOR DELETE
  USING (creator_id = auth.uid());

-- ================================================================
-- 3. ИНДЕКСЫ — производительность
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_invite_code
  ON profiles(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_partner_id
  ON profiles(partner_id) WHERE partner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_couple
  ON messages(couple_id, created_at DESC) WHERE couple_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_user_created
  ON messages(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_moments_couple
  ON moments(couple_id, created_at DESC) WHERE couple_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_moments_user_created
  ON moments(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plans_couple
  ON plans(couple_id, created_at DESC) WHERE couple_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_couple
  ON calendar_events(couple_id, event_date) WHERE couple_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_user_date
  ON calendar_events(user_id, event_date);

CREATE INDEX IF NOT EXISTS idx_sync_mirror_couple_date
  ON sync_mirror(couple_id, mirror_date) WHERE couple_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_creator  ON contracts(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_partner  ON contracts(partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_couple   ON contracts(couple_id, created_at DESC) WHERE couple_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_time_capsules_couple_trigger
  ON time_capsules(couple_id, trigger_date, is_sent) WHERE couple_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_time_capsules_pending_date
  ON time_capsules(trigger_date) WHERE is_sent = false AND trigger_type = 'date';

-- ================================================================
-- 4. RPC: connect_partner_by_invite — атомарное связывание пары
-- ================================================================

CREATE OR REPLACE FUNCTION connect_partner_by_invite(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  caller_id   uuid := auth.uid();
  partner_rec RECORD;
  couple_rec  RECORD;
  pair_a      uuid;
  pair_b      uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Найти партнёра по invite_code
  SELECT id, name INTO partner_rec
  FROM profiles
  WHERE invite_code = lower(trim(p_invite_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Код приглашения не найден');
  END IF;

  IF partner_rec.id = caller_id THEN
    RETURN jsonb_build_object('error', 'Нельзя подключиться к самому себе');
  END IF;

  -- Проверить: уже не связаны
  IF EXISTS (
    SELECT 1 FROM profiles WHERE id = caller_id AND partner_id IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('error', 'Ты уже в паре');
  END IF;

  -- Обеспечиваем canonical order для unique constraint
  IF caller_id < partner_rec.id THEN
    pair_a := caller_id; pair_b := partner_rec.id;
  ELSE
    pair_a := partner_rec.id; pair_b := caller_id;
  END IF;

  -- Создать couple
  INSERT INTO couples (user_a, user_b)
  VALUES (pair_a, pair_b)
  ON CONFLICT (user_a, user_b) DO NOTHING
  RETURNING * INTO couple_rec;

  IF couple_rec IS NULL THEN
    -- Already exists
    SELECT * INTO couple_rec FROM couples WHERE user_a = pair_a AND user_b = pair_b;
  END IF;

  -- Обновить оба профиля атомарно
  UPDATE profiles SET partner_id = partner_rec.id WHERE id = caller_id;
  UPDATE profiles SET partner_id = caller_id       WHERE id = partner_rec.id;

  RETURN jsonb_build_object(
    'couple_id',    couple_rec.id,
    'partner_id',   partner_rec.id,
    'partner_name', partner_rec.name
  );
END;
$$;

-- ================================================================
-- 5. RPC: sign_contract — подписать контракт, активировать его
-- ================================================================

CREATE OR REPLACE FUNCTION sign_contract(contract_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  caller_id  uuid := auth.uid();
  contract   RECORD;
BEGIN
  SELECT * INTO contract FROM contracts WHERE id = contract_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract not found';
  END IF;

  -- Только partner_id может подписать
  IF contract.partner_id != caller_id THEN
    RAISE EXCEPTION 'Not authorized to sign this contract';
  END IF;

  IF contract.signed_by_partner THEN
    RETURN; -- уже подписан, ничего не делаем
  END IF;

  UPDATE contracts
  SET
    signed_by_partner = true,
    status = 'active',
    expires_at = CASE
      WHEN period_days > 0 THEN now() + (period_days || ' days')::interval
      ELSE NULL
    END
  WHERE id = contract_id;
END;
$$;

-- ================================================================
-- 6. PRIVATE JOURNAL RLS
-- ================================================================

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='private_journal') THEN
    EXECUTE 'ALTER TABLE private_journal ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS pj_all ON private_journal';
    -- Строго только владелец — партнёр не должен видеть
    EXECUTE 'CREATE POLICY pj_owner ON private_journal FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  END IF;
END $$;

-- ================================================================
-- 7. TIME CAPSULES — дополнительные ограничения
-- ================================================================

-- Капсула "fight" помечается особым статусом до отправки
-- Добавляем fight_check_after для расчёта «молчания»
ALTER TABLE time_capsules ADD COLUMN IF NOT EXISTS fight_check_after TIMESTAMPTZ;
ALTER TABLE time_capsules ADD COLUMN IF NOT EXISTS fight_silence_hours INTEGER DEFAULT 24;

-- ================================================================
-- 8. HELPER: get_couple_id — возвращает couple_id для текущего юзера
-- ================================================================

CREATE OR REPLACE FUNCTION get_couple_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT id FROM couples
  WHERE (user_a = auth.uid() OR user_b = auth.uid())
    AND status = 'active'
  LIMIT 1
$$;

-- ================================================================
-- 9. ПРОВЕРКА
-- ================================================================

SELECT tablename, rowsecurity AS rls
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
