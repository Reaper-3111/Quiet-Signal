import { getAppIconName, setAlternateAppIcon, supportsAlternateIcons } from 'expo-alternate-app-icons';
import { guard } from './guard';

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

/** iOS only changes icons in the foreground, so a wipe run by the background task finishes the reset here. */
export async function resetIconIfWiped(setupDone: boolean) {
  if (setupDone || !supportsAlternateIcons || !getAppIconName()) return;
  guard.systemDialog = true; // iOS confirms the change with a system alert
  try { await setAlternateAppIcon(null); } finally { guard.systemDialog = false; }
}
