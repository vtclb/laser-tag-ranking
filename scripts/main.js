// scripts/main.js

import { loadPlayers } from './api.js';
import { initLobby }   from './lobby.js';
import { initScenario } from './scenario.js';

document.addEventListener('DOMContentLoaded', () => {
  const btnLoad   = document.getElementById('btn-load');
  const leagueSel = document.getElementById('league');
  const scenArea  = document.getElementById('scenario-area');

  // При кліку — підвантажити гравців, показати лоббі і сценарій
  btnLoad.addEventListener('click', async () => {
    const league = leagueSel.value;
    btnLoad.disabled = true;
    btnLoad.textContent = 'Завантаження...';
    try {
      const players = await loadPlayers(league);
      initLobby(players);          // заповнюємо лоббі
      scenArea.classList.remove('hidden'); // показуємо блок сценарію
    } catch (err) {
      alert('Не вдалося завантажити гравців:\n' + err);
    } finally {
      btnLoad.disabled = false;
      btnLoad.textContent = 'Завантажити гравців';
    }
  });

  // При зміні ліги — можна одразу очистити попереднє лоббі
  leagueSel.addEventListener('change', () => {
    initLobby([]);               // очищуємо список
    scenArea.classList.add('hidden');
  });
});
