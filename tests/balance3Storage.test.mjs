import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearPendingWrite,
  readPendingWrite,
  savePendingWrite,
} from '../v2/scripts/balance3/storage.js';

function installStorage() {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  return values;
}

test('pending write survives reload until it is explicitly cleared', () => {
  installStorage();
  const record = {
    requestId: 'balance3-save-1',
    startedAt: 123,
    payload: { league: 'sundaygames', team1: 'Alpha', team2: 'Bravo' },
  };
  assert.equal(savePendingWrite(record), true);
  assert.deepEqual(readPendingWrite(), record);
  clearPendingWrite();
  assert.equal(readPendingWrite(), null);
});

test('corrupted pending write is ignored safely', () => {
  const values = installStorage();
  values.set('balance3:pending-write:v1', '{broken');
  assert.equal(readPendingWrite(), null);
  values.set('balance3:pending-write:v1', JSON.stringify({ requestId: 'missing-payload' }));
  assert.equal(readPendingWrite(), null);
});
