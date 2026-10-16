const env = process.env;

export function loadConfig() {
  return {
    port: Number(env.PORT ?? 8080),
    publicUrl: (env.PUBLIC_URL ?? 'http://localhost:8080').replace(/\/$/, ''),
    databaseUrl: env.DATABASE_URL ?? '',
    twilio: { sid: env.TWILIO_ACCOUNT_SID, token: env.TWILIO_AUTH_TOKEN, from: env.TWILIO_FROM },
    telnyx: { key: env.TELNYX_API_KEY, from: env.TELNYX_FROM },
    dispatch: { url: env.DISPATCH_URL, token: env.DISPATCH_TOKEN },
    trustProxy: env.TRUST_PROXY === 'true',
    journalKey: env.JOURNAL_KEY,
    // The other deployment(s), so a remote wipe entered on one reaches both.
    peerUrls: (env.PEER_URLS ?? '').split(',').map((u) => u.trim().replace(/\/$/, '')).filter(Boolean),
    retentionDays: Number(env.RETENTION_DAYS ?? 30),
    liveWindowHours: Number(env.LIVE_WINDOW_HOURS ?? 2),
  };
}

export type Config = ReturnType<typeof loadConfig>;
