// scripts/avatarAdmin.js
import { uploadAvatar, getAvatarURL, getDefaultAvatarURL } from './api.js';

let pending = {};

export function initAvatarAdmin(players){
  const section = document.getElementById('avatar-admin');
  if(!section) return;
  const listEl = document.getElementById('avatar-list');
  const saveBtn = document.getElementById('save-avatars');
  if(!listEl || !saveBtn) return;
  pending = {};
  saveBtn.disabled = true;
  listEl.innerHTML = '';
  saveBtn.onclick = async () => {
    const entries = Object.entries(pending);
    for(const [nick,obj] of entries){
      await uploadAvatar(nick, obj.file);
      obj.img.src = getAvatarURL(nick);
    }
    if(entries.length){
      localStorage.setItem('avatarRefresh', Date.now().toString());
    }
    pending = {};
    saveBtn.disabled = true;
  };
  players.forEach(p => {
    const li = document.createElement('li');
    const img = document.createElement('img');
    img.className = 'avatar-img';
    img.dataset.nick = p.nick;
    img.src = getAvatarURL(p.nick);
    img.onerror = () => {
      img.onerror = () => { img.src = 'https://via.placeholder.com/40'; };
      img.src = getDefaultAvatarURL(p.nick);
    };
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', e => {
      const file = e.target.files[0];
      if(!file) return;
      img.src = URL.createObjectURL(file);
      pending[p.nick] = { file, img };
      saveBtn.disabled = false;
    });
    li.appendChild(img);
    const span = document.createElement('span');
    span.textContent = p.nick;
    li.appendChild(span);
    li.appendChild(input);
    listEl.appendChild(li);
  });
}

window.addEventListener('storage', e => {
  if(e.key === 'avatarRefresh'){
    document.querySelectorAll('#avatar-list img.avatar-img[data-nick]').forEach(img => {
      img.src = getAvatarURL(img.dataset.nick);
      img.onerror = () => {
        img.onerror = () => { img.src = 'https://via.placeholder.com/40'; };
        img.src = getDefaultAvatarURL(img.dataset.nick);
      };
    });
  }
});
