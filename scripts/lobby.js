// scripts/lobby.js

import { initTeams, teams } from './teams.js';
import { sortByName, sortByPtsDesc } from './sortUtils.js';
import { updateAbonement, fetchPlayerData, adminCreatePlayer, issueAccessKey } from './api.js';
import { saveLobbyState, loadLobbyState, getLobbyStorageKey } from './state.js';

export let lobby = [];
let players = [], filtered = [], selected = [], manualCount = 0;
const ABONEMENT_TYPES = ['none', 'lite', 'full'];

let uiLeague = 'sunday';

async function addPlayer(nick){
  if(!nick) return;
  const res = await fetchPlayerData(nick);
  lobby.push({...res, team:null});
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
    searchInput.addEventListener('input', () => {
      const term = searchInput.value.trim().toLowerCase();
      filtered = players.filter(p => p.nick.toLowerCase().includes(term));
      selected = [];
      renderSelect(filtered);
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

  const createBtn = document.getElementById('btn-create-player');
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

// Рендер лоббі
function renderLobby() {
  const tbody = document.getElementById('lobby-list');
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

  const total = lobby.reduce((s, p) => s + p.pts, 0);
  document.getElementById('lobby-count').textContent = lobby.length;
  document.getElementById('lobby-sum').textContent   = total;
  document.getElementById('lobby-avg').textContent   = lobby.length ? (total / lobby.length).toFixed(1) : '0';

  // Прив'язуємо assign — додаємо гравця в ту команду, не втрачаючи інших
  tbody.querySelectorAll('.assign').forEach(btn => {
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
  tbody.querySelectorAll('.remove-lobby').forEach(btn => {
    btn.onclick = () => {
      const idx = +btn.dataset.i;
      lobby.splice(idx, 1);
      renderLobby();
      renderSelect(filtered);
    };
  });

  // Оновлення типу абонемента
  tbody.querySelectorAll('.abonement-select').forEach(sel => {
    const idx = +sel.dataset.i;
    const player = lobby[idx];
    sel.value = player.abonement || 'none';
    sel.onchange = async () => {
      const newType = sel.value;
      try {
        await updateAbonement(player.nick, newType);
        player.abonement = newType;
        const full = players.find(p => p.nick === player.nick);
        if (full) full.abonement = newType;
        alert('Абонемент оновлено');
      } catch (err) {
        sel.value = player.abonement || 'none';
        alert('Помилка оновлення абонемента');
      }
    };
  });

  saveLobbyState({lobby, teams, manualCount, league: uiLeague});
}

document.addEventListener('click', async e => {
  const btn = e.target.closest('.btn-issue-key');
  if (!btn) return;
  const nick = btn.dataset.nick;
  try {
    const key = await issueAccessKey({ nick, league: uiLeague });
    const cell = btn.closest('tr')?.querySelector('.access-key');
    if (cell) cell.textContent = key;
  } catch (err) {
    alert('Не вдалося видати ключ');
  }
});

document.getElementById('clear-lobby')?.addEventListener('click', clearLobby);
