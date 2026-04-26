import { normalizeLeague, state } from './state.js';
import { loadPlayersCache, savePlayersCache } from './storage.js';

const PROXY_ORIGIN = 'https://laser-proxy.vartaclub.workers.dev';
const TOURNAMENT_PROXY_JSON_ENDPOINT = `${PROXY_ORIGIN}/json`;
const TOURNAMENT_GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxzIEh2-gluSxvtUqCDmpGodhFntF-t59Q9OSBEjTxqdfURS3MlYwm6vcZ-1s4XPd0kHQ/exec';

function toFormUrlEncoded(obj = {}) {
  return Object.entries(obj).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v ?? '')}`).join('&');
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function loadPlayers(league, { force = false, timeoutMs = 15000 } = {}) {
  const key = normalizeLeague(league);
  if (!force) {
    loadPlayersCache();
    if (Array.isArray(state.playersState.cache[key]) && state.playersState.cache[key].length) return state.playersState.cache[key];
  }

  const url = `${PROXY_ORIGIN}/fetchLeagueCsv?league=${key}&cb=${Date.now()}`;
  let res;
  try {
    res = await fetchWithTimeout(url, {}, timeoutMs);
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Не вдалося отримати відповідь від сервера');
    throw error;
  }

  if (!res.ok) throw new Error(`Не вдалося завантажити (${res.status})`);
  const csv = await res.text();
  const rows = csv.split(/\r?\n/).filter(Boolean);
  const headers = rows.shift().split(',').map((h) => h.trim().toLowerCase());
  const idx = (name) => headers.indexOf(name);
  const players = rows.map((line) => {
    const cols = line.split(',');
    const nick = (cols[idx('nick')] || cols[idx('nickname')] || '').trim();
    if (!nick) return null;
    return { nick, pts: Number(cols[idx('pts')] || cols[idx('points')] || 0) || 0, rank: (cols[idx('rank')] || '').trim() };
  }).filter(Boolean);

  state.playersState.cache[key] = players;
  savePlayersCache();
  return players;
}

export function mergeMixedLeaguePlayers(adultsPlayers = [], kidsPlayers = []) {
  const withMeta = (players, sourceLeague, sourceLeagueLabel) => players.map((player) => {
    const nick = String(player.nick || player.nickname || '').trim();
    return {
      ...player,
      sourceLeague,
      sourceLeagueLabel,
      uid: `${sourceLeague}::${nick}`,
    };
  });
  return [
    ...withMeta(adultsPlayers, 'sundaygames', 'Дорослі'),
    ...withMeta(kidsPlayers, 'kids', 'Дитяча'),
  ];
}

export async function loadPlayersForSource(sourceMode, { force = false, timeoutMs = 15000 } = {}) {
  if (sourceMode !== 'mixed') {
    const players = await loadPlayers(sourceMode, { force, timeoutMs });
    return {
      sourceMode,
      players,
      counts: { sundaygames: sourceMode === 'sundaygames' ? players.length : 0, kids: sourceMode === 'kids' ? players.length : 0 },
      errors: { sundaygames: '', kids: '' },
    };
  }

  const [adultsResult, kidsResult] = await Promise.allSettled([
    loadPlayers('sundaygames', { force, timeoutMs }),
    loadPlayers('kids', { force, timeoutMs }),
  ]);
  const adultsPlayers = adultsResult.status === 'fulfilled' ? adultsResult.value : [];
  const kidsPlayers = kidsResult.status === 'fulfilled' ? kidsResult.value : [];
  const errors = {
    sundaygames: adultsResult.status === 'rejected' ? `Не вдалося завантажити дорослу лігу: ${adultsResult.reason?.message || 'невідома помилка'}` : '',
    kids: kidsResult.status === 'rejected' ? `Не вдалося завантажити дитячу лігу: ${kidsResult.reason?.message || 'невідома помилка'}` : '',
  };
  if (!adultsPlayers.length && !kidsPlayers.length && (errors.sundaygames || errors.kids)) {
    throw new Error(errors.sundaygames || errors.kids);
  }

  const merged = mergeMixedLeaguePlayers(adultsPlayers, kidsPlayers);
  return {
    sourceMode: 'mixed',
    players: merged,
    counts: { sundaygames: adultsPlayers.length, kids: kidsPlayers.length },
    errors,
  };
}

export async function saveMatch(payload, timeoutMs = 20000) {
  const body = toFormUrlEncoded({ ...payload, league: normalizeLeague(payload.league) });
  try {
    const res = await fetchWithTimeout(PROXY_ORIGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body,
    }, timeoutMs);
    const data = await res.json();
    return { ok: res.ok && String(data.status || '').toUpperCase() === 'OK', data, message: data.message || data.error || 'Невідома помилка' };
  } catch (e) {
    return { ok: false, message: e?.name === 'AbortError' ? 'Не вдалося отримати відповідь від сервера' : (e?.message || 'Помилка мережі') };
  }
}

function normalizeTournamentResponse(action, res, data) {
  if (!res.ok) return { ok: false, data: data || null, message: data?.message || data?.error || `HTTP ${res.status}` };
  const status = String(data?.status || '').toUpperCase();
  if (status === 'OK') return { ok: true, data, message: '' };
  return { ok: false, data: data || null, message: data?.message || data?.error || 'Помилка GAS: status != OK' };
}

async function postTournament(payload, timeoutMs = 20000) {
  const action = String(payload?.action || 'unknown');
  console.debug(`[balance2:tournament] request ${action} payload`, payload);

  try {
    const proxyRes = await fetchWithTimeout(TOURNAMENT_PROXY_JSON_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      body: JSON.stringify(payload || {}),
    }, timeoutMs);
    let proxyData = null;
    try {
      proxyData = await proxyRes.json();
    } catch {
      throw new Error('Некоректна JSON-відповідь від proxy');
    }
    const normalized = normalizeTournamentResponse(action, proxyRes, proxyData);
    console.debug(`[balance2:tournament] response ${action} result`, normalized);
    return normalized;
  } catch (proxyError) {
    console.debug('[balance2:tournament] proxy failed, trying direct GAS', proxyError);
  }

  try {
    const res = await fetchWithTimeout(TOURNAMENT_GAS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload || {}),
    }, timeoutMs);
    let data = null;
    try {
      data = await res.json();
    } catch {
      const invalid = { ok: false, data: null, message: 'Некоректна JSON-відповідь від GAS' };
      console.debug(`[balance2:tournament] response ${action} result`, invalid);
      return invalid;
    }
    const normalized = normalizeTournamentResponse(action, res, data);
    console.debug(`[balance2:tournament] response ${action} result`, normalized);
    return normalized;
  } catch (e) {
    const networkError = {
      ok: false,
      data: null,
      message: e?.name === 'AbortError' ? 'Timeout запиту до GAS' : (e?.message || 'Fetch failed'),
    };
    console.debug(`[balance2:tournament] response ${action} result`, networkError);
    return networkError;
  }
}

export function createTournament(payload = {}) {
  return postTournament({
    action: 'createTournament',
    mode: 'tournament',
    name: payload.name || '',
    league: normalizeLeague(payload.league),
    dateStart: payload.dateStart || '',
    dateEnd: payload.dateEnd || '',
    status: payload.status || 'ACTIVE',
    notes: payload.notes || '',
  });
}

export function saveTournamentTeams(payload = {}) {
  return postTournament({
    action: 'saveTeams',
    mode: 'tournament',
    tournamentId: payload.tournamentId || '',
    teams: Array.isArray(payload.teams) ? payload.teams : [],
  });
}

export function createTournamentGames(payload = {}) {
  return postTournament({
    action: 'createGames',
    mode: 'tournament',
    tournamentId: payload.tournamentId || '',
    games: Array.isArray(payload.games) ? payload.games : [],
  });
}

export function saveTournamentGame(payload = {}) {
  return postTournament({
    action: 'saveGame',
    mode: 'tournament',
    tournamentId: payload.tournamentId || '',
    gameId: payload.gameId || '',
    gameMode: payload.gameMode || 'DM',
    teamAId: payload.teamAId || '',
    teamBId: payload.teamBId || '',
    result: payload.result || '',
    mvp1: payload.mvp1 || '',
    mvp2: payload.mvp2 || '',
    mvp3: payload.mvp3 || '',
    notes: payload.notes || '',
  });
}

export function getTournamentData(tournamentId) {
  return postTournament({
    action: 'getTournamentData',
    mode: 'tournament',
    tournamentId: tournamentId || '',
  });
}

export function listTournaments({ league, status } = {}) {
  return postTournament({
    action: 'listTournaments',
    mode: 'tournament',
    league: league ? normalizeLeague(league) : '',
    status: status || '',
  });
}
