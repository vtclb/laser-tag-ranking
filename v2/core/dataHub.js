import { jsonp } from './utils.js';

const DEFAULT_CONFIG_URL = new URL('./seasons.config.json', import.meta.url);
const cache = new Map();
const inFlight = new Map();

const TTL = {
  ratings: 60_000,
  profile: 120_000,
  gameday: 15_000,
  sheet: 60_000,
  avatars: 120_000,
  config: 300_000
};

const ACTION_FALLBACKS = ['getSheetRaw', 'getSheetAll', 'getSheet'];
const RANK_THRESHOLDS = [['S', 1200], ['A', 1000], ['B', 800], ['C', 600], ['D', 400], ['E', 200], ['F', 0]];

function normalizeHeader(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeLeague(league = '') {
  const lg = normalizeHeader(league);
  if (lg === 'kids') return 'kids';
  if (['olds', 'sundaygames', 'sunday', 'adults'].includes(lg)) return 'sundaygames';
  return '';
}

function rankLetterFromPoints(points = 0) {
  for (const [rank, min] of RANK_THRESHOLDS) if ((points || 0) >= min) return rank;
  return 'F';
}

function readCache(key, ttlMs) {
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

function toNumber(value, fallback = null) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? '').replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNickList(raw = '') {
  return String(raw || '').replace(/\r?\n/g, ',').split(/[;,|]/).map((part) => part.trim()).filter(Boolean);
}

function safeErrorMessage(error, fallback = 'Не вдалося завантажити дані') {
  if (!error) return fallback;
  return error.message || String(error) || fallback;
}

async function fetchJson(url, params = {}, timeoutMs = 12_000) {
  const requestUrl = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') requestUrl.searchParams.set(key, String(value));
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(requestUrl.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return jsonp(url, params, timeoutMs);
  } finally {
    clearTimeout(timer);
  }
}

export async function loadSeasonsConfig() {
  const cached = readCache('config', TTL.config);
  if (cached) return cached;
  const cfg = await fetch(DEFAULT_CONFIG_URL.toString()).then((res) => res.json());
  return writeCache('config', cfg);
}

function getSeasonById(config, seasonId) {
  const list = config.seasons.filter((season) => season.enabled !== false);
  return list.find((season) => season.id === seasonId) || list.find((season) => season.id === config.currentSeasonId) || list[0];
}

function getSeasonByDate(config, isoDate = new Date().toISOString().slice(0, 10)) {
  const found = config.seasons.find((season) => {
    if (season.enabled === false) return false;
    if (!season.dateStart || !season.dateEnd) return false;
    return isoDate >= season.dateStart && isoDate <= season.dateEnd;
  });
  return found || getSeasonById(config, config.currentSeasonId);
}

async function gasCall(action, params = {}, timeoutMs = 12_000, ttlMs = TTL.sheet) {
  const config = await loadSeasonsConfig();
  const key = `gas:${action}:${JSON.stringify(params)}`;
  const cached = readCache(key, ttlMs);
  if (cached) return cached;

  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const payload = await fetchJson(config.endpoints.gasUrl, { action, ...params }, timeoutMs);
        return writeCache(key, payload);
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(safeErrorMessage(lastError));
  })();

  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

function normalizeSheetPayload(payload, fallbackSheet = '') {
  if (!payload) return { status: 'ERROR', message: 'Empty response', header: [], rows: [], sheet: fallbackSheet };
  if (Array.isArray(payload?.rows)) return { status: payload.status || 'OK', message: payload.message || '', header: payload.header || [], rows: payload.rows, sheet: payload.sheet || fallbackSheet };
  if (Array.isArray(payload?.data)) return { status: payload.status || 'OK', message: payload.message || '', header: payload.header || [], rows: payload.data, sheet: payload.sheet || fallbackSheet };
  if (Array.isArray(payload) && Array.isArray(payload[0])) return { status: 'OK', message: '', header: payload[0], rows: payload.slice(1), sheet: fallbackSheet };
  return { status: payload.status || 'ERROR', message: payload.message || payload.error || 'Unknown payload format', header: Array.isArray(payload.header) ? payload.header : [], rows: [], sheet: payload.sheet || fallbackSheet };
}

