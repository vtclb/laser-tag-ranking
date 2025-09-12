import { AVATARS_CSV_URL, AVATAR_PLACEHOLDER } from './config.js';

export async function fetchCsv(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('CSV fetch failed: ' + res.status);
  const text = await res.text();
  const lines = text.trim().split('\n').filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const obj = {};
    header.forEach((h, i) => { obj[h] = (cols[i] ?? '').trim(); });
    return obj;
  });
}

export function normalizeAvatarUrl(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('//')) return 'https:' + u;
  if (!/^https?:/.test(u)) return 'https://' + u;
  return u;
}

export function setImgSafe(img, src, placeholder = AVATAR_PLACEHOLDER) {
  if (!img) return;
  img.onerror = () => {
    img.onerror = null;
    img.src = placeholder;
  };
  img.src = src || placeholder;
}

const avatarMap = new Map();

export async function loadAvatarsMap() {
  const rows = await fetchCsv(AVATARS_CSV_URL);
  avatarMap.clear();
  rows.forEach(r => {
    const nick = String(r.nick || r.Nickname || r[0] || '').trim();
    const url = normalizeAvatarUrl(r.url || r.URL || r[1] || '');
    if (nick && url) avatarMap.set(nick, url);
  });
  return avatarMap;
}

export function renderAllAvatars() {
  document.querySelectorAll('img[data-nick]').forEach(img => {
    const nick = img.dataset.nick || '';
    const url = avatarMap.get(nick);
    const src = url ? url : AVATAR_PLACEHOLDER;
    setImgSafe(img, src, AVATAR_PLACEHOLDER);
  });
}
