// scripts/api.js

// All API requests are routed through a Google Apps Script which acts as a
// simple backend for storing results and serving assets. If the proxy fails
// we fall back to loading data directly from the published Google Sheet.
const proxyUrl = 'https://script.google.com/macros/s/AKfycbzLaserTagApi/exec';
const gendersFallback = 'assets/player_gender.json';

const rankingURLs = {
  kids: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1648067737&single=true&output=csv',
  sunday: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1286735969&single=true&output=csv'
};

export async function loadGenders(){
  let data = {};
  try{
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getGenders' })
    });
    if(!res.ok) throw new Error('HTTP '+res.status);
    data = await res.json();
  }catch(err){
    console.warn('Failed to load genders from worker', err);
    try{
      const res = await fetch(gendersFallback);
      if(res.ok) data = await res.json();
    }catch(e){
      console.error('Failed to load fallback genders', e);
    }
  }
  try{
    const local = JSON.parse(localStorage.getItem('player_genders') || '{}');
    data = { ...data, ...local };
  }catch(e){}
  Object.entries(data).forEach(([k,v]) => {
    if(v === 'm') data[k] = 'male';
    else if(v === 'f') data[k] = 'female';
  });
  return data;
}


export async function loadPlayers(league) {
  const genders = await loadGenders();
  let res;
  try {
    res = await fetch(`${proxyUrl}?league=${league}&t=${Date.now()}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
  } catch (err) {
    console.warn('Failed to load players from proxy', err);
    res = await fetch(rankingURLs[league]);
  }
  const txt = await res.text();
  return txt
    .trim()
    .split('\n').slice(1)
    .filter(l => l)
    .map(line => {
      const cols = line.split(',');
      const nick = cols[1]?.trim();
      const pts  = parseInt(cols[2], 10) || 0;
      const rank = pts < 200  ? 'D'
                 : pts < 500  ? 'C'
                 : pts < 800  ? 'B'
                 : pts < 1200 ? 'A'
                 :              'S';

      let gender = cols[3]?.trim().toLowerCase();
      if (gender === 'm') gender = 'male';
      else if (gender === 'f') gender = 'female';
      if (!gender) {
        gender = genders[nick];
      }

      return { nick, pts, rank, gender };
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

export function getDefaultAvatarURL(gender){
  if(gender === 'female'){
    return 'assets/default_avatars/av1.png';
  }
  if(gender === 'male'){
    return 'assets/default_avatars/av2.png';
  }
  return 'assets/default_avatars/av3.png';
}

export async function uploadAvatar(nick, file){
  const res = await fetch(`${customAvatarUploadBase}/${encodeURIComponent(nick)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file
  });
  return res.ok;
}

export async function saveGender(nick, gender, league = ''){
  try{
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setGender', nick, gender, league })
    });
    if(!res.ok) throw new Error('HTTP '+res.status);
  }catch(err){
    const data = JSON.parse(localStorage.getItem('player_genders') || '{}');
    data[nick] = gender;
    localStorage.setItem('player_genders', JSON.stringify(data));
  }
}
