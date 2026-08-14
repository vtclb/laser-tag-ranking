import { GAMES_CSV_URL, PROXY_ORIGIN } from './config.js';
import { normalizeLeague, normalizePlayer } from './domain.js';
import { calculateSkillRatings, normalizeSkillMatch } from './skillRating.js';
import { readPlayerCache, savePlayerCache } from './storage.js';

export function parseCsv(text = '') {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  row.push(value);
  if (row.some((cell) => cell !== '')) rows.push(row);
  return rows;
}

function csvObjects(text = '') {
  const rows = parseCsv(text);
  const headers = (rows.shift() || []).map((header) => String(header).trim());
  return rows.map((columns) => Object.fromEntries(headers.map((header, index) => [header, columns[index] ?? ''])));
}

export async function loadLeagueGames(league) {
  const normalizedLeague = normalizeLeague(league);
  const response = await fetchWithTimeout(`${GAMES_CSV_URL}&cb=${Date.now()}`, { credentials: 'omit' });
  if (!response.ok) throw new Error(`Історія ігор повернула HTTP ${response.status}`);
  return csvObjects(await response.text())
    .filter((row) => normalizeLeague(row.League ?? row.league) === normalizedLeague)
    .map((row) => ({
      ...normalizeSkillMatch(row),
      league: normalizedLeague,
      timestamp: row.Timestamp ?? row.timestamp ?? '',
      series: row.Series ?? row.series ?? '',
    }));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function createRequestId(action = 'save') {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `balance3-${action}-${suffix}`;
}

export async function loadLeaguePlayers(league, { force = false } = {}) {
  const normalizedLeague = normalizeLeague(league);
  if (!force) {
    const cached = readPlayerCache(normalizedLeague);
    if (cached.length) return cached.map((player) => normalizePlayer(player, normalizedLeague)).filter(Boolean);
  }
  const gamesPromise = loadLeagueGames(normalizedLeague).catch(() => []);
  const response = await fetchWithTimeout(`${PROXY_ORIGIN}/fetchLeagueCsv?league=${normalizedLeague}&cb=${Date.now()}`);
  if (!response.ok) throw new Error(`Сервер повернув HTTP ${response.status}`);
  const rows = parseCsv(await response.text());
  const headers = (rows.shift() || []).map((header) => String(header).trim().toLowerCase());
  const indexOf = (...names) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
  const nickIndex = indexOf('nick', 'nickname');
  const pointsIndex = indexOf('points', 'pts');
  const idIndex = indexOf('id', 'playerid', 'player_id');
  let players = rows.map((columns) => normalizePlayer({
    id: idIndex >= 0 ? columns[idIndex] : '',
    nick: columns[nickIndex],
    points: columns[pointsIndex],
    league: normalizedLeague,
  }, normalizedLeague)).filter(Boolean);
  try {
    const games = await gamesPromise;
    if (games.length) {
      const shadow = calculateSkillRatings(games);
      players = players.map((player) => normalizePlayer({
        ...player,
        ...(shadow.ratings[player.nick] || {}),
      }, normalizedLeague));
    }
  } catch {
    // Shadow data is optional; official points remain a complete fallback.
  }
  savePlayerCache(normalizedLeague, players);
  return players;
}

function formEncode(payload) {
  return Object.entries(payload).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value ?? '')}`).join('&');
}

export async function saveRegularGame(payload, { timeoutMs = 20000 } = {}) {
  try {
    const response = await fetchWithTimeout(PROXY_ORIGIN, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: formEncode(payload),
    }, timeoutMs);
    let data = null;
    try {
      data = await response.json();
    } catch {
      return { ok: false, ambiguous: true, data: null, message: 'Сервер повернув некоректну відповідь' };
    }
    const ok = response.ok && String(data?.status || '').toUpperCase() === 'OK';
    return { ok, ambiguous: false, data, message: data?.message || data?.error || (ok ? '' : `HTTP ${response.status}`) };
  } catch (error) {
    return {
      ok: false,
      ambiguous: true,
      data: null,
      message: error?.name === 'AbortError' ? 'Сервер не відповів вчасно. Можна безпечно повторити запит.' : (error?.message || 'Помилка мережі'),
    };
  }
}
