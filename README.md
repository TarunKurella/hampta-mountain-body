# Hampta Mountain Body PWA

A static, iPhone-friendly PWA for the Hampta Pass prep plan from June 24 to July 20. It stores progress locally with `localStorage`; there is no backend.

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

## Backup and restore

Use the Progress tab:

- **Export JSON** downloads your progress.
- **Import JSON** restores a previous export.
- **Reset progress** clears local progress after confirmation.
- **Copy report**, **Share report**, and **Download report** create an LLM-friendly coach summary with day-wise logs, week-wise totals, proof goals, gear status, and injury/readiness flags.

## Metrics tracked

The app tracks only decision-changing trek-prep signals:

- daily Mountain Coin completion and streak
- stairs minutes
- run/walk or long-walk minutes
- gym, protein, hydration, sleep, and readiness checks
- sleep hours, protein grams, water liters, and bodyweight
- knee pain, shin pain, energy, soreness, and notes
- monsoon gear checklist
- week-wise totals and July 12 proof goals

## iOS PWA and localStorage limitations

- The app must be served over HTTPS for Home Screen install and service worker offline support.
- Opening `index.html` directly works for tracking, but service workers do not run on `file://`.
- Progress is stored in Safari/Home Screen app storage on that device only.
- Clearing Safari website data, using private browsing, or not using the app for a long time can remove local data.
- Export JSON backups before switching phones, clearing browser data, or reinstalling.
- Web Share, Clipboard, Home Screen display mode, App Badge, Wake Lock, Storage persistence, service worker updates, online/offline state, and notification permission are feature-detected. iOS availability varies by Safari/PWA version, so the app always falls back to copy/download/export.
- Web Push notifications on iOS require a Home Screen web app plus a real push backend. This app has no backend, so it does not pretend to schedule local reminders.
