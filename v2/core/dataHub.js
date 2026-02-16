import seasonsConfig from './seasons.config.json' assert { type: 'json' };

const GAS_URL = seasonsConfig.endpoints.gasUrl;
const SPREADSHEET_ID = '19VYkNmFJCArLFDngYLkpkxF0LYqvDz78yF1oqLT7Ukw';
const DEFAULT_CACHE_TTL_MS = 60_000;
const cache = new Map();

const fieldAliases = {
  nick: ['nickname', 'nick', 'player', 'name'],
  points: ['points', 'pts', 'score'],
  rank: ['rank', 'rankletter', 'tier'],
  games: ['games', 'matches', 'played'],
  wins: ['wins', 'victories'],
  mvp: ['mvp', 'mvp1'],
  mvp2: ['mvp2'],
  mvp3: ['mvp3'],
  timestamp: ['timestamp', 'date', 'datetime', 'createdat'],
  league: ['league', 'division'],
  winner: ['winner', 'win', 'winnerteam'],
  series: ['series', 'score', 'result'],
  penalties: ['penalties', 'penalty'],
  delta: ['delta', 'pointsdelta'],
  newPoints: ['newpoints', 'pointsafter']
};

function normalizeLeagueId(leagueId = 'kids') {
  const key = String(leagueId).trim().toLowerCase();
  if (['olds', 'adults', 'adult', 'sundaygames', 'sunday', 'old'].includes(key)) return 'olds';
  return 'kids';
}

function toSheetLeague(leagueId = 'kids') {
  return normalizeLeagueId(leagueId) === 'olds' ? 'sundaygames' : 'kids';
}

function fromSheetLeague(league = '') {
  const key = String(league).trim().toLowerCase();
  return key === 'sundaygames' ? 'olds' : 'kids';
}

function getCurrentSeasonId() {
  return seasonsConfig.currentSeasonId;
}

function getSeason(seasonId) {
  const resolvedId = seasonId || getCurrentSeasonId();
  return seasonsConfig.seasons.find((season) => season.id === resolvedId) || seasonsConfig.seasons[0];
}

function pickField(row, aliases = []) {
  if (!row || typeof row !== 'object') return '';
  const entries = Object.entries(row);
  const normalized = new Map(entries.map(([key, value]) => [String(key).trim().toLowerCase(), value]));
  for (const alias of aliases) {
    const lookup = String(alias).trim().toLowerCase();
    if (normalized.has(lookup)) return normalized.get(lookup);
  }
  return '';
}

function toNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseNickList(raw = '') {
  return String(raw || '')
    .replace(/\r?\n/g, ',')
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateYmd(value) {
  const date = parseDate(value);
  if (!date) return '';
  return date.toISOString().slice(0, 10);
}

function rankLetter(points) {
  if (points >= 1200) return 'S';
  if (points >= 1000) return 'A';
  if (points >= 800) return 'B';
  if (points >= 600) return 'C';
  if (points >= 400) return 'D';
  if (points >= 200) return 'E';
  return 'F';
}

async function fetchWithTimeoutRetry(url, options = {}, { timeoutMs = 10_000, retry = 1 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retry; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) return response.json();
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
    }
  }
  throw lastError;
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
  cache.set(key, { data, ts: Date.now() });
  return data;
}

async function fetchSheetRows(sheetName) {
  const cacheKey = `sheet:${sheetName}`;
  const cached = readCache(cacheKey, 120_000);
  if (cached) return cached;

  const payloads = [
    { action: 'getSheet', sheet: sheetName },
    { action: 'readSheet', sheet: sheetName },
    { mode: 'sheet', sheet: sheetName }
  ];

  for (const payload of payloads) {
    try {
      const result = await fetchWithTimeoutRetry(
        GAS_URL,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        },
        { timeoutMs: 12_000, retry: 1 }
      );

      const rows = Array.isArray(result)
        ? result
        : Array.isArray(result?.rows)
          ? result.rows
          : Array.isArray(result?.data)
            ? result.data
            : [];

      if (rows.length) return writeCache(cacheKey, rows);
    } catch {
      // next strategy
    }
  }

  const rows = await fetchWithTimeoutRetry(
    `https://opensheet.elk.sh/${SPREADSHEET_ID}/${encodeURIComponent(sheetName)}`,
    {},
    { timeoutMs: 12_000, retry: 1 }
  );

  return writeCache(cacheKey, Array.isArray(rows) ? rows : []);
}

