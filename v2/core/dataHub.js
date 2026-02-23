// Changelog (Codex): safe rounds parsing, home snapshot top5/stats normalization, and battles/rounds consistency for Home/GameDay summaries.
import seasonsConfig from './seasons.config.js';
import { jsonp } from './utils.js';

const cache = new Map();
const inFlight = new Map();
const STORAGE_PREFIX = 'lt_cache_v2::';
const STATIC_SEASON_CACHE = new Map();

const TTL = {
  home: 30_000,
  ratings: 60_000,
  leagueSnapshot: 60_000,
  seasonDashboard: 60_000,
  gameday: 15_000,
  profile: 120_000,
  sheet: 60_000,
  avatars: 120_000,
  config: 300_000
};

const SHEET_RANGES = {
  kids: 'A1:Z600',
  sundaygames: 'A1:Z600',
  games: 'A1:Z5000',
  logs: 'A1:Z5000',
  avatars: 'A1:Z2000',
  autumn2025: 'A1:Z5000',
  ocinb2025: 'A1:Z5000',
  summer2025: 'A1:Z5000',
  winter2025: 'A1:Z5000',
  winter202526: 'A1:Z5000',
  archive: 'A1:Z5000'
};
const SHEET_ALIASES = {
  ocinb2025: ['autumn2025', 'OcInB2025', 'ОСІНЬ2025', 'ocinb2025 '],
  autumn2025: ['ocinb2025', 'OcInB2025', 'ОСІНЬ2025', 'ocinb2025 '],
  archive: ['Архів'],
  архів: ['archive']
};
const RANK_META = {
  S: { label: 'S', cssClass: 'rank-S', themeVars: { '--rank-color': '#ffd166', '--rank-glow': 'rgba(255,209,102,.45)' } },
  A: { label: 'A', cssClass: 'rank-A', themeVars: { '--rank-color': '#ff7b72', '--rank-glow': 'rgba(255,123,114,.4)' } },
  B: { label: 'B', cssClass: 'rank-B', themeVars: { '--rank-color': '#58a6ff', '--rank-glow': 'rgba(88,166,255,.38)' } },
  C: { label: 'C', cssClass: 'rank-C', themeVars: { '--rank-color': '#3fb950', '--rank-glow': 'rgba(63,185,80,.35)' } },
  D: { label: 'D', cssClass: 'rank-D', themeVars: { '--rank-color': '#9da7b3', '--rank-glow': 'rgba(157,167,179,.3)' } },
  E: { label: 'E', cssClass: 'rank-E', themeVars: { '--rank-color': '#8b949e', '--rank-glow': 'rgba(139,148,158,.28)' } },
  F: { label: 'F', cssClass: 'rank-F', themeVars: { '--rank-color': '#6e7681', '--rank-glow': 'rgba(110,118,129,.2)' } }
};
const RANK_THRESHOLDS = [['S', 1200], ['A', 1000], ['B', 800], ['C', 600], ['D', 400], ['E', 200], ['F', 0]];

function normalizeHeader(value = '') { return String(value || '').trim().toLowerCase(); }
function normalizeLeague(league = '') {
  const lg = normalizeHeader(league);
  if (lg === 'kids') return 'kids';
  if (['olds', 'sundaygames', 'sunday', 'adults'].includes(lg)) return 'sundaygames';
  return '';
}
function toNumber(value, fallback = null) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? '').replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}
function parseNickList(raw = '') {
  return String(raw || '').replace(/\r?\n/g, ',').split(/[;,|]/).map((p) => p.trim()).filter(Boolean);
}
function safeErrorMessage(error, fallback = 'Не вдалося завантажити дані') {
  if (!error) return fallback;
  return error.message || String(error) || fallback;
}

export function rankFromPoints(points = 0) {
  for (const [rank, min] of RANK_THRESHOLDS) if ((points || 0) >= min) return rank;
  return 'F';
}

export function rankMeta(rank = 'F') { return RANK_META[rank] || RANK_META.F; }

function readCache(key, ttlMs) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > ttlMs) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}
function readStorageCache(key, ttlMs) {
  if (!key.startsWith('sheet:') || typeof window === 'undefined') return null;
  const storageKey = `${STORAGE_PREFIX}${key}`;
  const sources = [window.sessionStorage, window.localStorage];
  for (const storage of sources) {
    try {
      const raw = storage.getItem(storageKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!parsed?.ts || Date.now() - parsed.ts > ttlMs) {
        storage.removeItem(storageKey);
        continue;
      }
      return parsed.data ?? null;
    } catch {
      storage.removeItem(storageKey);
    }
  }
  return null;
}

function writeStorageCache(key, value) {
  if (!key.startsWith('sheet:') || typeof window === 'undefined') return;
  const payload = JSON.stringify({ ts: Date.now(), data: value });
  const storageKey = `${STORAGE_PREFIX}${key}`;
  try { window.sessionStorage.setItem(storageKey, payload); } catch {}
  try { window.localStorage.setItem(storageKey, payload); } catch {}
}

function writeCache(key, value) {
  cache.set(key, { ts: Date.now(), value });
  writeStorageCache(key, value);
  return value;
}

