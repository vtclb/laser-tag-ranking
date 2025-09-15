import { setAvatar } from './avatar.js';

export async function renderAllAvatars() {
  const imgs = document.querySelectorAll('img[data-nick]');
  const tasks = Array.from(imgs).map(img => {
    const nick = img.dataset.nick || '';
    if (!img.alt) img.alt = nick || 'avatar';
    return setAvatar(img, nick, img.width || 40);
  });
  await Promise.all(tasks);
}

