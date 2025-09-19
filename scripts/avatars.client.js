import { AVATARS_SHEET_ID, AVATARS_GID, AVATAR_PLACEHOLDER } from './config.js?v=2025-09-19-3';
import { getAvatarUrl } from './api.js?v=2025-09-19-3';

export const nickKey = value => String(value || '').trim().toLowerCase();

const jsonUrl = `https://docs.google.com/spreadsheets/d/${AVATARS_SHEET_ID}/gviz/tq?tqx=out:json&gid=${AVATARS_GID}`;
const csvUrl = `https://docs.google.com/spreadsheets/d/${AVATARS_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${AVATARS_GID}`;

let mapPromise = null; // Promise<Map<string, string>>
let lastSource = 'json';

async function fetchMapFromJson() {
  const res = await fetch(jsonUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Avatar JSON HTTP ${res.status}`);
  const text = await res.text();
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const cols = json.table.cols.map(col => col.label);
  const map = new Map();

  for (const row of json.table.rows) {
    const obj = {};
    cols.forEach((label, idx) => {
      obj[label] = row.c[idx] ? row.c[idx].v : '';
    });
    const nick = (obj.Nickname || obj.nick || obj[cols[0]] || '').trim();
    const url = (obj.AvatarURL || obj.url || obj[cols[1]] || '').trim();
    if (nick && url) map.set(nickKey(nick), url);
  }
  return map;
}

function parseCsvLine(line) {
  return line
    .match(/(".*?"|[^,]+)/g)
    ?.map(cell => cell.replace(/^"|"$/g, '').trim()) || [];
}

async function fetchMapFromCsv() {
  const res = await fetch(csvUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Avatar CSV HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return new Map();

  const headers = parseCsvLine(lines[0]);
  const iNick = headers.findIndex(header => /nick/i.test(header));
  const iUrl = headers.findIndex(header => /url/i.test(header));
  const nickIndex = iNick >= 0 ? iNick : 0;
  const urlIndex = iUrl >= 0 ? iUrl : 1;
  const map = new Map();

  lines.slice(1).forEach(line => {
    const cells = parseCsvLine(line);
    const nick = cells[nickIndex] || '';
    const url = cells[urlIndex] || '';
    if (nick && url) map.set(nickKey(nick), url);
  });

  return map;
}

async function fetchMapFromFallback(baseMap = new Map()) {
  const map = baseMap instanceof Map ? baseMap : new Map();
  const imgs = Array.from(document.querySelectorAll('img[data-nick]'));
  const seen = new Set();
  const entries = [];

  for (const img of imgs) {
    const nick = img.dataset.nick || '';
    const key = nickKey(nick);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    entries.push({ nick, key });
  }

  let index = 0;
  const workerCount = Math.min(6, entries.length);
  if (!workerCount) return map;

  const workers = Array.from({ length: workerCount }, () => (async function worker() {
    while (index < entries.length) {
      const current = index++;
      const { nick, key } = entries[current];
      try {
        const rec = await getAvatarUrl(nick);
        const url = rec && typeof rec.url === 'string' ? rec.url.trim() : '';
        if (key && url) map.set(key, url);
      } catch (err) {
        console.warn('[avatars] fallback', nick, err);
      }
    }
  })());

  await Promise.all(workers);
  return map;
}

async function fetchMap() {
  let map = null;
  try {
    map = await fetchMapFromJson();
    if (map.size) {
      lastSource = 'json';
      return map;
    }
  } catch (err) {
    console.warn('[avatars]', err);
  }

  try {
    const csvMap = await fetchMapFromCsv();
    if (csvMap.size) {
      lastSource = 'csv';
      return csvMap;
    }
    map = map ?? csvMap;
  } catch (csvErr) {
    console.error('[avatars]', csvErr);
  }

  const fallbackBase = map ?? new Map();
  const fallbackMap = await fetchMapFromFallback(fallbackBase);
  lastSource = 'gas-fallback';
  return fallbackMap;
}

function withBust(src, bust) {
  if (!src) return src;
  if (/^(?:data|blob):/i.test(src)) return src;
  if (bust === undefined || bust === null || bust === '') return src;
  const numeric = typeof bust === 'number' ? bust : Number(bust);
  const value = Number.isFinite(numeric)
    ? numeric
    : encodeURIComponent(String(bust));
  return `${src}${src.includes('?') ? '&' : '?'}t=${value}`;
}

function applyAvatar(img, baseSrc, bust) {
  const fallback = withBust(AVATAR_PLACEHOLDER, bust) || AVATAR_PLACEHOLDER;
  const src = withBust(baseSrc || AVATAR_PLACEHOLDER, bust) || AVATAR_PLACEHOLDER;

  img.referrerPolicy = 'no-referrer';
  img.decoding = 'async';
  if (!img.loading) img.loading = 'lazy';
  if (!img.alt) img.alt = img.dataset.nick || 'avatar';
  img.onerror = () => {
    img.onerror = null;
    img.src = fallback;
  };
  img.src = src;
}

function isVisible(el) {
  if (!el) return false;
  if (typeof el.checkVisibility === 'function') {
    try { return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }); }
    catch { /* fallback */ }
  }
  return !!(el.offsetParent || el.getClientRects().length);
}

export async function renderAllAvatars({ bust } = {}) {
  const map = await (mapPromise ??= fetchMap());
  const imgs = Array.from(document.querySelectorAll('img[data-nick]'));
  console.log(`[avatars] source=${lastSource} size=${map.size} imgs=${imgs.length}`);

  const misses = [];
  const missKeys = new Set();
  imgs.forEach(img => {
    const key = nickKey(img.dataset.nick);
    const src = key ? map.get(key) : '';
    if (!src && key && isVisible(img) && !missKeys.has(key)) {
      missKeys.add(key);
      misses.push(img.dataset.nick || '');
    }
    applyAvatar(img, src, bust);
  });

  if (misses.length) {
    const list = misses.slice(0, 5).join(',');
    console.warn(`[avatars] miss=[${list}]`);
  }
}

export async function reloadAvatars({ bust = Date.now() } = {}) {
  mapPromise = null;
  await renderAllAvatars({ bust });
}

export function updateOneAvatar(nick, url, bust = Date.now()) {
  const key = nickKey(nick);
  if (!key) return;

  mapPromise ??= Promise.resolve(new Map());
  mapPromise = mapPromise.then(map => {
    map.set(key, url || '');
    document.querySelectorAll(`img[data-nick="${nick}"]`).forEach(img => {
      if (!img.dataset.nick) img.dataset.nick = nick;
      applyAvatar(img, url || '', bust);
    });
    return map;
  });
}
