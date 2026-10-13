import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, describe, it } from 'node:test';
import { newDb } from 'pg-mem';
import { createApp, purgeExpired } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { migrate, type Db } from '../src/db.js';
import { sendSms, twilioSignature, type SmsProvider } from '../src/sms.js';

const sent: { to: string; body: string }[] = [];
const ok: SmsProvider = { name: 'ok', async send(to, body) { sent.push({ to, body }); return { id: `m-${sent.length}` }; } };
const broken: SmsProvider = { name: 'broken', async send() { throw new Error('down'); } };

const TEMPLATE = 'Alert from Sam. Location: {address} ({coords}). Map: {link}';
const contacts = ['+15551230001', '+15551230002'];

let db: Db;
let app: ReturnType<typeof createApp>['app'];
let sweep: ReturnType<typeof createApp>['sweep'];
let auth: Record<string, string>;
const config = { ...loadConfig(), journalKey: Buffer.alloc(32, 7).toString('base64'), publicUrl: 'https://a.test', twilio: { sid: 'AC1', token: 'tok', from: '+1' } };

const call = (path: string, body?: unknown, headers: Record<string, string> = auth) =>
  app.request(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

before(async () => {
  db = new (newDb().adapters.createPg().Pool)() as unknown as Db;
  await migrate(db);
  ({ app, sweep } = createApp({ config, db, sms: [broken, ok], dispatcher: null }));
  const res = await app.request('/v1/register', { method: 'POST' });
  auth = { authorization: `Bearer ${((await res.json()) as any).token}` };
});

describe('alerts', () => {
  it('rejects unauthenticated requests', async () => {
    assert.equal((await call('/v1/alerts', {}, {})).status, 401);
  });

  it('sends the rendered message to every contact, falling back to the second provider', async () => {
    sent.length = 0;
    const id = randomUUID();
    const res = await call('/v1/alerts', {
      id, kind: 'instant', template: TEMPLATE, contacts,
      loc: { lat: 41.6764, lng: -86.2520, address: '1 Main St' },
    });
    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(sent.length, 2);
    assert.match(sent[0].body, /1 Main St \(41\.67640, -86\.25200\)/);
    assert.ok(sent[0].body.includes(body.link));
    assert.deepEqual(body.recipients.map((r: any) => r.status), ['sent', 'sent']);
  });

  it('is idempotent on retry', async () => {
    sent.length = 0;
    const payload = { id: randomUUID(), kind: 'instant', template: TEMPLATE, contacts: [contacts[0]] };
    await call('/v1/alerts', payload);
    await call('/v1/alerts', payload);
    assert.equal(sent.length, 1);
  });

  it('marks test alerts and duress alerts', async () => {
    sent.length = 0;
    await call('/v1/alerts', { id: randomUUID(), kind: 'test', template: TEMPLATE, contacts: [contacts[0]] });
    await call('/v1/alerts', { id: randomUUID(), kind: 'hold', duress: true, template: TEMPLATE, contacts: [contacts[0]] });
    assert.match(sent[0].body, /^TEST: /);
    assert.match(sent[1].body, /forced to cancel/);
    assert.match(sent[1].body, /address unavailable/);
  });

  it('records failed sends so the status screen can show them', async () => {
    const { app: failing } = createApp({ config, db, sms: [broken], dispatcher: null });
    const res = await failing.request('/v1/alerts', {
      method: 'POST', headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ id: randomUUID(), kind: 'instant', template: TEMPLATE, contacts: [contacts[0]] }),
    });
    assert.equal(((await res.json()) as any).recipients[0].status, 'failed');
  });

  it('validates input', async () => {
    const res = await call('/v1/alerts', { id: randomUUID(), kind: 'instant', template: 'x', contacts: ['555-1212'] });
    assert.equal(res.status, 400);
  });
});

describe('live location', () => {
  it('streams points to the public map until the person is safe', async () => {
    const id = randomUUID();
    const { link } = (await (await call('/v1/alerts', {
      id, kind: 'instant', template: TEMPLATE, contacts: [contacts[0]], loc: { lat: 1, lng: 2 },
    })).json()) as any;
    const token = link.split('/m/')[1];

    await call(`/v1/alerts/${id}/points`, { points: [{ lat: 3, lng: 4 }] });
    let map: any = await (await app.request(`/m/${token}/data`)).json();
    assert.equal(map.active, true);
    assert.equal(map.points.length, 2);

    sent.length = 0;
    await call(`/v1/alerts/${id}/safe`, { message: 'I am safe.' });
    assert.equal(sent[0].body, 'I am safe.');
    const after: any = await (await call(`/v1/alerts/${id}/points`, { points: [{ lat: 5, lng: 6 }] })).json();
    assert.equal(after.live, false);
    map = await (await app.request(`/m/${token}/data`)).json();
    assert.equal(map.active, false);
    assert.equal(map.points.length, 2);
  });

  it('does not reveal other accounts alerts', async () => {
    const other = await (await app.request('/v1/register', { method: 'POST' })).json() as any;
    const id = randomUUID();
    await call('/v1/alerts', { id, kind: 'instant', template: TEMPLATE, contacts: [contacts[0]] });
    const res = await call(`/v1/alerts/${id}`, undefined, { authorization: `Bearer ${other.token}` });
    assert.equal(res.status, 404);
  });
});

