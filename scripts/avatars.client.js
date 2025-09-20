import { AVATAR_PLACEHOLDER, AVATAR_PROXY_BASE, VERSION } from './config.js?v=2025-09-19-avatars-1';
import { getAvatarUrl } from './api.js';

const JSON_ENDPOINTS = ['index.json', 'map.json', 'avatars.json'];
const CSV_ENDPOINTS = ['index.csv', 'map.csv', 'avatars.csv'];

const ZERO_WIDTH_CHARS_RE = /[\u200B-\u200D\u2060\uFEFF]/g;
const WHITESPACE_RE = /\s+/g;
const KNOWN_AVATAR_FIELDS = new Set([
  'nick', 'nickname', 'name', 'player', 'key',
  'url', 'avatar', 'avatarurl', 'image', 'href', 'src'
]);

export const nickKey = value => {
  const input = value == null ? '' : String(value);

  return input
    .replace(ZERO_WIDTH_CHARS_RE, '')
    .normalize('NFKC')
    .trim()
    .replace(WHITESPACE_RE, ' ')
    .toLowerCase();
};

const VERSION_QUERY = VERSION ? `v=${encodeURIComponent(VERSION)}` : '';

function buildProxyUrl(path) {
  const base = typeof AVATAR_PROXY_BASE === 'string' ? AVATAR_PROXY_BASE : '';
  const safeBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = String(path || '').replace(/^\/+/, '');
  if (!safeBase || !cleanPath) return '';
  const url = safeBase + cleanPath;
  return VERSION_QUERY ? `${url}${url.includes('?') ? '&' : '?'}${VERSION_QUERY}` : url;
}

function isLikelyAvatarUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  return /^(?:https?:|data:|blob:)/i.test(trimmed);
}

function addAvatarRecord(map, nick, url) {
  if (!nick || !url) return;
  const key = nickKey(nick);
  const trimmedUrl = typeof url === 'string' ? url.trim() : '';
  if (!key || !isLikelyAvatarUrl(trimmedUrl)) return;
  if (!map.has(key)) map.set(key, trimmedUrl);
}

function harvestJsonValue(map, value) {
  if (!value) return;

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!entry) continue;
      if (Array.isArray(entry)) {
        if (entry.length >= 2) addAvatarRecord(map, entry[0], entry[1]);
        else harvestJsonValue(map, entry);
      } else {
        harvestJsonValue(map, entry);
      }
    }
    return;
  }

  if (typeof value === 'object') {
    const obj = value;
    const candidateNick =
      obj.nick ?? obj.Nick ?? obj.nickname ?? obj.Nickname ?? obj.name ?? obj.Name ?? obj.player ?? obj.key;
    const candidateUrl =
      obj.url ?? obj.URL ?? obj.Url ?? obj.avatar ?? obj.avatarUrl ?? obj.image ?? obj.href ?? obj.src;
    addAvatarRecord(map, candidateNick, candidateUrl);

    for (const [k, v] of Object.entries(obj)) {
      if (!v) continue;
      if (typeof v === 'string') {
        const lower = k.toLowerCase();
        if (!KNOWN_AVATAR_FIELDS.has(lower) && isLikelyAvatarUrl(v)) {
          addAvatarRecord(map, k, v);
        }
      } else if (typeof v === 'object') {
        harvestJsonValue(map, v);
      }
    }
    return;
  }

  if (typeof value === 'string') {
    const parts = value.split(',');
    if (parts.length >= 2) addAvatarRecord(map, parts[0], parts[1]);
  }
}

function ensureNodeNickKey(img) {
  if (!img || !img.dataset) return { nick: '', key: '' };
  const datasetNick = typeof img.dataset.nick === 'string' ? img.dataset.nick : '';
  const datasetKey = typeof img.dataset.nickKey === 'string' ? img.dataset.nickKey : '';
  const candidate = datasetKey || datasetNick;
  const key = candidate ? nickKey(candidate) : '';
  if (key) img.dataset.nickKey = key;
  else delete img.dataset.nickKey;
  return { nick: datasetNick, key };
}

