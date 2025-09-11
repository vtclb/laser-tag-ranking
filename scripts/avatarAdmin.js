// scripts/avatarAdmin.js
import { log } from './logger.js';
import { uploadAvatar, clearFetchCache, getAvatarUrl, avatarSrcFromRecord } from './api.js';
import { setAvatar } from './avatar.js';

const DEFAULT_AVATAR_URL = 'assets/default_avatars/av0.png';

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
      img.src = URL.createObjectURL(file);
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
          img.src = src + '?t=' + Date.now();
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
      const img = row.querySelector('img.avatar-img');
      try {
        const url = await uploadAvatar(nick, file);
        img.src = url + '?t=' + Date.now();
        avatarFailures.delete(nick);
        clearFetchCache(`avatar:${nick}`);
        localStorage.setItem('avatarRefresh', nick + ':' + Date.now());
        row.querySelector('input[type="file"]').value = '';
      } catch (err) {
        log('[ranking]', err);
        failed.push(nick);
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

async function refreshAvatars(nick){
  const sel = nick ? `#avatar-list img[data-nick="${nick}"]` : '#avatar-list img[data-nick]';
  const imgs = document.querySelectorAll(sel);
  for(const img of imgs){
    try{
      const rec = await getAvatarUrl(img.dataset.nick);
      img.src = rec ? avatarSrcFromRecord(rec) : DEFAULT_AVATAR_URL;
    }catch{
      img.src = DEFAULT_AVATAR_URL;
    }
  }
}

window.addEventListener('storage', e => {
  if(e.key === 'avatarRefresh') {
    const [nick] = (e.newValue || '').split(':');
    if(nick) clearFetchCache(`avatar:${nick}`);
    refreshAvatars(nick);
  }
});
