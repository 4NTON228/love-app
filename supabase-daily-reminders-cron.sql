-- ============================================================
-- daily-reminders — schedule (run once in Supabase SQL editor)
-- ============================================================
-- Deploy the edge function `daily-reminders` first, then schedule it to
-- run once a day. It pushes both partners reminders for:
--   • partner's birthday (today / tomorrow)
--   • couple anniversary (today / tomorrow)
--   • calendar events (today / tomorrow)
--
-- pg_cron + pg_net are already enabled (used by meeting-reminder).
-- 09:00 UTC daily; anon key is public and only reaches the function.

select cron.schedule(
  'daily-reminders',
  '0 9 * * *',
  $CRON$
  select net.http_post(
    url := 'https://bqyisdgwtgxxomukozko.supabase.co/functions/v1/daily-reminders',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxeWlzZGd3dGd4eG9tdWtvemtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDcyNjUsImV4cCI6MjA4NjUyMzI2NX0.n7MpTU0-pM_093znX3mvZ4dc82bX5EwB7vnDi7GZ54c',
      'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxeWlzZGd3dGd4eG9tdWtvemtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDcyNjUsImV4cCI6MjA4NjUyMzI2NX0.n7MpTU0-pM_093znX3mvZ4dc82bX5EwB7vnDi7GZ54c'
    )
  );
  $CRON$
);

-- inspect: select * from cron.job where jobname = 'daily-reminders';
-- remove:  select cron.unschedule('daily-reminders');
