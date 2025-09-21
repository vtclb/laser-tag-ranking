// scripts/api.js
import { log } from './logger.js?v=2025-09-19-avatars-2';
import {
  AVATAR_PLACEHOLDER,
  AVATAR_WORKER_BASE,
  AVATARS_FEED,
  AVATAR_BY_NICK,
  AVATAR_CACHE_BUST,
  GAS_BASE_URL,
  GAS_JSON_URL,
  ASSETS_VER
} from './config.js';

// ==================== DIAGNOSTICS ====================
const DEBUG_NETWORK = false;

// ==================== SAFE STORAGE ====================
export function safeGet(storage, key) {
  if (!storage) return null;
  try { return storage.getItem(key); } catch (err) { log('[ranking]', err); return null; }
}
export function safeSet(storage, key, value) {
  if (!storage) return;
  try { storage.setItem(key, value); } catch (err) { log('[ranking]', err); }
}
export function safeDel(storage, key) {
  if (!storage) return;
  try { storage.removeItem(key); } catch (err) { log('[ranking]', err); }
}
// сесійне сховище (не падати у Safari Private Mode)
if (!window.__SESS) {
  try { window.__SESS = sessionStorage; } catch { window.__SESS = null; }
}

// ==================== URL HELPERS ====================
export function requireUrl(value, { name = 'URL', allowRelative = false } = {}) {
  const raw = typeof value === 'string' ? value.trim() : String(value || '').trim();
  if (!raw) throw new Error(`${name} is required`);
  try {
    const u = allowRelative
      ? new URL(raw, (typeof window !== 'undefined' && window.location) ? window.location.origin : undefined)
      : new URL(raw);
    if (!/^https?:$/i.test(u.protocol)) throw new Error(`${name} must use http(s)`);
    u.hash = ''; // прибираємо #, щоб не плодити кеш-ключі
    return u;
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}
function normalizeProxyBase(rawUrl, { name } = {}) {
  const u = requireUrl(rawUrl, { name });
  u.search = '';
  let path = u.pathname || '/';
  if (!path.endsWith('/')) path += '/';
  const proxyUrl = u.origin + path;      // з кінцевим '/'
  const proxyOrigin = proxyUrl.slice(0, -1); // без кінцевого '/'
  return { proxyUrl, proxyOrigin };
}

function trimAvatarConfigValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function ensureTrailingSlashValue(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.endsWith('/')) parsed.pathname += '/';
    return parsed.toString();
  } catch {
    return url.endsWith('/') ? url : `${url}/`;
  }
}

function computeWorkerBase(rawBase) {
  const trimmed = trimAvatarConfigValue(rawBase);
  if (!trimmed) return '';
  try {
    const urlObj = requireUrl(trimmed, { name: 'AVATAR_WORKER_BASE' });
    urlObj.search = '';
    if (!urlObj.pathname.endsWith('/')) urlObj.pathname += '/';
    return urlObj.toString();
  } catch {
    return '';
  }
}

function resolveWorkerEndpoint(rawValue, { fallbackBase = '', ensureTrailingSlash = false, name = 'URL' } = {}) {
  const trimmed = trimAvatarConfigValue(rawValue);
  if (trimmed) {
    try {
      const urlObj = requireUrl(trimmed, { name });
      if (ensureTrailingSlash && !urlObj.pathname.endsWith('/')) urlObj.pathname += '/';
      return urlObj.toString();
    } catch {
      if (fallbackBase) {
        try {
          const baseUrl = new URL(fallbackBase);
          const relative = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
          const urlObj = new URL(relative, baseUrl);
          if (ensureTrailingSlash && !urlObj.pathname.endsWith('/')) urlObj.pathname += '/';
          return urlObj.toString();
        } catch {
          // ignore invalid relative URL
        }
      }
    }
  }
  if (!fallbackBase) return '';
  return ensureTrailingSlash ? ensureTrailingSlashValue(fallbackBase) : fallbackBase;
}

