import { writeFile } from 'node:fs/promises';
import config from '../v2/core/seasons.config.js';

const sheet = 'season_winter_2025_2026_master';
const url = new URL(config.endpoints.gasUrl);
url.search = new URLSearchParams({ action: 'getSheetRaw', sheet, limitRows: '4000' });
const response = await fetch(url);
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const raw = await response.json();
if (raw.status !== 'OK' || !Array.isArray(raw.rows)) throw new Error('Invalid archive response');
const sections = {};
let section;
let headers;
for (const row of raw.rows) {
  if (String(row[0]).startsWith('##')) {
    section = row[0].slice(2).toLowerCase();
    sections[section] = [];
    headers = null;
    continue;
  }
  if (!section || row.every(value => value === '' || value == null)) continue;
  if (!headers) { headers = row; continue; }
  sections[section].push(Object.fromEntries(headers.flatMap((key, i) =>
    key && !key.startsWith('abonement_') ? [[key, row[i] ?? null]] : [])));
}
if (sections.players?.length < 20) throw new Error('Incomplete archive');
sections.season_meta = sections.season_meta[0];
const archive = { seasonId: 'winter_2025_2026', source: { sheet }, sections };
await writeFile(new URL('../v2/data/seasons/winter-2025-2026.json', import.meta.url), JSON.stringify(archive, null, 2) + '\n');
console.log(`Recovered ${sections.players.length} player rows`);
