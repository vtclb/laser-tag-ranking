import { getAvatarUrl } from './api.js';
import { noteAvatarFailure } from './avatarAdmin.js';

const DEFAULT_AVATAR_URL = 'assets/default_avatars/av0.png';
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
  const url = rec && rec.url ? rec.url : DEFAULT_AVATAR_URL;
  img.onerror = () => { img.onerror = null; img.src = DEFAULT_AVATAR_URL; };
  const src = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
  img.src = src;
  return src;
}
