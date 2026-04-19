-- ─────────────────────────────────────────────────────────────────────────────
-- E2EE Schema Migration
-- Adds encryption metadata fields to support client-side E2EE.
-- All changes are backward-compatible: existing data is NOT broken.
--
-- Encryption scheme: ECDH P-256 + HKDF-SHA-256 + AES-GCM-256
-- See src/lib/crypto.js for client implementation.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Identity keys on profiles ─────────────────────────────────────────────
-- public_key: JWK-encoded ECDH P-256 public key (set by client on first E2EE init).
-- Private key NEVER stored on server.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS public_key TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 0;

COMMENT ON COLUMN profiles.public_key IS
  'Client ECDH P-256 public key (JWK JSON string). Set by client; read by partner to derive room key.';

-- ── 2. Messages: encrypted payload fields ─────────────────────────────────────
-- is_encrypted: TRUE when message uses E2EE (ciphertext set, text NULL)
-- ciphertext:   JSON envelope { v, alg, iv, ct } — AES-GCM-256 encrypted text
-- Backward compat: old rows keep text field, is_encrypted=FALSE (default)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ciphertext   TEXT DEFAULT NULL;

COMMENT ON COLUMN messages.is_encrypted IS
  'TRUE = ciphertext column holds AES-GCM-256 E2EE payload; text column is NULL.';
COMMENT ON COLUMN messages.ciphertext IS
  'JSON: { v:1, alg:"AESGCM256", iv:"<b64>", ct:"<b64>" }';

-- ── 3. Photo/media metadata ────────────────────────────────────────────────────
-- enc_meta: JSONB blob with encryption metadata for encrypted photo uploads.
-- thumb_path: path to compressed thumbnail in storage (separate from full image).
-- is_encrypted: marks blob as encrypted.

-- messages (photo attachments)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS thumb_url  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS photo_enc_meta JSONB DEFAULT NULL;

COMMENT ON COLUMN messages.thumb_url IS
  'Storage path or public URL of compressed thumbnail. Loaded in lists; full photo on demand.';
COMMENT ON COLUMN messages.photo_enc_meta IS
  'Encryption metadata for encrypted photo: { v, alg, iv, file_key_enc, mime, size }';

-- moments (gallery photos)
ALTER TABLE moments
  ADD COLUMN IF NOT EXISTS thumb_url       TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_encrypted    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS photo_enc_meta  JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS thumb_enc_meta  JSONB DEFAULT NULL;

COMMENT ON COLUMN moments.thumb_url IS
  'Compressed thumbnail URL/path. Loaded in grid; full photo only on tap.';

-- calendar_events (event photos)
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS thumb_url       TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_encrypted    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS photo_enc_meta  JSONB DEFAULT NULL;

-- ── 4. Indexes ─────────────────────────────────────────────────────────────────
-- Speeds up pagination cursor query (already common pattern in app)
CREATE INDEX IF NOT EXISTS messages_created_at_idx
  ON messages (created_at DESC);

-- For filtering encrypted vs legacy messages (analytics / admin queries only)
CREATE INDEX IF NOT EXISTS messages_is_encrypted_idx
  ON messages (is_encrypted) WHERE is_encrypted = TRUE;

-- ── 5. RLS: ciphertext readable by pair only (same as existing message policy) ─
-- No new RLS needed — existing messages policy already restricts to user+partner.
-- ciphertext column inherits same policy.

-- ── 6. Prevent storing both text + ciphertext simultaneously ──────────────────
-- Belt-and-suspenders check at DB level.
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_text_xor_cipher;
ALTER TABLE messages
  ADD CONSTRAINT messages_text_xor_cipher
  CHECK (
    NOT (text IS NOT NULL AND ciphertext IS NOT NULL)
  );