async function readSheet(sheetName) {
  const key = `sheet:${sheetName}`;
  const cached = readCache(key, TTL.sheet);
  if (cached) return cached;
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    let lastError = null;
    for (const action of ACTION_FALLBACKS) {
      try {
        const payload = normalizeSheetPayload(await gasCall(action, { sheet: sheetName }), sheetName);
        const status = normalizeHeader(payload.status);
        const message = normalizeHeader(payload.message);
        if (status === 'error' && (message.includes('sheet not found') || message.includes('not found'))) throw new Error(`Sheet not found: ${sheetName}`);
        if (status === 'ok' || payload.rows.length || payload.header.length) return writeCache(key, payload);
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(lastError?.message || `Не вдалося завантажити sheet: ${sheetName}`);
  })();

  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

function detectCols(header = []) {
  const normalized = header.map(normalizeHeader);
  const idx = (names) => normalized.findIndex((col) => names.includes(col));
  return {
    nick: idx(['nick', 'nickname', 'player']), league: idx(['league', 'division']), points: idx(['points', 'pts', 'score']),
    games: idx(['games', 'matches']), wins: idx(['wins', 'win']), losses: idx(['losses', 'lose', 'lost']), draws: idx(['draws', 'ties']),
    winRate: idx(['winrate', 'win rate', 'wr']), mvp: idx(['mvp']), top2: idx(['top2', 'mvp2']), top3: idx(['top3', 'mvp3']), inactive: idx(['inactive', 'isinactive'])
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

function parseMatches(sheet) {
  const header = (sheet.header || []).map(normalizeHeader);
  const find = (names) => header.findIndex((h) => names.includes(h));
  const i = { timestamp: find(['timestamp', 'date', 'datetime']), league: find(['league', 'division']), team1: find(['team1']), team2: find(['team2']), winner: find(['winner', 'winnerteam']), mvp: find(['mvp', 'mvp1']), mvp2: find(['mvp2', 'top2']), mvp3: find(['mvp3', 'top3']) };
  return (sheet.rows || []).map((row) => ({
    timestamp: row[i.timestamp] || '', date: String(row[i.timestamp] || '').slice(0, 10), league: normalizeLeague(row[i.league] || 'kids') || 'kids',
    team1: parseNickList(row[i.team1]), team2: parseNickList(row[i.team2]), winner: normalizeHeader(row[i.winner]), mvp1: String(row[i.mvp] || '').trim(),
    mvp2: String(row[i.mvp2] || '').trim(), mvp3: String(row[i.mvp3] || '').trim()
  })).filter((match) => match.team1.length || match.team2.length);
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
  return map;
}

function mapToRows(statsMap, avatarsMap = new Map()) {
  return [...statsMap.values()].sort((a, b) => (b.points ?? -999999) - (a.points ?? -999999) || b.wins - a.wins || a.nick.localeCompare(b.nick, 'uk')).map((row, index) => ({
    place: index + 1, ...row, avatarUrl: avatarsMap.get(normalizeHeader(row.nick)) || '', rankLetter: rankLetterFromPoints(row.points || 0)
  }));
}

async function getSeasonBundle(season) {
  const key = `bundle:${season.id}`;
  const cached = readCache(key, TTL.ratings);
  if (cached) return cached;

  const bundle = { seasonSheet: null, kidsSheet: null, sundaySheet: null, gamesSheet: null, matches: [] };
  const tasks = [];
  if (season.sources.seasonSheet) tasks.push(readSheet(season.sources.seasonSheet).then((s) => { bundle.seasonSheet = s; }));
  if (season.sources.kidsSheet) tasks.push(readSheet(season.sources.kidsSheet).then((s) => { bundle.kidsSheet = s; }));
  if (season.sources.sundaygamesSheet) tasks.push(readSheet(season.sources.sundaygamesSheet).then((s) => { bundle.sundaySheet = s; }));
  if (season.sources.gamesSheet) tasks.push(readSheet(season.sources.gamesSheet).then((s) => { bundle.gamesSheet = s; }));
  await Promise.all(tasks);
  bundle.matches = parseMatches(bundle.gamesSheet || bundle.seasonSheet || { header: [], rows: [] });
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
  } catch {
    return new Map();
  }
}

function pointsMapFromRows(rows = []) {
  const map = new Map();
  rows.forEach((row) => { if (row.nick && row.points !== null) map.set(normalizeHeader(row.nick), row.points); });
  return map;
}

export async function getCurrentSeason() {
  const config = await loadSeasonsConfig();
  return getSeasonByDate(config);
}

export async function getLeagueSnapshot(leagueOrOptions = 'kids', seasonIdArg) {
  const config = await loadSeasonsConfig();
  const league = typeof leagueOrOptions === 'object' ? (leagueOrOptions.league || leagueOrOptions.leagueId) : leagueOrOptions;
  const seasonId = typeof leagueOrOptions === 'object' ? leagueOrOptions.seasonId : seasonIdArg;
  const season = getSeasonById(config, seasonId);
  const selectedLeague = normalizeLeague(league) || 'kids';
  const cacheKey = `league:${season.id}:${selectedLeague}`;
  const cached = readCache(cacheKey, TTL.ratings);
  if (cached) return cached;

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
  }, { games: 0, wins: 0, draws: 0, losses: 0, pointsDelta: 0, players: leaderboard.length, mvp: 0 });
  seasonStats.mvp = leaderboard.reduce((best, p) => (p.mvp > (best.mvp || -1) ? p : best), {}).nick || null;

  return writeCache(cacheKey, {
    seasonId: season.id, seasonTitle: season.uiLabel, league: selectedLeague, top3: leaderboard.slice(0, 3), table: leaderboard, leaderboard,
    seasonStats
  });
}

