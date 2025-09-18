import { getAvatarUrl } from './api.js?v=2025-09-18-3';
import { noteAvatarFailure } from './avatarAdmin.js?v=2025-09-18-3';
import { AVATAR_PLACEHOLDER } from './config.js?v=2025-09-18-3';
export async function setAvatar(img, nick, size = 40) {
  if (!img) return '';
  img.dataset.nick = nick;
  img.loading = 'lazy';
  img.width = size;
  img.height = size;
  let rec;
  for (let attempt = 0; attempt < 2 && !rec; attempt++) {
    try {
      rec = await getAvatarUrl(nick);
    } catch (err) {
      noteAvatarFailure(nick, err);
    }
  }
  const url = rec && rec.url ? rec.url : AVATAR_PLACEHOLDER;
  img.onerror = () => { img.onerror = null; img.src = AVATAR_PLACEHOLDER; };
  const src = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
  img.src = src;
  return src;
}
