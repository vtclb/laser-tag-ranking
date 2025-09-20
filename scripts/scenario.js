// scripts/scenario.js

import { teams, initTeams }          from './teams.js?v=2025-09-19-avatars-2';
import { autoBalance2, autoBalanceN } from './balanceUtils.js?v=2025-09-19-avatars-2';
import { lobby, setManualCount }      from './lobby.js?v=2025-09-19-avatars-2';
import {
  balanceMode,
  registerRecomputeAutoBalance,
  recomputeAutoBalance as triggerRecomputeAutoBalance,
} from './balance.js?v=2025-09-19-avatars-2';

let scenarioArea, btnAuto, btnManual, teamSizeSel;
let arenaSelect, arenaCheckboxes, btnStart;

/** Показати блок сценарію */
export function initScenario() {
  scenarioArea.classList.remove('hidden');
}

/** Намалювати чекбокси команд для арени */
function renderArenaCheckboxes() {
  arenaCheckboxes.innerHTML = '';
  Object.keys(teams).forEach(id => {
    const sum = teams[id].reduce((s,p)=>s+p.pts, 0);
    const label = document.createElement('label');
    const cb    = document.createElement('input');
    cb.type     = 'checkbox';
    cb.className= 'arena-team';
    cb.dataset.team = id;
    cb.addEventListener('change', updateStartButton);
    label.appendChild(cb);
    label.insertAdjacentText('beforeend', ` Команда ${id} (∑ ${sum})`);
    arenaCheckboxes.appendChild(label);
  });
}

/** Увімкнути кнопку “Почати бій”, коли відмічено рівно 2 команди */
function updateStartButton() {
  const cnt = document.querySelectorAll('.arena-team:checked').length;
  btnStart.disabled = cnt !== 2;
}

/** Авто-баланс: N=2 чи N>2 */
export function recomputeAutoBalance() {
  if (balanceMode !== 'auto') return;
  if (!teamSizeSel || !arenaSelect || !arenaCheckboxes || !btnStart) return;

  const n = +teamSizeSel.value;
  if (!Number.isInteger(n) || n <= 0) return;

  setManualCount(n);    // сповіщаємо lobby.js, скільки кнопок “→…” малювати
  let data;
  if (n === 2) {
    const { A, B } = autoBalance2(lobby);
    data = { 1: A, 2: B };
  } else {
    data = autoBalanceN(lobby, n);
  }
  initTeams(n, data);          // малюємо команди
  arenaSelect.classList.remove('hidden');
  renderArenaCheckboxes();
  updateStartButton();
}

function handleAuto() {
  triggerRecomputeAutoBalance();
}

/** Ручне формування команд */
function handleManual() {
  const n = +teamSizeSel.value;
  setManualCount(n);    // скільки кнопок “→…” робити біля кожного гравця лоббі
  initTeams(n, {});     // створює пусті масиви teams[1]…teams[n]
  arenaSelect.classList.remove('hidden');
  renderArenaCheckboxes();
  updateStartButton();
}

export function refreshArenaTeams() {
  renderArenaCheckboxes();
  updateStartButton();
}

export { renderArenaCheckboxes, updateStartButton };

// Встановлюємо слухачі після завантаження DOM
document.addEventListener('DOMContentLoaded', () => {
  scenarioArea    = document.getElementById('scenario-area');
  btnAuto         = document.getElementById('btn-auto');
  btnManual       = document.getElementById('btn-manual');
  teamSizeSel     = document.getElementById('teamsize');
  arenaSelect     = document.getElementById('arena-select');
  arenaCheckboxes = document.getElementById('arena-checkboxes');
  btnStart        = document.getElementById('btn-start-match');

  if (!btnAuto || !btnManual || !teamSizeSel || !arenaSelect || !arenaCheckboxes || !btnStart) {
    console.error('scenario.js: не знайдено обовʼязкові елементи');
    return;
  }

  registerRecomputeAutoBalance(recomputeAutoBalance);

  btnAuto.addEventListener('click',   handleAuto);
  btnManual.addEventListener('click', handleManual);
});
