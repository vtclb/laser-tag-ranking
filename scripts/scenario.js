import { initTeams } from './teams.js';
import { balanceUtils } from './balanceUtils.js'; // імпорт autoBalance2/autoBalanceN
const scenArea  = document.getElementById('scenario-area'),
      btnAuto   = document.getElementById('btn-auto'),
      btnManual = document.getElementById('btn-manual'),
      sizeSel   = document.getElementById('teamsize');

export function initScenario(){
  scenArea.classList.remove('hidden');
}

btnAuto.onclick = ()=>{
  const N = +sizeSel.value;
  import('./lobby.js').then(m=>{
    const lobbyArr = m.lobby;
    let teams = N===2
      ? autoBalance2(lobbyArr)
      : autoBalanceN(lobbyArr,N);
    initTeams(N);
    // для N=2 teams = { teamA, teamB }, для N>2 teams = array of arrays
    // тут треба викликати initTeams і передати teams масиво
  });
};

btnManual.onclick = ()=>{
  const N=+sizeSel.value;
  initTeams(N);
};
