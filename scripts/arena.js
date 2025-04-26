// scripts/arena.js
import { saveResult } from './api.js';
import { teams }      from './teams.js';

const btnStart  = document.getElementById('btn-start-match');
const arenaArea = document.getElementById('arena-area');
const arenaVS   = document.getElementById('arena-vs');
const arenaRounds = document.getElementById('arena-rounds');
const btnSave   = document.getElementById('btn-save-match');
const btnClear  = document.getElementById('btn-clear-arena');
const leagueSel = document.getElementById('league');

btnStart.addEventListener('click', () => {
  // Збираємо відмічені чекбокси в заголовках команд
  const checked = [...document.querySelectorAll('.team-select:checked')];
  if (checked.length !== 2) {
    alert('Виберіть дві команди для бою');
    return;
  }
  const [a,b] = checked.map(cb => +cb.dataset.team);
  arenaVS.textContent = `Команда ${a} ✕ Команда ${b}`;
  arenaArea.classList.remove('hidden');

  // Створюємо поля для відміток раундів
  arenaRounds.innerHTML = '';
  for (let i = 1; i <= 3; i++) {
    const div = document.createElement('div');
    div.innerHTML = `
      <h4>Раунд ${i}</h4>
      <label><input type="checkbox" class="r${i}-a"> T${a}</label>
      <label><input type="checkbox" class="r${i}-b"> T${b}</label>
    `;
    arenaRounds.append(div);
  }
  btnSave.disabled = false;
});

btnSave.addEventListener('click', async () => {
  let winsA = 0, winsB = 0;
  for (let i = 1; i <= 3; i++) {
    if (arenaRounds.querySelector(`.r${i}-a`).checked) winsA++;
    if (arenaRounds.querySelector(`.r${i}-b`).checked) winsB++;
  }
  const winner = winsA > winsB
    ? `team${arenaVS.textContent.match(/\d+/)[0]}`
    : winsB > winsA
      ? `team${arenaVS.textContent.match(/\d+/g)[1]}`
      : 'tie';
  const series = `${winsA}-${winsB}`;
  await saveResult({
    league: leagueSel.value,
    team1: teams[arenaVS.textContent.match(/\d+/g)[0]].map(p=>p.nick).join(', '),
    team2: teams[arenaVS.textContent.match(/\d+/g)[1]].map(p=>p.nick).join(', '),
    winner, mvp:'', series, penalties:''
  });
  alert('Гру збережено');
  btnClear.click();
});

btnClear.addEventListener('click', () => {
  arenaArea.classList.add('hidden');
  arenaRounds.innerHTML = '';
  btnSave.disabled = true;
  document.querySelectorAll('.team-select').forEach(cb => cb.checked = false);
});
