import { initTeams } from './teams.js';
import { sortByName, sortByPtsDesc } from './sortUtils.js';

export let lobby = [];
let players = [], selected = [], manualCount = 0;

export function initLobby(pl) {
  players = pl; selected = []; lobby = []; manualCount = 0;
  renderSelect(players);
}

function renderSelect(arr) {
  document.getElementById('select-area').classList.remove('hidden');
  document.getElementById('lobby-area').classList.add('hidden');
  const ul = document.getElementById('select-list');
  ul.innerHTML = arr.map((p,i)=>`
    <li>
      <label>
        <input type="checkbox" data-i="${i}" ${lobby.includes(p)?'disabled':''}>
        ${p.nick} (${p.pts}) – ${p.rank}
      </label>
    </li>`).join('');
  ul.querySelectorAll('input').forEach(cb=>{
    cb.onchange = ()=>{
      const p = arr[+cb.dataset.i];
      cb.checked ? selected.push(p) : selected = selected.filter(x=>x!==p);
    };
  });
}

document.getElementById('btn-sort-name').onclick = ()=>{
  renderSelect(sortByName(players));
};
document.getElementById('btn-sort-pts').onclick = ()=>{
  renderSelect(sortByPtsDesc(players));
};

document.getElementById('btn-add-selected').onclick = ()=>{
  selected.forEach(p=>{ if(!lobby.includes(p)) lobby.push(p); });
  selected=[]; renderLobby(); renderSelect(players);
};

document.getElementById('btn-clear-selected').onclick = ()=>{
  selected=[]; renderSelect(players);
};

export function setManualCount(n) {
  manualCount = n;
  if (lobby.length) renderLobby();
}

function renderLobby() {
  document.getElementById('select-area').classList.add('hidden');
  document.getElementById('lobby-area').classList.remove('hidden');
  const tbody = document.getElementById('lobby-list');
  tbody.innerHTML = lobby.map((p,i)=>`
    <tr>
      <td>${p.nick}</td><td>${p.pts}</td><td>${p.rank}</td>
      <td>${[...Array(manualCount)].map((_,k)=>
        `<button class="assign" data-i="${i}" data-team="${k+1}">→${k+1}</button>`
      ).join('')}</td>
    </tr>`).join('');
  const sum = lobby.reduce((s,p)=>s+p.pts,0);
  document.getElementById('lobby-count').textContent = lobby.length;
  document.getElementById('lobby-sum').textContent   = sum;
  document.getElementById('lobby-avg').textContent   = lobby.length? (sum/lobby.length).toFixed(1):0;

  document.getElementById('btn-clear-lobby').onclick = ()=>{
    lobby=[]; renderLobby();
  };

  tbody.querySelectorAll('.assign').forEach(btn=>{
    btn.onclick = ()=>{
      const i = +btn.dataset.i, t = +btn.dataset.team;
      const p = lobby.splice(i,1)[0];
      initTeams(manualCount, {[t]: [...(window.teams[t]||[]), p]});
      renderLobby();
    };
  });
}
