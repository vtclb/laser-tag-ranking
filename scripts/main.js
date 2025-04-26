import { loadPlayers } from './api.js';
import { initLobby }   from './lobby.js';
import { initScenario } from './scenario.js';

const btnLoad  = document.getElementById('btn-load');
const leagueSel = document.getElementById('league');

(async function init() {
  // Дозволити UI тільки після підтвердження проксі/ліг
  leagueSel.disabled = false;
  btnLoad.disabled   = false;
})();

btnLoad.addEventListener('click', async () => {
  btnLoad.disabled = true;
  leagueSel.disabled = true;
  try {
    const players = await loadPlayers(leagueSel.value);
    initLobby(players);
    initScenario();
  } catch (e) {
    alert('Не вдалося завантажити гравців:\n' + e.message);
    btnLoad.disabled = false;
    leagueSel.disabled = false;
  }
});
