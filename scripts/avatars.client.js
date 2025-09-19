import { AVATAR_PLACEHOLDER, AVATARS_SHEET_ID, AVATARS_GID } from './config.js?v=2025-09-18-12';
import { gasPost } from './api.js?v=2025-09-18-12';

let mapPromise;

function gvizJsonUrl() {
  return `https://docs.google.com/spreadsheets/d/${AVATARS_SHEET_ID}/gviz/tq?tqx=out:json&gid=${AVATARS_GID}`;
}

function gvizCsvUrl() {
  return `https://docs.google.com/spreadsheets/d/${AVATARS_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${AVATARS_GID}`;
}

function nickKey(nick = '') {
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

export async function renderAllAvatars({ bust } = {}) {
  const map = await (mapPromise && !bust ? mapPromise : (mapPromise = fetchMap(bust)));
  const effectiveBust = bust || Date.now();
  document.querySelectorAll('img[data-nick]').forEach(img => {
    const nick = img.dataset.nick || '';
    const url = map.get(nickKey(nick)) || '';
    const base = url || AVATAR_PLACEHOLDER;
    const finalUrl = appendBust(base, effectiveBust);
    img.referrerPolicy = 'no-referrer';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = () => {
      img.onerror = null;
      img.src = appendBust(AVATAR_PLACEHOLDER, effectiveBust);
    };
    if (!img.alt) img.alt = nick || 'avatar';
    img.src = finalUrl;
  });
}

export function reloadAvatars({ bust = Date.now() } = {}) {
  mapPromise = null;
  return renderAllAvatars({ bust });
}

