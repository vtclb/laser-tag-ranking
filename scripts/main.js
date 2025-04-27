import { loadPlayers } from './api.js';
import { initLobby }   from './lobby.js';
import { initScenario } from './scenario.js';

const btnLoad   = document.getElementById('btn-load');
const leagueSel = document.getElementById('league');

console.log('main.js завантажено');
btnLoad.onclick = async ()=>{
  try {
    const players = await loadPlayers(leagueSel.value);
    initLobby(players);
    initScenario();
  } catch(err) {
    console.error(err);
    alert('Не вдалося завантажити гравців:\n' + err.message);
  }
};
