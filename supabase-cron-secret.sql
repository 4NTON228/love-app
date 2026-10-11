-- ============================================================
-- CRON_SECRET — защита cron-функций (выполнить один раз)
-- ============================================================
-- Функции daily-reminders, meeting-reminder, check-contracts,
-- process-time-capsules и cron-режим relationship-keeper принимают вызов
-- только с заголовком x-cron-secret = CRON_SECRET (или с service_role ключом).
--
-- ПОРЯДОК (иначе напоминания перестанут приходить):
--   1. Сгенерировать секрет:            openssl rand -hex 32
--   2. Edge Function secret:            supabase secrets set CRON_SECRET=<секрет>
--   3. Тот же секрет в Vault (ниже) и перевыставить cron-задачи (ниже).
--   4. Только после этого задеплоить обновлённые функции.

-- 3a. Секрет в Vault (подставь значение из шага 1)
select vault.create_secret('<секрет из шага 1>', 'cron_secret', 'x-cron-secret для pg_cron');

-- 3b. Перевыставить задачи с новым заголовком
-- (cron.schedule с тем же именем обновляет существующую задачу)
--   → выполнить supabase-daily-reminders-cron.sql
--   → выполнить supabase-meeting-reminder-cron.sql

-- Проверка: в command не должно остаться anon-ключа
-- select jobname, command from cron.job;
