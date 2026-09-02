import { readFile } from 'node:fs/promises';

import { GAMES_CSV_URL, PROXY_ORIGIN } from '../v2/scripts/balance3/config.js';
import {
  buildSeasonSkillShadow,
  mergeSkillRegistry,
  parseCsv,
} from '../v2/scripts/balance3/api.js';
import { normalizePlayer } from '../v2/scripts/balance3/domain.js';
import { normalizeSkillMatch, SKILL_RATING_VERSION } from '../v2/scripts/balance3/skillRating.js';

const archive = JSON.parse(await readFile(new URL('../v2/data/seasons/summer_2026.json', import.meta.url), 'utf8'));
const fetchOptions = { signal: AbortSignal.timeout(30000) };

async function loadGames() {
  const response = await fetch(`${GAMES_CSV_URL}&cb=${Date.now()}`, fetchOptions);
  if (!response.ok) throw new Error(`Games CSV HTTP ${response.status}`);
  const rows = parseCsv(await response.text());
  const headers = rows.shift() || [];
  return rows.map((columns) => Object.fromEntries(headers.map((header, index) => [String(header).trim(), columns[index] ?? ''])));
}

async function loadRoster(league) {
  const response = await fetch(`${PROXY_ORIGIN}/fetchLeagueCsv?league=${league}&cb=${Date.now()}`, fetchOptions);
  if (!response.ok) throw new Error(`${league} roster HTTP ${response.status}`);
  const rows = parseCsv(await response.text());
  const headers = (rows.shift() || []).map((header) => String(header).trim().toLowerCase());
  const find = (...names) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
  const nickIndex = find('nick', 'nickname');
  const pointsIndex = find('points', 'pts');
  const idIndex = find('id', 'playerid', 'player_id');
  return rows.map((columns) => normalizePlayer({
    id: idIndex >= 0 ? columns[idIndex] : '',
    nick: columns[nickIndex],
    points: columns[pointsIndex],
    league,
  }, league)).filter(Boolean);
}

const rawGames = await loadGames();
const result = [];

for (const league of ['sundaygames', 'kids']) {
  const liveGames = rawGames
    .filter((row) => String(row.League ?? row.league ?? '').trim().toLowerCase() === league)
    .map((row) => ({
      ...normalizeSkillMatch(row),
      timestamp: row.Timestamp ?? row.timestamp ?? '',
    }));
  const baselineMatches = archive.leagues?.[league]?.matches || [];
  const shadow = buildSeasonSkillShadow(liveGames, baselineMatches);
  const roster = mergeSkillRegistry(await loadRoster(league), Object.values(shadow.ratings));
  roster.forEach((player) => {
    const hasHistory = player.skillRating !== null && Number.isFinite(Number(player.skillRating));
    result.push({
      playerId: String(player.id || player.key || player.nick),
      nick: player.nick,
      league,
      skillRating: hasHistory ? Number(player.skillRating) : 1000,
      rawSkillRating: hasHistory ? Number(player.rawSkillRating ?? player.skillRating) : 1000,
      skillGames: hasHistory ? Number(player.skillGames) || 0 : 0,
      uncertainty: hasHistory ? Number(player.skillUncertainty ?? player.uncertainty) || 0 : 350,
      provisional: hasHistory ? Boolean(player.provisional) : true,
      sourceMatches: Number(shadow.registry.sourceMatches) || 0,
      version: shadow.registry.version || SKILL_RATING_VERSION,
      lastGameAt: shadow.registry.lastGameAt || '',
      updatedAt: new Date().toISOString(),
    });
  });
}

process.stdout.write(JSON.stringify({ ratings: result }));