function parseMatchRow(row, fallbackLeague = '') {
  const team1 = parseNickList(row.team1 ?? row.Team1 ?? pickField(row, ['team1']));
  const team2 = parseNickList(row.team2 ?? row.Team2 ?? pickField(row, ['team2']));
  const team3 = parseNickList(row.team3 ?? row.Team3 ?? pickField(row, ['team3']));
  const team4 = parseNickList(row.team4 ?? row.Team4 ?? pickField(row, ['team4']));

  const winnerRaw = String(pickField(row, fieldAliases.winner) || '').trim();
  const leagueRaw = String(pickField(row, fieldAliases.league) || fallbackLeague || '').trim().toLowerCase();

  const sideA = [...team1, ...team2];
  const sideB = [...team3, ...team4];

  let winner = 'tie';
  if (winnerRaw && winnerRaw.toLowerCase() !== 'tie') {
    if (['team1', 'team2'].includes(winnerRaw.toLowerCase())) winner = 'teamA';
    else if (['team3', 'team4'].includes(winnerRaw.toLowerCase())) winner = 'teamB';
    else winner = winnerRaw;
  }

  return {
    timestamp: pickField(row, fieldAliases.timestamp),
    date: dateYmd(pickField(row, fieldAliases.timestamp)),
    league: fromSheetLeague(leagueRaw),
    teams: { team1, team2, team3, team4, sideA, sideB },
    winner,
    series: String(pickField(row, fieldAliases.series) || ''),
    mvp1: String(pickField(row, fieldAliases.mvp) || '').trim(),
    mvp2: String(pickField(row, fieldAliases.mvp2) || '').trim(),
    mvp3: String(pickField(row, fieldAliases.mvp3) || '').trim(),
    penalties: String(pickField(row, fieldAliases.penalties) || '').trim(),
    raw: row
  };
}

async function getSeasonMatches(seasonId) {
  const season = getSeason(seasonId);
  const cacheKey = `seasonMatches:${season.id}`;
  const cached = readCache(cacheKey, 120_000);
  if (cached) return cached;

  const rows = await fetchSheetRows(season.sourceSheets.matches);
  const start = parseDate(season.start);
  const end = parseDate(season.end);

  const matches = rows
    .map((row) => parseMatchRow(row))
    .filter((item) => {
      const ts = parseDate(item.timestamp);
      if (!ts) return false;
      if (start && ts < start) return false;
      if (end && ts > end) return false;
      return true;
    });

  return writeCache(cacheKey, matches);
}

async function getAvatarMap() {
  const rows = await fetchSheetRows('avatars');
  return rows.reduce((acc, row) => {
    const nick = String(pickField(row, fieldAliases.nick) || '').trim();
    const avatarUrl = String(pickField(row, ['avatarurl', 'url', 'avatar']) || '').trim();
    if (nick && avatarUrl) acc[nick.toLowerCase()] = avatarUrl;
    return acc;
  }, {});
}

