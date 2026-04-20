-- ================================================================
-- LOVE APP — SHARED COUPLE START DATE
-- Moves couple_start_date from profiles (per-user) to couples
-- (per-couple) as the single source of truth.
-- ================================================================

-- 1. Add the column to the shared couples table
ALTER TABLE couples ADD COLUMN IF NOT EXISTS couple_start_date DATE;

-- 2. Back-fill existing couples from their partners' profiles.
--    Prefer user_a's date; fall back to user_b's if user_a has none.
UPDATE couples c
SET couple_start_date = COALESCE(
  (SELECT couple_start_date FROM profiles WHERE id = c.user_a AND couple_start_date IS NOT NULL),
  (SELECT couple_start_date FROM profiles WHERE id = c.user_b AND couple_start_date IS NOT NULL)
)
WHERE c.couple_start_date IS NULL;

-- 3. Replace connect_partner_by_invite to carry inviter's date into couples
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

  -- partner_rec is the INVITER (owner of the invite_code)
  SELECT id, name, couple_start_date INTO partner_rec
  FROM profiles
  WHERE invite_code = lower(trim(p_invite_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Код приглашения не найден');
  END IF;

  IF partner_rec.id = caller_id THEN
    RETURN jsonb_build_object('error', 'Нельзя подключиться к самому себе');
  END IF;

  IF EXISTS (
    SELECT 1 FROM profiles WHERE id = caller_id AND partner_id IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('error', 'Ты уже в паре');
  END IF;

  -- Canonical order for UNIQUE constraint
  IF caller_id < partner_rec.id THEN
    pair_a := caller_id; pair_b := partner_rec.id;
  ELSE
    pair_a := partner_rec.id; pair_b := caller_id;
  END IF;

  -- Create couple; set couple_start_date from inviter's profile.
  -- On conflict (already exists): keep existing date if already set, else use inviter's.
  INSERT INTO couples (user_a, user_b, couple_start_date)
  VALUES (pair_a, pair_b, partner_rec.couple_start_date)
  ON CONFLICT (user_a, user_b) DO UPDATE
    SET couple_start_date = COALESCE(couples.couple_start_date, EXCLUDED.couple_start_date)
  RETURNING * INTO couple_rec;

  IF couple_rec IS NULL THEN
    SELECT * INTO couple_rec FROM couples WHERE user_a = pair_a AND user_b = pair_b;
  END IF;

  -- Link both profiles
  UPDATE profiles SET partner_id = partner_rec.id WHERE id = caller_id;
  UPDATE profiles SET partner_id = caller_id       WHERE id = partner_rec.id;

  RETURN jsonb_build_object(
    'couple_id',         couple_rec.id,
    'partner_id',        partner_rec.id,
    'partner_name',      partner_rec.name,
    'couple_start_date', couple_rec.couple_start_date
  );
END;
$$;

-- 4. RPC for post-pairing date changes — both partners may call this
CREATE OR REPLACE FUNCTION set_couple_start_date(p_date date)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE couples
  SET couple_start_date = p_date
  WHERE (user_a = auth.uid() OR user_b = auth.uid())
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active couple found';
  END IF;
END;
$$;
