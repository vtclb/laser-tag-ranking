import { AVATAR_PLACEHOLDER, AVATARS_SHEET_ID, AVATARS_GID } from './config.js?v=2025-09-18-12';
import { gasPost } from './api.js?v=2025-09-18-12';

let mapPromise;
const AVMAP = new Map();
let loadSeq = 0;

function gvizJsonUrl() {
  return `https://docs.google.com/spreadsheets/d/${AVATARS_SHEET_ID}/gviz/tq?tqx=out:json&gid=${AVATARS_GID}`;
}

function gvizCsvUrl() {
  return `https://docs.google.com/spreadsheets/d/${AVATARS_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${AVATARS_GID}`;
}

export function nickKey(nick = '') {
  return nick.trim().toLowerCase();
}

function driveThumbnail(url = '') {
  const u = url.trim();
  if (!u) return '';
  const m = u.match(/(?:file\/d\/|id=|open\?id=|uc\?id=)([\w-]{10,})/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w512` : u;
}

function appendBust(url, bust) {
  const base = url || '';
  if (!base) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}t=${bust}`;
}

function resolveBustValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let col = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { col += '"'; i++; } else { inQuotes = false; }
      } else {
        col += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(col); col = ''; }
      else if (ch === '\n') { row.push(col); rows.push(row); row = []; col = ''; }
      else if (ch !== '\r') { col += ch; }
    }
  }
  row.push(col);
  rows.push(row);
  return rows;
}

async function fetchMapFromJson(bust) {
  const res = await fetch(gvizJsonUrl() + (bust ? `&t=${bust}` : ''));
  if (!res.ok) throw new Error('JSON fetch failed: ' + res.status);
  const text = await res.text();
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const cols = json.table.cols.map(c => c.label);
  const map = new Map();
  for (const r of json.table.rows) {
    const obj = {};
    cols.forEach((label, i) => {
      obj[label] = r.c[i] ? r.c[i].v : '';
    });
    const nick = obj.nick || obj.Nickname || obj[cols[0]] || '';
    const url = driveThumbnail(obj.url || obj.URL || obj[cols[1]] || '');
    if (nick && url) map.set(nickKey(nick), url);
  }
  return map;
}

async function fetchMapFromCsv(bust) {
  const res = await fetch(gvizCsvUrl() + (bust ? `&t=${bust}` : ''));
  if (!res.ok) throw new Error('CSV fetch failed: ' + res.status);
  const text = await res.text();
  const rows = parseCsv(text.trim());
  const header = rows.shift().map(h => h.trim());
  const map = new Map();
  for (const cols of rows) {
    const row = {};
    header.forEach((h, i) => {
      row[h] = (cols[i] || '').trim();
    });
    const nick = row.nick || row.Nickname || row[header[0]] || '';
    const url = driveThumbnail(row.url || row.URL || row[header[1]] || '');
    if (nick && url) map.set(nickKey(nick), url);
  }
  return map;
}

async function fetchMapFromGas(bust) {
  const payload = { action: 'listAvatars', ver: '2025-09-18-12' };
  if (bust) payload.bust = bust;
  const resp = await gasPost('', payload);
  if (!resp || (resp.status && resp.status !== 'OK')) {
    const status = resp && resp.status ? resp.status : 'ERR_STATUS';
    const message = resp && resp.message ? `: ${resp.message}` : '';
    throw new Error(`GAS fetch failed ${status}${message}`);
  }

  const map = new Map();

  const addEntry = (nick, url) => {
    const key = nickKey(nick || '');
    if (!key) return;
    const raw = typeof url === 'string' ? url : (url == null ? '' : String(url));
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '[object Object]') return;
    const thumb = driveThumbnail(trimmed);
    if (!thumb) return;
    map.set(key, thumb);
  };

  const addFromRecord = rec => {
    if (!rec) return;
    if (Array.isArray(rec)) {
      const [nick, url] = rec;
      if (nick && String(nick).toLowerCase() === 'nickname') return;
      addEntry(nick, url);
      return;
    }
    if (typeof rec === 'object') {
      const nick = rec.nick ?? rec.nickname ?? rec.Nickname ?? rec.name ?? rec.Name ?? rec.player ?? rec.Player ?? rec[0];
      const url = rec.url ?? rec.URL ?? rec.avatarUrl ?? rec.avatarURL ?? rec.AvatarURL ?? rec.avatar ?? rec[1];
      if (nick && typeof url === 'undefined' && typeof rec.link === 'string') {
        addEntry(nick, rec.link);
        return;
      }
      addEntry(nick, url);
      return;
    }
  };

  const pushObjectEntries = obj => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(addFromRecord);
      return;
    }
    Object.entries(obj).forEach(([nick, value]) => {
      const resolved = (value && typeof value === 'object' && !Array.isArray(value))
        ? (value.url ?? value.URL ?? value.avatar ?? value.link ?? '')
        : value;
      addEntry(nick, resolved);
    });
  };

  pushObjectEntries(resp.map);
  pushObjectEntries(resp.avatars);
  pushObjectEntries(resp.items);
  pushObjectEntries(resp.records);
  pushObjectEntries(resp.list);
  pushObjectEntries(resp.values);
  pushObjectEntries(resp.data);
  pushObjectEntries(resp.rows);
  pushObjectEntries(resp.entries);

  const lists = [resp.avatars, resp.items, resp.records, resp.list, resp.values, resp.data, resp.rows, resp.entries];
  lists.forEach(list => {
    if (Array.isArray(list)) list.forEach(addFromRecord);
  });

  if (!map.size && Array.isArray(resp)) {
    resp.forEach(addFromRecord);
  }

  return map;
}

