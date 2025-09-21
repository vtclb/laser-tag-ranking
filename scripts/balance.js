// scripts/balance.js

import { fetchLeagueCsv, parsePlayersFromCsv, saveResult } from './api.js';
import { autoBalance2 as autoBalanceTwo, autoBalanceN as autoBalanceMany } from './balanceUtils.js';
import { initAvatarAdmin } from './avatarAdmin.js';
import {
  state,
  setBalanceMode,
  setLeague,
  setLobbyPlayers,
  setPlayers,
  setTeams,
  setTeamsCount,
  getTeamMembers,
  getTeamKey,
  getTeamKeys,
  getTeamNumber,
  setTeamMembers,
} from './state.js';

let recomputeHandler = null;
let allPlayers = [];
const selectedCandidates = new Set();
let leagueSelectEl = null;
let playerListEl = null;
let addToLobbyBtnEl = null;
let manualInteractionsTeardown = null;
let manualDragNick = null;

export function getBalanceMode() {
  return state.balanceMode;
}

export function registerRecomputeAutoBalance(fn) {
  recomputeHandler = typeof fn === 'function' ? fn : null;
}

export async function recomputeAutoBalance() {
  if (typeof recomputeHandler === 'function') {
    try {
      await recomputeHandler();
    } catch (err) {
      console.error('[balance] recompute failed', err);
    }
  }
}

export function applyModeUI() {
  const autoBtn = document.getElementById('mode-auto');
  const manualBtn = document.getElementById('mode-manual');

  if (autoBtn) {
    autoBtn.classList.toggle('btn-primary', state.balanceMode === 'auto');
  }
  if (manualBtn) {
    manualBtn.classList.toggle('btn-primary', state.balanceMode === 'manual');
  }
  if (document.body) {
    document.body.dataset.balanceMode = state.balanceMode;
  }
}

export function addToLobby(playersToAdd = []) {
  const normalized = Array.isArray(playersToAdd)
    ? playersToAdd.filter(player => player && typeof player.nick === 'string')
    : [];

  if (!normalized.length) {
    console.debug('[balance] add', { added: [], lobbySize: state.lobbyPlayers.length });
    return state.lobbyPlayers;
  }

  const existing = new Set(state.lobbyPlayers.map(p => p.nick));
  const additions = normalized.filter(player => !existing.has(player.nick));

  if (!additions.length) {
    console.debug('[balance] add', { added: [], lobbySize: state.lobbyPlayers.length });
    return state.lobbyPlayers;
  }

  setLobbyPlayers([...state.lobbyPlayers, ...additions]);
  console.debug('[balance] add', {
    added: additions.map(p => p.nick),
    lobbySize: state.lobbyPlayers.length,
  });

  if (state.balanceMode === 'auto' && state.teamsCount > 0) {
    const teams = autoBalance(state.lobbyPlayers, state.teamsCount);
    setTeams(teams);
  }

  renderLobby();
  return state.lobbyPlayers;
}

export function renderLobby() {
  const lobbyContainer = document.getElementById('lobby-list');
  if (lobbyContainer) {
    lobbyContainer.innerHTML = '';
    state.lobbyPlayers.forEach(player => {
      const div = document.createElement('div');
      div.className = 'lobby-player';
      div.dataset.nick = player.nick;
      const pts = Number.isFinite(player.pts) ? player.pts : 0;
      const rank = player.rank || '';
      div.textContent = `${player.nick} · ${pts} pts${rank ? ` · ${rank}` : ''}`;
      if (canUseManualDrag()) {
        div.setAttribute('draggable', 'true');
      } else {
        div.removeAttribute('draggable');
      }
      lobbyContainer.appendChild(div);
    });
  }

  updateSummary();
  updatePlayersDatalist();
  updateTeamButtonsUI();
  renderTeams();

  if (isManualModeActive()) {
    enableManualInteractions();
  } else {
    disableManualInteractions();
  }

  console.debug('[balance] render', {
    lobbySize: state.lobbyPlayers.length,
    teamsCount: state.teamsCount,
    balanceMode: state.balanceMode,
  });
}

