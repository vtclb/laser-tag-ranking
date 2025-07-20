// scripts/avatarAdmin.js
import { uploadAvatar, getAvatarURL, getProxyAvatarURL, getDefaultAvatarURL } from './api.js';

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
    console.error('Failed to load default avatars', err);
  }
}

let pending = {};
let currentLeague = '';
export async function initAvatarAdmin(players, league=''){
  currentLeague = league;
  const section = document.getElementById('avatar-admin');
  if(!section) return;
  const listEl = document.getElementById('avatar-list');
  const saveAvBtn = document.getElementById('save-avatars');
  if(!listEl || !saveAvBtn) return;
  pending = {};
  saveAvBtn.disabled = true;
  listEl.innerHTML = '';
  await loadDefaultAvatars();
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

    const thumbs = document.createElement('div');
    thumbs.className = 'avatar-thumbs';
    defaultAvatars.forEach(src => {
      const t = document.createElement('img');
      t.className = 'avatar-thumb';
      t.src = src;
      t.addEventListener('click', async () => {
        thumbs.querySelectorAll('.avatar-thumb').forEach(el => el.classList.remove('selected'));
        t.classList.add('selected');
        try{
          const resp = await fetch(src);
          const blob = await resp.blob();
          img.src = src;
          pending[p.nick] = { file: blob, img };
          saveAvBtn.disabled = false;
        }catch(err){
          console.error('Failed to fetch avatar', err);
        }
      });
      thumbs.appendChild(t);
    });

    li.appendChild(img);
    const span = document.createElement('span');
    span.textContent = p.nick;
    li.appendChild(span);
    li.appendChild(input);
    li.appendChild(thumbs);
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