function buildCacheBust(...parts) {
  const tokens = [];
  for (const part of parts) {
    if (typeof part === 'number') {
      tokens.push(String(part));
    } else {
      const value = trimAvatarConfigValue(part);
      if (value) tokens.push(value);
    }
  }
  return tokens.join('-');
}

function appendCacheBust(url, bustValue) {
  if (!url) return url;
  const trimmed = typeof bustValue === 'number' && Number.isFinite(bustValue)
    ? String(bustValue)
    : trimAvatarConfigValue(bustValue);
  if (!trimmed) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('t', trimmed);
    return u.toString();
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${encodeURIComponent(trimmed)}`;
  }
}

const AVATAR_WORKER_BASE_URL = computeWorkerBase(AVATAR_WORKER_BASE);
const AVATARS_FEED_URL = resolveWorkerEndpoint(AVATARS_FEED, {
  fallbackBase: AVATAR_WORKER_BASE_URL,
  name: 'AVATARS_FEED'
});
const AVATAR_BY_NICK_URL = resolveWorkerEndpoint(AVATAR_BY_NICK, {
  fallbackBase: AVATAR_WORKER_BASE_URL,
  ensureTrailingSlash: true,
  name: 'AVATAR_BY_NICK'
});
const AVATAR_CACHE_BUST_VALUE = trimAvatarConfigValue(AVATAR_CACHE_BUST);

// ==================== PROXY (Cloudflare Worker) ====================
// Можеш переозначити в index.html ПЕРЕД підключенням api.js:
// <script>window.WEB_APP_URL='https://laser-proxy.vartaclub.workers.dev/';</script>
const PROD_PROXY_URL  = 'https://laser-proxy.vartaclub.workers.dev/';
const LOCAL_PROXY_URL = 'http://localhost:8787/';

const configured = (typeof window !== 'undefined' && window.WEB_APP_URL ? String(window.WEB_APP_URL).trim() : '');
const hostname   = (typeof window !== 'undefined' && window.location ? window.location.hostname : '');
const isLocal    = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)$/i.test(hostname);
const fallback   = configured || (isLocal ? LOCAL_PROXY_URL : PROD_PROXY_URL);

const proxyConf  = normalizeProxyBase(fallback, { name: 'WEB_APP_URL' });
export const WEB_APP_URL  = proxyConf.proxyUrl;    // з '/' в кінці
export const PROXY_URL    = WEB_APP_URL;           // alias
export const PROXY_ORIGIN = proxyConf.proxyOrigin; // без кінцевого '/'
// на всяк випадок — викладемо у window (не критично)
window.WEB_APP_URL  = WEB_APP_URL;
window.PROXY_URL    = PROXY_URL;
window.PROXY_ORIGIN = PROXY_ORIGIN;

// Додатковий прямий бекап на Apps Script налаштовується через GAS_BASE_URL у config.js

// ==================== NET HELPERS ====================
async function parseTextSafely(res) {
  try { return await res.text(); }
  catch (err) { return ''; }
}

export async function parseProxyResponse(response) {
  if (!response) return { ok: false, status: 'ERR_PROXY', message: 'No response', players: null };

  const statusCode = response.status;
  const ctype = (response.headers && response.headers.get) ? (response.headers.get('content-type') || '') : '';
  const isJson = /\bapplication\/json\b/i.test(ctype);
  const text = await parseTextSafely(response);

  if (!response.ok) {
    const message = text.trim() || `HTTP ${statusCode}`;
    return { ok: false, status: 'ERR_PROXY', message, players: null };
  }

  if (!isJson) {
    const snippet = text.trim().slice(0, 2048);
    return { ok: false, status: 'ERR_HTML', message: snippet || 'Unexpected non-JSON response', players: null };
  }

  let data;
  try { data = text ? JSON.parse(text) : null; }
  catch (err) { return { ok: false, status: 'ERR_JSON_PARSE', message: err.message || 'JSON parse error', players: null }; }

  const rawStatus = (data && typeof data.status === 'string') ? data.status : (response.ok ? 'OK' : 'ERR_PROXY');
  const ok = response.ok && rawStatus.toUpperCase() === 'OK';
  const message =
    (data && typeof data.message === 'string') ? data.message :
    (data && typeof data.error   === 'string') ? data.error   :
    ok ? 'OK' : `HTTP ${statusCode}`;

  const players = (data && Array.isArray(data.players)) ? data.players : null;
  return { ...data, ok, status: ok ? 'OK' : rawStatus || 'ERR_PROXY', message, players };
}

// Ручний form-urlencoded (замість URLSearchParams для сумісності зі старими/вбудованими оточеннями)
export function toFormUrlEncoded(obj = {}) {
  return Object.entries(obj)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v ?? ''))
    .join('&');
}

// ==================== CSV FEEDS ====================
export const CSV_URLS = {
  kids: {
    ranking: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1648067737&single=true&output=csv',
    games:   'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=249347260&single=true&output=csv'
  },
  sundaygames: {
    ranking: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1286735969&single=true&output=csv',
    games:   'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=249347260&single=true&output=csv'
  }
};

function rankFromPoints(p) {
  const n = Number(p) || 0;
  if (n < 200) return 'D';
  if (n < 500) return 'C';
  if (n < 800) return 'B';
  if (n < 1200) return 'A';
  return 'S';
}

// Один раз у памʼяті + у sessionStorage
const _fetchCache = {};
export const avatarCache = new Map();

const AVATAR_MAP_CACHE_KEY = 'avatar:map';
const AVATAR_MAP_TTL = 5 * 60 * 1000; // 5 хвилин достатньо для кешу

const ZERO_WIDTH_CHARS_RE = /[\u200B-\u200D\u2060\uFEFF]/g;
const COMBINING_MARKS_RE = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\uFE20-\uFE2F]/g;
const WHITESPACE_RE = /\s+/g;

const HOMOGRAPH_MAP = Object.freeze({
  '\u0131': 'i',
  '\u03b1': 'a',
  '\u03b5': 'e',
  '\u03ba': 'k',
  '\u03bf': 'o',
  '\u03c1': 'p',
  '\u03c5': 'y',
  '\u03c7': 'x',
  '\u0430': 'a',
  '\u0435': 'e',
  '\u043a': 'k',
  '\u043e': 'o',
  '\u0440': 'p',
  '\u0441': 'c',
  '\u0443': 'y',
  '\u0445': 'x',
  '\u0454': 'e',
  '\u0456': 'i',
  '\u0457': 'i'
});

const HOMOGRAPH_PATTERN = (() => {
  const chars = Object.keys(HOMOGRAPH_MAP);
  if (!chars.length) return null;
  const escaped = chars.map(ch => ch.replace(/[\\\]\[\-]/g, '\\$&')).join('');
  return new RegExp(`[${escaped}]`, 'gu');
})();

const runtimeRoot = typeof window !== 'undefined' ? window : globalThis;
const headerTemplate = {};
if (runtimeRoot && runtimeRoot.AVATAR_HEADERS && typeof runtimeRoot.AVATAR_HEADERS === 'object') {
  Object.assign(headerTemplate, runtimeRoot.AVATAR_HEADERS);
}
const originHeader = runtimeRoot && runtimeRoot.location && runtimeRoot.location.origin
  ? String(runtimeRoot.location.origin)
  : '';
if (originHeader && !headerTemplate['x-avatar-origin']) {
  headerTemplate['x-avatar-origin'] = originHeader;
}
if (ASSETS_VER && !headerTemplate['x-avatar-version']) {
  headerTemplate['x-avatar-version'] = ASSETS_VER;
}
if (!headerTemplate['x-avatar-proxy']) headerTemplate['x-avatar-proxy'] = 'laser-tag-ranking';
export const AV_HEADERS = Object.freeze(headerTemplate);

function avatarProxyBase() {
  return AVATAR_BY_NICK_URL || '';
}

export function avatarNickKey(value) {
  if (value == null) return '';
  const trimmed = String(value).trim().toLowerCase();
  if (!trimmed) return '';
  const decomposed = trimmed.normalize('NFKD');
  const withoutMarks = decomposed.replace(COMBINING_MARKS_RE, '');
  const withoutZeroWidth = withoutMarks.replace(ZERO_WIDTH_CHARS_RE, '');
  const collapsed = withoutZeroWidth.replace(WHITESPACE_RE, ' ').trim();
  if (!collapsed) return '';
  const replaced = HOMOGRAPH_PATTERN
    ? collapsed.replace(HOMOGRAPH_PATTERN, ch => HOMOGRAPH_MAP[ch] || '')
    : collapsed;
  return replaced;
}

function resolveUpdatedAt(headers) {
  if (!headers || typeof headers.get !== 'function') return Date.now();
  const rawHeader = headers.get('x-avatar-updated-at') || headers.get('x-updated-at');
  if (rawHeader) {
    const numeric = Number(rawHeader);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    const parsed = Date.parse(rawHeader);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const lastModified = headers.get('last-modified');
  if (lastModified) {
    const parsed = Date.parse(lastModified);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

function sanitizeAvatarMapping(rawMapping) {
  const mapping = Object.create(null);
  if (!rawMapping || typeof rawMapping !== 'object') return mapping;
  for (const [rawKey, rawUrl] of Object.entries(rawMapping)) {
    const key = avatarNickKey(rawKey);
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (key && url) mapping[key] = url;
  }
  return mapping;
}

function normalizeAvatarMapPayload(raw, { defaultSource = 'worker' } = {}) {
  if (!raw || typeof raw !== 'object') return null;

  if (raw.mapping && typeof raw.mapping === 'object') {
    return {
      mapping: sanitizeAvatarMapping(raw.mapping),
      updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now(),
      source: typeof raw.source === 'string' ? raw.source : defaultSource
    };
  }

  if (Array.isArray(raw.entries)) {
    const mapping = Object.create(null);
    for (const entry of raw.entries) {
      if (!entry || entry.length < 2) continue;
      const [nick, url] = entry;
      const key = avatarNickKey(nick);
      const trimmed = typeof url === 'string' ? url.trim() : '';
      if (key && trimmed) mapping[key] = trimmed;
    }
    return {
      mapping,
      updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now(),
      source: typeof raw.source === 'string' ? raw.source : defaultSource
    };
  }

  return null;
}

function emptyAvatarMapResult(source = 'none') {
  return { mapping: {}, updatedAt: Date.now(), source };
}

function rememberAvatarMap(result, timestamp = Date.now()) {
  const payload = {
    mapping: sanitizeAvatarMapping(result?.mapping),
    updatedAt: Number.isFinite(result?.updatedAt) ? result.updatedAt : Date.now(),
    source: typeof result?.source === 'string' ? result.source : 'worker'
  };
  const info = { data: payload, time: timestamp };
  _fetchCache[AVATAR_MAP_CACHE_KEY] = info;
  safeSet(window.__SESS, AVATAR_MAP_CACHE_KEY, JSON.stringify(info));
  return payload;
}

function restoreAvatarRecordFromStorage(rawValue) {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && typeof parsed === 'object') {
      const url = typeof parsed.url === 'string' ? parsed.url : null;
      const updatedAt = Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : Date.now();
      return { url, updatedAt };
    }
  } catch {
    return null;
  }
  return null;
}

function storeAvatarRecord(key, record, { legacyKey } = {}) {
  if (!key || !record) return;
  const payload = JSON.stringify(record);
  avatarCache.set(key, record);
  safeSet(window.__SESS, `avatar:${key}`, payload);
  if (legacyKey && legacyKey !== key) {
    safeSet(window.__SESS, `avatar:${legacyKey}`, payload);
  }
}

function readAvatarRecord(key, legacyKey) {
  if (!key) return null;
  let record = avatarCache.get(key);
  if (record) return record;
  const direct = restoreAvatarRecordFromStorage(safeGet(window.__SESS, `avatar:${key}`));
  if (direct) {
    avatarCache.set(key, direct);
    return direct;
  }
  if (legacyKey && legacyKey !== key) {
    const legacy = restoreAvatarRecordFromStorage(safeGet(window.__SESS, `avatar:${legacyKey}`));
    if (legacy) {
      storeAvatarRecord(key, legacy, { legacyKey });
      return legacy;
    }
  }
  return null;
}

export function clearFetchCache(key) {
  delete _fetchCache[key];
  safeDel(window.__SESS, key);
  if (key.startsWith('avatar:')) {
    const raw = key.slice(7);
    if (raw === 'map') {
      avatarCache.clear();
    } else {
      avatarCache.delete(raw);
      const canonical = avatarNickKey(raw);
      if (canonical && canonical !== raw) avatarCache.delete(canonical);
    }
  }
}

export async function fetchOnce(url, ttlMs = 0, fetchFn) {
  const now = Date.now();
  const cached = _fetchCache[url];
  if (cached && now - cached.time < ttlMs) return cached.data;

  const raw = safeGet(window.__SESS, url);
  if (raw) {
    try {
      const obj = JSON.parse(raw);
      if (now - obj.time < ttlMs) {
        _fetchCache[url] = obj;
        return obj.data;
      }
    } catch (e) { /* ignore */ }
  }

  const data = await (fetchFn ? fetchFn() : fetch(url).then(r => r.text()));
  const info = { data, time: now };
  _fetchCache[url] = info;
  safeSet(window.__SESS, url, JSON.stringify(info));
  return data;
}

// ==================== LEAGUES ====================
export function normalizeLeague(v) {
  const x = String(v || '').toLowerCase();
  if (x === 'sundaygames' || x === 'olds' || x === 'adult' || x === 'adults') return 'sundaygames';
  if (x === 'kid' || x === 'junior') return 'kids';
  if (x === 'kids') return 'kids';
  return 'sundaygames';
}
export function getLeagueFeedUrl(league) {
  const key = normalizeLeague(league);
  const url = CSV_URLS[key]?.ranking;
  if (!url) throw new Error('Unknown league: ' + league);
  return url;
}
export function getGamesFeedUrl(league) {
  const key = normalizeLeague(league);
  const url = CSV_URLS[key]?.games;
  if (!url) throw new Error('Unknown league: ' + league);
  return url;
}

// ==================== CSV PARSER ====================
export async function fetchCsv(url, ttlMs = 0) {
  const text = await fetchOnce(url, ttlMs);
  if (typeof text !== 'string') throw new Error('API: feed failed');
  if (typeof Papa !== 'undefined') {
    return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  }
  const lines = text.trim().split('\n').filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const obj = {};
    header.forEach((h, i) => { obj[h] = (cols[i] ?? '').trim(); });
    return obj;
  });
}

// ==================== PLAYERS ====================
export async function loadPlayers(league) {
  const rows = await fetchCsv(getLeagueFeedUrl(league));
  return rows.map(r => {
    const nick = String(r.Nickname || '').trim();
    if (!nick) return null;
    const pts = Number(r.Points || 0);
    const pl  = { nick, pts, rank: rankFromPoints(pts) };
    const ab  = r.abonement_type ? String(r.abonement_type).trim() : '';
    if (ab) pl.abonement = ab;
    return pl;
  }).filter(Boolean);
}
export async function fetchPlayerData(league) { return loadPlayers(league); }

export async function fetchPlayerGames(nick, league) {
  const target = String(nick || '').trim().toLowerCase();
  if (!target) return [];

  const normalizedLeague = normalizeLeague(league);
  const rows = await fetchCsv(getGamesFeedUrl(normalizedLeague));

  const teamFields = ['Team1', 'Team 1', 'team1', 'team 1', 'Team2', 'Team 2', 'team2', 'team 2'];
  const mvpFields = ['MVP', 'Mvp', 'mvp', 'MVP2', 'mvp2', 'MVP 2', 'mvp 2', 'MVP3', 'mvp3', 'MVP 3', 'mvp 3'];
  const fieldsToCheck = [...teamFields, ...mvpFields];

  const containsNick = (value) => {
    if (!value) return false;
    return String(value)
      .split(/[;,]/)
      .map(part => part.trim().toLowerCase())
      .filter(Boolean)
      .some(name => name === target);
  };

  return rows.filter(row => {
    const rowLeague = row.League ? normalizeLeague(row.League) : '';
    if (rowLeague && rowLeague !== normalizedLeague) return false;
    return fieldsToCheck.some(field => containsNick(row[field]));
  });
}

// ==================== SAVE GAME (FORM-URLENCODED) ====================
export async function saveResult(data) {
  // GAS doPost(e) чекає form-urlencoded
  const payload = { ...(data || {}) };
  if (payload.league) payload.league = normalizeLeague(payload.league);
  const body = toFormUrlEncoded(payload);
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };

  console.log(`[saveResult] v=${ASSETS_VER}`);
  const attempt = async (targetUrl) => {
    try {
      const res = await fetch(targetUrl, { method: 'POST', headers, body });
      const parsed = await parseProxyResponse(res);
      if (DEBUG_NETWORK) log('[ranking]', 'saveResult', targetUrl, parsed);
      return parsed;
    } catch (err) {
      if (DEBUG_NETWORK) log('[ranking]', 'saveResult error', err);
      return { ok: false, status: 'ERR_NETWORK', message: err?.message || 'Network error', players: null };
    }
  };

  // 1) через воркер
  let result = await attempt(PROXY_ORIGIN); // (!) кореневий URL воркера, БЕЗ /json

  // 2) опційний прямий fallback на GAS
  const needRetry = !result.ok && ['ERR', 'ERR_PROXY', 'ERR_NETWORK', 'ERR_JSON_PARSE', 'ERR_HTML'].includes(result.status);
  if (needRetry && GAS_BASE_URL) {
    result = await attempt(GAS_BASE_URL);
  }
  return result;
}

// ==================== DETAILED STATS (JSON) ====================
export async function saveDetailedStats(matchId, statsArray) {
  const payload = { action: 'importStats', matchId, stats: statsArray };
  const res = await fetch(PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.text();
}

// ==================== AVATARS ====================
export async function fetchAvatarsMap({ force = false } = {}) {
  const now = Date.now();
  if (force) {
    delete _fetchCache[AVATAR_MAP_CACHE_KEY];
    safeDel(window.__SESS, AVATAR_MAP_CACHE_KEY);
  } else {
    const cached = _fetchCache[AVATAR_MAP_CACHE_KEY];
    if (cached && now - cached.time < AVATAR_MAP_TTL) {
      const normalised = normalizeAvatarMapPayload(cached.data, { defaultSource: 'cache' });
      if (normalised) return normalised;
    }

    const raw = safeGet(window.__SESS, AVATAR_MAP_CACHE_KEY);
    if (raw) {
      try {
        const stored = JSON.parse(raw);
        if (stored && typeof stored === 'object' && now - stored.time < AVATAR_MAP_TTL) {
          _fetchCache[AVATAR_MAP_CACHE_KEY] = stored;
          const normalised = normalizeAvatarMapPayload(stored.data, { defaultSource: 'cache' });
          if (normalised) return normalised;
        }
      } catch {
        safeDel(window.__SESS, AVATAR_MAP_CACHE_KEY);
      }
    }
  }

  const base = AVATARS_FEED_URL;
  if (!base) {
    return rememberAvatarMap(emptyAvatarMapResult('unconfigured'), now);
  }

  const bust = buildCacheBust(AVATAR_CACHE_BUST_VALUE, force ? now : '');
  const targetUrl = appendCacheBust(base, bust);

  let response;
  try {
    response = await fetch(targetUrl, {
      method: 'GET',
      headers: { ...AV_HEADERS, 'Cache-Control': 'no-cache' }
    });
  } catch (err) {
    if (DEBUG_NETWORK) log('[ranking]', 'fetchAvatarsMap error', err);
    return rememberAvatarMap(emptyAvatarMapResult('error'), now);
  }

  if (!response || !response.ok) {
    if (DEBUG_NETWORK) log('[ranking]', 'fetchAvatarsMap status', response?.status);
    return rememberAvatarMap(emptyAvatarMapResult('error'), now);
  }

  let data = null;
  try {
    data = await response.json();
  } catch (err) {
    if (DEBUG_NETWORK) log('[ranking]', 'fetchAvatarsMap parse', err);
    data = null;
  }

  const normalised = normalizeAvatarMapPayload(data) || emptyAvatarMapResult('worker');
  if (!normalised.updatedAt || !Number.isFinite(normalised.updatedAt)) {
    normalised.updatedAt = resolveUpdatedAt(response.headers);
  }
  if (!normalised.source) normalised.source = typeof data?.source === 'string' ? data.source : 'worker';

  return rememberAvatarMap(normalised, now);
}

export async function fetchAvatarForNick(nick, { force = false } = {}) {
  const originalNick = typeof nick === 'string' ? nick.trim() : '';
  const key = avatarNickKey(originalNick);
  if (!key) {
    return { url: null, updatedAt: Date.now() };
  }

  if (force) {
    avatarCache.delete(key);
    if (originalNick && originalNick !== key) {
      avatarCache.delete(originalNick);
    }
  } else {
    const cached = readAvatarRecord(key, originalNick);
    if (cached) return cached;
  }

  const base = avatarProxyBase() || '';
  if (!base) {
    const record = { url: null, updatedAt: Date.now() };
    storeAvatarRecord(key, record, { legacyKey: originalNick });
    return record;
  }

  const bust = buildCacheBust(AVATAR_CACHE_BUST_VALUE, Date.now());
  const target = appendCacheBust(`${base}${encodeURIComponent(originalNick)}`, bust);

  let response;
  try {
    response = await fetch(target, {
      method: 'GET',
      headers: { ...AV_HEADERS, 'Cache-Control': 'no-cache' }
    });
  } catch (err) {
    if (DEBUG_NETWORK) log('[ranking]', 'fetchAvatarForNick error', err);
    const record = { url: null, updatedAt: Date.now() };
    storeAvatarRecord(key, record, { legacyKey: originalNick });
    return record;
  }

  let data = null;
  try {
    data = await response.json();
  } catch (err) {
    if (DEBUG_NETWORK) log('[ranking]', 'fetchAvatarForNick parse', err);
    data = null;
  }

  const rawUrl = data && typeof data.url === 'string' ? data.url.trim() : '';
  const updatedAtCandidate = Number.isFinite(data?.updatedAt) ? data.updatedAt : resolveUpdatedAt(response.headers);
  const record = {
    url: rawUrl || null,
    updatedAt: Number.isFinite(updatedAtCandidate) ? updatedAtCandidate : Date.now()
  };

  storeAvatarRecord(key, record, { legacyKey: originalNick });

  const cachedMap = _fetchCache[AVATAR_MAP_CACHE_KEY];
  const normalisedMap = cachedMap ? normalizeAvatarMapPayload(cachedMap.data, { defaultSource: 'cache' }) : null;
  if (normalisedMap && record.url) {
    normalisedMap.mapping[key] = record.url;
    rememberAvatarMap(normalisedMap, Date.now());
  }

  return record;
}

/**
 * @deprecated Use fetchAvatarForNick() замість цього
 */
export async function getAvatarUrl(nick, options) {
  return fetchAvatarForNick(nick, options);
}

export async function uploadAvatar(nick, file) {
  const originalNick = typeof nick === 'string' ? nick.trim() : '';
  if (!originalNick) throw new Error('INVALID_NICK');
  if (!file) throw new Error('INVALID_FILE');

  const mime = file.type || 'image/jpeg';
  const data = await toBase64NoPrefix(file);
  const resp = await gasPost('', { action: 'uploadAvatar', nick: originalNick, mime, data });

  if (!resp || typeof resp !== 'object' || resp.status !== 'OK') {
    const message = resp?.message || resp?.status || 'ERR_UPLOAD';
    throw new Error(message);
  }

  return resp;
}

export function avatarSrcFromRecord(rec) {
  const url = rec && rec.url ? rec.url : AVATAR_PLACEHOLDER;
  const bust = Number.isFinite(rec?.updatedAt) ? rec.updatedAt : Date.now();
  return url + (url.includes('?') ? '&' : '?') + 't=' + bust;
}

export function toBase64NoPrefix(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      const i = s.indexOf(',');
      if (i < 0) return reject(new Error('Invalid file data'));
      resolve(s.slice(i + 1));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// ==================== JSON API (general) ====================
export async function gasPost(path = '', json = {}) {
  const payload = (json && typeof json === 'object') ? json : {};
  const baseUrl = GAS_JSON_URL || GAS_BASE_URL || '';
  if (!baseUrl) {
    return { status: 'ERR', message: 'GAS fallback URL not configured' };
  }

  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = typeof path === 'string' ? path.trim() : String(path || '');
  const targetUrl = cleanPath
    ? `${normalizedBase}${(cleanPath.startsWith('/') || cleanPath.startsWith('?')) ? '' : '/'}${cleanPath}`
    : baseUrl;

  let response;
  try {
    response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    const message = err?.message || 'Network error';
    return { status: 'ERR', message };
  }

  const contentType = response.headers && response.headers.get
    ? (response.headers.get('content-type') || '')
    : '';
  const text = await parseTextSafely(response);
  const shouldParseJson = !contentType
    || /\bjson\b/i.test(contentType)
    || /\btext\/plain\b/i.test(contentType);

  if (!shouldParseJson) {
    const message = text.trim() || response.statusText || `HTTP ${response.status}`;
    return { status: 'ERR', message, code: response.status, body: text };
  }

  try {
    const trimmed = text.trim();
    if (!trimmed) {
      return { status: 'ERR', message: 'Empty response', body: text };
    }
    const data = JSON.parse(trimmed);
    if (data && typeof data === 'object') return data;
    return { status: 'ERR', message: 'Invalid JSON payload', body: text };
  } catch (err) {
    log('[ranking]', err);
    const message = err?.message ? `JSON parse error: ${err.message}` : 'JSON parse error';
    return { status: 'ERR', message, body: text };
  }
}

// ==================== OTHER JSON ACTIONS ====================
export async function adminCreatePlayer(data) {
  const payload = { action: 'adminCreatePlayer', ...(data || {}) };
  if (payload.league) payload.league = normalizeLeague(payload.league);
  const resp = await gasPost('', payload);
  if (resp.status !== 'OK' && resp.status !== 'DUPLICATE') throw new Error(resp.status || 'ERR_STATUS');
  return resp.status || '';
}
export async function issueAccessKey(data) {
  const payload = { action: 'issueAccessKey', ...(data || {}) };
  if (payload.league) payload.league = normalizeLeague(payload.league);
  const resp = await gasPost('', payload);
  if (resp.status !== 'OK') throw new Error(resp.status || 'ERR_STATUS');
  return resp.key || resp.accessKey || null;
}
export async function getProfile(data) {
  const payload = { action: 'getProfile', ...(data || {}) };
  if (payload.league) payload.league = normalizeLeague(payload.league);
  const resp = await gasPost('', payload);
  if (resp.status !== 'OK' && resp.status !== 'DENIED') throw new Error(resp.status || 'ERR_STATUS');
  return resp;
}
export async function getPdfLinks(params) {
  const payload = { action: 'getPdfLinks', ...(params || {}) };
  if (payload.league) payload.league = normalizeLeague(payload.league);
  const resp = await gasPost('', payload);
  if (resp.status !== 'OK') throw new Error(resp.status || 'ERR_STATUS');
  return resp.links || {};
}

export async function updateAbonement({ nick, league, type }) {
  const payload = {
    action: 'updateAbonement',
    nick,
    league: normalizeLeague(league),
    type: String(type || '').toLowerCase()
  };

  let res;
  try {
    res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    log('[ranking]', err);
    const e = new Error('Proxy unreachable');
    e.cause = err;
    throw e;
  }

  if (!res.ok) {
    const err = new Error(res.statusText || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json ? res.json() : res.text();
}

// ===== Optional small helpers (UI aliases) =====
window.uiLeagueToCsv = window.uiLeagueToCsv || function(v){ return String(v).toLowerCase()==='kids' ? 'kids' : 'sundaygames'; };
window.uiLeagueToGas = window.uiLeagueToGas || function(v){ return String(v).toLowerCase()==='kids' ? 'kids' : 'sundaygames'; };
