// scripts/api.js

// All API requests are routed through a Google Apps Script which acts as a
// simple backend for storing results and serving assets. If the proxy fails
// we fall back to loading data directly from the published Google Sheet.
const proxyUrl = 'https://script.google.com/macros/s/AKfycbzjdoEtN8HsBFRGyme184NIGsZuCPyCPPtHNXU_PnJhoDi3mUVT40XnwzR90KHDa9J8pg/exec';

const rankingURLs = {
  kids: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1648067737&single=true&output=csv',
  sunday: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1286735969&single=true&output=csv'
};

const gamesURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=249347260&single=true&output=csv';

export async function loadPlayers(league) {
  let res;
  try {
    res = await fetch(`${proxyUrl}?league=${league}&t=${Date.now()}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
  } catch (err) {
    console.warn('Failed to load players from proxy', err);
    res = await fetch(rankingURLs[league]);
  }
  const txt = await res.text();
  const lines = txt.trim().split('\n').filter(l => l);
  if (!lines.length) return [];
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const nickIdx = header.findIndex(h => h === 'nickname');
  const ptsIdx  = header.findIndex(h => h === 'points');
  const aboIdx  = header.findIndex(h => h.includes('abonement'));

  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const nick = cols[nickIdx]?.trim();
    const pts  = parseInt(cols[ptsIdx], 10) || 0;
    const type = cols[aboIdx]?.trim() || 'none';
    const rank = pts < 200  ? 'D'
               : pts < 500  ? 'C'
               : pts < 800  ? 'B'
               : pts < 1200 ? 'A'
               :              'S';

    return { nick, pts, rank, abonement_type: type };
  });
}


export async function saveResult(data) {
  const body = new URLSearchParams(data);
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const text = await res.text();
  if(!res.ok){
    throw new Error(text || ('HTTP '+res.status));
  }
  return text;
}


export async function saveDetailedStats(matchId, statsArray) {
  const payload = {
    action: 'importStats',
    matchId,
    stats: statsArray
  };
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.text();
}

const avatarBase = `${proxyUrl}/avatars`;
const customAvatarUploadBase = `${proxyUrl}/custom_avatars`;
const customAvatarBase = 'assets/custom_avatars';
const defaultAvatarBase = 'assets/default_avatars';

export function getAvatarURL(nick){
  return `${customAvatarBase}/${encodeURIComponent(nick)}.png?t=${Date.now()}`;
}

export function getProxyAvatarURL(nick){
  return `${avatarBase}/${encodeURIComponent(nick)}?t=${Date.now()}`;
}

export function getDefaultAvatarURL(){
  return 'assets/default_avatars/av0.png';
}

export async function uploadAvatar(nick, file){
  const res = await fetch(`${customAvatarUploadBase}/${encodeURIComponent(nick)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file
  });
  return res.ok;
}

export async function registerPlayer(data){
  const payload = Object.assign({action:'register'}, data);
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  if(!res.ok) throw new Error(text || ('HTTP '+res.status));
  return text.trim();
}

export async function fetchPlayerStats(nick){
  const payload = {action:'getStats', nick};
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if(!res.ok) throw new Error('HTTP '+res.status);
  return res.json();
}

export async function fetchPlayerGames(){
  let res;
  try {
    res = await fetch(`${proxyUrl}?sheet=games&t=${Date.now()}`);
    if(!res.ok) throw new Error('HTTP '+res.status);
  } catch(err) {
    console.warn('Failed to load games from proxy', err);
    res = await fetch(gamesURL);
  }
  const text = await res.text();
  if (typeof Papa !== 'undefined') {
    return Papa.parse(text, {header:true, skipEmptyLines:true}).data;
  }
  return text.trim().split('\n').slice(1).map(line => {
    const cols = line.split(',');
    return {
      Timestamp: cols[0],
      League: cols[1],
      Team1: cols[2],
      Team2: cols[3],
      Team3: cols[4],
      Team4: cols[5],
      Winner: cols[6],
      MVP: cols[7],
      Series: cols[8],
      ID: cols[9]
    };
  });
}

