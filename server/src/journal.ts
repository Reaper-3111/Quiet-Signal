import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { Hono } from 'hono';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import type { Db } from './db.js';

const MAX_DATA = 6_000_000; // base64 characters, roughly 4.5 MB of file
const entry = z.object({
  id: z.string().uuid(),
  kind: z.enum(['note', 'photo', 'audio']),
  text: z.string().max(5000).optional(),
  data: z.string().max(MAX_DATA).optional(),
  mime: z.string().max(60).optional(),
  alertId: z.string().uuid().optional(),
  at: z.string().datetime().optional(),
}).refine((e) => e.text || e.data, 'empty entry');

interface Body { text?: string; data?: string; mime?: string }
interface Row { id: string; kind: string; alert_id: string | null; body: string; at: Date }

/** AES-256-GCM so a database leak alone reveals nothing. Stored as iv.tag.ciphertext (base64). */
function codec(keyB64: string) {
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) throw new Error('JOURNAL_KEY must be 32 bytes, base64');
  return {
    seal(b: Body) {
      const iv = randomBytes(12);
      const c = createCipheriv('aes-256-gcm', key, iv);
      const enc = Buffer.concat([c.update(JSON.stringify(b)), c.final()]);
      return [iv, c.getAuthTag(), enc].map((x) => x.toString('base64')).join('.');
    },
    open(s: string): Body {
      const [iv, tag, enc] = s.split('.').map((x) => Buffer.from(x, 'base64'));
      const d = createDecipheriv('aes-256-gcm', key, iv);
      d.setAuthTag(tag);
      return JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString());
    },
  };
}

/** Evidence journal: encrypted notes, photos, and audio, kept until the owner deletes them. */
export function mountJournal(app: Hono<{ Variables: { account: string } }>, db: Db, keyB64?: string) {
  const crypt = keyB64 ? codec(keyB64) : null;
  const need = (c: any) => (crypt ? null : c.json({ error: 'journal not configured' }, 503));

  const mine = async (account: string) =>
    (await db.query<Row>('SELECT id, kind, alert_id, body, at FROM journal WHERE account_id = $1 ORDER BY at', [account])).rows;

  app.post('/v1/journal', async (c) => {
    if (need(c)) return need(c);
    const parsed = entry.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid body' }, 400);
    const { id, kind, text, data, mime, alertId, at } = parsed.data;
    await db.query(
      `INSERT INTO journal (id, account_id, kind, alert_id, body, at) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`, // idempotent: the app may retry uploads
      [id, c.get('account'), kind, alertId ?? null, crypt!.seal({ text, data, mime }), at ?? new Date().toISOString()]);
    return c.json({ id });
  });

  app.get('/v1/journal', async (c) => {
    if (need(c)) return need(c);
    const rows = await mine(c.get('account'));
    return c.json(rows.map((r) => {
      const b = crypt!.open(r.body);
      return { id: r.id, kind: r.kind, at: r.at, alertId: r.alert_id, text: b.text, hasData: !!b.data };
    }));
  });

  app.get('/v1/journal/export.pdf', async (c) => {
    if (need(c)) return need(c);
    const rows = await mine(c.get('account'));
    const doc = new PDFDocument({ margin: 54 });
    const chunks: Buffer[] = [];
    doc.on('data', (d: Buffer) => chunks.push(d));
    const done = new Promise<void>((r) => doc.on('end', () => r()));

    doc.fontSize(18).text('Incident record');
    doc.fontSize(10).fillColor('#555').text(`Exported ${new Date().toUTCString()}. Times are UTC.`).moveDown();
    for (const r of rows) {
      const b = crypt!.open(r.body);
      doc.fillColor('#000').fontSize(11).text(new Date(r.at).toUTCString(), { underline: true });
      if (b.text) doc.fontSize(11).text(b.text);
      if (b.data && b.mime?.startsWith('image/')) {
        try { doc.image(Buffer.from(b.data, 'base64'), { fit: [400, 300] }); } catch { doc.text('[image could not be rendered]'); }
      } else if (b.data) doc.text(`[${r.kind} recording attached, ${b.mime ?? 'unknown format'}]`);
      doc.moveDown();
    }
    if (!rows.length) doc.text('No entries.');
    doc.end();
    await done;
    return c.body(Buffer.concat(chunks), 200, { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' });
  });

  app.get('/v1/journal/:id/data', async (c) => {
    if (need(c)) return need(c);
    const { rows } = await db.query<Row>('SELECT id, kind, alert_id, body, at FROM journal WHERE id = $1 AND account_id = $2', [c.req.param('id'), c.get('account')]);
    const b = rows[0] && crypt!.open(rows[0].body);
    if (!b?.data) return c.json({ error: 'not found' }, 404);
    return c.body(Buffer.from(b.data, 'base64'), 200, { 'Content-Type': b.mime ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  });

  app.delete('/v1/journal/:id', async (c) => {
    await db.query('DELETE FROM journal WHERE id = $1 AND account_id = $2', [c.req.param('id'), c.get('account')]);
    return c.body(null, 204);
  });
}
