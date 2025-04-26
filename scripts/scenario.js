import { initTeams } from './teams.js';
import { autoBalance2, autoBalanceN } from './balanceUtils.js';
import { lobby, enableManual } from './lobby.js';
import { renderArenaSelect } from './arena.js';

const scenArea  = document.getElementById('scenario-area');
const btnAuto   = document.getElementById('btn-auto');
const btnManual = document.getElementById('btn-manual');
const sizeSel   = document.getElementById('teamsize');

export function initScenario() {
  scenArea.classList.remove('hidden');
}

btnAuto.onclick = () => {
  const N = +sizeSel.value;
  const lobbyArr = lobby;
  let teamsData = {};

  if (N === 2) {
    const { A: teamA, B: teamB } = autoBalance2(lobbyArr);
    teamsData = { 1: teamA, 2: teamB };
  } else {
    const arr = autoBalanceN(lobbyArr, N);
    arr.forEach((teamArr,i)=> teamsData[i+1]=teamArr);
  }

  // Інціалізуємо команди
  initTeams(N, teamsData);
  // Показуємо селектор арени з чекбоксами
  renderArenaSelect(Object.keys(teamsData));
};

btnManual.onclick = () => {
  const N = +sizeSel.value;
  // Створюємо пусті команди
  initTeams(N, {});
  // Дозволяємо розподіл з лоббі
  enableManual(N);
  // Показуємо селектор арени (можна самому вибрати)
  renderArenaSelect(Array.from({length:N},(_,i)=>i+1));
};
