// scripts/lobby.js

import { initTeams, teams } from './teams.js';
import { sortByName, sortByPtsDesc } from './sortUtils.js';
import { updateAbonement } from './api.js';

export let lobby = [];
let players = [], filtered = [], selected = [], manualCount = 0;
const ABONEMENT_TYPES = ['none', 'lite', 'full'];

// Ініціалізує лоббі новим набором гравців
export function initLobby(pl) {
  players = pl;
  filtered = [...players];
  lobby = [];
  selected = [];
  manualCount = 0;
  const searchInput = document.getElementById('player-search');
  if (searchInput) searchInput.value = '';
  renderSelect(filtered);
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
});

// Встановлюємо кількість команд для ручного режиму
export function setManualCount(n) {
  manualCount = n;
  renderLobby();
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

  // Очистити лоббі
  document.getElementById('btn-clear-lobby').onclick = () => {
    lobby = [];
    renderLobby();
    renderSelect(filtered);
  };

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
}
