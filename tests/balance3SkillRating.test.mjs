import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateSkillRatings, normalizeSkillMatch } from '../v2/scripts/balance3/skillRating.js';

test('normalizes CSV-shaped match rows', () => {
  assert.deepEqual(normalizeSkillMatch({
    Team1: 'Alpha, Bravo',
    Team2: 'Charlie; Delta',
    Winner: 'team1',
    MVP: 'Alpha',
  }), {
    team1: ['Alpha', 'Bravo'],
    team2: ['Charlie', 'Delta'],
    winner: 'team1',
    mvp1: 'Alpha',
    mvp2: undefined,
    mvp3: undefined,
  });
});

test('winner gains skill while loser loses without activity inflation', () => {
  const result = calculateSkillRatings([
    { team1: ['Alpha'], team2: ['Bravo'], winner: 'team1' },
  ]);
  assert.ok(result.ratings.Alpha.skillRating > 1000);
  assert.ok(result.ratings.Bravo.skillRating < 1000);
  assert.equal(result.ratings.Alpha.skillGames, 1);
});

test('repeated balanced results keep the pool centered near the baseline', () => {
  const matches = Array.from({ length: 20 }, (_, index) => ({
    team1: ['Alpha'],
    team2: ['Bravo'],
    winner: index % 2 ? 'team1' : 'team2',
  }));
  const result = calculateSkillRatings(matches);
  const mean = (result.ratings.Alpha.rawSkillRating + result.ratings.Bravo.rawSkillRating) / 2;
  assert.ok(Math.abs(mean - 1000) <= 2);
});

test('uneven team sizes do not create rating points from activity', () => {
  const result = calculateSkillRatings([
    { team1: ['Alpha', 'Bravo'], team2: ['Charlie', 'Delta', 'Echo'], winner: 'team1' },
  ]);
  const values = Object.values(result.ratings).map((player) => player.rawSkillRating);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(Math.abs(mean - 1000) <= 1);
});

test('MVP is a small individual signal and uncertainty falls with games', () => {
  const matches = Array.from({ length: 16 }, () => ({
    team1: ['Alpha', 'Bravo'],
    team2: ['Charlie', 'Delta'],
    winner: 'draw',
    mvp1: 'Alpha',
  }));
  const result = calculateSkillRatings(matches);
  assert.ok(result.ratings.Alpha.skillRating > result.ratings.Bravo.skillRating);
  assert.equal(result.ratings.Alpha.provisional, false);
  assert.ok(result.ratings.Alpha.skillUncertainty < 200);
});

test('invalid matches are skipped without creating partial ratings', () => {
  const result = calculateSkillRatings([
    { team1: ['Alpha'], team2: ['Alpha'], winner: 'team1' },
    { team1: [], team2: ['Bravo'], winner: 'team2' },
  ]);
  assert.equal(result.metrics.skipped, 2);
  assert.deepEqual(result.ratings, {});
});

test('continues a persisted season baseline without resetting games or rating', () => {
  const result = calculateSkillRatings([
    { team1: ['Alpha'], team2: ['Bravo'], winner: 'team1' },
  ], {
    initialRatings: {
      Alpha: { rawSkillRating: 1120, skillGames: 30 },
      Bravo: { rawSkillRating: 880, skillGames: 30 },
    },
  });
  assert.equal(result.ratings.Alpha.skillGames, 31);
  assert.equal(result.ratings.Bravo.skillGames, 31);
  assert.ok(result.ratings.Alpha.rawSkillRating > 1120);
  assert.ok(result.ratings.Bravo.rawSkillRating < 880);
});