async function gasPost(payload = {}, timeoutMs = 12_000) {
  const config = await loadSeasonsConfig();
  const gasUrl = config?.gasEndpoint || config?.endpoints?.gasUrl;
  if (!gasUrl) throw new Error('GAS endpoint не налаштований');
  const action = String(payload?.action || '').trim();
  if (!action) throw new Error('GAS action is required');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, action }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (json?.status && json.status !== 'OK') throw new Error(json?.message || 'GAS error');
    return json;
  } catch (error) {
    if ((error?.name || '').includes('Abort')) throw new Error('GAS недоступний / timeout');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeGasPayload(payload = {}) {
  if (Array.isArray(payload)) return { values: payload };
  if (payload && typeof payload === 'object') return payload;
  return { payload };
}

async function gasGetJsonp(params = {}, timeoutMs = 12_000) {
  const config = await loadSeasonsConfig();
  const gasUrl = config?.gasEndpoint || config?.endpoints?.gasUrl;
  if (!gasUrl) throw new Error('GAS endpoint не налаштований');
  const action = String(params?.action || '').trim();
  if (!action) throw new Error('GAS action is required');
  const requestParams = { ...params, action };
  console.debug('[dataHub] GAS JSONP request', { gasUrl, action, params: requestParams });

  try {
    const raw = await jsonp(gasUrl, requestParams, timeoutMs);
    const response = normalizeGasPayload(raw);
    console.debug('[dataHub] GAS JSONP response', { action, status: response?.status, message: response?.message });
    return response;
  } catch (error) {
    if (String(error?.message || '').includes('JSONP timeout')) {
      console.debug('[dataHub] GAS JSONP timeout', { action, gasUrl, params: requestParams, error: String(error?.message || error) });
      throw new Error('GAS недоступний / timeout');
    }
    throw error;
  }
}

async function readSheetAll(sheetName) {
  return gasGetJsonp({ action: 'getSheetRaw', sheet: sheetName, limitRows: 5000 });
}

async function readSheetRange(sheetName, rangeA1) {
  const match = String(rangeA1 || '').match(/:([A-Z]+)(\d+)$/i);
  const limitRows = match ? Number(match[2]) : undefined;
  return gasGetJsonp({ action: 'getSheetRaw', sheet: sheetName, limitRows });
}

function normalizeSheetPayload(payload) {
  if (Array.isArray(payload)) {
    const header = Array.isArray(payload[0]) ? payload[0].map((value) => String(value)) : [];
    const rows = header.length ? payload.slice(1) : [];
    return { header, rows };
  }

  if (!payload || typeof payload !== 'object') return { header: [], rows: [] };

  if (Array.isArray(payload.header) || Array.isArray(payload.rows)) {
    const header = Array.isArray(payload.header) ? payload.header.map((value) => String(value)) : [];
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    return { header, rows };
  }

  if (Array.isArray(payload.values)) {
    const header = Array.isArray(payload.values[0]) ? payload.values[0].map((value) => String(value)) : [];
    const rows = header.length ? payload.values.slice(1) : [];
    return { header, rows };
  }

  if (payload.data) {
    const normalized = normalizeSheetPayload(payload.data);
    if (normalized.header.length || normalized.rows.length) return normalized;
  }

  if (payload.result) {
    const normalized = normalizeSheetPayload(payload.result);
    if (normalized.header.length || normalized.rows.length) return normalized;
  }

  return { header: [], rows: [] };
}

function normalizeGetSheetRawResponse(payload = {}, sheetName = '') {
  if (payload?.data || payload?.result) {
    return normalizeGetSheetRawResponse(payload.data || payload.result, sheetName);
  }

  if (payload && typeof payload === 'object' && Array.isArray(payload.header) && Array.isArray(payload.rows)) {
    return {
      status: payload?.status || 'OK',
      sheet: sheetName,
      header: payload.header.map((value) => String(value)),
      rows: payload.rows
    };
  }

  if (payload && typeof payload === 'object' && Array.isArray(payload.values)) {
    const header = Array.isArray(payload.values[0]) ? payload.values[0].map((value) => String(value)) : [];
    const rows = header.length ? payload.values.slice(1) : [];
    return { status: payload?.status || 'OK', sheet: sheetName, header, rows };
  }

  if (Array.isArray(payload)) {
    const header = Array.isArray(payload[0]) ? payload[0].map((value) => String(value)) : [];
    const rows = header.length ? payload.slice(1) : [];
    return { status: 'OK', sheet: sheetName, header, rows };
  }

  throw new Error(`Некоректний формат таблиці: ${sheetName} (missing header/rows)`);
}

async function readStaticSeason(seasonId) {
  if (!seasonId || typeof fetch !== 'function') return null;
  if (STATIC_SEASON_CACHE.has(seasonId)) return STATIC_SEASON_CACHE.get(seasonId);
  try {
    const response = await fetch(`../data/seasons/${encodeURIComponent(seasonId)}.json`, { cache: 'force-cache' });
    if (!response.ok) return null;
    const data = await response.json();
    STATIC_SEASON_CACHE.set(seasonId, data);
    return data;
  } catch {
    return null;
  }
}

export async function loadSeasonsConfig() {
  const cached = readCache('config', TTL.config);
  if (cached) return cached;
  const mappedSeasons = (seasonsConfig.seasons || []).map((season) => ({
    ...season,
    sources: seasonsConfig.seasonSourcesMap?.[season.id] || season.sources || {}
  }));
  return writeCache('config', { ...seasonsConfig, seasons: mappedSeasons });
}

function getSeasonById(config, seasonId) {
  const list = config.seasons.filter((s) => s.enabled !== false);
  return list.find((s) => s.id === seasonId) || list.find((s) => s.id === config.currentSeasonId) || list[0];
}

function getSeasonByDate(config, isoDate = new Date().toISOString().slice(0, 10)) {
  const found = config.seasons.find((s) => s.enabled !== false && s.dateStart && s.dateEnd && isoDate >= s.dateStart && isoDate <= s.dateEnd);
  return found || getSeasonById(config, config.currentSeasonId);
}

async function gasCall(action, params = {}, timeoutMs = 12_000, ttlMs = TTL.sheet) {
  const key = `gas:${action}:${JSON.stringify(params)}`;
  const cached = readCache(key, ttlMs);
  if (cached) return cached;
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    let lastError = null;
    for (let i = 0; i < 2; i += 1) {
      try {
        const payload = await gasGetJsonp({ action, ...params }, timeoutMs);
        return writeCache(key, payload);
      } catch (error) {
        lastError = error;
      }
    }
    if ((lastError?.name || '').includes('Abort')) throw new Error('GAS недоступний / timeout');
    throw new Error(safeErrorMessage(lastError));
  })();

  inFlight.set(key, promise);
  try { return await promise; } finally { inFlight.delete(key); }
}

