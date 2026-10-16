# Quiet Signal

A disguised phone app that sends a pre-written alert, with exact location, to people the user chose ahead of time, in one motion and without anyone noticing.

```
app/      Expo (React Native) phone app: weather decoy, hidden real mode
server/   Hono + Postgres API: sends the SMS, hosts the live map, holds check-in timers
docs/     Trigger guide, remote wipe design
TODO.md   What still needs credentials, decisions, or native work
```

## How an alert travels

1. The app records the alert locally, then posts it to server A (3 second timeout).
2. If A does not answer it tries server B. Both can send SMS on their own.
3. If neither answers, the Messages app opens with the contacts and text prefilled.
4. If Messages is unavailable, the dialer opens with 911.

Queued alerts retry while the app runs and through the OS background task until a server accepts them. Journal entries are written to both servers.

## Run the server

```
cd server
cp .env.example .env     # fill in values
npm install
npm test
npm run dev
```

Deploy the same image to two providers (`Dockerfile`), each with its own Postgres, `PUBLIC_URL`, and `JOURNAL_KEY`. Set `PEER_URLS` on each to the other's URL so a remote wipe reaches both.

## Run the app

```
cd app
cp .env.example .env     # point at your two servers
npm install
npm test
npx expo prebuild && npx expo run:ios   # needs a dev build; Expo Go cannot run background location
```

Open the real app from the decoy by tapping the temperature five times quickly, then entering the PIN.
Deep links for shortcuts: `skyline://alert` (instant alert), `skyline://hold` (hold screen), and `skyline://test` (TEST alert, for trying a shortcut).

`npx expo prebuild` also generates the iOS widget, the Apple Watch app and complication (`app/targets/`), the Wear OS tile module (`app/targets/wear`, via `app/plugins/withWearOS.js`), and the alternate decoy icons.
