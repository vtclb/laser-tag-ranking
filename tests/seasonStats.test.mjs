import test from 'node:test';
import assert from 'node:assert/strict';

import { listSeasonMasters } from '../v2/core/dataHub.js';

import {
  buildArchiveTotals,
  normalizeSeasonStats,
  realNumber,
  seasonCountLabel
} from '../v2/pages/seasons.js';

test('realNumber keeps missing values missing instead of turning them into zero', () => {
  assert.equal(realNumber(null), null);
  assert.equal(realNumber(undefined), null);
  assert.equal(realNumber(''), null);
  assert.equal(realNumber('  '), null);
  assert.equal(realNumber('0'), 0);
  assert.equal(realNumber('-12,5'), -12.5);
});

test('detailed game rows prevent roster totals from inflating active players', () => {
  const master = {
    seasonId: 'summer_2025',
    sections: {
      season_meta: { title: 'Літо 2025' },
      league_summary: {
        sundaygames: { players: 88, matches: 322, pointsDelta: 24239 },
        kids: { players: 0, matches: 0, pointsDelta: 0 }
      },
      players: [
        {
          league: 'sundaygames',
          nickname: 'Laston',
          matches: 136,
          rating_end: 1181,
          rating_delta: null,
          mvp_total: 45
        }
      ]
    }
  };

  const stats = normalizeSeasonStats(['summer_2025', master], 0);

  assert.equal(stats.totalMatches, 322);
  assert.equal(stats.totalActive, 1);
  assert.equal(stats.totalRecords, 88);
  assert.equal(stats.totalDetailedRecords, 1);
  assert.equal(stats.totalRatingDelta, 24239);
  assert.equal(stats.leagues.adult.active, 1);
  assert.equal(stats.leagues.adult.detailedRecords, 1);
  assert.equal(stats.completeness, 'partial');
});

test('archive totals count unique players across seasons', () => {
  const totals = buildArchiveTotals([
    {
      totalMatchesTrusted: true,
      totalMatches: 10,
      activePlayerKeys: ['alpha', 'beta'],
      totalRatingDeltaKnown: true,
      totalRatingDelta: 50
    },
    {
      totalMatchesTrusted: true,
      totalMatches: 12,
      activePlayerKeys: ['beta', 'gamma'],
      totalRatingDeltaKnown: true,
      totalRatingDelta: -5
    }
  ]);

  assert.equal(totals.seasons, 2);
  assert.equal(totals.matches, 22);
  assert.equal(totals.uniqueActive, 3);
  assert.equal(totals.delta, 45);
});

test('season count uses Ukrainian plural forms', () => {
  assert.equal(seasonCountLabel(1), '1 сезон');
  assert.equal(seasonCountLabel(4), '4 сезони');
  assert.equal(seasonCountLabel(11), '11 сезонів');
  assert.equal(seasonCountLabel(22), '22 сезони');
});

test('archive list excludes the live season but career list can include it', async () => {
  const archives = await listSeasonMasters();
  const allSeasons = await listSeasonMasters({ includeCurrent: true });

  assert.equal(archives.includes('summer_2026'), false);
  assert.equal(allSeasons.includes('summer_2026'), true);
  assert.deepEqual(archives, ['spring_2026', 'winter_2025_2026', 'autumn_2025', 'summer_2025']);
});
