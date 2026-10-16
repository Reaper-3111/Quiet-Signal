import pg from 'pg';

export interface Db {
  query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS accounts (
     id text PRIMARY KEY,
     secret_hash text NOT NULL,
     quick_hash text,
     wipe_hash text,
     wiped boolean NOT NULL DEFAULT false,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS alerts (
     id text PRIMARY KEY,
     account_id text NOT NULL,
     kind text NOT NULL,
     duress boolean NOT NULL DEFAULT false,
     status text NOT NULL DEFAULT 'active',
     map_token text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     expires_at timestamptz NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS recipients (
     alert_id text NOT NULL,
     phone text NOT NULL,
     status text NOT NULL DEFAULT 'pending',
     provider_id text,
     safe_status text NOT NULL DEFAULT 'none',
     safe_id text,
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS points (
     alert_id text NOT NULL,
     lat double precision NOT NULL,
     lng double precision NOT NULL,
     at timestamptz NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS checkins (
     id text PRIMARY KEY,
     account_id text NOT NULL,
     due_at timestamptz NOT NULL,
     payload text NOT NULL,
     state text NOT NULL DEFAULT 'armed'
   )`,
  `CREATE TABLE IF NOT EXISTS journal (
     id text PRIMARY KEY,
     account_id text NOT NULL,
     kind text NOT NULL,
     alert_id text,
     body text NOT NULL,
     at timestamptz NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS profiles (
     account_id text PRIMARY KEY,
     contacts text NOT NULL,
     template text NOT NULL,
     dispatch boolean NOT NULL DEFAULT false,
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  // Columns added after the first deployment.
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS wipe_hash text`,
  `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS wiped boolean NOT NULL DEFAULT false`,
  `CREATE INDEX IF NOT EXISTS accounts_wipe ON accounts (wipe_hash)`,
  `CREATE INDEX IF NOT EXISTS journal_account ON journal (account_id)`,
  `CREATE INDEX IF NOT EXISTS alerts_map_token ON alerts (map_token)`,
  `CREATE INDEX IF NOT EXISTS points_alert ON points (alert_id)`,
  `CREATE INDEX IF NOT EXISTS recipients_alert ON recipients (alert_id)`,
];

export async function migrate(db: Db) {
  for (const stmt of SCHEMA) await db.query(stmt);
}

export function connect(url: string): Db {
  return new pg.Pool({ connectionString: url, max: 5 });
}