export function autoBalance(lobby, teamsCount) {
  const list = Array.isArray(lobby) ? lobby.filter(Boolean) : [];
  const count = Number.isInteger(teamsCount) ? teamsCount : 0;

  if (count <= 0 || !list.length) {
    const empty = {};
    for (let i = 1; i <= Math.max(0, count); i++) {
      empty[i] = [];
    }
    console.debug('[balance] auto', {
      lobbySize: list.length,
      teamsCount: count,
      result: empty,
    });
    return empty;
  }

  let result;
  if (count === 1) {
    result = { 1: [...list] };
  } else if (count === 2) {
    const { A, B } = autoBalanceTwo(list);
    result = { 1: [...A], 2: [...B] };
  } else {
    result = autoBalanceMany(list, count);
  }

  console.debug('[balance] auto', {
    lobbySize: list.length,
    teamsCount: count,
    result,
  });

  return result;
}

function updateSummary() {
  const total = state.lobbyPlayers.reduce((sum, player) => sum + (Number(player.pts) || 0), 0);
  const countEl = document.getElementById('lobby-count');
  const sumEl = document.getElementById('lobby-sum');
  const avgEl = document.getElementById('lobby-avg');

  if (countEl) countEl.textContent = state.lobbyPlayers.length;
  if (sumEl) sumEl.textContent = total;
  if (avgEl) avgEl.textContent = state.lobbyPlayers.length
    ? (total / state.lobbyPlayers.length).toFixed(1)
    : '0';
}

function updatePlayersDatalist() {
  const dl = document.getElementById('players-datalist');
  if (!dl) return;
  dl.innerHTML = '';
  const source = Array.isArray(allPlayers) && allPlayers.length ? allPlayers : state.lobbyPlayers;
  const seen = new Set();
  source.forEach(player => {
    const option = document.createElement('option');
    const nick = typeof player?.nick === 'string' ? player.nick.trim() : '';
    if (!nick || seen.has(nick)) return;
    seen.add(nick);
    option.value = nick;
    dl.appendChild(option);
  });
}

function updateTeamButtonsUI() {
  const buttons = document.querySelectorAll('[data-teams]');
  buttons.forEach(btn => {
    const val = parseInt(btn.dataset.teams, 10);
    const isActive = Number.isInteger(val) && val === state.teamsCount && state.teamsCount > 0;
    btn.classList.toggle('btn-primary', isActive);
  });
}

function renderTeams() {
  const container = document.getElementById('lobby');
  if (!container) return;

  const teamDivs = container.querySelectorAll('.team');
  teamDivs.forEach((teamDiv, index) => {
    const teamNumber = index + 1;
    const list = teamDiv.querySelector('.team-list');
    const sumEl = teamDiv.querySelector('[data-team-sum]');
    const teamAttr = teamDiv.dataset.team || `team${teamNumber}`;
    const members = getTeamMembers(teamAttr);
    const shouldShow = state.teamsCount >= teamNumber && state.teamsCount > 0;

    if (list) {
      list.innerHTML = '';
      list.dataset.team = teamAttr;
      members.forEach(player => {
        const li = document.createElement('li');
        li.className = 'team-player';
        li.dataset.nick = player.nick;
        li.textContent = `${player.nick} (${Number(player.pts) || 0})`;
        if (canUseManualDrag()) {
          li.setAttribute('draggable', 'true');
        } else {
          li.removeAttribute('draggable');
        }
        list.appendChild(li);
      });
    }

    if (sumEl) {
      const total = members.reduce((sum, player) => sum + (Number(player.pts) || 0), 0);
      sumEl.textContent = `∑ ${total}`;
    }

    teamDiv.classList.toggle('hidden', !shouldShow);
  });
}

function isManualModeActive() {
  return state.balanceMode === 'manual';
}

function canUseManualDrag() {
  return isManualModeActive() && state.teamsCount > 0;
}

function disableManualInteractions() {
  if (typeof manualInteractionsTeardown === 'function') {
    manualInteractionsTeardown();
    manualInteractionsTeardown = null;
  }
  manualDragNick = null;
}

