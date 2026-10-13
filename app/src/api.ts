import * as Linking from 'expo-linking';
import * as Crypto from 'expo-crypto';
import * as SMS from 'expo-sms';
import { SERVERS, SERVER_TIMEOUT_MS } from './config';
import { locate } from './location';
import { load, update } from './storage';
import type { Env } from './alert';

export async function postJson(server: string, path: string, token: string | undefined, body: unknown, ms: number, method = 'POST') {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  const res = await fetch(server + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: method === 'GET' ? undefined : JSON.stringify(body),
    signal: ctl.signal,
  }).finally(() => clearTimeout(timer));
  if (!res.ok) throw new Error(String(res.status));
  return res.status === 204 ? null : res.json();
}

async function token(server: string) {
  const { settings } = await load();
  if (settings.tokens[server]) return settings.tokens[server];
  const { token: t } = await postJson(server, '/v1/register', undefined, {}, SERVER_TIMEOUT_MS);
  await update((s) => { s.settings.tokens[server] = t; });
  return t as string;
}

export const env: Env = {
  servers: SERVERS,
  timeoutMs: SERVER_TIMEOUT_MS,
  uuid: () => Crypto.randomUUID(),
  now: () => new Date(),
  token,
  post: (server, path, t, body, ms) => postJson(server, path, t, body, ms),
  locate,
  async compose(contacts, text) {
    if (!(await SMS.isAvailableAsync())) return false;
    await SMS.sendSMSAsync(contacts, text);
    return true;
  },
  dial911: async () => { await Linking.openURL('tel:911'); },
  save: async (rec) => {
    await update((s) => {
      const i = s.alerts.findIndex((a) => a.id === rec.id);
      if (i >= 0) s.alerts[i] = { ...s.alerts[i], ...rec }; else s.alerts.push(rec);
    });
  },
};
