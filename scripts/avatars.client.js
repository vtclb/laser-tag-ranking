import { AVATAR_PLACEHOLDER } from './config.js?v=2025-09-19-avatars-1';
import { fetchAvatarForNick, fetchAvatarsMap } from './api.js';

const ZERO_WIDTH_CHARS_RE = /[\u200B-\u200D\u2060\uFEFF]/g;
const WHITESPACE_RE = /\s+/g;

export const nickKey = value => {
  const input = value == null ? '' : String(value);

  return input
    .replace(ZERO_WIDTH_CHARS_RE, '')
    .normalize('NFKC')
    .trim()
    .replace(WHITESPACE_RE, ' ')
    .toLowerCase();
};

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
let lastSource = 'proxy';
let lastUpdatedAt = null;

async function fetchMap(force = false) {
  try {
    const { map, source, updatedAt } = await fetchAvatarsMap({ force });
    lastSource = source || (map.size ? 'proxy' : 'none');
    lastUpdatedAt = Number.isFinite(updatedAt) ? updatedAt : null;

    if (map.size) {
      console.log(`[avatars] source=${lastSource} size=${map.size}`);
      return map;
    }

    console.warn('[avatars] WARN: avatar feed returned no rows; using placeholders only');
    return map;
  } catch (err) {
    lastSource = 'error';
    lastUpdatedAt = null;
    console.warn('[avatars] avatar feed failed', err);
    return new Map();
  }
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
  const defaultBust = hasBust ? bust : (lastUpdatedAt ?? Date.now());
  let anySuccess = false;

  const workers = Array.from({ length: workerCount }, () => (async function worker() {
    while (true) {
      const currentIndex = index++;
      if (currentIndex >= items.length) break;
      const { nick, key, imgs } = items[currentIndex];
      try {
        const lookupNick = nick || key;
        const rec = await fetchAvatarForNick(lookupNick);
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
          const recordBust = hasBust ? bust : (Number.isFinite(rec?.updatedAt) ? rec.updatedAt : defaultBust);
          applyAvatar(img, url, recordBust);
        });
      } catch (err) {
        console.warn('[avatars] fallback error', nick, err);
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
  mapPromise = fetchMap(true);
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
