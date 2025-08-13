// scripts/main.js

import { loadPlayers } from './api.js';
import { initLobby }   from './lobby.js';
import { initScenario } from './scenario.js';
import { initAvatarAdmin } from './avatarAdmin.js';

document.addEventListener('DOMContentLoaded', () => {
  const btnLoad   = document.getElementById('btn-load');
  const selLeague = document.getElementById('league');
  const scenArea  = document.getElementById('scenario-area');
  initAvatarAdmin([], selLeague?.value || '');

  if (!btnLoad || !selLeague) {
    console.error('Не знайдено #btn-load або #league у DOM');
    return;
  }

  // Після кліку підвантажуємо гравців
  btnLoad.addEventListener('click', async () => {
    // Відключаємо кнопку на час запиту
    btnLoad.disabled = true;
    btnLoad.textContent = 'Завантаження...';

    try {
      const csvLeague = window.uiLeagueToCsv(selLeague.value);
      const players = await loadPlayers(csvLeague);
      initLobby(players, csvLeague);          // Рендер лоббі
      await initAvatarAdmin(players, selLeague.value);    // Рендер аватарів
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
  selLeague.addEventListener('change', async () => {
    const csvLeague = window.uiLeagueToCsv(selLeague.value);
    initLobby([], csvLeague);               // Порожнє лоббі
    await initAvatarAdmin([], selLeague.value);
    scenArea.classList.add('hidden');
  });
});
