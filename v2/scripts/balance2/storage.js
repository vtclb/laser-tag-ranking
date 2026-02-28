import { state, normalizeLeague } from './state.js';

const KEY = 'balance2:lobby';
const PLAYERS_KEY = 'balance2:playersCache';

export function saveLobby() {
  const data = {
    league: state.league,
    teamsCount: state.teamsCount,
    selected: state.selected,
    teams: state.teams,
    mode: state.mode,
  };
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function peekLobbyRestore() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

export function restoreLobby() {
  const data = peekLobbyRestore();
  if (!data) return false;
  state.league = normalizeLeague(data.league);
  state.teamsCount = Number(data.teamsCount) === 3 ? 3 : 2;
  state.selected = Array.isArray(data.selected) ? data.selected.slice(0, 15) : [];
  state.teams = {
    team1: Array.isArray(data?.teams?.team1) ? data.teams.team1 : [],
    team2: Array.isArray(data?.teams?.team2) ? data.teams.team2 : [],
    team3: Array.isArray(data?.teams?.team3) ? data.teams.team3 : [],
  };
  state.mode = data.mode === 'manual' ? 'manual' : 'auto';
  return true;
}

export function savePlayersCache() {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(state.cache));
}

export function loadPlayersCache() {
  try {
    const data = JSON.parse(localStorage.getItem(PLAYERS_KEY) || '{}');
    if (data && typeof data === 'object') state.cache = data;
  } catch {
    state.cache = {};
  }
}