function syncNodeNick(img, nick) {
  if (!img || !img.dataset) return { nick: '', key: '' };
  const label = typeof nick === 'string' ? nick : '';
  if (label) img.dataset.nick = label;
  const datasetNick = typeof img.dataset.nick === 'string' ? img.dataset.nick : '';
  const datasetKey = typeof img.dataset.nickKey === 'string' ? img.dataset.nickKey : '';
  const candidate = datasetKey || datasetNick;
  const key = candidate ? nickKey(candidate) : '';
  if (key) img.dataset.nickKey = key;
  else delete img.dataset.nickKey;
  return { nick: datasetNick, key };
}

function getAvatarElements() {
  return Array.from(document.querySelectorAll('img[data-nick], img[data-nick-key]'));
}

let mapPromise = null; // Promise<Map<string, string>>
let lastSource = 'json';

function parseCsvLine(line) {
  return line
    .match(/(".*?"|[^,]+)/g)
    ?.map(cell => cell.replace(/^"|"$/g, '').trim()) || [];
}

function findColumnIndex(headers, patterns, fallbackIndex = -1) {
  const idx = headers.findIndex(header => patterns.some(re => re.test(header)));
  return idx >= 0 ? idx : fallbackIndex;
}

async function fetchMapFromJson() {
  for (const endpoint of JSON_ENDPOINTS) {
    const url = buildProxyUrl(endpoint);
    if (!url) continue;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        console.warn(`[avatars] proxy JSON ${endpoint} HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const map = new Map();
      harvestJsonValue(map, data);
      if (map.size) return { map, endpoint };
      console.warn(`[avatars] proxy JSON ${endpoint} empty`);
    } catch (err) {
      console.warn(`[avatars] proxy JSON ${endpoint} failed`, err);
    }
  }
  return { map: new Map(), endpoint: null };
}

async function fetchMapFromCsv() {
  for (const endpoint of CSV_ENDPOINTS) {
    const url = buildProxyUrl(endpoint);
    if (!url) continue;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        console.warn(`[avatars] proxy CSV ${endpoint} HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (!lines.length) {
        console.warn(`[avatars] proxy CSV ${endpoint} empty`);
        continue;
      }

      const headers = parseCsvLine(lines[0]);
      const nickIndex = findColumnIndex(headers, [/key/i, /nick/i, /name/i, /player/i], 0);
      const urlIndex = findColumnIndex(headers, [/url/i, /avatar/i, /image/i, /href/i, /src/i], 1);
      const map = new Map();

      lines.slice(1).forEach(line => {
        const cells = parseCsvLine(line);
        const nick = cells[nickIndex] || '';
        const url = cells[urlIndex] || '';
        addAvatarRecord(map, nick, url);
      });

      if (map.size) return { map, endpoint };
      console.warn(`[avatars] proxy CSV ${endpoint} empty`);
    } catch (err) {
      console.warn(`[avatars] proxy CSV ${endpoint} failed`, err);
    }
  }
  return { map: new Map(), endpoint: null };
}

