import { initTeams } from './teams.js';
import { autoBalance2, autoBalanceN } from './balanceUtils.js';
import { lobby, setManualCount } from './lobby.js';

const scenarioArea   = document.getElementById('scenario-area');
const btnAuto        = document.getElementById('btn-auto');
const btnManual      = document.getElementById('btn-manual');
const teamSizeSel    = document.getElementById('teamsize');
const arenaSelect    = document.getElementById('arena-select');
const arenaCheckboxes= document.getElementById('arena-checkboxes');
const btnStart       = document.getElementById('btn-start-match');

export function initScenario(){
  scenarioArea.classList.remove('hidden');
}

function renderArenaCheckboxes(){
  arenaCheckboxes.innerHTML = '';
  document.querySelectorAll('.team-select').forEach(cb=>{
    const id = cb.dataset.team;
    arenaCheckboxes.innerHTML +=
      `<label><input type="checkbox" class="arena-team" data-team="${id}"> Команда ${id}</label>`;
  });
}

function updateStartButton(){
  const cnt = document.querySelectorAll('.arena-team:checked').length;
  btnStart.disabled = cnt!==2;
}

btnAuto.onclick = ()=>{
  const n = +teamSizeSel.value;
  setManualCount(n);
  const data = n===2
    ? (()=>{const {A,B}=autoBalance2(lobby); return {1:A,2:B}})()
    : autoBalanceN(lobby,n).reduce((o,a,i)=>(o[i+1]=a,o),{});
  initTeams(n,data);
  arenaSelect.classList.remove('hidden');
  renderArenaCheckboxes();
  updateStartButton();
};

btnManual.onclick = ()=>{
  const n = +teamSizeSel.value;
  setManualCount(n);
  initTeams(n,{});
  arenaSelect.classList.remove('hidden');
  renderArenaCheckboxes();
  updateStartButton();
};

arenaCheckboxes.addEventListener('change', updateStartButton);
