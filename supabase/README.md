# Supabase setup for Hampta Duel

This PWA works offline/local-first without Supabase credentials. Supabase is only needed for Tarun and Sudhanshu to sync across devices and for push notification delivery.

## Setup

1. Create a Supabase project.
2. Run `schema.sql` in the SQL editor.
3. Deploy Edge Functions:
   - `duel-sync`
   - `register-push`
4. Set secrets for the Edge Functions:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Generate VAPID keys for Web Push and keep the private key server-side for the future send function.
6. Fill these constants in `index.html` for the static client:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `VAPID_PUBLIC_KEY`

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

The PWA can now request permission and store a push subscription. Actual push delivery still needs a send function with VAPID signing and scheduling. Keep that server-side; never put the VAPID private key in the static app.