async function tryReadSheetVariant(sheetName) {
  const canonical = normalizeHeader(sheetName).replace(/\s+/g, '');
  const range = SHEET_RANGES[canonical] || SHEET_RANGES[normalizeHeader(sheetName)] || '';
  let payload = null;
  try {
    payload = range ? await readSheetRange(sheetName, range) : await readSheetAll(sheetName);
    return normalizeGetSheetRawResponse(payload, sheetName);
  } catch (error) {
    console.debug('[dataHub] readSheet error', {
      sheetName,
      status: payload?.status,
      keys: payload ? Object.keys(payload) : [],
      error: String(error?.message || error)
    });
    if (normalizeHeader(error?.message).includes('sheet not found')) {
      throw new Error(`Не вдалося завантажити sheet: ${sheetName}. ${error.message}`);
    }
    throw error;
  }
}

async function readSheet(sheetName) {
  const normalized = normalizeHeader(sheetName).replace(/\s+/g, '');
  const aliases = SHEET_ALIASES[normalized] || SHEET_ALIASES[normalizeHeader(sheetName)] || [];
  const variants = [sheetName, ...aliases].slice(0, 3);
  const key = `sheet:${variants.join('|')}`;
  const cached = readCache(key, TTL.sheet) || readStorageCache(key, 10 * 60_000);
  if (cached) return cached;
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    let lastError = null;
    const tried = [];
    for (const variant of variants) {
      tried.push(variant);
      try {
        const payload = await tryReadSheetVariant(variant);
        return writeCache(key, payload);
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) {
      throw new Error(`${safeErrorMessage(lastError)}. Спробували sheet: ${tried.join(', ')}`);
    }
    throw new Error(`Немає вкладки сезону в таблиці. Спробували: ${tried.join(', ')}`);
  })();

  inFlight.set(key, promise);
  try { return await promise; } finally { inFlight.delete(key); }
}

function detectCols(header = []) {
  const normalized = header.map(normalizeHeader);
  const idx = (names) => normalized.findIndex((col) => names.includes(col));
  return {
    nick: idx(['nick', 'nickname', 'player']), league: idx(['league', 'division']), points: idx(['points', 'pts', 'score', 'mmr']),
    games: idx(['games', 'matches']), wins: idx(['wins', 'win']), losses: idx(['losses', 'lose', 'lost']), draws: idx(['draws', 'ties']),
    winRate: idx(['winrate', 'win rate', 'wr']), mvp: idx(['mvp', 'top1']), top2: idx(['top2', 'mvp2']), top3: idx(['top3', 'mvp3']), inactive: idx(['inactive', 'isinactive'])
  };
}

function parseScoreboardRows(sheet, league) {
  const cols = detectCols(sheet.header || []);
  const target = normalizeLeague(league);
  return (sheet.rows || []).map((row) => ({
    nick: String(row[cols.nick] ?? '').trim(),
    rowLeague: normalizeLeague(row[cols.league] ?? ''),
    points: toNumber(row[cols.points], null), games: toNumber(row[cols.games], 0) || 0, wins: toNumber(row[cols.wins], 0) || 0,
    losses: toNumber(row[cols.losses], 0) || 0, draws: toNumber(row[cols.draws], 0) || 0, winRate: toNumber(row[cols.winRate], null),
    mvp: toNumber(row[cols.mvp], 0) || 0, mvp2: toNumber(row[cols.top2], 0) || 0, mvp3: toNumber(row[cols.top3], 0) || 0,
    inactive: normalizeHeader(row[cols.inactive]) === 'true'
  })).filter((row) => row.nick && (!row.rowLeague || row.rowLeague === target)).map(({ rowLeague, ...rest }) => rest);
}

function parseDateOnly(value = '') {
  const src = String(value || '').trim();
  if (!src) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(src)) return src.slice(0, 10);
  if (/^\d{2}\.\d{2}\.\d{4}/.test(src)) {
    const [dd, mm, yyyy] = src.slice(0, 10).split('.');
    return `${yyyy}-${mm}-${dd}`;
  }
  const dt = new Date(src);
  if (!Number.isNaN(dt.getTime())) {
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return src.slice(0, 10);
}

function safeRoundCount(rawSeries, maxRounds = 12) {
  const normalized = String(rawSeries ?? '').trim();
  if (!normalized) return 1;
  if (!/^\d+$/.test(normalized)) return 1;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed)) return 1;
  if (parsed < 1 || parsed > maxRounds) return 1;
  return parsed;
}

function parseMatches(sheet) {
  const header = (sheet.header || []).map(normalizeHeader);
  const find = (names) => header.findIndex((h) => names.includes(h));
  const i = {
    timestamp: find(['timestamp', 'date', 'datetime', 'createdat']),
    league: find(['league', 'division']),
    team1: find(['team1', 'team a', 'teama']),
    team2: find(['team2', 'team b', 'teamb']),
    winner: find(['winner', 'winnerteam']),
    mvp1: find(['mvp', 'mvp1', 'top1']),
    mvp2: find(['mvp2', 'top2']),
    mvp3: find(['mvp3', 'top3']),
    rounds: find(['rounds', 'series'])
  };
  return (sheet.rows || []).map((row) => {
    const ts = row[i.timestamp] || '';
    const rawSeries = String(row[i.rounds] ?? '').trim();
    const roundsCount = safeRoundCount(rawSeries);
    return {
      timestamp: ts,
      date: parseDateOnly(ts),
      league: normalizeLeague(row[i.league] || 'kids') || 'kids',
      team1: parseNickList(row[i.team1]),
      team2: parseNickList(row[i.team2]),
      winner: normalizeHeader(row[i.winner]),
      mvp1: String(row[i.mvp1] || '').trim(),
      mvp2: String(row[i.mvp2] || '').trim(),
      mvp3: String(row[i.mvp3] || '').trim(),
      rawSeries,
      roundsCount,
      rounds: roundsCount
    };
  }).filter((m) => m.team1.length || m.team2.length);
}

