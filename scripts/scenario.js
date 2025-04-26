import { initTeams } from './teams.js';
import { autoBalance2, autoBalanceN } from './balanceUtils.js';
import { initLobby, setManualCount, lobby } from './lobby.js';

const scenArea  = document.getElementById('scenario-area');
const btnAuto   = document.getElementById('btn-auto');
const btnManual = document.getElementById('btn-manual');
const sizeSel   = document.getElementById('teamsize');
const arenaAction = document.getElementById('arena-action');

export function initScenario() {
  scenArea.classList.remove('hidden');
}

btnAuto.onclick = () => {
  const N = +sizeSel.value;
  setManualCount(N);
  const arr = (N === 2)
    ? (() => { const {A,B} = autoBalance2(lobby); return [A,B]; })()
    : autoBalanceN(lobby, N);
  const data = arr.reduce((o,team,i)=> (o[i+1]=team, o), {});
  initTeams(N, data);
  // Показуємо кнопку «Почати бій»
  arenaAction.classList.remove('hidden');
};

btnManual.onclick = () => {
  const N = +sizeSel.value;
  setManualCount(N);
  initTeams(N, {});  
  arenaAction.classList.remove('hidden');
};
