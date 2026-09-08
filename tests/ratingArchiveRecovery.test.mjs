import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAchievementProfile } from '../v2/core/achievementEngine.js';
import { buildSeasonBaselineByNick, getSeasonMaster } from '../v2/core/dataHub.js';

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
