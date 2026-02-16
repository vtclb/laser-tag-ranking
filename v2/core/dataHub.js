let SEASONS_CONFIG = null;
let GAS_URL = null;

const CACHE_TTL_MS = 20_000;
const REQUEST_TIMEOUT_MS = 12_000;
const cache = new Map();

const HEADER_ALIASES = {
  nick: ['nickname', 'nick', 'player', 'name'],
  points: ['points', 'pts', 'score'],
  games: ['games', 'matches', 'played'],
  wins: ['wins', 'victories'],
  losses: ['losses', 'loses'],
  ties: ['ties', 'draws'],
  mvp: ['mvp', 'mvp1'],
  mvp2: ['mvp2'],
  mvp3: ['mvp3'],
  rankLetter: ['rank', 'rankletter', 'tier'],
  inactive: ['inactive', 'isinactive', 'activeflag'],
  timestamp: ['timestamp', 'date', 'datetime', 'createdat'],
  league: ['league', 'division'],
  winner: ['winner', 'winnerteam', 'win'],
  series: ['series', 'mode'],
  team1: ['team1'],
  team2: ['team2'],
  team3: ['team3'],
  team4: ['team4'],
  penalties: ['penalties']
};

const RANK_THRESHOLDS = [
  ['S', 1200],
  ['A', 1000],
  ['B', 800],
  ['C', 600],
  ['D', 400],
  ['E', 200],
  ['F', 0]
];

export async function loadSeasonsConfig() {
  if (SEASONS_CONFIG) return SEASONS_CONFIG;

  const attempts = [
    '/laser-tag-ranking/v2/core/seasons.config.json',
    '/v2/core/seasons.config.json',
    '../core/seasons.config.json'
  ];

  for (const url of attempts) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      SEASONS_CONFIG = await res.json();
      return SEASONS_CONFIG;
    } catch {
      // noop: fallback path
    }
  }

  throw new Error('Failed to load seasons config');
}

function readCache(key, ttlMs = CACHE_TTL_MS) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > ttlMs) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function writeCache(key, data) {
  cache.set(key, { ts: Date.now(), data });
  return data;
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase();
}

function toNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? '').replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value) {
  return ['1', 'true', 'yes', 'inactive'].includes(normalizeHeader(value));
}

function ymd(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function parseNickList(raw = '') {
  return String(raw || '')
    .replace(/\r?\n/g, ',')
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickByAliases(source = {}, aliases = []) {
  for (const alias of aliases) {
    if (source[alias] !== undefined && source[alias] !== null) return source[alias];
  }
  return '';
}

function normalizeObjectRow(row = {}) {
  return Object.entries(row).reduce((acc, [k, v]) => {
    acc[normalizeHeader(k)] = v;
    return acc;
  }, {});
}

function rowToObjectByHeader(headerRow = [], valueRow = []) {
  const out = {};
  headerRow.forEach((h, i) => {
    const key = normalizeHeader(h);
    if (key) out[key] = valueRow[i] ?? '';
  });
  return out;
}

function getCurrentSeasonId(cfg) {
  return cfg.currentSeasonId;
}

function getSeasonById(cfg, seasonId) {
  return cfg.seasons.find((s) => s.id === (seasonId || cfg.currentSeasonId)) || cfg.seasons[0];
}

export function normalizeLeague(league = '') {
  const raw = normalizeHeader(league);
  if (raw === 'olds') return 'sundaygames';
  if (raw === 'sundaygames' || raw === 'kids') return raw;
  return '';
}

function rankLetterFromPoints(points) {
  for (const [rank, minPoints] of RANK_THRESHOLDS) {
    if (points >= minPoints) return rank;
  }
  return 'F';
}

async function getGasUrl() {
  if (GAS_URL) return GAS_URL;
  const cfg = await loadSeasonsConfig();
  GAS_URL = new URL(cfg.endpoints.gasUrl).toString();
  return GAS_URL;
}

async function fetchJsonWithRetry(url, timeoutMs = REQUEST_TIMEOUT_MS, retries = 1) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error('Request failed');
}

async function gasRequest(action, params = {}, ttl = CACHE_TTL_MS) {
  const base = await getGasUrl();
  const url = new URL(base);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });
  const cacheKey = `${action}:${url.search}`;
  const hit = readCache(cacheKey, ttl);
  if (hit) return hit;
  const data = await fetchJsonWithRetry(url.toString());
  return writeCache(cacheKey, data);
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.values)) return payload.values;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