async function fetchMap() {
  try {
    const { map, endpoint } = await fetchMapFromJson();
    if (map.size) {
      lastSource = endpoint ? `proxy-json:${endpoint}` : 'proxy-json';
      console.log(`[avatars] source=${lastSource} size=${map.size}`);
      return map;
    }
    console.warn('[avatars] avatar JSON feed returned no rows');
  } catch (err) {
    console.warn('[avatars] avatar JSON feed failed', err);
  }

  try {
    const { map: csvMap, endpoint } = await fetchMapFromCsv();
    if (csvMap.size) {
      lastSource = endpoint ? `proxy-csv:${endpoint}` : 'proxy-csv';
      console.log(`[avatars] source=${lastSource} size=${csvMap.size}`);
      return csvMap;
    }
    console.warn('[avatars] avatar CSV feed returned no rows');
  } catch (csvErr) {
    console.error('[avatars] avatar CSV feed failed', csvErr);
  }

  lastSource = 'none';
  console.warn('[avatars] WARN: avatar sheet unavailable; using placeholders only');
  return new Map();
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

async function resolveMissingAvatars(map, entries, { bust } = {}) {
  if (!(map instanceof Map) || !Array.isArray(entries) || !entries.length) return;

  const items = entries
    .map(entry => {
      const nick = entry && typeof entry.nick === 'string' ? entry.nick : '';
      const key = entry && entry.key ? nickKey(entry.key) : nickKey(nick);
      const imgs = entry && Array.isArray(entry.imgs)
        ? entry.imgs.filter(img => !!img)
        : [];
      const canonicalKey = key || nickKey(nick);
      if (!canonicalKey || !imgs.length) return null;
      return { nick, key: canonicalKey, imgs };
    })
    .filter(Boolean);

  if (!items.length) return;

  let index = 0;
  const workerCount = Math.min(6, items.length);
  const hasBust = bust !== undefined && bust !== null && bust !== '';
  const bustValue = hasBust ? bust : Date.now();
  let anySuccess = false;

  const workers = Array.from({ length: workerCount }, () => (async function worker() {
    while (true) {
      const currentIndex = index++;
      if (currentIndex >= items.length) break;
      const { nick, key, imgs } = items[currentIndex];
      try {
        const lookupNick = nick || key;
        const rec = await getAvatarUrl(lookupNick);
        const url = rec && typeof rec.url === 'string' ? rec.url.trim() : '';
        if (!url) continue;
        const storeKey = nickKey(nick) || key;
        if (!storeKey) continue;
        map.set(storeKey, url);
        anySuccess = true;
        imgs.forEach(img => {
          if (!img) return;
          const { key: nodeKey } = syncNodeNick(img, nick);
          if (nodeKey !== storeKey) img.dataset.nickKey = storeKey;
          applyAvatar(img, url, bustValue);
        });
      } catch (err) {
        console.warn('[avatars] fallback', nick, err);
      }
    }
  })());

  await Promise.all(workers);

  if (anySuccess) {
    if (lastSource === 'none') lastSource = 'gas-fallback';
    mapPromise = Promise.resolve(map);
  }
}

export async function renderAllAvatars({ bust } = {}) {
  const map = await (mapPromise ??= fetchMap());
  const imgs = getAvatarElements();
  const missingByKey = new Map();
  let mapped = 0;

  imgs.forEach(img => {
    const { nick, key } = ensureNodeNickKey(img);
    const src = key ? map.get(key) : '';

    if (src) {
      mapped += 1;
    } else if (key) {
      let entry = missingByKey.get(key);
      if (!entry) {
        const fallbackNick = nick || key;
        entry = { key, nick: fallbackNick, imgs: [], visible: false };
        missingByKey.set(key, entry);
      }
      entry.imgs.push(img);
      if (isVisible(img)) entry.visible = true;
    }

    applyAvatar(img, src, bust);
  });

  const missEntries = Array.from(missingByKey.values()).filter(entry => entry.visible);
  const missList = missEntries.slice(0, 5)
    .map(entry => entry.nick || '')
    .filter(Boolean);
  const missSummary = missList.length ? missList.join(',') : '-';
  console.log(`[avatars] imgs=${imgs.length} mapped=${mapped} miss=${missSummary}`);

  if (missEntries.length) {
    await resolveMissingAvatars(map, missEntries, { bust });
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
    getAvatarElements().forEach(img => {
      const { key: nodeKey } = ensureNodeNickKey(img);
      if (nodeKey !== key) return;
      const { key: syncedKey } = syncNodeNick(img, nick);
      if (syncedKey !== key) img.dataset.nickKey = key;
      applyAvatar(img, url || '', bust);
    });
    return map;
  });
}