function parseLogs(sheet) {
  const header = (sheet.header || []).map(normalizeHeader);
  const find = (names) => header.findIndex((h) => names.includes(h));
  const i = {
    timestamp: find(['timestamp', 'time', 'datetime', 'date']),
    league: find(['league', 'division']),
    nick: find(['nickname', 'nick', 'player']),
    delta: find(['delta', 'pointsdelta', 'pointdelta']),
    newPoints: find(['newpoints', 'points', 'pts'])
  };

  return (sheet.rows || []).map((row) => {
    const timestamp = String(row[i.timestamp] || '').trim();
    const league = normalizeLeague(row[i.league] || 'kids') || 'kids';
    const nick = String(row[i.nick] || '').trim();
    const delta = toNumber(row[i.delta], null);
    const newPoints = toNumber(row[i.newPoints], null);
    const date = parseDateOnly(timestamp);
    const tsMs = Date.parse(timestamp);
    return { timestamp, tsMs: Number.isFinite(tsMs) ? tsMs : null, date, league, nick, delta, newPoints };
  }).filter((entry) => entry.nick && (entry.delta !== null || entry.newPoints !== null));
}

function buildStatsFromMatches(matches, league, pointsByNick = new Map()) {
  const map = new Map();
  const touch = (nick) => {
    const key = normalizeHeader(nick);
    if (!map.has(key)) map.set(key, { nick, points: pointsByNick.get(key) ?? null, games: 0, wins: 0, draws: 0, losses: 0, winRate: null, mvp: 0, mvp2: 0, mvp3: 0, inactive: false });
    return map.get(key);
  };

  for (const match of matches) {
    if (normalizeLeague(match.league) !== normalizeLeague(league)) continue;
    for (const nick of match.team1) {
      const row = touch(nick); row.games += 1;
      if (['team1', '1'].includes(match.winner)) row.wins += 1; else if (['team2', '2'].includes(match.winner)) row.losses += 1; else row.draws += 1;
      if (normalizeHeader(match.mvp1) === normalizeHeader(nick)) row.mvp += 1;
      if (normalizeHeader(match.mvp2) === normalizeHeader(nick)) row.mvp2 += 1;
      if (normalizeHeader(match.mvp3) === normalizeHeader(nick)) row.mvp3 += 1;
    }
    for (const nick of match.team2) {
      const row = touch(nick); row.games += 1;
      if (['team2', '2'].includes(match.winner)) row.wins += 1; else if (['team1', '1'].includes(match.winner)) row.losses += 1; else row.draws += 1;
      if (normalizeHeader(match.mvp1) === normalizeHeader(nick)) row.mvp += 1;
      if (normalizeHeader(match.mvp2) === normalizeHeader(nick)) row.mvp2 += 1;
      if (normalizeHeader(match.mvp3) === normalizeHeader(nick)) row.mvp3 += 1;
    }
  }

  map.forEach((row) => { row.winRate = row.games ? Math.round((row.wins / row.games) * 100) : null; });

  const leagueMatches = matches.filter((match) => normalizeLeague(match.league) === normalizeLeague(league));
  map.battles = leagueMatches.length;
  map.rounds = leagueMatches.reduce((sum, match) => sum + safeRoundCount(match.roundsCount ?? match.rounds ?? match.rawSeries), 0);
  return map;
}

function mapToRows(statsMap, avatarsMap = new Map()) {
  return [...statsMap.values()].sort((a, b) => (b.points ?? -999999) - (a.points ?? -999999) || b.wins - a.wins || a.nick.localeCompare(b.nick, 'uk')).map((row, index) => {
    const rankLetter = rankFromPoints(row.points || 0);
    return { place: index + 1, ...row, avatarUrl: avatarsMap.get(normalizeHeader(row.nick)) || '', rankLetter, rank: rankMeta(rankLetter) };
  });
}

function getRankDistribution(players = []) {
  const dist = { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  players.forEach((p) => { dist[p.rankLetter || rankFromPoints(p.points || 0)] += 1; });
  return dist;
}

function pointsMapFromRows(rows = []) {
  const map = new Map();
  rows.forEach((row) => { if (row.nick && row.points !== null) map.set(normalizeHeader(row.nick), row.points); });
  return map;
}

async function getSeasonBundle(season) {
  const key = `bundle:${season.id}`;
  const cached = readCache(key, TTL.ratings);
  if (cached) return cached;
  const bundle = { seasonSheet: null, kidsSheet: null, sundaySheet: null, gamesSheet: null, logsSheet: null, matches: [], logs: [] };
  const tasks = [];
  if (season.sources.seasonSheet) tasks.push(readSheet(season.sources.seasonSheet).then((s) => { bundle.seasonSheet = s; }));
  if (season.sources.kidsSheet) tasks.push(readSheet(season.sources.kidsSheet).then((s) => { bundle.kidsSheet = s; }));
  if (season.sources.sundaygamesSheet) tasks.push(readSheet(season.sources.sundaygamesSheet).then((s) => { bundle.sundaySheet = s; }));
  if (season.sources.gamesSheet) tasks.push(readSheet(season.sources.gamesSheet).then((s) => { bundle.gamesSheet = s; }));
  if (season.sources.logsSheet) tasks.push(readSheet(season.sources.logsSheet).then((s) => { bundle.logsSheet = s; }));
  await Promise.all(tasks);
  bundle.matches = parseMatches(bundle.gamesSheet || bundle.seasonSheet || { header: [], rows: [] });
  bundle.logs = parseLogs(bundle.logsSheet || { header: [], rows: [] });
  return writeCache(key, bundle);
}

export async function getAvatarsMap() {
  const key = 'avatars';
  const cached = readCache(key, TTL.avatars);
  if (cached) return cached;
  try {
    const payload = await gasCall('listAvatars', {}, 12_000, TTL.avatars);
    const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.rows) ? payload.rows : [];
    const map = new Map();
    items.forEach((item) => {
      const nick = String(item.nick || item.Nick || '').trim();
      const url = String(item.url || item.URL || '').trim();
      if (nick && url) map.set(normalizeHeader(nick), url);
    });
    return writeCache(key, map);
  } catch { return new Map(); }
}

