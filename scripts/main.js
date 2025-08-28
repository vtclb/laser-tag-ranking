// scripts/main.js
import { log } from './logger.js';

import { loadPlayers } from './api.js';
import { initLobby }   from './lobby.js';
import { initScenario } from './scenario.js';
import { initAvatarAdmin } from './avatarAdmin.js';

const CACHE_VERSION = window.CACHE_VERSION || '1';

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
      const cacheKey = csvLeague + CACHE_VERSION;

      let players;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          players = JSON.parse(cached);
        } catch (e) {
          log('[ranking]', e);
        }
      }
      if (!players) {
        players = await loadPlayers(csvLeague);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(players));
        } catch (e) {
          log('[ranking]', e);
        }
      }

      initLobby(players, csvLeague);          // Рендер лоббі
      await initAvatarAdmin(players, selLeague.value);    // Рендер аватарів
      scenArea.classList.remove('hidden'); // Показ блоку «Режим гри»
    } catch (err) {
      log('[ranking]', err);
      showToast('Не вдалося завантажити гравців');
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
