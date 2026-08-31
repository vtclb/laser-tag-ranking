import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  filterPublicPlayers,
  findExactHiddenPlayer,
  isHiddenPublicNick,
  rerankPublicPlayers
} from '../v2/core/playerVisibility.js';

const leagueSource = await readFile(new URL('../v2/pages/league-stats.js', import.meta.url), 'utf8');
const homeSource = await readFile(new URL('../v2/pages/home.js', import.meta.url), 'utf8');
const seasonSource = await readFile(new URL('../v2/pages/season.js', import.meta.url), 'utf8');
const balance3Source = await readFile(new URL('../v2/scripts/balance3/app.js', import.meta.url), 'utf8');
const balance2Source = await readFile(new URL('../v2/scripts/balance2/app.js', import.meta.url), 'utf8');

test('bogd is hidden from public lists and visible only to an exact full-nick lookup', () => {
  const players = [{ nickname: 'Alpha' }, { nickname: 'Bogd' }, { nickname: 'Beta' }];

  assert.equal(isHiddenPublicNick('Bogd'), true);
  assert.deepEqual(filterPublicPlayers(players).map((player) => player.nickname), ['Alpha', 'Beta']);
  assert.equal(findExactHiddenPlayer(players, 'bo'), null);
  assert.equal(findExactHiddenPlayer(players, 'bogd')?.nickname, 'Bogd');
});

test('public ranking closes the hidden position gap and keeps ten visible rows possible', () => {
  const players = Array.from({ length: 12 }, (_, index) => ({
    nickname: index === 4 ? 'Bogd' : `Player ${index + 1}`,
    place: index + 1
  }));
  const publicPlayers = rerankPublicPlayers(players);

  assert.equal(publicPlayers.length, 11);
  assert.deepEqual(publicPlayers.slice(0, 10).map((player) => player.place), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(publicPlayers.some((player) => player.nickname === 'Bogd'), false);
});

test('public pages apply the visibility policy while balance loaders stay untouched', () => {
  assert.match(leagueSource, /findExactHiddenPlayer/);
  assert.match(homeSource, /filterPublicPlayers/);
  assert.match(seasonSource, /filterPublicPlayers/);
  assert.doesNotMatch(balance3Source, /playerVisibility/);
  assert.doesNotMatch(balance2Source, /playerVisibility/);
});
