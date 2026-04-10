-- ══════════════════════════════════════════════════════════════
-- Migration: private_journal + contracts
-- Date: 2026-04-10
-- ══════════════════════════════════════════════════════════════

-- ==========================================
-- 1. PRIVATE_JOURNAL
-- ==========================================
CREATE TABLE IF NOT EXISTS private_journal (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content        TEXT        NOT NULL,
  ai_reflection  TEXT,
  mood           SMALLINT    CHECK (mood BETWEEN 1 AND 5),
  converted_to_message BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE private_journal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journal_select_own" ON private_journal;
DROP POLICY IF EXISTS "journal_insert_own" ON private_journal;
DROP POLICY IF EXISTS "journal_update_own" ON private_journal;
DROP POLICY IF EXISTS "journal_delete_own" ON private_journal;

CREATE POLICY "journal_select_own" ON private_journal
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "journal_insert_own" ON private_journal
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "journal_update_own" ON private_journal
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "journal_delete_own" ON private_journal
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS private_journal_user_id_created_at
  ON private_journal (user_id, created_at DESC);

-- ==========================================
-- 2. CONTRACTS
-- ==========================================
CREATE TABLE IF NOT EXISTS contracts (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  partner_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title           TEXT        NOT NULL,
  condition       TEXT        NOT NULL,
  consequence     TEXT,
  period_days     SMALLINT    DEFAULT 30 CHECK (period_days > 0),
  status          TEXT        DEFAULT 'pending'
                              CHECK (status IN ('pending','active','completed','violated','cancelled')),
  signed_by_creator  BOOLEAN  DEFAULT TRUE,
  signed_by_partner  BOOLEAN  DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ
);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contracts_select" ON contracts;
DROP POLICY IF EXISTS "contracts_insert" ON contracts;
DROP POLICY IF EXISTS "contracts_update" ON contracts;
DROP POLICY IF EXISTS "contracts_delete" ON contracts;

-- Both partners can see contracts they are part of
CREATE POLICY "contracts_select" ON contracts
  FOR SELECT USING (auth.uid() = creator_id OR auth.uid() = partner_id);

-- Only creator can insert
CREATE POLICY "contracts_insert" ON contracts
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Both partners can update (for signing, status changes)
CREATE POLICY "contracts_update" ON contracts
  FOR UPDATE USING (auth.uid() = creator_id OR auth.uid() = partner_id);

-- Only creator can delete
CREATE POLICY "contracts_delete" ON contracts
  FOR DELETE USING (auth.uid() = creator_id);

CREATE INDEX IF NOT EXISTS contracts_creator_id ON contracts (creator_id);
CREATE INDEX IF NOT EXISTS contracts_partner_id ON contracts (partner_id);
CREATE INDEX IF NOT EXISTS contracts_status ON contracts (status);
