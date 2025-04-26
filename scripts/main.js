import { loadPlayers, saveResult } from './api.js';
import { initLobby, lobby }      from './lobby.js';
import { initScenario }          from './scenario.js';
import { initArena }             from './arena.js';

// 1. Завантажити гравців
document.getElementById('btn-load').onclick = async ()=>{
  const lg = document.getElementById('league').value;
  const players = await loadPlayers(lg);
  initLobby(players);
  initScenario();
  initArena(lg, {}); // поки пустий обʼєкт teams
};
