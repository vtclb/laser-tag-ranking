import {
  APP_VERSION,
  MAX_PLAYERS,
  MAX_ROUNDS,
  MAX_TEAM_COUNT,
  MIN_ROUNDS,
  MIN_TEAM_COUNT,
  TEAM_IDS,
} from './config.js';

export function normalizeLeague(value) {
  return String(value || '').toLowerCase() === 'kids' ? 'kids' : 'sundaygames';
}

export function normalizeTeamCount(value) {
  return Math.min(MAX_TEAM_COUNT, Math.max(MIN_TEAM_COUNT, Number(value) || MIN_TEAM_COUNT));
}

export function normalizeRoundCount(value) {
  return Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, Number(value) || MIN_ROUNDS));
}

export function createPlayerKey({ key, id, uid, nick, league } = {}) {
  const existingKey = String(key || '').trim();
  if (existingKey.includes('::')) return existingKey;
  const source = String(id || uid || nick || '').trim();
  if (source.includes('::')) return source;
  if (!source) return '';
  return `${normalizeLeague(league)}::${source}`;
}

export function normalizePlayer(player = {}, league = 'sundaygames') {
  const nick = String(player.nick || player.nickname || player.name || '').trim();
  if (!nick) return null;
  const normalizedLeague = normalizeLeague(player.league || player.sourceLeague || league);
  const points = Number(player.points ?? player.pts ?? player.rating) || 0;
  const skillRatingValue = Number(player.skillRating);
  const key = createPlayerKey({ ...player, nick, league: normalizedLeague });
  return {
    key,
    id: String(player.id || player.uid || key),
    nick,
    league: normalizedLeague,
    rating: points,
    points,
    skillRating: Number.isFinite(skillRatingValue) ? skillRatingValue : null,
    skillGames: Math.max(0, Number(player.skillGames) || 0),
    uncertainty: Number(player.skillUncertainty ?? player.uncertainty) || null,
    provisional: Boolean(player.provisional),
  };
}

export function createEmptyTeams() {
  return Object.fromEntries(TEAM_IDS.map((teamId) => [teamId, []]));
}

export function createInitialState() {
  return {
    version: APP_VERSION,
    updatedAt: new Date().toISOString(),
    stage: 'players',
    league: 'sundaygames',
    players: [],
    playersLoaded: false,
    selectedKeys: [],
    search: '',
    sort: 'rating_desc',
    teamCount: 2,
    balanceMode: 'auto',
    ratingModel: 'skill_v2',
    balanceSeed: 1,
    teams: createEmptyTeams(),
    teamNames: Object.fromEntries(TEAM_IDS.map((teamId, index) => [teamId, `Команда ${index + 1}`])),
    activeTeamA: 'team1',
    activeTeamB: 'team2',
    roundCount: 3,
    rounds: Array(MAX_ROUNDS).fill(null),
    mvp: { mvp1: '', mvp2: '', mvp3: '' },
    save: { status: 'idle', message: '', requestId: '', canForceRetry: false },
    lastSavedGame: null,
  };
}

export function activeTeamIds(state) {
  return TEAM_IDS.slice(0, normalizeTeamCount(state.teamCount));
}

export function selectedPlayers(state) {
  const byKey = new Map((state.players || []).map((player) => [player.key, player]));
  return (state.selectedKeys || []).map((key) => byKey.get(key)).filter(Boolean);
}

export function assignedKeys(state) {
  return new Set(activeTeamIds(state).flatMap((teamId) => state.teams?.[teamId] || []));
}

export function unassignedPlayers(state) {
  const assigned = assignedKeys(state);
  return selectedPlayers(state).filter((player) => !assigned.has(player.key));
}

export function teamPlayers(state, teamId) {
  const byKey = new Map((state.players || []).map((player) => [player.key, player]));
  return (state.teams?.[teamId] || []).map((key) => byKey.get(key)).filter(Boolean);
}

export function teamRating(state, teamId) {
  return teamPlayers(state, teamId).reduce((total, player) => total + playerBalanceRating(player, state.ratingModel), 0);
}

