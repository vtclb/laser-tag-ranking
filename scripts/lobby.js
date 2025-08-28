// scripts/lobby.js

import { initTeams, teams } from './teams.js';
import { sortByName, sortByPtsDesc } from './sortUtils.js';
import { updateAbonement, adminCreatePlayer, issueAccessKey, getAvatarUrl, getProfile } from './api.js';
import { saveLobbyState, loadLobbyState, getLobbyStorageKey } from './state.js';

export let lobby = [];
let players = [], filtered = [], selected = [], manualCount = 0;
const ABONEMENT_TYPES = ['none', 'lite', 'full'];

let uiLeague = 'sunday';

const DEFAULT_AVATAR_URL = 'assets/default_avatars/av0.png';
const AVATAR_TTL = 6 * 60 * 60 * 1000;

async function fetchAvatar(nick) {
  const key = `avatar:${nick}`;
  const now = Date.now();
  try {
    const cached = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (cached && now - cached.time < AVATAR_TTL) return cached.url;
  } catch {}
  try {
    const url = await getAvatarUrl(nick);
    if (url) sessionStorage.setItem(key, JSON.stringify({ url, time: now }));
    return url;
  } catch {
    return null;
  }
}

async function setAvatar(img, nick) {
  img.dataset.nick = nick;
  const url = await fetchAvatar(nick);
  img.src = url ? `${url}?t=${Date.now()}` : DEFAULT_AVATAR_URL;
  img.onerror = () => {
    img.onerror = null;
    img.src = DEFAULT_AVATAR_URL;
  };
}

async function addPlayer(nick){
  if(!nick) return;
  if (lobby.some(p => p.nick === nick)) {
    alert('Гравець вже у лобі');
    return;
  }
  let res = players.find(p => p.nick === nick);
  if (!res) {
    try {
      const data = await getProfile({ nick });
      const profile = data && data.profile;
      if (profile) {
        const pts = Number(profile.points || 0);
        const rank = pts < 200 ? 'D' : pts < 500 ? 'C' : pts < 800 ? 'B' : pts < 1200 ? 'A' : 'S';
        res = { nick, pts, rank, abonement: profile.abonement?.type || 'none' };
      }
    } catch {}
  }
  if (!res) {
    alert('Гравця не знайдено');
    return;
  }
  lobby.push({ ...res, team: null });
  renderLobby();
}

// Ініціалізує лоббі новим набором гравців
export function initLobby(pl, league = uiLeague) {
  uiLeague = String(league || '').toLowerCase() === 'kids' ? 'kids' : 'sunday';
  players = pl;
  filtered = [...players];
  const saved = loadLobbyState(uiLeague);
  lobby = saved?.lobby || [];
  manualCount = saved?.manualCount || 0;
  selected = [];
  const searchInput = document.getElementById('player-search');
  if (searchInput) searchInput.value = '';
  if (manualCount > 0) {
    initTeams(manualCount, saved?.teams || {});
  }
  renderSelect(filtered);
  renderLobby();
}

export function updateLobbyState(updates){
  updates.forEach(u=>{
    const norm = {nick:u.nick};
    if(u.points!==undefined) norm.pts = u.points;
    if(u.pts!==undefined)    norm.pts = u.pts;
    if(u.rank!==undefined)   norm.rank = u.rank;

    const pAll = players.find(x=>x.nick===u.nick);
    if(pAll) Object.assign(pAll, norm);
    const pLobby = lobby.find(x=>x.nick===u.nick);
    if(pLobby) Object.assign(pLobby, norm);
    Object.keys(teams).forEach(k=>{
      const tp = teams[k].find(x=>x.nick===u.nick);
      if(tp) Object.assign(tp, norm);
    });
  });
  const teamCount = Object.keys(teams).length;
  if(teamCount) initTeams(teamCount, teams);
  renderLobby();
}

