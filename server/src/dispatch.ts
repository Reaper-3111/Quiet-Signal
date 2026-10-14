import type { Config } from './config.js';
import type { Loc } from './message.js';

export interface Dispatcher {
  /** Asks a 24/7 dispatch partner to send help to the location. */
  alert(input: { alertId: string; loc?: Loc; message: string }): Promise<void>;
}

/**
 * Placeholder for Noonlight or a similar partner. The request shape below is
 * generic; replace it with the partner's real payload once terms are signed.
 */
export function buildDispatcher(cfg: Config['dispatch']): Dispatcher | null {
  if (!cfg.url || !cfg.token) return null;
  return {
    async alert({ alertId, loc, message }) {
      const res = await fetch(cfg.url!, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: alertId, location: loc, message }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`dispatch ${res.status}`);
    },
  };
}