export function playerBalanceRating(player, ratingModel = 'points') {
  if (ratingModel === 'skill_v2') {
    const shadowRating = player?.skillRating;
    return shadowRating !== null && shadowRating !== '' && Number.isFinite(Number(shadowRating))
      ? Number(shadowRating)
      : 1000;
  }
  return Number(player?.points ?? player?.rating) || 0;
}

export function summarizeTeams(state) {
  const ids = activeTeamIds(state);
  const totals = ids.map((teamId) => teamRating(state, teamId));
  const sizes = ids.map((teamId) => teamPlayers(state, teamId).length);
  const spread = totals.length ? Math.max(...totals) - Math.min(...totals) : 0;
  const average = totals.length ? totals.reduce((sum, value) => sum + value, 0) / totals.length : 0;
  return {
    totals,
    sizes,
    spread,
    relativeSpread: average > 0 ? spread / average : 0,
  };
}

export function summarizeRounds(state) {
  const activeRounds = (state.rounds || []).slice(0, normalizeRoundCount(state.roundCount));
  const team1 = activeRounds.filter((choice) => choice === 'team1').length;
  const team2 = activeRounds.filter((choice) => choice === 'team2').length;
  const draws = activeRounds.filter((choice) => choice === 'draw').length;
  const completed = team1 + team2 + draws;
  const winner = completed < activeRounds.length
    ? ''
    : team1 > team2 ? 'team1' : team2 > team1 ? 'team2' : 'draw';
  return { team1, team2, draws, completed, total: activeRounds.length, winner };
}

export function serializeRounds(state) {
  return (state.rounds || [])
    .slice(0, normalizeRoundCount(state.roundCount))
    .map((choice) => choice === 'team1' ? '1' : choice === 'team2' ? '2' : choice === 'draw' ? '0' : '-')
    .join('');
}

function normalizedRoster(value) {
  const values = Array.isArray(value) ? value : String(value || '').replace(/\r?\n/g, ',').split(/[;,]/);
  return [...new Set(values.map((nick) => String(nick || '').trim().toLocaleLowerCase('uk')).filter(Boolean))].sort();
}

function normalizedWinner(value) {
  const winner = String(value || '').trim().toLowerCase();
  if (['team1', '1', 'a'].includes(winner)) return 'team1';
  if (['team2', '2', 'b'].includes(winner)) return 'team2';
  if (['draw', 'tie', '0', 'нічия'].includes(winner)) return 'tie';
  return '';
}

export function regularGameFingerprint(game = {}) {
  return JSON.stringify({
    league: normalizeLeague(game.league ?? game.League),
    team1: normalizedRoster(game.team1 ?? game.Team1),
    team2: normalizedRoster(game.team2 ?? game.Team2),
    winner: normalizedWinner(game.winner ?? game.Winner),
    mvp1: String(game.mvp1 ?? game.mvp ?? game.MVP ?? '').trim().toLocaleLowerCase('uk'),
    mvp2: String(game.mvp2 ?? game.MVP2 ?? '').trim().toLocaleLowerCase('uk'),
    mvp3: String(game.mvp3 ?? game.MVP3 ?? '').trim().toLocaleLowerCase('uk'),
    series: String(game.series ?? game.Series ?? game.rawSeries ?? '').trim(),
  });
}

export function validateTeamFormation(state) {
  const players = selectedPlayers(state);
  const count = normalizeTeamCount(state.teamCount);
  if (players.length < count) return { ok: false, message: 'Недостатньо гравців для обраної кількості команд' };
  if (players.length > MAX_PLAYERS) return { ok: false, message: `Максимум гравців: ${MAX_PLAYERS}` };
  return { ok: true, message: '' };
}

export function validateMatch(state) {
  if (state.activeTeamA === state.activeTeamB) return { ok: false, message: 'Оберіть дві різні команди' };
  const teamA = teamPlayers(state, state.activeTeamA);
  const teamB = teamPlayers(state, state.activeTeamB);
  if (!teamA.length || !teamB.length) return { ok: false, message: 'Обидві команди повинні мати гравців' };
  const summary = summarizeRounds(state);
  if (summary.completed !== summary.total) return { ok: false, message: 'Позначте результат кожного бою' };
  const participantKeys = new Set([...teamA, ...teamB].map((player) => player.key));
  const mvpKeys = Object.values(state.mvp || {}).filter(Boolean);
  if (!state.mvp?.mvp1) return { ok: false, message: 'Оберіть MVP 1' };
  if (new Set(mvpKeys).size !== mvpKeys.length) return { ok: false, message: 'Один гравець не може займати кілька MVP-місць' };
  if (mvpKeys.some((key) => !participantKeys.has(key))) return { ok: false, message: 'MVP має бути учасником активного матчу' };
  return { ok: true, message: '' };
}

