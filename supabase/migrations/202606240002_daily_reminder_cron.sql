create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- Required one-time Vault secrets before this migration runs:
-- select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
-- select vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');

select cron.unschedule('hampta-morning-reminder')
where exists (select 1 from cron.job where jobname = 'hampta-morning-reminder');

select cron.unschedule('hampta-evening-summary')
where exists (select 1 from cron.job where jobname = 'hampta-evening-summary');

-- 06:00 Asia/Kolkata = 00:30 UTC.
select cron.schedule(
  'hampta-morning-reminder',
  '30 0 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := jsonb_build_object('duelCode', 'HAMPTA20', 'type', 'morning')
  );
  $$
);

-- 22:00 Asia/Kolkata = 16:30 UTC.
select cron.schedule(
  'hampta-evening-summary',
  '30 16 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := jsonb_build_object('duelCode', 'HAMPTA20', 'type', 'evening')
  );
  $$
);