function takePlayerFromCollections(nick) {
  const normalized = typeof nick === 'string' ? nick.trim() : '';
  if (!normalized) return null;

  const lobbyCopy = [...state.lobbyPlayers];
  const lobbyIndex = lobbyCopy.findIndex(player => player.nick === normalized);
  if (lobbyIndex !== -1) {
    const [player] = lobbyCopy.splice(lobbyIndex, 1);
    setLobbyPlayers(lobbyCopy);
    return player;
  }

  for (const key of getTeamKeys()) {
    const members = [...getTeamMembers(key)];
    const memberIndex = members.findIndex(player => player.nick === normalized);
    if (memberIndex !== -1) {
      const [player] = members.splice(memberIndex, 1);
      setTeamMembers(key, members);
      return player;
    }
  }

  return null;
}

function placePlayerInTarget(player, targetKey) {
  if (!player) return false;
  const rawTarget = typeof targetKey === 'string' ? targetKey : String(targetKey ?? '');
  if (!rawTarget || rawTarget === 'lobby' || rawTarget === 'lobby-list' || rawTarget === 'lobbyPlayers') {
    setLobbyPlayers([...state.lobbyPlayers, player]);
    return true;
  }

  const teamNumber = getTeamNumber(rawTarget);
  const teamKey = getTeamKey(rawTarget);

  if (!Number.isInteger(teamNumber) || teamNumber < 1 || teamNumber > state.teamsCount || !teamKey) {
    setLobbyPlayers([...state.lobbyPlayers, player]);
    return false;
  }

  const members = [...getTeamMembers(teamKey), player];
  setTeamMembers(teamKey, members);
  return true;
}

function movePlayerBetweenCollections(nick, targetKey) {
  const player = takePlayerFromCollections(nick);
  if (!player) return false;
  const success = placePlayerInTarget(player, targetKey);
  renderLobby();
  return success;
}

