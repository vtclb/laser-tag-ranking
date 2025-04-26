// scripts/scenario.js
import { initTeams } from './teams.js';
import { autoBalance2, autoBalanceN } from './balanceUtils.js';
import { lobby } from './lobby.js';

const scenArea  = document.getElementById('scenario-area');
const btnAuto   = document.getElementById('btn-auto');
const btnManual = document.getElementById('btn-manual');
const sizeSel   = document.getElementById('teamsize');

export function initScenario() {
  // Показати блок, де вибирають кількість команд і кнопки
  scenArea.classList.remove('hidden');
}

btnAuto.addEventListener('click', () => {
  const N = parseInt(sizeSel.value, 10);
  const lobbyArr = lobby;  // масив вибраних у лоббі

  let teamsData = {};
  if (N === 2) {
    const { A: teamA, B: teamB } = autoBalance2(lobbyArr);
    teamsData = { 1: teamA, 2: teamB };
  } else {
    const arr = autoBalanceN(lobbyArr, N);
    arr.forEach((teamArr, idx) => {
      teamsData[idx + 1] = teamArr;
    });
  }

  // Ініціалізуємо відразу з розподілом
  initTeams(N, teamsData);
});

btnManual.addEventListener('click', () => {
  const N = parseInt(sizeSel.value, 10);
  // Ініціюємо просто порожні команди, далі дзвінки teams.swap/remove
  initTeams(N, {});  
});
