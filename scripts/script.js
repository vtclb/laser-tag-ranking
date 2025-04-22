const sheetUrls = {
  kids:   "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1648067737&single=true&output=csv",
  sunday: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1286735969&single=true&output=csv"
};
let players=[], lobby=[];

// Елементи
const btnLoad = document.getElementById('btn-load');
const lobbyArea = document.getElementById('lobby-area');
const lobbyList = document.getElementById('lobby-list');
const controlArea = document.getElementById('control-area');
const modeSelect = document.getElementById('mode');
const sizeSelect = document.getElementById('teamsize');
const btnBalance = document.getElementById('btn-balance');
const teamsArea = document.getElementById('teams-area');
const team1List = document.getElementById('team1-list');
const team2List = document.getElementById('team2-list');
const team1Sum = document.getElementById('team1-sum');
const team2Sum = document.getElementById('team2-sum');
const winnerSel = document.getElementById('winner');
const mvpSel = document.getElementById('mvp');
const penaltyInput = document.getElementById('penalty');
const btnSave = document.getElementById('btn-save');
const btnRefresh = document.getElementById('btn-refresh');

btnLoad.addEventListener('click', loadPlayers);
btnBalance.addEventListener('click', runBalance);
btnSave.addEventListener('click', exportResults);
btnRefresh.addEventListener('click', loadPlayers);

function loadPlayers(){
  const league=document.getElementById('league').value;
  const url=sheetUrls[league]+'&t='+Date.now();
  fetch(url).then(r=>r.text()).then(txt=>{
    const rows=txt.trim().split('\n').slice(1);
    players=rows.map(r=>{const c=r.split(',');return {nick:c[1]?.trim(),pts:+c[2]||0};}).filter(p=>p.nick);
    renderLobby();
  });
}

function renderLobby(){
  lobbyArea.classList.remove('hidden');
  controlArea.classList.remove('hidden');
  teamsArea.classList.add('hidden');
  lobbyList.innerHTML=players.map((p,i)=>
    `<li><label><input type="checkbox" value="${i}" onchange="toggleLobby(${i})"> ${p.nick} (${p.pts})</label></li>`
  ).join('');
  lobby=[];
}

function toggleLobby(idx){
  const i=lobby.indexOf(players[idx]);
  if(i>=0) lobby.splice(i,1); else lobby.push(players[idx]);
}

function runBalance(){
  if(modeSelect.value==='auto') autoBalance(); else manualBalance();
}

function autoBalance(){
  const opt=sizeSelect.value;
  let subset=lobby;
  if(opt!=='all'){subset=lobby.slice(0,opt*2);}  
  const best=getBest(subset);
  displayTeams(best.team1,best.team2);
}

function manualBalance(){
  // просто переносимо усіх підрозділяємо навпіл
  const mid=Math.ceil(lobby.length/2);
  displayTeams(lobby.slice(0,mid),lobby.slice(mid));
}

function getBest(arr){
  let best,md=Infinity;
  const tot=1<<arr.length;
  for(let m=1;m<tot-1;m++){
    let t1=[],t2=[];
    arr.forEach((p,i)=>m&(1<<i)?t1.push(p):t2.push(p));
    if(Math.abs(t1.length-t2.length)>1)continue;
    const d=Math.abs(sum(t1)-sum(t2));
    if(d<md){md=d;best={team1:t1,team2:t2}};
  }
  return best;
}

function sum(a){return a.reduce((s,p)=>(s+p.pts),0);}

function displayTeams(t1,t2){
  teamsArea.classList.remove('hidden');
  team1List.innerHTML=t1.map(p=>`<li>${p.nick} (${p.pts})</li>`).join('');
  team2List.innerHTML=t2.map(p=>`<li>${p.nick} (${p.pts})</li>`).join('');
  team1Sum.textContent=sum(t1);
  team2Sum.textContent=sum(t2);
  winnerSel.innerHTML=`<option>Нічия</option>${[...t1,...t2].map(p=>`<option>${p.nick}</option>`).join('')}`;
}

function exportResults(){
  const data={
    league:document.getElementById('league').value,
    team1:team1List.innerText.replace(/\n/g,', '),
    team2:team2List.innerText.replace(/\n/g,', '),
    winner: winnerSel.value,
    mvp: mvpSel.value,
    penalties: penaltyInput.value
  };
  const body=Object.entries(data).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  fetch('https://laser-proxy.vartaclub.workers.dev',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body})
    .then(r=>r.text()).then(t=>alert('Result: '+t));
}
