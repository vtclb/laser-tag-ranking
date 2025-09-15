// scripts/avatarAdmin.js
import { log } from './logger.js';
import { uploadAvatar } from './api.js';
import { setAvatar } from './avatar.js';
import { renderAllAvatars } from './avatars.readonly.js';

const DEFAULT_AVATAR_URL = 'assets/default_avatars/av0.png';

export let avatarFailures = 0;

export function noteAvatarFailure(nick, reason) {
  avatarFailures++;
  const msg = `Avatar issue for ${nick}: ${reason}`;
  console.warn(msg);
  if (typeof showToast === 'function') showToast(msg);
}

export function normalizeAvatarUrl(url = '') {
  if (!url) return DEFAULT_AVATAR_URL;
  if (url.includes('drive.google.com')) {
    const idMatch = url.match(/[?&]id=([^&]+)/) || url.match(/\/d\/([^/]+)/);
    if (idMatch) {
      return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w512`;
    }
  }
  return url;
}

export function setImgSafe(img, url) {
  if (!img) return;
  const src = normalizeAvatarUrl(url);
  img.referrerPolicy = 'no-referrer';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.onerror = () => { img.onerror = null; img.src = DEFAULT_AVATAR_URL; };
  const cacheSafe = src.startsWith('data:') || src.startsWith('blob:');
  const finalSrc = cacheSafe ? src : src + (src.includes('?') ? '&' : '?') + 't=' + Date.now();
  img.src = finalSrc;
}

export function applyAvatarToUI(nick, imageUrl) {
  const url = imageUrl || DEFAULT_AVATAR_URL;
  const preview = document.querySelector(`#avatar-list .avatar-row[data-nick="${nick}"] img.avatar-img`);
  if (preview) setImgSafe(preview, url);
  document.querySelectorAll(`img[data-nick="${nick}"]`).forEach(img => {
    if (img !== preview) setImgSafe(img, url);
  });
}

let defaultAvatars = [];
async function loadDefaultAvatars(path = 'assets/default_avatars/list.json'){
  if(defaultAvatars.length) return;
  try{
    const res = await fetch(path);
    if(res.ok){
      const list = await res.json();
      defaultAvatars = list.map(f => `assets/default_avatars/${f}`);
    }
  }catch(err){
    log('[ranking]', err);
    const msg = 'Failed to load default avatars';
    if (typeof showToast === 'function') showToast(msg); else alert(msg);
  }
}

let currentLeague = '';
export async function initAvatarAdmin(players = [], league = '') {
  currentLeague = league;
  const section = document.getElementById('avatar-admin');
  if (!section) return;
  const listEl = document.getElementById('avatar-list');
  const saveAvBtn = document.getElementById('save-avatars');
  const statusEl = document.getElementById('avatar-status');
  if (!listEl || !saveAvBtn) return;
  listEl.innerHTML = '';
  if (statusEl) {
    statusEl.textContent = '';
    statusEl.classList.add('hidden');
  }
  await loadDefaultAvatars();

  // create rows for players
  players.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = 'avatar-row';
    tr.dataset.nick = p.nick;

    const imgTd = document.createElement('td');
    const img = document.createElement('img');
    img.className = 'avatar-img';
    img.alt = p.nick;
    img.dataset.nick = p.nick;
    setAvatar(img, p.nick);
    imgTd.appendChild(img);

    const nickTd = document.createElement('td');
    nickTd.textContent = p.nick;

    const inputTd = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return updateSaveBtn();
      if (file.size > 2 * 1024 * 1024) {
        const msg = 'File too large (max 2MB)';
        if (typeof showToast === 'function') showToast(msg); else alert(msg);
        input.value = '';
        return updateSaveBtn();
      }
      setImgSafe(img, URL.createObjectURL(file));
      updateSaveBtn();
    });
    inputTd.appendChild(input);

    const thumbsTd = document.createElement('td');
    const thumbs = document.createElement('div');
    thumbs.className = 'avatar-thumbs';
    defaultAvatars.forEach(src => {
      const t = document.createElement('img');
      t.className = 'avatar-thumb';
      t.alt = 'avatar';
      t.loading = 'lazy';
      t.width = 40;
      t.height = 40;
      t.src = src;
      t.addEventListener('click', async () => {
        thumbs.querySelectorAll('.avatar-thumb').forEach(el => el.classList.remove('selected'));
        t.classList.add('selected');
        try {
          const resp = await fetch(src);
          const blob = await resp.blob();
          const dt = new DataTransfer();
          dt.items.add(new File([blob], 'avatar.png', { type: blob.type }));
          input.files = dt.files;
          setImgSafe(img, src);
          updateSaveBtn();
        } catch (err) {
          log('[ranking]', err);
          const msg = 'Failed to fetch avatar';
          if (typeof showToast === 'function') showToast(msg); else alert(msg);
        }
      });
      thumbs.appendChild(t);
    });
    thumbsTd.appendChild(thumbs);

    tr.appendChild(imgTd);
    tr.appendChild(nickTd);
    tr.appendChild(inputTd);
    tr.appendChild(thumbsTd);
    listEl.appendChild(tr);
  });

  const rows = () => Array.from(document.querySelectorAll('#avatar-list .avatar-row'));

  function updateSaveBtn() {
    const hasFile = rows().some(r => r.querySelector('input[type="file"]').files[0]);
    saveAvBtn.disabled = !hasFile;
  }
  updateSaveBtn();

  saveAvBtn.onclick = async () => {
    const failed = [];
    for (const row of rows()) {
      const file = row.querySelector('input[type="file"]').files[0];
      if (!file) continue;
      if (file.size > 2 * 1024 * 1024) {
        const msg = 'File too large (max 2MB)';
        if (typeof showToast === 'function') showToast(msg); else alert(msg);
        failed.push(row.dataset.nick);
        continue;
      }
      const nick = row.dataset.nick;
      try {
        const resp = await uploadAvatar(nick, file);
        if (resp.status !== 'OK') throw new Error(resp.status);
        applyAvatarToUI(nick, resp.url);
        renderAllAvatars({ bust: resp.updatedAt });
        localStorage.setItem('avatarRefresh', nick + ':' + resp.updatedAt);
        row.querySelector('input[type="file"]').value = '';
      } catch (err) {
        log('[ranking]', err);
        failed.push(nick);
        noteAvatarFailure(nick, err?.message || err);
      }
    }
    updateSaveBtn();
    if (failed.length) {
      const msg = 'Failed to upload avatars for: ' + failed.join(', ');
      if (typeof showToast === 'function') showToast(msg); else alert(msg);
    }
    if (statusEl) {
      statusEl.textContent = 'Аватари оновлено';
      statusEl.classList.remove('hidden');
      setTimeout(() => statusEl.classList.add('hidden'), 2000);
    }
  };
}

window.addEventListener('storage', e => {
  if(e.key === 'avatarRefresh') {
    renderAllAvatars({ bust: Date.now() });
  }
});
