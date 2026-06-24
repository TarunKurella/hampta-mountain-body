# Hampta Mountain Body PWA

A static, iPhone-friendly PWA for the Hampta Pass prep plan from June 24 to July 20. It stores progress locally with `localStorage`; Supabase is used only for optional Duel sync and push subscription registration.

The current app also includes **Hampta Duel**: a trust-based two-player mode for Tarun vs Sudhanshu. First launch shows only two identity buttons: **I am Tarun** and **I am Sudhanshu**. No Gmail, no password, no magic link. The Today screen includes a compact Duel Pulse with both scores, one next-best action, and a post-stage debrief. The Duel tab adds weekly trophies for safe, consistent execution.

Live deployment:

https://hampta-mountain-body.netlify.app

## Run locally

Open `index.html` directly in a browser to use the app without install/offline features.

For full PWA testing, serve the folder:

```sh
cd hampta-pwa
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Deploy to Netlify

1. Go to Netlify and choose **Add new site**.
2. Drag the `hampta-pwa` folder into the deploy drop zone.
3. Open the generated HTTPS URL.
4. Optional: set a custom site name in Netlify site settings.

No build command is needed. The publish directory is the folder itself.

## Deploy to Vercel

1. Create a new Vercel project.
2. Import the repository or upload/connect this folder.
3. Use these settings:
   - Framework preset: **Other**
   - Build command: leave blank
   - Output directory: `hampta-pwa` if deploying from the repo root, or `.` if the project root is this folder
4. Deploy and open the generated HTTPS URL.

## Add to iPhone Home Screen

1. Open the deployed HTTPS link in Safari on the iPhone.
2. Tap the Share button.
3. Tap **Add to Home Screen**.
4. Keep the name as `Hampta` or rename it.
5. Launch from the Home Screen icon.

After the first successful load, the service worker caches the app shell so it can open offline.

## Notifications on iPhone

iOS notifications work only after the deployed HTTPS app is added to the Home Screen and opened from that icon.

1. Open the Home Screen app.
2. Choose **I am Tarun** or **I am Sudhanshu**.
3. Use the notification sheet that appears: tap **Enable**, then **Test**.
4. If the sheet was skipped, go to **Progress** -> **Device & Backup** and use **Allow** / **Test notification**.
5. After permission is granted, this device receives morning/night reminders and opponent duel alerts. Your own ticks stay quiet and show only in-app feedback.

The service worker also listens for real push payloads from the Supabase-backed push pipeline. iOS does not allow reliable notification behavior from a normal Safari tab.

Scheduled reminders, when the Supabase cron pipeline is enabled:

- **06:00 IST**: morning stage reminder with days left.
- **22:00 IST**: night progress summary and recovery closeout.
- **On task/stage/gear completion**: the opponent gets a duel notification such as `Tarun logged Stairs done` when they have alerts enabled.

## Backup and restore

Use the Progress tab:

- **Export JSON** downloads your progress.
- **Import JSON** restores a previous export.
- **Reset progress** clears local progress after confirmation.
- **Copy report**, **Share report**, and **Download report** create an LLM-friendly coach summary with day-wise logs, week-wise totals, proof goals, gear status, and injury/readiness flags.

## Metrics tracked

The app tracks only decision-changing trek-prep signals:

- daily Stage completion and streak
- stairs minutes
- run/walk or long-walk minutes
- gym, protein, hydration, sleep, and readiness checks
- sleep hours, protein grams, and water liters
- knee pain, shin pain, energy, soreness, and notes
- monsoon gear checklist
- week-wise totals and July 12 proof goals
- on-screen Coach Brief and LLM-friendly Markdown report

## Hampta Duel

The Duel tab compares Tarun and Sudhanshu as expedition profiles:

- today stage score
- weekly duel score
- streak
- readiness index
- loadout percentage
- last seven stage winners
- expedition stamps

Scoring is safety-capped: green days can score up to 100, yellow reduced-order days up to 95, and red recovery-order days up to 70. Extra volume does not create bonus points.

## Supabase sync

The app works without Supabase. To enable cross-device sync and push registration:

1. Create a Supabase project.
2. Run `supabase/schema.sql`.
3. Deploy the `duel-sync` and `register-push` Edge Functions under `supabase/functions`.
4. Fill `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `VAPID_PUBLIC_KEY` constants in `index.html`.
5. Configure VAPID private key and subject as Supabase function secrets.

The static client never uses a service-role key.

## iOS PWA and localStorage limitations

- The app must be served over HTTPS for Home Screen install and service worker offline support.
- Opening `index.html` directly works for tracking, but service workers do not run on `file://`.
- Progress is stored in Safari/Home Screen app storage on that device only.
- Clearing Safari website data, using private browsing, or not using the app for a long time can remove local data.
- Export JSON backups before switching phones, clearing browser data, or reinstalling.
- Web Share, Clipboard, Home Screen display mode, App Badge, Wake Lock, Storage persistence, service worker updates, online/offline state, and notification permission are feature-detected. iOS availability varies by Safari/PWA version, so the app always falls back to copy/download/export.
- Web Push notifications on iOS require a Home Screen web app, explicit permission, and a push backend. The test notification is local to your device; task/stage/gear ticks are sent to the opponent when they have alerts enabled.
