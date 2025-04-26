// scripts/main.js
import { loadPlayers } from './api.js';
import { initLobby }   from './lobby.js';
import { initScenario } from './scenario.js';

console.log('main.js завантажено');

const btnLoad   = document.getElementById('btn-load');
const leagueSel = document.getElementById('league');

btnLoad.addEventListener('click', async () => {
  console.log('Натиснуто btn-load. Ліга =', leagueSel.value);
  try {
    const players = await loadPlayers(leagueSel.value);
    console.log('Отримані гравці:', players);
    initLobby(players);
    initScenario();
  } catch (err) {
    console.error('Помилка loadPlayers:', err);
    alert('Не вдалося завантажити гравців:\n' + err.message);
  }
});