async function fetchMap(bust) {
  try {
    const map = await fetchMapFromJson(bust);
    if (map.size) return map;
  } catch (err) {
    console.warn('Avatar JSON fetch failed', err);
  }
  try {
    const map = await fetchMapFromCsv(bust);
    if (map.size) return map;
  } catch (err) {
    console.error('Avatar CSV fetch failed', err);
  }
  console.log('[avatars] using fallback GAS, ver=2025-09-18-12');
  try {
    const map = await fetchMapFromGas(bust);
    if (map.size) return map;
    return map;
  } catch (err) {
    console.error('Avatar GAS fetch failed', err);
  }
  return new Map();
}

function storeFetchedMap(map) {
  AVMAP.clear();
  if (map && typeof map.forEach === 'function') {
    map.forEach((value, key) => {
      if (typeof key === 'string') {
        AVMAP.set(key, value);
      }
    });
  }
  return AVMAP;
}

function loadMap({ bust } = {}) {
  const seq = ++loadSeq;
  const promise = fetchMap(bust)
    .then(map => {
      if (seq !== loadSeq) {
        return AVMAP;
      }
      return storeFetchedMap(map);
    })
    .catch(err => {
      if (seq === loadSeq) {
        mapPromise = null;
      }
      throw err;
    });
  mapPromise = promise;
  return promise;
}

function ensureMap({ bust } = {}) {
  if (!mapPromise) {
    return loadMap({ bust });
  }
  if (typeof bust !== 'undefined' && bust !== null) {
    return loadMap({ bust });
  }
  return mapPromise;
}

function paintAvatarImage(img, baseUrl, bust, nickLabel) {
  const effectiveBust = resolveBustValue(bust);
  const fallbackUrl = appendBust(AVATAR_PLACEHOLDER, effectiveBust);
  const finalBase = baseUrl || '';
  const finalUrl = finalBase ? appendBust(finalBase, effectiveBust) : fallbackUrl;

  img.referrerPolicy = 'no-referrer';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.onerror = () => {
    img.onerror = null;
    img.src = fallbackUrl;
  };
  if (!img.alt) img.alt = nickLabel || 'avatar';
  img.src = finalUrl;
}

export async function renderAllAvatars({ bust } = {}) {
  const shouldBustFetch = typeof bust !== 'undefined';
  await ensureMap({ bust: shouldBustFetch ? bust : undefined });
  const effectiveBust = resolveBustValue(bust);
  document.querySelectorAll('img[data-nick]').forEach(img => {
    const nick = img.dataset.nick || '';
    const key = nickKey(nick);
    const url = AVMAP.get(key) || '';
    paintAvatarImage(img, url, effectiveBust, nick);
  });
}

export function updateOneAvatar(nick, url, updatedAt = Date.now()) {
  const key = nickKey(nick || '');
  if (!key) return;
  const normalized = driveThumbnail(url || '');
  if (normalized) {
    AVMAP.set(key, normalized);
  } else {
    AVMAP.delete(key);
  }
  const bust = resolveBustValue(updatedAt);
  document.querySelectorAll('img[data-nick]').forEach(img => {
    if (nickKey(img.dataset.nick || '') !== key) return;
    const label = img.dataset.nick || nick || '';
    const baseUrl = normalized || '';
    paintAvatarImage(img, baseUrl, bust, label);
  });
}

export function reloadAvatars({ bust } = {}) {
  mapPromise = null;
  return renderAllAvatars({ bust });
}

