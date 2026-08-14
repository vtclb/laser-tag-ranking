import test from 'node:test';
import assert from 'node:assert/strict';

import { balancePlayers } from '../v2/scripts/balance3/balance.js';
import { normalizePlayer } from '../v2/scripts/balance3/domain.js';

function players(count) {
  return Array.from({ length: count }, (_, index) => normalizePlayer({
    id: `p${index + 1}`,
    nick: `Player ${index + 1}`,
    rating: 100 + index * 17,
    league: 'sundaygames',
  }));
}

test('balances 50 unique players into 12 size-safe teams', () => {
  const result = balancePlayers(players(50), 12, 7);
  const active = Object.values(result.teams).slice(0, 12);
  const keys = active.flat();
  assert.equal(keys.length, 50);
  assert.equal(new Set(keys).size, 50);
  const sizes = active.map((team) => team.length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
  assert.equal(result.metrics.totals.length, 12);
});

test('returns a deterministic result for the same seed', () => {
  const roster = players(14);
  assert.deepEqual(balancePlayers(roster, 3, 42), balancePlayers(roster, 3, 42));
});

test('rejects an impossible team count without a partial result', () => {
  assert.throws(() => balancePlayers(players(2), 3), /Недостатньо гравців/);
});

test('deduplicates repeated player records before balancing', () => {
  const roster = players(6);
  const result = balancePlayers([...roster, roster[0], roster[1]], 2);
  assert.equal(Object.values(result.teams).flat().length, 6);
});

test('Skill V2 mode uses shadow ratings while points mode remains available', () => {
  const roster = [
    normalizePlayer({ nick: 'A', points: 1000, skillRating: 500 }),
    normalizePlayer({ nick: 'B', points: 900, skillRating: 600 }),
    normalizePlayer({ nick: 'C', points: 200, skillRating: 1000 }),
    normalizePlayer({ nick: 'D', points: 100, skillRating: 900 }),
  ];
  const pointsResult = balancePlayers(roster, 2, 1, { ratingModel: 'points' });
  const skillResult = balancePlayers(roster, 2, 1, { ratingModel: 'skill_v2' });
  assert.notDeepEqual(pointsResult.teams, skillResult.teams);
  assert.equal(skillResult.metrics.ratingModel, 'skill_v2');
  assert.equal(Math.max(...skillResult.metrics.totals) - Math.min(...skillResult.metrics.totals), 0);
});
