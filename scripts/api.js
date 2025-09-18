// scripts/api.js
import { log } from './logger.js?v=2025-09-18-8';
import { AVATAR_PLACEHOLDER, DEFAULT_GAS_FALLBACK_URL } from './config.js?v=2025-09-18-8';

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

// Додатковий прямий бекап на Apps Script (опційно):
// <script>window.GAS_FALLBACK_URL='https://script.google.com/macros/s/XXX/exec';</script>

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

export function clearFetchCache(key) {
  delete _fetchCache[key];
  safeDel(window.__SESS, key);
  if (key.startsWith('avatar:')) avatarCache.delete(key.slice(7));
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

  console.log('[saveResult] v=2025-09-18-8');
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
  const fallbackRaw = (typeof window !== 'undefined' ? window.GAS_FALLBACK_URL : '');
  const needRetry = !result.ok && ['ERR', 'ERR_PROXY', 'ERR_NETWORK', 'ERR_JSON_PARSE', 'ERR_HTML'].includes(result.status);
  if (needRetry && fallbackRaw) {
    const trimmed = String(fallbackRaw).trim();
    if (trimmed) {
      let targetUrl = trimmed;
      try {
        const fb = normalizeProxyBase(trimmed, { name: 'GAS_FALLBACK_URL' });
        targetUrl = fb.proxyOrigin; // у GAS кореневий exec без '/'
      } catch (e) { /* ignore */ }
      result = await attempt(targetUrl);
    }
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
export async function uploadAvatar(nick, file) {
  // JSON → воркер (корінь), БЕЗ /json
  const mime = file.type || 'image/jpeg';
  const data = await toBase64NoPrefix(file);
  let res;
  try {
    res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'uploadAvatar', nick, mime, data })
    });
  } catch (err) {
    log('[ranking]', err);
    const e = new Error('Proxy unreachable');
    e.cause = err;
    throw e;
  }
  const text = await res.text();
  if (DEBUG_NETWORK) log('[ranking]', 'uploadAvatar', text);
  let resp;
  try { resp = JSON.parse(text); } catch { resp = { status: 'ERR', raw: text }; }
  if (!resp || typeof resp !== 'object') resp = { status: 'ERR', raw: text };
  if (resp.status && resp.status !== 'OK') throw new Error(resp.status);
  return resp; // {status:'OK', url, updatedAt}
}

export async function getAvatarUrl(nick) {
  const key = `avatar:${nick}`;
  let rec = avatarCache.get(nick);
  if (!rec) {
    const raw = safeGet(window.__SESS, key);
    if (raw) {
      try { rec = JSON.parse(raw); avatarCache.set(nick, rec); }
      catch { safeDel(window.__SESS, key); }
    }
  }
  if (rec) return rec;

  // JSON lookup через воркер
  const resp = await gasPost('', { action: 'getAvatarUrl', nick });
  if (resp.status !== 'OK') throw new Error(resp.status || 'ERR_STATUS');
  rec = { url: resp.url || null, updatedAt: resp.updatedAt || Date.now() };
  avatarCache.set(nick, rec);
  safeSet(window.__SESS, key, JSON.stringify(rec));
  return rec;
}

export function avatarSrcFromRecord(rec) {
  const url = rec && rec.url ? rec.url : AVATAR_PLACEHOLDER;
  return url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
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
  const root = typeof window !== 'undefined' ? window : globalThis;
  const rawFallback = root && typeof root.GAS_FALLBACK_URL === 'string'
    ? root.GAS_FALLBACK_URL.trim()
    : '';
  const baseUrl = rawFallback || DEFAULT_GAS_FALLBACK_URL || '';
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
