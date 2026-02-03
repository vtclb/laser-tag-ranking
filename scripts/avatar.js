import { AVATAR_PLACEHOLDER } from './avatarConfig.js?v=2025-09-19-avatars-2';
import { avatarNickKey } from './api.js?v=2025-09-19-avatars-2';
import { renderAllAvatars } from './avatars.client.js?v=2025-09-19-avatars-2';

export async function setAvatar(img, nick, { width, height } = {}) {
  if (!img) return;

  const label = typeof nick === 'string' ? nick : '';
  if (label) img.dataset.nick = label;
  else delete img.dataset.nick;
  if (label) img.dataset.nickKey = avatarNickKey(label);
  else delete img.dataset.nickKey;

  img.referrerPolicy = 'no-referrer';
  img.decoding = 'async';
  img.loading = 'lazy';
  if (typeof width === 'number') img.width = width;
  if (typeof height === 'number') img.height = height;
  if (!img.alt) img.alt = label || 'avatar';

  img.onerror = () => {
    img.onerror = null;
    img.src = AVATAR_PLACEHOLDER;
  };
  img.src = AVATAR_PLACEHOLDER;

  await renderAllAvatars();
}