async function getSheetRows(sheetName) {
  const payload = await gasRequest('getSheet', { sheet: sheetName });
  const rows = extractRows(payload);
  if (!rows.length) {
    const fallback = await gasRequest('getSheetAll', { sheet: sheetName });
    return extractRows(fallback);
  }
  return rows;
}

function parseLeaderboardRows(rows, avatarMap = {}) {
  return rows
    .map((raw) => normalizeObjectRow(raw))
    .map((row) => {
      const nick = String(pickByAliases(row, HEADER_ALIASES.nick) || '').trim();
      const points = toNumber(pickByAliases(row, HEADER_ALIASES.points), 0);
      const games = toNumber(pickByAliases(row, HEADER_ALIASES.games), 0);
      const wins = toNumber(pickByAliases(row, HEADER_ALIASES.wins), 0);
      const losses = toNumber(pickByAliases(row, HEADER_ALIASES.losses), Math.max(0, games - wins - toNumber(pickByAliases(row, HEADER_ALIASES.ties), 0)));
      const draws = toNumber(pickByAliases(row, HEADER_ALIASES.ties), 0);
      const mvp = toNumber(pickByAliases(row, HEADER_ALIASES.mvp), 0);
      const mvp2 = toNumber(pickByAliases(row, HEADER_ALIASES.mvp2), 0);
      const mvp3 = toNumber(pickByAliases(row, HEADER_ALIASES.mvp3), 0);
      return {
        nick,
        points,
        games: games || null,
        wins: wins || null,
        losses: losses || null,
        draws: draws || null,
        winRate: games > 0 ? Math.round((wins / games) * 100) : null,
        mvp: mvp || null,
        mvp2: mvp2 || null,
        mvp3: mvp3 || null,
        rankLetter: String(pickByAliases(row, HEADER_ALIASES.rankLetter) || rankLetterFromPoints(points)).trim(),
        inactive: toBool(pickByAliases(row, HEADER_ALIASES.inactive)),
        avatarUrl: avatarMap[nick.toLowerCase()] || ''
      };
    })
    .filter((row) => row.nick)
    .sort((a, b) => b.points - a.points)
    .map((row, index) => ({ place: index + 1, ...row }));
}

function parseGameRow(rawRow = {}) {
  const row = normalizeObjectRow(rawRow);
  const league = normalizeLeague(pickByAliases(row, HEADER_ALIASES.league));
  const timestamp = pickByAliases(row, HEADER_ALIASES.timestamp);
  const winnerRaw = normalizeHeader(pickByAliases(row, HEADER_ALIASES.winner));
  const teams = {
    team1: parseNickList(pickByAliases(row, HEADER_ALIASES.team1)),
    team2: parseNickList(pickByAliases(row, HEADER_ALIASES.team2)),
    team3: parseNickList(pickByAliases(row, HEADER_ALIASES.team3)),
    team4: parseNickList(pickByAliases(row, HEADER_ALIASES.team4))
  };

  let winner = 'tie';
  if (/^team[1-4]$/.test(winnerRaw)) winner = winnerRaw;
  if (winnerRaw === 'tie' || winnerRaw === 'draw') winner = 'tie';

  return {
    timestamp,
    date: ymd(timestamp),
    league,
    ...teams,
    winner,
    mvp: String(pickByAliases(row, HEADER_ALIASES.mvp) || '').trim(),
    mvp2: String(pickByAliases(row, HEADER_ALIASES.mvp2) || '').trim(),
    mvp3: String(pickByAliases(row, HEADER_ALIASES.mvp3) || '').trim(),
    series: String(pickByAliases(row, HEADER_ALIASES.series) || '').trim(),
    penalties: String(pickByAliases(row, HEADER_ALIASES.penalties) || '').trim()
  };
}

