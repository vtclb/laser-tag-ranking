import { log } from './logger.js?v=2025-09-19-4';
import { safeSet, safeGet } from './api.js?v=2025-09-19-4';
export function getLobbyStorageKey(date, league){
  const d = date || document.getElementById('date')?.value || new Date().toISOString().slice(0,10);
  const sel = document.getElementById('league');
  const l = league || sel?.value || '';
  return `lobby::${d}::${l}`;
}

export function saveLobbyState({lobby, teams, manualCount, league}){
  const key = getLobbyStorageKey(undefined, league);
  safeSet(localStorage, key, JSON.stringify({lobby, teams, manualCount}));
}

export function loadLobbyState(league){
  const key = getLobbyStorageKey(undefined, league);
  const data = safeGet(localStorage, key);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch (err) {
    log('[ranking]', err);
    return null;
  }
}
