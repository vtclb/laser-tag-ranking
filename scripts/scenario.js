// scripts/scenario.js

import { teams, initTeams } from './teams.js';
import { autoBalance2, autoBalanceN } from './balanceUtils.js';
import { lobby, setManualCount } from './lobby.js';

let scenarioArea, btnAuto, btnManual, teamSizeSel, arenaSelect, arenaCheckboxes, btnStart;

/** Показати блок сценарію */
export function initScenario() {
  if (scenarioArea) scenarioArea.classList.remove('hidden');
}

/** Намалювати чекбокси команд */
function renderArenaCheckboxes() {
  arenaCheckboxes.innerHTML = '';
  Object.keys(teams).forEach(id => {
    const sum = teams[id].reduce((s, p) => s + p.pts, 0);
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'arena-team';
    cb.dataset.team = id;
    cb.addEventListener('change', updateStartButton);
    label.appendChild(cb);
    label.insertAdjacentText('beforeend', ` Команда ${id} (∑ ${sum})`);
    arenaCheckboxes.appendChild(label);
  });
}

/** Увімкнути кнопку, коли 2 команди відмічені */
function updateStartButton() {
  const cnt = document.querySelectorAll('.arena-team:checked').length;
  btnStart.disabled = cnt !== 2;
}

/** Обробник авто-балансу */
function handleAuto() {
  const n = +teamSizeSel.value;
  setManualCount(n);
  let data;
  if (n === 2) {
    const { A, B } = autoBalance2(lobby);
    data = { 1: A, 2: B };
  } else {
    data = autoBalanceN(lobby, n);
  }
  initTeams(n, data);
  arenaSelect.classList.remove('hidden');
  renderArenaCheckboxes();
  updateStartButton();
}

/** Обробник ручного формування */
function handleManual() {
  const n = +teamSizeSel.value;
  setManualCount(n);
  initTeams(n, {});
  arenaSelect.classList.remove('hidden');
  renderArenaCheckboxes();
  updateStartButton();
}

// Ініціалізація слухачів після завантаження сторінки
document.addEventListener('DOMContentLoaded', () => {
  scenarioArea    = document.getElementById('scenario-area');
  btnAuto         = document.getElementById('btn-auto');
  btnManual       = document.getElementById('btn-manual');
  teamSizeSel     = document.getElementById('teamsize');
  arenaSelect     = document.getElementById('arena-select');
  arenaCheckboxes = document.getElementById('arena-checkboxes');
  btnStart        = document.getElementById('btn-start-match');

  if (!btnAuto || !btnManual || !teamSizeSel || !arenaSelect || !arenaCheckboxes || !btnStart) {
    console.error('scenario.js: missing required elements');
    return;
  }

  btnAuto.addEventListener('click', handleAuto);
  btnManual.addEventListener('click', handleManual);
});

