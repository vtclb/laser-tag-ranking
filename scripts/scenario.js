import { initTeams } from './teams.js';
import { autoBalance2, autoBalanceN } from './balanceUtils.js';
import { lobby, setManualCount } from './lobby.js';

const btnAuto   = document.getElementById('btn-auto');
const btnManual = document.getElementById('btn-manual');
const sizeSel   = document.getElementById('teamsize');

export function initScenario() {
  document.getElementById('scenario-area').classList.remove('hidden');
}

function showTeams(N, data) {
  initTeams(N, data);
  // Додати колір обраних чекбоксів в заголовках
  document.querySelectorAll('.team-select')
    .forEach(cb => cb.addEventListener('change', updateStartButton));
}

// Перевіряємо, чи дві команди відмічені
function updateStartButton() {
  const checked = document.querySelectorAll('.team-select:checked');
  document.getElementById('btn-start-match')
    .disabled = checked.length !== 2;
}

btnAuto.onclick = () => {
  const N = +sizeSel.value;
  setManualCount(N);
  const arr = N===2
    ? (() => { const {A,B} = autoBalance2(lobby); return [A,B]; })()
    : autoBalanceN(lobby, N);
  const data = arr.reduce((o,t,i)=> (o[i+1]=t,o), {});
  showTeams(N, data);
};

btnManual.onclick = () => {
  const N = +sizeSel.value;
  setManualCount(N);
  showTeams(N, {});
};
