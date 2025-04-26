// scripts/lobby.js
import { sortByName, sortByPtsDesc } from './sortUtils.js';
import { initTeams, teams }         from './teams.js';

export let lobby = [];              // Ось тут ми експортуємо lobby

const selArea     = document.getElementById('select-area');
const selList     = document.getElementById('select-list');
const btnSortName = document.getElementById('btn-sort-name');
const btnSortPts  = document.getElementById('btn-sort-pts');
const btnAddSel   = document.getElementById('btn-add-selected');
const btnClearSel = document.getElementById('btn-clear-selected');

const lobbyArea   = document.getElementById('lobby-area');
const lobbyList   = document.getElementById('lobby-list');
const cntEl       = document.getElementById('lobby-count');
const sumEl       = document.getElementById('lobby-sum');
const avgEl       = document.getElementById('lobby-avg');

let players = [], selected = [], manualTeamsCount = 0;

export function initLobby(pList) {
  players = pList;
  selected = [];
  lobby    = [];
 renderSelect(players);
}

function renderSelect(arr) {
  selArea.classList.remove('hidden');
  lobbyArea.classList.add('hidden');
  selList.innerHTML = arr.map((p,i) => {
    const disabled = lobby.includes(p) ? 'disabled' : '';
    return `
      <li>
        <label>
          <input type="checkbox" data-index="${i}" ${disabled}/>
          ${p.nick} (${p.pts}) – ${p.rank}
        </label>
      </li>`;
  }).join('');
  selList.querySelectorAll('input').forEach(cb => {
    cb.onchange = e => {
      const pl = players[+e.target.dataset.index];
      if (e.target.checked) selected.push(pl);
      else selected = selected.filter(x => x !== pl);
    };
  });
}

btnSortName.onclick = () => renderSelect(sortByName(players));
btnSortPts.onclick  = () => renderSelect(sortByPtsDesc(players));

btnAddSel.onclick = () => {
  selected.forEach(p => {
    if (!lobby.includes(p)) lobby.push(p);
  });
  selected = [];
  renderLobby();
  renderSelect(players);
};
btnClearSel.onclick = () => {
  selected = [];
  selList.querySelectorAll('input').forEach(cb => cb.checked = false);
};

export function setManualCount(n) {
  manualTeamsCount = n;
  if (lobby.length) renderLobby();
}

function renderLobby() {
  selArea.classList.add('hidden');
  lobbyArea.classList.remove('hidden');
  lobbyList.innerHTML = lobby.map((p,i) => {
    let buttons = '';
    for (let k = 1; k <= manualTeamsCount; k++) {
      buttons += `<button class="assign-team" data-index="${i}" data-team="${k}">→${k}</button>`;
    }
    return `<li>${p.nick} (${p.pts}) – ${p.rank}${buttons}</li>`;
  }).join('');
  const total = lobby.reduce((s,p) => s + p.pts, 0);
  cntEl.textContent = lobby.length;
  sumEl.textContent = total;
  avgEl.textContent = lobby.length ? (total/lobby.length).toFixed(1) : 0;
}

lobbyList.addEventListener('click', e => {
  if (e.target.matches('.assign-team')) {
    const i = +e.target.dataset.index;
    const t = +e.target.dataset.team;
    const p = lobby.splice(i,1)[0];
    teams[t].push(p);
    renderLobby();
    initTeams(manualTeamsCount, teams);
  }
});
