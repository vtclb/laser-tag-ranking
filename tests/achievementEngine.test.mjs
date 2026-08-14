import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACHIEVEMENT_DEFINITIONS,
  TIER_LEVELS,
  buildAchievementProfile,
  buildAchievementStandings,
  getAchievementFamily
} from '../v2/core/achievementEngine.js';

function byFamily(items, familyId) {
  return items.find((item) => item.familyId === familyId);
}

test('empty and corrupted career data stays safe', () => {
  const result = buildAchievementProfile({ allTime: { games: 'bad', wins: null }, seasons: 'bad' });
  assert.equal(result.unlockedCount, 0);
  assert.equal(result.score, 0);
  assert.equal(result.totalCount, ACHIEVEMENT_DEFINITIONS.length - 1);
  assert.equal(result.classCount, 6);
});

test('game activity is one award that upgrades through six classes', () => {
  const bronze = buildAchievementProfile({ allTime: { games: 100 } });
  assert.deepEqual(byFamily(bronze.unlocked, 'games'), {
    id: 'games',
    familyId: 'games',
    title: 'Ветеран арени',
    mark: 'G100',
    tier: 'bronze',
    tierLabel: 'Бронза',
    level: 1,
    maxLevel: 6,
    score: 10,
    detail: '100 ігор',
    metricValue: 100
  });

  const platinum = buildAchievementProfile({ allTime: { games: 585 } });
  const award = byFamily(platinum.unlocked, 'games');
  const next = byFamily(platinum.inProgress, 'games');
  assert.equal(award.tier, 'platinum');
  assert.equal(award.mark, 'G500');
  assert.equal(next.tier, 'diamond');
  assert.equal(next.remainingLabel, 'Ще 115 ігор');
  assert.equal(platinum.unlocked.filter((item) => item.familyId === 'games').length, 1);

  const legendary = buildAchievementProfile({ allTime: { games: 1000 } });
  assert.equal(byFamily(legendary.unlocked, 'games').tier, 'legendary');
  assert.equal(byFamily(legendary.inProgress, 'games'), undefined);
});

test('wins and MVP use archive-calibrated class thresholds', () => {
  const result = buildAchievementProfile({
    allTime: { games: 300, wins: 150, top1: 80, top2: 15, top3: 5, mvpTotal: 100 }
  });
  assert.equal(byFamily(result.unlocked, 'wins').tier, 'platinum');
  assert.equal(byFamily(result.unlocked, 'mvp').tier, 'platinum');
  assert.equal(byFamily(result.inProgress, 'wins').remainingLabel, 'Ще 50 перемог');
  assert.equal(byFamily(result.inProgress, 'mvp').remainingLabel, 'Ще 50 MVP');
});

test('legacy seasons recover wins and create season, podium, title and growth classes', () => {
  const result = buildAchievementProfile({
    allTime: { games: 200, wins: 0, winrate: 0 },
    seasons: [
      { games: 100, wins: 0, winRate: 60, place: 1, delta: 220 },
      { games: 100, wins: 0, winRate: 50, place: 2, delta: 80 }
    ]
  });
  assert.equal(byFamily(result.unlocked, 'wins').tier, 'gold');
  assert.equal(byFamily(result.unlocked, 'seasons').tier, 'silver');
  assert.equal(byFamily(result.unlocked, 'podiums').tier, 'silver');
  assert.equal(byFamily(result.unlocked, 'titles').tier, 'bronze');
  assert.equal(byFamily(result.unlocked, 'growth').tier, 'silver');
});

test('win streak family appears only when detailed match history is available', () => {
  const unavailable = buildAchievementProfile({ allTime: { games: 100 } });
  assert.equal(byFamily(unavailable.unlocked, 'win-streak'), undefined);
  assert.equal(byFamily(unavailable.inProgress, 'win-streak'), undefined);

  const streak = buildAchievementProfile({ allTime: { games: 100 }, longestStreak: 11 });
  assert.equal(byFamily(streak.unlocked, 'win-streak').tier, 'platinum');
  assert.equal(byFamily(streak.inProgress, 'win-streak').remainingLabel, 'Ще 4 перемоги поспіль');
});

test('stability requires both volume and win rate for each class', () => {
  const result = buildAchievementProfile({
    allTime: { games: 320, wins: 180, winrate: 56.25 },
    seasons: [{ games: 320, wins: 180, winRate: 56.25 }]
  });
  assert.equal(byFamily(result.unlocked, 'stability').tier, 'gold');
  const next = byFamily(result.inProgress, 'stability');
  assert.equal(next.tier, 'platinum');
  assert.match(next.remainingLabel, /1\.3 п\.п\. WR/);
});

test('rank and all-rounder remain compact special class awards', () => {
  const result = buildAchievementProfile({
    allTime: { games: 20, bestRank: 'S', top1: 1, top2: 1, top3: 1, mvpTotal: 3 }
  });
  assert.equal(byFamily(result.unlocked, 'career-rank').tier, 'legendary');
  assert.equal(byFamily(result.unlocked, 'all-rounder').tierLabel, 'Особлива');
});

test('AP is cumulative across completed levels but only one card is shown per family', () => {
  const result = buildAchievementProfile({ allTime: { games: 300, wins: 50, mvpTotal: 0 } });
  const games = byFamily(result.unlocked, 'games');
  const wins = byFamily(result.unlocked, 'wins');
  assert.equal(games.score, TIER_LEVELS[0].score + TIER_LEVELS[1].score + TIER_LEVELS[2].score);
  assert.equal(wins.score, TIER_LEVELS[0].score + TIER_LEVELS[1].score);
  assert.equal(result.score, games.score + wins.score);
  assert.equal(new Set(result.unlocked.map((item) => item.familyId)).size, result.unlocked.length);
});

test('achievement family exposes explanation and every level requirement', () => {
  const family = getAchievementFamily('games');
  assert.equal(family.title, 'Ветеран арени');
  assert.match(family.description, /кількість рейтингових ігор/);
  assert.deepEqual(family.levels.map((level) => level.target), [100, 200, 300, 500, 700, 1000]);
  assert.deepEqual(family.levels.map((level) => level.label), TIER_LEVELS.map((tier) => tier.label));
  assert.equal(getAchievementFamily('unknown'), null);
});

test('achievement standings sort by class and metric while equal results share a place', () => {
  const rows = buildAchievementStandings([
    { nick: 'Gold', allTime: { games: 320 } },
    { nick: 'Silver B', allTime: { games: 220 } },
    { nick: 'No award', allTime: { games: 99 } },
    { nick: 'Silver A', allTime: { games: 220 } },
    { nick: 'Silver C', allTime: { games: 205 } }
  ], 'games');

  assert.deepEqual(rows.map((row) => row.nick), ['Gold', 'Silver A', 'Silver B', 'Silver C']);
  assert.deepEqual(rows.map((row) => row.position), [1, 2, 2, 4]);
  assert.deepEqual(rows.map((row) => row.tier), ['gold', 'silver', 'silver', 'silver']);
  assert.deepEqual(buildAchievementStandings([], 'unknown'), []);
});
