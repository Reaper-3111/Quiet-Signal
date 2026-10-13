import { serve } from '@hono/node-server';
import { createApp, purgeExpired } from './app.js';
import { loadConfig } from './config.js';
import { connect, migrate } from './db.js';
import { buildDispatcher } from './dispatch.js';
import { buildProviders } from './sms.js';

const config = loadConfig();
const db = connect(config.databaseUrl);
await migrate(db);

const sms = buildProviders(config);
if (!sms.length) console.warn('No SMS provider configured; alerts will be recorded but not delivered.');

const { app, sweep } = createApp({ config, db, sms, dispatcher: buildDispatcher(config.dispatch) });
serve({ fetch: app.fetch, port: config.port }, ({ port }) => console.log(`listening on ${port}`));

const purge = () => purgeExpired(db, config.retentionDays).catch((e) => console.error('purge failed:', e.message));
purge();
setInterval(purge, 3_600_000);

setInterval(() => sweep().catch((e) => console.error('sweep failed:', e.message)), 30_000);