describe('quick alert from a saved profile', () => {
  it('sends using the saved contacts and message', async () => {
    assert.equal((await call('/v1/alerts/quick', { id: randomUUID() })).status, 404);
    await app.request('/v1/profile', { method: 'PUT', headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ template: TEMPLATE, contacts: [contacts[0]], dispatch: false }) });
    sent.length = 0;
    const res = await call('/v1/alerts/quick', { id: randomUUID(), loc: { lat: 1, lng: 2, address: 'A St' } });
    assert.equal(res.status, 200);
    assert.equal(sent.length, 1);
    assert.match(sent[0].body, /A St/);
  });
});

describe('check-in timer', () => {
  const body = (dueAt: string) => ({ id: randomUUID(), dueAt, template: TEMPLATE, contacts: [contacts[0]], loc: { lat: 1, lng: 2 } });

  it('fires once the deadline passes without a cancel', async () => {
    sent.length = 0;
    const b = body(new Date(Date.now() - 1000).toISOString());
    await call('/v1/checkins', b);
    await sweep();
    await sweep();
    assert.equal(sent.length, 1);
    assert.equal(((await (await call(`/v1/alerts/${b.id}`)).json()) as any).kind, 'checkin');
  });

  it('does not fire when cancelled or not yet due', async () => {
    sent.length = 0;
    const cancelled = body(new Date(Date.now() - 1000).toISOString());
    await call('/v1/checkins', cancelled);
    await call(`/v1/checkins/${cancelled.id}/cancel`, {});
    await call('/v1/checkins', body(new Date(Date.now() + 3_600_000).toISOString()));
    await sweep();
    assert.equal(sent.length, 0);
  });

  it('fires immediately with the duress flag', async () => {
    sent.length = 0;
    const b = body(new Date(Date.now() + 3_600_000).toISOString());
    await call('/v1/checkins', b);
    await call(`/v1/checkins/${b.id}/fire`, { duress: true });
    assert.match(sent[0].body, /forced to cancel/);
  });
});

describe('evidence journal', () => {
  it('stores entries encrypted and returns them to the owner only', async () => {
    const id = randomUUID();
    await call('/v1/journal', { id, kind: 'note', text: 'He took my phone again' });
    await call('/v1/journal', { id, kind: 'note', text: 'duplicate ignored' });
    const list: any[] = await (await call('/v1/journal')).json() as any;
    assert.equal(list.filter((e) => e.id === id).length, 1);
    assert.equal(list.find((e) => e.id === id).text, 'He took my phone again');
    const raw = await db.query('SELECT body FROM journal WHERE id = $1', [id]);
    assert.ok(!raw.rows[0].body.includes('phone'));
    const other = await (await app.request('/v1/register', { method: 'POST' })).json() as any;
    const theirs: any[] = await (await call('/v1/journal', undefined, { authorization: `Bearer ${other.token}` })).json() as any;
    assert.equal(theirs.length, 0);
  });

  it('serves attachments and exports a PDF', async () => {
    const id = randomUUID();
    await call('/v1/journal', { id, kind: 'audio', data: Buffer.from('abc').toString('base64'), mime: 'audio/mp4' });
    const data = await call(`/v1/journal/${id}/data`);
    assert.equal(data.headers.get('content-type'), 'audio/mp4');
    assert.equal(await data.text(), 'abc');
    const pdf = await call('/v1/journal/export.pdf');
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
  });

  it('deletes entries', async () => {
    const id = randomUUID();
    await call('/v1/journal', { id, kind: 'note', text: 'x' });
    await app.request(`/v1/journal/${id}`, { method: 'DELETE', headers: auth });
    assert.equal((await db.query('SELECT 1 FROM journal WHERE id = $1', [id])).rows.length, 0);
  });
});

describe('delivery receipts and retention', () => {
  it('updates status from a signed Twilio callback and rejects unsigned ones', async () => {
    const id = randomUUID();
    await db.query(`INSERT INTO alerts (id, account_id, kind, map_token, expires_at) VALUES ($1, 'a', 'instant', 't', now())`, [id]);
    await db.query(`INSERT INTO recipients (alert_id, phone, status, provider_id) VALUES ($1, '+15551230009', 'sent', 'SM1')`, [id]);
    const params = { MessageSid: 'SM1', MessageStatus: 'delivered' };
    const url = 'https://a.test/hooks/twilio';
    const post = (sig: string) => app.request('/hooks/twilio', {
      method: 'POST', headers: { 'x-twilio-signature': sig, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
    assert.equal((await post('bad')).status, 403);
    assert.equal((await post(twilioSignature('tok', url, params))).status, 204);
    const { rows } = await db.query('SELECT status FROM recipients WHERE provider_id = $1', ['SM1']);
    assert.equal(rows[0].status, 'delivered');
  });

  it('purges old alerts', async () => {
    await db.query(`INSERT INTO alerts (id, account_id, kind, map_token, created_at, expires_at) VALUES ('old', 'a', 'instant', 'o', now() - interval '40 days', now())`);
    await db.query(`INSERT INTO points (alert_id, lat, lng, at) VALUES ('old', 1, 1, now())`);
    await purgeExpired(db, 30);
    assert.equal((await db.query(`SELECT 1 FROM alerts WHERE id = 'old'`)).rows.length, 0);
    assert.equal((await db.query(`SELECT 1 FROM points WHERE alert_id = 'old'`)).rows.length, 0);
  });

  it('sendSms throws when every provider fails', async () => {
    await assert.rejects(sendSms([broken], '+15551230001', 'x'));
  });
});
