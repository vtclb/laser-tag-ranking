import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const profile = await readFile(new URL('../v2/pages/profile.js', import.meta.url), 'utf8');
const gameday = await readFile(new URL('../v2/pages/gameday.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../v2/assets/css/main.css', import.meta.url), 'utf8');

test('profile renders career dynamics from already loaded season rows', () => {
  const dynamicsSource = profile.slice(
    profile.indexOf('function renderCareerDynamics'),
    profile.indexOf('function renderSeasonTabs')
  );
  assert.match(profile, /function renderCareerDynamics/);
  assert.match(profile, /renderCareerDynamics\(\{ seasons: seasonRows, allTime: allTimeStats/);
  assert.match(profile, /const profilePromise = buildPlayerCareer/);
  assert.match(profile, /profile-career-chart/);
  assert.match(profile, /profile-career-timeline/);
  assert.doesNotMatch(dynamicsSource, /\bawait\b|getPlayerSeasonLogs|\bfetch\(/);
});

test('profile reveals live player data before archived career data finishes', () => {
  const initSource = profile.slice(profile.indexOf('export async function initProfilePage'));
  assert.match(profile, /function renderLiveProfilePreview/);
  assert.match(initSource, /const profilePromise = buildPlayerCareer/);
  assert.match(initSource, /const liveStatsPromise = getCurrentLeagueLiveStats/);
  assert.ok(
    initSource.indexOf('renderLiveProfilePreview(root') < initSource.indexOf('const [profileResult, seasonOptionsResult]'),
    'live preview must render before the archived career promise is awaited'
  );
  assert.match(profile, /profile-page--progressive" aria-busy="true"/);
  assert.match(css, /profile-career-loading__signal/);
});

test('profile career dynamics expose rating, place, win rate, games and MVP', () => {
  assert.match(profile, /function num\(v\) \{\s+if \(isMissing\(v\)\) return null;/);
  assert.match(profile, /краще місце/);
  assert.match(profile, /рух рейтингу/);
  assert.match(profile, /row\.winRate/);
  assert.match(profile, /row\.matches/);
  assert.match(profile, /row\.mvp/);
  assert.match(profile, /profile-career-rank/);
});

test('profile career chart switches between rating, place and growth without extra data requests', () => {
  assert.match(profile, /function bindCareerMetricSwitch/);
  assert.match(profile, /data-career-metric="points"/);
  assert.match(profile, /data-career-metric="place"/);
  assert.match(profile, /data-career-metric="delta"/);
  assert.match(profile, /bindCareerMetricSwitch\(root\)/);
  assert.match(css, /profile-career-metric-switch/);
});

test('gameday keeps exact deltas and all three MVP positions visible', () => {
  assert.match(gameday, /match\.pointsChanges \|\| \[\]/);
  assert.match(gameday, /getPlayerGameDelta\(nick, match\.pointsChanges \|\| \[\]\)/);
  assert.match(gameday, /\{ label: 'MVP 1', nick: match\.mvp1/);
  assert.match(gameday, /\{ label: 'MVP 2', nick: match\.mvp2/);
  assert.match(gameday, /\{ label: 'MVP 3', nick: match\.mvp3/);
  assert.match(gameday, /p\.pointsAfter/);
  assert.match(gameday, /p\.delta/);
});

test('profile and gameday loading states are accessible and CSS-only', () => {
  assert.match(profile, /profile-loading-arena/);
  assert.match(gameday, /gameday-loading-arena/);
  assert.match(profile, /role="status" aria-live="polite"/);
  assert.match(gameday, /role="status" aria-live="polite"/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