function enableManualInteractions() {
  if (manualInteractionsTeardown || typeof document === 'undefined') {
    return;
  }

  const lobbyContainer = document.getElementById('lobby-list');
  const teamLists = Array.from(document.querySelectorAll('.team-list'));

  if (!lobbyContainer) return;

  const dropTargets = [lobbyContainer, ...teamLists].filter(Boolean);
  const cleanups = [];

  const handleDragOver = event => {
    if (!isManualModeActive()) return;
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = event => {
    event.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = event => {
    if (!isManualModeActive()) return;
    event.preventDefault();
    const target = event.currentTarget;
    target.classList.remove('drag-over');
    const nick = (event.dataTransfer && event.dataTransfer.getData('text/plain')) || manualDragNick;
    manualDragNick = null;
    const targetKey = target.dataset.team || 'lobby';
    if (nick) {
      movePlayerBetweenCollections(nick, targetKey);
    }
  };

  dropTargets.forEach(target => {
    target.addEventListener('dragover', handleDragOver);
    target.addEventListener('dragleave', handleDragLeave);
    target.addEventListener('drop', handleDrop);
    cleanups.push(() => {
      target.removeEventListener('dragover', handleDragOver);
      target.removeEventListener('dragleave', handleDragLeave);
      target.removeEventListener('drop', handleDrop);
      target.classList.remove('drag-over');
    });
  });

  const handleDragStart = event => {
    if (!isManualModeActive()) return;
    const item = event.target.closest('.lobby-player, .team-player');
    if (!item) return;
    const nick = item.dataset.nick;
    if (!nick) return;
    if (!canUseManualDrag() && item.classList.contains('lobby-player')) {
      return;
    }
    manualDragNick = nick;
    item.classList.add('dragging');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', nick);
    }
  };

  const handleDragEnd = event => {
    manualDragNick = null;
    const item = event.target.closest('.lobby-player, .team-player');
    if (item) {
      item.classList.remove('dragging');
    }
  };

  document.addEventListener('dragstart', handleDragStart);
  document.addEventListener('dragend', handleDragEnd);
  cleanups.push(() => {
    document.removeEventListener('dragstart', handleDragStart);
    document.removeEventListener('dragend', handleDragEnd);
  });

  const handleTeamClick = event => {
    if (!isManualModeActive()) return;
    const element = event.target.closest('.team-player');
    if (!element) return;
    const nick = element.dataset.nick;
    if (nick) {
      movePlayerBetweenCollections(nick, 'lobby');
    }
  };

  teamLists.forEach(list => {
    if (!list) return;
    list.addEventListener('click', handleTeamClick);
    cleanups.push(() => list.removeEventListener('click', handleTeamClick));
  });

  manualInteractionsTeardown = () => {
    cleanups.forEach(fn => {
      try {
        fn();
      } catch (err) {
        console.error('[balance] manual cleanup failed', err);
      }
    });
    manualInteractionsTeardown = null;
  };
}

function runAutoBalance() {
  if (state.balanceMode !== 'auto') return;
  if (!state.lobbyPlayers.length) {
    setTeams({});
    renderLobby();
    return;
  }

  let count = state.teamsCount;
  if (!Number.isInteger(count) || count <= 0) {
    count = state.lobbyPlayers.length <= 1 ? 1 : 2;
    count = Math.min(4, Math.max(1, count));
    setTeamsCount(count);
  }

  const teams = autoBalance(state.lobbyPlayers, count);
  setTeams(teams);
  renderLobby();
}

function getSelectedNicksFromList() {
  const list = document.getElementById('player-list');
  if (!list) return [];
  return Array.from(list.querySelectorAll('input[type="checkbox"]:checked'))
    .map(input => input.value)
    .filter(Boolean);
}

function getPlayersByNicks(nicks) {
  if (!Array.isArray(nicks) || !nicks.length) return [];
  const lookup = new Map(allPlayers.map(player => [player.nick, player]));
  return nicks
    .map(nick => lookup.get(nick))
    .filter(Boolean)
    .map(player => ({ ...player }));
}

function sortPlayersAndRender(comparator) {
  if (typeof comparator !== 'function') return;

  const searchInput = document.getElementById('player-search');
  const searchTerm = searchInput ? searchInput.value : '';

  allPlayers.sort(comparator);
  setPlayers(allPlayers);
  renderPlayerList();

  if (searchInput) {
    searchInput.value = searchTerm;
    applySearchFilter(searchTerm || '');
  }
}

function sortPlayersByName() {
  sortPlayersAndRender((a, b) => a.nick.localeCompare(b.nick, 'uk'));
}

function sortPlayersByPtsDesc() {
  sortPlayersAndRender((a, b) => {
    const ptsA = Number.isFinite(a?.pts) ? a.pts : Number(a?.points) || 0;
    const ptsB = Number.isFinite(b?.pts) ? b.pts : Number(b?.points) || 0;
    if (ptsB !== ptsA) return ptsB - ptsA;
    return a.nick.localeCompare(b.nick, 'uk');
  });
}

export function renderPlayerList() {
  const area = document.getElementById('select-area');
  const list = playerListEl || document.getElementById('player-list');
  if (!list) return;

  playerListEl = list;
  if (area) area.classList.remove('hidden');

  list.innerHTML = '';
  allPlayers.forEach(player => {
    const label = document.createElement('label');
    label.className = 'player-option';
    label.dataset.nick = player.nick;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = player.nick;
    checkbox.checked = selectedCandidates.has(player.nick);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedCandidates.add(player.nick);
      else selectedCandidates.delete(player.nick);
    });

    const meta = document.createElement('div');
    meta.className = 'player-meta';
    const name = document.createElement('strong');
    name.textContent = player.nick;
    const stats = document.createElement('span');
    const ptsText = `${Number(player.pts) || 0} pts`;
    const rankText = player.rank ? ` · ${player.rank}` : '';
    stats.textContent = `${ptsText}${rankText}`;
    meta.append(name, stats);

    label.append(checkbox, meta);
    list.appendChild(label);
  });

  const searchInput = document.getElementById('player-search');
  if (searchInput) {
    applySearchFilter(searchInput.value || '');
  }

  console.debug('[balance] renderPlayerList', {
    total: allPlayers.length,
    selected: selectedCandidates.size,
  });
}

