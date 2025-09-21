// scripts/balance.js

import {
  fetchLeagueCsv,
  parsePlayersFromCsv,
  saveResult,
  saveDetailedStats,
  normalizeLeague,
  safeSet,
} from './api.js?v=2025-09-19-balance-hotfix-1';
import { autoBalance2 as autoBalanceTwo, autoBalanceN as autoBalanceMany } from './balanceUtils.js?v=2025-09-19-balance-hotfix-1';
import { initAvatarAdmin } from './avatarAdmin.js?v=2025-09-19-balance-hotfix-1';
import { parseGamePdf } from './pdfParser.js?v=2025-09-19-balance-hotfix-1';
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
} from './state.js?v=2025-09-19-balance-hotfix-1';

let recomputeHandler = null;
let allPlayers = [];
const selectedCandidates = new Set();
let leagueSelectEl = null;
let playerListEl = null;
let addToLobbyBtnEl = null;
let manualInteractionsTeardown = null;
let manualDragNick = null;
let scenarioSectionEl = null;
let scenarioAreaEl = null;
let scenarioAutoBtnEl = null;
let scenarioManualBtnEl = null;
let teamSizeSelectEl = null;
let arenaSelectEl = null;
let arenaCheckboxesEl = null;
let arenaStartBtnEl = null;
let arenaAreaEl = null;
let arenaVsEl = null;
let arenaRoundsEl = null;
let arenaPenaltyInputEl = null;
let arenaSaveBtnEl = null;
let arenaClearBtnEl = null;
let arenaMvpInputs = [];
let pdfInputEl = null;
let parsePdfBtnEl = null;
let arenaActiveTeams = [];
let isArenaDatalistLocked = false;
let arenaDatalistBackup = '';
let lastSavedMatchId = null;
let isArenaActive = false;
const ARENA_ROUNDS = [1, 2, 3];

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

  renderArenaCheckboxes();
  updateStartButtonState();

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
  if (isArenaDatalistLocked) return;
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

function lockArenaDatalist(nicks = []) {
  const dl = document.getElementById('players-datalist');
  if (!dl) return;
  if (!isArenaDatalistLocked) {
    arenaDatalistBackup = dl.innerHTML;
  }
  isArenaDatalistLocked = true;
  const options = Array.from(new Set(nicks.filter(Boolean)));
  dl.innerHTML = options.map(nick => `<option value="${nick}"></option>`).join('');
}

function unlockArenaDatalist() {
  const dl = document.getElementById('players-datalist');
  if (!dl) {
    isArenaDatalistLocked = false;
    arenaDatalistBackup = '';
    return;
  }
  if (isArenaDatalistLocked) {
    dl.innerHTML = arenaDatalistBackup || '';
  }
  isArenaDatalistLocked = false;
  arenaDatalistBackup = '';
  updatePlayersDatalist();
}

