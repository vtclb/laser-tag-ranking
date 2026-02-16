import seasonsConfig from './seasons.config.json' assert { type: 'json' };

const GAS_URL = (() => {
  const configuredUrl = seasonsConfig?.endpoints?.gasUrl;
  if (!configuredUrl) throw new Error('Config load failed');
  try {
    return new URL(configuredUrl).toString();
  } catch {
    throw new Error('Config load failed');
  }
})();
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_COUNT = 1;
const DEFAULT_CACHE_TTL_MS = 45_000;
const cache = new Map();

const HEADER_ALIASES = {
  nick: ['nickname', 'nick', 'player', 'name'],
  points: ['points', 'pts', 'score'],
  games: ['games', 'matches', 'played'],
  winPct: ['win%', 'winrate', 'win pct', 'winpercent', 'win percentage'],
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
  team3: ['team3'],
  team4: ['team4'],
  delta: ['delta', 'pointsdelta'],
  avatarUrl: ['avatarurl', 'avatar', 'url']
};

const isMockMode = (() => {
  try {
    return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mock') === '1';
  } catch {
    return false;
  }
})();

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeLeague(league = 'kids') {
  const lg = String(league || '').trim().toLowerCase();
  if (['olds', 'old', 'adult', 'adults', 'sunday', 'sundaygames'].includes(lg)) return 'sundaygames';
  return 'kids';
}

function getCurrentSeasonId() {
  return seasonsConfig.currentSeasonId;
}

function getSeasonById(seasonId) {
  const id = seasonId || getCurrentSeasonId();
  return seasonsConfig.seasons.find((season) => season.id === id) || seasonsConfig.seasons[0];
}

function toNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value || '').replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value) {
  const norm = String(value || '').trim().toLowerCase();
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

function ymd(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
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

async function fetchWithTimeoutRetry(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRY_COUNT) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) return response.json();
      const text = await response.text();
      return JSON.parse(text);
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
    }
  }
  throw lastError;
}

function gasUrl(action, params = {}) {
  const url = new URL(GAS_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function asArrayRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.values)) return payload.values;
  return [];
}

function colLetterToIndex(letter) {
  let idx = 0;
  const chars = String(letter || '').toUpperCase().replace(/[^A-Z]/g, '');
  for (let i = 0; i < chars.length; i += 1) idx = idx * 26 + chars.charCodeAt(i) - 64;
  return Math.max(0, idx - 1);
}

async function getSheetAllRows(sheet) {
  const key = `all:${sheet}`;
  const cached = readCache(key);
  if (cached) return cached;
  const payload = await fetchWithTimeoutRetry(gasUrl('getSheetAll', { sheet }));
  return writeCache(key, asArrayRows(payload));
}

async function getSheetRows(sheet) {
  const key = `sheet:${sheet}`;
  const cached = readCache(key);
  if (cached) return cached;
  const payload = await fetchWithTimeoutRetry(gasUrl('getSheet', { sheet }));
  return writeCache(key, asArrayRows(payload));
}

function findHeaderValueAt(matrix, rowIdx, colIdx) {
  return normalizeHeader(matrix?.[rowIdx]?.[colIdx]);
}

function discoverCompositeLeaderboardStart(matrix, preferredHeader = '') {
  const rowsToScan = Math.min(4, matrix.length);
  for (let row = 0; row < rowsToScan; row += 1) {
    const values = matrix[row] || [];
    for (let col = 0; col < values.length; col += 1) {
      const nick = findHeaderValueAt(matrix, row + 1, col);
      const points = findHeaderValueAt(matrix, row + 1, col + 1);
      const marker = normalizeHeader(values[col]);
      if (nick === 'nickname' && points === 'points') {
        if (!preferredHeader || marker.includes(preferredHeader)) return { col, headerRow: row + 1, dataRow: row + 2 };
      }
    }
  }
  return null;
}

