import { sortByName, sortByPtsDesc } from './sortUtils.js';

const selArea = document.getElementById('select-area'),
      selList = document.getElementById('select-list'),
      btnSortName = document.getElementById('btn-sort-name'),
      btnSortPts  = document.getElementById('btn-sort-pts'),
      btnAddSel   = document.getElementById('btn-add-selected'),
      btnClearSel = document.getElementById('btn-clear-selected'),
      lobbyArea   = document.getElementById('lobby-area'),
      lobbyList   = document.getElementById('lobby-list'),
      cntEl       = document.getElementById('lobby-count'),
      sumEl       = document.getElementById('lobby-sum'),
      avgEl       = document.getElementById('lobby-avg'),
      btnClearL   = document.getElementById('btn-clear-lobby');

let players=[], selected=[], lobby=[];

export function initLobby(pList){
  players=pList; selected=[]; lobby=[];
  renderSelect(players);
}

function renderSelect(arr){
  selArea.classList.remove('hidden');
  lobbyArea.classList.add('hidden');
  selList.innerHTML = arr.map((p,i)=>
    `<li><label><input type="checkbox" data-index="${i}"/> ${p.nick} (${p.pts}) – ${p.rank}</label></li>`
  ).join('');
  selList.querySelectorAll('input').forEach(cb=>{
    cb.onchange=e=>{
      const pl=players[+e.target.dataset.index];
      if(e.target.checked) selected.push(pl);
      else selected = selected.filter(x=>x!==pl);
    };
  });
}

btnSortName.onclick = ()=> renderSelect(sortByName(players));
btnSortPts.onclick  = ()=> renderSelect(sortByPtsDesc(players));

btnAddSel.onclick = ()=>{
  selected.forEach(p=>{ if(!lobby.includes(p)) lobby.push(p); });
  renderLobby();
};
btnClearSel.onclick = ()=>{
  selected=[]; selList.querySelectorAll('input').forEach(cb=>cb.checked=false);
};
btnClearL.onclick = ()=>{ lobby=[]; renderLobby(); };

function renderLobby(){
  selArea.classList.add('hidden');
  lobbyArea.classList.remove('hidden');
  lobbyList.innerHTML = lobby.map(p=>`<li>${p.nick} (${p.pts}) – ${p.rank}</li>`).join('');
  const total = lobby.reduce((s,p)=>s+p.pts,0);
  cntEl.textContent = lobby.length;
  sumEl.textContent = total;
  avgEl.textContent = lobby.length ? (total/lobby.length).toFixed(1) : 0;
}

export { lobby };
