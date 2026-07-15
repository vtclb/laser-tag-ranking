import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dataHubSource = await readFile(new URL('../v2/core/dataHub.js', import.meta.url), 'utf8');
const leagueSource = await readFile(new URL('../v2/pages/league-stats.js', import.meta.url), 'utf8');

test('gameday shares the live league sheet cache key and caches its assembled view', () => {
  const gameDaySource = dataHubSource.slice(dataHubSource.indexOf('export async function getGameDay('));

  assert.match(gameDaySource, /gameday-full:/);
  assert.match(gameDaySource, /readSheet\(league, \{ limitRows: 4000, limitCols: 40 \}\)/);
  assert.match(gameDaySource, /withInFlight\(`load:\$\{cacheKey\}`/);
  assert.match(gameDaySource, /return writeCache\(cacheKey,/);
});

test('season masters survive route reloads in short-lived session cache', () => {
  assert.match(dataHubSource, /seasonMaster: 300_000/);
  assert.match(dataHubSource, /const storageKey = `season-master:\$\{season\}`/);
  assert.match(dataHubSource, /withInFlight\(`load:\$\{storageKey\}`/);
  assert.match(dataHubSource, /const sources = isDerivedSession \? \[window\.sessionStorage\]/);
});

test('derived league and gameday views use session-only storage', () => {
  assert.match(dataHubSource, /key\.startsWith\('league-live-current:'\)/);
  assert.match(dataHubSource, /key\.startsWith\('gameday-full:'\)/);
  assert.match(dataHubSource, /const sources = isDerivedSession \? \[window\.sessionStorage\]/);
  assert.match(dataHubSource, /readCache\(cacheKey, TTL\.gameday\) \|\| readStorageCache\(cacheKey, TTL\.gameday\)/);
});

test('league page starts live data and season context concurrently', () => {
  assert.match(leagueSource, /const \[data, currentSeason\] = await Promise\.all\(\[/);
  assert.match(leagueSource, /getCurrentLeagueLiveStats\(league\)/);
  assert.match(leagueSource, /getCurrentSeason\(\)\.catch/);
});
