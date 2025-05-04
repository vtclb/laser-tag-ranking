// scripts/lobby.js

import { initTeams } from './teams.js';
import { sortByName, sortByPtsDesc } from './sortUtils.js';

export let lobby = [];
let players = [], filtered = [], selected = [], manualCount = 0;

// Ініціалізує лоббі новим набором гравців
export function initLobby(pl) {
  players = pl;
  filtered = [...players];
  lobby = [];
  selected = [];
  manualCount = 0;
  // Очищаємо поле пошуку
  const searchInput = document.getElementById('player-search');
  if (searchInput) searchInput.value = '';
  renderSelect(filtered);
  renderLobby();
}

// Рендер списку доступних гравців (filtered)
function renderSelect(arr) {
  document.getElementById('select-area').classList.remove('hidden');
  const ul = document.getElementById('select-list');
  ul.innerHTML = arr.map((p, i) => `
    <li>
      <label>
        <input type="checkbox" data-i="${i}" ${lobby.includes(p) ? 'disabled' : ''}>
        ${p.nick} (${p.pts}) – ${p.rank}
      </label>
    </li>
  `).join('');

  // Прив'язуємо зміни
  ul.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.onchange = () => {
      const p = arr[+cb.dataset.i];
      if (cb.checked) selected.push(p);
      else selected = selected.filter(x => x !== p);
    };
  });
}

// Після завантаження DOM — ставимо слухачі на кнопки та пошук
document.addEventListener('DOMContentLoaded', () => {
  // Пошук
  const searchInput = document.getElementById('player-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const term = searchInput.value.trim().toLowerCase();
      filtered = players.filter(p => p.nick.toLowerCase().includes(term));
      selected = [];
      renderSelect(filtered);
    });
  }

  // Сортування
  document.getElementById('btn-sort-name').onclick = () => {
    filtered = sortByName(filtered);
    renderSelect(filtered);
  };
  document.getElementById('btn-sort-pts').onclick = () => {
    filtered = sortByPtsDesc(filtered);
    renderSelect(filtered);
  };

  // Додавання вибраних у лоббі
  document.getElementById('btn-add-selected').onclick = () => {
    selected.forEach(p => { if (!lobby.includes(p)) lobby.push(p); });
    selected = [];
    renderLobby();
    renderSelect(filtered);
  };
  // Очищення вибору
  document.getElementById('btn-clear-selected').onclick = () => {
    selected = [];
    renderSelect(filtered);
  };
});

// Встановлюємо manualCount і оновлюємо лоббі
export function setManualCount(n) {
  manualCount = n;
  renderLobby();
}

// Рендер самої таблиці лоббі
function renderLobby() {
  const tbody = document.getElementById('lobby-list');
  tbody.innerHTML = lobby.map((p, i) => `
    <tr>
      <td>${p.nick}</td>
      <td>${p.pts}</td>
      <td>${p.rank}</td>
      <td>
        ${[...Array(manualCount)].map((_, k) =>
          `<button class="assign" data-i="${i}" data-team="${k+1}">→${k+1}</button>`
        ).join('')}
        <button class="remove-lobby" data-i="${i}">✕</button>
      </td>
    </tr>
  `).join('');

  // Оновлення статистики
  const total = lobby.reduce((s, p) => s + p.pts, 0);
  document.getElementById('lobby-count').textContent = lobby.length;
  document.getElementById('lobby-sum').textContent   = total;
  document.getElementById('lobby-avg').textContent   = lobby.length ? (total / lobby.length).toFixed(1) : '0';

  // Кнопка очищення лоббі
  const btnClearLobby = document.getElementById('btn-clear-lobby');
  btnClearLobby.onclick = () => {
    lobby = [];
    renderLobby();
    renderSelect(filtered);
  };

  // Прив'язуємо assign
  tbody.querySelectorAll('.assign').forEach(btn => {
    btn.onclick = () => {
      const i = +btn.dataset.i;
      const teamNo = +btn.dataset.team;
      const p = lobby.splice(i, 1)[0];
      initTeams(manualCount, { [teamNo]: [...(window.teams[teamNo] || []), p] });
      renderLobby();
      renderSelect(filtered);
    };
  });

  // Прив'язуємо видалення з лоббі
  tbody.querySelectorAll('.remove-lobby').forEach(btn => {
    btn.onclick = () => {
      const i = +btn.dataset.i;
      lobby.splice(i, 1);
      renderLobby();
      renderSelect(filtered);
    };
  });
}
