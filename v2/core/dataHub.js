import { jsonp } from './utils.js';

let SEASONS_CONFIG = null;
let GAS_URL = null;

const DEFAULT_CACHE_TTL_MS = 45_000;
const cache = new Map();

const HEADER_ALIASES = {
  nick: ['nickname', 'nick', 'player', 'name'],
  points: ['points', 'pts', 'score'],
  games: ['games', 'matches', 'played'],
  wins: ['wins', 'victories'],
  ties: ['ties', 'draws'],
  mvp: ['mvp', 'mvp1'],
  mvp2: ['mvp2'],
  mvp3: ['mvp3'],
  rankLetter: ['rank', 'rankletter', 'tier'],
  inactive: ['inactive', 'isinactive', 'activeflag'],
  timestamp: ['timestamp', 'date', 'datetime', 'createdat'],
  league: ['league', 'division'],
  winner: ['winner', 'winnerteam', 'win'],
  series: ['series', 'score', 'result'],
  team1: ['team1'],
  team2: ['team2'],
  penalties: ['penalties']
};

export async function loadSeasonsConfig() {
  if (SEASONS_CONFIG) return SEASONS_CONFIG;
  const attempts = [
    '/laser-tag-ranking/v2/core/seasons.config.json',
    '../core/seasons.config.json'
  ];

  let response = null;
  for (const url of attempts) {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      response = res;
      break;
    }
  }

  if (!response) throw new Error('Failed to load seasons config');
  SEASONS_CONFIG = await response.json();
  console.log('[v2] config loaded', SEASONS_CONFIG);
  return SEASONS_CONFIG;
}

function readCache(key, ttlMs = DEFAULT_CACHE_TTL_MS) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.ts > ttlMs) {
    cache.delete(key);
    return null;
  }
  return cached.data;
}

function writeCache(key, data) {
  cache.set(key, { ts: Date.now(), data });
  return data;
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeLeagueValue(league = '') {
  const raw = normalizeHeader(league);
  if (raw === 'olds') return 'sundaygames';
  if (raw === 'kids' || raw === 'sundaygames') return raw;
  return '';
}

function toNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? '').replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value) {
  const norm = normalizeHeader(value);
  return ['1', 'true', 'yes', 'inactive'].includes(norm);
}

function pickByAliases(source = {}, aliases = []) {
  if (!source || typeof source !== 'object') return '';
  for (const alias of aliases) {
    if (source[alias] !== undefined && source[alias] !== null) return source[alias];
  }
  return '';
}

function normalizeObjectRow(row = {}) {
  return Object.entries(row).reduce((acc, [key, value]) => {
    acc[normalizeHeader(key)] = value;
    return acc;
  }, {});
}