export async function getTopPlayers(seasonId, league = 'kids', limit = 3) {
  const snapshot = await getLeagueSnapshot(league, seasonId);
  return snapshot.table.slice(0, Math.max(1, limit));
}

export async function getHomeSnapshot() {
  const season = await getCurrentSeason();
  const [kids, sundaygames] = await Promise.all([getLeagueSnapshot('kids', season.id), getLeagueSnapshot('sundaygames', season.id)]);
  return { seasonId: season.id, seasonTitle: season.uiLabel, top3: { kids: kids.top3, sundaygames: sundaygames.top3 }, seasonStats: { kids: kids.seasonStats, sundaygames: sundaygames.seasonStats } };
}

export async function getSeasonOverview(seasonIdOrOptions = {}) {
  const seasonId = typeof seasonIdOrOptions === 'object' ? seasonIdOrOptions.seasonId : seasonIdOrOptions;
  const config = await loadSeasonsConfig();
  const season = getSeasonById(config, seasonId);
  const [kids, sundaygames] = await Promise.all([getLeagueSnapshot('kids', season.id), getLeagueSnapshot('sundaygames', season.id)]);
  return {
    seasonId: season.id,
    seasonTitle: season.uiLabel,
    top3: { kids: kids.top3, sundaygames: sundaygames.top3 },
    top10: { kids: kids.table.slice(0, 10), sundaygames: sundaygames.table.slice(0, 10) },
    stats: { games: kids.seasonStats.games + sundaygames.seasonStats.games, players: kids.seasonStats.players + sundaygames.seasonStats.players, mvp: kids.seasonStats.mvp || sundaygames.seasonStats.mvp, pointsDelta: kids.seasonStats.pointsDelta + sundaygames.seasonStats.pointsDelta },
    leagues: { kids: kids.seasonStats, sundaygames: sundaygames.seasonStats }
  };
}

