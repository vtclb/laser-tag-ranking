import { loadPlayers, getAvatarURL, uploadAvatar, fetchPlayerGames } from './api.js';

function showError(msg){
  const container = document.getElementById('profile');
  container.innerHTML = `<p style="color:#f39c12;text-align:center;">${msg}</p>`;
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
      const a=document.createElement('a');
      a.textContent='PDF';
      a.href=`/pdfs/${league}/${dateStr}/${id}.pdf`;
      a.target='_blank';
      tdPdf.appendChild(a);
      tr.appendChild(tdD); tr.appendChild(tdId); tr.appendChild(tdPdf);
      tbody.appendChild(tr);
    });
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
  document.getElementById('abonement-type').textContent = `Абонемент: ${player.abonement_type}`;
  const reqBtn = document.getElementById('request-abonement');
  if(player.abonement_type === 'none'){
    reqBtn.style.display='block';
    reqBtn.addEventListener('click', async ()=>{
      reqBtn.disabled=true;
      try{
        await fetch('https://script.google.com/macros/s/AKfycbzjdoEtN8HsBFRGyme184NIGsZuCPyCPPtHNXU_PnJhoDi3mUVT40XnwzR90KHDa9J8pg/exec',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({action:'abonement_request',nick})
        });
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
  try{ games = await fetchPlayerGames(); }catch(err){ games=[]; }
  const playerGames = games.filter(g=>{
    if(g.League && g.League!==league) return false;
    const teams=[g.Team1,g.Team2,g.Team3,g.Team4];
    return teams.some(t=> (t||'').split(',').map(s=>s.trim()).includes(nick));
  });
  renderGames(playerGames, league, nick);
  document.getElementById('date-filter').addEventListener('change',()=>renderGames(playerGames,league,nick));
}

document.addEventListener('DOMContentLoaded', init);
