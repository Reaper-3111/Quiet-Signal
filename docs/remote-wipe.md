# Remote wipe: web login design

If the phone is taken, the person (or an advocate helping them) goes to a web page from any device and clears the app's real-mode data.

## Login: a wipe code, not an account

The app keeps no name, email, or password on the server, and the wipe page should not add one. Instead:

1. In Settings, Options, the person taps **Get remote wipe code**. The app makes a random 16 character code (80 bits), shows it once, and sends it to both servers. Each server stores only a SHA-256 hash of it on that phone's account.
2. They write the code down somewhere the other person will not find it, or give it to an advocate. Getting a new code replaces the old one.
3. To wipe, they open `https://<either server>/wipe`, enter the code, and submit. That code is the whole login: no username, no session, nothing to remember beyond it.

Why a code: it needs no personal data, works from a library computer or an advocate's phone, and a stolen phone does not reveal it (it is never stored on the phone after it is shown).

## What a wipe does

On the server, right away (on the server the code was entered on, which forwards it to the other server listed in `PEER_URLS`):
- Marks the account wiped. From then on every request with that phone's token gets `410 Gone`.
- Cancels armed check-ins, deletes the saved widget profile, and revokes the widget token.
- If the person ticks **Also delete my journal**, deletes every journal entry. Off by default, because the journal is often the evidence they will need later.

On the phone, the next time the app reaches either server (on open, on return to the foreground, or in the OS background task):
- Deletes everything in the keystore: PINs, contacts, message, tokens, alert history, check-in, safety plan.
- Clears the widget's shared storage and the paired watch's copy of the config, stops live location and recording, and resets the app icon.
- Returns to the weather screen. The app then looks freshly installed; five taps on the temperature leads to first-run setup.

Alerts already sent stay on the servers until the normal 30 day purge, so the contacts' map links keep working.

## Abuse and limits

- The page is plain HTML with no scripts, `noindex`, and `Cache-Control: no-store`. It answers the same way whether or not the code matched, so it cannot be used to test codes.
- Wipe attempts are limited per client address (5 an hour; forwarded attempts from a peer server get a separate, higher limit). With 80 bit codes, guessing is not practical.
- A wipe cannot be undone. The person sets the app up again from scratch.
- If the phone never comes online again, the phone-side wipe never runs. The server side still stops anything from being sent or read with that phone's token.

## Placeholders before launch

- A bot check (for example Cloudflare Turnstile) on the form, if the page gets abused.
- The wipe page lives on the alert servers' domains. If those domains should not be shared, put the page on a neutral domain that proxies `/wipe` to the servers.
