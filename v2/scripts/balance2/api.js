import { normalizeLeague, state } from './state.js';
import { loadPlayersCache, savePlayersCache } from './storage.js';

const PROXY_ORIGIN = 'https://laser-proxy.vartaclub.workers.dev';

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
