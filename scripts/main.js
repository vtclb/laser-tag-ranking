// scripts/main.js

import { loadPlayers } from './api.js';
import { initLobby, uiLeague }   from './lobby.js';
import { initScenario } from './scenario.js';
import { initAvatarAdmin } from './avatarAdmin.js';

document.addEventListener('DOMContentLoaded', () => {
  const btnLoad   = document.getElementById('btn-load');
  const leagueSel = document.getElementById('league-select');
  const scenArea  = document.getElementById('scenario-area');
  initAvatarAdmin([], uiLeague);

  if (!btnLoad || !leagueSel) {
    console.error('Не знайдено #btn-load або #league-select у DOM');
    return;
  }

  // Після кліку підвантажуємо гравців
  btnLoad.addEventListener('click', async () => {
    // Відключаємо кнопку на час запиту
    btnLoad.disabled = true;
    btnLoad.textContent = 'Завантаження...';

    try {
      const players = await loadPlayers(uiLeague);
      initLobby(players);          // Рендер лоббі
      await initAvatarAdmin(players, uiLeague);    // Рендер аватарів
      scenArea.classList.remove('hidden'); // Показ блоку «Режим гри»
    } catch (err) {
      console.error('Помилка loadPlayers:', err);
      alert('Не вдалося завантажити гравців:\n' + err.message);
    } finally {
      btnLoad.disabled = false;
      btnLoad.textContent = 'Завантажити гравців';
    }
  });

  // При зміні ліги — очищуємо поточне лоббі та ховаємо сценарій
  leagueSel.addEventListener('change', async () => {
    initLobby([]);               // Порожнє лоббі
    await initAvatarAdmin([], uiLeague);
    scenArea.classList.add('hidden');
  });
});