function applySearchFilter(term) {
  const list = document.getElementById('player-list');
  if (!list) return;
  const query = term.trim().toLowerCase();
  Array.from(list.querySelectorAll('.player-option')).forEach(option => {
    const nick = option.dataset.nick || '';
    option.classList.toggle('hidden', !!query && !nick.toLowerCase().includes(query));
  });
}

export async function loadPlayersForLeague(source) {
  const rawValue = typeof source === 'string'
    ? source
    : (source && 'value' in source ? source.value : state.league);
  const league = setLeague(rawValue);
  const csvLeague = typeof window !== 'undefined' && typeof window.uiLeagueToCsv === 'function'
    ? window.uiLeagueToCsv(rawValue)
    : league;

  if (leagueSelectEl && leagueSelectEl !== source) {
    leagueSelectEl.value = league;
  }

  console.debug('[balance] loadPlayersForLeague', { league, csvLeague });

  try {
    const csvText = await fetchLeagueCsv(csvLeague);
    allPlayers = parsePlayersFromCsv(csvText);
    allPlayers.sort((a, b) => a.nick.localeCompare(b.nick, 'uk'));
    setPlayers(allPlayers);
    await initAvatarAdmin(allPlayers, league);
    console.debug('[balance] loadPlayersForLeague success', {
      league,
      players: allPlayers.length,
    });
  } catch (err) {
    console.error('[balance] loadPlayersForLeague error', err);
    allPlayers = [];
    setPlayers([]);
    const msg = 'Не вдалося завантажити гравців для обраної ліги';
    if (typeof showToast === 'function') showToast(msg); else alert(msg);
    await initAvatarAdmin([], league);
  }

  selectedCandidates.clear();
  setLobbyPlayers([]);
  setTeamsCount(0);
  setTeams({});

  renderPlayerList();
  renderLobby();
  applyModeUI();
}

export function addSelectedToLobby() {
  const nicks = getSelectedNicksFromList();
  if (!nicks.length) {
    console.debug('[balance] addSelectedToLobby skipped');
    return;
  }

  const players = getPlayersByNicks(nicks);
  console.debug('[balance] addSelectedToLobby', { nicks, players: players.length });
  addToLobby(players);

  selectedCandidates.clear();
  renderPlayerList();
  const list = playerListEl || document.getElementById('player-list');
  if (list) {
    Array.from(list.querySelectorAll('input[type="checkbox"]')).forEach(input => {
      input.checked = false;
    });
  }
}

function handleModeSwitch(mode) {
  console.debug('[balance] handleModeSwitch', { mode });
  setBalanceMode(mode);
  applyModeUI();

  if (mode === 'auto') {
    disableManualInteractions();
    if (state.teamsCount <= 0) {
      const fallback = state.lobbyPlayers.length <= 1 ? 1 : 2;
      setTeamsCount(Math.min(4, Math.max(1, fallback)));
    }
    runAutoBalance();
  } else {
    enableManualInteractions();
    renderLobby();
  }
}

export function bindModeButtons({ autoButton, manualButton } = {}) {
  const autoBtn = autoButton || document.getElementById('mode-auto');
  const manualBtn = manualButton || document.getElementById('mode-manual');

  if (autoBtn) {
    autoBtn.addEventListener('click', () => handleModeSwitch('auto'));
  }
  if (manualBtn) {
    manualBtn.addEventListener('click', () => handleModeSwitch('manual'));
  }

  console.debug('[balance] bindModeButtons', {
    auto: !!autoBtn,
    manual: !!manualBtn,
  });

  return { autoBtn, manualBtn };
}

function handleTeamsButton(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) return;

  console.debug('[balance] handleTeamsButton', { teams: numeric });
  setTeamsCount(numeric);
  if (state.balanceMode === 'auto') {
    runAutoBalance();
  } else {
    renderLobby();
  }
  updateTeamButtonsUI();
}

export function bindTeamsCount(root = document) {
  const scope = root || document;
  const buttons = scope.querySelectorAll('[data-teams]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => handleTeamsButton(btn.dataset.teams));
  });

  console.debug('[balance] bindTeamsCount', { buttons: buttons.length });
  return buttons;
}

