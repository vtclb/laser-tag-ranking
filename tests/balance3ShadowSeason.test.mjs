import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSeasonSkillShadow, gameDateKey } from '../v2/scripts/balance3/api.js';

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
});
