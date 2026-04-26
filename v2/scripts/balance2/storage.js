import {
  state,
  normalizeLeague,
  computeSeriesSummary,
  syncSelectedMap,
  MAX_LOBBY_PLAYERS,
} from './state.js';

const KEY = 'balance2:lobby';
const PLAYERS_KEY = 'balance2:playersCache';
const LAST_GAME_KEY = 'balance2:lastSavedGame';

export function saveLobby() {
  const data = {
    app: state.app,
    playersState: {
      selected: state.playersState.selected,
    },
    teamsState: state.teamsState,
    matchState: state.matchState,
    activeMatch: state.activeMatch,
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
  state.app.query = '';

  state.playersState.selected = Array.isArray(data?.playersState?.selected || data?.selected)
    ? (data.playersState?.selected || data.selected).slice(0, MAX_LOBBY_PLAYERS)
    : [];
  syncSelectedMap();

  state.teamsState.teamCount = Math.min(4, Math.max(2, Number(data?.teamsState?.teamCount || data?.teamCount || data?.teamsCount) || 2));
  const restoredTeams = data?.teamsState?.teams || data?.teams || {};
  state.teamsState.teams = {
    team1: Array.isArray(restoredTeams.team1) ? restoredTeams.team1 : [],
    team2: Array.isArray(restoredTeams.team2) ? restoredTeams.team2 : [],
    team3: Array.isArray(restoredTeams.team3) ? restoredTeams.team3 : [],
    team4: Array.isArray(restoredTeams.team4) ? restoredTeams.team4 : [],
  };

  const names = data?.teamsState?.teamNames || data?.teamNames || {};
  state.teamsState.teamNames = {
    team1: String(names.team1 || 'Команда 1').trim() || 'Команда 1',
    team2: String(names.team2 || 'Команда 2').trim() || 'Команда 2',
    team3: String(names.team3 || 'Команда 3').trim() || 'Команда 3',
    team4: String(names.team4 || 'Команда 4').trim() || 'Команда 4',
  };

  const matchState = data?.matchState || {};
  state.matchState.seriesCount = Math.min(7, Math.max(3, Number(matchState.seriesCount || data?.seriesCount) || 3));
  const restoredSeries = Array.isArray(matchState.series || data?.series) ? (matchState.series || data.series).slice(0, 7) : [];
  state.matchState.series = restoredSeries.map((v) => (['0', '1', '2'].includes(String(v)) ? String(v) : '-'));
  while (state.matchState.series.length < 7) state.matchState.series.push('-');
  state.matchState.seriesRounds = state.matchState.series.map((v) => (v === '-' ? null : Number(v)));

  const oldMatch = matchState.match || data?.match || {};
  state.matchState.match = {
    winner: oldMatch.winner || '',
    series: oldMatch.series || '',
    mvp1: oldMatch.mvp1 || '',
    mvp2: oldMatch.mvp2 || '',
    mvp3: oldMatch.mvp3 || '',
    penalties: oldMatch.penalties && typeof oldMatch.penalties === 'object' ? oldMatch.penalties : {},
  };

  state.activeMatch = {
    mode: (data?.activeMatch?.mode === 'schedule' ? 'schedule' : 'manual'),
    teamA: data?.activeMatch?.teamA || 'team1',
    teamB: data?.activeMatch?.teamB || 'team2',
    schedule: Array.isArray(data?.activeMatch?.schedule) ? data.activeMatch.schedule : [],
    selectedScheduleMatchId: data?.activeMatch?.selectedScheduleMatchId || '',
  };

  state.uiState.penaltiesCollapsed = data?.uiState?.penaltiesCollapsed !== false;

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
