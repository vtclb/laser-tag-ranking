import { rankFromPoints } from '../../core/rankRules.js';

export const MAX_SERIES_ROUNDS = 10;
export const MAX_LOBBY_PLAYERS = 30;
export const TEAM_KEYS = Array.from({ length: 12 }, (_, i) => `team${i + 1}`);
export const TEAM_COUNT_OPTIONS = [2, 3, 4, 5, 6];
export const MIN_TEAM_COUNT = 2;
export const MAX_TEAM_COUNT = 12;
export const TOURNAMENT_MAX_TEAM_COUNT = 6;

export const state = {
  app: {
    league: 'kids',
    playerSourceMode: 'kids',
    mode: 'auto',
    eventMode: 'tournament',
    sortMode: 'points_desc',
    query: '',
  },
  playersState: {
    players: [],
    playersLoaded: false,
    selected: [],
    selectedMap: new Set(),
    cache: {},
  },
  teamsState: {
    teamCount: 2,
    teams: Object.fromEntries(TEAM_KEYS.map((key) => [key, []])),
    teamNames: Object.fromEntries(TEAM_KEYS.map((key, idx) => [key, `Команда ${idx + 1}`])),
  },
  matchState: {
    seriesCount: 3,
    seriesRounds: Array(MAX_SERIES_ROUNDS).fill(null),
    series: Array(MAX_SERIES_ROUNDS).fill('-'),
    match: { winner: '', series: '', mvp1: '', mvp2: '', mvp3: '', mvp1Key: '', mvp2Key: '', mvp3Key: '', penalties: {} },
  },
  activeMatch: {
    mode: 'manual',
    teamA: 'team1',
    teamB: 'team2',
    schedule: [],
    selectedScheduleMatchId: '',
  },
  tournamentState: {
    tournamentId: '',
    tournamentName: '',
    gameMode: 'DM',
    teamsSaved: false,
    savedTournamentTeamIds: [],
    tournamentType: 'custom',
    tournamentSchedule: [],
    currentScheduleGameId: '',
    gamesCreated: false,
    currentGameId: '',
    nextGameNumber: 1,
    isSaving: false,
    status: {
      message: '',
      type: 'idle',
    },
    lastAction: '',
    lastRequestStatus: '',
    lastErrorMessage: '',
  },
  schoolState: {
    eventId: '',
    title: 'Шкільний турнір',
    date: '',
    status: 'draft',
    teamMeta: Object.fromEntries(TEAM_KEYS.map((key, idx) => [key, { schoolName: '', schoolNumber: '', teamName: `Команда ${idx + 1}` }])),
    battles: [],
    standings: [],
    changeLog: [],
    lastDraftSavedAt: '',
    lastError: '',
  },
  activeTeamAId: 'team1',
  activeTeamBId: 'team2',
  requireMvp: true,
  uiState: {
    penaltiesCollapsed: true,
  },
  lastSavedGame: null,
  meta: {
    lastPayload: null,
  },
};

export function normalizeTeamCount(value) {
  return Math.min(MAX_TEAM_COUNT, Math.max(MIN_TEAM_COUNT, Number(value) || MIN_TEAM_COUNT));
}



export function getTeamCountOptionsForEventMode(eventMode = state.app.eventMode) {
  const maxCount = eventMode === 'school' ? MAX_TEAM_COUNT : TOURNAMENT_MAX_TEAM_COUNT;
  return Array.from({ length: maxCount - MIN_TEAM_COUNT + 1 }, (_, idx) => MIN_TEAM_COUNT + idx);
}

export function getAvailableTeamKeysForEventMode(eventMode = state.app.eventMode) {
  const count = Math.min(normalizeTeamCount(state.teamsState.teamCount), eventMode === 'school' ? MAX_TEAM_COUNT : TOURNAMENT_MAX_TEAM_COUNT);
  return TEAM_KEYS.slice(0, count);
}

export function getMaxTeamCountForCurrentMode() {
  return state.app.eventMode === 'school' ? MAX_TEAM_COUNT : TOURNAMENT_MAX_TEAM_COUNT;
}

export function getMaxLobbyPlayersForEventMode(eventMode = state.app.eventMode) {
  return eventMode === 'school' ? 50 : MAX_LOBBY_PLAYERS;
}

export function sortByPointsDesc(a, b) {
  const pointsDelta = (Number(b.points ?? b.pts) || 0) - (Number(a.points ?? a.pts) || 0);
  if (pointsDelta !== 0) return pointsDelta;
  return String(a.nick || '').localeCompare(String(b.nick || ''), 'uk');
}

export function rankLetterForPoints(points) {
  return rankFromPoints(points);
}

export function normalizeLeague(league) {
  const key = String(league || '').trim().toLowerCase();
  return key === 'kids' ? 'kids' : 'sundaygames';
}

export function normalizePlayerSourceMode(mode, eventMode = 'tournament') {
  const key = String(mode || '').trim().toLowerCase();
  if (key === 'kids') return 'kids';
  if (key === 'mixed') return eventMode === 'tournament' ? 'mixed' : 'sundaygames';
  return 'sundaygames';
}

