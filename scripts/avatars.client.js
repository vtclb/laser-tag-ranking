import { AVATARS_SHEET_ID, AVATARS_GID, AVATAR_PLACEHOLDER } from './config.js?v=2025-09-30-01';

export const nickKey = value => String(value || '').trim().toLowerCase();

const jsonUrl = `https://docs.google.com/spreadsheets/d/${AVATARS_SHEET_ID}/gviz/tq?tqx=out:json&gid=${AVATARS_GID}`;
const csvUrl = `https://docs.google.com/spreadsheets/d/${AVATARS_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${AVATARS_GID}`;

let mapPromise = null; // Promise<Map<string, string>>

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

async function fetchMap() {
  try {
    return await fetchMapFromJson();
  } catch (err) {
    console.warn('[avatars]', err);
    try {
      return await fetchMapFromCsv();
    } catch (csvErr) {
      console.error('[avatars]', csvErr);
      return new Map();
    }
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

export async function renderAllAvatars({ bust } = {}) {
  const map = await (mapPromise ??= fetchMap());
  document.querySelectorAll('img[data-nick]').forEach(img => {
    const key = nickKey(img.dataset.nick);
    const src = key ? map.get(key) : '';
    applyAvatar(img, src, bust);
  });
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