export function buildRegularPayload(state, requestId) {
  const validation = validateMatch(state);
  if (!validation.ok) throw new Error(validation.message);
  const teamA = teamPlayers(state, state.activeTeamA);
  const teamB = teamPlayers(state, state.activeTeamB);
  const playerByKey = new Map([...teamA, ...teamB].map((player) => [player.key, player]));
  const summary = summarizeRounds(state);
  const mvpNick = (key) => playerByKey.get(key)?.nick || '';
  return {
    requestId,
    action: 'saveRegularGame',
    league: normalizeLeague(state.league),
    team1: teamA.map((player) => player.nick).join(', '),
    team2: teamB.map((player) => player.nick).join(', '),
    winner: summary.winner === 'draw' ? 'tie' : summary.winner,
    mvp: mvpNick(state.mvp.mvp1),
    mvp2: mvpNick(state.mvp.mvp2),
    mvp3: mvpNick(state.mvp.mvp3),
    series: serializeRounds(state),
    penalties: '',
    balanceVersion: state.ratingModel === 'skill_v2' ? 'balance3-skill-v2-shadow-1' : 'balance3-v1-points',
  };
}

export function sanitizeRestoredState(candidate) {
  const base = createInitialState();
  if (!candidate || typeof candidate !== 'object' || Number(candidate.version) !== APP_VERSION) return null;
  const league = normalizeLeague(candidate.league);
  const players = Array.isArray(candidate.players)
    ? candidate.players.map((player) => normalizePlayer(player, league)).filter(Boolean)
    : [];
  const knownKeys = new Set(players.map((player) => player.key));
  const selectedKeys = Array.isArray(candidate.selectedKeys)
    ? [...new Set(candidate.selectedKeys.filter((key) => knownKeys.has(key)))].slice(0, MAX_PLAYERS)
    : [];
  const selectedSet = new Set(selectedKeys);
  const teamCount = normalizeTeamCount(candidate.teamCount);
  const used = new Set();
  const teams = createEmptyTeams();
  TEAM_IDS.slice(0, teamCount).forEach((teamId) => {
    const keys = Array.isArray(candidate.teams?.[teamId]) ? candidate.teams[teamId] : [];
    teams[teamId] = keys.filter((key) => selectedSet.has(key) && !used.has(key) && used.add(key));
  });
  const activeIds = TEAM_IDS.slice(0, teamCount);
  const activeTeamA = activeIds.includes(candidate.activeTeamA) ? candidate.activeTeamA : activeIds[0];
  const activeTeamB = activeIds.includes(candidate.activeTeamB) && candidate.activeTeamB !== activeTeamA
    ? candidate.activeTeamB
    : activeIds.find((teamId) => teamId !== activeTeamA) || activeIds[1];
  return {
    ...base,
    ...candidate,
    version: APP_VERSION,
    league,
    stage: ['players', 'teams', 'result'].includes(candidate.stage) ? candidate.stage : 'players',
    players,
    playersLoaded: players.length > 0,
    selectedKeys,
    teamCount,
    balanceMode: candidate.balanceMode === 'manual' ? 'manual' : 'auto',
    ratingModel: 'skill_v2',
    teams,
    activeTeamA,
    activeTeamB,
    roundCount: normalizeRoundCount(candidate.roundCount),
    rounds: Array.from({ length: MAX_ROUNDS }, (_, index) => ['team1', 'team2', 'draw'].includes(candidate.rounds?.[index]) ? candidate.rounds[index] : null),
    mvp: {
      mvp1: String(candidate.mvp?.mvp1 || ''),
      mvp2: String(candidate.mvp?.mvp2 || ''),
      mvp3: String(candidate.mvp?.mvp3 || ''),
    },
    save: { status: 'idle', message: '', requestId: '', canForceRetry: false },
    updatedAt: String(candidate.updatedAt || base.updatedAt),
  };
}
