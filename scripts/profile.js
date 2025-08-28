import { log } from './logger.js';
import { getProfile, uploadAvatar, getPdfLinks, fetchPlayerGames, getAvatarUrl, fetchOnce } from './api.js';

let gameLimit = 0;
let gamesLeftEl = null;
let avatarUrl = '';
let currentNick = '';
const pdfCache = {};

const AVATAR_TTL = 6 * 60 * 60 * 1000;
const DEFAULT_AVATAR_URL = 'assets/default_avatars/av0.png';

async function fetchAvatar(nick){
  return fetchOnce(`avatar:${nick}`, AVATAR_TTL, () => getAvatarUrl(nick));
}

function computeRank(points) {
  const p = +points || 0;
  if (p >= 1200) return 'S';
  if (p >= 800) return 'A';
  if (p >= 500) return 'B';
  if (p >= 200) return 'C';
  return 'D';
}

function showError(msg) {
  const container = document.getElementById('profile');
  container.style.display = 'none';
  let err = document.getElementById('profile-error');
  if (!err) {
    err = document.createElement('div');
    err.id = 'profile-error';
    err.style.color = '#f39c12';
    err.style.textAlign = 'center';
    err.style.marginTop = '1rem';
    document.querySelector('nav').insertAdjacentElement('afterend', err);
    err.innerHTML = `
      <p>${msg}</p>
      <div style="margin-top:0.5rem;">
        <input type="text" id="retry-nick" placeholder="Введіть нік" style="padding:0.5rem;border:2px solid #555;background:rgba(0,0,0,0.5);color:#fff;border-radius:4px;font-size:0.7rem;"/>
        <button id="retry-search" style="margin-left:0.5rem;">Пошук</button>
      </div>
      <p style="margin-top:0.5rem;"><a href="index.html" style="color:#ffd700;">На головну</a></p>
    `;
    document.getElementById('retry-search').addEventListener('click', () => {
      const val = document.getElementById('retry-nick').value.trim();
      if (val) location.href = `profile.html?nick=${encodeURIComponent(val)}`;
    });
  } else {
    err.querySelector('p').textContent = msg;
    err.style.display = 'block';
  }
}

function updateGamesLeft(used) {
  if (!gamesLeftEl) return;
  const left = Math.max(gameLimit - used, 0);
  gamesLeftEl.textContent = `Залишилось ${left} із ${gameLimit} ігор`;
}

async function renderGames(list, league) {
  const tbody = document.getElementById('games-body');
  const filterVal = document.getElementById('date-filter').value;
  tbody.innerHTML = '';
  const filtered = list.filter(g => !filterVal || (g.Timestamp && g.Timestamp.startsWith(filterVal)));
  const dates = [...new Set(filtered.map(g => {
    const d = new Date(g.Timestamp);
    return isNaN(d) ? '' : d.toISOString().split('T')[0];
  }))].filter(Boolean);

  for (const dt of dates) {
    if (!pdfCache[dt]) {
      try {
        const links = await getPdfLinks({ league, date: dt });
        pdfCache[dt] = links;
      } catch (err) {
        log('[ranking]', err);
        pdfCache[dt] = {};
      }
    }
  }

  filtered.forEach(g => {
    const d = new Date(g.Timestamp);
    const dateStr = isNaN(d) ? '' : d.toISOString().split('T')[0];
    const id = g.ID || g.Id || g.GameID || g.game_id || g.gameId || g.id || '';
    const tr = document.createElement('tr');
    const tdD = document.createElement('td');
    tdD.textContent = dateStr;
    const tdId = document.createElement('td');
    tdId.textContent = id;
    const tdPdf = document.createElement('td');
    const btn = document.createElement('button');
    const pdfUrl = (pdfCache[dateStr] || {})[id];
    if (pdfUrl) {
      btn.textContent = 'Переглянути звіт';
      btn.addEventListener('click', () => window.open(pdfUrl, '_blank'));
    } else {
      btn.textContent = 'Звіт відсутній';
      btn.disabled = true;
    }
    tdPdf.appendChild(btn);
    tr.appendChild(tdD);
    tr.appendChild(tdId);
    tr.appendChild(tdPdf);
    tbody.appendChild(tr);
  });
  updateGamesLeft(filtered.length);
}