function aggregatePlayersFromMatches(matches, leagueId) {
  const normalizedLeague = normalizeLeagueId(leagueId);
  const players = new Map();

  const matchesByLeague = matches.filter((match) => match.league === normalizedLeague);

  const getPlayer = (nick) => {
    const key = nick.toLowerCase();
    if (!players.has(key)) {
      players.set(key, {
        nick,
        points: 0,
        rankLetter: 'F',
        games: 0,
        wins: 0,
        mvp1: 0,
        mvp2: 0,
        mvp3: 0,
        activeFlag: true
      });
    }
    return players.get(key);
  };

  matchesByLeague.forEach((match) => {
    const inGame = [...match.teams.sideA, ...match.teams.sideB];
    const uniquePlayers = Array.from(new Set(inGame));
    uniquePlayers.forEach((nick) => {
      const player = getPlayer(nick);
      player.games += 1;
      if (match.winner === 'teamA' && match.teams.sideA.includes(nick)) player.wins += 1;
      if (match.winner === 'teamB' && match.teams.sideB.includes(nick)) player.wins += 1;
    });

    if (match.mvp1) getPlayer(match.mvp1).mvp1 += 1;
    if (match.mvp2) getPlayer(match.mvp2).mvp2 += 1;
    if (match.mvp3) getPlayer(match.mvp3).mvp3 += 1;
  });

  const table = Array.from(players.values()).map((player) => {
    const points = player.wins * 20 + player.mvp1 * 12 + player.mvp2 * 7 + player.mvp3 * 3;
    return {
      ...player,
      points,
      rankLetter: rankLetter(points)
    };
  }).sort((a, b) => b.points - a.points);

  const seasonStats = {
    gamesCount: matchesByLeague.length,
    roundsCount: matchesByLeague.length,
    winsA: matchesByLeague.filter((match) => match.winner === 'teamA').length,
    winsB: matchesByLeague.filter((match) => match.winner === 'teamB').length,
    draws: matchesByLeague.filter((match) => match.winner === 'tie').length
  };

  return { table, seasonStats, matchesByLeague };
}

async function getCurrentRankingRows(leagueId) {
  const season = getSeason(getCurrentSeasonId());
  const rankingSheet = season.sourceSheets.rankings?.[normalizeLeagueId(leagueId)] || toSheetLeague(leagueId);
  return fetchSheetRows(rankingSheet);
}

function mapRankingRows(rows) {
  return rows.map((row) => {
    const nick = String(pickField(row, fieldAliases.nick) || '').trim();
    const points = toNumber(pickField(row, fieldAliases.points), 0);
    const games = toNumber(pickField(row, fieldAliases.games), 0);
    const wins = toNumber(pickField(row, fieldAliases.wins), 0);
    const mvp1 = toNumber(pickField(row, fieldAliases.mvp), 0);
    const mvp2 = toNumber(pickField(row, fieldAliases.mvp2), 0);
    const mvp3 = toNumber(pickField(row, fieldAliases.mvp3), 0);
    return {
      nick,
      points,
      rankLetter: String(pickField(row, fieldAliases.rank) || rankLetter(points)),
      games,
      wins,
      mvp1,
      mvp2,
      mvp3,
      activeFlag: true,
      delta: toNumber(pickField(row, fieldAliases.delta), 0)
    };
  }).filter((player) => player.nick).sort((a, b) => b.points - a.points);
}

async function getLogsRows() {
  try {
    return await fetchSheetRows('logs');
  } catch {
    return [];
  }
}

export function getSeasons() {
  return seasonsConfig;
}

export async function getLeagueSnapshot({ seasonId, leagueId } = {}) {
  const season = getSeason(seasonId);
  const normalizedLeague = normalizeLeagueId(leagueId);
  const cacheKey = `leagueSnapshot:${season.id}:${normalizedLeague}`;
  const cached = readCache(cacheKey, 30_000);
  if (cached) return cached;

  const matches = await getSeasonMatches(season.id);
  const avatarMap = await getAvatarMap();
  const { table: aggregatedTable, seasonStats } = aggregatePlayersFromMatches(matches, normalizedLeague);

  let players = aggregatedTable;
  if (season.id === getCurrentSeasonId()) {
    const rankingRows = await getCurrentRankingRows(normalizedLeague);
    const rankingTable = mapRankingRows(rankingRows);
    if (rankingTable.length) {
      const computed = new Map(aggregatedTable.map((item) => [item.nick.toLowerCase(), item]));
      players = rankingTable.map((item) => {
        const metrics = computed.get(item.nick.toLowerCase());
        return {
          ...item,
          games: metrics?.games ?? item.games,
          wins: metrics?.wins ?? item.wins,
          mvp1: metrics?.mvp1 ?? item.mvp1,
          mvp2: metrics?.mvp2 ?? item.mvp2,
          mvp3: metrics?.mvp3 ?? item.mvp3
        };
      });
    }
  }

  players = players.map((player) => ({
    ...player,
    avatarUrl: avatarMap[player.nick.toLowerCase()] || ''
  }));

  return writeCache(cacheKey, {
    seasonId: season.id,
    seasonTitle: season.title,
    leagueId: normalizedLeague,
    top3: players.slice(0, 3),
    top10: players.slice(0, 10),
    players,
    seasonStats
  });
}

