const env = process.env;

export function loadConfig() {
  return {
    port: Number(env.PORT ?? 8080),
    publicUrl: (env.PUBLIC_URL ?? 'http://localhost:8080').replace(/\/$/, ''),
    databaseUrl: env.DATABASE_URL ?? '',
    twilio: { sid: env.TWILIO_ACCOUNT_SID, token: env.TWILIO_AUTH_TOKEN, from: env.TWILIO_FROM },
    telnyx: { key: env.TELNYX_API_KEY, from: env.TELNYX_FROM },
    dispatch: { url: env.DISPATCH_URL, token: env.DISPATCH_TOKEN },
    journalKey: env.JOURNAL_KEY,
    retentionDays: Number(env.RETENTION_DAYS ?? 30),
    liveWindowHours: Number(env.LIVE_WINDOW_HOURS ?? 2),
  };
}

export type Config = ReturnType<typeof loadConfig>;
