// scripts/api.js
import { log } from './logger.js';
import { AVATAR_PLACEHOLDER } from './config.js';

// Toggle network diagnostics
const DEBUG_NETWORK = false;

// ---------------------- Safe storage helpers ----------------------
export function safeGet(storage, key) {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch (err) {
    log('[ranking]', err);
    return null;
  }
}

export function safeSet(storage, key, value) {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch (err) {
    log('[ranking]', err);
  }
}

export function safeDel(storage, key) {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch (err) {
    log('[ranking]', err);
  }
}

// ---------------------- Глобальні утиліти ----------------------
export function requireUrl(value, { name = 'URL', allowRelative = false } = {}) {
  const raw = typeof value === 'string' ? value.trim() : String(value || '').trim();
  if (!raw) {
    throw new Error(`${name} is required`);
  }
  let parsed;
  try {
    parsed = allowRelative
      ? new URL(raw, typeof window !== 'undefined' && window.location ? window.location.origin : undefined)
      : new URL(raw);
  } catch (err) {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new Error(`${name} must use http(s)`);
  }
  parsed.hash = '';
  return parsed;
}

function normalizeProxyBase(rawUrl, { name } = {}) {
  const parsed = requireUrl(rawUrl, { name });
  parsed.search = '';
  let path = parsed.pathname || '/';
  if (!path.endsWith('/')) path += '/';
  const proxyUrl = parsed.origin + path;
  return {
    proxyUrl,
    proxyOrigin: proxyUrl.replace(/\/$/, '')
  };
}

// Google Apps Script backend (веб-апп)
const PROD_PROXY_URL = 'https://laser-proxy.vartaclub.workers.dev/';
const LOCAL_PROXY_URL = 'http://localhost:8787/';
const rawConfiguredProxy =
  (typeof window !== 'undefined' && window.WEB_APP_URL ? String(window.WEB_APP_URL).trim() : '') || '';
const hostname =
  typeof window !== 'undefined' && window.location ? window.location.hostname : '';
const isLocalHost = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)$/i.test(hostname);
const fallbackProxy = isLocalHost ? LOCAL_PROXY_URL : PROD_PROXY_URL;

let proxyConfig;
if (rawConfiguredProxy) {
  proxyConfig = normalizeProxyBase(rawConfiguredProxy, { name: 'WEB_APP_URL' });
} else {
  proxyConfig = normalizeProxyBase(fallbackProxy, { name: 'Fallback proxy URL' });
}

export const WEB_APP_URL = proxyConfig.proxyUrl;
window.WEB_APP_URL = WEB_APP_URL;
// back-compat
export const PROXY_URL = WEB_APP_URL;
export const PROXY_ORIGIN = proxyConfig.proxyOrigin;

// Допоміжний POST JSON запит
window.postJson = window.postJson || async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    log('[ranking]', err);
    return { status: 'TEXT', text };
  }
};

// Відображення UI-ліг до CSV та GAS назв
  window.uiLeagueToCsv = window.uiLeagueToCsv || function uiLeagueToCsv(v) {
    return String(v).toLowerCase() === 'kids' ? 'kids' : 'sundaygames';
  };

window.uiLeagueToGas = window.uiLeagueToGas || function uiLeagueToGas(v) {
  return String(v).toLowerCase() === 'kids' ? 'kids' : 'sundaygames';
};

// Публічні фіди (CSV)
export const CSV_URLS = {
  kids: {
    ranking:
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1648067737&single=true&output=csv',
    games:
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=249347260&single=true&output=csv',
  },
  sundaygames: {
    ranking:
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1286735969&single=true&output=csv',
    games:
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=249347260&single=true&output=csv',
  },
};

const rankFromPoints = (p) => (p < 200 ? 'D' : p < 500 ? 'C' : p < 800 ? 'B' : p < 1200 ? 'A' : 'S');

