# To do

What exists, what you must supply, and what is not built yet.

## Built

- **Server** (`server/`): alert intake, SMS fan-out with Twilio then Telnyx fallback, idempotent retries, delivery receipts, live-map page and location trail, "I'm safe" follow-up, server-held check-in timer, 30 day purge, Dockerfile, tests.
- **Evidence journal**: encrypted notes, photos, and audio on the server (AES-256-GCM, key in `JOURNAL_KEY`), dated PDF export, kept until deleted.
- **Also built**: audio recording on alert (opt-in, 30 second chunks uploaded to the journal), fake call (rings only while the app is open), resources screen, safety plan checklist, daily end-to-end test script, trigger guide.
- **Phone app** (`app/`): weather decoy with hidden entry (5 taps on the temperature, then PIN), setup (PIN, duress PIN, contacts, message, options, intro texts, test alert), instant alert, hold button with 10 second countdown, duress PIN, per-feature PIN-cancel toggle, location with reverse geocoding, full fallback chain (server A, server B, prefilled Messages, dialer), local queue with retry, hidden status screen, "I'm safe", check-in timer, live location stream, shake quick exit, decoy on backgrounding, screenshot/recents blocking, deep links `skyline://alert` and `skyline://hold`.

## You must supply

### Accounts and credentials (all go in env vars; see the two `.env.example` files)
- [ ] **Journal key**: generate with `openssl rand -base64 32` and set `JOURNAL_KEY` on the primary server. Back it up; losing it makes journal entries unreadable.
- [ ] **Twilio**: account SID, auth token, a dedicated sending number. For US texting, register the brand and campaign (A2P 10DLC) or messages get filtered. Set the status callback to `PUBLIC_URL/hooks/twilio` (the server sets it per message).
- [ ] **Telnyx** (or swap in another provider in `server/src/sms.ts`): API key and number for the SMS fallback.
- [ ] **Proxy setting**: if the servers sit behind a proxy or load balancer you control, set `TRUST_PROXY=true` so rate limits use the real client address (leave it false otherwise).
- [ ] **Two hosting providers** (for example Linode and a second cloud), each with its own Postgres, TLS domain, and `PUBLIC_URL`. Put both URLs in `app/.env`.
- [ ] **Noonlight** (or similar) if the 911 dispatch option ships (the Dispatch choice stays hidden in the app until `EXPO_PUBLIC_DISPATCH_ENABLED=true`): partnership terms, pricing, API token. `server/src/dispatch.ts` is a generic placeholder; replace the payload with the partner's real one. Dispatch partners also need a name and phone for the person, which conflicts with the minimal-data policy, so decide how to handle that.
- [ ] **Apple team ID**: replace `REPLACE_WITH_TEAM_ID` in `app/app.json`. The App Group `group.com.example.skyline` (app.json, `app/targets/widget/Shared.swift`, `app/src/config.ts`) must be renamed with the bundle ID and enabled in the Apple Developer portal.
- [ ] **Apple Developer** and **Google Play** accounts, final bundle ID / package name (currently `com.example.skyline`), EAS or local signing setup.
- [ ] **Uptime monitoring** pinging `/health` on both servers every minute.

### Decisions
- [ ] Decoy name and icons (placeholder is "Skyline"; icons are the template defaults). The deep link scheme `skyline://` follows the name.
- [ ] Message template and contact intro wording (`app/src/message.ts`). Confirm with an advocate.
- [ ] Countdown length (`COUNTDOWN_SECONDS`, currently 10).
- [ ] Should the duress PIN send a different message, or the same one with the flag (currently same plus a flag)?
- [ ] "PIN can cancel check-in" is a setting (Settings, Options). When off, an armed check-in cannot be cancelled. Confirm that is the behavior you want.
- [ ] Whether contacts can reply (currently one-way, replies unmonitored).
- [ ] Have a lawyer review the license (holder: R31 Holdings LLC, confirmed).
- [ ] Open questions in the planning doc for advocates (decoy believability, 911 behavior, court evidence format, trusted-person setup).

### Legal and store
- [ ] Terms of use and privacy policy stating exactly what is kept and for how long (30 days by default).
- [ ] Liability insurance and a lawyer review before launch.
- [ ] Store listing text mentioning a personal safety feature, review notes explaining Always-location, 17+ age rating, data-use labels.
- [ ] Google Play emergency-app exception for background location: read before relying on it.

## Not built yet

- [ ] **Test the widgets on devices.** iOS (Swift, `app/targets/widget/`) and Android (`app/src/widget/`) are written and generate correctly with `expo prebuild`, but the Swift has not been compiled and neither has run on a phone. Widgets use the last location the app saved, so it can be stale. The Android widget's preview image is not set.
- [ ] **Shortcut triggers** (Back Tap, Action Button, Watch, Siri) are documented in `docs/triggers.md`; the in-app setup walkthrough screens are not built. Watch complication and Wear OS tile need native code.
- [ ] **Selectable decoy icons** (alternate icons shipped with the app; needs native config).
- [ ] **Remote wipe** from a web login (needs a web login design first).
- [ ] **Agency branding** for licensed versions.
- [ ] **Run the daily test on a schedule** (`npm run daily-test` in `server/`; needs a cron or CI job, a test number, and a failure webhook) and **uptime monitoring** on `/health`.
- [ ] **OS-level background retry** of the queue (currently retries on app open and every 30 seconds while the app runs). Add `expo-background-task`.
- [ ] Optional confirmation cue (weather icon flip or vibration) the plan describes; default is nothing visible.
- [ ] **Local resources**: add shelters, courts, and advocates to `app/src/resources.ts` (`LOCAL`). Only national numbers are included.
- [ ] Journal lives on the first server only, so it is not covered by the second-server fallback. Decide whether to replicate it.
- [ ] Verify `expo-audio` background recording on a real iPhone; Apple will ask about background audio in review.

## Known limits to review

- Android needs a visible notification for background location. It is worded as a weather update (`app/src/location.ts`), but it exists.
- If the app is backgrounded during a hold countdown, the alert sends immediately rather than waiting.
- Expo Go cannot run this app; it needs a development build for background location.
- Abuse protection on the server is per-instance in-memory rate limits (per client address, per account, and tighter limits on intro and "I'm safe" texts); the widget has its own token that can only send the saved alert. Add device attestation (App Attest / Play Integrity) before public launch so the SMS endpoint cannot be used to text arbitrary numbers.
- Any app or web page can open `skyline://alert` and trigger an alert. Consider a per-install secret in the URL.
- PINs are 6 digits, salted and hashed, stored in the device keystore (not backed up or migrated). The server holds contact numbers and the trail for the retention window.
- Device testing: nothing has run on a phone yet. Logic, types, and bundling are verified; the real-device flows (permissions, Messages composer, background location) need hands-on testing, per the plan's pilot phase.
