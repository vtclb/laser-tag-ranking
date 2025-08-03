import { loadPlayers, getAvatarURL, uploadAvatar, fetchPlayerGames, requestAbonement } from './api.js';

let gameLimit = 0;
let gamesLeftEl = null;

function showError(msg){
  const container = document.getElementById('profile');
  container.style.display = 'none';
  let err = document.getElementById('profile-error');
  if(!err){
    err = document.createElement('div');
    err.id = 'profile-error';
    err.style.color = '#f39c12';
    err.style.textAlign = 'center';
    err.style.marginTop = '1rem';
    document.querySelector('nav').insertAdjacentElement('afterend', err);
    err.innerHTML = `\n      <p>${msg}</p>\n      <div style="margin-top:0.5rem;">\n        <input type="text" id="retry-nick" placeholder="Введіть нік" style="padding:0.5rem;border:2px solid #555;background:rgba(0,0,0,0.5);color:#fff;border-radius:4px;font-size:0.7rem;"/>\n        <button id="retry-search" style="margin-left:0.5rem;">Пошук</button>\n      </div>\n      <p style="margin-top:0.5rem;"><a href="index.html" style="color:#ffd700;">На головну</a></p>\n    `;
    document.getElementById('retry-search').addEventListener('click', ()=>{
      const val = document.getElementById('retry-nick').value.trim();
      if(val) location.href = `profile.html?nick=${encodeURIComponent(val)}`;
    });
  } else {
    err.querySelector('p').textContent = msg;
    err.style.display = 'block';
  }
}

function updateGamesLeft(used){
  if(!gamesLeftEl) return;
  const left = Math.max(gameLimit - used, 0);
  gamesLeftEl.textContent = `Залишилось ${left} із ${gameLimit} ігор`;
}

function renderGames(list, league, nick){
  const tbody = document.getElementById('games-body');
  const filterVal = document.getElementById('date-filter').value;
  tbody.innerHTML = '';
  list
    .filter(g=>!filterVal || (g.Timestamp && g.Timestamp.startsWith(filterVal)))
    .forEach(g=>{
      const d = new Date(g.Timestamp);
      const dateStr = isNaN(d)?'':d.toISOString().split('T')[0];
      const id = g.ID || g.Id || g.GameID || g.game_id || g.gameId || '';
      const tr=document.createElement('tr');
      const tdD=document.createElement('td');
      tdD.textContent=dateStr;
      const tdId=document.createElement('td');
      tdId.textContent=id;
      const tdPdf=document.createElement('td');
      const pdfUrl = `/pdfs/${league}/${dateStr}/${id}.pdf`;
      const btn=document.createElement('button');
      btn.textContent='Переглянути звіт';
      btn.addEventListener('click',()=>window.open(pdfUrl,'_blank'));
      tdPdf.appendChild(btn);
      tr.appendChild(tdD); tr.appendChild(tdId); tr.appendChild(tdPdf);
      tbody.appendChild(tr);
      fetch(pdfUrl,{method:'HEAD'})
        .then(res=>{if(!res.ok){btn.disabled=true;btn.textContent='Звіт відсутній';}})
        .catch(()=>{btn.disabled=true;btn.textContent='Звіт відсутній';});
    });
  updateGamesLeft(list.length);
}

async function init(){
  const params = new URLSearchParams(location.search);
  const nick = params.get('nick');
  if(!nick){
    showError('Нік не вказано');
    return;
  }
  let player=null, league='';
  for(const l of ['kids','sunday']){
    try{
      const players = await loadPlayers(l);
      player = players.find(p=>p.nick===nick);
      if(player){ league=l; break; }
    }catch(err){/* ignore */}
  }
  if(!player){
    showError('Гравця не знайдено');
    return;
  }
  document.getElementById('avatar').src = getAvatarURL(nick);
  document.getElementById('rating').textContent = `Рейтинг: ${player.pts} (${player.rank})`;
  document.getElementById('abonement-type').textContent = `Абонемент: ${player.abonement}`;

  gameLimit = {standart:5, vip:10}[player.abonement] || 0;
  gamesLeftEl = document.getElementById('games-left');
  if(!gamesLeftEl){
    gamesLeftEl = document.createElement('div');
    gamesLeftEl.id = 'games-left';
    gamesLeftEl.style.marginTop = '0.5rem';
    const filterEl = document.querySelector('.filter');
    filterEl.parentNode.insertBefore(gamesLeftEl, filterEl);
  }
  const reqBtn = document.getElementById('request-abonement');
  if(player.abonement === 'none'){
    reqBtn.style.display='block';
    reqBtn.addEventListener('click', async ()=>{
      reqBtn.disabled=true;
      try{
        await requestAbonement(nick);
        reqBtn.textContent='Запит відправлено';
      }catch(err){
        reqBtn.disabled=false;
        alert('Помилка запиту');
      }
    });
  }
  const fileInput = document.getElementById('avatar-input');
  document.getElementById('change-avatar').addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',async()=>{
    const file=fileInput.files[0];
    if(!file) return;
    const ok = await uploadAvatar(nick,file);
    if(ok){
      document.getElementById('avatar').src = getAvatarURL(nick);
      localStorage.setItem('avatarRefresh', Date.now());
    } else {
      alert('Помилка завантаження');
    }
  });

  let games=[];
  try{ games = await fetchPlayerGames(nick, league); }catch(err){ games=[]; }
  games = new Proxy(games, {
    set(target, prop, value){
      target[prop] = value;
      if(prop !== 'length') renderGames(target, league, nick);
      return true;
    }
  });
  renderGames(games, league, nick);
  document.getElementById('date-filter').addEventListener('change',()=>renderGames(games,league,nick));
}

document.addEventListener('DOMContentLoaded', init);

window.addEventListener('storage', e => {
  if(e.key === 'avatarRefresh'){
    const params = new URLSearchParams(location.search);
    const nick = params.get('nick');
    if(nick){
      document.getElementById('avatar').src = getAvatarURL(nick);
    }
  }
});
