import { sortByName, sortByPtsDesc } from './sortUtils.js';
import { initTeams, teams } from './teams.js';

const selArea      = document.getElementById('select-area');
const selList      = document.getElementById('select-list');
const btnSortName  = document.getElementById('btn-sort-name');
const btnSortPts   = document.getElementById('btn-sort-pts');
const btnAddSel    = document.getElementById('btn-add-selected');
const btnClearSel  = document.getElementById('btn-clear-selected');

const lobbyArea    = document.getElementById('lobby-area');
const lobbyList    = document.getElementById('lobby-list');
const cntEl        = document.getElementById('lobby-count');
const sumEl        = document.getElementById('lobby-sum');
const avgEl        = document.getElementById('lobby-avg');
const btnClearL    = document.getElementById('btn-clear-lobby');

let players = [], selected = [], lobby = [], manualTeamsCount = 0;

export function initLobby(pList) {
  players = pList;
  selected = [];
  lobby    = [];
  manualTeamsCount = 0;
  renderSelect(players);
}

function renderSelect(arr) {
  selArea.classList.remove('hidden');
  lobbyArea.classList.add('hidden');
  selList.innerHTML = arr.map((p,i)=>
    `<li>
      <label>
        <input type="checkbox" data-index="${i}"/>
        ${p.nick} (${p.pts}) – ${p.rank}
      </label>
    </li>`
  ).join('');
  selList.querySelectorAll('input').forEach(cb=>{
    cb.onchange = e => {
      const pl = players[+e.target.dataset.index];
      if (e.target.checked) selected.push(pl);
      else selected = selected.filter(x=>x!==pl);
    };
  });
}

btnSortName.onclick = ()=> renderSelect(sortByName(players));
btnSortPts.onclick  = ()=> renderSelect(sortByPtsDesc(players));

btnAddSel.onclick = ()=>{
  selected.forEach(p=>{
    if (!lobby.includes(p)) lobby.push(p);
  });
  renderLobby();
};
btnClearSel.onclick = ()=>{
  selected = [];
  selList.querySelectorAll('input').forEach(cb=>cb.checked=false);
};

btnClearL.onclick = ()=>{
  lobby = [];
  renderLobby();
};

// Єдиний рендер лоббі — адаптивно додає кнопки «→k» та «✕»
function renderLobby() {
  selArea.classList.add('hidden');
  lobbyArea.classList.remove('hidden');

  lobbyList.innerHTML = lobby.map((p,i)=>{
    // Кнопки для кожної команди
    let controls = '';
    for (let k = 1; k <= manualTeamsCount; k++) {
      controls += `<button class="assign-team" data-index="${i}" data-team="${k}">→${k}</button>`;
    }
    controls += `<button class="remove-lobby" data-index="${i}">✕</button>`;
    return `<li>${p.nick} (${p.pts}) – ${p.rank}${controls}</li>`;
  }).join('');

  // Підрахунок статистики
  const total = lobby.reduce((s,p)=>s+p.pts, 0);
  cntEl.textContent = lobby.length;
  sumEl.textContent = total;
  avgEl.textContent = lobby.length ? (total/lobby.length).toFixed(1) : 0;
}

// Обробник кнопок у лоббі
lobbyList.addEventListener('click', e => {
  const el = e.target;
  if (el.matches('.assign-team')) {
    const idx = +el.dataset.index;
    const teamId = +el.dataset.team;
    const p = lobby.splice(idx,1)[0];
    teams[teamId].push(p);
    renderLobby();
    // Показати команди
    initTeams(manualTeamsCount, teams);
  }
  if (el.matches('.remove-lobby')) {
    const idx = +el.dataset.index;
    lobby.splice(idx,1);
    renderLobby();
  }
});

// Викликається з scenario.js, задає кількість команд для ручного режиму
export function enableManual(count) {
  manualTeamsCount = count;
  renderLobby();
}

export { lobby };
