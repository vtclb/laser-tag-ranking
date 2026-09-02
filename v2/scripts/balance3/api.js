import { GAMES_CSV_URL, PROXY_ORIGIN } from './config.js';
import { normalizeLeague, normalizePlayer } from './domain.js';
import { calculateSkillRatings, normalizeSkillMatch, SKILL_RATING_VERSION } from './skillRating.js';
import { readPlayerCache, savePlayerCache } from './storage.js';

const SKILL_BASELINE_END = '2026-08-31';
const SKILL_BASELINE_URL = new URL('../../data/seasons/summer_2026.json', import.meta.url);
let skillBaselinePromise = null;

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

export function gameDateKey(value) {
  const source = String(value || '').trim();
  const iso = source.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = source.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!local) return '';
  return `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}`;
}

export function buildSeasonSkillShadow(liveGames = [], baselineMatches = []) {
  const baseline = calculateSkillRatings(baselineMatches);
  const currentSeasonGames = liveGames.filter((game) => gameDateKey(game?.timestamp ?? game?.date) > SKILL_BASELINE_END);
  const current = calculateSkillRatings(currentSeasonGames, { initialRatings: baseline.ratings });
  const datedGames = currentSeasonGames.filter((game) => gameDateKey(game?.timestamp ?? game?.date));
  return {
    ...current,
    registry: {
      sourceMatches: baseline.metrics.matches + current.metrics.matches,
      lastGameAt: datedGames.length ? String(datedGames[datedGames.length - 1].timestamp || datedGames[datedGames.length - 1].date || '') : SKILL_BASELINE_END,
      version: SKILL_RATING_VERSION,
    },
  };
}

async function loadSkillBaselineMatches(league) {
  if (!skillBaselinePromise) {
    skillBaselinePromise = fetchWithTimeout(SKILL_BASELINE_URL, { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error(`Архів рейтингу повернув HTTP ${response.status}`);
        return response.json();
      });
  }
  const archive = await skillBaselinePromise;
  const matches = archive?.leagues?.[normalizeLeague(league)]?.matches;
  return Array.isArray(matches) ? matches.map(normalizeSkillMatch) : [];
}

async function postJson(payload, timeoutMs = 15000) {
  const response = await fetchWithTimeout(PROXY_ORIGIN, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json;charset=UTF-8' },
    body: JSON.stringify(payload),
  }, timeoutMs);
  const data = await response.json();
  if (!response.ok || String(data?.status || '').toUpperCase() !== 'OK') {
    throw new Error(data?.message || `Shadow registry HTTP ${response.status}`);
  }
  return data;
}

export async function loadSkillRegistry(league) {
  const data = await postJson({ action: 'getSkillRatings', league: normalizeLeague(league) });
  return Array.isArray(data.ratings) ? data.ratings : [];
}

export async function syncSkillRegistry(league, players, registry = {}) {
  const normalizedLeague = normalizeLeague(league);
  const ratings = (Array.isArray(players) ? players : []).map((player) => {
    const hasHistory = player.skillRating !== null && player.skillRating !== '' && Number.isFinite(Number(player.skillRating));
    return {
    playerId: String(player.id || player.key || player.nick),
    nick: player.nick,
    league: normalizedLeague,
    skillRating: hasHistory ? Number(player.skillRating) : 1000,
    rawSkillRating: hasHistory ? Number(player.rawSkillRating ?? player.skillRating) : 1000,
    skillGames: hasHistory ? Number(player.skillGames) || 0 : 0,
    uncertainty: hasHistory ? Number(player.skillUncertainty ?? player.uncertainty) || 0 : 350,
    provisional: hasHistory ? Boolean(player.provisional) : true,
    sourceMatches: Number(registry.sourceMatches) || 0,
    version: registry.version || SKILL_RATING_VERSION,
    lastGameAt: registry.lastGameAt || '',
    };
  });
  if (!ratings.length) return { status: 'OK', updated: 0 };
  return postJson({ action: 'syncSkillRatings', league: normalizedLeague, ratings });
}

function normalizedNick(value) {
  return String(value || '').trim().toLocaleLowerCase('uk');
}

export function mergeSkillRegistry(players = [], registryRows = []) {
  const byId = new Map();
  const byNick = new Map();
  registryRows.forEach((record) => {
    const id = String(record?.playerId || record?.id || '').trim();
    const nick = normalizedNick(record?.nick || record?.nickname);
    if (id) byId.set(id, record);
    if (nick) byNick.set(nick, record);
  });
  return players.map((player) => normalizePlayer({
    ...player,
    ...(byId.get(String(player.id || '')) || byNick.get(normalizedNick(player.nick)) || {}),
  }, player.league));
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
  const gamesPromise = loadLeagueGames(normalizedLeague)
    .then((games) => ({ ok: true, games }))
    .catch(() => ({ ok: false, games: [] }));
  const registryPromise = loadSkillRegistry(normalizedLeague).catch(() => []);
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
    const gamesResult = await gamesPromise;
    const registryRows = await registryPromise;
    const baselineMatches = await loadSkillBaselineMatches(normalizedLeague).catch(() => null);
    if (gamesResult.ok && (gamesResult.games.length || baselineMatches?.length)) {
      const shadow = baselineMatches
        ? buildSeasonSkillShadow(gamesResult.games, baselineMatches)
        : calculateSkillRatings(gamesResult.games);
      players = players.map((player) => normalizePlayer({
        ...player,
        ...(shadow.ratings[player.nick] || {}),
      }, normalizedLeague));
      await syncSkillRegistry(normalizedLeague, players, shadow.registry || {
        sourceMatches: shadow.metrics.matches,
        version: SKILL_RATING_VERSION,
      }).catch(() => null);
    } else if (registryRows.length) {
      players = mergeSkillRegistry(players, registryRows);
    } else if (baselineMatches?.length) {
      const baseline = calculateSkillRatings(baselineMatches);
      players = players.map((player) => normalizePlayer({ ...player, ...(baseline.ratings[player.nick] || {}) }, normalizedLeague));
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