async function handleSaveGame() {
  const payload = {
    league: state.league,
    mode: state.balanceMode,
    teamsCount: state.teamsCount,
    lobby: state.lobbyPlayers.map(player => player.nick).join(', '),
  };

  for (let i = 1; i <= state.teamsCount; i++) {
    const members = getTeamMembers(i);
    payload[`team${i}`] = members.map(player => player.nick).join(', ');
  }
  payload.teamsJson = JSON.stringify(state.teams);

  let response;
  try {
    response = await saveResult(payload);
    console.debug('[balance] save', { payload, response });
  } catch (err) {
    console.debug('[balance] save', { payload, error: err });
    console.error('[balance] save failed', err);
    const msg = 'Не вдалося зберегти результат';
    if (typeof showToast === 'function') showToast(msg); else alert(msg);
    return;
  }

  const ok = !!(response && response.ok);
  if (!ok) {
    const message = response && typeof response === 'object' && 'message' in response
      ? response.message
      : 'Невідома помилка';
    const msg = `Помилка збереження: ${message}`;
    if (typeof showToast === 'function') showToast(msg); else alert(msg);
    return;
  }

  const successMessage = response && typeof response === 'object' && 'message' in response
    ? response.message
    : 'Результат успішно збережено';
  if (typeof showToast === 'function') showToast(successMessage); else alert(successMessage);

  if (Array.isArray(response?.players)) {
    const lookup = new Map(response.players.map(item => [item.nick, item]));
    const updated = state.lobbyPlayers.map(player => {
      const fresh = lookup.get(player.nick);
      if (!fresh) return player;
      const pts = Number.isFinite(fresh.pts) ? fresh.pts : Number(fresh.points);
      return {
        ...player,
        ...fresh,
        pts: Number.isFinite(pts) ? pts : player.pts,
      };
    });
    setLobbyPlayers(updated);
    renderLobby();
  }
}

function initSearch() {
  const searchInput = document.getElementById('player-search');
  if (!searchInput) return;
  searchInput.addEventListener('input', () => {
    applySearchFilter(searchInput.value || '');
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  leagueSelectEl = document.getElementById('league');
  playerListEl = document.getElementById('player-list');
  addToLobbyBtnEl = document.getElementById('add-to-lobby');

  if (leagueSelectEl) {
    leagueSelectEl.value = state.league;
    leagueSelectEl.addEventListener('change', () => loadPlayersForLeague(leagueSelectEl));
  }

  if (addToLobbyBtnEl) {
    addToLobbyBtnEl.addEventListener('click', addSelectedToLobby);
  }

  const loadBtn = document.getElementById('btn-load');
  if (loadBtn) {
    const originalText = loadBtn.textContent || '';
    loadBtn.addEventListener('click', async () => {
      const targetSelect = leagueSelectEl || document.getElementById('league');
      loadBtn.disabled = true;
      loadBtn.textContent = 'Завантаження...';

      try {
        await loadPlayersForLeague(targetSelect || state.league);
      } finally {
        loadBtn.disabled = false;
        loadBtn.textContent = originalText || 'Завантажити гравців';
      }
    });
  }

  const saveBtn = document.getElementById('save-game');
  if (saveBtn) {
    saveBtn.addEventListener('click', handleSaveGame);
  }

  const sortByNameBtn = document.getElementById('btn-sort-name');
  if (sortByNameBtn) {
    sortByNameBtn.addEventListener('click', sortPlayersByName);
  }

  const sortByPtsBtn = document.getElementById('btn-sort-pts');
  if (sortByPtsBtn) {
    sortByPtsBtn.addEventListener('click', sortPlayersByPtsDesc);
  }

  bindModeButtons({
    autoButton: document.getElementById('mode-auto'),
    manualButton: document.getElementById('mode-manual'),
  });
  bindTeamsCount();
  initSearch();

  registerRecomputeAutoBalance(runAutoBalance);
  applyModeUI();

  const initialLeague = leagueSelectEl || state.league;
  await loadPlayersForLeague(initialLeague);
  renderLobby();
});
