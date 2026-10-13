import type { AlertPayload, AlertRecord, Checkin, Kind, Loc, Settings } from './types';
import { introText, renderLocal } from './message';

/** Everything the alert flow needs from the phone, injected so it can be tested. */
export interface Env {
  servers: string[];
  timeoutMs: number;
  uuid(): string;
  now(): Date;
  /** Returns a token for the server, registering on first use. */
  token(server: string): Promise<string>;
  post(server: string, path: string, token: string, body: unknown, ms: number): Promise<any>;
  locate(): Promise<Loc | undefined>;
  /** Opens the Messages composer prefilled. Resolves false if unavailable. */
  compose(contacts: string[], text: string): Promise<boolean>;
  dial911(): Promise<void>;
  save(record: AlertRecord): Promise<void>;
}

/** Tries each server in order; returns the first that answers. */
async function trySend<T>(env: Env, path: string, body: unknown) {
  for (const server of env.servers) {
    try {
      const res: T = await env.post(server, path, await env.token(server), body, env.timeoutMs);
      return { server, res };
    } catch {
      // next server
    }
  }
  return null;
}

/**
 * Chain: server A -> server B -> prefilled Messages -> dialer. A later step
 * runs only if the one before it failed. The record stays queued after a
 * fallback so the queue can still deliver it when signal returns.
 */
export async function deliver(env: Env, rec: AlertRecord, withFallbacks = true) {
  const sent = await trySend(env, '/v1/alerts', rec.payload);
  if (sent) {
    await env.save({ ...rec, state: 'sent', server: sent.server });
    return { via: 'server' as const, server: sent.server };
  }
  if (!withFallbacks) return { via: 'queued' as const };
  const { payload: p } = rec;
  const composed = await env.compose(p.contacts, renderLocal(p.template, p.kind, p.duress, p.loc));
  if (composed) return { via: 'sms' as const };
  await env.dial911();
  return { via: 'dialer' as const };
}

/** 'intro' is the one-time setup text to contacts; 'test' is the TEST alert. Neither opens the dialer. */
export async function fireAlert(env: Env, settings: Settings, kind: Kind, duress = false) {
  const real = kind !== 'intro' && kind !== 'test';
  const payload: AlertPayload = {
    id: env.uuid(),
    kind,
    duress,
    template: kind === 'intro' ? introText(settings.name) : settings.template,
    contacts: settings.contacts,
    dispatch: real && settings.call911 === 'dispatch',
    loc: kind === 'intro' ? undefined : await env.locate(),
  };
  const rec: AlertRecord = { id: payload.id, at: env.now().toISOString(), payload, state: 'queued' };
  await env.save(rec); // written before any network call
  const out = await deliver(env, rec, kind !== 'intro');
  if (real && settings.call911 === 'dialer' && out.via !== 'dialer') await env.dial911();
  return { ...out, id: payload.id };
}

/** Retries queued alerts without opening any UI. Returns the ones that went through. */
export async function flushQueue(env: Env, alerts: AlertRecord[]) {
  const done: { rec: AlertRecord; server: string }[] = [];
  const cutoff = env.now().getTime() - 24 * 3600_000; // an old alert sent late would only confuse contacts
  for (const rec of alerts.filter((a) => a.state === 'queued' && new Date(a.at).getTime() > cutoff)) {
    const out = await deliver(env, rec, false);
    if (out.via === 'server') done.push({ rec, server: out.server });
  }
  return done;
}

/** The server holds the check-in so it fires even if the phone is dead. */
export async function armCheckin(env: Env, settings: Settings, dueAt: Date): Promise<Checkin | null> {
  const id = env.uuid();
  const loc = await env.locate();
  const body = { id, dueAt: dueAt.toISOString(), template: settings.template, contacts: settings.contacts, dispatch: settings.call911 === 'dispatch', loc };
  const sent = await trySend(env, '/v1/checkins', body);
  return sent ? { id, server: sent.server, dueAt: body.dueAt } : null;
}

export async function cancelCheckin(env: Env, ci: Checkin) {
  const token = await env.token(ci.server);
  for (let i = 0; i < 2; i++) {
    try {
      await env.post(ci.server, `/v1/checkins/${ci.id}/cancel`, token, {}, env.timeoutMs);
      return;
    } catch {
      // retry once
    }
  }
}

/** Duress during a check-in: pretend to cancel, but fire now with the forced flag. */
export async function fireCheckinDuress(env: Env, settings: Settings, ci: Checkin) {
  try {
    await env.post(ci.server, `/v1/checkins/${ci.id}/fire`, await env.token(ci.server), { duress: true }, env.timeoutMs);
  } catch {
    await fireAlert(env, settings, 'checkin', true);
  }
}
