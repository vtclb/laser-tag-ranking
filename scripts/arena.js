import { saveResult } from './api.js';
import { teams } from './teams.js';

const arenaArea   = document.getElementById('arena-area');
const arenaRounds = document.getElementById('arena-rounds');
const leagueSel   = document.getElementById('league');

export function renderArena() {
  arenaArea.classList.remove('hidden');
  // створюємо по 2 чекбокси для вибору 2 команд
  const sel = document.querySelectorAll('.team-select:checked');
  if (sel.length !== 2) {
    arenaArea.innerHTML = '<p>Виберіть дві команди вище, щоб почати бій.</p>';
    return;
  }
  const [a,b] = [...sel].map(cb=>+cb.dataset.team);
  arenaArea.innerHTML = `
    <h2>Арена: Команда ${a} ✕ Команда ${b}</h2>
    <div id="arena-rounds" class="rounds-grid"></div>
    <div class="actions">
      <button id="btn-save-match">Зберегти гру</button>
      <button id="btn-clear-arena">Геть з арени</button>
    </div>
  `;
  const roundsDiv = document.getElementById('arena-rounds');
  for (let r=1; r<=3; r++) {
    const d = document.createElement('div');
    d.innerHTML = `
      <h4>Раунд ${r}</h4>
      <label><input type="checkbox" class="r${r}-a"> T${a}</label>
      <label><input type="checkbox" class="r${r}-b"> T${b}</label>
    `;
    roundsDiv.append(d);
  }
  document.getElementById('btn-save-match').onclick = async () => {
    let winsA=0, winsB=0;
    for (let r=1;r<=3;r++){
      if (roundsDiv.querySelector(`.r${r}-a`).checked) winsA++;
      if (roundsDiv.querySelector(`.r${r}-b`).checked) winsB++;
    }
    const series = `${winsA}-${winsB}`;
    const winner = winsA>winsB ? `team${a}` : winsB>winsA ? `team${b}` : 'tie';
    const data = {
      league: leagueSel.value,
      team1: teams[a].map(p=>p.nick).join(', '),
      team2: teams[b].map(p=>p.nick).join(', '),
      winner, mvp:'', series, penalties:''
    };
    await saveResult(data);
    alert('Результат збережено');
    clearArena();
  };
  document.getElementById('btn-clear-arena').onclick = clearArena;
}

function clearArena() {
  arenaArea.classList.add('hidden');
  arenaRounds.innerHTML = '';
  document.querySelectorAll('.team-select').forEach(cb=>cb.checked=false);
}
