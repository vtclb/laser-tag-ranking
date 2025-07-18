// scripts/avatarAdmin.js
import { uploadAvatar, getAvatarURL, getDefaultAvatarURL, saveGender } from './api.js';

let pending = {};
let genderChanges = {};

export function initAvatarAdmin(players){
  const section = document.getElementById('avatar-admin');
  if(!section) return;
  const listEl = document.getElementById('avatar-list');
  const saveBtn = document.getElementById('save-avatars');
  if(!listEl || !saveBtn) return;
  pending = {};
  genderChanges = {};
  saveBtn.disabled = true;
  listEl.innerHTML = '';
  saveBtn.onclick = async () => {
    const entries = Object.entries(pending);
    const genderEntries = Object.entries(genderChanges);
    for(const [nick,obj] of entries){
      await uploadAvatar(nick, obj.file);
      obj.img.src = getAvatarURL(nick);
    }
    for(const [nick,gender] of genderEntries){
      await saveGender(nick, gender);
      const img = listEl.querySelector(`img[data-nick="${nick}"]`);
      if(img) img.dataset.gender = gender;
    }
    if(entries.length || genderEntries.length){
      localStorage.setItem('avatarRefresh', Date.now().toString());
    }
    pending = {};
    genderChanges = {};
    saveBtn.disabled = true;
  };
  players.forEach(p => {
    const li = document.createElement('li');
    const img = document.createElement('img');
    img.className = 'avatar-img';
    img.dataset.nick = p.nick;
    if(p.gender) img.dataset.gender = p.gender;
    img.src = getAvatarURL(p.nick);
    img.onerror = () => {
      img.onerror = () => { img.src = 'https://via.placeholder.com/40'; };
      img.src = getDefaultAvatarURL(p.gender);
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

    const genderSel = document.createElement('select');
    const optM = document.createElement('option');
    optM.value = 'male';
    optM.textContent = 'Male';
    const optF = document.createElement('option');
    optF.value = 'female';
    optF.textContent = 'Female';
    genderSel.appendChild(optM);
    genderSel.appendChild(optF);
    genderSel.value = p.gender || '';
    genderSel.addEventListener('change', e => {
      genderChanges[p.nick] = e.target.value;
      saveBtn.disabled = false;
    });

    li.appendChild(img);
    const span = document.createElement('span');
    span.textContent = p.nick;
    li.appendChild(span);
    li.appendChild(input);
    li.appendChild(genderSel);
    listEl.appendChild(li);
  });
}

window.addEventListener('storage', e => {
  if(e.key === 'avatarRefresh'){
    document.querySelectorAll('#avatar-list img.avatar-img[data-nick]').forEach(img => {
      img.src = getAvatarURL(img.dataset.nick);
      img.onerror = () => {
        img.onerror = () => { img.src = 'https://via.placeholder.com/40'; };
        img.src = getDefaultAvatarURL(img.dataset.gender);
      };
    });
  }
});
