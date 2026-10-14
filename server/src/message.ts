export type Kind = 'instant' | 'hold' | 'checkin' | 'test' | 'intro';

export interface Loc {
  lat: number;
  lng: number;
  address?: string;
}

interface RenderInput {
  template: string;
  kind: Kind;
  duress: boolean;
  loc?: Loc;
  link: string;
}

/** Fills {address}, {coords}, {link} and adds the TEST / forced-cancel markers. */
export function renderMessage({ template, kind, duress, loc, link }: RenderInput): string {
  if (kind === 'intro') return template;
  const coords = loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : 'unavailable';
  let text = template
    .replaceAll('{address}', loc?.address || 'address unavailable')
    .replaceAll('{coords}', coords)
    .replaceAll('{link}', link);
  if (kind === 'test') text = `TEST: ${text}`;
  if (duress) text += ' (Sent after being forced to cancel. Treat as real.)';
  return text;
}