function getTeamOfNick(match, normalizedNick) {
  const teams = ['team1', 'team2', 'team3', 'team4'];
  return teams.find((teamKey) => (match[teamKey] || []).some((name) => normalizeHeader(name) === normalizedNick)) || null;
}

function matchResultForNick(match, nick) {
  const normalizedNick = normalizeHeader(nick);
  const teamKey = getTeamOfNick(match, normalizedNick);
  if (!teamKey) return null;
  if (match.winner === 'tie') return 'draw';
  if (match.winner === teamKey) return 'win';
  return 'loss';
}

function buildLeagueStats(matches) {
  return matches.reduce((acc, match) => {
    acc.gamesCount += 1;
    if (match.winner === 'tie') acc.draws += 1;
    return acc;
  }, { gamesCount: 0, draws: 0 });
}

async function getAvatarMap() {
  const payload = await gasRequest('listAvatars', {}, 60_000);
  const rows = extractRows(payload);
  return rows.reduce((acc, item) => {
    const nick = String(item?.nick || '').trim();
    const url = String(item?.url || '').trim();
    if (nick && url) acc[nick.toLowerCase()] = url;
    return acc;
  }, {});
}

async function getSeasonData(season) {
  const [kidsRows, adultsRows, gameRows] = await Promise.all([
    getSheetRows(season.sources.kidsSheet),
    getSheetRows(season.sources.sundaygamesSheet),
    getSheetRows(season.sources.gamesSheet)
  ]);

  return {
    leaderboardRows: {
      kids: kidsRows,
      sundaygames: adultsRows
    },
    matches: gameRows.map(parseGameRow).filter((m) => m.league === 'kids' || m.league === 'sundaygames')
  };
}

