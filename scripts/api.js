// scripts/api.js

// All API requests are routed through a Google Apps Script which acts as a
// simple backend for storing results and serving assets. If the proxy fails
// we fall back to loading data directly from the published Google Sheet.
const proxyUrl = 'https://script.google.com/macros/s/AKfycby65ks_P5o_-cM3dT37xfhw_9iEG3YF4cPdATSZVym_HsYpY9I_n6JDpe1eZ9Rv3OsFyg/exec';

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

    return { nick, pts, rank, abonement: type };
  });
}


export async function saveResult(data) {
  const body = new URLSearchParams(data);
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if(!res.ok){
    const text = await res.text();
    throw new Error(text || ('HTTP '+res.status));
  }
  return res.json();
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

const avatarBase = '/avatars';
const avatarUploadBase = '/upload-avatar';
const defaultAvatarBase = 'assets/default_avatars';

export function getAvatarURL(nick){
  return `${avatarBase}/${encodeURIComponent(nick)}?t=${Date.now()}`;
}

export function getProxyAvatarURL(nick){
  return getAvatarURL(nick);
}

export function getDefaultAvatarURL(){
  return `${defaultAvatarBase}/av0.png`;
}

export async function uploadAvatar(nick, file){
  const headers = { 'Content-Type': file.type || 'application/octet-stream' };
  if (window.UPLOAD_TOKEN) headers['X-Upload-Token'] = window.UPLOAD_TOKEN;
  const res = await fetch(`${avatarUploadBase}/${encodeURIComponent(nick)}`, {
    method: 'POST',
    headers,
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

export async function requestAbonement(nick){
  const payload = {action:'abonement_request', nick};
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if(!res.ok) throw new Error('HTTP '+res.status);
  return res.text();
}

export async function updateAbonement(nick, abonement){
  const payload = {action:'updateAbonement', nick, abonement};
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if(!res.ok) throw new Error('HTTP '+res.status);
  return res.text();
}

export async function fetchPlayerGames(nick, league=''){
  let res;
  try {
    res = await fetch(`${proxyUrl}?sheet=games&t=${Date.now()}`);
    if(!res.ok) throw new Error('HTTP '+res.status);
  } catch(err) {
    console.warn('Failed to load games from proxy', err);
    res = await fetch(gamesURL);
  }
  const text = await res.text();
  let list;
  if (typeof Papa !== 'undefined') {
    list = Papa.parse(text, {header:true, skipEmptyLines:true}).data;
  } else {
    list = text.trim().split('\n').slice(1).map(line => {
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
  return list.filter(g => {
    if(league && g.League && g.League !== league) return false;
    const teams = [g.Team1, g.Team2, g.Team3, g.Team4];
    return teams.some(t => (t || '').split(',').map(s => s.trim()).includes(nick));
  });
}

