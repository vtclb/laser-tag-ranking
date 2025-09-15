export const AVATARS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=0&single=true&output=csv';
const AVATAR_PLACEHOLDER = '/assets/avatars/default.png';

let mapPromise;

function normalize(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  const m = u.match(/(?:file\/d\/|id=)([\w-]{10,})/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w512` : u;
}

async function fetchMap() {
  const res = await fetch(AVATARS_CSV_URL);
  if (!res.ok) throw new Error('CSV fetch failed: ' + res.status);
  const text = await res.text();
  const lines = text.trim().split('\n').filter(Boolean);
  const header = lines.shift().split(',').map(h => h.trim());
  const map = new Map();
  for (const line of lines) {
    const cols = line.split(',');
    const row = {};
    header.forEach((h, i) => { row[h] = (cols[i] || '').trim(); });
    const nick = row.nick || row.Nickname || row[header[0]] || '';
    const url = normalize(row.url || row.URL || row[header[1]] || '');
    if (nick && url) map.set(nick, url);
  }
  return map;
}

export async function renderAllAvatars({ bust } = {}) {
  if (!mapPromise) mapPromise = fetchMap();
  const map = await mapPromise;
  document.querySelectorAll('img[data-nick]').forEach(img => {
    const nick = img.dataset.nick || '';
    let src = map.get(nick) || AVATAR_PLACEHOLDER;
    if (bust) src += (src.includes('?') ? '&' : '?') + 'v=' + bust;
    img.onerror = () => { img.onerror = null; img.src = AVATAR_PLACEHOLDER; };
    if (!img.alt) img.alt = nick || 'avatar';
    img.src = src;
  });
}