// Рендер списку доступних гравців
function renderSelect(arr) {
  document.getElementById('select-area').classList.remove('hidden');
  const ul = document.getElementById('select-list');
  ul.innerHTML = arr.map((p, i) => `
    <li>
      <label>
        <input
          type="checkbox"
          data-i="${i}"
          ${lobby.includes(p) || Object.values(teams).flat().includes(p) ? 'disabled' : ''}
        >
        ${p.nick} (${p.pts}) – ${p.rank}
      </label>
    </li>
  `).join('');

  ul.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.onchange = () => {
      const p = arr[+cb.dataset.i];
      if (cb.checked) selected.push(p);
      else selected = selected.filter(x => x !== p);
    };
  });
}

// Слухачі кнопок та пошуку
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('player-search');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const term = searchInput.value.trim().toLowerCase();
        filtered = players.filter(p => p.nick.toLowerCase().includes(term));
        selected = [];
        renderSelect(filtered);
      }, 300);
    });
  }

  document.getElementById('btn-sort-name').onclick = () => {
    filtered = sortByName(filtered);
    renderSelect(filtered);
  };

  document.getElementById('btn-sort-pts').onclick = () => {
    filtered = sortByPtsDesc(filtered);
    renderSelect(filtered);
  };

  document.getElementById('btn-add-selected').onclick = () => {
    selected.forEach(p => {
      if (!lobby.includes(p)) lobby.push(p);
    });
    selected = [];
    renderLobby();
    renderSelect(filtered);
  };

  document.getElementById('btn-clear-selected').onclick = () => {
    selected = [];
    renderSelect(filtered);
  };

  const addPlayerInput = document.getElementById('addPlayerInput');
  const addPlayerBtn = document.getElementById('addPlayerBtn');
  if(addPlayerInput && addPlayerBtn){
    addPlayerBtn.addEventListener('click', () => {
      addPlayer(addPlayerInput.value.trim());
    });
  }

  const createBtn = document.getElementById('btn-create');
  const newNick = document.getElementById('new-nick');
  const newAge  = document.getElementById('new-age');
  if (createBtn && newNick && newAge) {
    createBtn.addEventListener('click', async () => {
      const nick = newNick.value.trim();
      if (!nick) return;
      const age = parseInt(newAge.value, 10) || 0;
      try {
        const status = await adminCreatePlayer({ league: uiLeague, nick, age });
        if (status === 'DUPLICATE') {
          alert('Такий нік вже існує');
          return;
        }
        if (status === 'OK') {
          const newPlayer = { nick, pts: 0, rank: 'D', abonement: 'none' };
          players.push(newPlayer);
          filtered.push(newPlayer);
          renderSelect(filtered);
          newNick.value = '';
          newAge.value = '';
        } else {
          alert('Не вдалося створити гравця');
        }
      } catch (err) {
        alert('Не вдалося створити гравця');
      }
    });
  }
});

// Встановлюємо кількість команд для ручного режиму
export function setManualCount(n) {
  manualCount = n;
  renderLobby();
}

export function clearLobby() {
  lobby.length = 0;
  Object.keys(teams).forEach(k => { teams[k].length = 0; });

  localStorage.removeItem(getLobbyStorageKey(undefined, uiLeague));

  renderLobby();
  renderTeams();
  updateSummary();
}

function renderTeams() {
  const area = document.getElementById('teams-area');
  if (area) area.innerHTML = '';
}

function updateSummary() {
  const total = lobby.reduce((s, p) => s + p.pts, 0);
  const countEl = document.getElementById('lobby-count');
  const sumEl   = document.getElementById('lobby-sum');
  const avgEl   = document.getElementById('lobby-avg');
  if (countEl) countEl.textContent = lobby.length;
  if (sumEl)   sumEl.textContent   = total;
  if (avgEl)   avgEl.textContent   = lobby.length ? (total / lobby.length).toFixed(1) : '0';
}

function playerHtml(p) {
  return `
    <div class="player" data-nick="${p.nick}" draggable="true">
      <img class="player__avatar" src="${DEFAULT_AVATAR_URL}" alt="avatar">
      <div class="player__meta">
        <div class="player__name">${p.nick}</div>
        <div class="player__points">${p.pts} pts</div>
      </div>
      <div class="player__drag">≡</div>
    </div>
  `;
}

