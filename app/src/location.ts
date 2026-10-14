import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { SERVER_TIMEOUT_MS } from './config';
import { load } from './storage';
import { postJson } from './api';
import type { Loc } from './types';

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<undefined>((r) => setTimeout(r, ms))]);

/** Best position within ~2 seconds: recent cached fix, else a fresh one, else whatever is cached. */
export async function locate(): Promise<Loc | undefined> {
  try {
    const cached = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
    const pos = cached ?? (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 1500))
      ?? (await Location.getLastKnownPositionAsync());
    if (!pos) return undefined;
    const loc: Loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const [place] = (await withTimeout(Location.reverseGeocodeAsync({ latitude: loc.lat, longitude: loc.lng }), 1000)) ?? [];
    if (place) loc.address = [place.streetNumber, place.street, place.city, place.region].filter(Boolean).join(' ');
    return loc;
  } catch {
    return undefined;
  }
}

// --- Live location after an alert -------------------------------------------------

const TASK = 'live-location';
const WINDOW_MS = 2 * 60 * 60 * 1000;

TaskManager.defineTask(TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
  if (error || !data) return;
  const { alerts } = await load();
  const live = [...alerts].reverse().find((a) => a.state === 'sent' && !a.safe && a.server && !['intro', 'test'].includes(a.payload.kind));
  if (!live || Date.now() - new Date(live.at).getTime() > WINDOW_MS) return stopLive();
  const points = data.locations.map((l) => ({ lat: l.coords.latitude, lng: l.coords.longitude, at: new Date(l.timestamp).toISOString() }));
  const { settings } = await load();
  await postJson(live.server!, `/v1/alerts/${live.id}/points`, settings.tokens[live.server!], { points }, SERVER_TIMEOUT_MS * 2).catch(() => {});
});

export async function startLive() {
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return;
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) return;
  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15_000,
    distanceInterval: 0,
    showsBackgroundLocationIndicator: false,
    // Android requires a visible service notice; worded to match the weather decoy.
    foregroundService: { notificationTitle: 'Weather', notificationBody: 'Updating local conditions' },
  });
}

export async function stopLive() {
  if (await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false)) await Location.stopLocationUpdatesAsync(TASK);
}