function aggregateRelations(matches, nick) {
  const target = normalizeHeader(nick);
  const teammates = new Map(); const opponents = new Map();
  const touch = (map, name, win = 0, total = 0) => {
    const key = normalizeHeader(name);
    const prev = map.get(key) || { nick: name, total: 0, wins: 0 };
    prev.total += total; prev.wins += win; map.set(key, prev);
  };
  for (const match of matches) {
    const t1 = match.team1.map(normalizeHeader); const t2 = match.team2.map(normalizeHeader);
    const isT1 = t1.includes(target); const isT2 = t2.includes(target);
    if (!isT1 && !isT2) continue;
    const allies = isT1 ? match.team1 : match.team2;
    const enemies = isT1 ? match.team2 : match.team1;
    const isWin = isT1 ? ['team1', '1'].includes(match.winner) : ['team2', '2'].includes(match.winner);
    const isLose = isT1 ? ['team2', '2'].includes(match.winner) : ['team1', '1'].includes(match.winner);
    allies.forEach((name) => { if (normalizeHeader(name) !== target) touch(teammates, name, isWin ? 1 : 0, 1); });
    enemies.forEach((name) => touch(opponents, name, isLose ? 0 : (isWin ? 1 : 0), 1));
  }
  return {
    topTeammates: [...teammates.values()].sort((a, b) => b.total - a.total).slice(0, 3).map((item) => ({ nick: item.nick, gamesTogether: item.total, winRate: Math.round((item.wins / item.total) * 100) })),
    topOpponents: [...opponents.values()].sort((a, b) => b.total - a.total).slice(0, 3).map((item) => ({ nick: item.nick, gamesAgainst: item.total, winRate: Math.round((item.wins / item.total) * 100) }))
  };
}

export async function getPlayerProfile(nickOrOptions = {}, leagueArg = 'kids') {
  const nick = typeof nickOrOptions === 'object' ? nickOrOptions.nick : nickOrOptions;
  const league = typeof nickOrOptions === 'object' ? nickOrOptions.league : leagueArg;
  if (!nick) return null;

  const key = `profile:${normalizeHeader(nick)}:${normalizeLeague(league) || 'kids'}`;
  const cached = readCache(key, TTL.profile);
  if (cached) return cached;

  const config = await loadSeasonsConfig();
  const enabledSeasons = config.seasons.filter((season) => season.enabled !== false);
  const [avatars, bundles] = await Promise.all([getAvatarsMap(), Promise.all(enabledSeasons.map(async (season) => ({ season, bundle: await getSeasonBundle(season) })))]);

  const normalizedNick = normalizeHeader(nick);
  const seasons = []; const total = { games: 0, wins: 0, losses: 0, draws: 0, winRate: null, mvp: 0, top2: 0, top3: 0 };
  const allMatches = [];

  for (const { season, bundle } of bundles) {
    const stat = { seasonId: season.id, seasonTitle: season.uiLabel, games: 0, wins: 0, losses: 0, draws: 0, mvp: 0, top2: 0, top3: 0 };
    for (const match of bundle.matches) {
      const t1 = match.team1.map(normalizeHeader); const t2 = match.team2.map(normalizeHeader);
      const inT1 = t1.includes(normalizedNick); const inT2 = t2.includes(normalizedNick);
      if (!inT1 && !inT2) continue;
      allMatches.push(match); stat.games += 1;
      if ((inT1 && ['team1', '1'].includes(match.winner)) || (inT2 && ['team2', '2'].includes(match.winner))) stat.wins += 1;
      else if (['tie', 'draw'].includes(match.winner)) stat.draws += 1; else stat.losses += 1;
      if (normalizeHeader(match.mvp1) === normalizedNick) stat.mvp += 1;
      if (normalizeHeader(match.mvp2) === normalizedNick) stat.top2 += 1;
      if (normalizeHeader(match.mvp3) === normalizedNick) stat.top3 += 1;
    }
    if (stat.games) {
      seasons.push({ ...stat, winRate: Math.round((stat.wins / stat.games) * 100) });
      total.games += stat.games; total.wins += stat.wins; total.losses += stat.losses; total.draws += stat.draws; total.mvp += stat.mvp; total.top2 += stat.top2; total.top3 += stat.top3;
    }
  }

  if (!total.games) return null;
  total.winRate = Math.round((total.wins / total.games) * 100);
  const currentSeason = await getCurrentSeason();
  const currentSnapshot = await getLeagueSnapshot(normalizeLeague(league) || 'kids', currentSeason.id);
  const current = currentSnapshot.table.find((row) => normalizeHeader(row.nick) === normalizedNick) || null;
  const insights = aggregateRelations(allMatches, nick);

  const badges = [];
  if (total.mvp >= 5) badges.push('MVP x5');
  if (total.winRate >= 60) badges.push('Sharpshooter');
  if (total.games >= 30) badges.push('Ironman');

  return writeCache(key, {
    nick,
    avatarUrl: avatars.get(normalizedNick) || '',
    league: normalizeLeague(league) || 'kids',
    allTime: total,
    seasons,
    currentSeason: seasons.find((s) => s.seasonId === currentSeason.id) || null,
    current: current ? { rank: current.rankLetter, points: current.points, place: current.place, league: currentSnapshot.league } : null,
    insights,
    badges
  });
}

