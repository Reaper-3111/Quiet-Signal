import * as Crypto from 'expo-crypto';
import { postJson } from './api';
import { stopRecording } from './audio';
import { SERVERS, SERVER_TIMEOUT_MS } from './config';
import { setIcon } from './icons';
import { stopLive } from './location';
import { load, update, wipe } from './storage';
import { clearWidgets } from './widgets';

// Remote wipe, phone side. See docs/remote-wipe.md.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I to misread

/** Makes a new code, registers it on every server, and returns it to show once. Never stored on the phone. */
export async function newWipeCode() {
  const bytes = Crypto.getRandomBytes(16);
  const raw = Array.from(bytes, (b) => ALPHABET[b % 32]).join('');
  const code = raw.match(/.{4}/g)!.join('-');
  const { settings } = await load();
  let ok = 0;
  for (const s of SERVERS) {
    const token = settings.tokens[s];
    if (!token) continue;
    await postJson(s, '/v1/wipe-code', token, { code }, SERVER_TIMEOUT_MS * 2, 'PUT').then(() => ok++, () => {});
  }
  if (!ok) throw new Error('no server');
  await update((st) => { st.settings.wipeSet = true; });
  return { code, everyServer: ok === SERVERS.length };
}

/** Asks each server whether this phone was wiped from the web page; clears the app if so. Returns true when it wiped. */
export async function checkWipe() {
  const { settings } = await load();
  for (const [server, token] of Object.entries(settings.tokens)) {
    const wiped = await postJson(server, '/v1/ping', token, undefined, SERVER_TIMEOUT_MS, 'GET').then(() => false, (e: Error) => e.message === '410');
    if (wiped) {
      await wipeLocal();
      return true;
    }
  }
  return false;
}

/** Leaves the app as if freshly installed. */
export async function wipeLocal() {
  stopRecording();
  await Promise.allSettled([stopLive(), clearWidgets(), setIcon(undefined)]);
  await wipe();
}
