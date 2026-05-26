import {
  state,
  normalizeLeague,
  normalizePlayerSourceMode,
  computeSeriesSummary,
  syncSelectedMap,
  getMaxLobbyPlayersForEventMode,
  getMaxTeamCountForCurrentMode,
  TEAM_KEYS,
  MAX_SERIES_ROUNDS,
} from './state.js';

const KEY = 'balance2:lobby';
const PLAYERS_KEY = 'balance2:playersCache';
const LAST_GAME_KEY = 'balance2:lastSavedGame';
export const SCHOOL_DRAFT_KEY = 'balance2_school_draft';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function pickString(value, fallback = '') {
  return value === undefined || value === null ? fallback : String(value);
}

function pickBoolean(value, fallback = false) {
  return value === undefined ? fallback : value === true;
}

function sanitizeTournamentStatus(value, fallback = { message: '', type: 'idle' }) {
  if (!isPlainObject(value)) return { ...fallback };
  return {
    message: pickString(value.message, fallback.message || ''),
    type: pickString(value.type, fallback.type || 'idle') || 'idle',
  };
}

function pickCollection(value, fallback) {
  if (Array.isArray(value)) return value;
  if (isPlainObject(value)) return value;
  if (Array.isArray(fallback) || isPlainObject(fallback)) return fallback;
  return undefined;
}

function sanitizeTournamentState(restoredTournamentState) {
  const fallback = isPlainObject(state.tournamentState) ? { ...state.tournamentState } : {};
  const restored = isPlainObject(restoredTournamentState) ? restoredTournamentState : {};
  const definedRestored = Object.fromEntries(Object.entries(restored).filter(([, value]) => value !== undefined));
  const games = pickCollection(restored.games, fallback.games);
  const teams = pickCollection(restored.teams, fallback.teams);

  const next = {
    ...fallback,
    ...definedRestored,
    tournamentId: pickString(restored.tournamentId, fallback.tournamentId || ''),
    tournamentTitle: pickString(restored.tournamentTitle, fallback.tournamentTitle || restored.tournamentName || fallback.tournamentName || ''),
    tournamentName: pickString(restored.tournamentName ?? restored.tournamentTitle, fallback.tournamentName || ''),
    gameMode: ['DM', 'TR', 'KT'].includes(restored.gameMode) ? restored.gameMode : (fallback.gameMode || 'DM'),
    teamsSaved: pickBoolean(restored.teamsSaved, fallback.teamsSaved === true),
    savedTournamentTeamIds: Array.isArray(restored.savedTournamentTeamIds)
      ? restored.savedTournamentTeamIds.filter((key) => TEAM_KEYS.includes(key))
      : (Array.isArray(fallback.savedTournamentTeamIds) ? fallback.savedTournamentTeamIds : []),
    tournamentType: restored.tournamentType === 'group' ? 'group' : (restored.tournamentType === 'custom' ? 'custom' : (fallback.tournamentType || 'custom')),
    tournamentSchedule: Array.isArray(restored.tournamentSchedule) ? restored.tournamentSchedule : (Array.isArray(fallback.tournamentSchedule) ? fallback.tournamentSchedule : []),
    currentScheduleGameId: pickString(restored.currentScheduleGameId, fallback.currentScheduleGameId || ''),
    gamesCreated: pickBoolean(restored.gamesCreated, fallback.gamesCreated === true),
    currentGameId: pickString(restored.currentGameId, fallback.currentGameId || ''),
    nextGameNumber: Math.max(1, Number(restored.nextGameNumber ?? fallback.nextGameNumber) || 1),
    isSaving: false,
    status: sanitizeTournamentStatus(restored.status, fallback.status),
    lastAction: pickString(restored.lastAction, fallback.lastAction || ''),
    lastRequestStatus: pickString(restored.lastRequestStatus, fallback.lastRequestStatus || ''),
    lastErrorMessage: pickString(restored.lastErrorMessage, fallback.lastErrorMessage || ''),
    createdAt: pickString(restored.createdAt, fallback.createdAt || ''),
    updatedAt: pickString(restored.updatedAt, fallback.updatedAt || ''),
  };
  if (games !== undefined) next.games = games;
  if (teams !== undefined) next.teams = teams;
  return next;
}

