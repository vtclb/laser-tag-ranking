// scripts/api.js

const proxyUrl = 'https://laser-proxy.vartaclub.workers.dev';
const gendersURL = 'assets/player_gender.json';

export async function loadGenders(){
  try{
    const res = await fetch(gendersURL);
    if(!res.ok) throw new Error('HTTP '+res.status);
    return await res.json();
  }catch(err){
    console.error('Failed to load genders', err);
    return {};
  }
}


export async function loadPlayers(league) {
  const [genders, res] = await Promise.all([
    loadGenders(),
    fetch(`${proxyUrl}?league=${league}&t=${Date.now()}`)
  ]);
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
      return { nick, pts, rank, gender: genders[nick] };
    });
}


export async function saveResult(data) {
  const body = new URLSearchParams(data);
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  return res.text();
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
const defaultAvatarBase = 'assets/default_avatars';

export function getAvatarURL(nick){
  return `${avatarBase}/${encodeURIComponent(nick)}?t=${Date.now()}`;
}

export function getDefaultAvatarURL(gender){
  return gender === 'female'
    ? 'assets/default_avatars/av1.png'
    : 'assets/default_avatars/av2.png';
}

export async function uploadAvatar(nick, file){
  await fetch(`${avatarBase}/${encodeURIComponent(nick)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
}
