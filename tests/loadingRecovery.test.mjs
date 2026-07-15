import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const loader = await readFile(new URL('../v2/scripts/loading-cubes.js', import.meta.url), 'utf8');
const loaderCss = await readFile(new URL('../v2/styles/loading-cubes.css', import.meta.url), 'utf8');
const pageState = await readFile(new URL('../v2/core/pageState.js', import.meta.url), 'utf8');
const mainCss = await readFile(new URL('../v2/assets/css/main.css', import.meta.url), 'utf8');
const league = await readFile(new URL('../v2/pages/league-stats.js', import.meta.url), 'utf8');
const gameday = await readFile(new URL('../v2/pages/gameday.js', import.meta.url), 'utf8');
const profile = await readFile(new URL('../v2/pages/profile.js', import.meta.url), 'utf8');
const seasons = await readFile(new URL('../v2/pages/seasons.js', import.meta.url), 'utf8');

test('global activity HUD is delayed and never blocks page interaction', () => {
  assert.match(loader, /setTimeout\(\(\) => \{/);
  assert.match(loader, /\}, 280\)/);
  assert.match(loaderCss, /\.loadingCubes\{[^}]*top:/);
  assert.match(loaderCss, /pointer-events:none/);
  assert.doesNotMatch(loaderCss, /\.loadingCubes\{[^}]*inset:0/);
});

test('shared page error state offers an accessible retry action', () => {
  assert.match(pageState, /role="alert"/);
  assert.match(pageState, /data-page-retry/);
  assert.match(pageState, /aria-busy/);
  assert.match(mainCss, /\.v2-page-state__action:focus-visible/);
});

test('key data pages use the shared recovery state instead of inline crash text', () => {
  [league, gameday, profile, seasons].forEach((source) => {
    assert.match(source, /renderPageError/);
  });
  assert.doesNotMatch(league, /❌ Помилка завантаження сторінки/);
  assert.doesNotMatch(gameday, /❌ Помилка завантаження сторінки/);
});

test('season archive has a meaningful accessible cold-start state', () => {
  assert.match(seasons, /sx-loading--arena" role="status" aria-live="polite"/);
  assert.match(seasons, /Збираємо архів сезонів/);
  assert.match(mainCss, /\.sx-loading__timeline/);
});
