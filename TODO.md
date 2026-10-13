# To do

What exists, what you must supply, and what is not built yet.

## Built

- **Server** (`server/`): alert intake, SMS fan-out with Twilio then Telnyx fallback, idempotent retries, delivery receipts, live-map page and location trail, "I'm safe" follow-up, server-held check-in timer, 30 day purge, Dockerfile, tests.
- **Phone app** (`app/`): weather decoy with hidden entry (5 taps on the temperature, then PIN), setup (PIN, duress PIN, contacts, message, options, intro texts, test alert), instant alert, hold button with 10 second countdown, duress PIN, per-feature PIN-cancel toggle, location with reverse geocoding, full fallback chain (server A, server B, prefilled Messages, dialer), local queue with retry, hidden status screen, "I'm safe", check-in timer, live location stream, shake quick exit, decoy on backgrounding, screenshot/recents blocking, deep links `skyline://alert` and `skyline://hold`.

## You must supply

### Accounts and credentials (all go in env vars; see the two `.env.example` files)
- [ ] **Twilio**: account SID, auth token, a dedicated sending number. For US texting, register the brand and campaign (A2P 10DLC) or messages get filtered. Set the status callback to `PUBLIC_URL/hooks/twilio` (the server sets it per message).
- [ ] **Telnyx** (or swap in another provider in `server/src/sms.ts`): API key and number for the SMS fallback.
- [ ] **Two hosting providers** (for example Linode and a second cloud), each with its own Postgres, TLS domain, and `PUBLIC_URL`. Put both URLs in `app/.env`.
- [ ] **Noonlight** (or similar) if the 911 dispatch option ships: partnership terms, pricing, API token. `server/src/dispatch.ts` is a generic placeholder; replace the payload with the partner's real one. Dispatch partners also need a name and phone for the person, which conflicts with the minimal-data policy, so decide how to handle that.
- [ ] **Apple Developer** and **Google Play** accounts, final bundle ID / package name (currently `com.example.skyline`), EAS or local signing setup.
- [ ] **Uptime monitoring** pinging `/health` on both servers every minute.

### Decisions
- [ ] Decoy name and icons (placeholder is "Skyline"; icons are the template defaults). The deep link scheme `skyline://` follows the name.
- [ ] Message template and contact intro wording (`app/src/message.ts`). Confirm with an advocate.
- [ ] Countdown length (`COUNTDOWN_SECONDS`, currently 10).
- [ ] Should the duress PIN send a different message, or the same one with the flag (currently same plus a flag)?
- [ ] What "PIN can cancel check-in" off should mean. Currently it makes an armed check-in impossible to cancel. The plan could also mean a grace period; confirm.
- [ ] Whether contacts can reply (currently one-way, replies unmonitored).
- [ ] `LICENSE` names R31 Holdings LLC as holder; confirm the exact legal name (your message said "R31 Holding LLC"), and have a lawyer review the license.
- [ ] Open questions in the planning doc for advocates (decoy believability, 911 behavior, court evidence format, trusted-person setup).

### Legal and store
- [ ] Terms of use and privacy policy stating exactly what is kept and for how long (30 days by default).
- [ ] Liability insurance and a lawyer review before launch.
- [ ] Store listing text mentioning a personal safety feature, review notes explaining Always-location, 17+ age rating, data-use labels.
- [ ] Google Play emergency-app exception for background location: read before relying on it.

## Not built yet

From the planning doc, phases 4 to 6 and monitoring:

- [ ] **iOS home and Lock Screen widgets** (Swift/WidgetKit): disguised weather widget with two tap areas that open `skyline://alert` and `skyline://hold`. Android widget equivalent.
- [ ] **Back Tap, Action Button, Siri, Apple Watch, Wear OS tile**: Shortcuts that open `skyline://alert`; setup walkthrough screens for each.
- [ ] **Selectable decoy icons** (alternate icons shipped with the app).
- [ ] **Evidence journal** (encrypted notes, photos, memos on the server, PDF export). Server tables and endpoints do not exist yet.
- [ ] **Audio recording on alert**, with the one-line recording-consent warning.
- [ ] **Fake incoming call**, **resources screen**, **safety plan checklist**.
- [ ] **Remote wipe** from a web login.
- [ ] **Agency branding** for licensed versions.
- [ ] **Daily end-to-end test alert** to a test number, with failure notification.
- [ ] **OS-level background retry** of the queue (currently retries on app open and every 30 seconds while the app runs). Add `expo-background-task`.
- [ ] Optional confirmation cue (weather icon flip or vibration) the plan describes; default is nothing visible.
- [ ] Android phones without Messages app fall straight to the dialer; test on real devices.

## Known limits to review

- Android needs a visible notification for background location. It is worded as a weather update (`app/src/location.ts`), but it exists.
- If the app is backgrounded during a hold countdown, the alert sends immediately rather than waiting.
- Expo Go cannot run this app; it needs a development build for background location.
- Abuse protection on the server is a per-instance in-memory rate limit. Add device attestation (App Attest / Play Integrity) before public launch so the SMS endpoint cannot be used to text arbitrary numbers.
- Any app or web page can open `skyline://alert` and trigger an alert. Consider a per-install secret in the widget URL when the widget is built.
- PINs are 6 digits, salted and hashed, stored in the device keystore (not backed up or migrated). The server holds contact numbers and the trail for the retention window.
- Device testing: nothing has run on a phone yet. Logic, types, and bundling are verified; the real-device flows (permissions, Messages composer, background location) need hands-on testing, per the plan's pilot phase.