// ---------------------- Cached fetch ----------------------
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
    } catch (e) {
      log('[ranking]', e);
    }
  }

  const data = await (fetchFn ? fetchFn() : fetch(url).then(r => r.text()));

  const info = { data, time: now };
  _fetchCache[url] = info;
  safeSet(window.__SESS, url, JSON.stringify(info));
  return data;
}

// ---------------------- Уніфікація ліг ----------------------
export function normalizeLeague(v) {
  const x = String(v || '').toLowerCase();
    if (x === 'sundaygames' || x === 'olds' || x === 'adult' || x === 'adults') return 'sundaygames';
    if (x === 'kid' || x === 'junior') return 'kids';
    if (x === 'kids') return 'kids';
    return 'sundaygames'; // дефолт — старша
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

// ---------------------- CSV helper ----------------------
export async function fetchCsv(url, ttlMs = 0) {
  const text = await fetchOnce(url, ttlMs);
  if (typeof text !== 'string') {
    throw new Error('API: feed failed');
  }
  // якщо є Papa — віддамо заголовками, якщо ні — швидкий парсер нижче
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

// ---------------------- Рейтинг/гравці ----------------------
export async function loadPlayers(league) {
  const url = getLeagueFeedUrl(league);
  const rows = await fetchCsv(url);
  return rows.map(r => {
    const nick = String(r.Nickname || '').trim();
    if (!nick) return null;
    const pts = Number(r.Points || 0);
    const player = { nick, pts, rank: rankFromPoints(pts) };
    const ab = r.abonement_type ? String(r.abonement_type).trim() : '';
    if (ab) player.abonement = ab;
    return player;
  }).filter(Boolean);
}

// Back-compat для балансера: він імпортує саме fetchPlayerData
export async function fetchPlayerData(league) {
  return loadPlayers(league);
}

export async function parseProxyResponse(response) {
  if (!response) {
    return { ok: false, status: 'ERR_PROXY', message: 'No response', players: null };
  }

  const statusCode = response.status;
  const contentType =
    response.headers && typeof response.headers.get === 'function'
      ? response.headers.get('content-type') || ''
      : '';
  let text = '';
  try {
    text = await response.text();
  } catch (err) {
    const message = err && typeof err.message === 'string' ? err.message : 'Failed to read response body';
    return { ok: false, status: 'ERR_PROXY', message, players: null };
  }

  if (!response.ok) {
    const message = text.trim() || `HTTP ${statusCode}`;
    return { ok: false, status: 'ERR_PROXY', message, players: null };
  }

  if (!contentType.toLowerCase().includes('application/json')) {
    const snippet = text.trim().slice(0, 2048);
    const message = snippet || `Unexpected response (${contentType || 'unknown'})`;
    return { ok: false, status: 'ERR_HTML', message, players: null };
  }

  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    const message = err && typeof err.message === 'string' ? err.message : 'JSON parse error';
    return { ok: false, status: 'ERR_JSON_PARSE', message, players: null };
  }

  if (!data || typeof data !== 'object') {
    return { ok: false, status: 'ERR_JSON_PARSE', message: 'Empty JSON payload', players: null };
  }

  const rawStatus = typeof data.status === 'string' ? data.status : response.ok ? 'OK' : 'ERR_PROXY';
  const normalizedStatus = String(rawStatus || '');
  const ok = response.ok && normalizedStatus.toUpperCase() === 'OK';
  const message =
    typeof data.message === 'string'
      ? data.message
      : typeof data.error === 'string'
        ? data.error
        : ok
          ? 'OK'
          : `HTTP ${statusCode}`;
  const players = Array.isArray(data.players) ? data.players : null;

  const result = { ...data };
  result.ok = ok;
  result.status = ok ? 'OK' : normalizedStatus || 'ERR_PROXY';
  result.message = message;
  result.players = players;
  return result;
}

// ---------------------- Збереження результату ----------------------
export async function saveResult(data) {
  const payload = { ...(data || {}) };
  if (payload.league) payload.league = normalizeLeague(payload.league);
  const body = new URLSearchParams(payload).toString();
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };

  const attempt = async (targetUrl) => {
    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body
      });
      const parsed = await parseProxyResponse(res);
      if (DEBUG_NETWORK) log('[ranking]', 'saveResult', targetUrl, parsed);
      return parsed;
    } catch (err) {
      if (DEBUG_NETWORK) log('[ranking]', err);
      const message = err && typeof err.message === 'string' ? err.message : 'Network error';
      return { ok: false, status: 'ERR_NETWORK', message, players: null };
    }
  };

  let result = await attempt(PROXY_ORIGIN);
  const canRetry =
    !result.ok &&
    (result.status === 'ERR_PROXY' ||
      result.status === 'ERR_NETWORK' ||
      result.status === 'ERR_JSON_PARSE' ||
      result.status === 'ERR_HTML');

  const fallbackRaw = typeof window !== 'undefined' ? window.GAS_FALLBACK_URL : '';
  if (canRetry && fallbackRaw) {
    try {
      const fallback = normalizeProxyBase(String(fallbackRaw).trim(), { name: 'GAS_FALLBACK_URL' });
      result = await attempt(fallback.proxyOrigin);
    } catch (err) {
      if (DEBUG_NETWORK) log('[ranking]', err);
    }
  }

  return result;
}