export async function getGameDay(dateOrOptions = {}, leagueArg = 'kids') {
  const date = typeof dateOrOptions === 'object' ? dateOrOptions.date : dateOrOptions;
  const league = typeof dateOrOptions === 'object' ? (dateOrOptions.league || dateOrOptions.leagueId) : leagueArg;
  const day = date || new Date().toISOString().slice(0, 10);
  const selectedLeague = normalizeLeague(league) || 'kids';

  const key = `gameday:${day}:${selectedLeague}`;
  const cached = readCache(key, TTL.gameday);
  if (cached) return cached;

  const season = await getCurrentSeason();
  const bundle = await getSeasonBundle(season);
  const ranking = await getLeagueSnapshot(selectedLeague, season.id);
  const rankByNick = new Map(ranking.table.map((p) => [normalizeHeader(p.nick), p]));

  const matches = bundle.matches.filter((match) => normalizeLeague(match.league) === selectedLeague && String(match.date).startsWith(day)).map((match) => ({
    timestamp: match.timestamp, date: match.date, teams: { sideA: match.team1, sideB: match.team2 }, mvp: match.mvp1 || '', winner: match.winner
  }));

  const attendees = new Map();
  matches.forEach((match) => {
    [...match.teams.sideA, ...match.teams.sideB].forEach((nick) => {
      const keyNick = normalizeHeader(nick);
      if (!attendees.has(keyNick)) attendees.set(keyNick, { nick, matchesToday: 0, mvpToday: 0, rankingPlace: rankByNick.get(keyNick)?.place ?? null, pointsDelta: 0 });
      attendees.get(keyNick).matchesToday += 1;
      if (normalizeHeader(match.mvp) === keyNick) attendees.get(keyNick).mvpToday += 1;
    });
  });

  return writeCache(key, {
    date: day,
    league: selectedLeague,
    mode: { mobile: true, tv: true },
    matches,
    activePlayers: [...attendees.values()].sort((a, b) => b.matchesToday - a.matchesToday || a.nick.localeCompare(b.nick, 'uk'))
  });
}

export async function getSeasons() { return loadSeasonsConfig(); }
export async function ping() { return gasCall('ping', {}, 8_000, 5_000); }

export { normalizeLeague, safeErrorMessage };
