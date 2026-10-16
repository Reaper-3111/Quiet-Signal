import { ExtensionStorage } from '@bacons/apple-targets';
import { Platform } from 'react-native';
import { sendToWatch } from '../modules/watch-link';
import { env, postJson } from './api';
import { APP_GROUP } from './config';
import { locate } from './location';
import { load } from './storage';

const store = Platform.OS === 'ios' ? new ExtensionStorage(APP_GROUP) : null;

/**
 * Gives the iOS widget and the paired watch what they need to send an alert without the app. Each
 * server gets the contacts and message (so they only send an id and a location), and the widget and
 * watch get the server list, a send-only token per server, the last location, and the forecast.
 */
export async function syncWidgets() {
  const { settings, forecast } = await load();
  if (!settings.setupDone) return;
  const servers: { url: string; token: string }[] = [];
  for (const url of env.servers) {
    try {
      const token = await env.token(url);
      await postJson(url, '/v1/profile', token, {
        contacts: settings.contacts, template: settings.template, dispatch: settings.call911 === 'dispatch',
      }, 3000, 'PUT');
      // A token that can only send the saved alert, not read anything. One per server, shared by widget and watch.
      const quick = await postJson(url, '/v1/quick-token', token, {}, 3000);
      servers.push({ url, token: quick.token });
    } catch {
      // This server will be missing from the widget until the next sync.
    }
  }
  const config = JSON.stringify({ servers, loc: await locate() });
  const weather = forecast ? `${forecast.temp}|${forecast.summary}|${forecast.place}` : '';
  sendToWatch(config, weather).catch(() => {});
  if (!store) return;
  store.set('config', config);
  if (weather) store.set('forecast', weather);
  ExtensionStorage.reloadWidget();
}

/** Remote wipe: removes everything the widget and watch hold. */
export async function clearWidgets() {
  await sendToWatch('', '').catch(() => {});
  if (!store) return;
  for (const k of ['config', 'forecast', 'queue']) store.remove(k);
  ExtensionStorage.reloadWidget();
}

/** Alerts the widget could not send are parked in the App Group; move them into the app's queue. */
export async function drainWidgetQueue() {
  const raw = store?.get('queue');
  if (!store || !raw) return;
  store.remove('queue');
  const { settings } = await load();
  for (const it of JSON.parse(raw) as { id: string; at: string; loc?: { lat: number; lng: number; address?: string } }[]) {
    await env.save({
      id: it.id, at: it.at, state: 'queued',
      payload: {
        id: it.id, kind: 'instant', duress: false, template: settings.template, contacts: settings.contacts,
        dispatch: settings.call911 === 'dispatch', loc: it.loc,
      },
    });
  }
}
