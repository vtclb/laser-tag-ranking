import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const dataHub = await fs.readFile(new URL('../v2/core/dataHub.js', import.meta.url), 'utf8');
const home = await fs.readFile(new URL('../v2/pages/home.js', import.meta.url), 'utf8');
const gameday = await fs.readFile(new URL('../v2/pages/gameday.js', import.meta.url), 'utf8');
const league = await fs.readFile(new URL('../v2/pages/league-stats.js', import.meta.url), 'utf8');

test('avatars fall back to the public avatars sheet when the legacy endpoint is absent', () => {
  assert.match(dataHub, /readSheet\('avatars', \{ limitRows: 2000, limitCols: 10 \}\)/);
  assert.match(dataHub, /\['avatarurl', 'avatar', 'url'\]/);
});

test('public pages use the root-safe fallback avatar path', () => {
  [home, gameday, league].forEach((source) => {
    assert.match(source, /'\/v2\/assets\/default-avatar\.svg'/);
    assert.doesNotMatch(source, /'\.\/assets\/default-avatar\.svg'/);
  });
});
