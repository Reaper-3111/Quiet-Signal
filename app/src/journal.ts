import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { env, postJson } from './api';
import { SERVERS } from './config';
import { missing } from './sync';

// Every entry is written to both servers, so losing one server loses no evidence. Reads use the first that answers.

export interface Entry {
  id: string;
  kind: 'note' | 'photo' | 'audio';
  at: string;
  text?: string;
  alertId?: string | null;
  hasData: boolean;
}

const call = async (server: string, path: string, body?: unknown, method = 'POST') =>
  postJson(server, `/v1/journal${path}`, await env.token(server), body, 20_000, method);

/** Succeeds if at least one server stored it; repairJournal copies it to the other later. */
async function add(entry: object) {
  const body = { id: env.uuid(), at: new Date().toISOString(), ...entry };
  const results = await Promise.allSettled(SERVERS.map((s) => call(s, '', body)));
  if (!results.some((r) => r.status === 'fulfilled')) throw new Error('no server');
}

async function first<T>(fn: (server: string) => Promise<T>) {
  for (const s of SERVERS) {
    try { return await fn(s); } catch { /* next server */ }
  }
  throw new Error('no server');
}

export const listEntries = (): Promise<Entry[]> => first((s) => call(s, '', undefined, 'GET'));
export const addNote = (text: string) => add({ kind: 'note', text });
export const addPhoto = (data: string, mime: string) => add({ kind: 'photo', data, mime });
export const addAudio = (data: string, alertId: string) => add({ kind: 'audio', data, mime: 'audio/mp4', alertId });

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

const fetchRaw = async (server: string, path: string) => {
  const res = await fetch(`${server}${path}`, { headers: { Authorization: `Bearer ${await env.token(server)}` } });
  if (!res.ok) throw new Error(String(res.status));
  return res;
};

/** Copies entries that only one server has (a write that failed, or a server that was down) to the other. */
export async function repairJournal() {
  if (SERVERS.length < 2) return;
  const lists = await Promise.all(SERVERS.map((s) => (call(s, '', undefined, 'GET') as Promise<Entry[]>).catch(() => null)));
  for (const { from, to, entry: e } of missing(lists)) {
    try {
      let data: string | undefined;
      let mime: string | undefined;
      if (e.hasData) {
        const res = await fetchRaw(SERVERS[from], `/v1/journal/${e.id}/data`);
        mime = res.headers.get('content-type') ?? undefined;
        data = toBase64(await res.arrayBuffer());
      }
      await call(SERVERS[to], '', { id: e.id, kind: e.kind, text: e.text, data, mime, alertId: e.alertId ?? undefined, at: new Date(e.at).toISOString() });
    } catch {
      // tried again next time the journal opens
    }
  }
}

/** Downloads the dated PDF, hands it to the share sheet, then deletes the local copy. */
export async function exportPdf() {
  const res = await first((s) => fetchRaw(s, '/v1/journal/export.pdf'));
  const uri = `${FileSystem.cacheDirectory}incident-record.pdf`;
  await FileSystem.writeAsStringAsync(uri, toBase64(await res.arrayBuffer()), { encoding: FileSystem.EncodingType.Base64 });
  try {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}