export async function getCurrentSeason() {
  const config = await loadSeasonsConfig();
  return getSeasonByDate(config);
}


function extractSnapshotPayload(payload = {}) {
  return payload?.snapshot || payload?.data || payload?.result || payload;
}

function normalizeHomeStats(raw = {}) {
  const playerGames = toNumber(raw.playerGames, null) ?? toNumber(raw.games, 0) ?? 0;
  return {
    playerGames,
    battles: toNumber(raw.battles, null) ?? toNumber(raw.battlesCount, null) ?? 0,
    rounds: toNumber(raw.rounds, null) ?? toNumber(raw.roundsCount, 0) ?? 0,
    players: toNumber(raw.players, null) ?? toNumber(raw.playersCount, 0) ?? 0
  };
}

function normalizeHomeTop5(rawTop5, fallbackTop1) {
  if (Array.isArray(rawTop5) && rawTop5.length) return rawTop5;
  if (Array.isArray(fallbackTop1) && fallbackTop1.length) return fallbackTop1.slice(0, 5);
  if (fallbackTop1 && typeof fallbackTop1 === 'object') return [fallbackTop1];
  return [];
}

function normalizeLeagueSnapshotResponse(payload, season, league) {
  const snap = extractSnapshotPayload(payload);
  if (!snap || typeof snap !== 'object') return null;
  const table = Array.isArray(snap.table) ? snap.table : Array.isArray(snap.leaderboard) ? snap.leaderboard : [];
  if (!table.length) return null;
  const seasonStats = snap.seasonStats || snap.stats || {};
  return {
    seasonId: snap.seasonId || season.id,
    seasonTitle: snap.seasonTitle || season.uiLabel,
    league: normalizeLeague(snap.league) || league,
    top3: Array.isArray(snap.top3) && snap.top3.length ? snap.top3 : table.slice(0, 3),
    table,
    leaderboard: table,
    seasonStats: {
      games: toNumber(seasonStats.games, 0) || 0,
      wins: toNumber(seasonStats.wins, 0) || 0,
      losses: toNumber(seasonStats.losses, 0) || 0,
      draws: toNumber(seasonStats.draws, 0) || 0,
      pointsDelta: toNumber(seasonStats.pointsDelta, 0) || 0,
      players: toNumber(seasonStats.players, table.length) || table.length,
      rounds: toNumber(seasonStats.rounds, 0) || 0,
      mvp: seasonStats.mvp || null
    },
    rankDistribution: snap.rankDistribution || getRankDistribution(table),
    matches: Array.isArray(snap.matches) ? snap.matches : []
  };
}

export async function getLeagueSnapshot(leagueOrOptions = 'kids', seasonIdArg) {
  const config = await loadSeasonsConfig();
  const league = typeof leagueOrOptions === 'object' ? (leagueOrOptions.league || leagueOrOptions.leagueId) : leagueOrOptions;
  const seasonId = typeof leagueOrOptions === 'object' ? leagueOrOptions.seasonId : seasonIdArg;
  const season = getSeasonById(config, seasonId);
  const selectedLeague = normalizeLeague(league) || 'kids';
  const cacheKey = `league:${season.id}:${selectedLeague}`;
  const cached = readCache(cacheKey, TTL.leagueSnapshot);
  if (cached) return cached;

  if (season.isStatic) {
    const staticData = await readStaticSeason(season.id);
    const leagueData = staticData?.leagues?.[selectedLeague];
    if (leagueData?.table?.length) {
      return writeCache(cacheKey, {
        seasonId: season.id,
        seasonTitle: staticData.seasonTitle || season.uiLabel,
        league: selectedLeague,
        top3: leagueData.table.slice(0, 3),
        table: leagueData.table,
        leaderboard: leagueData.table,
        seasonStats: leagueData.summary || { games: 0, wins: 0, losses: 0, draws: 0, pointsDelta: 0, players: leagueData.table.length, rounds: 0, mvp: null },
        rankDistribution: leagueData.rankDistribution || getRankDistribution(leagueData.table),
        matches: Array.isArray(leagueData.matches) ? leagueData.matches : []
      });
    }
  }

  try {
    const snapshotPayload = await gasCall('getSnapshot', { scope: 'league', league: selectedLeague, seasonId: season.id }, 12_000, TTL.leagueSnapshot);
    const normalizedSnapshot = normalizeLeagueSnapshotResponse(snapshotPayload, season, selectedLeague);
    if (normalizedSnapshot) return writeCache(cacheKey, normalizedSnapshot);
  } catch (error) {
    console.debug('[dataHub] getSnapshot league fallback', { seasonId: season.id, league: selectedLeague, error: String(error?.message || error) });
  }

  const [bundle, avatars] = await Promise.all([getSeasonBundle(season), getAvatarsMap()]);
  let rows = bundle.seasonSheet ? parseScoreboardRows(bundle.seasonSheet, selectedLeague) : [];
  const fallbackSheet = selectedLeague === 'kids' ? bundle.kidsSheet || {} : bundle.sundaySheet || {};
  const pointsByNick = rows.length ? pointsMapFromRows(rows) : pointsMapFromRows(parseScoreboardRows(fallbackSheet, selectedLeague));
  let statsMap = buildStatsFromMatches(bundle.matches, selectedLeague, pointsByNick);

  if (!statsMap.size && rows.length) statsMap = new Map(rows.map((row) => [normalizeHeader(row.nick), row]));
  else if (rows.length) {
    rows.forEach((row) => {
      const key = normalizeHeader(row.nick);
      if (!statsMap.has(key)) statsMap.set(key, row);
      else Object.assign(statsMap.get(key), { ...statsMap.get(key), ...row, points: row.points ?? statsMap.get(key).points });
    });
  }

  const leaderboard = mapToRows(statsMap, avatars);
  const seasonStats = leaderboard.reduce((acc, item) => {
    acc.games += item.games || 0; acc.wins += item.wins || 0; acc.draws += item.draws || 0; acc.losses += item.losses || 0; acc.pointsDelta += item.points || 0;
    return acc;
  }, { games: 0, wins: 0, draws: 0, losses: 0, pointsDelta: 0, players: leaderboard.length, rounds: 0, mvp: 0 });
  const leagueMatches = bundle.matches.filter((m) => normalizeLeague(m.league) === selectedLeague);
  seasonStats.playerGames = seasonStats.games;
  seasonStats.rounds = leagueMatches.reduce((sum, m) => sum + safeRoundCount(m.roundsCount ?? m.rounds ?? m.rawSeries), 0);
  seasonStats.battles = leagueMatches.length;
  seasonStats.games = seasonStats.battles;
  seasonStats.mvp = leaderboard.reduce((best, p) => (p.mvp > (best.mvp || -1) ? p : best), {}).nick || null;

  return writeCache(cacheKey, { seasonId: season.id, seasonTitle: season.uiLabel, league: selectedLeague, top3: leaderboard.slice(0, 3), table: leaderboard, leaderboard, seasonStats, rankDistribution: getRankDistribution(leaderboard), matches: leagueMatches });
}

