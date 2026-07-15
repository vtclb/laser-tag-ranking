import { normalizeLeague, state } from './state.js';
import { loadPlayersCache, savePlayersCache } from './storage.js';
import { debugLog } from '../../core/debug.js';

const PROXY_ORIGIN = 'https://laser-proxy.vartaclub.workers.dev';
const TOURNAMENT_PROXY_JSON_ENDPOINT = `${PROXY_ORIGIN}/json`;

function createRequestId(action = 'write') {
  const randomId = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${String(action || 'write').replace(/[^a-z0-9_-]/gi, '').slice(0, 32)}-${randomId}`;
}

function withWriteRequestMeta(payload, action) {
  const source = payload && typeof payload === 'object' ? payload : {};
  if (!source.requestId) source.requestId = createRequestId(action);
  return { ...source, requestId: source.requestId };
}

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
  const writePayload = withWriteRequestMeta(payload, 'saveRegularGame');
  const body = toFormUrlEncoded({ ...writePayload, league: normalizeLeague(writePayload.league) });
  try {
    const res = await fetchWithTimeout(PROXY_ORIGIN, {
      method: 'POST',
      credentials: 'include',
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
  debugLog(`[balance2:tournament] request ${action}`);

  try {
    const proxyRes = await fetchWithTimeout(TOURNAMENT_PROXY_JSON_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
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
    debugLog(`[balance2:tournament] response ${action}`, {
      ok: normalized.ok,
      status: String(proxyData?.status || ''),
      httpStatus: proxyRes.status,
    });
    return normalized;
  } catch (proxyError) {
    const networkError = {
      ok: false,
      data: null,
      message: proxyError?.name === 'AbortError'
        ? 'Timeout запиту до захищеного proxy'
        : (proxyError?.message || 'Захищений proxy недоступний'),
    };
    debugLog(`[balance2:tournament] request ${action} failed`, {
      name: proxyError?.name || 'Error',
      message: networkError.message,
    });
    return networkError;
  }
}

export function createTournament(payload = {}) {
  const writePayload = withWriteRequestMeta(payload, 'createTournament');
  return postTournament({
    action: 'createTournament',
    mode: 'tournament',
    requestId: writePayload.requestId,
    name: writePayload.name || '',
    league: normalizeLeague(writePayload.league),
    dateStart: writePayload.dateStart || '',
    dateEnd: writePayload.dateEnd || '',
    status: writePayload.status || 'ACTIVE',
    notes: writePayload.notes || '',
  });
}

export function saveTournamentTeams(payload = {}) {
  const writePayload = withWriteRequestMeta(payload, 'saveTeams');
  return postTournament({
    action: 'saveTeams',
    mode: 'tournament',
    requestId: writePayload.requestId,
    tournamentId: writePayload.tournamentId || '',
    teams: Array.isArray(writePayload.teams) ? writePayload.teams : [],
  });
}

export function createTournamentGames(payload = {}) {
  const writePayload = withWriteRequestMeta(payload, 'createGames');
  return postTournament({
    action: 'createGames',
    mode: 'tournament',
    requestId: writePayload.requestId,
    tournamentId: writePayload.tournamentId || '',
    games: Array.isArray(writePayload.games) ? writePayload.games : [],
  });
}

export function saveTournamentGame(payload = {}) {
  const writePayload = withWriteRequestMeta(payload, 'saveGame');
  const body = {
    action: 'saveGame',
    mode: 'tournament',
    requestId: writePayload.requestId,
    tournamentId: writePayload.tournamentId || '',
    gameId: writePayload.gameId || '',
    gameMode: writePayload.gameMode || 'DM',
    teamAId: writePayload.teamAId || '',
    teamBId: writePayload.teamBId || '',
    result: writePayload.result || '',
    mvp1: writePayload.mvp1 || '',
    mvp2: writePayload.mvp2 || '',
    mvp3: writePayload.mvp3 || '',
    notes: writePayload.notes || '',
  };
  if (body.mode !== 'tournament') {
    throw new Error('Invalid tournament save mode');
  }
  return postTournament(body);
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
