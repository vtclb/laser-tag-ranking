import test from 'node:test';
import assert from 'node:assert/strict';
import { getGameDaySummaryFromMatches } from '../v2/core/dataHub.js';

test('daily MVP uses 12/7/3 rather than 3/2/1', () => {
  const result = getGameDaySummaryFromMatches([
    { mvp1: 'A', mvp3: 'B' }, { mvp3: 'B' }, { mvp3: 'B' },
  ]);
  assert.equal(result.mvp, 'a');
  assert.equal(result.mvpScore, 12);
  assert.equal(getGameDaySummaryFromMatches([{ mvp2: 'B' }, { mvp2: 'B' }]).mvpScore, 14);
});

test('daily MVP keeps existing tie rules and empty-day behavior', () => {
  assert.equal(getGameDaySummaryFromMatches([{ mvp1: 'B' }, { mvp1: 'A' }]).mvp, 'a');
  assert.equal(getGameDaySummaryFromMatches([]).mvp, null);
});
