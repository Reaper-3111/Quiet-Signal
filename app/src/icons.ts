import { setAlternateAppIcon, supportsAlternateIcons } from 'expo-alternate-app-icons';

/** Decoy looks shipped with the app (app.json, expo-alternate-app-icons). The name stays the same; only the icon changes. */
export const ICONS: { name?: string; label: string }[] = [
  { label: 'Default' },
  { name: 'Sunny', label: 'Sunny' },
  { name: 'Storm', label: 'Storm' },
  { name: 'Night', label: 'Night' },
];

export const iconsSupported = supportsAlternateIcons;

export async function setIcon(name: string | undefined) {
  if (supportsAlternateIcons) await setAlternateAppIcon(name ?? null);
}
