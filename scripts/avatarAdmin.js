// scripts/avatarAdmin.js
import { uploadAvatar, getAvatarURL } from './api.js';

function isAdminMode(){
  return localStorage.getItem('admin') === 'true';
}

export function initAvatarAdmin(players){
  const section = document.getElementById('avatar-admin');
  if(!section) return;
  if(!isAdminMode()){
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');
  const listEl = document.getElementById('avatar-list');
  if(!listEl) return;
  listEl.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    const img = document.createElement('img');
    img.className = 'avatar-img';
    img.dataset.nick = p.nick;
    img.src = getAvatarURL(p.nick);
    img.onerror = () => { img.src = 'https://via.placeholder.com/40'; };
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', e => {
      const file = e.target.files[0];
      if(!file) return;
      img.src = URL.createObjectURL(file);
      uploadAvatar(p.nick, file).then(() => {
        img.src = getAvatarURL(p.nick);
        localStorage.setItem('avatarRefresh', Date.now().toString());
      });
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
    });
  }
});