function matrixBlockToObjects(matrix, { startCol, headerRow, dataStartRow }) {
  const header = (matrix[headerRow] || []).slice(startCol).map((item) => normalizeHeader(item));
  const width = header.findIndex((item) => !item);
  const boundedHeader = (width === -1 ? header : header.slice(0, width)).filter(Boolean);
  if (!boundedHeader.length) return [];

  const rows = [];
  for (let r = dataStartRow; r < matrix.length; r += 1) {
    const nickCell = String(matrix[r]?.[startCol] || '').trim();
    if (!nickCell) break;
    const row = {};
    boundedHeader.forEach((key, idx) => {
      row[key] = matrix[r]?.[startCol + idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function parseLeaderboardRows(rows, avatarMap = {}) {
  return rows
    .map((row) => normalizeObjectRow(row))
    .map((row) => {
      const nick = String(pickByAliases(row, HEADER_ALIASES.nick) || '').trim();
      const points = toNumber(pickByAliases(row, HEADER_ALIASES.points), 0);
      const games = toNumber(pickByAliases(row, HEADER_ALIASES.games), 0);
      const mvp = toNumber(pickByAliases(row, HEADER_ALIASES.mvp), 0);
      const wins = toNumber(pickByAliases(row, HEADER_ALIASES.wins), 0);
      const ties = toNumber(pickByAliases(row, HEADER_ALIASES.ties), 0);
      const winPctRaw = pickByAliases(row, HEADER_ALIASES.winPct);
      const winPct = typeof winPctRaw === 'string' || typeof winPctRaw === 'number'
        ? String(winPctRaw).trim()
        : (games > 0 ? `${Math.round((wins / games) * 100)}%` : '');
      return {
        nick,
        points,
        games,
        winPct,
        mvp,
        wins,
        ties,
        rankLetter: String(pickByAliases(row, HEADER_ALIASES.rankLetter) || rankLetterFromPoints(points)).trim() || rankLetterFromPoints(points),
        inactive: toBool(pickByAliases(row, HEADER_ALIASES.inactive)),
        avatarUrl: avatarMap[nick.toLowerCase()] || ''
      };
    })
    .filter((row) => row.nick)
    .sort((a, b) => b.points - a.points)
    .map((row, idx) => ({ place: idx + 1, ...row }));
}

function extractSeasonStats(leaderboard) {
  const totals = leaderboard.reduce((acc, row) => {
    acc.games += toNumber(row.games, 0);
    acc.wins += toNumber(row.wins, 0);
    acc.ties += toNumber(row.ties, 0);
    return acc;
  }, { games: 0, wins: 0, ties: 0 });

  return {
    gamesCount: totals.games,
    roundsCount: null,
    winsBreakdown: { wins: totals.wins, ties: totals.ties }
  };
}

function parseGameRow(rawRow, fallbackLeague = '') {
  const row = normalizeObjectRow(rawRow);
  const team1 = parseNickList(pickByAliases(row, HEADER_ALIASES.team1));
  const team2 = parseNickList(pickByAliases(row, HEADER_ALIASES.team2));
  const team3 = parseNickList(pickByAliases(row, HEADER_ALIASES.team3));
  const team4 = parseNickList(pickByAliases(row, HEADER_ALIASES.team4));
  const league = normalizeLeague(pickByAliases(row, HEADER_ALIASES.league) || fallbackLeague);
  const winner = String(pickByAliases(row, HEADER_ALIASES.winner) || '').trim().toLowerCase();
  let winnerSide = 'tie';
  if (['team1', 'team2'].includes(winner)) winnerSide = 'teamA';
  if (['team3', 'team4'].includes(winner)) winnerSide = 'teamB';
  return {
    date: ymd(pickByAliases(row, HEADER_ALIASES.timestamp)),
    timestamp: pickByAliases(row, HEADER_ALIASES.timestamp),
    league,
    teams: { team1, team2, team3, team4, sideA: [...team1, ...team2], sideB: [...team3, ...team4] },
    winner: winnerSide,
    series: String(pickByAliases(row, HEADER_ALIASES.series) || ''),
    mvp1: String(pickByAliases(row, HEADER_ALIASES.mvp) || '').trim(),
    mvp2: String(pickByAliases(row, HEADER_ALIASES.mvp2) || '').trim(),
    mvp3: String(pickByAliases(row, HEADER_ALIASES.mvp3) || '').trim()
  };
}

async function getAvatarMapForSeason(season) {
  const avatarsSheet = season?.sources?.avatarsSheet;
  if (!avatarsSheet) return {};
  const rows = await getSheetRows(avatarsSheet);
  return rows.reduce((acc, raw) => {
    const row = normalizeObjectRow(raw);
    const nick = String(pickByAliases(row, HEADER_ALIASES.nick) || '').trim();
    const avatarUrl = String(pickByAliases(row, HEADER_ALIASES.avatarUrl) || '').trim();
    if (nick && avatarUrl) acc[nick.toLowerCase()] = avatarUrl;
    return acc;
  }, {});
}

async function getLiveLeaderboardRows(season, league) {
  const sheet = league === 'kids' ? season.sources.kidsSheet : season.sources.adultsSheet;
  return getSheetRows(sheet);
}

async function getCompositeData(season) {
  const raw = await getSheetAllRows(season.sourceSheet);
  if (!raw.length) return { kidsRows: [], adultsRows: [], gameRows: [], logRows: [] };

  if (!Array.isArray(raw[0])) {
    const rows = raw.map((r) => normalizeObjectRow(r));
    return {
      kidsRows: rows.filter((row) => normalizeLeague(pickByAliases(row, HEADER_ALIASES.league)) === 'kids'),
      adultsRows: rows.filter((row) => normalizeLeague(pickByAliases(row, HEADER_ALIASES.league)) === 'sundaygames'),
      gameRows: rows,
      logRows: []
    };
  }

  const matrix = raw;
  const mapCfg = season.mapping.blocks;
  const kidsFound = discoverCompositeLeaderboardStart(matrix, mapCfg.kidsLeaderboard.preferredHeader);
  const adultsFound = discoverCompositeLeaderboardStart(matrix, mapCfg.adultsLeaderboard.preferredHeader);
  const kidsStart = kidsFound || {
    col: colLetterToIndex(mapCfg.kidsLeaderboard.fallbackStartColumn),
    headerRow: mapCfg.kidsLeaderboard.fallbackHeaderRow - 1,
    dataRow: mapCfg.kidsLeaderboard.fallbackDataStartRow - 1
  };
  const adultsStart = adultsFound || {
    col: colLetterToIndex(mapCfg.adultsLeaderboard.fallbackStartColumn),
    headerRow: mapCfg.adultsLeaderboard.fallbackHeaderRow - 1,
    dataRow: mapCfg.adultsLeaderboard.fallbackDataStartRow - 1
  };

  const gamesCfg = mapCfg.games;
  const logsCfg = mapCfg.logs;
  const gameRows = matrixBlockToObjects(matrix, {
    startCol: colLetterToIndex(gamesCfg.fallbackStartColumn),
    headerRow: gamesCfg.fallbackHeaderRow - 1,
    dataStartRow: gamesCfg.fallbackDataStartRow - 1
  });
  const logRows = matrixBlockToObjects(matrix, {
    startCol: colLetterToIndex(logsCfg.fallbackStartColumn),
    headerRow: logsCfg.fallbackHeaderRow - 1,
    dataStartRow: logsCfg.fallbackDataStartRow - 1
  });

  return {
    kidsRows: matrixBlockToObjects(matrix, { startCol: kidsStart.col, headerRow: kidsStart.headerRow, dataStartRow: kidsStart.dataRow }),
    adultsRows: matrixBlockToObjects(matrix, { startCol: adultsStart.col, headerRow: adultsStart.headerRow, dataStartRow: adultsStart.dataRow }),
    gameRows,
    logRows
  };
}

async function loadLeaderboardRows(season, league) {
  if (season.type === 'live') return getLiveLeaderboardRows(season, league);
  if (season.type === 'compositeSheetV1') {
    const composite = await getCompositeData(season);
    return league === 'kids' ? composite.kidsRows : composite.adultsRows;
  }
  return [];
}

async function loadGamesRows(season) {
  if (season.type === 'live') return getSheetRows(season.sources.gamesSheet);
  if (season.type === 'compositeSheetV1') {
    const composite = await getCompositeData(season);
    return composite.gameRows;
  }
  return [];
}

export function getSeasons() {
  return seasonsConfig;
}

export { normalizeLeague };

export async function getLeagueSnapshot({ league, leagueId, seasonId } = {}) {
  const season = getSeasonById(seasonId);
  const normalizedLeague = normalizeLeague(league || leagueId);
  const key = `league:${season.id}:${normalizedLeague}`;
  const cached = readCache(key);
  if (cached) return cached;

  if (isMockMode) {
    return writeCache(key, {
      seasonId: season.id,
      league: normalizedLeague,
      leaderboard: [],
      top3: [],
      stats: { gamesCount: 0, roundsCount: 0, winsBreakdown: { wins: 0, ties: 0 } }
    });
  }

  const [avatarMap, rows] = await Promise.all([getAvatarMapForSeason(season), loadLeaderboardRows(season, normalizedLeague)]);
  const leaderboard = parseLeaderboardRows(rows, avatarMap);
  const top3 = leaderboard.slice(0, 3);
  const stats = extractSeasonStats(leaderboard);

  return writeCache(key, {
    seasonId: season.id,
    seasonTitle: season.uiLabel,
    league: normalizedLeague,
    leaderboard,
    top3,
    stats
  });
}

export async function getSeasonOverview({ seasonId } = {}) {
  const season = getSeasonById(seasonId);
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

async function collectPlayerBySeason(nick) {
  const normalizedNick = String(nick || '').trim().toLowerCase();
  const seasons = seasonsConfig.seasons.filter((season) => season.enabled !== false && season.type !== 'legacy');
  const blocks = [];

  for (const season of seasons) {
    const [kids, adults] = await Promise.all([
      getLeagueSnapshot({ seasonId: season.id, league: 'kids' }),
      getLeagueSnapshot({ seasonId: season.id, league: 'sundaygames' })
    ]);

    const fromKids = kids.leaderboard.find((row) => row.nick.toLowerCase() === normalizedNick);
    const fromAdults = adults.leaderboard.find((row) => row.nick.toLowerCase() === normalizedNick);
    if (!fromKids && !fromAdults) continue;

    const merge = [fromKids, fromAdults].filter(Boolean).reduce((acc, row) => {
      acc.games += toNumber(row.games, 0);
      acc.points += toNumber(row.points, 0);
      acc.mvp += toNumber(row.mvp, 0);
      acc.leagues.push(row === fromKids ? 'kids' : 'sundaygames');
      return acc;
    }, { games: 0, points: 0, mvp: 0, leagues: [] });

    blocks.push({
      seasonId: season.id,
      seasonTitle: season.uiLabel,
      ...merge
    });
  }

  return blocks;
}

export async function getPlayerSummary({ nick } = {}) {
  if (!nick) return null;
  const bySeason = await collectPlayerBySeason(nick);
  const current = bySeason.find((item) => item.seasonId === getCurrentSeasonId()) || null;
  const allTime = bySeason.reduce((acc, item) => {
    acc.games += item.games;
    acc.points += item.points;
    acc.mvp += item.mvp;
    return acc;
  }, { games: 0, points: 0, mvp: 0 });

  return { nick, allTime, currentSeason: current, bySeason };
}

async function collectGamesAcrossEnabledSeasons() {
  const seasons = seasonsConfig.seasons.filter((season) => season.enabled !== false && season.type !== 'legacy');
  const bySeasonGames = [];
  for (const season of seasons) {
    const gameRows = await loadGamesRows(season);
    bySeasonGames.push({ seasonId: season.id, seasonTitle: season.uiLabel, games: gameRows.map((row) => parseGameRow(row)) });
  }
  return bySeasonGames;
}

export async function getPlayerProfile({ nick } = {}) {
  if (!nick) return null;
  const normalizedNick = String(nick).trim().toLowerCase();
  const summary = await getPlayerSummary({ nick });
  if (!summary?.bySeason?.length) return null;

  const bySeasonGames = await collectGamesAcrossEnabledSeasons();
  const teammateCounts = new Map();
  const opponentCounts = new Map();

  bySeasonGames.forEach(({ games }) => {
    games.forEach((game) => {
      const sideA = game.teams.sideA;
      const sideB = game.teams.sideB;
      const inA = sideA.some((n) => n.toLowerCase() === normalizedNick);
      const inB = sideB.some((n) => n.toLowerCase() === normalizedNick);
      if (!inA && !inB) return;

      const teammates = (inA ? sideA : sideB).filter((n) => n.toLowerCase() !== normalizedNick);
      const opponents = inA ? sideB : sideA;
      teammates.forEach((name) => teammateCounts.set(name, (teammateCounts.get(name) || 0) + 1));
      opponents.forEach((name) => opponentCounts.set(name, (opponentCounts.get(name) || 0) + 1));
    });
  });

  const toTopList = (map, keyName) => Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ nick: name, [keyName]: count }));

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
    league: normalizeLeague(league || leagueId),
    activePlayers: [],
    matches: []
  };
}
