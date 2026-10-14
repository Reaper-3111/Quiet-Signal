import type { Kind, Loc } from './types';

/**
 * Renders the alert text on the phone for the Messages fallback. The server
 * has the same logic plus the live-map link, which is unavailable here, so the
 * sentence holding {link} is dropped.
 */
export function renderLocal(template: string, kind: Kind, duress: boolean, loc?: Loc) {
  const coords = loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : 'unavailable';
  let text = template
    .replace(/[^.]*\{link\}\.?\s*/g, '')
    .replaceAll('{address}', loc?.address || 'address unavailable')
    .replaceAll('{coords}', coords)
    .trim();
  if (kind === 'test') text = `TEST: ${text}`;
  if (duress) text += ' (Sent after being forced to cancel. Treat as real.)';
  return text;
}

export const defaultTemplate = (name: string) =>
  `This is an automated alert from ${name || 'a friend'}. I may be in danger and cannot talk. ` +
  `My location: {address} ({coords}). Live map: {link}. Please call 911 if you cannot reach me.`;

export const introText = (name: string) =>
  `${name || 'A friend'} chose you as a safety contact. If they ever need help you will get a text from this number ` +
  `with their location and a live map. Please save this number as "Safety Alert". Replies are not monitored.`;

/** Accepts "574-555-0100", "(574) 555 0100", "+44 ..." and returns E.164 or null. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  const e164 = digits.startsWith('+') ? digits : digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits[0] === '1' ? `+${digits}` : '';
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}
