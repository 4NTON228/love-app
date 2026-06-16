-- ============================================================
-- meeting-reminder — schedule the "вы скоро увидитесь" push
-- ============================================================
-- The edge function `meeting-reminder` is already deployed. It must be
-- called on a schedule so it can fire when a couple's next_meeting time
-- arrives. Run this ONCE in Supabase → SQL Editor (same way the other
-- cron jobs — process-time-capsules, relationship-keeper — are scheduled).
--
-- Replace <SERVICE_ROLE_KEY> with your project's service role key
-- (Supabase → Project Settings → API → service_role secret).
-- The project ref is already filled in.

select cron.schedule(
  'meeting-reminder',
  '*/5 * * * *',   -- every 5 minutes
  $$
  select net.http_post(
    url     := 'https://bqyisdgwtgxxomukozko.supabase.co/functions/v1/meeting-reminder',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb
  );
  $$
);

-- To remove it later:  select cron.unschedule('meeting-reminder');
-- Added column used by the function:
--   ALTER TABLE couple_settings ADD COLUMN IF NOT EXISTS meeting_notified_at TIMESTAMPTZ;
