// scripts/main.js
import { log } from './logger.js?v=2025-09-19-avatars-1';

import { loadPlayers, safeGet, safeSet } from './api.js?v=2025-09-19-avatars-1';
import { initLobby }   from './lobby.js?v=2025-09-19-avatars-1';
import { initScenario } from './scenario.js?v=2025-09-19-avatars-1';
import { initAvatarAdmin } from './avatarAdmin.js?v=2025-09-19-avatars-1';

const CACHE_VERSION = window.CACHE_VERSION || '1';

function safeSessionStorage() {
  try {
    if (!('sessionStorage' in window)) return null;
    const test = '__test__';
    window.sessionStorage.setItem(test, '1');
    window.sessionStorage.removeItem(test);
    return window.sessionStorage;
  } catch (err) {
    return null;
  }
}

window.__SESS = window.__SESS || safeSessionStorage();

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
      const cached = safeGet(window.__SESS, cacheKey);
      if (cached) {
        try {
          players = JSON.parse(cached);
        } catch (e) {
          log('[ranking]', e);
        }
      }
      if (!players) {
        players = await loadPlayers(csvLeague);
        safeSet(window.__SESS, cacheKey, JSON.stringify(players));
      }

      initLobby(players, csvLeague);          // Рендер лоббі
      document.getElementById('sec-player-picker')?.classList.add('open');
      await initAvatarAdmin(players, selLeague.value);    // Рендер аватарів
      scenArea.classList.remove('hidden'); // Показ блоку «Режим гри»
      document.getElementById('ui-panel').hidden = false;
      document.getElementById('ui-overlay').hidden = false;
    } catch (err) {
      log('[ranking]', err);
      const msg = 'Не вдалося завантажити гравців';
      if (typeof showToast === 'function') showToast(msg); else alert(msg);
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
    document.getElementById('ui-panel').hidden = false;
    document.getElementById('ui-overlay').hidden = false;
  });
});
