import { AVATAR_PLACEHOLDER } from './config.js?v=2025-09-19-avatars-2';
import { fetchAvatarsMap } from './api.js?v=2025-09-19-avatars-2';

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
  const escaped = chars
    .map(ch => ch.replace(/[\\\]\[\-]/g, '\\$&'))
    .join('');
  return new RegExp(`[${escaped}]`, 'gu');
})();

const state = {
  mapping: Object.create(null),
  updatedAt: 0,
  source: 'none'
};

let pendingPromise = null;
let pendingIsFresh = false;

function cloneMapping(rawMapping) {
  const mapping = Object.create(null);
  if (!rawMapping || typeof rawMapping !== 'object') return mapping;
  for (const [key, value] of Object.entries(rawMapping)) {
    if (typeof value !== 'string') continue;
    mapping[key] = value;
  }
  return mapping;
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
    const existing = target.querySelector('img.avatar') || target.querySelector('img');
    if (existing) return existing;
    const created = target.ownerDocument?.createElement('img') || document?.createElement?.('img');
    if (!created) return null;
    created.classList.add('avatar');
    target.prepend(created);
    return created;
  }
  return null;
}

function seedPlaceholder(node) {
  const img = ensureImageElement(node);
  if (!img) return null;
  img.referrerPolicy = 'no-referrer';
  img.decoding = 'async';
  if (!img.loading) img.loading = 'lazy';
  if (!img.alt) img.alt = node?.dataset?.nick || 'avatar';
  img.onerror = () => {
    img.onerror = null;
    img.src = AVATAR_PLACEHOLDER;
  };
  if (!img.getAttribute('src')) {
    img.src = AVATAR_PLACEHOLDER;
  }
  return img;
}

function withBust(src, bust) {
  if (!src) return src;
  if (/^(?:data|blob):/i.test(src)) return src;
  const value = Number.isFinite(bust) ? bust : bust ? Number(bust) : 0;
  if (!value) return src;
  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}t=${value}`;
}

function applyImage(img, url, bust) {
  if (!img) return;
  const base = typeof url === 'string' && url ? url : AVATAR_PLACEHOLDER;
  const bustValue = Number.isFinite(bust) ? bust : Date.now();
  const fallback = withBust(AVATAR_PLACEHOLDER, bustValue) || AVATAR_PLACEHOLDER;
  const nextSrc = withBust(base, bustValue) || AVATAR_PLACEHOLDER;
  img.onerror = () => {
    img.onerror = null;
    img.src = fallback;
  };
  img.src = nextSrc;
}

export function normalizeNick(value) {
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

export async function fetchMap({ fresh = false } = {}) {
  if (pendingPromise) {
    if (!fresh || pendingIsFresh) {
      return pendingPromise;
    }
  }

  const request = (async () => {
    let result;
    try {
      result = await fetchAvatarsMap({ force: fresh });
    } catch (err) {
      result = null;
    }

    const mapping = cloneMapping(result?.mapping);
    state.mapping = mapping;
    state.updatedAt = Number.isFinite(result?.updatedAt) ? result.updatedAt : Date.now();
    state.source = typeof result?.source === 'string' && result.source ? result.source : 'proxy';

    if (!result) {
      state.source = 'error';
    }

    const size = Object.keys(state.mapping).length;
    console.log(`[avatars] source=${state.source} size=${size}`);

    return {
      mapping: state.mapping,
      updatedAt: state.updatedAt,
      source: state.source
    };
  })();

  pendingPromise = request;
  pendingIsFresh = fresh;

  try {
    return await request;
  } finally {
    if (pendingPromise === request) {
      pendingPromise = null;
      pendingIsFresh = false;
    }
  }
}

export function getLocalAvatarUrl(value) {
  const key = normalizeNick(value);
  if (!key) return '';
  return state.mapping[key] || '';
}

export async function renderAllAvatars(root) {
  const scope = resolveRoot(root);
  if (!scope) return;

  const nodes = Array.from(scope.querySelectorAll('[data-nick]'));
  if (!nodes.length) return;

  const prepared = nodes.map(node => {
    const rawNick = typeof node.dataset.nick === 'string' ? node.dataset.nick : '';
    const trimmedNick = rawNick.trim();
    if (trimmedNick !== rawNick) node.dataset.nick = trimmedNick;
    const normalized = normalizeNick(trimmedNick);
    const img = seedPlaceholder(node);
    if (img) {
      if (trimmedNick) img.dataset.nick = trimmedNick;
      if (normalized) img.dataset.nickKey = normalized;
      else delete img.dataset.nickKey;
    }
    return { node, img, normalized, raw: trimmedNick };
  });

  const { updatedAt } = await fetchMap({ fresh: false });
  const bust = Number.isFinite(updatedAt) ? updatedAt : Date.now();

  prepared.forEach(entry => {
    if (!entry.img) return;
    const url = entry.normalized ? getLocalAvatarUrl(entry.normalized) : '';
    applyImage(entry.img, url, bust);
  });
}

export async function reloadAvatars(options = {}) {
  const { root = undefined, fresh = false } = options || {};
  await fetchMap({ fresh: Boolean(fresh) });
  await renderAllAvatars(root);
}

export function updateOneAvatar(nick, url, bust) {
  const normalized = normalizeNick(nick);
  if (!normalized) return;

  const safeUrl = typeof url === 'string' ? url : '';
  state.mapping[normalized] = safeUrl;

  const bustValue = Number.isFinite(bust) ? bust : Date.now();
  if (Number.isFinite(bust)) {
    state.updatedAt = Math.max(state.updatedAt, bustValue);
  }

  const scope = resolveRoot(document);
  if (!scope) return;

  const nodes = Array.from(scope.querySelectorAll('[data-nick]'));
  nodes.forEach(node => {
    const rawNick = typeof node.dataset.nick === 'string' ? node.dataset.nick : '';
    if (!rawNick) return;
    const normalizedNick = normalizeNick(rawNick);
    if (!normalizedNick || normalizedNick !== normalized) return;
    const img = seedPlaceholder(node);
    if (!img) return;
    img.dataset.nick = rawNick;
    img.dataset.nickKey = normalized;
    applyImage(img, safeUrl, bustValue);
  });

  const keyedImages = Array.from(scope.querySelectorAll('img[data-nick-key]'));
  keyedImages.forEach(img => {
    const currentKey = typeof img.dataset.nickKey === 'string' ? img.dataset.nickKey : '';
    if (currentKey !== normalized) return;
    if (img.closest('[data-nick]')) return;
    img.dataset.nickKey = normalized;
    applyImage(img, safeUrl, bustValue);
  });
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', () => {
    renderAllAvatars(document).catch(err => {
      console.warn('[avatars] initial render failed', err);
    });
  });
}
