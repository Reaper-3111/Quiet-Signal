import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deliver, fireAlert, flushQueue, type Env } from '../src/alert';
import { defaultTemplate, normalizePhone, renderLocal } from '../src/message';
import type { AlertRecord, Settings } from '../src/types';

const settings: Settings = {
  setupDone: true, name: 'Sam', template: defaultTemplate('Sam'), contacts: ['+15745550100'],
  cancelHold: true, cancelCheckin: true, recordAudio: false, call911: 'off', tokens: {},
};

function makeEnv(over: Partial<Env> & { down?: string[]; smsOk?: boolean } = {}) {
  const calls: string[] = [];
  const saved: AlertRecord[] = [];
  let n = 0;
  const env: Env = {
    servers: ['A', 'B'], timeoutMs: 10, uuid: () => `id-${++n}`, now: () => new Date(0),
    token: async () => 't',
    post: async (server) => { calls.push(server); if (over.down?.includes(server)) throw new Error('down'); return {}; },
    locate: async () => ({ lat: 41.6764, lng: -86.252, address: '1 Main St' }),
    compose: async (_c, text) => { calls.push(`sms:${text}`); return over.smsOk ?? true; },
    dial911: async () => { calls.push('911'); },
    save: async (r) => { saved.push(r); },
    ...over,
  };
  return { env, calls, saved };
}

describe('alert delivery chain', () => {
  it('uses the primary server and nothing else when it answers', async () => {
    const { env, calls, saved } = makeEnv();
    const out = await fireAlert(env, settings, 'instant');
    assert.deepEqual(calls, ['A']);
    assert.equal(out.via, 'server');
    assert.deepEqual(saved.map((s) => s.state), ['queued', 'sent']);
  });

  it('falls to the second server only after the first fails', async () => {
    const { env, calls } = makeEnv({ down: ['A'] });
    const out = await fireAlert(env, settings, 'hold');
    assert.deepEqual(calls, ['A', 'B']);
    assert.equal((out as any).server, 'B');
  });

  it('opens Messages with the full text when both servers fail, and stays queued', async () => {
    const { env, calls, saved } = makeEnv({ down: ['A', 'B'] });
    const out = await fireAlert(env, settings, 'instant', true);
    assert.equal(out.via, 'sms');
    const sms = calls.find((c) => c.startsWith('sms:'))!;
    assert.match(sms, /1 Main St \(41\.67640, -86\.25200\)/);
    assert.match(sms, /forced to cancel/);
    assert.doesNotMatch(sms, /Live map/);
    assert.equal(saved.at(-1)!.state, 'queued');
    assert.ok(!calls.includes('911'));
  });

  it('shows the dialer only when Messages is unavailable', async () => {
    const { env, calls } = makeEnv({ down: ['A', 'B'], smsOk: false });
    assert.equal((await fireAlert(env, settings, 'instant')).via, 'dialer');
    assert.equal(calls.filter((c) => c === '911').length, 1);
  });

  it('also opens the dialer after a successful send when the 911 dialer option is on', async () => {
    const { env, calls } = makeEnv();
    await fireAlert(env, { ...settings, call911: 'dialer' }, 'instant');
    assert.deepEqual(calls, ['A', '911']);
  });

  it('keeps intro and test alerts away from the dialer', async () => {
    const { env, calls } = makeEnv({ down: ['A', 'B'], smsOk: false });
    assert.equal((await fireAlert(env, { ...settings, call911: 'dialer' }, 'intro')).via, 'queued');
    assert.equal((await fireAlert(makeEnv().env, { ...settings, call911: 'dialer' }, 'test')).via, 'server');
    assert.ok(!calls.includes('911'));
  });

  it('flushes queued alerts without opening any UI', async () => {
    const { env, calls } = makeEnv({ down: ['A'] });
    const rec: AlertRecord = { id: 'q', at: new Date(0).toISOString(), state: 'queued', payload: { id: 'q', kind: 'instant', duress: false, template: 'x', contacts: ['+1'], dispatch: false } };
    const done = await flushQueue(env, [rec, { ...rec, id: 'sent', state: 'sent' }, { ...rec, id: 'stale', at: new Date(-9e9).toISOString() }]);
    assert.equal(done.length, 1);
    assert.equal(done[0].server, 'B');
    assert.ok(!calls.some((c) => c.startsWith('sms') || c === '911'));
    assert.equal((await deliver(makeEnv({ down: ['A', 'B'] }).env, rec, false)).via, 'queued');
  });
});

describe('message helpers', () => {
  it('marks test alerts', () => assert.match(renderLocal('Hi {coords}', 'test', false), /^TEST: Hi unavailable$/));
  it('normalizes phone numbers', () => {
    assert.equal(normalizePhone('(574) 555-0100'), '+15745550100');
    assert.equal(normalizePhone('1 574 555 0100'), '+15745550100');
    assert.equal(normalizePhone('+44 20 7946 0958'), '+442079460958');
    assert.equal(normalizePhone('555'), null);
  });
});