export async function getHomeOverview() {
  const season = await getCurrentSeason();
  const cacheKey = `home:${season.id}`;
  const cached = readCache(cacheKey, TTL.home);
  if (cached) return cached;
  const [kidsSheet, adultsSheet, gamesSheet, avatars] = await Promise.all([
    readSheet('kids'),
    readSheet('sundaygames'),
    readSheet('games'),
    getAvatarsMap()
  ]);

  const kidsTable = mapToRows(new Map(parseScoreboardRows(kidsSheet, 'kids').map((p) => [normalizeHeader(p.nick), p])), avatars);
  const adultsTable = mapToRows(new Map(parseScoreboardRows(adultsSheet, 'sundaygames').map((p) => [normalizeHeader(p.nick), p])), avatars);
  const matches = parseMatches(gamesSheet || {});
  const kidsMatches = matches.filter((m) => normalizeLeague(m.league) === 'kids');
  const adultsMatches = matches.filter((m) => normalizeLeague(m.league) === 'sundaygames');
  const statsKids = normalizeHomeStats({
    battles: kidsMatches.length,
    rounds: kidsMatches.reduce((sum, m) => sum + safeRoundCount(m.roundsCount ?? m.rounds ?? m.rawSeries), 0),
    playerGames: kidsTable.reduce((sum, p) => sum + (Number(p.games) || 0), 0),
    players: kidsTable.length
  });
  const statsAdults = normalizeHomeStats({
    battles: adultsMatches.length,
    rounds: adultsMatches.reduce((sum, m) => sum + safeRoundCount(m.roundsCount ?? m.rounds ?? m.rawSeries), 0),
    playerGames: adultsTable.reduce((sum, p) => sum + (Number(p.games) || 0), 0),
    players: adultsTable.length
  });
  return writeCache(cacheKey, {
    seasonId: season.id,
    seasonTitle: season.uiLabel,
    top5Kids: kidsTable.slice(0, 5),
    top5Adults: adultsTable.slice(0, 5),
    top1Kids: kidsTable[0] || null,
    top1Adults: adultsTable[0] || null,
    statsKids,
    statsAdults,
    statsTotal: {
      playerGames: statsKids.playerGames + statsAdults.playerGames,
      rounds: statsKids.rounds + statsAdults.rounds,
      battles: statsKids.battles + statsAdults.battles,
      players: statsKids.players + statsAdults.players
    },
    rankDistKids: getRankDistribution(kidsTable),
    rankDistAdults: getRankDistribution(adultsTable)
  });
}

export async function getGameDayView({ dateYMD, league } = {}) {
  const day = dateYMD || new Date().toISOString().slice(0, 10);
  const selectedLeague = normalizeLeague(league) || 'sundaygames';
  const key = `gameday:${day}:${selectedLeague}`;
  const cached = readCache(key, TTL.gameday);
  if (cached) return cached;

  const season = await getSeasonByDate((await loadSeasonsConfig()), day);
  const bundle = await getSeasonBundle(season);
  const matches = bundle.matches.filter((m) => normalizeLeague(m.league) === selectedLeague && m.date === day);
  const logsByMatch = matches.map((match) => {
    const centerTs = Date.parse(match.timestamp);
    const participants = new Set([...match.team1, ...match.team2].map(normalizeHeader));
    const entries = bundle.logs.filter((entry) => {
      if (normalizeLeague(entry.league) !== selectedLeague) return false;
      if (entry.date !== day) return false;
      if (!participants.has(normalizeHeader(entry.nick))) return false;
      if (!Number.isFinite(centerTs) || !Number.isFinite(entry.tsMs)) return true;
      return Math.abs(entry.tsMs - centerTs) <= 60_000;
    });
    return entries;
  });
  const mvpCounts = {};
  const playersMap = new Map();
  matches.forEach((m) => {
    [m.mvp1, m.mvp2, m.mvp3].filter(Boolean).forEach((nick) => {
      const k = normalizeHeader(nick);
      mvpCounts[k] = (mvpCounts[k] || 0) + 1;
    });
    [...m.team1, ...m.team2].forEach((nick) => {
      const k = normalizeHeader(nick);
      playersMap.set(k, { nick, games: (playersMap.get(k)?.games || 0) + 1, mvp: mvpCounts[k] || 0 });
    });
  });

  const view = {
    dateYMD: day,
    league: selectedLeague,
    matches,
    roundsCount: matches.reduce((sum, m) => sum + safeRoundCount(m.roundsCount ?? m.rounds ?? m.rawSeries), 0),
    gamesCount: matches.length,
    playersToday: [...playersMap.values()].sort((a, b) => b.games - a.games || a.nick.localeCompare(b.nick, 'uk')),
    mvpCounts,
    logsByMatch
  };
  return writeCache(key, view);
}

