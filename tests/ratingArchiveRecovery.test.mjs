import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAchievementProfile } from '../v2/core/achievementEngine.js';
import { buildSeasonBaselineByNick, getSeasonMaster, parseLogs, parseLogTimestamp } from '../v2/core/dataHub.js';

test('sheet dates use day-month order and Kyiv timezone in summer and winter', () => {
  assert.equal(new Date(parseLogTimestamp('05.09.2026 01:30:36')).toISOString(), '2026-09-04T22:30:36.000Z');
  assert.equal(new Date(parseLogTimestamp('15.01.2026 12:00:00')).toISOString(), '2026-01-15T10:00:00.000Z');
  assert.equal(parseLogTimestamp('2026-09-04T16:17:03.070Z'), Date.parse('2026-09-04T16:17:03.070Z'));
  assert.ok(Number.isNaN(parseLogTimestamp('31.02.2026 12:00:00')));
});

test('later manual corrections never replace the season starting points', () => {
  const rows = [
    ['05.09.2026 01:30:36', 'sundaygames', 'Wolfie', 8, 805],
    ['05.09.2026 01:30:36', 'sundaygames', 'wiedii', -2, 614],
    ['2026-09-04T16:17:03.070Z', 'sundaygames', 'Wolfie', -10, 790],
    ['2026-09-04T16:32:34.057Z', 'sundaygames', 'wiedii', -8, 592],
  ];
  const logs = parseLogs({ header: ['Timestamp', 'League', 'Nickname', 'Delta', 'NewPoints'], rows });
  const baseline = buildSeasonBaselineByNick(logs, 'sundaygames', '2026-09-01', '2026-11-30');
  assert.equal(baseline.get('wolfie'), 800);
  assert.equal(baseline.get('wiedii'), 600);
  assert.equal(792 - baseline.get('wolfie'), -8);
  assert.equal(614 - baseline.get('wiedii'), 14);
});

test('2025 archives load from local snapshots without the retired API', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    assert.equal(parsed.protocol, 'file:');
    parsed.search = '';
    try { return new Response(await readFile(parsed), { status: 200 }); }
    catch { return new Response('', { status: 404 }); }
  };
  try {
    for (const id of ['summer_2025', 'autumn_2025', 'winter_2025_2026']) {
      const master = await getSeasonMaster(id);
      assert.ok(master.sections.players.length > 10);
    }
  } finally { globalThis.fetch = original; }
});

test('missing log points do not fabricate a zero season baseline', () => {
  const logs = [
    { nick: 'A', league: 'kids', timestamp: '2026-09-01', date: '2026-09-01', newPoints: null, delta: 10 },
    { nick: 'A', league: 'kids', timestamp: '2026-09-02', date: '2026-09-02', newPoints: 120, delta: 10 },
  ];
  assert.equal(buildSeasonBaselineByNick(logs, 'kids').get('a'), 110);
});

test('live podium and missing place never award a completed season title', () => {
  const profile = buildAchievementProfile({ seasons: [
    { isCurrent: true, place: 1, matches: 3 },
    { place: null, matches: 10 },
  ] });
  assert.equal(profile.unlocked.some(a => ['podiums', 'titles'].includes(a.familyId)), false);
  const archived = buildAchievementProfile({ seasons: [{ place: 1, matches: 10 }] });
  assert.equal(archived.unlocked.some(a => a.familyId === 'titles'), true);
});
