// scripts/main.js
import { loadPlayers } from './api.js';
import { initLobby }   from './lobby.js';
import { initScenario } from './scenario.js';

console.log('main.js завантажено');

const btnLoad  = document.getElementById('btn-load');
const leagueSel = document.getElementById('league');

btnLoad.addEventListener('click', async () => {
  console.log('Натиснуто btn-load, ліга =', leagueSel.value);
  try {
    const players = await loadPlayers(leagueSel.value);
    console.log('Отримано гравців:', players);
    initLobby(players);
    initScenario();  // показує блок сценаріїв
  } catch (err) {
    console.error('Помилка loadPlayers:', err);
    alert('Помилка завантаження гравців: ' + err.message);
  }
});
