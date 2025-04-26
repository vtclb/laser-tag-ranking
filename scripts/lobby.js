// scripts/lobby.js
import { sortByName, sortByPtsDesc } from './sortUtils.js';
import { initTeams, teams }         from './teams.js';

export let lobby = [];
let players = [], selected = [], manualCount = 0;

export function initLobby(pList) {
  players = pList;
  selected = [];
  lobby    = [];
  manualCount = 0;
  renderSelect(players);
}

function renderSelect(arr) {
  document.getElementById('select-area').classList.remove('hidden');
  document.getElementById('lobby-area').classList.add('hidden');

  const ul = document.getElementById('select-list');
  ul.innerHTML = arr.map((p,i) => {
    const disabled = lobby.includes(p) ? 'disabled' : '';
    return `
      <li>
        <label>
          <input type="checkbox" data-i="${i}" ${disabled}>
          ${p.nick} (${p.pts}) – ${p.rank}
        </label>
      </li>`;
  }).join('');

  ul.querySelectorAll('input').forEach(cb => {
    cb.onchange = () => {
      const p = arr[+cb.dataset.i];
      if (cb.checked) selected.push(p);
      else selected = selected.filter(x=>x!==p);
    };
  });
}

document.getElementById('btn-sort-name').onclick = () => renderSelect(sortByName(players));
document.getElementById('btn-sort-pts').onclick  = () => renderSelect(sortByPtsDesc(players));

document.getElementById('btn-add-selected').onclick = () => {
  selected.forEach(p => { if (!lobby.includes(p)) lobby.push(p); });
  selected = [];
  renderLobby();
  renderSelect(players);
};

document.getElementById('btn-clear-selected').onclick = () => {
  selected = [];
  renderSelect(players);
};

export function setManualCount(n) {
  manualCount = n;
  if (lobby.length) renderLobby();
}

function renderLobby() {
  document.getElementById('select-area').classList.add('hidden');
  document.getElementById('lobby-area').classList.remove('hidden');

  const ul = document.getElementById('lobby-list');
  ul.innerHTML = lobby.map((p,i) => {
    let btns = '';
    for (let k=1; k<=manualCount; k++) {
      btns += `<button class="assign" data-i="${i}" data-team="${k}">→${k}</button>`;
    }
    return `<li>${p.nick} (${p.pts}) – ${p.rank} ${btns}</li>`;
  }).join('');

  // Підрахунок
  const total = lobby.reduce((sum,p)=>sum+p.pts,0);
  document.getElementById('lobby-count').textContent = lobby.length;
  document.getElementById('lobby-sum').textContent   = total;
  document.getElementById('lobby-avg').textContent   = lobby.length ? (total/lobby.length).toFixed(1) : 0;

  // bind clear-lobby
  const btnClearLobby = document.getElementById('btn-clear-lobby');
  btnClearLobby.onclick = () => { lobby=[]; renderLobby(); };

  // bind assignment buttons
  ul.querySelectorAll('.assign').forEach(btn => {
    btn.onclick = () => {
      const i = +btn.dataset.i, t = +btn.dataset.team;
      const p = lobby.splice(i,1)[0];
      teams[t].push(p);
      renderLobby();
      initTeams(manualCount, teams);
    };
  });
}