export async function getPlayerSummary({ nick } = {}) {
  if (!nick) return null;
  const normalizedNick = String(nick).trim().toLowerCase();
  const avatarMap = await getAvatarMap();
  const logs = await getLogsRows();

  let totalPointsDelta = 0;
  let lastSeenDate = '';
  logs.forEach((row) => {
    const rowNick = String(pickField(row, fieldAliases.nick) || '').trim().toLowerCase();
    if (rowNick !== normalizedNick) return;
    totalPointsDelta += toNumber(pickField(row, fieldAliases.delta), 0);
    const ts = pickField(row, fieldAliases.timestamp);
    const ymd = dateYmd(ts);
    if (ymd && (!lastSeenDate || ymd > lastSeenDate)) lastSeenDate = ymd;
  });

  const bySeason = await Promise.all(
    seasonsConfig.seasons.map(async (season) => {
      const matches = await getSeasonMatches(season.id);
      const all = aggregatePlayersFromMatches(matches, 'kids').table
        .concat(aggregatePlayersFromMatches(matches, 'olds').table);
      return all.find((player) => player.nick.toLowerCase() === normalizedNick) || null;
    })
  );

  const valid = bySeason.filter(Boolean);
  return {
    nick,
    totalGames: valid.reduce((sum, item) => sum + item.games, 0),
    totalWins: valid.reduce((sum, item) => sum + item.wins, 0),
    totalMvp: valid.reduce((sum, item) => sum + item.mvp1 + item.mvp2 + item.mvp3, 0),
    totalPointsDelta,
    lastSeenDate,
    avatarUrl: avatarMap[normalizedNick] || ''
  };
}

export async function getPlayerProfile({ nick } = {}) {
  if (!nick) return null;
  const normalizedNick = String(nick).trim().toLowerCase();
  const avatarMap = await getAvatarMap();

  const teammateCounts = new Map();
  const opponentCounts = new Map();
  const form = [];
  const bySeason = [];

  for (const season of seasonsConfig.seasons) {
    const matches = await getSeasonMatches(season.id);
    const seasonGames = matches.filter((match) => {
      const allPlayers = [...match.teams.sideA, ...match.teams.sideB].map((item) => item.toLowerCase());
      return allPlayers.includes(normalizedNick);
    });

    if (!seasonGames.length) continue;

    let wins = 0;
    let mvp1 = 0;
    let mvp2 = 0;
    let mvp3 = 0;

    seasonGames.forEach((match) => {
      const inA = match.teams.sideA.map((item) => item.toLowerCase()).includes(normalizedNick);
      const side = inA ? match.teams.sideA : match.teams.sideB;
      const opponents = inA ? match.teams.sideB : match.teams.sideA;

      if ((match.winner === 'teamA' && inA) || (match.winner === 'teamB' && !inA)) wins += 1;
      if (match.mvp1.toLowerCase() === normalizedNick) mvp1 += 1;
      if (match.mvp2.toLowerCase() === normalizedNick) mvp2 += 1;
      if (match.mvp3.toLowerCase() === normalizedNick) mvp3 += 1;

      side.forEach((mate) => {
        if (mate.toLowerCase() === normalizedNick) return;
        teammateCounts.set(mate, (teammateCounts.get(mate) || 0) + 1);
      });
      opponents.forEach((opponent) => {
        opponentCounts.set(opponent, (opponentCounts.get(opponent) || 0) + 1);
      });

      const result = match.winner === 'tie'
        ? 'D'
        : ((match.winner === 'teamA' && inA) || (match.winner === 'teamB' && !inA))
          ? 'W'
          : 'L';
      form.push({ timestamp: match.timestamp, result });
    });

    const points = wins * 20 + mvp1 * 12 + mvp2 * 7 + mvp3 * 3;
    bySeason.push({
      seasonId: season.id,
      seasonTitle: season.title,
      games: seasonGames.length,
      wins,
      mvp1,
      mvp2,
      mvp3,
      points
    });
  }

  if (!bySeason.length) return null;

  const maxByCount = (entries) => {
    if (!entries.length) return null;
    return entries.reduce((best, current) => (current[1] > best[1] ? current : best), entries[0]);
  };

  const teammateMost = maxByCount(Array.from(teammateCounts.entries()));
  const opponentMost = maxByCount(Array.from(opponentCounts.entries()));

  form.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const summary = await getPlayerSummary({ nick });

  return {
    nick,
    avatarUrl: avatarMap[normalizedNick] || '',
    allTime: {
      games: summary?.totalGames || 0,
      wins: summary?.totalWins || 0,
      mvp: summary?.totalMvp || 0,
      pointsDelta: summary?.totalPointsDelta || 0
    },
    bySeason,
    achievements: [],
    insights: {
      teammateMost: teammateMost ? { nick: teammateMost[0], count: teammateMost[1] } : null,
      opponentMost: opponentMost ? { nick: opponentMost[0], count: opponentMost[1] } : null,
      winrateWith: null,
      winrateAgainst: null,
      form: form.slice(0, 5).map((item) => item.result)
    }
  };
}

