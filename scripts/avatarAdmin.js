// scripts/avatarAdmin.js
import { uploadAvatar, getAvatarURL, getProxyAvatarURL, getDefaultAvatarURL, saveGender, loadGenders } from './api.js';

let pending = {};
let genderChanges = {};
let currentLeague = '';
export function initAvatarAdmin(players, league=''){
  currentLeague = league;
  const section = document.getElementById('avatar-admin');
  if(!section) return;
  const listEl = document.getElementById('avatar-list');
  const saveAvBtn = document.getElementById('save-avatars');
  const saveGenderBtn = document.getElementById('save-genders');
  if(!listEl || !saveAvBtn || !saveGenderBtn) return;
  pending = {};
  genderChanges = {};
  saveAvBtn.disabled = true;
  saveGenderBtn.disabled = true;
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

  saveGenderBtn.onclick = async () => {
    const genderEntries = Object.entries(genderChanges);
    for(const [nick,gender] of genderEntries){
      await saveGender(nick, gender, currentLeague);
      const img = listEl.querySelector(`img[data-nick="${nick}"]`);
      if(img) img.dataset.gender = gender;
    }
    if(genderEntries.length){
      localStorage.setItem('genderRefresh', Date.now().toString());
    }
    genderChanges = {};
    saveGenderBtn.disabled = true;
  };
  players.forEach(p => {
    const li = document.createElement('li');
    const img = document.createElement('img');
    img.className = 'avatar-img';
    img.dataset.nick = p.nick;
    if(p.gender) img.dataset.gender = p.gender;
    img.src = getAvatarURL(p.nick);
    img.onerror = () => {
      img.onerror = () => {
        img.onerror = () => { img.src = 'https://via.placeholder.com/40'; };
        img.src = getDefaultAvatarURL(p.gender);
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

    const genderSel = document.createElement('select');
    const optM = document.createElement('option');
    optM.value = 'male';
    optM.textContent = 'Male';
    const optF = document.createElement('option');
    optF.value = 'female';
    optF.textContent = 'Female';
    const optN = document.createElement('option');
    optN.value = 'neutral';
    optN.textContent = 'Neutral';
    genderSel.appendChild(optM);
    genderSel.appendChild(optF);
    genderSel.appendChild(optN);
    genderSel.value = p.gender || 'neutral';
    genderSel.addEventListener('change', e => {
      genderChanges[p.nick] = e.target.value;
      saveGenderBtn.disabled = false;
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
        img.onerror = () => {
          img.onerror = () => { img.src = 'https://via.placeholder.com/40'; };
          img.src = getDefaultAvatarURL(img.dataset.gender);
        };
        img.src = getProxyAvatarURL(img.dataset.nick);
      };
    });
  }
  if(e.key === 'genderRefresh'){
    (async () => {
      const genders = await loadGenders();
      document.querySelectorAll('#avatar-list img.avatar-img[data-nick]').forEach(img => {
        const g = genders[img.dataset.nick];
        if(g) img.dataset.gender = g;
      });
    })();
  }
});
