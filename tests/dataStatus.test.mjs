import test from 'node:test';
import assert from 'node:assert/strict';

import { formatDataUpdatedAt, makeDataStatus, resolveDataStatusTone } from '../v2/core/dataStatus.js';

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

test('resolveDataStatusTone returns ok for live data with updatedAt', () => {
  const tone = resolveDataStatusTone(makeDataStatus({
    source: 'live',
    ok: true,
    updatedAt: '2026-04-26T14:32:00.000Z'
  }));
  assert.equal(tone.tone, 'ok');
  assert.equal(tone.className, 'data-status-line--ok');
  assert.match(tone.label, /Дані оновлено/);
});

test('resolveDataStatusTone returns warning for cache even when ok is false', () => {
  const tone = resolveDataStatusTone(makeDataStatus({
    source: 'cache',
    ok: false,
    updatedAt: '2026-04-26T14:32:00.000Z'
  }));
  assert.equal(tone.tone, 'warning');
  assert.equal(tone.className, 'data-status-line--warning');
  assert.match(tone.label, /Показуємо кеш/);
});

test('resolveDataStatusTone returns warning for fallback even when ok is false', () => {
  const tone = resolveDataStatusTone(makeDataStatus({
    source: 'fallback',
    ok: false
  }));
  assert.equal(tone.tone, 'warning');
  assert.equal(tone.className, 'data-status-line--warning');
  assert.match(tone.label, /Показуємо кеш/);
});

test('resolveDataStatusTone returns error for unknown or missing status', () => {
  const tone = resolveDataStatusTone();
  assert.equal(tone.tone, 'error');
  assert.equal(tone.className, 'data-status-line--error');
  assert.equal(tone.label, 'Дані тимчасово недоступні');
});
