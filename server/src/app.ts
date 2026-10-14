import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Config } from './config.js';
import type { Db } from './db.js';
import type { Dispatcher } from './dispatch.js';
import { mountJournal } from './journal.js';
import { mapPage } from './mapPage.js';
import { renderMessage } from './message.js';
import { sendSms, twilioSignature, type SmsProvider } from './sms.js';

export interface Deps {
  config: Config;
  db: Db;
  sms: SmsProvider[];
  dispatcher: Dispatcher | null;
}

const phone = z.string().regex(/^\+[1-9]\d{7,14}$/);
const loc = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().max(200).optional(),
});
const alertBody = z.object({
  id: z.string().uuid(),
  kind: z.enum(['instant', 'hold', 'checkin', 'test', 'intro']),
  duress: z.boolean().default(false),
  template: z.string().min(1).max(600),
  contacts: z.array(phone).min(1).max(5),
  dispatch: z.boolean().default(false),
  loc: loc.optional(),
});
const profileBody = alertBody.pick({ template: true, contacts: true, dispatch: true });
const quickBody = z.object({ id: z.string().uuid(), loc: loc.optional() });
const checkinBody = alertBody.omit({ kind: true, duress: true }).extend({ dueAt: z.string().datetime() });
const pointsBody = z.object({
  points: z.array(z.object({ lat: loc.shape.lat, lng: loc.shape.lng, at: z.string().datetime().optional() })).min(1).max(50),
});
const fireBody = z.object({ duress: z.boolean().default(false) });
const safeBody = z.object({ message: z.string().min(1).max(300) });

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

/** Fixed-window counter per key; enough to blunt SMS abuse. */
function limiter(max: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (key: string) => {
    const now = Date.now();
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    const h = hits.get(key);
    if (!h || h.reset < now) {
      hits.set(key, { n: 1, reset: now + windowMs });
      return true;
    }
    return ++h.n <= max;
  };
}

type AlertInput = z.infer<typeof alertBody>;

