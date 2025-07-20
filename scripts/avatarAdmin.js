// scripts/avatarAdmin.js
import { uploadAvatar, getAvatarURL, getProxyAvatarURL, getDefaultAvatarURL } from './api.js';

let pending = {};
let currentLeague = '';
export function initAvatarAdmin(players, league=''){
  currentLeague = league;
  const section = document.getElementById('avatar-admin');
  if(!section) return;
  const listEl = document.getElementById('avatar-list');
  const saveAvBtn = document.getElementById('save-avatars');
  if(!listEl || !saveAvBtn) return;
  pending = {};
  saveAvBtn.disabled = true;
  listEl.innerHTML = '';
  saveAvBtn.onclick = async () => {
    const entries = Object.entries(pending);
    const failed = [];
    for(const [nick,obj] of entries){
      const success = await uploadAvatar(nick, obj.file);
      if(!success) failed.push(nick);
      obj.img.src = getAvatarURL(nick);
    }
    if(entries.length){
      localStorage.setItem('avatarRefresh', Date.now().toString());
    }
    if(failed.length){
      alert('Failed to upload avatars for: '+failed.join(', '));
    }
    pending = {};
    saveAvBtn.disabled = true;
  };

  players.forEach(p => {
    const li = document.createElement('li');
    const img = document.createElement('img');
    img.className = 'avatar-img';
    img.dataset.nick = p.nick;
    img.src = getAvatarURL(p.nick);
    img.onerror = () => {
      img.onerror = () => {
        img.onerror = () => { img.src = 'https://via.placeholder.com/40'; };
        img.src = getDefaultAvatarURL();
      };
      img.src = getProxyAvatarURL(p.nick);
    };
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', e => {
      const file = e.target.files[0];
      if(!file) return;
      img.src = URL.createObjectURL(file);
      pending[p.nick] = { file, img };
      saveAvBtn.disabled = false;
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
        img.onerror = () => {
          img.onerror = () => { img.src = 'https://via.placeholder.com/40'; };
          img.src = getDefaultAvatarURL();
        };
        img.src = getProxyAvatarURL(img.dataset.nick);
      };
    });
  }
});
