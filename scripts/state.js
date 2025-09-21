import { log } from './logger.js?v=2025-09-19-avatars-2';
import { safeSet, safeGet } from './api.js?v=2025-09-19-avatars-2';

const DEFAULT_LEAGUE = 'sundaygames';
const BALANCE_KEY = 'balancerMode';

function normalizeLeague(league) {
  return String(league || '').toLowerCase() === 'kids' ? 'kids' : DEFAULT_LEAGUE;
}

function normalizeBalanceMode(mode) {
  return mode === 'manual' ? 'manual' : 'auto';
}

function resolveLocalStorage() {
  try {
    if (typeof window !== 'undefined' && window && window.localStorage) {
      return window.localStorage;
    }
  } catch (err) {
    log('[ranking]', err);
  }
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch (err) {
    log('[ranking]', err);
  }
  return null;
}

const localStore = resolveLocalStorage();

function readStoredBalanceMode() {
  const stored = safeGet(localStore, BALANCE_KEY);
  return normalizeBalanceMode(stored);
}

export const state = {
  league: DEFAULT_LEAGUE,
  balanceMode: readStoredBalanceMode(),
  teamsCount: 0,
  lobbyPlayers: [],
  teams: {},
};

export function setLeague(league) {
  state.league = normalizeLeague(league ?? state.league);
  return state.league;
}

export function setBalanceMode(mode) {
  state.balanceMode = normalizeBalanceMode(mode);
  safeSet(localStore, BALANCE_KEY, state.balanceMode);
  return state.balanceMode;
}

export function setTeamsCount(count) {
  const numeric = Number(count);
  state.teamsCount = Number.isInteger(numeric) && numeric > 0 ? numeric : 0;
  return state.teamsCount;
}

export function setLobbyPlayers(players) {
  state.lobbyPlayers.length = 0;
  if (Array.isArray(players)) {
    state.lobbyPlayers.push(...players);
  }
  return state.lobbyPlayers;
}

export function setTeams(teamsMap = {}) {
  Object.keys(state.teams).forEach(key => {
    delete state.teams[key];
  });
  if (teamsMap && typeof teamsMap === 'object') {
    Object.entries(teamsMap).forEach(([key, list]) => {
      state.teams[key] = Array.isArray(list) ? [...list] : [];
    });
  }
  return state.teams;
}

function resolveLeague(value) {
  return normalizeLeague(value ?? state.league);
}

export function getLobbyStorageKey(date, league) {
  const doc = typeof document !== 'undefined' ? document : null;
  const d = date || doc?.getElementById('date')?.value || new Date().toISOString().slice(0, 10);
  const sel = doc?.getElementById('league');
  const l = resolveLeague(league ?? sel?.value);
  return `lobby::${d}::${l}`;
}

export function saveLobbyState(snapshot = {}) {
  const lobbyPlayers = snapshot.lobbyPlayers ?? snapshot.lobby ?? state.lobbyPlayers;
  const teams = snapshot.teams ?? state.teams;
  const teamsCount = snapshot.teamsCount ?? snapshot.manualCount ?? state.teamsCount;
  const league = resolveLeague(snapshot.league);
  const key = getLobbyStorageKey(snapshot.date, league);
  safeSet(localStore, key, JSON.stringify({
    lobby: lobbyPlayers,
    teams,
    manualCount: teamsCount,
  }));
}

export function loadLobbyState(league) {
  const key = getLobbyStorageKey(undefined, league);
  const data = safeGet(localStore, key);
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    return {
      lobbyPlayers: Array.isArray(parsed?.lobby) ? parsed.lobby : [],
      teams: parsed?.teams && typeof parsed.teams === 'object' ? parsed.teams : {},
      teamsCount: Number.isInteger(parsed?.manualCount) ? parsed.manualCount : 0,
    };
  } catch (err) {
    log('[ranking]', err);
    return null;
  }
}
