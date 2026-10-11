-- ============================================================
-- daily-reminders — schedule (run once in Supabase SQL editor)
-- ============================================================
-- Deploy the edge function `daily-reminders` first, then schedule it to
-- run once a day. It pushes both partners reminders for:
--   • partner's birthday (today / tomorrow)
--   • couple anniversary (today / tomorrow)
--   • calendar events (today / tomorrow)
--
-- The function only accepts calls that carry the x-cron-secret header
-- (= Edge Function secret CRON_SECRET). The same value is kept in Supabase
-- Vault under the name 'cron_secret' — see supabase-cron-secret.sql.
-- 09:00 UTC daily.

select cron.schedule(
  'daily-reminders',
  '0 9 * * *',
  $CRON$
  select net.http_post(
    url := 'https://bqyisdgwtgxxomukozko.supabase.co/functions/v1/daily-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    )
  );
  $CRON$
);

-- inspect: select * from cron.job where jobname = 'daily-reminders';
-- remove:  select cron.unschedule('daily-reminders');
