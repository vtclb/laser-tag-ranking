export function getLobbyStorageKey(date, league){
  const d = date || document.getElementById('date')?.value || new Date().toISOString().slice(0,10);
  const sel = document.getElementById('league');
  const l = league || sel?.value || '';
  return `lobby::${d}::${l}`;
}

export function saveLobbyState({lobby, teams, manualCount, league}){
  try{
    const key = getLobbyStorageKey(undefined, league);
    localStorage.setItem(key, JSON.stringify({lobby, teams, manualCount}));
  }catch(err){
    console.debug('[ranking]', err);
  }
}

export function loadLobbyState(league){
  try{
    const key = getLobbyStorageKey(undefined, league);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }catch(err){
    console.debug('[ranking]', err);
    return null;
  }
}
