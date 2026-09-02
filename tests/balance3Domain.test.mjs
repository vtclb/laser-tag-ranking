import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRegularPayload,
  createInitialState,
  normalizePlayer,
  regularGameFingerprint,
  sanitizeRestoredState,
  summarizeRounds,
  validateMatch,
} from '../v2/scripts/balance3/domain.js';

function player(nick, rating = 500, league = 'sundaygames') {
  return normalizePlayer({ nick, rating, league }, league);
}

test('normalizePlayer preserves an existing stable player key', () => {
  const first = player('Alpha');
  const second = normalizePlayer(first, 'sundaygames');
  assert.equal(first.key, 'sundaygames::Alpha');
  assert.equal(second.key, first.key);
});

test('initial and restored sessions always use the hidden skill model', () => {
  assert.equal(createInitialState().ratingModel, 'skill_v2');
  const restored = sanitizeRestoredState({ ...createInitialState(), ratingModel: 'points' });
  assert.equal(restored.ratingModel, 'skill_v2');
});

test('sanitizeRestoredState removes unknown and duplicate team assignments', () => {
  const a = player('Alpha');
  const b = player('Bravo');
  const restored = sanitizeRestoredState({
    ...createInitialState(),
    players: [a, b],
    selectedKeys: [a.key, b.key, 'unknown'],
    teamCount: 12,
    teams: { team1: [a.key, b.key], team2: [a.key, 'unknown'] },
  });
  assert.deepEqual(restored.selectedKeys, [a.key, b.key]);
  assert.deepEqual(restored.teams.team1, [a.key, b.key]);
  assert.deepEqual(restored.teams.team2, []);
  assert.equal(restored.teamCount, 12);
});

test('sanitizeRestoredState preserves 50 selected players across team1 through team12', () => {
  const players = Array.from({ length: 50 }, (_, index) => player(`Player ${index + 1}`, 1500 - index));
  const teams = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`team${index + 1}`, []]));
  players.forEach((current, index) => teams[`team${index % 12 + 1}`].push(current.key));

  const restored = sanitizeRestoredState({
    ...createInitialState(),
    players,
    selectedKeys: players.map((current) => current.key),
    teamCount: 12,
    teams,
  });

  assert.equal(restored.selectedKeys.length, 50);
  assert.equal(Object.values(restored.teams).flat().length, 50);
  assert.deepEqual(restored.teams.team12, teams.team12);
});

test('round summary requires every configured battle before declaring a winner', () => {
  const state = createInitialState();
  state.roundCount = 3;
  state.rounds = ['team1', 'team2', null, null, null, null, null, null, null, null];
  assert.equal(summarizeRounds(state).winner, '');
  state.rounds[2] = 'team1';
  assert.deepEqual(summarizeRounds(state), { team1: 2, team2: 1, draws: 0, completed: 3, total: 3, winner: 'team1' });
});

test('regular payload uses active teams, stable MVP keys and battle sequence', () => {
  const state = createInitialState();
  const a = player('Alpha', 700);
  const b = player('Bravo', 600);
  state.players = [a, b];
  state.selectedKeys = [a.key, b.key];
  state.teams.team1 = [a.key];
  state.teams.team2 = [b.key];
  state.rounds = ['team1', 'draw', 'team2', null, null, null, null, null, null, null];
  state.mvp.mvp1 = a.key;
  assert.equal(validateMatch(state).ok, true);
  assert.deepEqual(buildRegularPayload(state, 'request-1'), {
    requestId: 'request-1',
    action: 'saveRegularGame',
    league: 'sundaygames',
    team1: 'Alpha',
    team2: 'Bravo',
    winner: 'tie',
    mvp: 'Alpha',
    mvp2: '',
    mvp3: '',
    series: '102',
    penalties: '',
    balanceVersion: 'balance3-skill-v2-shadow-1',
  });
  assert.equal('skillRating' in buildRegularPayload(state, 'request-2'), false);
  assert.equal('points' in buildRegularPayload(state, 'request-3'), false);
});

test('regular game fingerprint normalizes roster order and draw aliases', () => {
  const first = regularGameFingerprint({
    league: 'sundaygames',
    team1: 'Alpha, Bravo',
    team2: 'Charlie, Delta',
    winner: 'draw',
    mvp: 'Alpha',
    series: '102',
  });
  const second = regularGameFingerprint({
    League: 'sundaygames',
    Team1: ['Bravo', 'Alpha'],
    Team2: ['Delta', 'Charlie'],
    Winner: 'tie',
    MVP: 'Alpha',
    Series: '102',
  });
  assert.equal(first, second);
});

test('MVP must be unique and belong to the active match', () => {
  const state = createInitialState();
  const a = player('Alpha');
  const b = player('Bravo');
  state.players = [a, b];
  state.selectedKeys = [a.key, b.key];
  state.teams.team1 = [a.key];
  state.teams.team2 = [b.key];
  state.rounds = ['team1', 'team1', 'team2', null, null, null, null, null, null, null];
  state.mvp = { mvp1: a.key, mvp2: a.key, mvp3: '' };
  assert.equal(validateMatch(state).ok, false);
  assert.match(validateMatch(state).message, /кілька MVP/);
});