export async function getSeasonOverview({ seasonId } = {}) {
  const season = getSeason(seasonId);
  const [kids, olds] = await Promise.all([
    getLeagueSnapshot({ seasonId: season.id, leagueId: 'kids' }),
    getLeagueSnapshot({ seasonId: season.id, leagueId: 'olds' })
  ]);

  return {
    seasonId: season.id,
    seasonTitle: season.title,
    top3: {
      kids: kids.top3,
      olds: olds.top3
    },
    stats: {
      kids: kids.seasonStats,
      olds: olds.seasonStats
    },
    links: {
      kids: `./league.html?season=${season.id}&league=kids`,
      olds: `./league.html?season=${season.id}&league=olds`
    }
  };
}

export async function getGameDay({ date, leagueId } = {}) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const normalizedLeague = normalizeLeagueId(leagueId);
  const rows = await fetchSheetRows('games');
  const matches = rows
    .map((row) => parseMatchRow(row, 'kids'))
    .filter((match) => match.date === targetDate && match.league === normalizedLeague);

  const perPlayer = new Map();
  const getPlayer = (nick) => {
    if (!perPlayer.has(nick)) {
      perPlayer.set(nick, { nick, winsToday: 0, matchesToday: 0, mvpToday: 0, deltaToday: 0 });
    }
    return perPlayer.get(nick);
  };

  matches.forEach((match) => {
    const players = Array.from(new Set([...match.teams.sideA, ...match.teams.sideB]));
    players.forEach((nick) => {
      const item = getPlayer(nick);
      item.matchesToday += 1;
      if ((match.winner === 'teamA' && match.teams.sideA.includes(nick)) || (match.winner === 'teamB' && match.teams.sideB.includes(nick))) {
        item.winsToday += 1;
      }
    });
    [match.mvp1, match.mvp2, match.mvp3].filter(Boolean).forEach((nick) => {
      getPlayer(nick).mvpToday += 1;
    });
  });

  return {
    date: targetDate,
    leagueId: normalizedLeague,
    activePlayers: Array.from(perPlayer.values()).sort((a, b) => b.matchesToday - a.matchesToday),
    matches: matches.map((match) => ({
      timestamp: match.timestamp,
      teams: match.teams,
      winner: match.winner,
      series: match.series,
      mvp1: match.mvp1,
      mvp2: match.mvp2,
      mvp3: match.mvp3,
      penalties: match.penalties
    }))
  };
}
