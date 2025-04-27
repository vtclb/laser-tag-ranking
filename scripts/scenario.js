// scripts/scenario.js

import { teams, initTeams }        from './teams.js';
import { autoBalance2, autoBalanceN } from './balanceUtils.js';
import { lobby, setManualCount }      from './lobby.js';

const scenarioArea    = document.getElementById('scenario-area');
const btnAuto         = document.getElementById('btn-auto');
const btnManual       = document.getElementById('btn-manual');
const teamSizeSel     = document.getElementById('teamsize');
const arenaSelect     = document.getElementById('arena-select');
const arenaCheckboxes = document.getElementById('arena-checkboxes');
const btnStart        = document.getElementById('btn-start-match');

/** Показуємо блок сценарію */
export function initScenario() {
  scenarioArea.classList.remove('hidden');
}

/** Малюємо чекбокси для команд на арену */
function renderArenaCheckboxes() {
  arenaCheckboxes.innerHTML = '';
  Object.keys(teams).forEach(id => {
    const sum = teams[id].reduce((s,p) => s + p.pts, 0);
    arenaCheckboxes.insertAdjacentHTML('beforeend', `
      <label>
        <input type="checkbox" class="arena-team" data-team="${id}">
        Команда ${id} (∑ ${sum})
      </label>`);
  });

  // Після рендеру ставимо обробник на кожен чекбокс
  document.querySelectorAll('.arena-team').forEach(cb => {
    cb.addEventListener('change', updateStartButton);
  });
}

/** Вмикаємо кнопку, якщо вибрано рівно 2 чекбокси */
function updateStartButton() {
  const cnt = document.querySelectorAll('.arena-team:checked').length;
  btnStart.disabled = (cnt !== 2);
}

// --- Обробники ---
btnAuto.addEventListener('click', () => {
  const n = +teamSizeSel.value;
  setManualCount(n);
  const data = (n === 2)
    ? (() => { const { A, B } = autoBalance2(lobby); return {1:A,2:B}; })()
    : autoBalanceN(lobby, n);
  initTeams(n, data);
  arenaSelect.classList.remove('hidden');
  renderArenaCheckboxes();
  updateStartButton();
});

btnManual.addEventListener('click', () => {
  const n = +teamSizeSel.value;
  setManualCount(n);
  initTeams(n, {});
  arenaSelect.classList.remove('hidden');
  renderArenaCheckboxes();
  updateStartButton();
});
