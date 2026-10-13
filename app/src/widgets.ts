import { ExtensionStorage } from '@bacons/apple-targets';
import { Platform } from 'react-native';
import { env, postJson } from './api';
import { APP_GROUP } from './config';
import { locate } from './location';
import { load } from './storage';

const store = Platform.OS === 'ios' ? new ExtensionStorage(APP_GROUP) : null;

/**
 * iOS: gives the widget what it needs to send an alert without the app. Each server gets the
 * contacts and message (so the widget only sends an id and a location), and the widget gets the
 * server list, tokens, last location, and the forecast to display.
 */
export async function syncWidgets() {
  if (!store) return;
  const { settings, forecast } = await load();
  if (!settings.setupDone) return;
  const servers: { url: string; token: string }[] = [];
  for (const url of env.servers) {
    try {
      const token = await env.token(url);
      await postJson(url, '/v1/profile', token, {
        contacts: settings.contacts, template: settings.template, dispatch: settings.call911 === 'dispatch',
      }, 3000, 'PUT');
      servers.push({ url, token });
    } catch {
      // This server will be missing from the widget until the next sync.
    }
  }
  store.set('config', JSON.stringify({ servers, loc: await locate() }));
  if (forecast) store.set('forecast', `${forecast.temp}|${forecast.summary}|${forecast.place}`);
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
