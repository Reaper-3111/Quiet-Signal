import { fireAlert, type Env } from './alert';
import { env } from './api';
import { startRecording } from './audio';
import { startLive } from './location';
import { load } from './storage';
import type { Kind } from './types';

export const isReal = (k: Kind) => k !== 'intro' && k !== 'test';

/** Sends silently. Live tracking and audio start once a server has the alert. */
export async function sendAlert(kind: Kind, duress = false, e: Env = env) {
  const { settings } = await load();
  if (!settings.setupDone) return null;
  const out = await fireAlert(e, settings, kind, duress);
  if (out.via === 'server' && isReal(kind)) {
    startLive().catch(() => {});
    if (settings.recordAudio) startRecording(out.id).catch(() => {});
  }
  return out;
}
