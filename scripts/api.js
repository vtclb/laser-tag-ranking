// scripts/api.js

const proxyUrl = 'https://laser-proxy.vartaclub.workers.dev';


export async function loadPlayers(league) {
  const res = await fetch(`${proxyUrl}?league=${league}&t=${Date.now()}`);
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
      return { nick, pts, rank };
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

export function getDefaultAvatarURL(nick){
  return `${defaultAvatarBase}/${encodeURIComponent(nick)}.png`;
}

export async function uploadAvatar(nick, file){
  await fetch(`${avatarBase}/${encodeURIComponent(nick)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
}
