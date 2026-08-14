import test from 'node:test';
import assert from 'node:assert/strict';

import { ACHIEVEMENT_DEFINITIONS, buildAchievementProfile } from '../v2/core/achievementEngine.js';

test('empty and corrupted career data stays safe', () => {
  const result = buildAchievementProfile({ allTime: { games: 'bad', wins: null }, seasons: 'bad' });
  assert.equal(result.unlockedCount, 0);
  assert.equal(result.score, 0);
  assert.equal(result.totalCount, ACHIEVEMENT_DEFINITIONS.length);
});

test('career milestones unlock at their exact thresholds', () => {
  const result = buildAchievementProfile({
    allTime: { games: 100, wins: 25, top1: 8, top2: 1, top3: 1, mvpTotal: 10, winrate: 55, bestRank: 'A' }
  });
  const ids = new Set(result.unlocked.map((item) => item.id));
  ['debut', 'regular-25', 'veteran-100', 'first-win', 'winner-25', 'first-mvp', 'mvp-10', 'all-rounder', 'stable-55'].forEach((id) => assert.equal(ids.has(id), true, id));
  assert.equal(ids.has('elite-60'), false);
  assert.equal(ids.has('rank-s'), false);
});

test('season achievements use place and delta without requiring every season field', () => {
  const result = buildAchievementProfile({
    allTime: { games: 12, wins: 7 },
    seasons: [
      { seasonTitle: 'Осінь 2025', finalPlace: 1 },
      { seasonTitle: 'Весна 2026', ratingDelta: 135 }
    ]
  });
  const byId = new Map(result.unlocked.map((item) => [item.id, item]));
  assert.equal(byId.get('podium')?.detail, '1 місце · Осінь 2025');
  assert.equal(byId.get('champion')?.detail, 'Осінь 2025');
  assert.equal(byId.get('climber-100')?.detail, '+135 · Весна 2026');
});

test('legacy seasons can recover wins from games and win rate', () => {
  const result = buildAchievementProfile({
    allTime: { games: 200, wins: 0, winrate: 0 },
    seasons: [
      { games: 100, wins: 0, winRate: 60 },
      { games: 100, wins: 0, winRate: 50 }
    ]
  });
  const ids = new Set(result.unlocked.map((item) => item.id));
  assert.equal(ids.has('winner-100'), true);
  assert.equal(ids.has('stable-55'), true);
  assert.equal(ids.has('elite-60'), false);
});

test('achievement points are separate fixed rewards for unlocked badges', () => {
  const result = buildAchievementProfile({ allTime: { games: 1, wins: 1, mvpTotal: 1 } });
  assert.deepEqual(result.unlocked.map((item) => item.id).sort(), ['debut', 'first-mvp', 'first-win']);
  assert.equal(result.score, 30);
});

test('progress exposes only the nearest three locked achievements', () => {
  const result = buildAchievementProfile({ allTime: { games: 24, wins: 24, mvpTotal: 9, bestRank: 'B' } });
  assert.equal(result.inProgress.length, 3);
  assert.equal(result.inProgress.every((item) => item.progress > 0 && item.progress < 1), true);
  const regular = result.inProgress.find((item) => item.id === 'regular-25');
  assert.equal(regular?.remainingLabel, 'Ще 1 гра');
  assert.equal(result.inProgress.every((item) => typeof item.remainingLabel === 'string' && item.remainingLabel.length > 0), true);
});
