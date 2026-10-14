import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { env, postJson } from './api';
import { SERVERS } from './config';

// The journal lives on one server (the first). The second is for alert delivery only.
const server = SERVERS[0];

export interface Entry {
  id: string;
  kind: 'note' | 'photo' | 'audio';
  at: string;
  text?: string;
  hasData: boolean;
}

const call = async (path: string, body?: unknown, method = 'POST') =>
  postJson(server, `/v1/journal${path}`, await env.token(server), body, 20_000, method);

export const listEntries = (): Promise<Entry[]> => call('', undefined, 'GET');
export const addNote = (text: string) => call('', { id: env.uuid(), kind: 'note', text });
export const addPhoto = (data: string, mime: string) => call('', { id: env.uuid(), kind: 'photo', data, mime });
export const addAudio = (data: string, alertId: string) => call('', { id: env.uuid(), kind: 'audio', data, mime: 'audio/mp4', alertId });

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/** Downloads the dated PDF, hands it to the share sheet, then deletes the local copy. */
export async function exportPdf() {
  const res = await fetch(`${server}/v1/journal/export.pdf`, { headers: { Authorization: `Bearer ${await env.token(server)}` } });
  if (!res.ok) throw new Error(String(res.status));
  const uri = `${FileSystem.cacheDirectory}incident-record.pdf`;
  await FileSystem.writeAsStringAsync(uri, toBase64(await res.arrayBuffer()), { encoding: FileSystem.EncodingType.Base64 });
  try {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}
