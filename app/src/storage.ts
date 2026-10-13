import * as SecureStore from 'expo-secure-store';
import { defaultTemplate } from './message';
import type { State } from './types';

// One encrypted blob, kept on this device only (not migrated to new phones or backups).
const KEY = 'state';
const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const emptyState = (): State => ({
  settings: {
    setupDone: false, name: '', template: defaultTemplate(''), contacts: [],
    cancelHold: true, cancelCheckin: true, call911: 'off', tokens: {},
  },
  alerts: [],
});

let chain: Promise<unknown> = Promise.resolve();

export async function load(): Promise<State> {
  const raw = await SecureStore.getItemAsync(KEY, OPTIONS).catch(() => null);
  return raw ? { ...emptyState(), ...JSON.parse(raw) } : emptyState();
}

/** Serialized read-modify-write so concurrent updates (UI, queue, location task) do not clobber each other. */
export function update(fn: (s: State) => State | void): Promise<State> {
  const run = chain.then(async () => {
    const s = await load();
    const next = fn(s) ?? s;
    next.alerts = next.alerts.slice(-20);
    await SecureStore.setItemAsync(KEY, JSON.stringify(next), OPTIONS);
    return next;
  });
  chain = run.catch(() => undefined);
  return run;
}

export const wipe = () => SecureStore.deleteItemAsync(KEY, OPTIONS);