// ---------------------- Детальна статистика (PDF імпорт) ----------------------
export async function saveDetailedStats(matchId, statsArray) {
  const payload = { action: 'importStats', matchId, stats: statsArray };
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.text();
}

// ---------------------- Аватарки ----------------------
export async function uploadAvatar(nick, file) {
  const data = await toBase64NoPrefix(file);
  const mime = file.type || 'image/jpeg';
  let res;
  try {
    res = await fetch(PROXY_ORIGIN + '/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'uploadAvatar', nick, mime, data })
    });
  } catch (err) {
    log('[ranking]', err);
    const networkErr = new Error('Proxy unreachable');
    networkErr.cause = err;
    throw networkErr;
  }
  const text = await res.text();
  if (DEBUG_NETWORK) log('[ranking]', text);
  let resp;
  try {
    resp = JSON.parse(text);
  } catch {
    resp = { status: 'ERR', raw: text };
  }
  if (!resp || typeof resp !== 'object') {
    resp = { status: 'ERR', raw: text };
  }
  if (resp.status && resp.status !== 'OK') {
    throw new Error(resp.status);
  }
  return resp;
}

// ---------------------- Реєстрація/статистика ----------------------
export async function registerPlayer(data) {
  const payload = Object.assign({ action: 'register' }, data);
  if (payload.league) payload.league = normalizeLeague(payload.league);
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || ('HTTP ' + res.status));
  return text.trim();
}

