import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cueActive } from '../src/cue';
import { missing } from '../src/sync';
import type { AlertRecord } from '../src/types';

const rec = (over: Partial<AlertRecord> & { kind?: AlertRecord['payload']['kind'] } = {}): AlertRecord => ({
  id: 'a', at: new Date(1_000_000).toISOString(), state: 'sent',
  payload: { id: 'a', kind: over.kind ?? 'instant', duress: false, template: 'x', contacts: ['+1'], dispatch: false },
  ...over,
});

describe('confirmation cue', () => {
  const now = 1_000_000 + 60_000;
  it('shows only for a real alert a server accepted, not yet marked safe, within 2 hours', () => {
    assert.equal(cueActive([rec()], now), true);
    assert.equal(cueActive([rec({ state: 'queued' })], now), false);
    assert.equal(cueActive([rec({ safe: true })], now), false);
    assert.equal(cueActive([rec({ kind: 'test' })], now), false);
    assert.equal(cueActive([rec()], now + 3 * 3600_000), false);
  });
});

describe('journal duplication', () => {
  it('copies each entry to every server that lacks it, once', () => {
    const copies = missing([[{ id: '1' }, { id: '2' }], [{ id: '2' }, { id: '3' }]]);
    assert.deepEqual(copies.map((c) => `${c.entry.id}:${c.from}->${c.to}`), ['1:0->1', '3:1->0']);
  });

  it('skips a server that could not be listed', () => {
    assert.deepEqual(missing([[{ id: '1' }], null]), []);
  });
});