export function getPlayerKey(playerOrKey) {
  if (typeof playerOrKey === 'string') return playerOrKey;
  if (!playerOrKey || typeof playerOrKey !== 'object') return '';
  return String(playerOrKey.uid || playerOrKey.id || playerOrKey.nick || playerOrKey.name || '').trim();
}

export function getSelectedPlayers() {
  const map = new Map(state.playersState.players.map((p) => [getPlayerKey(p), p]));
  return state.playersState.selected.map((playerKey) => map.get(playerKey)).filter(Boolean);
}

export function resolvePlayerByKey(playerKey) {
  const key = getPlayerKey(playerKey);
  if (!key) return null;
  return state.playersState.players.find((player) => getPlayerKey(player) === key) || null;
}

export function syncSelectedMap() {
  state.playersState.selectedMap = new Set(state.playersState.selected);
}

export function isSelected(playerOrKey) {
  return state.playersState.selectedMap.has(getPlayerKey(playerOrKey));
}

export function getTeamLabel(teamKey) {
  return state.teamsState.teamNames[teamKey] || teamKey.toUpperCase();
}

export function getParticipants() {
  const keys = getActiveMatchTeams();
  return keys.flatMap((k) => state.teamsState.teams[k]);
}

export function getAvailableTeamKeys() {
  return getAvailableTeamKeysForEventMode(state.app.eventMode);
}

export function ensureTeamsForManualAssignment(rawTeamCount = state.teamsState.teamCount) {
  const teamCount = normalizeTeamCount(rawTeamCount);
  state.teamsState.teamCount = teamCount;
  TEAM_KEYS.forEach((teamKey, idx) => {
    if (!Array.isArray(state.teamsState.teams[teamKey])) state.teamsState.teams[teamKey] = [];
    if (idx >= teamCount) state.teamsState.teams[teamKey] = [];
  });
  return TEAM_KEYS.slice(0, teamCount);
}

export function getAssignedTeamId(playerKey) {
  const key = getPlayerKey(playerKey);
  if (!key) return '';
  return TEAM_KEYS.find((teamKey) => (state.teamsState.teams[teamKey] || []).includes(key)) || '';
}

export function removePlayerFromTeam(playerKey, teamId) {
  const key = getPlayerKey(playerKey);
  if (!key || !TEAM_KEYS.includes(teamId) || !Array.isArray(state.teamsState.teams[teamId])) return false;
  const before = state.teamsState.teams[teamId].length;
  state.teamsState.teams[teamId] = state.teamsState.teams[teamId].filter((id) => id !== key);
  return state.teamsState.teams[teamId].length !== before;
}

export function removePlayerFromAllTeams(playerKey) {
  const key = getPlayerKey(playerKey);
  if (!key) return false;
  let changed = false;
  TEAM_KEYS.forEach((teamKey) => {
    changed = removePlayerFromTeam(key, teamKey) || changed;
  });
  return changed;
}

export function assignPlayerToTeam(playerKey, teamId) {
  const key = getPlayerKey(playerKey);
  if (!key || !TEAM_KEYS.includes(teamId) || !Array.isArray(state.teamsState.teams[teamId])) return false;
  const inLobby = state.playersState.selected.includes(key);
  const exists = !!resolvePlayerByKey(key);
  if (!inLobby && !exists) return false;
  removePlayerFromAllTeams(key);
  if (!state.teamsState.teams[teamId].includes(key)) state.teamsState.teams[teamId].push(key);
  return true;
}

export function getActiveMatchTeams() {
  const available = getAvailableTeamKeys();
  const fallbackA = available[0] || 'team1';
  const fallbackB = available[1] || 'team2';
  const { teamA, teamB } = state.activeMatch;
  const validA = available.includes(teamA) ? teamA : fallbackA;
  let validB = available.includes(teamB) ? teamB : fallbackB;
  if (validB === validA) validB = available.find((key) => key !== validA) || fallbackB;
  return [validA, validB];
}

export function computeSeriesSummary() {
  const { seriesRounds, series, seriesCount } = state.matchState;
  const hasRoundValues = Array.isArray(seriesRounds) && seriesRounds.some((value) => value !== null && value !== undefined);
  const rounds = hasRoundValues ? seriesRounds.slice(0, MAX_SERIES_ROUNDS) : (Array.isArray(series) ? series.slice(0, MAX_SERIES_ROUNDS) : []);
  const count = Math.min(MAX_SERIES_ROUNDS, Math.max(3, Number(seriesCount) || 3));
  const normalized = rounds.map((r) => {
    const value = Number(r);
    if (r === null || Number.isNaN(value)) return null;
    if (value === 0) return 0;
    if (value >= 1 && value <= 4) return value;
    return null;
  });
  while (normalized.length < MAX_SERIES_ROUNDS) normalized.push(null);
  const active = normalized.slice(0, count);
  const wins = {
    team1: active.filter((r) => r === 1).length,
    team2: active.filter((r) => r === 2).length,
  };
  const draws = active.filter((r) => r === 0).length;
  const played = Object.values(wins).reduce((acc, value) => acc + value, 0) + draws;
  const winner = wins.team1 === wins.team2 ? 'tie' : (wins.team1 > wins.team2 ? 'team1' : 'team2');
  const seriesCode = active.filter((r) => r !== null).map((r) => String(r)).join('');

  return { wins, draws, played, winner, series: seriesCode };
}