export async function getSeasonsList() {
  const cfg = await loadSeasonsConfig();
  return cfg.seasons.filter((s) => s.enabled !== false).map((s) => ({ id: s.id, title: s.uiLabel, dateFrom: s.dateStart, dateTo: s.dateEnd, source: s.sources }));
}

export async function getSeasonDashboard(seasonId, league = 'kids') {
  const selectedLeague = normalizeLeague(league) || 'kids';
  const key = `dashboard:${seasonId}:${selectedLeague}`;
  const cached = readCache(key, TTL.seasonDashboard);
  if (cached) return cached;
  const snapshot = await getLeagueSnapshot(selectedLeague, seasonId);
  const totalPlayers = snapshot.table.length;
  const leaders = {
    mostGames: snapshot.table.reduce((best, p) => (p.games > (best.count || -1) ? { nick: p.nick, count: p.games } : best), {}),
    bestWinrate: snapshot.table.filter((p) => p.games >= 5).reduce((best, p) => (p.winRate > (best.winRate || -1) ? { nick: p.nick, winRate: p.winRate, games: p.games } : best), {}),
    mostTop1: snapshot.table.reduce((best, p) => (p.mvp > (best.count || -1) ? { nick: p.nick, count: p.mvp } : best), {}),
    mostTop2: snapshot.table.reduce((best, p) => (p.mvp2 > (best.count || -1) ? { nick: p.nick, count: p.mvp2 } : best), {}),
    mostTop3: snapshot.table.reduce((best, p) => (p.mvp3 > (best.count || -1) ? { nick: p.nick, count: p.mvp3 } : best), {})
  };
  const result = {
    seasonId: snapshot.seasonId,
    seasonTitle: snapshot.seasonTitle,
    league: selectedLeague,
    totals: {
      games: snapshot.seasonStats.games,
      rounds: snapshot.seasonStats.rounds,
      players: totalPlayers,
      avgGamesPerPlayer: totalPlayers ? (snapshot.seasonStats.games / totalPlayers).toFixed(1) : '0.0',
      avgPointsDeltaPerGame: snapshot.seasonStats.games ? Number((snapshot.seasonStats.pointsDelta / snapshot.seasonStats.games).toFixed(2)) : 0,
      wldLabel: `${snapshot.seasonStats.wins}/${snapshot.seasonStats.losses}/${snapshot.seasonStats.draws}`
    },
    rankDistribution: snapshot.rankDistribution,
    top3: snapshot.top3,
    leaders,
    tablePlayers: snapshot.table
  };
  return writeCache(key, result);
}

export async function getLeagueRankDistribution({ seasonId, league = 'kids' } = {}) {
  const snapshot = await getLeagueSnapshot(league, seasonId);
  return { seasonId: snapshot.seasonId, league: snapshot.league, distribution: snapshot.rankDistribution };
}

export async function getSeasonPlayerQuickCard({ seasonId, league, nick } = {}) {
  if (!nick) return null;
  const snapshot = await getLeagueSnapshot(league || 'kids', seasonId);
  const player = snapshot.table.find((p) => normalizeHeader(p.nick) === normalizeHeader(nick));
  if (!player) return null;
  return {
    nick: player.nick,
    avatarUrl: player.avatarUrl,
    rank: player.rank,
    points: player.points,
    games: player.games,
    wins: player.wins,
    losses: player.losses,
    draws: player.draws,
    winrate: player.winRate,
    mvp1: player.mvp,
    mvp2: player.mvp2,
    mvp3: player.mvp3,
    pointsDelta: player.points,
    bestStreak: null
  };
}

export async function getPlayerAllTimeProfile(nick) {
  if (!nick) return null;
  const key = `profile-all:${normalizeHeader(nick)}`;
  const cached = readCache(key, TTL.profile);
  if (cached) return cached;

  const [avatars, seasons] = await Promise.all([getAvatarsMap(), getSeasonsList()]);
  const bundles = await Promise.all(seasons.map(async (season) => ({ season, kids: await getLeagueSnapshot('kids', season.id), adults: await getLeagueSnapshot('sundaygames', season.id) })));
  const total = { games: 0, rounds: 0, wins: 0, losses: 0, draws: 0, winrate: 0, top1: 0, top2: 0, top3: 0 };
  const playedSeasons = [];
  const nickname = normalizeHeader(nick);
  let primaryLeague = 'kids';
  let leagueGames = { kids: 0, sundaygames: 0 };

  bundles.forEach(({ season, kids, adults }) => {
    const pKids = kids.table.find((p) => normalizeHeader(p.nick) === nickname);
    const pAdults = adults.table.find((p) => normalizeHeader(p.nick) === nickname);
    const p = pKids || pAdults;
    if (!p) return;
    const lg = pKids ? 'kids' : 'sundaygames';
    leagueGames[lg] += p.games;
    playedSeasons.push({ seasonId: season.id, seasonTitle: season.title, league: lg, games: p.games, wins: p.wins, losses: p.losses, draws: p.draws, winrate: p.winRate, top1: p.mvp, top2: p.mvp2, top3: p.mvp3, points: p.points, rank: p.rankLetter });
    total.games += p.games; total.wins += p.wins; total.losses += p.losses; total.draws += p.draws; total.top1 += p.mvp; total.top2 += p.mvp2; total.top3 += p.mvp3;
    const matchSet = (pKids ? kids.matches : adults.matches).filter((m) => [...m.team1, ...m.team2].some((n) => normalizeHeader(n) === nickname));
    total.rounds += matchSet.reduce((sum, m) => sum + safeRoundCount(m.roundsCount ?? m.rounds ?? m.rawSeries), 0);
  });

  if (!total.games) return null;
  total.winrate = Math.round((total.wins / total.games) * 100);
  primaryLeague = leagueGames.sundaygames > leagueGames.kids ? 'sundaygames' : 'kids';
  return writeCache(key, { nick, avatar: avatars.get(nickname) || '', league: primaryLeague, allTime: total, seasons: playedSeasons });
}

