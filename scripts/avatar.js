import { noteAvatarFailure } from './avatarAdmin.js?v=2025-09-18-12';
import { AVATAR_PLACEHOLDER } from './config.js?v=2025-09-18-12';
import { ensureAvatarMap, getAvatarUrlFromMap } from './avatars.client.js?v=2025-09-18-12';

export async function setAvatar(img, nick, size = 40) {
  if (!img) return '';
  img.dataset.nick = nick;
  img.loading = 'lazy';
  img.width = size;
  img.height = size;
  let url = '';
  try {
    await ensureAvatarMap();
    url = getAvatarUrlFromMap(nick);
  } catch (err) {
    noteAvatarFailure(nick, err);
  }
  if (!url) url = AVATAR_PLACEHOLDER;
  img.onerror = () => { img.onerror = null; img.src = AVATAR_PLACEHOLDER; };
  const src = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
  img.src = src;
  return src;
}
