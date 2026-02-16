import { jsonp } from './utils.js';

let SEASONS_CONFIG = null;
let GAS_URL = null;
const CACHE_TTL_MS = 20_000;
const cache = new Map();

const ACTION_FALLBACKS = ['getSheetRaw', 'getSheetAll', 'getSheet'];
const RANK_THRESHOLDS = [['S', 1200], ['A', 1000], ['B', 800], ['C', 600], ['D', 400], ['E', 200], ['F', 0]];

function normalizeHeader(value = '') {
  return String(value || '').trim().toLowerCase();
}

function toNumber(value, fallback = null) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? '').replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readCache(key, ttlMs = CACHE_TTL_MS) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > ttlMs) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function writeCache(key, value) {
  cache.set(key, { ts: Date.now(), value });
  return value;
}

function parseNickList(raw = '') {
  return String(raw || '')
    .replace(/\r?\n/g, ',')
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function rankLetterFromPoints(points) {
  for (const [rank, min] of RANK_THRESHOLDS) if ((points ?? 0) >= min) return rank;
  return 'F';
}

function winnerToCanonical(raw = '') {
  const val = normalizeHeader(raw);
  if (['team1', '1', 't1', 'win1', 'w1'].includes(val)) return 'team1';
  if (['team2', '2', 't2', 'win2', 'w2'].includes(val)) return 'team2';
  if (['tie', 'draw', 'x', 'нічия'].includes(val)) return 'tie';
  return 'tie';
}

function isValidDate(value) {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function detectHeaderIndex(matrix = [], limit = 10) {
  const max = Math.min(matrix.length, limit);
  for (let i = 0; i < max; i += 1) {
    const row = matrix[i] || [];
    const normalized = row.map(normalizeHeader);
    if (normalized.includes('team1') && normalized.includes('timestamp')) return i;
  }
  return matrix.length ? 0 : -1;
}

function objectRowsToHeaderRows(rows = []) {
  const keys = new Set();
  rows.forEach((row) => Object.keys(row || {}).forEach((key) => keys.add(normalizeHeader(key))));
  const header = Array.from(keys);
  const values = rows.map((row) => header.map((h) => row[h] ?? row?.[Object.keys(row || {}).find((k) => normalizeHeader(k) === h)] ?? ''));
  return { header, rows: values };
}

export async function loadSeasonsConfig() {
  if (SEASONS_CONFIG) return SEASONS_CONFIG;
  const url = new URL('./seasons.config.json', import.meta.url);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Config load failed: HTTP ${res.status}`);
  SEASONS_CONFIG = await res.json();
  GAS_URL = SEASONS_CONFIG?.endpoints?.gasUrl || null;
  return SEASONS_CONFIG;
}

export function normalizeLeague(lg) {
  const value = normalizeHeader(lg);
  if (!value) return '';
  if (value === 'olds') return 'sundaygames';
  if (value === 'kids') return 'kids';
  if (value === 'sundaygames') return 'sundaygames';
  return '';
}

async function gasCall(action, params = {}, timeoutMs = 12_000, ttl = CACHE_TTL_MS) {
  const cfg = await loadSeasonsConfig();
  const cacheKey = `${action}:${JSON.stringify(params)}`;
  const hit = readCache(cacheKey, ttl);
  if (hit) return hit;
  const payload = await jsonp(cfg.endpoints.gasUrl, { action, ...params }, timeoutMs);
  return writeCache(cacheKey, payload);
}

async function ping() {
  return gasCall('ping', {}, 8_000, 5_000);
}

function normalizeSheetPayload(payload, fallbackSheet = '') {
  if (!payload) return { status: 'ERROR', header: [], rows: [], sheet: fallbackSheet };

  const rows = Array.isArray(payload.rows) ? payload.rows : (Array.isArray(payload.data) ? payload.data : []);
  const header = Array.isArray(payload.header) ? payload.header : [];

  if (header.length && rows.length) {
    return { status: payload.status || 'OK', sheet: payload.sheet || fallbackSheet, header, rows };
  }

  if (rows.length && typeof rows[0] === 'object' && !Array.isArray(rows[0])) {
    const normalizedObjects = rows.map((row) => Object.entries(row || {}).reduce((acc, [k, v]) => {
      acc[normalizeHeader(k)] = v;
      return acc;
    }, {}));
    return { status: payload.status || 'OK', sheet: payload.sheet || fallbackSheet, ...objectRowsToHeaderRows(normalizedObjects) };
  }

  if (Array.isArray(payload) && payload.length && Array.isArray(payload[0])) {
    const headerIdx = detectHeaderIndex(payload, 3);
    if (headerIdx >= 0) {
      return {
        status: 'OK',
        sheet: fallbackSheet,
        header: payload[headerIdx],
        rows: payload.slice(headerIdx + 1)
      };
    }
  }

  return { status: payload.status || 'ERROR', sheet: payload.sheet || fallbackSheet, header: [], rows: [] };
}

export async function readSheet(sheetName) {
  let lastErr = null;
  for (const action of ACTION_FALLBACKS) {
    try {
      const payload = await gasCall(action, { sheet: sheetName });
      const normalized = normalizeSheetPayload(payload, sheetName);
      if (normalized.rows.length || normalized.header.length || normalizeHeader(normalized.status) === 'ok') {
        return normalized;
      }
    } catch (error) {
      lastErr = error;
    }
  }
  if (lastErr) throw lastErr;
  return { header: [], rows: [], sheet: sheetName };
}

function getColIdx(header = []) {
  const normalized = header.map(normalizeHeader);
  const idx = (names) => normalized.findIndex((h) => names.includes(h));
  return {
    timestamp: idx(['timestamp', 'date', 'datetime']),
    league: idx(['league', 'division']),
    team1: idx(['team1']),
    team2: idx(['team2']),
    winner: idx(['winner', 'winnerteam', 'win']),
    mvp: idx(['mvp', 'mvp1']),
    mvp2: idx(['mvp2']),
    mvp3: idx(['mvp3']),
    series: idx(['series', 'mode']),
    nick: idx(['nick', 'nickname', 'player', 'name']),
    points: idx(['points', 'pts', 'score'])
  };
}

export function parseMatchesFromSheet({ header = [], rows = [] }) {
  let localHeader = header;
  let localRows = rows;

  if (!localHeader.length && rows.length && Array.isArray(rows[0])) {
    const matrix = rows;
    const headerIndex = detectHeaderIndex(matrix, 10);
    if (headerIndex >= 0) {
      localHeader = matrix[headerIndex];
      localRows = matrix.slice(headerIndex + 1);
    }
  }

  if (localHeader.length && !localHeader.map(normalizeHeader).includes('team1')) {
    const matrix = [localHeader, ...localRows];
    const headerIndex = detectHeaderIndex(matrix, 10);
    if (headerIndex >= 0) {
      localHeader = matrix[headerIndex];
      localRows = matrix.slice(headerIndex + 1);
    }
  }

  const idx = getColIdx(localHeader);
  return localRows
    .map((row) => {
      const tsRaw = row[idx.timestamp] ?? '';
      if (!isValidDate(tsRaw)) return null;
      return {
        ts: new Date(tsRaw),
        league: normalizeLeague(row[idx.league] ?? ''),
        team1: parseNickList(row[idx.team1] ?? ''),
        team2: parseNickList(row[idx.team2] ?? ''),
        winner: winnerToCanonical(row[idx.winner] ?? ''),
        mvp1: String(row[idx.mvp] ?? '').trim(),
        mvp2: String(row[idx.mvp2] ?? '').trim(),
        mvp3: String(row[idx.mvp3] ?? '').trim(),
        series: String(row[idx.series] ?? '').trim()
      };
    })
    .filter(Boolean);
}

function parsePointsByLeague({ header = [], rows = [] }, league) {
  const idx = getColIdx(header);
  if (idx.nick < 0) return new Map();
  const out = new Map();
  rows.forEach((row) => {
    const nick = String(row[idx.nick] ?? '').trim();
    if (!nick) return;
    out.set(nick.toLowerCase(), toNumber(row[idx.points], null));
  });
  return out;
}

export function buildPlayerStats(matches, league, pointsMap = new Map()) {
  const stats = new Map();
  const touch = (nick) => {
    const key = nick.toLowerCase();
    if (!stats.has(key)) {
      stats.set(key, {
        nick,
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: null,
        mvpCount: 0,
        top2Count: 0,
        top3Count: 0,
        points: pointsMap.get(key) ?? null
      });
    }
    return stats.get(key);
  };

  matches.forEach((m) => {
    if (normalizeLeague(m.league) !== normalizeLeague(league)) return;
    const team1 = m.team1 || [];
    const team2 = m.team2 || [];

    const apply = (nick, side) => {
      const row = touch(nick);
      row.games += 1;
      if (m.winner === 'tie') row.draws += 1;
      else if (m.winner === side) row.wins += 1;
      else row.losses += 1;
      if (normalizeHeader(m.mvp1) === normalizeHeader(nick)) row.mvpCount += 1;
      if (normalizeHeader(m.mvp2) === normalizeHeader(nick)) row.top2Count += 1;
      if (normalizeHeader(m.mvp3) === normalizeHeader(nick)) row.top3Count += 1;
    };

    team1.forEach((nick) => apply(nick, 'team1'));
    team2.forEach((nick) => apply(nick, 'team2'));
  });

  stats.forEach((row) => {
    row.winRate = row.games ? Math.round((row.wins / row.games) * 100) : null;
    if (!pointsMap.has(row.nick.toLowerCase())) row.points = null;
  });
  return stats;
}

function aggregateLeagueHeader(statsMap) {
  let games = 0; let wins = 0; let losses = 0; let draws = 0;
  statsMap.forEach((s) => {
    games += s.games;
    wins += s.wins;
    losses += s.losses;
    draws += s.draws;
  });
  return { gamesCount: games || null, wins: wins || null, losses: losses || null, draws: draws || null };
}

function mapToSortedRows(statsMap, avatarsMap) {
  return Array.from(statsMap.values())
    .sort((a, b) => (b.points ?? -1e9) - (a.points ?? -1e9) || b.wins - a.wins || a.nick.localeCompare(b.nick, 'uk'))
    .map((row, index) => ({
      place: index + 1,
      nick: row.nick,
      avatarUrl: avatarsMap.get(row.nick.toLowerCase()) || '',
      points: row.points,
      games: row.games,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      winRate: row.winRate,
      mvp: row.mvpCount,
      mvp2: row.top2Count,
      mvp3: row.top3Count,
      rankLetter: rankLetterFromPoints(row.points ?? 0),
      inactive: false
    }));
}

function collectRelations(matches, nick) {
  const norm = normalizeHeader(nick);
  const teammates = new Map();
  const opponents = new Map();
  const series = new Map();

  matches.forEach((m) => {
    const t1 = m.team1.map((n) => normalizeHeader(n));
    const t2 = m.team2.map((n) => normalizeHeader(n));
    const inT1 = t1.includes(norm);
    const inT2 = t2.includes(norm);
    if (!inT1 && !inT2) return;

    const own = inT1 ? m.team1 : m.team2;
    const opp = inT1 ? m.team2 : m.team1;

    own.forEach((name) => {
      if (normalizeHeader(name) === norm) return;
      teammates.set(name, (teammates.get(name) || 0) + 1);
    });
    opp.forEach((name) => opponents.set(name, (opponents.get(name) || 0) + 1));

    if (m.series) series.set(m.series, (series.get(m.series) || 0) + 1);
  });

  const toTop = (source, keyA, keyB = 'nick') => Array.from(source.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ [keyB]: name, [keyA]: count }));

  return {
    topTeammates: toTop(teammates, 'gamesTogether'),
    topOpponents: toTop(opponents, 'gamesAgainst'),
    favoriteSeries: toTop(series, 'gamesInSeries', 'series')
  };
}

function getSeasonById(cfg, seasonId) {
  return cfg.seasons.find((s) => s.id === (seasonId || cfg.currentSeasonId)) || cfg.seasons[0];
}

async function getSeasonBundle(season) {
  const cacheKey = `seasonBundle:${season.id}`;
  const hit = readCache(cacheKey);
  if (hit) return hit;

  const [gamesSheet, kidsSheet, adultsSheet] = await Promise.all([
    readSheet(season.sources.gamesSheet),
    readSheet(season.sources.kidsSheet),
    readSheet(season.sources.sundaygamesSheet)
  ]);

  const matches = parseMatchesFromSheet(gamesSheet);
  const kidsPoints = parsePointsByLeague(kidsSheet, 'kids');
  const adultsPoints = parsePointsByLeague(adultsSheet, 'sundaygames');

  return writeCache(cacheKey, { matches, points: { kids: kidsPoints, sundaygames: adultsPoints } });
}

export async function getAvatarsMap() {
  const payload = await gasCall('listAvatars', {}, 12_000, 60_000);
  const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.rows) ? payload.rows : [];
  const map = new Map();
  items.forEach((item) => {
    const nick = String(item?.nick ?? '').trim();
    const url = String(item?.url ?? '').trim();
    if (nick && url) map.set(nick.toLowerCase(), url);
  });
  return map;
}

export async function getHomeSnapshot() {
  const cfg = await loadSeasonsConfig();
  const season = getSeasonById(cfg, cfg.currentSeasonId);
  const [kids, adults] = await Promise.all([
    getLeagueSnapshot({ seasonId: season.id, league: 'kids' }),
    getLeagueSnapshot({ seasonId: season.id, league: 'sundaygames' })
  ]);
  return {
    seasonId: season.id,
    seasonTitle: season.uiLabel,
    top3: { kids: kids.top3, sundaygames: adults.top3 }
  };
}

export async function getLeagueSnapshot({ league, leagueId, seasonId } = {}) {
  const cfg = await loadSeasonsConfig();
  const season = getSeasonById(cfg, seasonId);
  const normalizedLeague = normalizeLeague(league || leagueId) || 'kids';
  const key = `league:${season.id}:${normalizedLeague}`;
  const hit = readCache(key);
  if (hit) return hit;

  const [bundle, avatars] = await Promise.all([getSeasonBundle(season), getAvatarsMap()]);
  const points = season.id === cfg.currentSeasonId ? bundle.points[normalizedLeague] : new Map();
  const statsMap = buildPlayerStats(bundle.matches, normalizedLeague, points);
  const leaderboard = mapToSortedRows(statsMap, avatars);
  const totals = aggregateLeagueHeader(statsMap);

  return writeCache(key, {
    seasonId: season.id,
    seasonTitle: season.uiLabel,
    league: normalizedLeague,
    top3: leaderboard.slice(0, 3),
    leaderboard,
    stats: {
      gamesCount: totals.gamesCount,
      winsBreakdown: { wins: totals.wins, losses: totals.losses, ties: totals.draws }
    }
  });
}

export async function getSeasonOverview({ seasonId } = {}) {
  const cfg = await loadSeasonsConfig();
  const season = getSeasonById(cfg, seasonId);
  const [kids, adults] = await Promise.all([
    getLeagueSnapshot({ seasonId: season.id, league: 'kids' }),
    getLeagueSnapshot({ seasonId: season.id, league: 'sundaygames' })
  ]);
  return {
    seasonId: season.id,
    seasonTitle: season.uiLabel,
    top3: { kids: kids.top3, sundaygames: adults.top3 },
    links: {
      kids: `./season.html?season=${season.id}&league=kids`,
      sundaygames: `./season.html?season=${season.id}&league=sundaygames`
    }
  };
}

export async function getPlayerProfile({ nick, league } = {}) {
  if (!nick) return null;
  const cfg = await loadSeasonsConfig();
  const normalizedNick = normalizeHeader(nick);
  const enabledSeasons = cfg.seasons.filter((s) => s.enabled !== false);
  const [avatars, seasonBundles] = await Promise.all([
    getAvatarsMap(),
    Promise.all(enabledSeasons.map(async (season) => ({ season, bundle: await getSeasonBundle(season) })))
  ]);

  const seasonStats = [];
  const allMatches = [];
  const total = { games: 0, wins: 0, losses: 0, draws: 0, mvp: 0, mvp2: 0, mvp3: 0 };

  seasonBundles.forEach(({ season, bundle }) => {
    const stats = { seasonId: season.id, seasonTitle: season.uiLabel, games: 0, wins: 0, losses: 0, draws: 0, mvp: 0, mvp2: 0, mvp3: 0 };
    bundle.matches.forEach((m) => {
      const t1 = m.team1.map((n) => normalizeHeader(n));
      const t2 = m.team2.map((n) => normalizeHeader(n));
      const isT1 = t1.includes(normalizedNick);
      const isT2 = t2.includes(normalizedNick);
      if (!isT1 && !isT2) return;

      allMatches.push(m);
      stats.games += 1;
      if (m.winner === 'tie') stats.draws += 1;
      else if ((isT1 && m.winner === 'team1') || (isT2 && m.winner === 'team2')) stats.wins += 1;
      else stats.losses += 1;

      if (normalizeHeader(m.mvp1) === normalizedNick) stats.mvp += 1;
      if (normalizeHeader(m.mvp2) === normalizedNick) stats.mvp2 += 1;
      if (normalizeHeader(m.mvp3) === normalizedNick) stats.mvp3 += 1;
    });

    if (stats.games > 0) {
      seasonStats.push(stats);
      total.games += stats.games;
      total.wins += stats.wins;
      total.losses += stats.losses;
      total.draws += stats.draws;
      total.mvp += stats.mvp;
      total.mvp2 += stats.mvp2;
      total.mvp3 += stats.mvp3;
    }
  });

  if (!total.games) return null;

  const winter = await getLeagueSnapshot({ seasonId: cfg.currentSeasonId, league: normalizeLeague(league) || 'kids' });
  const current = winter.leaderboard.find((p) => normalizeHeader(p.nick) === normalizedNick) || null;

  return {
    nick,
    avatarUrl: avatars.get(normalizedNick) || '',
    allTime: { ...total, winRate: total.games ? Math.round((total.wins / total.games) * 100) : null },
    seasons: seasonStats,
    current: current ? { rank: current.rankLetter, points: current.points, place: current.place, league: winter.league } : null,
    insights: collectRelations(allMatches, nick)
  };
}

export async function getPlayerSummary({ nick } = {}) {
  const profile = await getPlayerProfile({ nick });
  if (!profile) return null;
  return { nick: profile.nick, allTime: profile.allTime, bySeason: profile.seasons };
}

export async function getGameDay({ league, leagueId, date } = {}) {
  const snapshot = await getLeagueSnapshot({ league: league || leagueId || 'kids' });
  return {
    date: date || new Date().toISOString().slice(0, 10),
    league: snapshot.league,
    activePlayers: snapshot.leaderboard.slice(0, 12).map((p) => ({ nick: p.nick, matchesToday: p.games || 0, mvpToday: p.mvp || 0 })),
    matches: []
  };
}

export function getSeasons() {
  return SEASONS_CONFIG;
}

export async function collectGamesAcrossEnabledSeasons() {
  const cfg = await loadSeasonsConfig();
  const seasons = cfg.seasons.filter((s) => s.enabled !== false);
  return Promise.all(seasons.map(async (season) => ({ seasonId: season.id, seasonTitle: season.uiLabel, matches: (await getSeasonBundle(season)).matches })));
}

export { ping };
