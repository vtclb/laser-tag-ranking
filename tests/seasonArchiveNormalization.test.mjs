import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { normalizeSeasonPlayerRow, normalizeStaticSeasonMaster } from '../v2/core/dataHub.js';
import { normalizeSeasonStats } from '../v2/pages/seasons.js';

async function readArchive(fileName) {
  const url = new URL(`../v2/data/seasons/${fileName}`, import.meta.url);
  return JSON.parse(await readFile(url, 'utf8'));
}

test('spring archive keeps full roster while counting only active players', async () => {
  const source = await readArchive('spring_2026.json');
  const master = normalizeStaticSeasonMaster(source, 'spring_2026');
  const stats = normalizeSeasonStats(['spring_2026', master], 3);

  assert.equal(master.sections.players.length, 201);
  assert.equal(stats.totalDetailedRecords, 201);
  assert.equal(stats.totalActive, 88);
  assert.equal(stats.totalMatches, 273);
  assert.equal(stats.completeness, 'full');
});

test('summer archive does not treat archived roster count as active count', async () => {
  const source = await readArchive('summer-2025.json');
  const master = normalizeStaticSeasonMaster(source, 'summer_2025');
  const stats = normalizeSeasonStats(['summer_2025', master], 0);

  assert.equal(master.sections.players.length, 20);
  assert.equal(stats.totalDetailedRecords, 20);
  assert.equal(stats.totalActive, 10);
  assert.equal(stats.totalMatches, 322);
  assert.equal(stats.completeness, 'partial');
});

test('legacy numeric Rank_final is preserved as the archived finishing place', () => {
  const player = normalizeSeasonPlayerRow({
    League: 'sundaygames',
    Nickname: 'Pantazi_ko',
    Rating_end: 761,
    Rank_final: 14
  });

  assert.equal(player.place, 14);
  assert.equal(player.rank_final, 'C');
});

test('letter Rank_final remains a rank and is not mistaken for a place', () => {
  const player = normalizeSeasonPlayerRow({
    League: 'sundaygames',
    Nickname: 'Pantazi_ko',
    Rating_end: 1400,
    Rank_final: 'S'
  });

  assert.equal(player.place, null);
  assert.equal(player.rank_final, 'S');
});