export function saveLobby() {
  const data = {
    app: state.app,
    playersState: {
      selected: state.playersState.selected,
    },
    teamsState: state.teamsState,
    matchState: state.matchState,
    activeMatch: state.activeMatch,
    tournamentState: state.tournamentState,
    activeTeamAId: state.activeTeamAId,
    activeTeamBId: state.activeTeamBId,
    uiState: state.uiState,
  };
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function peekLobbyRestore() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

export function restoreLobby() {
  const data = peekLobbyRestore();
  if (!data) return false;

  state.app.league = normalizeLeague(data?.app?.league || data?.league);
  state.app.mode = (data?.app?.mode || data?.mode) === 'manual' ? 'manual' : 'auto';
  state.app.sortMode = ['name_asc', 'name_desc', 'points_desc', 'points_asc'].includes(data?.app?.sortMode || data?.sortMode)
    ? (data?.app?.sortMode || data?.sortMode)
    : 'points_desc';
  const restoredEventMode = data?.app?.eventMode;
  state.app.eventMode = (restoredEventMode === 'school' ? 'school' : 'tournament');
  state.app.playerSourceMode = normalizePlayerSourceMode(data?.app?.playerSourceMode || data?.playerSourceMode || state.app.playerSourceMode, state.app.eventMode);
  state.app.query = '';

  state.playersState.selected = Array.isArray(data?.playersState?.selected || data?.selected)
    ? (data.playersState?.selected || data.selected).slice(0, getMaxLobbyPlayersForEventMode(state.app.eventMode))
    : [];
  syncSelectedMap();

  state.teamsState.teamCount = Math.min(getMaxTeamCountForCurrentMode(), Math.max(2, Number(data?.teamsState?.teamCount || data?.teamCount || data?.teamsCount) || 2));
  const restoredTeams = data?.teamsState?.teams || data?.teams || {};
  state.teamsState.teams = Object.fromEntries(TEAM_KEYS.map((key) => [key, Array.isArray(restoredTeams[key]) ? restoredTeams[key] : []]));

  const names = data?.teamsState?.teamNames || data?.teamNames || {};
  state.teamsState.teamNames = Object.fromEntries(TEAM_KEYS.map((key, idx) => [key, String(names[key] || `Команда ${idx + 1}`).trim() || `Команда ${idx + 1}`]));

  const matchState = data?.matchState || {};
  state.matchState.seriesCount = Math.min(MAX_SERIES_ROUNDS, Math.max(3, Number(matchState.seriesCount || data?.seriesCount) || 3));
  const restoredSeries = Array.isArray(matchState.series || data?.series) ? (matchState.series || data.series).slice(0, MAX_SERIES_ROUNDS) : [];
  state.matchState.series = restoredSeries.map((v) => (['0', '1', '2'].includes(String(v)) ? String(v) : '-'));
  while (state.matchState.series.length < MAX_SERIES_ROUNDS) state.matchState.series.push('-');
  state.matchState.seriesRounds = state.matchState.series.map((v) => (v === '-' ? null : Number(v)));

  const oldMatch = matchState.match || data?.match || {};
  state.matchState.match = {
    winner: oldMatch.winner || '',
    series: oldMatch.series || '',
    mvp1: oldMatch.mvp1 || '',
    mvp2: oldMatch.mvp2 || '',
    mvp3: oldMatch.mvp3 || '',
    mvp1Key: oldMatch.mvp1Key || '',
    mvp2Key: oldMatch.mvp2Key || '',
    mvp3Key: oldMatch.mvp3Key || '',
    penalties: oldMatch.penalties && typeof oldMatch.penalties === 'object' ? oldMatch.penalties : {},
  };

  state.activeMatch = {
    mode: (data?.activeMatch?.mode === 'schedule' ? 'schedule' : 'manual'),
    teamA: data?.activeMatch?.teamA || 'team1',
    teamB: data?.activeMatch?.teamB || 'team2',
    schedule: Array.isArray(data?.activeMatch?.schedule) ? data.activeMatch.schedule : [],
    selectedScheduleMatchId: data?.activeMatch?.selectedScheduleMatchId || '',
  };
  state.tournamentState = sanitizeTournamentState(data?.tournamentState);
  state.activeTeamAId = TEAM_KEYS.includes(data?.activeTeamAId) ? data.activeTeamAId : 'team1';
  state.activeTeamBId = TEAM_KEYS.includes(data?.activeTeamBId) ? data.activeTeamBId : 'team2';

  state.uiState = {
    ...state.uiState,
    ...(isPlainObject(data?.uiState) ? data.uiState : {}),
    penaltiesCollapsed: data?.uiState?.penaltiesCollapsed !== false,
  };

  const summary = computeSeriesSummary();
  state.matchState.match.winner = summary.winner;
  state.matchState.match.series = summary.series;

  state.lastSavedGame = readLastSavedGame();
  return true;
}

export function savePlayersCache() {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(state.playersState.cache));
}

export function loadPlayersCache() {
  try {
    const data = JSON.parse(localStorage.getItem(PLAYERS_KEY) || '{}');
    state.playersState.cache = data && typeof data === 'object' ? data : {};
  } catch {
    state.playersState.cache = {};
  }
}

export function clearPlayersCache(league) {
  const key = normalizeLeague(league);
  let cache = {};
  try {
    const parsed = JSON.parse(localStorage.getItem(PLAYERS_KEY) || '{}');
    if (parsed && typeof parsed === 'object') cache = parsed;
  } catch {
    cache = {};
  }
  delete cache[key];
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(cache));
  if (state.playersState.cache && typeof state.playersState.cache === 'object') delete state.playersState.cache[key];
}

export function saveLastSavedGame(snapshot) {
  localStorage.setItem(LAST_GAME_KEY, JSON.stringify(snapshot || null));
}

export function readLastSavedGame() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LAST_GAME_KEY) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSchoolDraft(draft) { localStorage.setItem(SCHOOL_DRAFT_KEY, JSON.stringify(draft || null)); }
export function loadSchoolDraft() { try { return JSON.parse(localStorage.getItem(SCHOOL_DRAFT_KEY) || 'null'); } catch { return null; } }
export function peekSchoolDraft() { return loadSchoolDraft(); }
export function clearSchoolDraft() { localStorage.removeItem(SCHOOL_DRAFT_KEY); }
export function restoreSchoolDraft() { return loadSchoolDraft(); }
