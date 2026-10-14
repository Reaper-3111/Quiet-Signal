import { createHmac } from 'node:crypto';
import type { Config } from './config.js';

export interface SmsProvider {
  name: string;
  send(to: string, body: string): Promise<{ id: string }>;
}

async function post(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

export function twilio(cfg: Config['twilio'], publicUrl: string): SmsProvider {
  return {
    name: 'twilio',
    async send(to, body) {
      const auth = Buffer.from(`${cfg.sid}:${cfg.token}`).toString('base64');
      const data = await post(`https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          To: to,
          From: cfg.from!,
          Body: body,
          StatusCallback: `${publicUrl}/hooks/twilio`,
        }),
      });
      return { id: data.sid };
    },
  };
}

export function telnyx(cfg: Config['telnyx']): SmsProvider {
  return {
    name: 'telnyx',
    async send(to, body) {
      const data = await post('https://api.telnyx.com/v2/messages', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: cfg.from, to, text: body }),
      });
      return { id: data.data?.id };
    },
  };
}

export function buildProviders(config: Config): SmsProvider[] {
  const list: SmsProvider[] = [];
  if (config.twilio.sid && config.twilio.token && config.twilio.from) list.push(twilio(config.twilio, config.publicUrl));
  if (config.telnyx.key && config.telnyx.from) list.push(telnyx(config.telnyx));
  return list;
}

/** Tries each provider in order; throws only if all fail. */
export async function sendSms(providers: SmsProvider[], to: string, body: string) {
  let last: unknown = new Error('no sms provider configured');
  for (const p of providers) {
    try {
      return { provider: p.name, ...(await p.send(to, body)) };
    } catch (err) {
      last = err;
      console.error(`sms ${p.name} failed:`, (err as Error).message);
    }
  }
  throw last;
}

/** Twilio signs url + sorted form params with HMAC-SHA1. */
export function twilioSignature(token: string, url: string, params: Record<string, string>) {
  const data = Object.keys(params).sort().reduce((s, k) => s + k + params[k], url);
  return createHmac('sha1', token).update(data).digest('base64');
}
