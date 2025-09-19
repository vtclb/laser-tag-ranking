import { AVATAR_PLACEHOLDER } from './config.js?v=2025-09-18-12';
import { ensureAvatarMap, getAvatarUrlFromMap, nickKey } from './avatars.client.js?v=2025-09-18-12';

function appendBust(url, bust) {
  const base = (url || '').trim();
  if (!base) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}t=${bust}`;
}

export async function setAvatar(img, nick, size = 40) {
  if (!img) return '';
  const label = nick || '';
  const key = nickKey(label);
  img.dataset.nick = label;
  if (key) img.dataset.nickKey = key;
  else delete img.dataset.nickKey;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.width = size;
  img.height = size;
  if (!img.alt) img.alt = label || 'avatar';

  const bust = Date.now();
  const fallbackSrc = appendBust(AVATAR_PLACEHOLDER, bust) || AVATAR_PLACEHOLDER;
  img.onerror = () => {
    img.onerror = null;
    img.src = fallbackSrc;
  };

  let url = key ? getAvatarUrlFromMap(label) : '';
  if (!url && key) {
    try {
      await ensureAvatarMap();
      url = getAvatarUrlFromMap(label);
    } catch (err) {
      url = '';
    }
  }

  const src = url ? appendBust(url, bust) : fallbackSrc;
  img.src = src;
  return src;
}
