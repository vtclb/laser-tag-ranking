import {
  AVATAR_PLACEHOLDER,
  AVATAR_CACHE_BUST,
  AVATAR_WORKER_BASE,
  ASSETS_VER
} from './config.js?v=2025-09-19-avatars-2';

const ZERO_WIDTH_CHARS_RE = /[\u200B-\u200D\u2060\uFEFF]/g;
const COMBINING_MARKS_RE = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\uFE20-\uFE2F]/g;
const WHITESPACE_RE = /\s+/g;

const HOMOGRAPH_MAP = Object.freeze({
  '\u0131': 'i', // dotless i → i
  '\u03b1': 'a', // greek alpha → a
  '\u03b5': 'e', // greek epsilon → e
  '\u03ba': 'k', // greek kappa → k
  '\u03bf': 'o', // greek omicron → o
  '\u03c1': 'p', // greek rho → p
  '\u03c5': 'y', // greek upsilon → y
  '\u03c7': 'x', // greek chi → x
  '\u0430': 'a', // cyrillic a → a
  '\u0435': 'e', // cyrillic ie → e
  '\u043a': 'k', // cyrillic ka → k
  '\u043e': 'o', // cyrillic o → o
  '\u0440': 'p', // cyrillic er → p
  '\u0441': 'c', // cyrillic es → c
  '\u0443': 'y', // cyrillic u → y
  '\u0445': 'x', // cyrillic ha → x
  '\u0454': 'e', // cyrillic ie → e
  '\u0456': 'i', // cyrillic i → i
  '\u0457': 'i'  // cyrillic yi → i
});

const HOMOGRAPH_PATTERN = (() => {
  const chars = Object.keys(HOMOGRAPH_MAP);
  if (!chars.length) return null;
  const escaped = chars.map(ch => ch.replace(/[\\\]\[\-]/g, '\\$&')).join('');
  return new RegExp(`[${escaped}]`, 'gu');
})();

const runtimeRoot = typeof window !== 'undefined' ? window : globalThis;
const headerTemplate = {};
if (runtimeRoot && runtimeRoot.AVATAR_HEADERS && typeof runtimeRoot.AVATAR_HEADERS === 'object') {
  Object.assign(headerTemplate, runtimeRoot.AVATAR_HEADERS);
}
const originHeader = runtimeRoot?.location?.origin ? String(runtimeRoot.location.origin) : '';
if (originHeader && !headerTemplate['x-avatar-origin']) headerTemplate['x-avatar-origin'] = originHeader;
const assetVersion = trimConfigValue(ASSETS_VER) || trimConfigValue(AVATAR_CACHE_BUST);
if (assetVersion && !headerTemplate['x-avatar-version']) headerTemplate['x-avatar-version'] = assetVersion;
if (!headerTemplate['x-avatar-proxy']) headerTemplate['x-avatar-proxy'] = 'laser-tag-ranking';
const AV_HEADERS = Object.freeze(headerTemplate);

const WORKER_BASE_URL = prepareWorkerBase(AVATAR_WORKER_BASE);
const AVATAR_COLLECTION_URL = buildWorkerUrl(WORKER_BASE_URL, 'avatars');
const FEED_ENDPOINT = AVATAR_COLLECTION_URL;
const AVATAR_ENDPOINT = ensureTrailingSlash(AVATAR_COLLECTION_URL);
const CACHE_BUST_SEED = trimConfigValue(AVATAR_CACHE_BUST);

const state = {
  mapping: Object.create(null),
  updatedAt: 0,
  lastSync: 0
};

let feedPromise = null;
let feedPromiseIsFresh = false;
const nickRequests = new Map();

export function norm(value) {
  if (value == null) return '';
  const input = String(value);
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return '';
  const decomposed = trimmed.normalize('NFKD');
  const withoutMarks = decomposed.replace(COMBINING_MARKS_RE, '');
  const withoutZeroWidth = withoutMarks.replace(ZERO_WIDTH_CHARS_RE, '');
  const collapsed = withoutZeroWidth.replace(WHITESPACE_RE, ' ').trim();
  if (!collapsed) return '';
  const replaced = HOMOGRAPH_PATTERN
    ? collapsed.replace(HOMOGRAPH_PATTERN, ch => HOMOGRAPH_MAP[ch] || '')
    : collapsed;
  return replaced;
}

function trimConfigValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function ensureTrailingSlash(url) {
  if (!url) return url;
  return url.endsWith('/') ? url : `${url}/`;
}

function prepareWorkerBase(rawBase) {
  const trimmed = trimConfigValue(rawBase);
  if (!trimmed) return '';
  try {
    const urlObj = new URL(trimmed);
    urlObj.search = '';
    if (!urlObj.pathname.endsWith('/')) urlObj.pathname += '/';
    return urlObj.toString();
  } catch {
    return '';
  }
}

function buildWorkerUrl(baseUrl, relativePath = '') {
  if (!baseUrl) return '';
  const segment = typeof relativePath === 'string' ? relativePath.trim() : '';
  if (!segment) return baseUrl;
  try {
    const normalized = segment.startsWith('/') ? segment.slice(1) : segment;
    const resolved = new URL(normalized, baseUrl);
    return resolved.toString();
  } catch {
    return '';
  }
}

function buildCacheBust(...parts) {
  const tokens = [];
  for (const part of parts) {
    if (typeof part === 'number') {
      if (Number.isFinite(part) && part > 0) tokens.push(String(part));
    } else {
      const value = trimConfigValue(part);
      if (value) tokens.push(value);
    }
  }
  return tokens.join('-');
}

function appendCacheBust(url, bustValue) {
  if (!url) return url;
  const trimmed = trimConfigValue(bustValue);
  if (!trimmed) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('t', trimmed);
    return u.toString();
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${encodeURIComponent(trimmed)}`;
  }
}

function resolveUpdatedAt(headers, fallback = Date.now()) {
  if (!headers || typeof headers.get !== 'function') return fallback;
  const direct = headers.get('x-avatar-updated-at') || headers.get('x-updated-at');
  if (direct) {
    const numeric = Number(direct);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    const parsed = Date.parse(direct);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const lastModified = headers.get('last-modified');
  if (lastModified) {
    const parsed = Date.parse(lastModified);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function sanitizeMapping(rawMapping) {
  const mapping = Object.create(null);
  if (!rawMapping || typeof rawMapping !== 'object') return mapping;
  for (const [rawKey, rawUrl] of Object.entries(rawMapping)) {
    const key = norm(rawKey);
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (key && url) mapping[key] = url;
  }
  return mapping;
}

function sanitizeEntries(entries) {
  const mapping = Object.create(null);
  if (!Array.isArray(entries)) return mapping;
  for (const entry of entries) {
    if (!entry || entry.length < 2) continue;
    const [nick, url] = entry;
    const key = norm(nick);
    const trimmed = typeof url === 'string' ? url.trim() : '';
    if (key && trimmed) mapping[key] = trimmed;
  }
  return mapping;
}

function parseFeedPayload(raw, headers) {
  if (!raw || typeof raw !== 'object') return null;

  let mapping = null;
  if (raw.mapping && typeof raw.mapping === 'object') {
    mapping = sanitizeMapping(raw.mapping);
  } else if (Array.isArray(raw.entries)) {
    mapping = sanitizeEntries(raw.entries);
  }

  if (!mapping) mapping = Object.create(null);
  const updatedAt = Number.isFinite(raw.updatedAt) ? raw.updatedAt : resolveUpdatedAt(headers, Date.now());
  return { mapping, updatedAt };
}

function replaceMapping(nextMapping, updatedAt) {
  state.mapping = Object.create(null);
  for (const [key, url] of Object.entries(nextMapping || {})) {
    state.mapping[key] = url;
  }
  state.updatedAt = Number.isFinite(updatedAt) ? updatedAt : Date.now();
  state.lastSync = Date.now();
}

function resolveRoot(root) {
  if (root && typeof root.querySelectorAll === 'function') return root;
  if (typeof document !== 'undefined') return document;
  return null;
}

function ensureImageElement(target) {
  if (!target) return null;
  if (target.tagName && target.tagName.toLowerCase() === 'img') return target;
  if (typeof target.querySelector === 'function') {
    const existing = target.querySelector('img[data-nick]') || target.querySelector('img.avatar') || target.querySelector('img');
    if (existing) return existing;
    const created = target.ownerDocument?.createElement('img') || document?.createElement?.('img');
    if (!created) return null;
    created.classList.add('avatar');
    target.prepend(created);
    return created;
  }
  return null;
}

function seedPlaceholder(img, nick) {
  if (!img) return;
  if (!img.referrerPolicy) img.referrerPolicy = 'no-referrer';
  img.decoding = img.decoding || 'async';
  if (!img.loading) img.loading = 'lazy';
  if (!img.alt) img.alt = nick || 'avatar';
  if (!img.getAttribute('src')) {
    img.src = AVATAR_PLACEHOLDER;
  }
}

function applyImage(img, url, bustSource) {
  if (!img) return;
  const stamp = Number.isFinite(bustSource) ? bustSource : Date.now();
  const bust = buildCacheBust(CACHE_BUST_SEED, stamp);
  const baseUrl = typeof url === 'string' && url ? url : '';
  if (!baseUrl) {
    img.onerror = null;
    img.src = AVATAR_PLACEHOLDER;
    return;
  }
  const fallback = appendCacheBust(AVATAR_PLACEHOLDER, bust) || AVATAR_PLACEHOLDER;
  const target = appendCacheBust(baseUrl, bust) || baseUrl;
  img.onerror = () => {
    img.onerror = null;
    img.src = fallback;
  };
  img.src = target;
}

function prepareTarget(node) {
  const img = ensureImageElement(node);
  if (!img) return null;

  const containerNick = typeof node?.dataset?.nick === 'string' ? node.dataset.nick : '';
  const imageNick = typeof img.dataset?.nick === 'string' ? img.dataset.nick : '';
  const rawNick = imageNick || containerNick || '';
  const trimmed = rawNick.trim();

  if (node !== img && containerNick !== trimmed) {
    if (trimmed) node.dataset.nick = trimmed;
    else delete node.dataset.nick;
  }

  if (imageNick !== trimmed) {
    if (trimmed) img.dataset.nick = trimmed;
    else delete img.dataset.nick;
  }

  const key = norm(trimmed);
  if (key) img.dataset.nickKey = key;
  else delete img.dataset.nickKey;

  seedPlaceholder(img, trimmed);
  return { img, nick: trimmed, key };
}

function collectTargets(scope) {
  const seen = new Set();
  const result = [];

  scope.querySelectorAll('img[data-nick]').forEach(img => {
    const entry = prepareTarget(img);
    if (entry && !seen.has(entry.img)) {
      seen.add(entry.img);
      result.push(entry);
    }
  });

  scope.querySelectorAll('[data-nick]:not(img)').forEach(node => {
    const entry = prepareTarget(node);
    if (entry && !seen.has(entry.img)) {
      seen.add(entry.img);
      result.push(entry);
    }
  });

  return result;
}

async function loadFeed({ fresh = false } = {}) {
  if (feedPromise) {
    if (!fresh || feedPromiseIsFresh) return feedPromise;
  }

  if (!fresh && state.lastSync && Date.now() - state.lastSync < 30_000) {
    return state.mapping;
  }

  const request = (async () => {
    if (!FEED_ENDPOINT) return state.mapping;

    const bust = buildCacheBust(CACHE_BUST_SEED, fresh ? Date.now() : '');
    const targetUrl = appendCacheBust(FEED_ENDPOINT, bust);

    let response;
    try {
      response = await fetch(targetUrl, {
        method: 'GET',
        headers: { ...AV_HEADERS, 'Cache-Control': 'no-cache' }
      });
    } catch (err) {
      console.warn('[avatars] feed fetch failed', err);
      return state.mapping;
    }

    if (!response || !response.ok) {
      console.warn('[avatars] feed status', response?.status);
      return state.mapping;
    }

    let data = null;
    try {
      data = await response.json();
    } catch (err) {
      console.warn('[avatars] feed parse failed', err);
      data = null;
    }

    const parsed = parseFeedPayload(data, response.headers);
    if (parsed) {
      replaceMapping(parsed.mapping, parsed.updatedAt);
      const size = Object.keys(state.mapping).length;
      console.log(`[avatars] feed size=${size} updatedAt=${state.updatedAt}`);
    }

    return state.mapping;
  })();

  feedPromise = request;
  feedPromiseIsFresh = fresh;

  try {
    return await request;
  } finally {
    if (feedPromise === request) {
      feedPromise = null;
      feedPromiseIsFresh = false;
    }
  }
}

async function fetchAvatarRecord(nick, { fresh = false } = {}) {
  const original = typeof nick === 'string' ? nick.trim() : '';
  const key = norm(original);
  if (!key) {
    return { url: '', updatedAt: Date.now() };
  }

  if (!fresh) {
    const cached = state.mapping[key];
    if (cached) return { url: cached, updatedAt: state.updatedAt || Date.now() };
    if (nickRequests.has(key)) return nickRequests.get(key);
  }

  if (!AVATAR_ENDPOINT) {
    return { url: '', updatedAt: Date.now() };
  }

  const request = (async () => {
    const bust = buildCacheBust(CACHE_BUST_SEED, Date.now());
    const target = appendCacheBust(`${AVATAR_ENDPOINT}${encodeURIComponent(original)}`, bust);

    let response;
    try {
      response = await fetch(target, {
        method: 'GET',
        headers: { ...AV_HEADERS, 'Cache-Control': 'no-cache' }
      });
    } catch (err) {
      console.warn('[avatars] nick fetch failed', err);
      return { url: '', updatedAt: Date.now() };
    }

    if (!response || !response.ok) {
      console.warn('[avatars] nick status', response?.status);
      return { url: '', updatedAt: Date.now() };
    }

    let data = null;
    try {
      data = await response.json();
    } catch (err) {
      console.warn('[avatars] nick parse failed', err);
      data = null;
    }

    const rawUrl = data && typeof data.url === 'string' ? data.url.trim() : '';
    const updatedAtCandidate = Number.isFinite(data?.updatedAt) ? data.updatedAt : resolveUpdatedAt(response.headers, Date.now());
    if (rawUrl) {
      state.mapping[key] = rawUrl;
      state.updatedAt = Math.max(state.updatedAt, updatedAtCandidate);
      state.lastSync = Date.now();
    }

    return { url: rawUrl, updatedAt: updatedAtCandidate };
  })();

  nickRequests.set(key, request);
  try {
    return await request;
  } finally {
    if (nickRequests.get(key) === request) {
      nickRequests.delete(key);
    }
  }
}

async function resolveMiss(entry, fallbackBust) {
  const record = await fetchAvatarRecord(entry.nick);
  const url = record?.url || '';
  const bust = Number.isFinite(record?.updatedAt) ? record.updatedAt : fallbackBust;
  if (entry.key && url) entry.img.dataset.nickKey = entry.key;
  applyImage(entry.img, url, bust);
}

export async function renderAllAvatars(root) {
  const scope = resolveRoot(root);
  if (!scope) return;

  const targets = collectTargets(scope);
  if (!targets.length) return;

  await loadFeed({ fresh: false });

  const fallbackBust = state.updatedAt || Date.now();
  const pending = [];

  for (const entry of targets) {
    if (!entry.key) {
      applyImage(entry.img, '', fallbackBust);
      continue;
    }

    const url = state.mapping[entry.key];
    if (url) {
      applyImage(entry.img, url, state.updatedAt);
      continue;
    }

    if (!AVATAR_ENDPOINT) {
      applyImage(entry.img, '', fallbackBust);
      continue;
    }

    pending.push(resolveMiss(entry, fallbackBust));
  }

  if (pending.length) {
    await Promise.allSettled(pending);
  }
}

export async function reloadAvatars(options = {}) {
  const { root = undefined, fresh = false } = options || {};
  await loadFeed({ fresh: Boolean(fresh) });
  await renderAllAvatars(root);
}

export function getAvatarUrlSync(nick) {
  const key = norm(nick);
  if (!key) return '';
  return state.mapping[key] || '';
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', () => {
    renderAllAvatars(document).catch(err => {
      console.warn('[avatars] initial render failed', err);
    });
  });
}

