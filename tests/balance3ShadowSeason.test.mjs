import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSeasonSkillShadow, gameDateKey, mergeSkillRegistry } from '../v2/scripts/balance3/api.js';
import { normalizePlayer } from '../v2/scripts/balance3/domain.js';

test('normalizes ISO and Ukrainian game dates for the season boundary', () => {
  assert.equal(gameDateKey('2026-09-01T10:00:00.000Z'), '2026-09-01');
  assert.equal(gameDateKey('01.09.2026 13:00:00'), '2026-09-01');
  assert.equal(gameDateKey('broken'), '');
});

test('uses summer as a baseline and applies only new-season live games', () => {
  const summer = [
    { team1: ['Alpha'], team2: ['Bravo'], winner: 'team1' },
  ];
  const live = [
    { timestamp: '31.08.2026 20:00:00', team1: ['Alpha'], team2: ['Bravo'], winner: 'team1' },
    { timestamp: '01.09.2026 20:00:00', team1: ['Bravo'], team2: ['Alpha'], winner: 'team1' },
  ];
  const baseline = buildSeasonSkillShadow([], summer);
  const continued = buildSeasonSkillShadow(live, summer);

  assert.equal(baseline.ratings.Alpha.skillGames, 1);
  assert.equal(continued.ratings.Alpha.skillGames, 2);
  assert.equal(continued.ratings.Bravo.skillGames, 2);
  assert.ok(continued.ratings.Bravo.rawSkillRating > baseline.ratings.Bravo.rawSkillRating);
  assert.equal(continued.registry.sourceMatches, 2);
  assert.equal(continued.registry.lastGameAt, '01.09.2026 20:00:00');
});

test('central registry restores shadow values by stable player id with nick fallback', () => {
  const players = [
    normalizePlayer({ id: 'p-1', nick: 'Alpha', points: 500 }),
    normalizePlayer({ id: 'p-2', nick: 'BRAVO', points: 400 }),
  ];
  const merged = mergeSkillRegistry(players, [
    { playerId: 'p-1', nick: 'Old Alpha', skillRating: 1120, rawSkillRating: 1130, skillGames: 30 },
    { playerId: 'legacy', nick: 'bravo', skillRating: 940, rawSkillRating: 930, skillGames: 18 },
  ]);
  assert.equal(merged[0].skillRating, 1120);
  assert.equal(merged[0].rawSkillRating, 1130);
  assert.equal(merged[1].skillRating, 940);
  assert.equal(merged[1].points, 400);
});

test('GAS exposes a separate registry without changing the regular points formula', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../gas/doPost.gs', import.meta.url), 'utf8'));
  assert.match(source, /action === 'getSkillRatings'/);
  assert.match(source, /action === 'syncSkillRatings'/);
  assert.match(source, /SKILL_RATINGS_SHEET_ = 'skill_ratings'/);
  assert.match(source, /const delta\s+= partScore \+ winScore \+ mvpBonus \+ penScore/);
});