export function createApp({ config, db, sms, dispatcher }: Deps) {
  const app = new Hono<{ Variables: { account: string } }>();
  const registerLimit = limiter(10, 3_600_000);
  const sendLimit = limiter(20, 3_600_000);
  const safeLimit = limiter(10, 3_600_000);
  const introLimit = limiter(5, 86_400_000);
  const tooLarge = (c: Context) => c.json({ error: 'too large' }, 413);
  const small = bodyLimit({ maxSize: 65_536, onError: tooLarge });
  const large = bodyLimit({ maxSize: 8_000_000, onError: tooLarge });
  app.use('*', (c, next) => (c.req.path.startsWith('/v1/journal') ? large : small)(c, next));

  /** The caller's address. X-Forwarded-For is only believed behind a proxy we control, and only its last hop. */
  const clientIp = (c: Context) => {
    if (config.trustProxy) return c.req.header('x-forwarded-for')?.split(',').pop()?.trim() || 'local';
    try { return getConnInfo(c).remote.address ?? 'local'; } catch { return 'local'; }
  };

  const bad = (c: Context, msg: string, status: 400 | 404 | 429 = 400) => c.json({ error: msg }, status);

  app.get('/health', (c) => c.json({ ok: true }));

  app.post('/v1/register', async (c) => {
    if (!registerLimit(clientIp(c))) return bad(c, 'rate limited', 429);
    const id = randomUUID();
    const secret = randomBytes(24).toString('base64url');
    await db.query('INSERT INTO accounts (id, secret_hash) VALUES ($1, $2)', [id, hash(secret)]);
    return c.json({ token: `${id}.${secret}` });
  });

  app.use('/v1/alerts/*', auth);
  app.use('/v1/alerts', auth);

  app.use('/v1/journal/*', auth);
  app.use('/v1/journal', auth);
  app.use('/v1/profile', auth);
  app.use('/v1/quick-token', auth);
  mountJournal(app, db, config.journalKey);

  async function auth(c: Context, next: () => Promise<void>) {
    const [id, secret] = (c.req.header('authorization')?.replace(/^Bearer /, '') ?? '').split('.');
    if (id && secret) {
      // The widget's token only works on /v1/alerts/quick; the main token never does.
      const col = c.req.path === '/v1/alerts/quick' ? 'quick_hash' : 'secret_hash';
      const { rows } = await db.query<Record<string, string | null>>(`SELECT ${col} FROM accounts WHERE id = $1`, [id]);
      const a = Buffer.from(hash(secret));
      const b = Buffer.from(rows[0]?.[col] ?? '');
      if (a.length === b.length && timingSafeEqual(a, b)) {
        c.set('account' as never, id as never);
        return next();
      }
    }
    return c.json({ error: 'unauthorized' }, 401);
  }

  /** Sends to every recipient still pending (the alert text, or the "I'm safe" follow-up) and records the outcome. */
  async function fanOut(alertId: string, body: string, safe = false) {
    const [status, pid] = safe ? ['safe_status', 'safe_id'] : ['status', 'provider_id'];
    const { rows } = await db.query<{ phone: string }>(
      `SELECT phone FROM recipients WHERE alert_id = $1 AND ${status} = 'pending'`, [alertId]);
    await Promise.all(rows.map(async ({ phone }) => {
      try {
        const r = await sendSms(sms, phone, body);
        await db.query(
          `UPDATE recipients SET ${status} = 'sent', ${pid} = $1, updated_at = now() WHERE alert_id = $2 AND phone = $3`,
          [r.id, alertId, phone]);
      } catch {
        await db.query(`UPDATE recipients SET ${status} = 'failed', updated_at = now() WHERE alert_id = $1 AND phone = $2`, [alertId, phone]);
      }
    }));
  }

  async function recipientsOf(alertId: string) {
    const { rows } = await db.query<{ phone: string; status: string; safe_status: string }>(
      'SELECT phone, status, safe_status FROM recipients WHERE alert_id = $1', [alertId]);
    return rows;
  }

  /** Stores the alert (once) and texts every recipient that has not been texted yet. */
  async function createAlert(account: string, a: AlertInput) {
    // Idempotent: the app may retry the same id from its queue.
    const { rows: existing } = await db.query<{ map_token: string; account_id: string }>(
      'SELECT map_token, account_id FROM alerts WHERE id = $1', [a.id]);
    if (existing[0] && existing[0].account_id !== account) return null;
    let token = existing[0]?.map_token;

    if (!token) {
      token = randomBytes(16).toString('base64url');
      await db.query(
        `INSERT INTO alerts (id, account_id, kind, duress, map_token, expires_at)
         VALUES ($1, $2, $3, $4, $5, now() + ($6 || ' hours')::interval)`,
        [a.id, account, a.kind, a.duress, token, String(config.liveWindowHours)]);
      for (const p of a.contacts) await db.query('INSERT INTO recipients (alert_id, phone) VALUES ($1, $2)', [a.id, p]);
      if (a.loc) await db.query('INSERT INTO points (alert_id, lat, lng, at) VALUES ($1, $2, $3, now())', [a.id, a.loc.lat, a.loc.lng]);
    }

    const link = `${config.publicUrl}/m/${token}`;
    const text = renderMessage({ template: a.template, kind: a.kind, duress: a.duress, loc: a.loc, link });
    await fanOut(a.id, text);

    if (a.dispatch && a.kind !== 'test' && a.kind !== 'intro' && !dispatcher) console.error('dispatch requested but not configured');
    if (a.dispatch && a.kind !== 'test' && a.kind !== 'intro' && dispatcher) {
      await dispatcher.alert({ alertId: a.id, loc: a.loc, message: text }).catch((e) => console.error('dispatch failed:', e.message));
    }
    return { id: a.id, link, recipients: await recipientsOf(a.id) };
  }

  app.post('/v1/alerts', async (c) => {
    const parsed = alertBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return bad(c, 'invalid body');
    const account = c.get('account');
    if (!sendLimit(account) || (parsed.data.kind === 'intro' && !introLimit(account))) return bad(c, 'rate limited', 429);
    const result = await createAlert(account, parsed.data);
    return result ? c.json(result) : bad(c, 'invalid body');
  });

  // A credential for the widget that can do one thing: send the saved alert. Rotated on every call.
  app.post('/v1/quick-token', async (c) => {
    const secret = randomBytes(24).toString('base64url');
    await db.query('UPDATE accounts SET quick_hash = $1 WHERE id = $2', [hash(secret), c.get('account')]);
    return c.json({ token: `${c.get('account')}.${secret}` });
  });

  // Saved contacts and message, so a widget can fire an alert with only an id and a location.
  // The app refreshes this whenever it is opened; stale profiles are purged with everything else.
  app.put('/v1/profile', async (c) => {
    const parsed = profileBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return bad(c, 'invalid body');
    const { contacts, template, dispatch } = parsed.data;
    await db.query('DELETE FROM profiles WHERE account_id = $1', [c.get('account')]);
    await db.query('INSERT INTO profiles (account_id, contacts, template, dispatch) VALUES ($1, $2, $3, $4)',
      [c.get('account'), JSON.stringify(contacts), template, dispatch]);
    return c.body(null, 204);
  });

  app.post('/v1/alerts/quick', async (c) => {
    const parsed = quickBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return bad(c, 'invalid body');
    const account = c.get('account');
    if (!sendLimit(account)) return bad(c, 'rate limited', 429);
    const { rows } = await db.query<{ contacts: string; template: string; dispatch: boolean }>(
      'SELECT contacts, template, dispatch FROM profiles WHERE account_id = $1', [account]);
    if (!rows[0]) return bad(c, 'no profile', 404);
    const result = await createAlert(account, {
      id: parsed.data.id, kind: 'instant', duress: false, loc: parsed.data.loc,
      contacts: JSON.parse(rows[0].contacts), template: rows[0].template, dispatch: rows[0].dispatch,
    });
    return result ? c.json(result) : bad(c, 'invalid body');
  });

  // Dead-man check-in: the server holds the alert and fires it unless cancelled in time.
  app.use('/v1/checkins/*', auth);
  app.use('/v1/checkins', auth);

  app.post('/v1/checkins', async (c) => {
    const parsed = checkinBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return bad(c, 'invalid body');
    const { id, dueAt, ...payload } = parsed.data;
    await db.query(
      `INSERT INTO checkins (id, account_id, due_at, payload) VALUES ($1, $2, $3, $4)`,
      [id, c.get('account'), dueAt, JSON.stringify(payload)]);
    return c.json({ id });
  });

  app.post('/v1/checkins/:id/cancel', async (c) => {
    await db.query(`UPDATE checkins SET state = 'cancelled' WHERE id = $1 AND account_id = $2 AND state = 'armed'`,
      [c.req.param('id'), c.get('account')]);
    return c.body(null, 204);
  });

  app.post('/v1/checkins/:id/fire', async (c) => {
    const parsed = fireBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return bad(c, 'invalid body');
    const fired = await fireCheckin(c.req.param('id'), c.get('account'), parsed.data.duress);
    return fired ? c.json(fired) : bad(c, 'not found', 404);
  });

  async function fireCheckin(id: string, account?: string, duress = false) {
    const { rows } = await db.query<{ account_id: string; payload: string }>(
      `UPDATE checkins SET state = 'fired' WHERE id = $1 AND state = 'armed' ${account ? 'AND account_id = $2' : ''}
       RETURNING account_id, payload`, account ? [id, account] : [id]);
    if (!rows[0]) return null;
    const payload = JSON.parse(rows[0].payload);
    try {
      return await createAlert(rows[0].account_id, { ...payload, id, kind: 'checkin', duress });
    } catch (err) {
      await db.query(`UPDATE checkins SET state = 'armed' WHERE id = $1`, [id]); // the next sweep retries; sends are idempotent
      throw err;
    }
  }

  /** Fires every armed check-in that has come due. Run on an interval. */
  async function sweep() {
    const { rows } = await db.query<{ id: string }>(`SELECT id FROM checkins WHERE state = 'armed' AND due_at <= now()`);
    for (const { id } of rows) await fireCheckin(id).catch((e) => console.error('checkin failed:', e.message));
  }

  app.post('/v1/alerts/:id/points', async (c) => {
    const parsed = pointsBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return bad(c, 'invalid body');
    const { rows } = await db.query<{ status: string; expires_at: Date }>(
      'SELECT status, expires_at FROM alerts WHERE id = $1 AND account_id = $2', [c.req.param('id'), c.get('account')]);
    if (!rows[0]) return bad(c, 'not found', 404);
    const live = rows[0].status === 'active' && new Date(rows[0].expires_at) > new Date();
    if (live) {
      for (const p of parsed.data.points) {
        await db.query('INSERT INTO points (alert_id, lat, lng, at) VALUES ($1, $2, $3, $4)',
          [c.req.param('id'), p.lat, p.lng, p.at ?? new Date().toISOString()]);
      }
    }
    return c.json({ live });
  });

  app.post('/v1/alerts/:id/safe', async (c) => {
    const parsed = safeBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return bad(c, 'invalid body');
    const id = c.req.param('id');
    const { rows } = await db.query('SELECT 1 FROM alerts WHERE id = $1 AND account_id = $2', [id, c.get('account')]);
    if (!rows[0]) return bad(c, 'not found', 404);
    if (!safeLimit(c.get('account'))) return bad(c, 'rate limited', 429);
    await db.query(`UPDATE alerts SET status = 'safe' WHERE id = $1`, [id]);
    await db.query(`UPDATE recipients SET safe_status = 'pending' WHERE alert_id = $1 AND safe_status IN ('none', 'failed')`, [id]);
    await fanOut(id, parsed.data.message, true);
    return c.json({ recipients: await recipientsOf(id) });
  });

  app.get('/v1/alerts/:id', async (c) => {
    const { rows } = await db.query<{ kind: string; status: string; duress: boolean; created_at: Date }>(
      'SELECT kind, status, duress, created_at FROM alerts WHERE id = $1 AND account_id = $2', [c.req.param('id'), c.get('account')]);
    if (!rows[0]) return bad(c, 'not found', 404);
    return c.json({ ...rows[0], recipients: await recipientsOf(c.req.param('id')) });
  });

  // Public live map for contacts. The unguessable token is the only credential.
  app.get('/m/:token', (c) => c.html(mapPage(c.req.param('token').replace(/[^\w-]/g, ''))));

  app.get('/m/:token/data', async (c) => {
    const { rows } = await db.query<{ id: string; status: string; expires_at: Date }>(
      'SELECT id, status, expires_at FROM alerts WHERE map_token = $1', [c.req.param('token')]);
    if (!rows[0]) return bad(c, 'not found', 404);
    const { rows: points } = await db.query(
      'SELECT lat, lng, at FROM points WHERE alert_id = $1 ORDER BY at DESC LIMIT 500', [rows[0].id]);
    c.header('Cache-Control', 'no-store');
    return c.json({
      active: rows[0].status === 'active' && new Date(rows[0].expires_at) > new Date(),
      points: points.reverse(),
    });
  });

  // Twilio delivery receipts.
  app.post('/hooks/twilio', async (c) => {
    const params = Object.fromEntries(new URLSearchParams(await c.req.text()));
    const { token } = config.twilio;
    const given = Buffer.from(c.req.header('x-twilio-signature') ?? '');
    const expected = Buffer.from(token ? twilioSignature(token, `${config.publicUrl}/hooks/twilio`, params) : '');
    if (!token || given.length !== expected.length || !timingSafeEqual(given, expected)) return c.json({ error: 'forbidden' }, 403);
    const status = params.MessageStatus === 'delivered' ? 'delivered'
      : ['failed', 'undelivered'].includes(params.MessageStatus) ? 'failed' : null;
    if (status) {
      await db.query('UPDATE recipients SET status = $1, updated_at = now() WHERE provider_id = $2', [status, params.MessageSid]);
      await db.query('UPDATE recipients SET safe_status = $1, updated_at = now() WHERE safe_id = $2', [status, params.MessageSid]);
    }
    return c.body(null, 204);
  });

  return { app, sweep };
}

/** Deletes alerts, trails and recipients older than the retention window. */
export async function purgeExpired(db: Db, days: number) {
  const cutoff = `now() - ($1 || ' days')::interval`;
  const old = `SELECT id FROM alerts WHERE created_at < ${cutoff}`;
  await db.query(`DELETE FROM profiles WHERE updated_at < ${cutoff}`, [String(days)]);
  await db.query(`DELETE FROM checkins WHERE due_at < ${cutoff}`, [String(days)]);
  for (const t of ['recipients', 'points']) await db.query(`DELETE FROM ${t} WHERE alert_id IN (${old})`, [String(days)]);
  await db.query(`DELETE FROM alerts WHERE created_at < ${cutoff}`, [String(days)]);
}
