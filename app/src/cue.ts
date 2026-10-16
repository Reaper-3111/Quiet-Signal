import type { AlertRecord } from './types';

const SHOW_MS = 2 * 60 * 60 * 1000; // as long as live location runs

/** True while a real alert has been accepted by a server and not yet marked safe, so the decoy can show the cue. */
export const cueActive = (alerts: AlertRecord[], now = Date.now()) =>
  alerts.some((a) => a.state === 'sent' && !a.safe && !['intro', 'test'].includes(a.payload.kind) && now - new Date(a.at).getTime() < SHOW_MS);

/** Two short buzzes, only if the person chose vibration. */
export const VIBRATION = [0, 60, 120, 60];
