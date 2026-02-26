-- Migration: Add Telegram-style chat features
-- Run this in Supabase SQL Editor

-- Add new columns to messages table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_voice BOOLEAN DEFAULT FALSE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS messages_reply_to_idx ON messages(reply_to_id);
CREATE INDEX IF NOT EXISTS messages_pinned_idx ON messages(is_pinned) WHERE is_pinned = TRUE;

-- Enable realtime on messages (if not already)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Make sure RLS policies allow UPDATE for own messages
CREATE POLICY IF NOT EXISTS "users_update_own_messages" ON messages
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow all users in same couple to see reactions updates
-- (existing view policy should cover this)
