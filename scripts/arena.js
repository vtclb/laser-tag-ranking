import { saveResult } from './api.js';
import { teams } from './teams.js';

const arenaSelect = document.getElementById('arena-select');
const arenaChecks = document.getElementById('arena-checkboxes');
const btnStart    = document.getElementById('btn-start-match');
const arenaArea   = document.getElementById('arena-area');
const arenaVS     = document.getElementById('arena-vs');
const leagueSel   = document.getElementById('league');

export function renderArenaSelect(teamIds) {
  arenaSelect.classList.remove('hidden');
  arenaArea.classList.add('hidden');
  arenaChecks.innerHTML = teamIds.map(id =>
    `<label><input type="checkbox" class="arena-team-checkbox" data-team="${id}">Команда ${id}</label>`
  ).join('');
}

btnStart.onclick = () => {
  const checked = [...arenaChecks.querySelectorAll('.arena-team-checkbox:checked')];
  if (checked.length!==2) return alert('Виберіть дві команди');
  const [a,b] = checked.map(cb=>+cb.dataset.team);
  arenaSelect.classList.add('hidden');
  arenaArea.classList.remove('hidden');
  arenaVS.textContent = `Команда ${a} ✕ Команда ${b}`;
  renderRounds(a,b);
};

function renderRounds(a,b) {
  const rounds = document.getElementById('arena-rounds');
  rounds.innerHTML = '';
  for (let r=1;r<=3;r++) {
    const d = document.createElement('div');
    d.innerHTML = `
      <h4>Раунд ${r}</h4>
      <label><input type="checkbox" class="r${r}-a">T${a}</label>
      <label><input type="checkbox" class="r${r}-b">T${b}</label>
    `;
    rounds.append(d);
  }
  document.getElementById('btn-save-match').onclick = saveMatch.bind(null,a,b);
}

async function saveMatch(a,b) {
  const rounds = document.getElementById('arena-rounds');
  let winsA=0, winsB=0;
  for (let r=1;r<=3;r++){
    if (rounds.querySelector(`.r${r}-a`).checked) winsA++;
    if (rounds.querySelector(`.r${r}-b`).checked) winsB++;
  }
  const series = `${winsA}-${winsB}`;
  const winner = winsA>winsB?`team${a}`:winsB>winsA?`team${b}`:'tie';
  const data = {
    league: leagueSel.value,
    team1: teams[a].map(p=>p.nick).join(', '),
    team2: teams[b].map(p=>p.nick).join(', '),
    winner, mvp:'', series, penalties:''
  };
  await saveResult(data);
  alert('Результат збережено');
  clearArena();
}

function clearArena() {
  arenaArea.classList.add('hidden');
  arenaSelect.classList.remove('hidden');
  arenaChecks.querySelectorAll('input').forEach(cb=>cb.checked=false);
}
