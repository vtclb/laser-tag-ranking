// scripts/api.js

// Google Apps Script backend (веб-апп)
export const API_URL = 'https://script.google.com/macros/s/AKfycbxaISxiRGrsO4IS3Dy5T-y2pBpOfHAWCL0WTvuQFp_ZSH0NvSY2A5LhJxdKul5F2Kz4iw/exec';
const proxyUrl = API_URL;

// Публічні фіди рейтингу (CSV)
const rankingURLs = {
  kids:        'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1648067737&single=true&output=csv',
  // було pubhtml -> виправлено на output=csv
  sundaygames: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1286735969&single=true&output=csv'
};

// Логи ігор (CSV)
const gamesURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=249347260&single=true&output=csv';

// ---------------------- Уніфікація ліг ----------------------
export function normalizeLeague(v) {
  const x = String(v || '').toLowerCase();
  if (x === 'sundaygames' || x === 'olds' || x === 'adult' || x === 'adults') return 'sundaygames';
  if (x === 'kid' || x === 'junior') return 'kids';
  if (x === 'sunday') return 'sundaygames';
  if (x === 'kids') return 'kids';
  return 'sundaygames'; // дефолт — старша
}

export function getLeagueFeedUrl(league) {
  const key = normalizeLeague(league);
  const url = rankingURLs[key];
  if (!url) throw new Error('Unknown league: ' + league);
  return url;
}

// ---------------------- CSV helper ----------------------
export async function fetchCsv(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('API: feed failed ' + res.status);
  const text = await res.text();
  // якщо є Papa — віддамо заголовками, якщо ні — швидкий парсер нижче
  if (typeof Papa !== 'undefined') {
    return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  }
  const lines = text.trim().split('\n').filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const obj = {};
    header.forEach((h, i) => { obj[h] = (cols[i] ?? '').trim(); });
    return obj;
  });
}