export async function getLeagueSnapshot({ league, leagueId, seasonId } = {}) {
  const cfg = await loadSeasonsConfig();
  const season = getSeasonById(cfg, seasonId);
  const normalizedLeague = normalizeLeague(league || leagueId) || 'kids';
  const cacheKey = `league:${season.id}:${normalizedLeague}`;
  const hit = readCache(cacheKey);
  if (hit) return hit;

  const [avatarMap, seasonData] = await Promise.all([getAvatarMap(), getSeasonData(season)]);
  const leaderboard = parseLeaderboardRows(seasonData.leaderboardRows[normalizedLeague] || [], avatarMap);
  const matches = seasonData.matches.filter((m) => m.league === normalizedLeague);
  const stats = buildLeagueStats(matches);

  return writeCache(cacheKey, {
    seasonId: season.id,
    seasonTitle: season.uiLabel,
    league: normalizedLeague,
    leaderboard,
    top3: leaderboard.slice(0, 3),
    stats: {
      gamesCount: stats.gamesCount || null,
      winsBreakdown: {
        wins: null,
        losses: null,
        ties: stats.draws || null
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
  const seasons = cfg.seasons.filter((s) => s.enabled !== false);
  const out = [];
  for (const season of seasons) {
    const seasonData = await getSeasonData(season);
    out.push({ seasonId: season.id, seasonTitle: season.uiLabel, matches: seasonData.matches });
  }
  return out;
}

function listSeasonInsights(matches, normalizedNick) {
  const teammateCounts = new Map();
  const opponentCounts = new Map();
  const seriesCounts = new Map();
  matches.forEach((match) => {
    const ownTeam = getTeamOfNick(match, normalizedNick);
    if (!ownTeam) return;
    const ownPlayers = (match[ownTeam] || []).filter((name) => normalizeHeader(name) !== normalizedNick);
    const opponents = ['team1', 'team2', 'team3', 'team4']
      .filter((team) => team !== ownTeam)
      .flatMap((team) => match[team] || []);

    ownPlayers.forEach((name) => teammateCounts.set(name, (teammateCounts.get(name) || 0) + 1));
    opponents.forEach((name) => opponentCounts.set(name, (opponentCounts.get(name) || 0) + 1));

    if (match.series) {
      const key = match.series;
      seriesCounts.set(key, (seriesCounts.get(key) || 0) + 1);
    }
  });

  const top3 = (source, keyName) => Array.from(source.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([nick, value]) => ({ nick, [keyName]: value }));

  return {
    topTeammates: top3(teammateCounts, 'gamesTogether'),
    topOpponents: top3(opponentCounts, 'gamesAgainst'),
    favoriteSeries: top3(seriesCounts, 'gamesInSeries')[0] || null
  };
}

export async function getPlayerProfile({ nick, league } = {}) {
  if (!nick) return null;
  const normalizedNick = normalizeHeader(nick);
  const cfg = await loadSeasonsConfig();
  const seasons = cfg.seasons.filter((s) => s.enabled !== false);

  const [avatarMap, seasonGames, currentLeagueSnapshot] = await Promise.all([
    getAvatarMap(),
    Promise.all(seasons.map(async (season) => ({ season, data: await getSeasonData(season) }))),
    getLeagueSnapshot({ seasonId: cfg.currentSeasonId, league: league || 'kids' })
  ]);

  const allTime = { games: 0, wins: 0, losses: 0, draws: 0, mvp: 0, mvp2: 0, mvp3: 0 };
  const seasonStats = [];
  const allMatches = [];

  seasonGames.forEach(({ season, data }) => {
    const stats = { seasonId: season.id, seasonTitle: season.uiLabel, games: 0, wins: 0, losses: 0, draws: 0, mvp: 0, mvp2: 0, mvp3: 0 };

    data.matches.forEach((match) => {
      const result = matchResultForNick(match, normalizedNick);
      if (!result) return;
      allMatches.push(match);
      stats.games += 1;
      if (result === 'win') stats.wins += 1;
      if (result === 'loss') stats.losses += 1;
      if (result === 'draw') stats.draws += 1;
      if (normalizeHeader(match.mvp) === normalizedNick) stats.mvp += 1;
      if (normalizeHeader(match.mvp2) === normalizedNick) stats.mvp2 += 1;
      if (normalizeHeader(match.mvp3) === normalizedNick) stats.mvp3 += 1;
    });

    if (stats.games > 0) {
      allTime.games += stats.games;
      allTime.wins += stats.wins;
      allTime.losses += stats.losses;
      allTime.draws += stats.draws;
      allTime.mvp += stats.mvp;
      allTime.mvp2 += stats.mvp2;
      allTime.mvp3 += stats.mvp3;
      seasonStats.push(stats);
    }
  });

  if (allTime.games === 0) return null;

  const currentPlayer = currentLeagueSnapshot.leaderboard.find((p) => normalizeHeader(p.nick) === normalizedNick) || null;
  return {
    nick,
    avatarUrl: avatarMap[normalizedNick] || '',
    allTime: {
      ...allTime,
      winRate: allTime.games ? Math.round((allTime.wins / allTime.games) * 100) : null
    },
    seasons: seasonStats,
    current: currentPlayer ? {
      rank: currentPlayer.rankLetter,
      points: currentPlayer.points,
      place: currentPlayer.place,
      league: currentLeagueSnapshot.league
    } : null,
    insights: listSeasonInsights(allMatches, normalizedNick)
  };
}

export async function getPlayerSummary({ nick } = {}) {
  const profile = await getPlayerProfile({ nick });
  if (!profile) return null;
  return {
    nick: profile.nick,
    allTime: profile.allTime,
    bySeason: profile.seasons,
    currentSeason: profile.seasons.find((s) => s.seasonId === getCurrentSeasonId(SEASONS_CONFIG || {})) || null
  };
}

export async function getGameDay({ league, leagueId, date } = {}) {
  const snapshot = await getLeagueSnapshot({ league: league || leagueId || 'kids' });
  const activePlayers = snapshot.leaderboard.slice(0, 12).map((p) => ({
    nick: p.nick,
    matchesToday: p.games || 0,
    mvpToday: p.mvp || 0
  }));

  return {
    date: date || new Date().toISOString().slice(0, 10),
    league: snapshot.league,
    activePlayers,
    matches: []
  };
}

export function getSeasons() {
  return SEASONS_CONFIG;
}

export { collectGamesAcrossEnabledSeasons };