function renderPlayerList(el, arr) {
  if (!el) return;
  el.innerHTML = arr.map(playerHtml).join('');
  el.querySelectorAll('.player').forEach(div => {
    const img = div.querySelector('.player__avatar');
    setAvatar(img, div.dataset.nick);
  });
}

function setupDnD(containers) {
  containers.forEach(c => {
    c.addEventListener('dragover', e => e.preventDefault());
    c.addEventListener('drop', e => {
      e.preventDefault();
      const nick = e.dataTransfer.getData('text/plain');
      movePlayer(nick, c.id);
    });
  });

  containers.forEach(c => {
    c.querySelectorAll('.player').forEach(p => {
      p.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', p.dataset.nick);
      });
    });
  });
}

function takePlayer(nick) {
  let idx = lobby.findIndex(p => p.nick === nick);
  if (idx !== -1) return lobby.splice(idx, 1)[0];
  if (!teams[1]) teams[1] = [];
  if (!teams[2]) teams[2] = [];
  idx = teams[1].findIndex(p => p.nick === nick);
  if (idx !== -1) return teams[1].splice(idx, 1)[0];
  idx = teams[2].findIndex(p => p.nick === nick);
  if (idx !== -1) return teams[2].splice(idx, 1)[0];
  return null;
}

function movePlayer(nick, targetId) {
  const p = takePlayer(nick);
  if (!p) return;
  if (targetId === 'lobby-list') lobby.push(p);
  else if (targetId === 'team-a') teams[1].push(p);
  else if (targetId === 'team-b') teams[2].push(p);
  renderLobby();
}

// Рендер лоббі
function renderLobby() {
  const lobbyEl = document.getElementById('lobby-list');
  const teamAEl = document.getElementById('team-a');
  const teamBEl = document.getElementById('team-b');
  if (teamAEl || teamBEl) {
    teams[1] = teams[1] || [];
    teams[2] = teams[2] || [];
    renderPlayerList(lobbyEl, lobby);
    renderPlayerList(teamAEl, teams[1]);
    renderPlayerList(teamBEl, teams[2]);
    setupDnD([lobbyEl, teamAEl, teamBEl].filter(Boolean));
    updateSummary();
    saveLobbyState({ lobby, teams, manualCount, league: uiLeague });
    return;
  }

  const tbody = lobbyEl;
  tbody.innerHTML = lobby.map((p, i) => `
    <tr>
      <td>${p.nick}</td>
      <td>${p.pts}</td>
      <td>${p.rank}</td>
      <td>
        <select class="abonement-select" data-i="${i}">
          ${ABONEMENT_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </td>
      <td><button class="btn-issue-key" data-nick="${p.nick}">Видати ключ</button></td>
      <td class="access-key"></td>
      <td>
        ${[...Array(manualCount)].map((_, k) =>
          `<button class="assign" data-i="${i}" data-team="${k+1}">→${k+1}</button>`
        ).join('')}
        <button class="remove-lobby" data-i="${i}">✕</button>
      </td>
    </tr>
  `).join('');

  const cards = document.querySelector('.bal__players');
  if (cards) {
    cards.innerHTML = lobby.map((p, i) => `
      <div class="player">
        <div class="row"><span class="nick">${p.nick}</span><span class="pts">${p.pts}</span></div>
        <div class="row"><span class="rank">${p.rank}</span><span class="season">${p.abonement || ''}</span></div>
        <div class="row">
          <span class="key"><button class="btn-issue-key" data-nick="${p.nick}">Видати ключ</button><span class="access-key"></span></span>
          <span class="actions">
            ${[...Array(manualCount)].map((_, k) =>
              `<button class="assign" data-i="${i}" data-team="${k+1}">→${k+1}</button>`
            ).join('')}
            <button class="remove-lobby" data-i="${i}">✕</button>
          </span>
        </div>
      </div>
    `).join('');
  }

  const total = lobby.reduce((s, p) => s + p.pts, 0);
  document.getElementById('lobby-count').textContent = lobby.length;
  document.getElementById('lobby-sum').textContent   = total;
  document.getElementById('lobby-avg').textContent   = lobby.length ? (total / lobby.length).toFixed(1) : '0';

  const containers = [tbody, cards].filter(Boolean);

  // Прив'язуємо assign — додаємо гравця в ту команду, не втрачаючи інших
  containers.forEach(container => {
    container.querySelectorAll('.assign').forEach(btn => {
      btn.onclick = () => {
        const idx = +btn.dataset.i;
        const teamNo = +btn.dataset.team;
        const p = lobby.splice(idx, 1)[0];

        // Створюємо копію всіх існуючих команд
        const preset = {};
        Object.keys(teams).forEach(key => {
          preset[key] = [...teams[key]];
        });
        // Додаємо гравця в обрану команду
        preset[teamNo] = preset[teamNo] || [];
        preset[teamNo].push(p);

        // Ререндеримо всі команди
        initTeams(manualCount, preset);
        renderLobby();
        renderSelect(filtered);
      };
    });

    // Видалити з лоббі
    container.querySelectorAll('.remove-lobby').forEach(btn => {
      btn.onclick = () => {
        const idx = +btn.dataset.i;
        lobby.splice(idx, 1);
        renderLobby();
        renderSelect(filtered);
      };
    });

    // Оновлення типу абонемента
    container.querySelectorAll('.abonement-select').forEach(sel => {
      const idx = +sel.dataset.i;
      const player = lobby[idx];
      sel.value = player.abonement || 'none';
      sel.onchange = async () => {
        const newType = sel.value;
        const prevType = player.abonement || 'none';
        try {
          const res = await updateAbonement({ nick: player.nick, league: uiLeague, type: newType });
          if (res !== 'OK' && res?.status !== 'OK') throw new Error('Failed');
          player.abonement = newType;
          const full = players.find(p => p.nick === player.nick);
          if (full) full.abonement = newType;
          alert('Абонемент оновлено');
        } catch (err) {
          sel.value = prevType;
          alert('Помилка оновлення абонемента');
        }
      };
    });
  });

  saveLobbyState({lobby, teams, manualCount, league: uiLeague});
}

