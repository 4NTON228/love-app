-- Migration: Add message forwarding support
-- Run this in Supabase SQL Editor

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS forwarded_from_id UUID REFERENCES messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS messages_forwarded_from_idx ON messages(forwarded_from_id);
