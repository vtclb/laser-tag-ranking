import { initTeams } from './teams.js';
import { autoBalance2, autoBalanceN } from './balanceUtils.js';
import { initLobby, setManualCount, lobby } from './lobby.js';
import { renderArena } from './arena.js';

const scenArea  = document.getElementById('scenario-area');
const btnAuto   = document.getElementById('btn-auto');
const btnManual = document.getElementById('btn-manual');
const sizeSel   = document.getElementById('teamsize');

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
  renderArena();
};

btnManual.onclick = () => {
  const N = +sizeSel.value;
  setManualCount(N);
  initTeams(N, {});       // пусті команди
  renderArena();          // чекбокси для вибору арени
};