export async function fetchPlayerStats(nick) {
  const payload = { action: 'getStats', nick };
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// ---------------------- Абонементи ----------------------
// Кнопка “Запросити абонемент” у профілі.
// Під бекенд: action = 'requestAbonement' (а не 'abonement_request')
export async function requestAbonement({ nick, league = 'sundaygames', requested = 'month' }) {
  const payload = {
    action: 'requestAbonement',
    nick,
    league: normalizeLeague(league),
    requested
  };
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json ? res.json() : res.text();
}

// Адмін у балансері змінює тип абонемента.
// Під бекенд: action = 'updateAbonement', поля: {nick, league, type}
export async function updateAbonement({ nick, league, type }) {
  const payload = {
    action: 'updateAbonement',
    nick,
    league: normalizeLeague(league),
    type: String(type || 'none').toLowerCase()
  };
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json ? res.json() : res.text();
}

// ---------------------- Логи ігор для конкретного гравця ----------------------
export async function fetchPlayerGames(nick, league = '') {
  let res;
  try {
    // якщо проксі віддає лист games
    // Use a fixed version to control cache invalidation instead of Date.now()
    res = await fetch(`${PROXY_URL}?sheet=games&v=1`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
  } catch (err) {
    log('[ranking]', err);
    res = await fetch(getGamesFeedUrl(league));
  }
  const text = await res.text();

  let list;
  if (typeof Papa !== 'undefined') {
    list = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  } else {
    const lines = text.trim().split('\n').filter(Boolean);
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    list = lines.slice(1).map(line => {
      const cols = line.split(',');
      const get = (name) => {
        const idx = header.indexOf(name.toLowerCase());
        return idx >= 0 ? (cols[idx] || '').trim() : '';
      };
      return {
        Timestamp: get('Timestamp'),
        League: get('League'),
        Team1: get('Team1'),
        Team2: get('Team2'),
        Team3: get('Team3'),
        Team4: get('Team4'),
        Winner: get('Winner'),
        MVP: get('MVP'),
        Series: get('Series'),
        ID: get('ID')
      };
    });
  }

  const lg = league ? normalizeLeague(league) : '';
  return list.filter(g => {
    if (lg && g.League && normalizeLeague(g.League) !== lg) return false;
    const teams = [g.Team1, g.Team2, g.Team3, g.Team4];
    return teams.some(t => (t || '').split(',').map(s => s.trim()).includes(nick));
  });
}

// ---------------------- Новий JSON API ----------------------
async function gasPost(path = '', payload = {}) {
  const resp = await fetch(WEB_APP_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await resp.text();
  const ctype = resp.headers.get('content-type') || '';
  if (!ctype.includes('application/json')) {
    return { status: 'ERR_NOT_JSON', code: resp.status, body: text };
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    log('[ranking]', err);
    return { status: 'ERR_JSON_PARSE', body: text };
  }
}

export async function adminCreatePlayer(data) {
  const payload = { action: 'adminCreatePlayer', ...(data || {}) };
  if (payload.league) payload.league = normalizeLeague(payload.league);
  const resp = await gasPost('', payload);
  if (resp.status !== 'OK' && resp.status !== 'DUPLICATE') {
    throw new Error(resp.status || 'ERR_STATUS');
  }
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
  if (resp.status !== 'OK' && resp.status !== 'DENIED') {
    throw new Error(resp.status || 'ERR_STATUS');
  }
  return resp;
}

export async function getAvatarUrl(nick) {
  const key = `avatar:${nick}`;
  let rec = avatarCache.get(nick);
  if (!rec) {
    const raw = safeGet(window.__SESS, key);
    if (raw) {
      try {
        rec = JSON.parse(raw);
        avatarCache.set(nick, rec);
      } catch (err) {
        safeDel(window.__SESS, key);
      }
    }
  }
  if (rec) return rec;

  const resp = await gasPost('', { action: 'getAvatarUrl', nick });
  if (resp.status !== 'OK') throw new Error(resp.status || 'ERR_STATUS');
  rec = { url: resp.url || null, updatedAt: resp.updatedAt || Date.now() };
  avatarCache.set(nick, rec);
  safeSet(window.__SESS, key, JSON.stringify(rec));
  return rec;
}

export async function getPdfLinks(params) {
  const payload = { action: 'getPdfLinks', ...(params || {}) };
  if (payload.league) payload.league = normalizeLeague(payload.league);
  const resp = await gasPost('', payload);
  if (resp.status !== 'OK') throw new Error(resp.status || 'ERR_STATUS');
  return resp.links || {};
}

export function avatarSrcFromRecord(rec) {
  const url = rec && rec.url ? rec.url : AVATAR_PLACEHOLDER;
  return url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
}

export function toBase64NoPrefix(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      const comma = result.indexOf(',');
      if (comma === -1) {
        reject(new Error('Invalid file data'));
      } else {
        resolve(result.slice(comma + 1));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
