import { initTeams } from './teams.js';
import { autoBalance2, autoBalanceN } from './balanceUtils.js';
import { lobby } from './lobby.js';

const scenArea  = document.getElementById('scenario-area');
const btnAuto   = document.getElementById('btn-auto');
const btnManual = document.getElementById('btn-manual');
const sizeSel   = document.getElementById('teamsize');

export function initScenario() {
  scenArea.classList.remove('hidden');
}

btnAuto.addEventListener('click', () => {
  const N = +sizeSel.value;
  const lobbyArr = lobby;
  let teamsData = {};

  if (N === 2) {
    const { A: teamA, B: teamB } = autoBalance2(lobbyArr);
    teamsData = { 1: teamA, 2: teamB };
  } else {
    const arr = autoBalanceN(lobbyArr, N);
    arr.forEach((teamArr, i) => teamsData[i+1] = teamArr);
  }

  initTeams(N, teamsData);
});

btnManual.addEventListener('click', () => {
  const N = +sizeSel.value;
  initTeams(N); // порожні команди, далі вручну
});
