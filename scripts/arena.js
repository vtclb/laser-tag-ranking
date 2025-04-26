import { saveResult } from './api.js';
import { teams } from './teams.js';

const arenaSelect = document.getElementById('arena-select');
const arenaChecks = document.getElementById('arena-checkboxes');
const arenaArea   = document.getElementById('arena-area');
const arenaVS     = document.getElementById('arena-vs');
const arenaRounds = document.getElementById('arena-rounds');

export function renderArenaSelect(teamIds) {
  arenaSelect.classList.remove('hidden');
  arenaCrossClear();
  arenaChecks.innerHTML = teamIds.map(id=>
    `<label><input type="checkbox" class="arena-team-checkbox" data-team="${id}"> Команда ${id}</label>`
  ).join('');
}

document.getElementById('btn-start-match').onclick = () => {
  const checked = [...arenaChecks.querySelectorAll('input:checked')];
  if (checked.length !== 2) return alert('Виберіть дві команди');
  const [a,b] = checked.map(cb=>+cb.dataset.team);
  arenaVS.textContent = `Команда ${a} ✕ Команда ${b}`;
  renderRounds(a,b);
  arenaSelect.classList.add('hidden');
  arenaArea.classList.remove('hidden');
};

function renderRounds(a,b) {
  arenaRounds.innerHTML = '';
  for (let r=1; r<=3; r++) {
    const div = document.createElement('div');
    div.innerHTML = `
      <h4>Раунд ${r}</h4>
      <label><input type="checkbox" class="r${r}-a"> T${a}</label>
      <label><input type="checkbox" class="r${r}-b"> T${b}</label>
    `;
    arenaRounds.append(div);
  }
}

document.getElementById('btn-save-match').onclick = async () => {
  const [t1,t2] = arenaVS.textContent.match(/\d+/g).map(Number);
  let winsA=0, winsB=0;
  for (let r=1; r<=3; r++) {
    if (arenaRounds.querySelector(`.r${r}-a`).checked) winsA++;
    if (arenaRounds.querySelector(`.r${r}-b`).checked) winsB++;
  }
  const series = `${winsA}-${winsB}`;
  const winner = winsA>winsB ? `team${t1}` : winsB>winsA ? `team${t2}` : 'tie';
  const data = {
    league: document.getElementById('league').value,
    team1: teams[t1].map(p=>p.nick).join(', '),
    team2: teams[t2].map(p=>p.nick).join(', '),
    winner, mvp: '', series, penalties: ''
  };
  await saveResult(data);
  alert('Гру збережено');
  clearArena();
};

document.getElementById('btn-clear-arena').onclick = clearArena;

function clearArena() {
  arenaArea.classList.add('hidden');
  arenaSelect.classList.remove('hidden');
  arenaRounds.innerHTML = '';
  arenaChecks.querySelectorAll('input').forEach(cb=>cb.checked=false);
}
