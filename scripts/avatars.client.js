import { AVATARS_CSV_URL, AVATAR_PLACEHOLDER } from './config.js';

const AVATARS_JSON_URL = '/assets/avatars.json';
let mapPromise;

function normalize(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  const m = u.match(/(?:file\/d\/|id=)([\w-]{10,})/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w512` : u;
}

async function fetchJsonMap() {
  const res = await fetch(AVATARS_JSON_URL + '?t=' + Date.now());
  if (!res.ok) throw new Error('JSON fetch failed: ' + res.status);
  const data = await res.json();
  const map = new Map();
  Object.entries(data).forEach(([nick, url]) => {
    const n = nick.trim();
    const u = normalize(url);
    if (n && u) map.set(n, u);
  });
  return map;
}

async function fetchCsvMap() {
  const res = await fetch(AVATARS_CSV_URL + '&t=' + Date.now());
  if (!res.ok) throw new Error('CSV fetch failed: ' + res.status);
  const text = await res.text();
  const lines = text.trim().split('\n').filter(Boolean);
  const header = lines.shift().split(',').map(h => h.trim());
  const map = new Map();
  for (const line of lines) {
    const cols = line.split(',');
    const row = {};
    header.forEach((h, i) => { row[h] = (cols[i] || '').trim(); });
    const nick = row.nick || row.Nickname || row[header[0]] || '';
    const url = normalize(row.url || row.URL || row[header[1]] || '');
    if (nick && url) map.set(nick, url);
  }
  return map;
}

async function fetchMap() {
  if (!mapPromise) {
    mapPromise = (async () => {
      try {
        return await fetchJsonMap();
      } catch (err) {
        try {
          return await fetchCsvMap();
        } catch (err2) {
          console.error('Failed to load avatar map', err, err2);
          return new Map();
        }
      }
    })();
  }
  return mapPromise;
}

export async function renderAllAvatars({ bust } = {}) {
  const map = await fetchMap();
  document.querySelectorAll('img[data-nick]').forEach(img => {
    const nick = img.dataset.nick || '';
    let src = map.get(nick) || AVATAR_PLACEHOLDER;
    if (bust) src += (src.includes('?') ? '&' : '?') + 'v=' + bust;
    img.onerror = () => { img.onerror = null; img.src = AVATAR_PLACEHOLDER; };
    if (!img.alt) img.alt = nick || 'avatar';
    img.src = src;
  });
}

export function reloadAvatars(opts = {}) {
  mapPromise = null;
  const bust = opts.bust || Date.now();
  return renderAllAvatars({ ...opts, bust });
}
