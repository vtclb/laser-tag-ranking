// scripts/avatarAdmin.js
import { uploadAvatar, getAvatarUrl } from './api.js';

const AVATAR_TTL = 6 * 60 * 60 * 1000;


=======
const DEFAULT_AVATAR_URL = 'assets/default_avatars/av0.png';


async function fetchAvatar(nick){
  const key = `avatar:${nick}`;
  const now = Date.now();
  try{
    const cached = JSON.parse(sessionStorage.getItem(key) || 'null');
    if(cached && now - cached.time < AVATAR_TTL) return cached.url;
  }catch{}
  try{
    const url = await getAvatarUrl(nick);
    sessionStorage.setItem(key, JSON.stringify({ url, time: now }));
    return url;
  }catch{
    return null;
  }
}

async function setAvatar(img, nick){
  img.dataset.nick = nick;
  const url = await fetchAvatar(nick);
  if(url){
    img.src = `${url}?t=${Date.now()}`;
  }else{
    img.src = DEFAULT_AVATAR_URL;
  }
  img.onerror = () => {
    img.onerror = null;
    img.src = DEFAULT_AVATAR_URL;
  };
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
  const statusEl = document.getElementById('avatar-status');
  if(!listEl || !saveAvBtn) return;
  pending = {};
  saveAvBtn.disabled = true;
  listEl.innerHTML = '';
  if(statusEl){
    statusEl.textContent = '';
    statusEl.classList.add('hidden');
  }
  await loadDefaultAvatars();
  saveAvBtn.onclick = async () => {
    const entries = Object.entries(pending);
    const failed = [];
    for(const [nick,obj] of entries){
      try{
        const url = await uploadAvatar(nick, obj.file);
        obj.img.src = `${url}?t=${Date.now()}`;
        localStorage.setItem('avatarRefresh', nick + ':' + Date.now());
      }catch{
        failed.push(nick);
      }
    }
    if(failed.length){
      alert('Failed to upload avatars for: '+failed.join(', '));
    }
    pending = {};
    saveAvBtn.disabled = true;
    if(statusEl){
      statusEl.textContent = 'Аватари оновлено';
      statusEl.classList.remove('hidden');
      setTimeout(()=>statusEl.classList.add('hidden'), 2000);
    }
  };

  players.forEach(p => {
    const li = document.createElement('li');
    const img = document.createElement('img');
    img.className = 'avatar-img';
    img.alt = p.nick;
    img.dataset.nick = p.nick;
    setAvatar(img, p.nick);
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
      t.alt = 'avatar';
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

function refreshAvatars(nick){
  const sel = nick ? `#avatar-list img.avatar-img[data-nick="${nick}"]` : '#avatar-list img.avatar-img[data-nick]';
  document.querySelectorAll(sel).forEach(img => {
    setAvatar(img, img.dataset.nick);
  });
}

window.addEventListener('storage', e => {
  if(e.key === 'avatarRefresh') {
    const [nick] = (e.newValue || '').split(':');
    refreshAvatars(nick);
  }
});
