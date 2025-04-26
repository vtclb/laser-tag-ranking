import { saveResult } from './api.js';
import { teams } from './teams.js';

const btnStart     = document.getElementById('btn-start-match');
const arenaArea    = document.getElementById('arena-area');
const arenaVS      = document.getElementById('arena-vs');
const arenaRounds  = document.getElementById('arena-rounds');
const leagueSel    = document.getElementById('league');

btnStart.onclick = () => {
  // Зчитуємо чекбокси команд із заголовків команд
  const checked = [...document.querySelectorAll('.team-select:checked')].map(cb=>+cb.dataset.team);
  if (checked.length !== 2) {
    return alert('Виберіть дві команди у заголовках команд');
  }
  const [a,b] = checked;
  arenaVS.textContent = `Команда ${a} ✕ Команда ${b}`;
  // Показати арену
  arenaArea.classList.remove('hidden');
  renderRounds(a, b);
};

function renderRounds(a,b) {
  arenaRounds.innerHTML = '';
  for (let r = 1; r <= 3; r++) {
    const div = document.createElement('div');
    div.innerHTML = `
      <h4>Раунд ${r}</h4>
      <label><input type="checkbox" class="r${r}-a"> T${a}</label>
      <label><input type="checkbox" class="r${r}-b"> T${b}</label>
    `;
    arenaRounds.append(div);
  }
  document.getElementById('btn-save-match').onclick = () => saveMatch(a,b);
  document.getElementById('btn-clear-arena').onclick = clearArena;
}

async function saveMatch(a,b) {
  let winsA = 0, winsB = 0;
  for (let r = 1; r <= 3; r++) {
    if (arenaRounds.querySelector(`.r${r}-a`).checked) winsA++;
    if (arenaRounds.querySelector(`.r${r}-b`).checked) winsB++;
  }
  const series = `${winsA}-${winsB}`;
  const winner = winsA > winsB ? `team${a}` : winsB > winsA ? `team${b}` : 'tie';
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
  // Скидаємо всі відмітки раундів
  arenaRounds.innerHTML = '';
  // Скидаємо чекбокси команд
  document.querySelectorAll('.team-select').forEach(cb => cb.checked = false);
}
