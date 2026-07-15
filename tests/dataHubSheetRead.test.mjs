import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dataHubSource = await readFile(new URL('../v2/core/dataHub.js', import.meta.url), 'utf8');
const routerSource = await readFile(new URL('../v2/core/router.js', import.meta.url), 'utf8');

test('explicit sheet limits are not inflated by legacy range ceilings', () => {
  assert.match(dataHubSource, /Number\.isFinite\(requestedLimitRows\)[\s\S]*\? requestedLimitRows[\s\S]*: \(Number\.isFinite\(rangeLimitRows\)/);
  assert.doesNotMatch(dataHubSource, /requestedEffectiveLimitRows = Math\.max/);
});

test('cold GAS sheet reads have a timeout above the previous 12 second boundary', () => {
  assert.match(dataHubSource, /const SHEET_READ_TIMEOUT_MS = 25_000/);
  assert.match(dataHubSource, /gasGetJsonp\([\s\S]*SHEET_READ_TIMEOUT_MS/);
});

test('league template URL is versioned with its renderer', () => {
  const templateVersion = routerSource.match(/mountTemplate\('\.\/pages\/league\.html\?v=([^']+)'/)?.[1];
  const rendererVersion = routerSource.match(/league-stats\.js\?v=([^']+)'/)?.[1];

  assert.ok(templateVersion, 'league template must have a cache version');
  assert.equal(rendererVersion, templateVersion);
});
