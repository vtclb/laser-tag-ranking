import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TEAM_KEYS,
  normalizeTeamCount,
  getTeamCountOptionsForEventMode,
  getMaxLobbyPlayersForEventMode,
} from '../v2/scripts/balance2/state.js';
import { balanceIntoNTeams } from '../v2/scripts/balance2/balance.js';

test('tournament max players is 50', () => {
  assert.equal(getMaxLobbyPlayersForEventMode('tournament'), 50);
});

test('tournament team options are 2..12', () => {
  assert.deepEqual(getTeamCountOptionsForEventMode('tournament'), [2,3,4,5,6,7,8,9,10,11,12]);
});

test('team keys include team1..team12', () => {
  assert.equal(TEAM_KEYS.length, 12);
  assert.equal(TEAM_KEYS[0], 'team1');
  assert.equal(TEAM_KEYS[11], 'team12');
});

test('normalizeTeamCount allows 12', () => {
  assert.equal(normalizeTeamCount(12), 12);
  assert.equal(normalizeTeamCount(99), 12);
});

test('balance 50 players into 12 teams without losing players or duplicates', () => {
  const players = Array.from({ length: 50 }, (_, i) => ({ nick: `P${i + 1}`, points: 50 - i }));
  const teams = balanceIntoNTeams(players, 12);
  const activeTeams = TEAM_KEYS.slice(0, 12);
  const assigned = activeTeams.flatMap((key) => teams[key] || []);
  assert.equal(assigned.length, 50);

  const nicks = assigned.map((p) => p.nick);
  assert.equal(new Set(nicks).size, 50);
  assert.deepEqual(new Set(nicks), new Set(players.map((p) => p.nick)));
});
