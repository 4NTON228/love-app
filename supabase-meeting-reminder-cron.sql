-- ============================================================
-- meeting-reminder — schedule (run once in Supabase SQL editor)
-- ============================================================
-- The edge function `meeting-reminder` runs every 5 minutes; when a
-- couple's next_meeting time arrives both partners get a
-- "💕 Вы скоро увидитесь!" push (once per meeting, gated by
-- couple_settings.meeting_notified_at).
--
-- Extensions: pg_cron, pg_net.
-- Column:     couple_settings.meeting_notified_at TIMESTAMPTZ
--
-- The function only accepts calls that carry the x-cron-secret header
-- (= Edge Function secret CRON_SECRET, mirrored in Vault as 'cron_secret').
-- See supabase-cron-secret.sql for the full rollout order.

select cron.schedule('meeting-reminder', '*/5 * * * *', $CRON$
  select net.http_post(
    url := 'https://bqyisdgwtgxxomukozko.supabase.co/functions/v1/meeting-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    )
  );
$CRON$);

-- Inspect:    select * from cron.job where jobname = 'meeting-reminder';
-- Remove:     select cron.unschedule('meeting-reminder');