function askKey(nick) {
  let box = document.getElementById('profile-key');
  if (!box) {
    box = document.createElement('div');
    box.id = 'profile-key';
    box.style.color = '#f39c12';
    box.style.textAlign = 'center';
    box.style.marginTop = '1rem';
    box.innerHTML = `
      <p>Потрібен ключ доступу</p>
      <div style="margin-top:0.5rem;">
        <input type="text" id="key-input" placeholder="Введіть ключ" style="padding:0.5rem;border:2px solid #555;background:rgba(0,0,0,0.5);color:#fff;border-radius:4px;font-size:0.7rem;"/>
        <button id="key-submit" style="margin-left:0.5rem;">OK</button>
      </div>
      <p style="margin-top:0.5rem;"><a href="index.html" style="color:#ffd700;">На головну</a></p>
    `;
    document.querySelector('nav').insertAdjacentElement('afterend', box);
    document.getElementById('key-submit').addEventListener('click', () => {
      const key = document.getElementById('key-input').value.trim();
      if (key) {
        localStorage.setItem(`profileKey:${nick}`, key);
        box.remove();
        loadProfile(nick, key);
      }
    });
  } else {
    box.style.display = 'block';
  }
  document.getElementById('profile').style.display = 'none';
}

async function loadProfile(nick, key = '') {
  currentNick = nick;
  let data;
  try {
    data = await getProfile({ nick, key });
    if (data.status === 'DENIED') {
      askKey(nick);
      return;
    }
  } catch (err) {
    log('[ranking]', err);
    showToast('Помилка завантаження профілю');
    showError('Помилка завантаження профілю');
    return;
  }
  const profile = data.profile || {};
  const league = data.league || profile.league || '';
  const games = await fetchPlayerGames(nick, league);
  const fetched = await fetchAvatar(nick);
  avatarUrl = fetched || DEFAULT_AVATAR_URL;
  const avatarEl = document.getElementById('avatar');
  avatarEl.src = fetched ? `${avatarUrl}?t=${Date.now()}` : DEFAULT_AVATAR_URL;
  const rank = computeRank(profile.points);
  document.getElementById('rating').textContent = `Рейтинг: ${profile.points} (${rank})`;
  const aboType = profile.abonement?.type || '';
  document.getElementById('abonement-type').textContent = `Абонемент: ${aboType}`;

  gameLimit = profile.gameLimit || { standart: 5, vip: 10 }[aboType] || 0;
  gamesLeftEl = document.getElementById('games-left');
  if (!gamesLeftEl) {
    gamesLeftEl = document.createElement('div');
    gamesLeftEl.id = 'games-left';
    gamesLeftEl.style.marginTop = '0.5rem';
    const filterEl = document.querySelector('.filter');
    filterEl.parentNode.insertBefore(gamesLeftEl, filterEl);
  }

  const fileInput = document.getElementById('avatar-input');
  document.getElementById('change-avatar').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const url = await uploadAvatar(nick, file);
      avatarUrl = url;
      document.getElementById('avatar').src = `${url}?t=${Date.now()}`;
      localStorage.setItem('avatarRefresh', nick + ':' + Date.now());
    } catch (err) {
      log('[ranking]', err);
      showToast('Помилка завантаження');
    }
  });

  await renderGames(games, league);
  document.getElementById('date-filter').addEventListener('change', () => renderGames(games, league));
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const nick = params.get('nick');
  if (!nick) {
    showError('Нік не вказано');
    return;
  }
  const key = localStorage.getItem(`profileKey:${nick}`) || '';
  currentNick = nick;
  loadProfile(nick, key);
});

function refreshAvatar() {
  const avatarEl = document.getElementById('avatar');
  if (avatarUrl && avatarUrl !== DEFAULT_AVATAR_URL) {
    avatarEl.src = `${avatarUrl}?t=${Date.now()}`;
  } else {
    avatarEl.src = DEFAULT_AVATAR_URL;
  }
}

window.addEventListener('storage', e => {
  if (e.key === 'avatarRefresh') {
    const [nick] = (e.newValue || '').split(':');
    if (nick === currentNick) refreshAvatar();
  }
});

