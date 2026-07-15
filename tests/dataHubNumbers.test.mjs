import test from 'node:test';
import assert from 'node:assert/strict';

import { toNumber } from '../v2/core/dataHub.js';

test('toNumber keeps missing values distinct from zero', () => {
  assert.equal(toNumber(undefined, null), null);
  assert.equal(toNumber(null, null), null);
  assert.equal(toNumber('', null), null);
  assert.equal(toNumber('   ', null), null);
});

test('toNumber accepts real zero, negative values and decimal commas', () => {
  assert.equal(toNumber(0, null), 0);
  assert.equal(toNumber('0', null), 0);
  assert.equal(toNumber('-14', null), -14);
  assert.equal(toNumber('12,5', null), 12.5);
});

test('toNumber uses the requested fallback for invalid input', () => {
  assert.equal(toNumber('not-a-number', null), null);
  assert.equal(toNumber('not-a-number', 7), 7);
});
