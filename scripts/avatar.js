import { log } from './logger.js';
import { getAvatarUrl, avatarSrcFromRecord } from './api.js';

const DEFAULT_AVATAR_URL = 'assets/default_avatars/av0.png';
const avatarFailures = new Set();

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
      avatarFailures.delete(nick);
    } catch (err) {
      if (!avatarFailures.has(nick)) {
        log('[ranking]', err);
        avatarFailures.add(nick);
      }
    }
  }
  const src = rec ? avatarSrcFromRecord(rec) : DEFAULT_AVATAR_URL;
  img.src = src;
  img.onerror = () => {
    img.onerror = null;
    img.src = DEFAULT_AVATAR_URL;
  };
  return src;
}
