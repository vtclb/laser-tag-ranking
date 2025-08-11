export function getLobbyStorageKey(date, league){
  const d = date || document.getElementById('date')?.value || new Date().toISOString().slice(0,10);
  const l = league || document.getElementById('league')?.value || '';
  return `lobby::${d}::${l}`;
}

export function saveLobbyState({lobby, teams, manualCount}){
  try{
    const key = getLobbyStorageKey();
    localStorage.setItem(key, JSON.stringify({lobby, teams, manualCount}));
  }catch(err){
    console.error('Failed to save lobby state', err);
  }
}

export function loadLobbyState(league){
  try{
    const key = getLobbyStorageKey(undefined, league);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }catch(err){
    console.error('Failed to load lobby state', err);
    return null;
  }
}
