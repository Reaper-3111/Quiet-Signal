# To do

What exists, what you must supply, and what is not built yet.

## Built

- **Server** (`server/`): alert intake, SMS fan-out with Twilio then Telnyx fallback, idempotent retries, delivery receipts, live-map page and location trail, "I'm safe" follow-up, server-held check-in timer, 30 day purge, Dockerfile, tests.
- **Evidence journal**: encrypted notes, photos, and audio on the server (AES-256-GCM, key in `JOURNAL_KEY`), dated PDF export, kept until deleted.
- **Also built**: audio recording on alert (opt-in, 30 second chunks uploaded to the journal), fake call (rings only while the app is open), resources screen, safety plan checklist, daily end-to-end test script, trigger guide.
- **Added in the second round**: shortcut setup walkthrough (Home, Shortcuts and watch) with a `skyline://test` link for safe trial runs; Apple Watch app and complication (`app/targets/watch`, `app/targets/watch-widget`) and Wear OS tile (`app/targets/wear`), fed by the phone over `app/modules/watch-link`; three alternate decoy icons (Settings, Options); remote wipe from a web page with a wipe code (`docs/remote-wipe.md`, `server/src/wipe.ts`); OS background retry of the queue (`expo-background-task`, also checks for a remote wipe); opt-in confirmation cue (Settings, Options; off by default; weather icon moves or the phone vibrates twice); local resources by category with clearly marked placeholders; journal written to both servers, read from the first that answers, and missing entries copied across when the journal opens.
- **Phone app** (`app/`): weather decoy with hidden entry (5 taps on the temperature, then PIN), setup (PIN, duress PIN, contacts, message, options, intro texts, test alert), instant alert, hold button with 10 second countdown, duress PIN, per-feature PIN-cancel toggle, location with reverse geocoding, full fallback chain (server A, server B, prefilled Messages, dialer), local queue with retry, hidden status screen, "I'm safe", check-in timer, live location stream, shake quick exit, decoy on backgrounding, screenshot/recents blocking, deep links `skyline://alert` and `skyline://hold`.

## You must supply

### Accounts and credentials (all go in env vars; see the two `.env.example` files)
- [ ] **Journal key**: generate with `openssl rand -base64 32` and set `JOURNAL_KEY` on both servers (a different key on each is fine). Back it up; losing it makes journal entries unreadable.
- [ ] **Twilio**: account SID, auth token, a dedicated sending number. For US texting, register the brand and campaign (A2P 10DLC) or messages get filtered. Set the status callback to `PUBLIC_URL/hooks/twilio` (the server sets it per message).
- [ ] **Telnyx** (or swap in another provider in `server/src/sms.ts`): API key and number for the SMS fallback.
- [ ] **Proxy setting**: if the servers sit behind a proxy or load balancer you control, set `TRUST_PROXY=true` so rate limits use the real client address (leave it false otherwise).
- [ ] **Two hosting providers** (for example Linode and a second cloud), each with its own Postgres, TLS domain, and `PUBLIC_URL`. Put both URLs in `app/.env`, and set `PEER_URLS` on each server to the other's URL and the same `PEER_SECRET` on both, so a remote wipe reaches both.
- [ ] **Noonlight** (or similar) if the 911 dispatch option ships (the Dispatch choice stays hidden in the app until `EXPO_PUBLIC_DISPATCH_ENABLED=true`): partnership terms, pricing, API token. `server/src/dispatch.ts` is a generic placeholder; replace the payload with the partner's real one. Dispatch partners also need a name and phone for the person, which conflicts with the minimal-data policy, so decide how to handle that.
- [ ] **Apple team ID**: replace `REPLACE_WITH_TEAM_ID` in `app/app.json`. The App Group `group.com.example.skyline` (app.json, `app/targets/widget/Shared.swift`, `app/src/config.ts`) must be renamed with the bundle ID and enabled in the Apple Developer portal.
- [ ] **Watch apps**: enable the same App Group for the watch app and complication bundle IDs in the Apple Developer portal. The Wear OS app (`app/targets/wear`) must ship with the same package name and signing key as the phone app, or the phone cannot reach it.
- [ ] **Local resources**: real shelters, courts, and advocates for each launch area in `app/src/resources.ts`. The three entries there are placeholders (shown only in development builds); confirm details with the agency.
- [ ] **Decoy icon art**: the three alternate icons (`app/assets/icons/`) are simple placeholders; replace with final art at the same sizes and names.
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
- [ ] **Compile and test the new native code.** `expo prebuild` generates all of it (checked), but none of it has been compiled or run: the Apple Watch app and complication (Swift), the Wear OS tile (Kotlin, Gradle module `:wear`), and the phone-to-watch bridge (`app/modules/watch-link`, Swift and Kotlin). Also try alternate icons on both platforms and the background retry task (iOS runs it at the system's discretion; use `triggerTaskWorkerForTestingAsync` in a debug build).
- [ ] **Agency branding** for licensed versions.
- [ ] **Run the daily test on a schedule** (`npm run daily-test` in `server/`; needs a cron or CI job, a test number, and a failure webhook) and **uptime monitoring** on `/health`.
- [ ] Verify `expo-audio` background recording on a real iPhone; Apple will ask about background audio in review.
- [ ] Optional: a bot check (for example Cloudflare Turnstile) on the `/wipe` page if it gets abused, and a neutral domain for it if the alert servers' domains should not be shared (`docs/remote-wipe.md`).

## Known limits to review

- Android needs a visible notification for background location. It is worded as a weather update (`app/src/location.ts`), but it exists.
- If the app is backgrounded during a hold countdown, the alert sends immediately rather than waiting.
- Expo Go cannot run this app; it needs a development build for background location.
- Abuse protection on the server is per-instance in-memory rate limits (per client address, per account, and tighter limits on intro and "I'm safe" texts); the widget has its own token that can only send the saved alert. Add device attestation (App Attest / Play Integrity) before public launch so the SMS endpoint cannot be used to text arbitrary numbers.
- Any app or web page can open `skyline://alert` and trigger an alert. Consider a per-install secret in the URL.
- PINs are 6 digits, salted and hashed, stored in the device keystore (not backed up or migrated). The server holds contact numbers and the trail for the retention window.
- Tapping the watch complication sends the alert at once, like the widget's "Radar", so an accidental tap is a false alarm. The watch has no queue: if no server answers after two tries, use the phone.
- Remote wipe clears the phone only once it reaches a server again. Until then the server side already blocks that phone's token.
- The confirmation cue, when turned on, is visible to anyone who knows to look for it.
- Changing the app icon on Android can close the app and drop home screen shortcuts to it; iOS shows a system notice.
- Audio chunks during an alert upload to both servers, which doubles the data used.
- Device testing: nothing has run on a phone yet. Logic, types, and bundling are verified; the real-device flows (permissions, Messages composer, background location) need hands-on testing, per the plan's pilot phase.
