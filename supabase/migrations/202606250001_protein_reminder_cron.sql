alter table public.notification_preferences
  add column if not exists protein_enabled boolean not null default true;

select cron.unschedule('hampta-protein-check')
where exists (select 1 from cron.job where jobname = 'hampta-protein-check');

-- 15:00 Asia/Kolkata = 09:30 UTC.
select cron.schedule(
  'hampta-protein-check',
  '30 9 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := jsonb_build_object('duelCode', 'HAMPTA20', 'type', 'protein')
  );
  $$
);