function applyPlayerUpdates(updates = []) {
  if (!Array.isArray(updates) || !updates.length) {
    return false;
  }

  let changed = false;
  const processed = new Set();

  const getPtsValue = update => {
    const candidates = [update?.pts, update?.points];
    for (const candidate of candidates) {
      if (candidate === undefined || candidate === null || candidate === '') continue;
      const numeric = Number(candidate);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }
    return null;
  };

  const assignValues = (player, update) => {
    if (!player || typeof player !== 'object') return false;
    let mutated = false;
    const ptsValue = getPtsValue(update);
    if (Number.isFinite(ptsValue) && player.pts !== ptsValue) {
      player.pts = ptsValue;
      mutated = true;
    }
    if (typeof update?.rank === 'string' && player.rank !== update.rank) {
      player.rank = update.rank;
      mutated = true;
    }
    Object.entries(update || {}).forEach(([key, value]) => {
      if (key === 'nick' || key === 'points' || value === undefined) return;
      if (player[key] !== value) {
        player[key] = value;
        mutated = true;
      }
    });
    if (update?.points !== undefined && !Number.isFinite(ptsValue)) {
      const ptsFromPoints = Number(update.points);
      if (Number.isFinite(ptsFromPoints) && player.pts !== ptsFromPoints) {
        player.pts = ptsFromPoints;
        mutated = true;
      }
    }
    return mutated;
  };

  const updateArray = (array, update) => {
    if (!Array.isArray(array) || !array.length) return false;
    let mutated = false;
    array.forEach(player => {
      if (player?.nick === update.nick) {
        if (assignValues(player, update)) mutated = true;
      }
    });
    return mutated;
  };

  updates.forEach(update => {
    const nick = typeof update?.nick === 'string' ? update.nick.trim() : '';
    if (!nick || processed.has(nick)) return;
    processed.add(nick);

    if (updateArray(allPlayers, update)) changed = true;
    if (updateArray(state.players, update)) changed = true;
    if (updateArray(state.lobbyPlayers, update)) changed = true;
    getTeamKeys().forEach(key => {
      if (updateArray(state.teams[key], update)) changed = true;
    });
  });

  return changed;
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

  resetArenaUI();

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

function ensureScenarioSectionVisible() {
  if (scenarioSectionEl) {
    scenarioSectionEl.removeAttribute('hidden');
  }
  if (scenarioAreaEl) {
    scenarioAreaEl.classList.remove('hidden');
  }
  updateArenaSelectVisibility();
}

function updateArenaSelectVisibility() {
  if (!arenaSelectEl) return;
  const shouldShow = Number.isInteger(state.teamsCount) && state.teamsCount >= 2;
  arenaSelectEl.classList.toggle('hidden', !shouldShow);
}

function renderArenaCheckboxes() {
  if (!arenaCheckboxesEl) return;

  const validSelection = arenaActiveTeams.filter(teamKey => {
    const teamNumber = getTeamNumber(teamKey);
    return Number.isInteger(teamNumber) && teamNumber <= state.teamsCount;
  });
  arenaActiveTeams = validSelection;

  arenaCheckboxesEl.innerHTML = '';
  for (let index = 1; index <= state.teamsCount; index++) {
    const teamKey = getTeamKey(index);
    if (!teamKey) continue;

    const members = getTeamMembers(teamKey);
    const sum = members.reduce((acc, player) => acc + (Number(player?.pts) || 0), 0);

    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'arena-team';
    checkbox.dataset.team = teamKey;
    checkbox.checked = arenaActiveTeams.includes(teamKey);
    checkbox.disabled = isArenaActive;
    checkbox.addEventListener('change', updateStartButtonState);
    label.appendChild(checkbox);
    label.insertAdjacentText('beforeend', ` Команда ${index} (∑ ${sum})`);
    arenaCheckboxesEl.appendChild(label);
  }

  updateArenaSelectVisibility();
}

function updateStartButtonState() {
  if (!arenaStartBtnEl) return;
  if (isArenaActive) {
    arenaStartBtnEl.disabled = true;
    return;
  }
  const totalChecked = arenaCheckboxesEl
    ? arenaCheckboxesEl.querySelectorAll('.arena-team:checked').length
    : 0;
  arenaStartBtnEl.disabled = totalChecked !== 2;
}

function resetArenaUI({ keepCheckboxState = false } = {}) {
  if (arenaAreaEl) {
    arenaAreaEl.classList.add('hidden');
  }
  if (arenaRoundsEl) {
    arenaRoundsEl.innerHTML = '';
  }
  arenaMvpInputs.forEach(input => {
    if (input) input.value = '';
  });
  if (arenaPenaltyInputEl) {
    arenaPenaltyInputEl.value = '';
  }
  if (!keepCheckboxState && arenaCheckboxesEl) {
    Array.from(arenaCheckboxesEl.querySelectorAll('.arena-team')).forEach(cb => {
      cb.checked = false;
    });
    arenaActiveTeams = [];
  }
  if (arenaSaveBtnEl) {
    arenaSaveBtnEl.disabled = true;
  }
  if (pdfInputEl) {
    pdfInputEl.value = '';
  }
  if (parsePdfBtnEl) {
    parsePdfBtnEl.disabled = true;
  }
  unlockArenaDatalist();
  isArenaActive = false;
  if (!keepCheckboxState) {
    updateStartButtonState();
  }
}

function getArenaSelectedTeamKeys() {
  if (!arenaCheckboxesEl) return [];
  const raw = Array.from(arenaCheckboxesEl.querySelectorAll('.arena-team:checked'))
    .map(cb => getTeamKey(cb.dataset.team))
    .filter(Boolean);
  return Array.from(new Set(raw));
}

function buildArenaRounds(teamKeys) {
  if (!arenaRoundsEl) return;
  arenaRoundsEl.innerHTML = '';
  teamKeys.forEach((teamKey, index) => {
    const teamNumber = getTeamNumber(teamKey);
    const wrapper = document.createElement('div');
    wrapper.className = 'arena-round-block';
    const header = document.createElement('h4');
    header.textContent = `Команда ${teamNumber}`;
    wrapper.appendChild(header);
    ARENA_ROUNDS.forEach(round => {
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = `round-${round}-${index === 0 ? 'a' : 'b'}`;
      label.appendChild(checkbox);
      label.insertAdjacentText('beforeend', ` Раунд ${round}`);
      wrapper.appendChild(label);
    });
    arenaRoundsEl.appendChild(wrapper);
  });
}

function handleScenarioAutoClick() {
  if (!teamSizeSelectEl) return;
  const size = parseInt(teamSizeSelectEl.value, 10);
  if (!Number.isInteger(size) || size <= 0) return;
  setTeamsCount(size);
  handleModeSwitch('auto');
  renderArenaCheckboxes();
  updateStartButtonState();
}

function handleScenarioManualClick() {
  if (!teamSizeSelectEl) return;
  const size = parseInt(teamSizeSelectEl.value, 10);
  if (!Number.isInteger(size) || size <= 0) return;
  setTeamsCount(size);
  handleModeSwitch('manual');
  renderArenaCheckboxes();
  updateStartButtonState();
}

function handleArenaCheckboxClick() {
  updateStartButtonState();
}

function handleStartMatch() {
  const selected = getArenaSelectedTeamKeys();
  if (selected.length !== 2) {
    alert('Виберіть дві команди для бою');
    return;
  }

  const membersA = getTeamMembers(selected[0]);
  const membersB = getTeamMembers(selected[1]);
  if (!membersA.length || !membersB.length) {
    alert('Обрані команди мають містити гравців');
    return;
  }

  resetArenaUI({ keepCheckboxState: true });
  arenaActiveTeams = selected;
  isArenaActive = true;

  const numbers = selected.map(key => getTeamNumber(key));
  if (arenaVsEl) {
    arenaVsEl.textContent = `Команда ${numbers[0]} ✕ Команда ${numbers[1]}`;
  }
  buildArenaRounds(selected);
  if (arenaAreaEl) {
    arenaAreaEl.classList.remove('hidden');
  }
  if (arenaSaveBtnEl) {
    arenaSaveBtnEl.disabled = false;
  }
  const nickOptions = [...membersA, ...membersB]
    .map(player => player?.nick)
    .filter(Boolean);
  lockArenaDatalist(nickOptions);
  updateStartButtonState();
  if (parsePdfBtnEl) {
    parsePdfBtnEl.disabled = !pdfInputEl || !(pdfInputEl.files && pdfInputEl.files.length);
  }
}

async function handleArenaSave() {
  if (!isArenaActive || arenaActiveTeams.length !== 2) {
    alert('Спочатку розпочніть бій');
    return;
  }

  const [teamKeyA, teamKeyB] = arenaActiveTeams;
  const membersA = getTeamMembers(teamKeyA);
  const membersB = getTeamMembers(teamKeyB);
  const allowedNicks = new Set([...membersA, ...membersB].map(player => player.nick));

  const mvpValues = arenaMvpInputs.map(input => (input?.value || '').trim());
  if (!mvpValues[0]) {
    alert('Вкажіть MVP');
    return;
  }
  const seen = new Set();
  for (const nick of mvpValues.filter(Boolean)) {
    if (!allowedNicks.has(nick)) {
      alert(`Гравець ${nick} не бере участі у цьому матчі`);
      return;
    }
    if (seen.has(nick)) {
      alert('Гравці для нагород мають бути різними');
      return;
    }
    seen.add(nick);
  }

  let winsA = 0;
  let winsB = 0;
  ARENA_ROUNDS.forEach(round => {
    if (arenaRoundsEl?.querySelector(`.round-${round}-a`)?.checked) winsA++;
    if (arenaRoundsEl?.querySelector(`.round-${round}-b`)?.checked) winsB++;
  });
  const series = `${winsA}-${winsB}`;
  const winner = winsA > winsB ? 'team1' : winsB > winsA ? 'team2' : 'tie';

  const league = normalizeLeague(leagueSelectEl?.value || state.league);
  const payload = {
    league,
    team1: membersA.map(player => player.nick).join(', '),
    team2: membersB.map(player => player.nick).join(', '),
    winner,
    mvp1: mvpValues[0],
    mvp2: mvpValues[1],
    mvp3: mvpValues[2],
    mvp: mvpValues[0],
    series,
    penalties: (arenaPenaltyInputEl?.value || '').trim(),
  };

  let response;
  try {
    response = await saveResult(payload);
  } catch (err) {
    console.error('[balance] arena save failed', err);
    const msg = 'Не вдалося зберегти гру';
    if (typeof showToast === 'function') showToast(msg); else alert(msg);
    return;
  }

  if (!response || !response.ok) {
    const message = response && typeof response === 'object' && 'message' in response
      ? response.message
      : 'Невідома помилка';
    console.error('[balance] arena save error', message);
    const msg = `Помилка збереження: ${message}`;
    if (typeof showToast === 'function') showToast(msg); else alert(msg);
    return;
  }

  const successMessage = response && typeof response === 'object' && 'message' in response
    ? response.message
    : 'Гру успішно збережено та рейтинги оновлено';
  if (typeof showToast === 'function') showToast(successMessage); else alert(successMessage);

  lastSavedMatchId = response?.matchId || Date.now();
  window.lastMatchId = lastSavedMatchId;

  if (Array.isArray(response?.players)) {
    const updated = applyPlayerUpdates(response.players);
    if (updated) {
      renderPlayerList();
    }
    renderLobby();
  } else {
    renderLobby();
  }

  try {
    if (typeof localStorage !== 'undefined') {
      safeSet(localStorage, 'gamedayRefresh', Date.now());
    }
  } catch (err) {
    console.warn('[balance] failed to update gamedayRefresh', err);
  }

  resetArenaUI();
  renderArenaCheckboxes();
}

function handleClearArenaClick() {
  resetArenaUI();
  renderArenaCheckboxes();
}

function handlePdfInputChange() {
  if (!parsePdfBtnEl) return;
  const hasFile = !!(pdfInputEl && pdfInputEl.files && pdfInputEl.files.length);
  parsePdfBtnEl.disabled = !hasFile || !lastSavedMatchId;
}

async function handleParsePdfClick() {
  if (!pdfInputEl || !pdfInputEl.files || !pdfInputEl.files.length) {
    alert('Оберіть PDF-файл для імпорту');
    return;
  }
  const file = pdfInputEl.files[0];
  const matchId = lastSavedMatchId || window.lastMatchId;
  if (!matchId) {
    alert('Спершу збережіть результат гри');
    return;
  }

  try {
    const stats = await parseGamePdf(file);
    const res = await saveDetailedStats(matchId, stats);
    const ok = typeof res === 'string' ? res.trim() === 'OK' : res?.ok;
    if (ok) {
      const msg = 'Детальна статистика з PDF імпортована успішно';
      if (typeof showToast === 'function') showToast(msg); else alert(msg);
    } else {
      const msg = `Помилка імпорту статистики: ${res}`;
      if (typeof showToast === 'function') showToast(msg); else alert(msg);
    }
  } catch (err) {
    console.error('[balance] parse pdf failed', err);
    const msg = `Не вдалося розпарсити PDF: ${err?.message || err}`;
    if (typeof showToast === 'function') showToast(msg); else alert(msg);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  leagueSelectEl = document.getElementById('league');
  playerListEl = document.getElementById('player-list');
  addToLobbyBtnEl = document.getElementById('add-to-lobby');
  scenarioSectionEl = document.getElementById('sec-scenario');
  scenarioAreaEl = document.getElementById('scenario-area');
  scenarioAutoBtnEl = document.getElementById('btn-auto');
  scenarioManualBtnEl = document.getElementById('btn-manual');
  teamSizeSelectEl = document.getElementById('teamsize');
  arenaSelectEl = document.getElementById('arena-select');
  arenaCheckboxesEl = document.getElementById('arena-checkboxes');
  arenaStartBtnEl = document.getElementById('btn-start-match');
  arenaAreaEl = document.getElementById('arena-area');
  arenaVsEl = document.getElementById('arena-vs');
  arenaRoundsEl = document.getElementById('arena-rounds');
  arenaPenaltyInputEl = document.getElementById('penalty');
  arenaSaveBtnEl = document.getElementById('btn-save-match');
  arenaClearBtnEl = document.getElementById('btn-clear-arena');
  arenaMvpInputs = [
    document.getElementById('mvp1'),
    document.getElementById('mvp2'),
    document.getElementById('mvp3'),
  ].filter(Boolean);
  pdfInputEl = document.getElementById('pdf-upload');
  parsePdfBtnEl = document.getElementById('btn-parse-pdf');

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

  if (scenarioAutoBtnEl) {
    scenarioAutoBtnEl.addEventListener('click', handleScenarioAutoClick);
  }
  if (scenarioManualBtnEl) {
    scenarioManualBtnEl.addEventListener('click', handleScenarioManualClick);
  }
  if (arenaCheckboxesEl) {
    arenaCheckboxesEl.addEventListener('change', handleArenaCheckboxClick);
  }
  if (arenaStartBtnEl) {
    arenaStartBtnEl.addEventListener('click', handleStartMatch);
  }
  if (arenaSaveBtnEl) {
    arenaSaveBtnEl.addEventListener('click', handleArenaSave);
  }
  if (arenaClearBtnEl) {
    arenaClearBtnEl.addEventListener('click', handleClearArenaClick);
  }
  if (pdfInputEl) {
    pdfInputEl.addEventListener('change', handlePdfInputChange);
  }
  if (parsePdfBtnEl) {
    parsePdfBtnEl.disabled = true;
    parsePdfBtnEl.addEventListener('click', handleParsePdfClick);
  }

  ensureScenarioSectionVisible();
  resetArenaUI();
  renderArenaCheckboxes();
  updateStartButtonState();

  registerRecomputeAutoBalance(runAutoBalance);
  applyModeUI();

  const initialLeague = leagueSelectEl || state.league;
  await loadPlayersForLeague(initialLeague);
  renderLobby();
});