document.addEventListener('click', async e => {
  const btn = e.target.closest('.btn-issue-key');
  if (!btn) return;
  const nick = btn.dataset.nick;
  try {
    const key = await issueAccessKey({ nick, league: uiLeague });
    const host = btn.closest('tr') || btn.closest('.player');
    const cell = host?.querySelector('.access-key');
    if (cell) cell.textContent = key;
  } catch (err) {
    alert('Не вдалося видати ключ');
  }
});

document.getElementById('btn-clear-lobby')?.addEventListener('click', clearLobby);
document.getElementById('btn-clear-lobby-dup')?.addEventListener('click', clearLobby);

// Mobile shell
(() => {
  if (window.__balMobileInit) return;
  window.__balMobileInit = true;

  if (typeof window.clearLobby !== 'function') {
    window.clearLobby = clearLobby;
  }

  const burger  = document.getElementById('ui-burger');
  const panel   = document.getElementById('ui-panel');
  const overlay = document.getElementById('ui-overlay');

  const closePanel = () => {
    if (panel) panel.hidden = true;
    if (overlay) overlay.hidden = true;
  };
  const openPanel = () => {
    if (panel) panel.hidden = false;
    if (overlay) overlay.hidden = false;
  };

  burger?.addEventListener('click', openPanel);
  overlay?.addEventListener('click', closePanel);
  panel?.addEventListener('click', e => e.stopPropagation());

  document.getElementById('ui-clear-lobby')?.addEventListener('click', () => {
    if (typeof window.clearLobby === 'function') window.clearLobby();
    else {
      document.getElementById('lobby-list')?.replaceChildren();
      document.querySelector('.bal__players')?.replaceChildren();
    }
    closePanel();
  });

  const fixVh = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };
  fixVh();
  window.addEventListener('resize', fixVh);
})();