function parseNickList(raw = '') {
  return String(raw || '')
    .replace(/\r?\n/g, ',')
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function rankLetterFromPoints(points) {
  if (points >= 1200) return 'S';
  if (points >= 1000) return 'A';
  if (points >= 800) return 'B';
  if (points >= 600) return 'C';
  if (points >= 400) return 'D';
  if (points >= 200) return 'E';
  return 'F';
}

function isValidTimestamp(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return true;
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  const d = new Date(raw);
  return !Number.isNaN(d.getTime());
}

function ymd(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function getCurrentSeasonId(cfg) {
  return cfg.currentSeasonId;
}

function getSeasonById(cfg, seasonId) {
  const id = seasonId || getCurrentSeasonId(cfg);
  return cfg.seasons.find((season) => season.id === id) || cfg.seasons[0];
}

async function getGasUrl() {
  if (GAS_URL) return GAS_URL;
  const cfg = await loadSeasonsConfig();
  const configuredUrl = cfg?.endpoints?.gasUrl;
  GAS_URL = new URL(configuredUrl).toString();
  return GAS_URL;
}

function buildGasUrl(action, params = {}) {
  return getGasUrl().then((base) => {
    const url = new URL(base);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
    return url.toString();
  });
}

export async function getSheetRaw(sheetName, range = null) {
  const key = `raw:${sheetName}:${range || ''}`;
  const cached = readCache(key);
  if (cached) return cached;
  const url = await buildGasUrl('getSheetRaw', { sheet: sheetName, range });
  const payload = await jsonp(url, 15_000);
  const values = Array.isArray(payload?.values) ? payload.values : [];
  console.log('[v2] sheet raw rows', sheetName, values.length);
  return writeCache(key, { values });
}

function parseLeaderboardRows(rows, avatarMap = {}) {
  return rows
    .map((row) => normalizeObjectRow(row))
    .map((row) => {
      const nick = String(pickByAliases(row, HEADER_ALIASES.nick) || '').trim();
      const points = toNumber(pickByAliases(row, HEADER_ALIASES.points), 0);
      const games = toNumber(pickByAliases(row, HEADER_ALIASES.games), 0);
      const wins = toNumber(pickByAliases(row, HEADER_ALIASES.wins), 0);
      const ties = toNumber(pickByAliases(row, HEADER_ALIASES.ties), 0);
      const mvp = toNumber(pickByAliases(row, HEADER_ALIASES.mvp), 0);
      return {
        nick,
        points,
        games,
        wins,
        ties,
        winPct: games > 0 ? `${Math.round((wins / games) * 100)}%` : '',
        mvp,
        rankLetter: String(pickByAliases(row, HEADER_ALIASES.rankLetter) || rankLetterFromPoints(points)).trim() || rankLetterFromPoints(points),
        inactive: toBool(pickByAliases(row, HEADER_ALIASES.inactive)),
        avatarUrl: avatarMap[nick.toLowerCase()] || ''
      };
    })
    .filter((row) => row.nick)
    .sort((a, b) => b.points - a.points)
    .map((row, idx) => ({ place: idx + 1, ...row }));
}

function rowToObjectByHeader(headerRow = [], valueRow = []) {
  const out = {};
  headerRow.forEach((headerCell, index) => {
    const key = normalizeHeader(headerCell);
    if (key) out[key] = valueRow[index] ?? '';
  });
  return out;
}

function detectLeagueFromContext(values, rowIdx, colIdx) {
  const probes = [
    values[rowIdx]?.[colIdx - 1],
    values[rowIdx]?.[colIdx - 2],
    values[rowIdx - 1]?.[colIdx],
    values[rowIdx - 1]?.[colIdx - 1],
    values[rowIdx - 1]?.[colIdx - 2]
  ];
  for (const probe of probes) {
    const normalized = normalizeLeagueValue(probe);
    if (normalized) return normalized;
  }
  return '';
}

function parseRankingBlocks(values) {
  const rankings = { kids: [], sundaygames: [] };
  for (let r = 0; r < values.length; r += 1) {
    const row = values[r] || [];
    for (let c = 0; c < row.length - 1; c += 1) {
      if (normalizeHeader(row[c]) !== 'nickname' || normalizeHeader(row[c + 1]) !== 'points') continue;
      const league = detectLeagueFromContext(values, r, c);
      if (!league) continue;
      let cursor = r + 1;
      while (cursor < values.length) {
        const nick = String(values[cursor]?.[c] ?? '').trim();
        if (!nick) break;
        const points = toNumber(values[cursor]?.[c + 1], 0);
        rankings[league].push({ nickname: nick, points });
        cursor += 1;
      }
    }
  }
  return rankings;
}

export function parseCompositeSeasonSheet(values = []) {
  const matrix = Array.isArray(values) ? values : [];
  const requiredHeaders = ['timestamp', 'league', 'team1', 'team2', 'winner', 'mvp'];

  let gamesHeaderRowIdx = -1;
  let gamesHeaderMap = {};

  for (let r = 0; r < matrix.length; r += 1) {
    const row = (matrix[r] || []).map((cell) => normalizeHeader(cell));
    const headerMap = {};
    row.forEach((cell, idx) => {
      if (cell) headerMap[cell] = idx;
    });
    const hasRequired = requiredHeaders.every((header) => headerMap[header] !== undefined);
    if (hasRequired) {
      gamesHeaderRowIdx = r;
      gamesHeaderMap = headerMap;
      break;
    }
  }

  const matches = [];
  if (gamesHeaderRowIdx !== -1) {
    for (let r = gamesHeaderRowIdx + 1; r < matrix.length; r += 1) {
      const timestamp = matrix[r]?.[gamesHeaderMap.timestamp];
      if (!isValidTimestamp(timestamp)) break;
      const rawLeague = matrix[r]?.[gamesHeaderMap.league];
      const league = normalizeLeagueValue(rawLeague);
      if (league !== 'kids' && league !== 'sundaygames') continue;

      const rowObj = {
        timestamp,
        league,
        team1: matrix[r]?.[gamesHeaderMap.team1] ?? '',
        team2: matrix[r]?.[gamesHeaderMap.team2] ?? '',
        winner: matrix[r]?.[gamesHeaderMap.winner] ?? '',
        mvp: matrix[r]?.[gamesHeaderMap.mvp] ?? '',
        mvp2: matrix[r]?.[gamesHeaderMap.mvp2] ?? '',
        mvp3: matrix[r]?.[gamesHeaderMap.mvp3] ?? '',
        series: matrix[r]?.[gamesHeaderMap.series] ?? '',
        penalties: matrix[r]?.[gamesHeaderMap.penalties] ?? ''
      };
      matches.push(rowObj);
    }
  }

  const rankings = parseRankingBlocks(matrix);
  return { matches, rankings };
}

function parseGameRow(rawRow, fallbackLeague = '') {
  const row = normalizeObjectRow(rawRow);
  const league = normalizeLeagueValue(pickByAliases(row, HEADER_ALIASES.league) || fallbackLeague);
  const team1 = parseNickList(pickByAliases(row, HEADER_ALIASES.team1));
  const team2 = parseNickList(pickByAliases(row, HEADER_ALIASES.team2));
  const winnerRaw = normalizeHeader(pickByAliases(row, HEADER_ALIASES.winner));

  let winner = 'tie';
  if (winnerRaw === 'team1') winner = 'team1';
  if (winnerRaw === 'team2') winner = 'team2';

  return {
    date: ymd(pickByAliases(row, HEADER_ALIASES.timestamp)),
    timestamp: pickByAliases(row, HEADER_ALIASES.timestamp),
    league,
    team1,
    team2,
    winner,
    series: String(pickByAliases(row, HEADER_ALIASES.series) || ''),
    mvp1: String(pickByAliases(row, HEADER_ALIASES.mvp) || '').trim(),
    mvp2: String(pickByAliases(row, HEADER_ALIASES.mvp2) || '').trim(),
    mvp3: String(pickByAliases(row, HEADER_ALIASES.mvp3) || '').trim()
  };
}

function buildLeagueStats(matches) {
  return matches.reduce((acc, match) => {
    acc.gamesCount += 1;
    if (match.winner === 'team1') acc.winsTeam1 += 1;
    else if (match.winner === 'team2') acc.winsTeam2 += 1;
    else acc.ties += 1;
    return acc;
  }, { gamesCount: 0, winsTeam1: 0, winsTeam2: 0, ties: 0 });
}

async function getAvatarMapForSeason(season) {
  const avatarsSheet = season?.sources?.avatarsSheet;
  if (!avatarsSheet) return {};
  const raw = await getSheetRaw(avatarsSheet);
  const [header, ...rows] = raw.values;
  return rows.reduce((acc, row) => {
    const obj = normalizeObjectRow(rowToObjectByHeader(header, row));
    const nick = String(pickByAliases(obj, HEADER_ALIASES.nick) || '').trim();
    const avatarUrl = String(obj.avatarurl || obj.avatar || '').trim();
    if (nick && avatarUrl) acc[nick.toLowerCase()] = avatarUrl;
    return acc;
  }, {});
}

async function getSeasonData(season) {
  if (season.type === 'live') {
    const [kidsRaw, adultsRaw, gamesRaw] = await Promise.all([
      getSheetRaw(season.sources.kidsSheet),
      getSheetRaw(season.sources.sundaygamesSheet),
      getSheetRaw(season.sources.gamesSheet)
    ]);
    const [kidsHeader, ...kidsRows] = kidsRaw.values;
    const [adultsHeader, ...adultsRows] = adultsRaw.values;
    const [gamesHeader, ...gamesRows] = gamesRaw.values;

    return {
      leaderboardRows: {
        kids: kidsRows.map((row) => rowToObjectByHeader(kidsHeader, row)),
        sundaygames: adultsRows.map((row) => rowToObjectByHeader(adultsHeader, row))
      },
      matches: gamesRows.map((row) => parseGameRow(rowToObjectByHeader(gamesHeader, row))).filter((m) => m.league === 'kids' || m.league === 'sundaygames')
    };
  }

  if (season.type === 'compositeSheetV2') {
    const raw = await getSheetRaw(season.sheet);
    const parsed = parseCompositeSeasonSheet(raw.values);
    if (parsed.matches.length === 0) {
      console.log('[v2] composite matches empty preview', season.sheet, raw.values.slice(0, 5));
    }

    return {
      leaderboardRows: {
        kids: parsed.rankings.kids,
        sundaygames: parsed.rankings.sundaygames
      },
      matches: parsed.matches.map((row) => parseGameRow(row)).filter((m) => m.league === 'kids' || m.league === 'sundaygames')
    };
  }

  return { leaderboardRows: { kids: [], sundaygames: [] }, matches: [] };
}

export function getSeasons() {
  return SEASONS_CONFIG;
}

export function normalizeLeague(league = '') {
  return normalizeLeagueValue(league);
}

export async function getLeagueSnapshot({ league, leagueId, seasonId } = {}) {
  const cfg = await loadSeasonsConfig();
  const season = getSeasonById(cfg, seasonId);
  const normalizedLeague = normalizeLeagueValue(league || leagueId) || 'kids';
  const key = `league:${season.id}:${normalizedLeague}`;
  const cached = readCache(key);
  if (cached) return cached;

  const [avatarMap, seasonData] = await Promise.all([getAvatarMapForSeason(season), getSeasonData(season)]);
  const leaderboard = parseLeaderboardRows(seasonData.leaderboardRows[normalizedLeague] || [], avatarMap);
  const matches = seasonData.matches.filter((match) => match.league === normalizedLeague);
  if (matches.length === 0) {
    console.log('[v2] matches empty preview', season.id, normalizedLeague, seasonData.matches.slice(0, 5));
  }
  const matchStats = buildLeagueStats(matches);

  return writeCache(key, {
    seasonId: season.id,
    seasonTitle: season.uiLabel,
    league: normalizedLeague,
    leaderboard,
    top3: leaderboard.slice(0, 3),
    stats: {
      gamesCount: matchStats.gamesCount,
      roundsCount: null,
      winsBreakdown: {
        wins: matchStats.winsTeam1,
        losses: matchStats.winsTeam2,
        ties: matchStats.ties
      }
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
    top3: {
      kids: kids.top3,
      sundaygames: adults.top3
    },
    totals: {
      gamesCount: toNumber(kids.stats.gamesCount, 0) + toNumber(adults.stats.gamesCount, 0)
    },
    links: {
      kids: `./league.html?season=${season.id}&league=kids`,
      sundaygames: `./league.html?season=${season.id}&league=sundaygames`
    }
  };
}

async function collectGamesAcrossEnabledSeasons() {
  const cfg = await loadSeasonsConfig();
  const seasons = cfg.seasons.filter((season) => season.enabled !== false);
  const out = [];
  for (const season of seasons) {
    const seasonData = await getSeasonData(season);
    out.push({ seasonId: season.id, seasonTitle: season.uiLabel, matches: seasonData.matches });
  }
  return out;
}

function matchResultForNick(match, nick) {
  const normalizedNick = normalizeHeader(nick);
  const inTeam1 = match.team1.some((name) => normalizeHeader(name) === normalizedNick);
  const inTeam2 = match.team2.some((name) => normalizeHeader(name) === normalizedNick);
  if (!inTeam1 && !inTeam2) return null;
  if (match.winner === 'tie') return 'tie';
  if (inTeam1 && match.winner === 'team1') return 'win';
  if (inTeam2 && match.winner === 'team2') return 'win';
  return 'loss';
}

export async function getPlayerSummary({ nick } = {}) {
  if (!nick) return null;
  const normalizedNick = normalizeHeader(nick);
  const cfg = await loadSeasonsConfig();
  const seasons = cfg.seasons.filter((season) => season.enabled !== false);

  const seasonBlocks = [];
  const allTime = { games: 0, wins: 0, losses: 0, ties: 0, mvp1: 0, mvp2: 0, mvp3: 0 };

  for (const season of seasons) {
    const seasonData = await getSeasonData(season);
    const seasonStats = { games: 0, wins: 0, losses: 0, ties: 0, mvp1: 0, mvp2: 0, mvp3: 0 };

    seasonData.matches.forEach((match) => {
      const result = matchResultForNick(match, normalizedNick);
      if (!result) return;
      seasonStats.games += 1;
      if (result === 'win') seasonStats.wins += 1;
      else if (result === 'loss') seasonStats.losses += 1;
      else seasonStats.ties += 1;

      if (normalizeHeader(match.mvp1) === normalizedNick) seasonStats.mvp1 += 1;
      if (normalizeHeader(match.mvp2) === normalizedNick) seasonStats.mvp2 += 1;
      if (normalizeHeader(match.mvp3) === normalizedNick) seasonStats.mvp3 += 1;
    });

    if (seasonStats.games > 0) {
      allTime.games += seasonStats.games;
      allTime.wins += seasonStats.wins;
      allTime.losses += seasonStats.losses;
      allTime.ties += seasonStats.ties;
      allTime.mvp1 += seasonStats.mvp1;
      allTime.mvp2 += seasonStats.mvp2;
      allTime.mvp3 += seasonStats.mvp3;
      seasonBlocks.push({ seasonId: season.id, seasonTitle: season.uiLabel, ...seasonStats });
    }
  }

  if (allTime.games === 0) return null;
  const currentSeason = seasonBlocks.find((item) => item.seasonId === getCurrentSeasonId(cfg)) || null;
  return { nick, allTime, currentSeason, bySeason: seasonBlocks };
}

export async function getPlayerProfile({ nick } = {}) {
  if (!nick) return null;
  const summary = await getPlayerSummary({ nick });
  if (!summary) return null;

  const normalizedNick = normalizeHeader(nick);
  const bySeasonGames = await collectGamesAcrossEnabledSeasons();
  const teammateCounts = new Map();
  const opponentCounts = new Map();

  bySeasonGames.forEach(({ matches }) => {
    matches.forEach((match) => {
      const inTeam1 = match.team1.some((name) => normalizeHeader(name) === normalizedNick);
      const inTeam2 = match.team2.some((name) => normalizeHeader(name) === normalizedNick);
      if (!inTeam1 && !inTeam2) return;

      const teammates = (inTeam1 ? match.team1 : match.team2).filter((name) => normalizeHeader(name) !== normalizedNick);
      const opponents = inTeam1 ? match.team2 : match.team1;
      teammates.forEach((name) => teammateCounts.set(name, (teammateCounts.get(name) || 0) + 1));
      opponents.forEach((name) => opponentCounts.set(name, (opponentCounts.get(name) || 0) + 1));
    });
  });

  const toTopList = (map, metricName) => Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ nick: name, [metricName]: count }));

  return {
    nick,
    allTime: summary.allTime,
    currentSeason: summary.currentSeason,
    seasons: summary.bySeason,
    insights: {
      topTeammates: toTopList(teammateCounts, 'gamesTogether'),
      topOpponents: toTopList(opponentCounts, 'gamesAgainst')
    }
  };
}

export async function getGameDay({ league, leagueId, date } = {}) {
  return {
    date: date || new Date().toISOString().slice(0, 10),
    league: normalizeLeagueValue(league || leagueId) || 'kids',
    activePlayers: [],
    matches: []
  };
}
