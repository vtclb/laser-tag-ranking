import test from 'node:test';
import assert from 'node:assert/strict';

import { formatDataUpdatedAt, makeDataStatus } from '../v2/core/dataStatus.js';

test('makeDataStatus returns normalized defaults', () => {
  const status = makeDataStatus();
  assert.deepEqual(status, {
    source: 'unknown',
    ok: false,
    updatedAt: null,
    message: ''
  });
});

test('formatDataUpdatedAt returns HH:MM for valid ISO date', () => {
  const formatted = formatDataUpdatedAt('2026-04-26T14:32:00.000Z');
  assert.match(formatted, /^\d{2}:\d{2}$/);
});

test('formatDataUpdatedAt returns empty string for invalid date', () => {
  assert.equal(formatDataUpdatedAt('not-a-date'), '');
  assert.equal(formatDataUpdatedAt(null), '');
});
