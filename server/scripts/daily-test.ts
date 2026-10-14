// Daily end-to-end check: fires a TEST alert through every server to a test number
// and waits for a delivery receipt. Exits non-zero (and pings FAILURE_WEBHOOK) on any failure.
// Schedule with cron or a CI job:  SERVER_URLS=https://a,https://b TEST_NUMBER=+1555... npx tsx scripts/daily-test.ts
import { randomUUID } from 'node:crypto';

const servers = (process.env.SERVER_URLS ?? '').split(',').filter(Boolean);
const to = process.env.TEST_NUMBER;
if (!servers.length || !to) throw new Error('Set SERVER_URLS and TEST_NUMBER');

async function api(server: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(server + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json() as Promise<any>;
}

async function check(server: string) {
  const { token } = await api(server, '/v1/register', undefined, {});
  const id = randomUUID();
  await api(server, '/v1/alerts', token, { id, kind: 'test', template: 'Daily check. {link}', contacts: [to] });
  for (let i = 0; i < 12; i++) {
    const { recipients } = await api(server, `/v1/alerts/${id}`, token);
    if (recipients[0].status === 'delivered') return;
    if (recipients[0].status === 'failed') break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('no delivery receipt');
}

const failures: string[] = [];
for (const s of servers) await check(s).catch((e) => failures.push(`${s}: ${e.message}`));

if (failures.length) {
  console.error(failures.join('\n'));
  if (process.env.FAILURE_WEBHOOK) {
    await fetch(process.env.FAILURE_WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `Daily alert test failed:\n${failures.join('\n')}` }) }).catch(() => {});
  }
  process.exit(1);
}
console.log('all servers delivered');
