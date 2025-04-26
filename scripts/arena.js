import { saveResult } from './api.js';
import { teams }      from './teams.js';

const arenaArea   = document.getElementById('arena-area');
const arenaVS     = document.getElementById('arena-vs');
const arenaRounds = document.getElementById('arena-rounds');
const btnStart    = document.getElementById('btn-start-match');
const btnSave     = document.getElementById('btn-save-match');
const btnClear    = document.getElementById('btn-clear-arena');
const leagueSel   = document.getElementById('league');

btnStart.addEventListener('click', () => {
  const [a,b] = [...document.querySelectorAll('.team-select:checked')]
    .map(cb=>+cb.dataset.team);
  arenaVS.textContent = `Команда ${a} ✕ Команда ${b}`;
  arenaArea.classList.remove('hidden');
  renderRounds(a,b);
});

function renderRounds(a,b) {
  arenaRounds.innerHTML = '';
  for (let i=1;i<=3;i++) {
    const div = document.createElement('div');
    div.innerHTML = `
      <h4>Раунд ${i}</h4>
      <label><input type="checkbox" class="r${i}-a"> T${a}</label>
      <label><input type="checkbox" class="r${i}-b"> T${b}</label>
    `;
    arenaRounds.append(div);
  }
  // save/clear
  btnSave.disabled = false;
  btnSave.onclick = () => saveMatch(a,b);
  btnClear.onclick = clearArena;
}

async function saveMatch(a,b) {
  let winsA=0,winsB=0;
  for (let i=1;i<=3;i++){
    if (arenaRounds.querySelector(`.r${i}-a`).checked) winsA++;
    if (arenaRounds.querySelector(`.r${i}-b`).checked) winsB++;
  }
  const series = `${winsA}-${winsB}`;
  const winner = winsA>winsB?`team${a}`:winsB>winsA?`team${b}`:'tie';
  await saveResult({
    league: leagueSel.value,
    team1: teams[a].map(p=>p.nick).join(', '),
    team2: teams[b].map(p=>p.nick).join(', '),
    winner,mvp:'',series,penalties:''
  });
  alert('Гру збережено');
  clearArena();
}

function clearArena() {
  arenaArea.classList.add('hidden');
  arenaRounds.innerHTML = '';
  document.querySelectorAll('.team-select').forEach(cb=>{
    cb.checked = false;
  });
  btnSave.disabled = true;
}