// ---------------------- Рейтинг/гравці ----------------------
export async function loadPlayers(league) {
  const lg = normalizeLeague(league);
  let res;
  try {
    // пробуємо через проксі (GAS)
    res = await fetch(`${proxyUrl}?league=${lg}&t=${Date.now()}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
  } catch (err) {
    console.warn('Failed to load players from proxy', err);
    // фолбек: прямий CSV фід
    res = await fetch(getLeagueFeedUrl(lg));
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
    const nick = cols[nickIdx]?.trim() || '';
    const pts  = parseInt(cols[ptsIdx], 10) || 0;
    const type = (aboIdx >= 0 ? cols[aboIdx]?.trim() : '') || 'none';
    const rank = pts < 200  ? 'D'
               : pts < 500  ? 'C'
               : pts < 800  ? 'B'
               : pts < 1200 ? 'A'
               :              'S';
    return { nick, pts, rank, abonement: type };
  });
}

// Back-compat для балансера: він імпортує саме fetchPlayerData
export async function fetchPlayerData(league) {
  return loadPlayers(league);
}

// ---------------------- Збереження результату ----------------------
export async function saveResult(data) {
  const payload = { ...(data || {}) };
  if (payload.league) payload.league = normalizeLeague(payload.league);
  const body = new URLSearchParams(payload);
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || ('HTTP ' + res.status));
  }
  // бек повертає JSON {status:'OK', players:[...]}
  return res.json();
}

// ---------------------- Детальна статистика (PDF імпорт) ----------------------
export async function saveDetailedStats(matchId, statsArray) {
  const payload = { action: 'importStats', matchId, stats: statsArray };
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.text();
}

// ---------------------- Аватарки ----------------------
export async function uploadAvatar(nick, fileOrBlob) {
  const data = await toBase64NoPrefix(fileOrBlob);
  const mime = fileOrBlob.type || 'image/jpeg';
  const resp = await postJson({ action: 'uploadAvatar', nick, mime, data });
  if (resp.status && resp.status !== 'OK') throw new Error(resp.status);
  if (!resp || !resp.url) throw new Error('No URL returned');
  return resp.url;
}

// ---------------------- Реєстрація/статистика ----------------------
export async function registerPlayer(data) {
  const payload = Object.assign({ action: 'register' }, data);
  if (payload.league) payload.league = normalizeLeague(payload.league);
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || ('HTTP ' + res.status));
  return text.trim();
}

export async function fetchPlayerStats(nick) {
  const payload = { action: 'getStats', nick };
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// ---------------------- Абонементи ----------------------
// Кнопка “Запросити абонемент” у профілі.
// Під бекенд: action = 'requestAbonement' (а не 'abonement_request')
export async function requestAbonement({ nick, league = 'sunday', requested = 'month' }) {
  const payload = {
    action: 'requestAbonement',
    nick,
    league: normalizeLeague(league),
    requested
  };
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json ? res.json() : res.text();
}

// Адмін у балансері змінює тип абонемента.
// Під бекенд: action = 'updateAbonement', поля: {nick, league, type}
export async function updateAbonement({ nick, league, type }) {
  const payload = {
    action: 'updateAbonement',
    nick,
    league: normalizeLeague(league),
    type: String(type || 'none').toLowerCase()
  };
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json ? res.json() : res.text();
}

// ---------------------- Логи ігор для конкретного гравця ----------------------
export async function fetchPlayerGames(nick, league = '') {
  let res;
  try {
    // якщо проксі віддає лист games
    res = await fetch(`${proxyUrl}?sheet=games&t=${Date.now()}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
  } catch (err) {
    console.warn('Failed to load games from proxy', err);
    res = await fetch(gamesURL);
  }
  const text = await res.text();

  let list;
  if (typeof Papa !== 'undefined') {
    list = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  } else {
    const lines = text.trim().split('\n').filter(Boolean);
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    list = lines.slice(1).map(line => {
      const cols = line.split(',');
      const get = (name) => {
        const idx = header.indexOf(name.toLowerCase());
        return idx >= 0 ? (cols[idx] || '').trim() : '';
      };
      return {
        Timestamp: get('Timestamp'),
        League: get('League'),
        Team1: get('Team1'),
        Team2: get('Team2'),
        Team3: get('Team3'),
        Team4: get('Team4'),
        Winner: get('Winner'),
        MVP: get('MVP'),
        Series: get('Series'),
        ID: get('ID')
      };
    });
  }

  const lg = league ? normalizeLeague(league) : '';
  return list.filter(g => {
    if (lg && g.League && normalizeLeague(g.League) !== lg) return false;
    const teams = [g.Team1, g.Team2, g.Team3, g.Team4];
    return teams.some(t => (t || '').split(',').map(s => s.trim()).includes(nick));
  });
}

// ---------------------- Новий JSON API ----------------------
async function postJson(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || ('HTTP ' + res.status));
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
}

export async function adminCreatePlayer(data) {
  const payload = { action: 'adminCreatePlayer', ...(data || {}) };
  if (payload.league) payload.league = normalizeLeague(payload.league);
  const resp = await postJson(payload);
  if (resp.status && resp.status !== 'OK' && resp.status !== 'DUPLICATE') throw new Error(resp.status);
  return resp;
}

export async function issueAccessKey(data) {
  const payload = { action: 'issueAccessKey', ...(data || {}) };
  if (payload.league) payload.league = normalizeLeague(payload.league);
  const resp = await postJson(payload);
  if (resp.status && resp.status !== 'OK') throw new Error(resp.status);
  return resp;
}

export async function getProfile(data) {
  const payload = { action: 'getProfile', ...(data || {}) };
  if (payload.league) payload.league = normalizeLeague(payload.league);
  const resp = await postJson(payload);
  if (resp.status && resp.status !== 'OK') throw new Error(resp.status);
  return resp;
}

export async function getAvatarUrl(nick) {
  const resp = await postJson({ action: 'getAvatarUrl', nick });
  if (resp.status && resp.status !== 'OK') throw new Error(resp.status);
  if (!resp || !resp.url) throw new Error('Invalid avatar URL response');
  return { url: resp.url, updatedAt: resp.updatedAt };
}

export async function getPdfLinks(params) {
  const payload = { action: 'getPdfLinks', ...(params || {}) };
  if (payload.league) payload.league = normalizeLeague(payload.league);
  const resp = await postJson(payload);
  if (resp.status && resp.status !== 'OK') throw new Error(resp.status);
  return resp;
}

export function toBase64NoPrefix(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      const comma = result.indexOf(',');
      if (comma === -1) {
        reject(new Error('Invalid file data'));
      } else {
        resolve(result.slice(comma + 1));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