export async function getPlayerSeasonLogs({ nick, seasonId } = {}) {
  if (!nick || !seasonId) return { groups: [] };
  const config = await loadSeasonsConfig();
  const season = getSeasonById(config, seasonId);
  const bundle = await getSeasonBundle(season);
  const nickname = normalizeHeader(nick);
  const matchLogs = bundle.matches.filter((m) => [...m.team1, ...m.team2].some((n) => normalizeHeader(n) === nickname));
  const playerLogs = bundle.logs.filter((entry) => normalizeHeader(entry.nick) === nickname);
  const sortedByTime = [...playerLogs].sort((a, b) => (a.tsMs || 0) - (b.tsMs || 0));
  const seasonGain = sortedByTime.length ? (sortedByTime[sortedByTime.length - 1].newPoints ?? 0) - (sortedByTime[0].newPoints ?? 0) : 0;
  const maxPoints = sortedByTime.reduce((max, entry) => (entry.newPoints !== null && entry.newPoints > max ? entry.newPoints : max), Number.NEGATIVE_INFINITY);
  const playedDays = new Set(sortedByTime.map((entry) => entry.date).filter(Boolean));
  const avgPerDay = playedDays.size ? seasonGain / playedDays.size : 0;
  const grouped = new Map();
  matchLogs.forEach((entry) => {
    const day = entry.date || 'unknown';
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day).push(entry);
  });
  const groups = [...grouped.entries()].sort((a, b) => String(b[0]).localeCompare(String(a[0]))).map(([date, entries]) => ({ date, entries }));
  return {
    seasonId,
    nick,
    groups,
    metrics: {
      seasonGain,
      maxPoints: Number.isFinite(maxPoints) ? maxPoints : 0,
      avgPerDay: Number(avgPerDay.toFixed(2)),
      playedDaysCount: playedDays.size
    }
  };
}

export async function getTopPlayers(seasonId, league = 'kids', limit = 3) { const snapshot = await getLeagueSnapshot(league, seasonId); return snapshot.table.slice(0, Math.max(1, limit)); }
export async function getHomeSnapshot() { return getHomeOverview(); }
export async function getSeasonOverview(seasonIdOrOptions = {}) {
  const seasonId = typeof seasonIdOrOptions === 'object' ? seasonIdOrOptions.seasonId : seasonIdOrOptions;
  const [kids, adults] = await Promise.all([getSeasonDashboard(seasonId, 'kids'), getSeasonDashboard(seasonId, 'sundaygames')]);
  return {
    seasonId: kids.seasonId,
    seasonTitle: kids.seasonTitle,
    top3: { kids: kids.top3, sundaygames: adults.top3 },
    top10: { kids: kids.tablePlayers.slice(0, 10), sundaygames: adults.tablePlayers.slice(0, 10) },
    stats: { games: kids.totals.games + adults.totals.games, players: kids.totals.players + adults.totals.players, mvp: kids.leaders.mostTop1?.nick || adults.leaders.mostTop1?.nick || null, pointsDelta: 0 },
    leagues: { kids: kids.totals, sundaygames: adults.totals }
  };
}

export async function getPlayerProfile(nickOrOptions = {}, leagueArg = 'kids') {
  const nick = typeof nickOrOptions === 'object' ? nickOrOptions.nick : nickOrOptions;
  const profile = await getPlayerAllTimeProfile(nick);
  if (!profile) return null;
  const league = typeof nickOrOptions === 'object' ? (nickOrOptions.league || profile.league) : leagueArg;
  const currentSeason = await getCurrentSeason();
  const snap = await getLeagueSnapshot(league, currentSeason.id);
  const current = snap.table.find((p) => normalizeHeader(p.nick) === normalizeHeader(nick));
  return {
    nick,
    avatarUrl: profile.avatar,
    league,
    allTime: { games: profile.allTime.games, wins: profile.allTime.wins, losses: profile.allTime.losses, draws: profile.allTime.draws, winRate: profile.allTime.winrate, mvp: profile.allTime.top1, top2: profile.allTime.top2, top3: profile.allTime.top3 },
    seasons: profile.seasons.map((s) => ({ seasonId: s.seasonId, seasonTitle: s.seasonTitle, games: s.games, wins: s.wins, losses: s.losses, draws: s.draws, mvp: s.top1, top2: s.top2, top3: s.top3, winRate: s.winrate })),
    current: current ? { rank: current.rankLetter, points: current.points, place: current.place, league } : null,
    insights: { topTeammates: [], topOpponents: [], teammateWinrate: null, versusWinrate: null },
    badges: []
  };
}

export async function getGameDay(dateOrOptions = {}, leagueArg = 'kids') {
  const dateYMD = typeof dateOrOptions === 'object' ? (dateOrOptions.date || dateOrOptions.dateYMD) : dateOrOptions;
  const league = typeof dateOrOptions === 'object' ? (dateOrOptions.league || dateOrOptions.leagueId) : leagueArg;
  const view = await getGameDayView({ dateYMD, league });
  return {
    date: view.dateYMD,
    league: view.league,
    mode: { mobile: true, tv: true },
    matches: view.matches.map((m, index) => ({
      timestamp: m.timestamp,
      date: m.date,
      teams: { sideA: m.team1, sideB: m.team2 },
      mvp: m.mvp1,
      winner: m.winner,
      rounds: m.rounds,
      pointsChanges: (view.logsByMatch[index] || []).map((entry) => ({ nick: entry.nick, delta: entry.delta, newPoints: entry.newPoints }))
    })),
    activePlayers: view.playersToday.map((p) => ({ nick: p.nick, matchesToday: p.games, mvpToday: p.mvp, rankingPlace: null }))
  };
}

export async function getSeasons() { return loadSeasonsConfig(); }
export async function ping() { return gasCall('ping', {}, 8_000, 5_000); }

export { normalizeLeague, safeErrorMessage };
