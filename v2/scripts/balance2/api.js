import { normalizeLeague, state } from './state.js';
import { loadPlayersCache, savePlayersCache } from './storage.js';

const PROXY_ORIGIN = 'https://laser-proxy.vartaclub.workers.dev';

function toFormUrlEncoded(obj = {}) {
  return Object.entries(obj).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v ?? '')}`).join('&');
}

export async function loadPlayers(league) {
  const key = normalizeLeague(league);
  loadPlayersCache();
  if (Array.isArray(state.cache[key]) && state.cache[key].length) return state.cache[key];

  const url = `${PROXY_ORIGIN}/fetchLeagueCsv?league=${key}&cb=${Date.now()}`;
  const res = await fetch(url);
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

  state.cache[key] = players;
  savePlayersCache();
  return players;
}

export async function saveMatch(payload, timeoutMs = 14000) {
  const body = toFormUrlEncoded({ ...payload, league: normalizeLeague(payload.league) });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(PROXY_ORIGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body,
      signal: ctrl.signal,
    });
    const data = await res.json();
    return { ok: res.ok && String(data.status || '').toUpperCase() === 'OK', data, message: data.message || data.error || 'Невідома помилка' };
  } catch (e) {
    return { ok: false, message: e?.name === 'AbortError' ? 'Час очікування вичерпано' : (e?.message || 'Помилка мережі') };
  } finally {
    clearTimeout(timer);
  }
}
