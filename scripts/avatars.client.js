import { AVATAR_WORKER_BASE, AVATAR_PLACEHOLDER } from './avatarConfig.js';

const RAW_BASE = typeof AVATAR_WORKER_BASE === 'string' ? AVATAR_WORKER_BASE.trim() : '';
const NORMALIZED_BASE = RAW_BASE ? RAW_BASE.replace(/\/+$/, '') : '';
const FEED = NORMALIZED_BASE ? `${NORMALIZED_BASE}/avatars` : '';
const BY_NICK = FEED ? `${FEED}/` : '';

const mapping = new Map();
let lastUpdated = 0;
let feedPromise = null;
let feedPromiseIsFresh = false;
const pendingByKey = new Map();

function norm(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}

function bustUrl(url, stamp = Date.now()) {
  const base = typeof url === 'string' ? url.trim() : '';
  if (!base) return '';
  const value = typeof stamp === 'number' && Number.isFinite(stamp) ? stamp : Date.now();
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}t=${value}`;
}

function extractUpdatedAt(input) {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string') {
    const numeric = Number(input);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(input);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function resolveRoot(root) {
  if (root && typeof root.querySelectorAll === 'function') return root;
  if (typeof document !== 'undefined') return document;
  return null;
}

function ensureImageElement(node) {
  if (!node) return null;
  if (node.tagName && node.tagName.toLowerCase() === 'img') return node;
  if (typeof node.querySelector === 'function') {
    const found = node.querySelector('img.avatar')
      || node.querySelector('img[data-nick]')
      || node.querySelector('img');
    if (found) return found;
    const doc = node.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return null;
    const created = doc.createElement('img');
    created.classList.add('avatar');
    node.prepend(created);
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

function prepareTarget(node) {
  const img = ensureImageElement(node);
  if (!img) return null;

  const rawNick = (() => {
    if (typeof img.dataset?.nick === 'string' && img.dataset.nick.trim()) return img.dataset.nick;
    if (node !== img && typeof node.dataset?.nick === 'string' && node.dataset.nick.trim()) return node.dataset.nick;
    const imgAttr = typeof img.getAttribute === 'function' ? img.getAttribute('data-nick') : '';
    const nodeAttr = node !== img && typeof node.getAttribute === 'function' ? node.getAttribute('data-nick') : '';
    return imgAttr || nodeAttr || '';
  })();

  const nick = rawNick.trim();

  if (nick) {
    img.dataset.nick = nick;
    if (node !== img) node.dataset.nick = nick;
  } else {
    delete img.dataset.nick;
    if (node !== img) delete node.dataset.nick;
  }

  const key = norm(nick);
  if (key) img.dataset.nickKey = key;
  else delete img.dataset.nickKey;

  seedPlaceholder(img, nick);
  return { img, nick, key };
}

function collectTargets(scope) {
  const seen = new Set();
  const targets = [];

  scope.querySelectorAll('img[data-nick]').forEach(img => {
    const entry = prepareTarget(img);
    if (entry && !seen.has(entry.img)) {
      seen.add(entry.img);
      targets.push(entry);
    }
  });

  scope.querySelectorAll('[data-nick]:not(img)').forEach(node => {
    const entry = prepareTarget(node);
    if (entry && !seen.has(entry.img)) {
      seen.add(entry.img);
      targets.push(entry);
    }
  });

  return targets;
}

function applyFeedPayload(payload) {
  if (!payload || typeof payload !== 'object') return;

  const next = new Map();
  let shouldReplace = false;
  if (Array.isArray(payload.entries)) {
    shouldReplace = true;
    for (const entry of payload.entries) {
      if (!entry || entry.length < 2) continue;
      const key = norm(entry[0]);
      const url = typeof entry[1] === 'string' ? entry[1].trim() : '';
      if (key && url) next.set(key, url);
    }
  } else {
    const mappingSource = typeof payload.mapping === 'object' && payload.mapping
      ? payload.mapping
      : (typeof payload.avatars === 'object' && payload.avatars ? payload.avatars : null);
    if (mappingSource) {
      shouldReplace = true;
      for (const [nick, url] of Object.entries(mappingSource)) {
        const key = norm(nick);
        const value = typeof url === 'string' ? url.trim() : '';
        if (key && value) next.set(key, value);
      }
    }
  }

  if (!next.size && !Array.isArray(payload.entries) && typeof payload === 'object') {
    const fallback = Object.entries(payload).filter(([k]) => k !== 'updatedAt');
    if (fallback.length) shouldReplace = true;
    for (const [nick, url] of fallback) {
      const key = norm(nick);
      const value = typeof url === 'string' ? url.trim() : '';
      if (key && value) next.set(key, value);
    }
  }

  if (shouldReplace) {
    mapping.clear();
    for (const [key, url] of next.entries()) {
      mapping.set(key, url);
    }
  }

  const updated = extractUpdatedAt(payload.updatedAt);
  if (updated) lastUpdated = updated;
  else if (shouldReplace) lastUpdated = Date.now();
}

async function loadFeed(fresh = false) {
  if (!FEED) return mapping;
  if (!fresh && lastUpdated && !feedPromise) return mapping;

  if (feedPromise) {
    if (fresh && !feedPromiseIsFresh) {
      return feedPromise.finally(() => loadFeed(true));
    }
    return feedPromise;
  }

  const url = fresh ? bustUrl(FEED, Date.now()) : FEED;
  feedPromiseIsFresh = fresh;
  feedPromise = (async () => {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response || !response.ok) {
        console.warn('[avatars] feed status', response?.status);
        return mapping;
      }
      let data = null;
      try {
        data = await response.json();
      } catch (err) {
        console.warn('[avatars] feed parse failed', err);
        data = null;
      }
      if (data) applyFeedPayload(data);
    } catch (err) {
      console.warn('[avatars] feed fetch failed', err);
    } finally {
      feedPromise = null;
      feedPromiseIsFresh = false;
    }
    return mapping;
  })();

  return feedPromise;
}

function setImage(img, url, stamp) {
  if (!img) return;
  const cacheStamp = typeof stamp === 'number' && Number.isFinite(stamp) ? stamp : Date.now();
  const targetUrl = url ? bustUrl(url, cacheStamp) : '';
  const fallbackUrl = bustUrl(AVATAR_PLACEHOLDER, cacheStamp) || AVATAR_PLACEHOLDER;
  img.onerror = () => {
    img.onerror = null;
    img.src = fallbackUrl;
  };
  img.src = targetUrl || fallbackUrl;
}

async function fetchAvatarForEntry(entry) {
  if (!entry || !entry.key || !entry.nick || !BY_NICK) {
    setImage(entry?.img, '', lastUpdated);
    return;
  }

  if (mapping.has(entry.key)) {
    setImage(entry.img, mapping.get(entry.key), lastUpdated);
    return;
  }

  if (pendingByKey.has(entry.key)) {
    await pendingByKey.get(entry.key);
    const cached = mapping.get(entry.key) || '';
    setImage(entry.img, cached, lastUpdated);
    return;
  }

  const request = (async () => {
    const url = bustUrl(`${BY_NICK}${encodeURIComponent(entry.nick)}`, Date.now());
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response || !response.ok) {
        console.warn('[avatars] nick status', response?.status);
        return;
      }
      let data = null;
      try {
        data = await response.json();
      } catch (err) {
        console.warn('[avatars] nick parse failed', err);
        data = null;
      }
      const resolvedUrl = typeof data?.url === 'string' ? data.url.trim() : '';
      const updated = extractUpdatedAt(data?.updatedAt) || Date.now();
      if (resolvedUrl) {
        mapping.set(entry.key, resolvedUrl);
        lastUpdated = updated;
        setImage(entry.img, resolvedUrl, updated);
        return;
      }
    } catch (err) {
      console.warn('[avatars] nick fetch failed', err);
    }
    setImage(entry.img, '', Date.now());
  })();

  pendingByKey.set(entry.key, request);
  try {
    await request;
  } finally {
    if (pendingByKey.get(entry.key) === request) {
      pendingByKey.delete(entry.key);
    }
  }
}

export async function renderAllAvatars(root = typeof document !== 'undefined' ? document : undefined) {
  const scope = resolveRoot(root);
  if (!scope) return;

  const targets = collectTargets(scope);
  if (!targets.length) {
    console.log('[avatars] imgs=0');
    return;
  }

  await loadFeed(false);

  const jobs = [];
  for (const entry of targets) {
    if (!entry.key) {
      setImage(entry.img, '', lastUpdated);
      continue;
    }

    const cached = mapping.get(entry.key) || '';
    if (cached) {
      setImage(entry.img, cached, lastUpdated);
      continue;
    }

    jobs.push(fetchAvatarForEntry(entry));
  }

  if (jobs.length) {
    await Promise.allSettled(jobs);
  }

  console.log(`[avatars] imgs=${targets.length}`);
}

export async function reloadAvatars(root = typeof document !== 'undefined' ? document : undefined) {
  await loadFeed(true);
  await renderAllAvatars(root);
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', () => {
    renderAllAvatars(document).catch(err => {
      console.warn('[avatars] initial render failed', err);
    });
  });
}
