import { AVATAR_PLACEHOLDER, AVATARS_SHEET_ID, AVATARS_GID } from './config.js?v=2025-09-18-2';

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

async function fetchMap(bust) {
  try {
    const map = await fetchMapFromJson(bust);
    if (map.size) return map;
  } catch (err) {
    console.warn('Avatar JSON fetch failed', err);
  }
  try {
    return await fetchMapFromCsv(bust);
  } catch (err) {
    console.error('Avatar CSV fetch failed', err);
    return new Map();
  }
}

export async function renderAllAvatars({ bust } = {}) {
  const map = await (mapPromise && !bust ? mapPromise : (mapPromise = fetchMap(bust)));
  document.querySelectorAll('img[data-nick]').forEach(img => {
    const nick = img.dataset.nick || '';
    let src = map.get(nickKey(nick)) || AVATAR_PLACEHOLDER;
    if (bust) src += (src.includes('?') ? '&' : '?') + 'v=' + bust;
    img.referrerPolicy = 'no-referrer';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = () => {
      img.onerror = null;
      img.src = AVATAR_PLACEHOLDER;
    };
    if (!img.alt) img.alt = nick || 'avatar';
    img.src = src;
  });
}

export function reloadAvatars({ bust = Date.now() } = {}) {
  mapPromise = null;
  return renderAllAvatars({ bust });
}

