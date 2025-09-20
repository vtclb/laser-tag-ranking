import { AVATAR_PLACEHOLDER } from './config.js?v=2025-09-19-avatars-2';
import { avatarNickKey, fetchAvatarForNick, fetchAvatarsMap } from './api.js';

const ZERO_WIDTH_CHARS_RE = /[\u200B-\u200D\u2060\uFEFF]/g;
const WHITESPACE_RE = /\s+/g;
const MAX_LOOKUPS = 4;

let mapPromise = null;
let lastSource = 'proxy';
let lastUpdatedAt = null;

function normalizeNickLabel(value) {
  const input = value == null ? '' : String(value);
  return input
    .replace(ZERO_WIDTH_CHARS_RE, '')
    .normalize('NFKC')
    .trim()
    .replace(WHITESPACE_RE, ' ');
}

function resolveArgs(rootOrOptions, maybeOptions) {
  const defaultRoot = typeof document !== 'undefined' ? document : null;
  let root = rootOrOptions;
  let options = maybeOptions;

  if (root && typeof root.querySelectorAll === 'function') {
    // root provided explicitly
  } else if (options && typeof options === 'object') {
    root = defaultRoot;
  } else if (root && typeof root === 'object') {
    options = root;
    root = defaultRoot;
  } else {
    root = defaultRoot;
    options = {};
  }

  if (!options || typeof options !== 'object') options = {};
  if (!root || typeof root.querySelectorAll !== 'function') root = defaultRoot;

  return { root: root || defaultRoot, options };
}

function ensureAvatarEntry(img) {
  if (!img || !img.dataset) return { img, nick: '', key: '' };

  const rawNick = typeof img.dataset.nick === 'string' ? img.dataset.nick : '';
  const normalizedNick = normalizeNickLabel(rawNick);
  if (normalizedNick) img.dataset.nick = normalizedNick;
  else delete img.dataset.nick;

  const datasetKey = typeof img.dataset.nickKey === 'string' ? img.dataset.nickKey : '';
  const canonicalKey = datasetKey ? avatarNickKey(datasetKey) : avatarNickKey(normalizedNick);
  if (canonicalKey) img.dataset.nickKey = canonicalKey;
  else delete img.dataset.nickKey;

  return { img, nick: normalizedNick, key: canonicalKey };
}

function queryAvatarElements(root) {
  const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
  return Array.from(scope.querySelectorAll('img[data-nick], img[data-nick-key]'));
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

async function fetchMap(force = false) {
  try {
    const result = await fetchAvatarsMap({ force });
    const map = result?.map instanceof Map ? result.map : new Map();
    lastSource = result?.source || (map.size ? 'proxy' : 'none');
    lastUpdatedAt = Number.isFinite(result?.updatedAt) ? result.updatedAt : null;
    if (map.size) {
      console.log(`[avatars] source=${lastSource} size=${map.size}`);
    } else {
      console.warn('[avatars] WARN: avatar feed returned no rows; using placeholders only');
    }
    return map;
  } catch (err) {
    lastSource = 'error';
    lastUpdatedAt = null;
    console.warn('[avatars] avatar feed failed', err);
    return new Map();
  }
}

export async function renderAllAvatars(rootOrOptions, maybeOptions) {
  const { root, options } = resolveArgs(rootOrOptions, maybeOptions);
  const bustOption = options?.bust;
  const imgs = queryAvatarElements(root);
  if (!imgs.length) return;

  const entries = imgs.map(ensureAvatarEntry);
  entries.forEach(entry => applyAvatar(entry.img, '', bustOption));

  const map = await (mapPromise ??= fetchMap());
  const baseBust = bustOption ?? lastUpdatedAt ?? Date.now();

  let directMatches = 0;
  const missing = [];

  for (const entry of entries) {
    const src = entry.key ? map.get(entry.key) : '';
    if (src) {
      directMatches += 1;
      applyAvatar(entry.img, src, baseBust);
    } else if (entry.key) {
      missing.push(entry);
    }
  }

  const visibleMissing = missing.filter(item => isVisible(item.img));
  const lookupCandidates = visibleMissing.slice(0, MAX_LOOKUPS);
  let lookupMatches = 0;

  for (const entry of lookupCandidates) {
    const lookupNick = entry.nick || entry.key;
    if (!lookupNick) continue;
    try {
      const record = await fetchAvatarForNick(lookupNick);
      const url = record && typeof record.url === 'string' ? record.url.trim() : '';
      if (!url) continue;
      const recordBust = bustOption
        ?? (Number.isFinite(record?.updatedAt) ? record.updatedAt : null)
        ?? lastUpdatedAt
        ?? Date.now();
      const canonicalKey = entry.key || avatarNickKey(entry.nick || lookupNick);
      if (canonicalKey) {
        entry.img.dataset.nickKey = canonicalKey;
        map.set(canonicalKey, url);
      }
      applyAvatar(entry.img, url, recordBust);
      lookupMatches += 1;
    } catch (err) {
      console.warn('[avatars] fallback error', lookupNick, err);
    }
  }

  const unresolved = visibleMissing
    .filter(entry => {
      const key = entry.key || avatarNickKey(entry.nick);
      return !(key && map.get(key));
    })
    .slice(0, 5)
    .map(entry => entry.nick || entry.key || '')
    .filter(Boolean);

  const missSummary = unresolved.length ? unresolved.join(',') : '-';
  console.log(`[avatars] imgs=${imgs.length} map=${directMatches} lookup=${lookupMatches} miss=${missSummary} source=${lastSource}`);
}

export async function reloadAvatars(rootOrOptions, maybeOptions) {
  const { root, options } = resolveArgs(rootOrOptions, maybeOptions);
  const nextOptions = { ...options, bust: options?.bust ?? Date.now() };
  mapPromise = fetchMap(true);
  await renderAllAvatars(root, nextOptions);
}

if (typeof document !== 'undefined' && document?.addEventListener) {
  document.addEventListener('DOMContentLoaded', () => {
    renderAllAvatars(document).catch(err => {
      console.warn('[avatars] initial render failed', err);
    });
  });
}
