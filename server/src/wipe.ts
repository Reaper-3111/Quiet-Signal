import { createHash } from 'node:crypto';
import type { Context, Hono } from 'hono';
import { z } from 'zod';
import type { Db } from './db.js';

/** Codes are shown as XXXX-XXXX-XXXX-XXXX; case, spaces and dashes do not matter. */
export const wipeHash = (code: string) => createHash('sha256').update(code.toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');

const codeBody = z.object({ code: z.string().regex(/^[A-Za-z0-9 -]{16,40}$/) });
const FORWARDED = 'x-wipe-forwarded';

const page = (msg = '') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Clear app data</title>
<style>body{font:16px system-ui;max-width:28rem;margin:3rem auto;padding:0 1rem}input[type=text]{width:100%;padding:.6rem;font:inherit;box-sizing:border-box}button{margin-top:1rem;padding:.6rem 1.2rem;font:inherit}</style>
</head><body>
<h1>Clear app data</h1>
${msg ? `<p><strong>${msg}</strong></p>` : ''}
<p>Enter the wipe code you saved. The next time the phone goes online, the app's private data is deleted and it goes back to a plain weather app. Alerts already sent are not affected. This cannot be undone.</p>
<form method="post" action="/wipe">
<label>Wipe code<br><input type="text" name="code" autocomplete="off" autocapitalize="characters" required></label>
<p><label><input type="checkbox" name="journal"> Also delete my journal (photos, notes and recordings). Leave this off if you may need them as evidence.</label></p>
<button type="submit">Clear app data</button>
</form>
</body></html>`;

interface Opts {
  peerUrls: string[];
  limit: (key: string) => boolean;
  clientIp: (c: Context) => string;
}

/** Remote wipe: the app registers a code, and the code alone (entered on a web page) wipes the account. See docs/remote-wipe.md. */
export function mountWipe(app: Hono<{ Variables: { account: string } }>, db: Db, { peerUrls, limit, clientIp }: Opts) {
  app.put('/v1/wipe-code', async (c) => {
    const parsed = codeBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid body' }, 400);
    await db.query('UPDATE accounts SET wipe_hash = $1 WHERE id = $2', [wipeHash(parsed.data.code), c.get('account')]);
    return c.body(null, 204);
  });

  // Cheap authenticated call the app makes to learn whether it was wiped (auth answers 410 if so).
  app.get('/v1/ping', (c) => c.body(null, 204));

  const html = (c: Context, msg?: string) => {
    c.header('Cache-Control', 'no-store');
    return c.html(page(msg));
  };

  app.get('/wipe', (c) => html(c));

  app.post('/wipe', async (c) => {
    const form = await c.req.parseBody().catch(() => ({} as Record<string, unknown>));
    const code = typeof form.code === 'string' ? form.code : '';
    const forwarded = !!c.req.header(FORWARDED);
    if (!limit(`${forwarded ? 'peer' : 'ip'}:${clientIp(c)}`)) return html(c, 'Too many tries. Wait an hour and try again.');
    if (codeBody.safeParse({ code }).success) {
      await wipe(db, wipeHash(code), !!form.journal);
      if (!forwarded) {
        const body = new URLSearchParams({ code, ...(form.journal ? { journal: 'on' } : {}) });
        await Promise.all(peerUrls.map((u) => fetch(`${u}/wipe`, {
          method: 'POST', body, headers: { [FORWARDED]: '1' }, signal: AbortSignal.timeout(5000),
        }).catch((e) => console.error('wipe forward failed:', e.message))));
      }
    }
    // Same answer either way, so the page cannot be used to check codes.
    return html(c, 'Done. If the code was right, the app clears itself the next time the phone is online.');
  });
}

async function wipe(db: Db, hash: string, journal: boolean) {
  const { rows } = await db.query<{ id: string }>('UPDATE accounts SET wiped = true, quick_hash = NULL WHERE wipe_hash = $1 RETURNING id', [hash]);
  for (const { id } of rows) {
    await db.query(`UPDATE checkins SET state = 'cancelled' WHERE account_id = $1 AND state = 'armed'`, [id]);
    await db.query('DELETE FROM profiles WHERE account_id = $1', [id]);
    if (journal) await db.query('DELETE FROM journal WHERE account_id = $1', [id]);
  }
}
