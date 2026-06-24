# Supabase setup for Hampta Duel

This PWA works offline/local-first without Supabase credentials. Supabase is only needed for Tarun and Sudhanshu to sync across devices and for push notification delivery.

## Setup

1. Create a Supabase project.
2. Login and link this folder:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

3. Push the database migration:

```sh
npx supabase db push
```

4. Deploy Edge Functions:
   - `duel-sync`
   - `register-push`
   - `send-reminders`

```sh
npx supabase functions deploy duel-sync
npx supabase functions deploy register-push
npx supabase functions deploy send-reminders
```

5. Set secrets for the Edge Functions:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

```sh
npx supabase secrets set SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
```

6. Generate VAPID keys for Web Push and keep the private key server-side for the future send function.
7. Fill these constants in `index.html` for the static client:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `VAPID_PUBLIC_KEY`

8. Store cron HTTP secrets in Supabase Vault before applying the reminder cron migration:

```sql
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');
```

## `duel-sync` contract

Request:

```json
{
  "duelCode": "HAMPTA20",
  "events": [
    {
      "playerId": "tarun",
      "duelCode": "HAMPTA20",
      "data": {
        "days": {},
        "gear": {}
      },
      "updatedAt": "2026-06-24T00:00:00.000Z"
    }
  ]
}
```

Behavior:

- accept only `duelCode = HAMPTA20`
- accept only `playerId = tarun` or `sudhanshu`
- upsert `daily_logs` from `data.days`
- upsert `gear_logs` from `data.gear`
- return the latest duel snapshot:

```json
{
  "snapshot": {
    "version": 1,
    "duelCode": "HAMPTA20",
    "players": {
      "tarun": { "days": {}, "gear": {} },
      "sudhanshu": { "days": {}, "gear": {} }
    }
  }
}
```

Writes are intentionally routed through Edge Functions because the PWA has no login. Do not expose the service role key in the static app.

## `register-push` contract

Request:

```json
{
  "duelCode": "HAMPTA20",
  "playerId": "tarun",
  "subscription": {
    "endpoint": "https://...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "preferences": {
    "morning": true,
    "evening": true,
    "friendCleared": true,
    "rivalry": true,
    "safety": true
  }
}
```

Behavior:

- accept only `HAMPTA20`
- accept only `tarun` or `sudhanshu`
- store the browser Push API subscription
- upsert notification preferences

## Notification delivery

The PWA can request permission and store a push subscription. `send-reminders` sends Web Push through VAPID:

- morning reminder: `06:00 Asia/Kolkata` / `00:30 UTC`
- night summary: `22:00 Asia/Kolkata` / `16:30 UTC`

Supabase Cron invokes `send-reminders` with `pg_cron` + `pg_net`. The cron migration reads `project_url` and `service_role_key` from Supabase Vault, so private keys are not committed. Keep `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, and `VAPID_SUBJECT` as Edge Function secrets.
