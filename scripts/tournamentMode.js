// Tournament mode controller
import {
  fetchTournaments,
  createTournament,
  saveTournamentTeams,
  createTournamentGames,
  saveTournamentGame,
  fetchTournamentData,
  fetchLeagueCsv,
  normalizeLeague,
  parsePlayersFromCsv,
} from './api.js';
import { autoBalance2 as autoBalanceTwo, autoBalanceN as autoBalanceMany } from './balanceUtils.js';
import { AVATAR_PLACEHOLDER } from './avatarConfig.js';

const DEFAULT_TEAMS = 3;
const MIN_TEAMS = 2;
const MAX_TEAMS = 5;
const TOURNAMENT_GAME_MODES = ['DM', 'KT', 'TR'];
const STORAGE_KEY = 'tournament-state-v3';

const tournamentState = {
  appMode: 'regular',
  league: 'kids',
  lobbyLeague: 'kids',
  players: [],
  playerLookup: new Map(),
  lobby: [],
  lobbySelection: new Set(),
  pool: new Set(),
  teams: {},
  teamCount: DEFAULT_TEAMS,
  games: [],
  tournaments: [],
  currentId: '',
  data: null,
  selectedGame: '',
  selectedResult: '',
  sort: { key: 'pts', dir: 'desc' },
  notes: '',

};

const lobbyCache = new Map();
const dom = {
  root: null,
  teamCards: new Map(),
  teamNames: new Map(),
  teamLists: new Map(),
  teamMetrics: new Map(),
  teamTextareas: new Map(),
};

function showMessage(msg, type = 'info') {
  if (typeof showToast === 'function') {
    showToast(msg, type);
  } else {
    console.log(type, msg);
  }
}

function clampTeamsCount(count) {
  const value = Number.parseInt(count, 10);
  if (!Number.isFinite(value)) return DEFAULT_TEAMS;
  return Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, value));
}

function cacheDomRefs() {
  dom.root = document.getElementById('tournament-mode');
  if (!dom.root) return;

  const qs = selector => dom.root?.querySelector(selector);
  const qsAll = selector => (dom.root ? Array.from(dom.root.querySelectorAll(selector)) : []);

  dom.panel = qs('#tournament-panel') || dom.root;
  dom.regularPanel = document.getElementById('regular-panel');
  dom.league = qs('#tournament-league');
  dom.tournamentSelect = qs('#tournament-select');
  dom.tournamentName = qs('#tournament-name');
  dom.tournamentCreate = qs('#tournament-create');
  dom.tournamentRefresh = qs('#tournament-refresh');
  dom.tournamentNotes = qs('#tournament-notes');

  dom.teamCountSelect = qs('#tournament-team-count');
  dom.teamsWrap = qs('#tournament-teams-wrap');
  dom.auto = qs('#tournament-auto');
  dom.saveTeams = qs('#tournament-save-teams');
  dom.clearTeams = qs('#tournament-clear-teams');

  dom.lobbySearch = qs('#tournament-lobby-search');
  dom.lobbySelectAll = qs('#tournament-lobby-select-all');
  dom.lobbyTableBody = qs('#tournament-lobby-table tbody');
  dom.lobbyAdd = qs('#tournament-add-pool');
  dom.lobbyClear = qs('#tournament-clear');

  dom.pool = qs('#tournament-pool');
  dom.poolInput = qs('#tournament-player-pool');

  dom.generate = qs('#tournament-generate');
  dom.gamesList = qs('#tournament-games-list');
  dom.gamesSelect = qs('#tournament-game-select');
  dom.match = qs('#tournament-match');
  dom.roundCount = qs('#t-round-count');
  dom.rounds = qs('#t-rounds');
  dom.resultButtons = qs('#tournament-result-buttons');
  dom.resultStatus = qs('#tournament-game-status');
  dom.awards = {
    mvp: qs('#t-mvp'),
    second: qs('#t-second'),
    third: qs('#t-third'),
  };
  dom.exportRegular = qs('#t-export-regular');
  dom.saveGame = qs('#tournament-save-game');
  dom.refreshData = qs('#tournament-refresh-data');
  dom.sortButtons = qsAll('[data-sort]');
}

function setAppMode(mode) {
  tournamentState.appMode = mode === 'tournament' ? 'tournament' : 'regular';
  if (document.body) {
    document.body.dataset.appMode = tournamentState.appMode;
  }
  const buttons = Array.from(document.querySelectorAll('#mode-switch [data-mode]'));
  buttons.forEach(btn => btn.classList.toggle('btn-primary', btn.dataset.mode === tournamentState.appMode));
  dom.regularPanel?.classList.toggle('active', tournamentState.appMode === 'regular');
  dom.panel?.classList.toggle('active', tournamentState.appMode === 'tournament');
  const avatarModal = document.getElementById('avatar-modal');
  if (avatarModal) {
    avatarModal.classList.remove('active');
    avatarModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
}

function persistState() {
  try {
    const payload = {
      league: tournamentState.league,
      teamCount: tournamentState.teamCount,
      pool: Array.from(tournamentState.pool),
      teams: Object.values(tournamentState.teams),
      games: tournamentState.games,
      rounds: tournamentState.rounds,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('persist tournament state failed', err);
  }
}

function restoreState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('restore tournament state failed', err);
    return null;
  }
}

function parsePlayerList(raw) {
  return String(raw || '')
    .split(/[,;\n]/)
    .map(p => p.trim())
    .filter(Boolean);
}

function findPlayerRecord(nick) {
  return tournamentState.playerLookup.get(String(nick || '').toLowerCase());
}

function buildPlayerLookup(list) {
  const lookup = new Map();
  (list || []).forEach(p => {
    if (p?.nick) lookup.set(p.nick.toLowerCase(), p);
  });
  return lookup;
}

function toBalanceObject(nick) {
  return findPlayerRecord(nick) || { nick, pts: 0 };
}

function rankKey(rank) {
  return String(rank || '').trim().toLowerCase();
}

function addRankClass(el, rank) {
  if (!el) return;
  const key = rankKey(rank);
  if (key) el.dataset.rank = key;
}

function parseRoundNote(notes) {
  const raw = String(notes || '');
  const match = raw.match(/ROUNDLOG:([^;]+)(?:;count=(\d+))?/i);
  if (!match) return null;
  const results = match[1]
    .split(',')
    .map(v => v.trim().toUpperCase())
    .filter(Boolean);
  const count = Math.max(1, Number.parseInt(match[2], 10) || results.length || 3);
  return { count, results };
}

function ensureRoundState(gameId, count = 3) {
  if (!gameId) return null;
  const current = tournamentState.rounds[gameId];
  if (current) {
    if (count && count !== current.count) {
      current.count = count;
      current.results = current.results.slice(0, count);
    }
    return current;
  }
  const next = { count, results: Array(count).fill('') };
  tournamentState.rounds[gameId] = next;
  return next;
}

function summarizeRounds(gameId) {
  const state = tournamentState.rounds[gameId];
  if (!state) return { count: 0, results: [], winsA: 0, winsB: 0, draws: 0, result: '' };
  const results = (state.results || []).slice(0, state.count);
  let winsA = 0; let winsB = 0; let draws = 0;
  results.forEach(r => {
    if (r === 'A') winsA += 1;
    else if (r === 'B') winsB += 1;
    else if (r === 'DRAW') draws += 1;
  });
  let result = '';
  if (winsA > winsB) result = 'A';
  else if (winsB > winsA) result = 'B';
  else if (winsA === winsB && (winsA || winsB || draws)) result = 'DRAW';
  return { count: state.count, results, winsA, winsB, draws, result };
}

function buildRoundNote(summary) {
  if (!summary?.results?.length) return '';
  return `ROUNDLOG:${summary.results.join(',')};count=${summary.count || summary.results.length}`;
}

function calculateTeamMetrics(players) {
  const list = Array.isArray(players) ? players : parsePlayerList(players);
  const ptsValues = list.map(n => findPlayerRecord(n)?.pts || 0);
  const totalPts = ptsValues.reduce((sum, v) => sum + Number(v || 0), 0);
  const count = ptsValues.length;
  const avgPts = count ? totalPts / count : 0;
  return {
    totalPts,
    avgPts,
    strengthIndex: avgPts,
    count,
  };
}

function isDrawAllowed(mode) {
  const key = (mode || '').toUpperCase();
  const config = tournamentState.data?.config || {};
  if (Object.prototype.hasOwnProperty.call(config, key)) {
    return config[key] !== false;
  }
  return key !== 'KT';
}

function renderTeamMetrics(slot, metrics) {
  const el = dom.teamMetrics.get(slot);
  if (!el) return;
  if (!metrics) {
    el.textContent = '';
    return;
  }
  el.innerHTML = `Σ ${metrics.totalPts.toFixed(0)} · Avg ${metrics.avgPts.toFixed(1)} · SI ${metrics.strengthIndex.toFixed(1)} · ${metrics.count} грав.`;
}

function recomputeAllTeamMetrics() {
  Object.entries(tournamentState.teams).forEach(([slot, team]) => {
    renderTeamMetrics(slot, calculateTeamMetrics(team.players));
  });
}

function ensureTeamObjects() {
  const count = clampTeamsCount(dom.teamCountSelect?.value || tournamentState.teamCount);
  tournamentState.teamCount = count;
  for (let i = 1; i <= count; i++) {
    if (!tournamentState.teams[i]) {
      tournamentState.teams[i] = {
        teamId: `team-${i}`,
        teamName: `Команда ${i}`,
        players: [],
      };
    }
  }
  Object.keys(tournamentState.teams)
    .filter(k => Number(k) > count)
    .forEach(k => delete tournamentState.teams[k]);
}

function syncLobbyWithTeams() {
  const assigned = new Set(Object.values(tournamentState.teams).flatMap(team => team.players));
  tournamentState.lobbySelection.forEach(nick => {
    if (assigned.has(nick)) tournamentState.lobbySelection.delete(nick);
  });
}

function renderTeams() {
  ensureTeamObjects();
  if (!dom.teamsWrap) return;
  dom.teamsWrap.innerHTML = '';
  dom.teamCards.clear();
  dom.teamNames.clear();
  dom.teamLists.clear();
  dom.teamMetrics.clear();
  dom.teamTextareas.clear();

  Object.entries(tournamentState.teams).forEach(([slot, team]) => {
    const card = document.createElement('div');
    card.className = 'team-card droppable';
    card.dataset.teamId = team.teamId;
    card.dataset.slot = slot;
    card.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    card.addEventListener('drop', e => handleTeamDrop(e, slot));

    const header = document.createElement('div');
    header.className = 'team-header';
    const meta = document.createElement('span');
    meta.className = 'muted';
    meta.textContent = `ID: ${team.teamId}`;
    const nameInput = document.createElement('input');
    nameInput.className = 'team-name';
    nameInput.value = team.teamName;
    nameInput.addEventListener('input', () => {
      team.teamName = nameInput.value.trim() || `Команда ${slot}`;
      renderGameOptions();
      persistState();
    });
    header.append(meta, nameInput);

    const tools = document.createElement('div');
    tools.className = 'team-tools';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn-ghost btn-sm';
    addBtn.textContent = 'Додати обраних';
    addBtn.addEventListener('click', () => {
      const selected = Array.from(tournamentState.lobbySelection);
      selected.forEach(nick => movePlayerToTeam(nick, slot));
    });
    tools.appendChild(addBtn);

    const list = document.createElement('ul');
    list.className = 'team-list';
    list.dataset.teamId = slot;
    list.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    list.addEventListener('drop', e => handleTeamDrop(e, slot));

    team.players.forEach(nick => {
      const player = findPlayerRecord(nick);
      const li = document.createElement('li');
      li.draggable = true;
      li.dataset.nick = nick;
      li.addEventListener('dragstart', handleDragFromTeam);
      li.innerHTML = `<span class="player-name">${nick}</span><span>${Number(player?.pts || 0).toFixed(0)}</span>`;
      addRankClass(li, player?.rank);
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'ghost-btn';
      removeBtn.textContent = '×';
      removeBtn.title = 'Повернути у лоббі';
      removeBtn.addEventListener('click', () => {
        removePlayerFromTeams(nick);
        renderLobby();
        renderTeams();
        persistState();
      });
      const moveUp = document.createElement('button');
      moveUp.type = 'button';
      moveUp.className = 'ghost-btn';
      moveUp.textContent = '↑';
      moveUp.title = 'Вище в команді';
      moveUp.addEventListener('click', () => movePlayerWithinTeam(slot, nick, -1));
      const moveDown = document.createElement('button');
      moveDown.type = 'button';
      moveDown.className = 'ghost-btn';
      moveDown.textContent = '↓';
      moveDown.title = 'Нижче в команді';
      moveDown.addEventListener('click', () => movePlayerWithinTeam(slot, nick, 1));
      const actions = document.createElement('span');
      actions.className = 'team-actions';
      actions.append(moveUp, moveDown, removeBtn);
      li.appendChild(actions);
      list.appendChild(li);
    });

    const metrics = document.createElement('div');
    metrics.className = 'metrics';
    dom.teamMetrics.set(slot, metrics);
    renderTeamMetrics(slot, calculateTeamMetrics(team.players));

    const textarea = document.createElement('textarea');
    textarea.id = `t-team-players-${slot}`;
    textarea.value = team.players.join(', ');
    textarea.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    textarea.addEventListener('drop', e => handleTextareaDrop(e, slot));
    textarea.addEventListener('input', () => {
      setTeamPlayersFromInput(slot, textarea.value);
    });

    dom.teamTextareas.set(slot, textarea);

    card.append(header, tools, list, textarea, metrics);
    dom.teamsWrap.appendChild(card);
    dom.teamCards.set(slot, card);
    dom.teamNames.set(slot, nameInput);
    dom.teamLists.set(slot, list);
  });
}

function removePlayerFromTeams(nick) {
  Object.values(tournamentState.teams).forEach(team => {
    const idx = team.players.indexOf(nick);
    if (idx >= 0) team.players.splice(idx, 1);
  });
  syncLobbyWithTeams();
  persistState();
}

function removePlayerFromOtherTeams(nick, keepSlot) {
  Object.entries(tournamentState.teams).forEach(([slot, team]) => {
    if (String(slot) === String(keepSlot)) return;
    const idx = team.players.indexOf(nick);
    if (idx >= 0) team.players.splice(idx, 1);
  });
}

function setTeamPlayersFromInput(slot, rawValue) {
  const team = tournamentState.teams[slot];
  if (!team) return;
  const parsed = parsePlayerList(rawValue);
  const unique = [];
  parsed.forEach(nick => {
    if (!nick || unique.includes(nick)) return;
    unique.push(nick);
  });
  unique.forEach(nick => removePlayerFromOtherTeams(nick, slot));
  team.players = unique;
  syncLobbyWithTeams();
  renderLobby();
  renderTeams();
  persistState();
}

function movePlayerToTeam(nick, slot, index = null) {
  ensureTeamObjects();
  const team = tournamentState.teams[slot];
  const player = findPlayerRecord(nick) || { nick, pts: 0 };
  if (!team) return;
  removePlayerFromTeams(nick);
  const targetIndex = index === null || index > team.players.length ? team.players.length : index;
  team.players.splice(targetIndex, 0, nick);
  tournamentState.lobbySelection.delete(nick);
  renderLobby();
  renderTeams();
  persistState();
}

function movePlayerWithinTeam(slot, nick, direction = 0) {
  const team = tournamentState.teams[slot];
  if (!team) return;
  const idx = team.players.indexOf(nick);
  if (idx < 0) return;
  const target = idx + direction;
  if (target < 0 || target >= team.players.length) return;
  const [player] = team.players.splice(idx, 1);
  team.players.splice(target, 0, player);
  renderTeams();
  persistState();
}

function handleDragFromLobby(e) {
  const nick = e.currentTarget?.dataset?.nick;
  if (!nick) return;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', nick);
}

function handleDragFromTeam(e) {
  const nick = e.currentTarget?.dataset?.nick;
  if (!nick) return;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', nick);
}

function handleTeamDrop(e, slot) {
  e.preventDefault();
  const nick = e.dataTransfer.getData('text/plain');
  const list = dom.teamLists.get(slot);
  if (!nick || !list) return;
  const items = Array.from(list.querySelectorAll('li'));
  const y = e.clientY;
  let insertIndex = items.length;
  for (let i = 0; i < items.length; i++) {
    const rect = items[i].getBoundingClientRect();
    if (y < rect.top + rect.height / 2) {
      insertIndex = i;
      break;
    }
  }
  movePlayerToTeam(nick, slot, insertIndex);
}

function handleTextareaDrop(e, slot) {
  e.preventDefault();
  const nick = e.dataTransfer.getData('text/plain');
  if (!nick) return;
  movePlayerToTeam(nick, slot);
  const textarea = dom.teamTextareas.get(slot);
  if (textarea) textarea.value = tournamentState.teams[slot]?.players.join(', ');
}

function filteredLobby() {
  const term = (dom.lobbySearch?.value || '').trim().toLowerCase();
  const list = [...tournamentState.lobby];
  const assigned = new Set(Object.values(tournamentState.teams).flatMap(team => team.players));
  const dir = tournamentState.sort.dir === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    if (tournamentState.sort.key === 'nick') return a.nick.localeCompare(b.nick) * dir;
    if (tournamentState.sort.key === 'games') return ((Number(a.games) || 0) - (Number(b.games) || 0)) * dir;
    if (tournamentState.sort.key === 'rank') return rankKey(a.rank).localeCompare(rankKey(b.rank)) * dir;
    return ((Number(a.pts) || 0) - (Number(b.pts) || 0)) * dir;
  });
  const filtered = list.filter(p => !assigned.has(p.nick));
  if (!term) return filtered;
  return filtered.filter(p => p.nick.toLowerCase().includes(term));
}

function renderLobby() {
  const tbody = dom.lobbyTableBody;
  if (!tbody) return;
  tbody.innerHTML = '';
  filteredLobby().forEach(player => {
    const tr = document.createElement('tr');
    tr.draggable = true;
    tr.dataset.nick = player.nick;
    tr.addEventListener('dragstart', handleDragFromLobby);
    addRankClass(tr, player.rank);

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = player.nick;
    cb.checked = tournamentState.lobbySelection.has(player.nick);
    cb.addEventListener('change', () => {
      if (cb.checked) tournamentState.lobbySelection.add(player.nick); else tournamentState.lobbySelection.delete(player.nick);
    });
    const tdCheck = document.createElement('td');
    tdCheck.appendChild(cb);

    const tdNick = document.createElement('td');
    tdNick.className = 'avatar-cell';
    const img = document.createElement('img');
    img.className = 'avatar';
    img.src = player.avatar || AVATAR_PLACEHOLDER;
    img.alt = player.nick;
    const name = document.createElement('div');
    name.className = 'player-name';
    name.innerHTML = `<strong>${player.nick}</strong><div class="muted">${player.rank || ''}</div>`;
    addRankClass(name, player.rank);
    tdNick.append(img, name);

    const tdPts = document.createElement('td');
    tdPts.textContent = Number(player.pts || 0).toFixed(0);

    const tdRank = document.createElement('td');
    tdRank.textContent = player.rank || '';

    const tdGames = document.createElement('td');
    tdGames.textContent = player.games || player.matches || 0;


    const tdAssign = document.createElement('td');
    const assign = document.createElement('select');
    assign.innerHTML = '<option value="">—</option>';
    for (let i = 1; i <= tournamentState.teamCount; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `→${i}`;
      assign.appendChild(opt);
    }
    assign.addEventListener('change', () => {
      const slot = Number.parseInt(assign.value, 10);
      if (Number.isInteger(slot)) movePlayerToTeam(player.nick, slot);
      assign.value = '';
    });
    tdAssign.appendChild(assign);

    tr.append(tdCheck, tdNick, tdPts, tdRank, tdGames, tdAssign);

    tr.append(tdCheck, tdNick, tdPts, tdGames);

    tr.addEventListener('dblclick', () => quickAssignFromLobby(player.nick));
    tbody.appendChild(tr);
  });
}

function renderLobbyTable(players = []) {
  if (players.length) {
    tournamentState.lobby = players;
  }
  renderLobby();
}

function quickAssignFromLobby(nick) {
  const slotCount = clampTeamsCount(dom.teamCountSelect?.value || tournamentState.teamCount);
  if (!slotCount) return;
  const choice = prompt(`До якої команди додати ${nick}? (1-${slotCount})`);
  const slot = Number.parseInt(choice, 10);
  if (Number.isInteger(slot) && slot >= 1 && slot <= slotCount) {
    movePlayerToTeam(nick, slot);
  }
}

function renderPool() {
  if (!dom.pool) return;
  dom.pool.innerHTML = '';
  tournamentState.pool.forEach(nick => {
    const player = findPlayerRecord(nick) || { pts: 0 };
    const chip = document.createElement('span');
    chip.className = 'tag';
    chip.textContent = `${nick} · ${Number(player.pts || 0).toFixed(0)}`;
    addRankClass(chip, player.rank);
    dom.pool.appendChild(chip);
  });
  if (dom.poolInput) {
    dom.poolInput.value = Array.from(tournamentState.pool).join(', ');
  }
}

function addSelectedLobbyToPool() {
  const selected = Array.from(tournamentState.lobbySelection);
  if (!selected.length) return;
  selected.forEach(nick => tournamentState.pool.add(nick));
  renderPool();
  persistState();
}

function setSort(key) {
  if (tournamentState.sort.key === key) {
    tournamentState.sort.dir = tournamentState.sort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    tournamentState.sort = { key, dir: key === 'nick' ? 'asc' : 'desc' };
  }
  renderLobby();
}

function clearPool() {
  tournamentState.pool.clear();
  renderPool();
  persistState();
}

function computeBalance(players, teamsCount) {
  if (teamsCount <= 0) return {};
  if (teamsCount === 1) return { 1: players };
  if (teamsCount === 2) {
    const { A, B } = autoBalanceTwo(players);
    return { 1: A, 2: B };
  }
  return autoBalanceMany(players, teamsCount);
}

function fillTeamsFromAutoBalance() {
  const teamsCount = clampTeamsCount(dom.teamCountSelect?.value || tournamentState.teamCount);
  const poolPlayers = Array.from(tournamentState.pool).map(toBalanceObject);
  if (!poolPlayers.length) {
    showMessage('Додайте гравців у пул для автопідбору', 'warn');
    return;
  }
  const balanced = computeBalance(poolPlayers, teamsCount);
  ensureTeamObjects();
  for (let i = 1; i <= teamsCount; i++) {
    const members = balanced[i] || [];
    const team = tournamentState.teams[i];
    team.players = members.map(p => p.nick);
  }
  renderTeams();
  persistState();
}

function collectTeamsFromForm() {
  return Object.entries(tournamentState.teams)
    .slice(0, tournamentState.teamCount)
    .map(([slot, team]) => ({
      teamId: team.teamId || `team-${slot}`,
      teamName: team.teamName || `Команда ${slot}`,
      players: [...team.players],
    }));
}

function setTeamsToForm(teams = []) {
  const count = clampTeamsCount(teams.length || tournamentState.teamCount);
  tournamentState.teamCount = count;
  if (dom.teamCountSelect) dom.teamCountSelect.value = String(count);
  tournamentState.teams = {};
  for (let i = 0; i < count; i++) {
    const idx = i + 1;
    const team = teams[i] || {};
    tournamentState.teams[idx] = {
      teamId: team.teamId || `team-${idx}`,
      teamName: team.teamName || team.name || `Команда ${idx}`,
      players: Array.isArray(team.players) ? [...team.players] : parsePlayerList(team.players || ''),
    };
  }
  renderTeams();
  persistState();
}

function applyTeamCountVisibility() {
  const count = clampTeamsCount(dom.teamCountSelect?.value || tournamentState.teamCount);
  tournamentState.teamCount = count;
  ensureTeamObjects();
  renderTeams();
  renderLobby();
  persistState();
}

function validateTeamsBeforeSave(teams) {
  const filled = teams.filter(t => (t.players || []).length);
  if (filled.length < MIN_TEAMS) return 'Мінімум дві команди мають містити гравців';
  const lookup = tournamentState.playerLookup;
  const duplicates = new Map();
  const missing = new Set();
  filled.forEach(team => {
    (team.players || []).forEach(nick => {
      const key = nick.toLowerCase();
      if (!duplicates.has(key)) duplicates.set(key, []);
      duplicates.get(key).push(team.teamName || team.teamId);
      if (!lookup.has(key)) missing.add(nick);
    });
  });
  const offender = Array.from(duplicates.entries()).find(([, list]) => list.length > 1);
  if (offender) return `Гравець ${offender[0]} дублюється у командах: ${offender[1].join(', ')}`;
  if (missing.size) return `Невідомі гравці: ${Array.from(missing).join(', ')}`;
  return '';
}

async function refreshTournamentsList() {
  const selectEl = dom.tournamentSelect;
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">— Оберіть турнір —</option>';
  try {
    const tournaments = await fetchTournaments({ status: 'ACTIVE' });
    tournamentState.tournaments = tournaments;
    tournaments.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.tournamentId;
      opt.textContent = `${t.name || t.tournamentId} (${t.league || ''})`;
      selectEl.appendChild(opt);
    });
    if (tournamentState.currentId) {
      selectEl.value = tournamentState.currentId;
    } else if (tournaments[0]) {
      selectEl.value = tournaments[0].tournamentId;
      tournamentState.currentId = tournaments[0].tournamentId;
      await refreshTournamentData();
    }
  } catch (err) {
    console.error(err);
    showMessage('Не вдалося отримати список турнірів', 'error');
  }
}

function filterValidGames(games = []) {
  if (!Array.isArray(games)) return [];
  const seen = new Set();
  return games.reduce((acc, raw) => {
    const gameId = String(raw?.gameId || '').trim();
    const mode = (raw?.mode || 'TR').toUpperCase();
    const teamAId = String(raw?.teamAId || '').trim();
    const teamBId = String(raw?.teamBId || '').trim();
    if (!gameId || !teamAId || !teamBId || seen.has(gameId)) return acc;
    seen.add(gameId);
    acc.push({ ...raw, gameId, mode, teamAId, teamBId });
    return acc;
  }, []);
}

function hydrateRoundsFromGames(games = []) {
  games.forEach(game => {
    if (!game?.gameId) return;
    const parsed = parseRoundNote(game.notes);
    if (parsed) {
      tournamentState.rounds[game.gameId] = { count: parsed.count, results: parsed.results.slice(0, parsed.count) };
    }
  });
}

function normalizeGeneratedGames(games = []) {
  if (!Array.isArray(games) || !games.length) {
    return { games: [], error: 'Список матчів порожній' };
  }
  const normalized = [];
  games.forEach((game, idx) => {
    const teamAId = String(game?.teamAId || '').trim();
    const teamBId = String(game?.teamBId || '').trim();
    if (!teamAId || !teamBId || teamAId === teamBId) return;
    normalized.push({
      gameId: `G${idx + 1}`,
      mode: (game?.mode || 'TR').toUpperCase(),
      teamAId,
      teamBId,
    });
  });
  if (!normalized.length) {
    return { games: [], error: 'Не вдалося сформувати матчі: відсутні коректні команди' };
  }
  const unique = new Set(normalized.map(g => g.gameId));
  if (unique.size !== normalized.length) {
    return { games: [], error: 'Дублікати gameId у списку матчів' };
  }
  return { games: normalized, error: '' };
}

function renderGameOptions() {
  if (!dom.gamesSelect || !dom.gamesList) return;
  const prevSelection = dom.gamesSelect.value || tournamentState.selectedGame || '';
  dom.gamesSelect.innerHTML = '<option value="">— оберіть матч —</option>';
  dom.gamesList.innerHTML = '';
  const games = filterValidGames(tournamentState.data?.games || tournamentState.games || []);
  tournamentState.games = games;
  if (tournamentState.data) tournamentState.data.games = games;
  const teams = tournamentState.data?.teams || collectTeamsFromForm();
  const teamNames = Object.fromEntries(teams.map(t => [t.teamId, t.teamName || t.teamId]));
  games.forEach((game, idx) => {
    if (!game.gameId) return;
    const label = `${teamNames[game.teamAId] || game.teamAId} vs ${teamNames[game.teamBId] || game.teamBId} — ${game.mode}`;
    const summary = summarizeRounds(game.gameId);
    let status = 'не зіграно';
    if (summary.result) {
      const winnerName = summary.result === 'A' ? teamNames[game.teamAId] || game.teamAId : summary.result === 'B' ? teamNames[game.teamBId] || game.teamBId : '';
      status = summary.result === 'DRAW'
        ? `нічия ${summary.winsA}-${summary.winsB}`
        : `рахунок ${summary.winsA}-${summary.winsB}, переможець ${winnerName}`;
    } else if (game.isDraw === 'TRUE') {
      status = 'нічия';
    } else if (game.winnerTeamId) {
      status = `переможець ${teamNames[game.winnerTeamId] || game.winnerTeamId}`;
    }
    const opt = document.createElement('option');
    opt.value = game.gameId;
    opt.textContent = `${label} (${status})`;
    dom.gamesSelect.appendChild(opt);

    const row = document.createElement('div');
    row.className = 'game-row';
    row.dataset.index = idx;
    row.innerHTML = `<div class="game-row__label">${label}</div><div class="game-row__meta">${status}</div>`;
    row.addEventListener('click', () => {
      dom.gamesSelect.value = game.gameId;
      handleGameSelection();
    });
    dom.gamesList.appendChild(row);
  });

  if (!games.length) {
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Матчі відсутні';
    placeholder.disabled = true;
    placeholder.selected = true;
    dom.gamesSelect.appendChild(placeholder);
    return;
  }

  const preferred = prevSelection && games.some(g => g.gameId === prevSelection)
    ? prevSelection
    : games[0]?.gameId || '';
  dom.gamesSelect.value = preferred;
  tournamentState.selectedGame = preferred;
  handleGameSelection();
}

function renderAwards(game) {
  const teams = tournamentState.data?.teams || collectTeamsFromForm();
  const teamMap = Object.fromEntries(teams.map(t => [t.teamId, t]));
  const players = [];
  if (game) {
    parsePlayerList(teamMap[game.teamAId]?.players || []).forEach(n => players.push(n));
    parsePlayerList(teamMap[game.teamBId]?.players || []).forEach(n => players.push(n));
  }
  const unique = Array.from(new Set(players));
  Object.values(dom.awards).forEach(sel => {
    if (!sel) return;
    sel.innerHTML = '<option value="">—</option>';
    unique.forEach(nick => {
      const opt = document.createElement('option');
      opt.value = nick;
      opt.textContent = nick;
      sel.appendChild(opt);
    });
  });
}

function getAllowedAwardSet(game) {
  const teams = tournamentState.data?.teams || collectTeamsFromForm();
  const teamMap = Object.fromEntries(teams.map(t => [t.teamId, t]));
  const players = [];
  if (game) {
    parsePlayerList(teamMap[game.teamAId]?.players || []).forEach(n => players.push(n));
    parsePlayerList(teamMap[game.teamBId]?.players || []).forEach(n => players.push(n));
  }
  return new Set(players);
}

function getTeamPlayers(teamId) {
  const teams = tournamentState.data?.teams || collectTeamsFromForm();
  const teamMap = Object.fromEntries(teams.map(t => [t.teamId, t]));
  return parsePlayerList(teamMap[teamId]?.players || '');
}

function buildSaveHints(game) {
  if (!dom.resultStatus) return '';
  if (!game) return 'Оберіть матч та результат, щоб розблокувати збереження.';
  const mode = (game.mode || '').toUpperCase();
  const allowDraw = isDrawAllowed(mode);
  const requirements = [`Результат: A/B${allowDraw ? '/DRAW' : ''}`];
  requirements.push('Команди мають містити гравців');
  const allowed = getAllowedAwardSet(game);
  if (allowed.size) requirements.push('MVP/2/3 лише з учасників матчу, без повторів');
  requirements.push(`Режим: ${mode || '—'}`);
  return requirements.join(' · ');
}

function renderRounds(game) {
  if (!dom.rounds || !dom.roundCount) return;
  dom.rounds.innerHTML = '';
  if (!game?.gameId) {
    dom.roundCount.value = 3;
    return;
  }
  const count = Math.max(1, Number.parseInt(dom.roundCount.value, 10) || 3);
  const state = ensureRoundState(game.gameId, count);
  dom.roundCount.value = state.count;
  for (let i = 0; i < state.count; i++) {
    const row = document.createElement('div');
    row.className = 'round-row';
    const title = document.createElement('h5');
    title.textContent = `Бій ${i + 1}`;
    const choice = document.createElement('div');
    choice.className = 'round-choice';
    const drawAllowed = isDrawAllowed(game.mode);
    ['A', 'DRAW', 'B'].forEach(val => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `round-${game.gameId}-${i}`;
      input.value = val;
      input.disabled = val === 'DRAW' && !drawAllowed;
      input.checked = state.results[i] === val;
      input.addEventListener('change', () => {
        state.results[i] = val;
        applyGameStatus(game);
      });
      label.append(input, document.createTextNode(val === 'DRAW' ? 'Нічия' : `Команда ${val}`));
      choice.appendChild(label);
    });
    row.append(title, choice);
    dom.rounds.appendChild(row);
  }
}

function renderMatchPanel(game) {
  if (!dom.match) return;
  dom.match.innerHTML = '';
  if (!game) return;
  const teams = tournamentState.data?.teams || collectTeamsFromForm();
  const teamMap = Object.fromEntries(teams.map(t => [t.teamId, t]));

  const createBlock = (teamId) => {
    const block = document.createElement('div');
    block.className = 'team-card';
    const title = document.createElement('h4');
    title.textContent = teamMap[teamId]?.teamName || teamId;
    const ul = document.createElement('ul');
    ul.className = 'team-list';
    const members = parsePlayerList(teamMap[teamId]?.players || []);
    members.forEach(nick => {
      const player = findPlayerRecord(nick);
      const li = document.createElement('li');
      li.innerHTML = `<span class="avatar-cell"><img class="avatar" src="${player?.avatar || AVATAR_PLACEHOLDER}" alt="${nick}"><strong>${nick}</strong></span><span>${Number(player?.pts || 0).toFixed(0)}</span>`;
      addRankClass(li, player?.rank);
      ul.appendChild(li);
    });
    const metrics = calculateTeamMetrics(members);
    const meta = document.createElement('div');
    meta.className = 'metrics';
    meta.innerHTML = `<span class="tag">Σ ${metrics.totalPts.toFixed(0)}</span><span class="tag">Avg ${metrics.avgPts.toFixed(1)}</span><span class="tag">${metrics.count} грав.</span>`;
    block.append(title, ul, meta);
    return block;
  };

  const info = document.createElement('div');
  info.className = 'metrics';
  info.innerHTML = `<span class="tag">Режим: ${game.mode}</span>`;

  dom.match.append(createBlock(game.teamAId), createBlock(game.teamBId), info);
  renderRounds(game);
  applyGameStatus(game);
  renderAwards(game);
  updateDrawAvailability(game);
}

function setSelectedResult(value) {
  tournamentState.selectedResult = value || '';
  if (!dom.resultButtons) return;
  dom.resultButtons.querySelectorAll('[data-result]').forEach(btn => {
    btn.classList.toggle('is-selected', btn.dataset.result === value);
  });
}

function applyGameStatus(game) {
  if (!dom.resultStatus) return;
  let statusText = '';
  if (!game) {
    dom.resultStatus.textContent = buildSaveHints(null);
    return;
  }
  const teams = tournamentState.data?.teams || collectTeamsFromForm();
  const teamNames = Object.fromEntries(teams.map(t => [t.teamId, t.teamName || t.teamId]));
  const summary = summarizeRounds(game.gameId);
  const drawSuffix = summary.draws ? ` (${summary.draws} ніч.)` : '';
  const roundsLabel = summary.results.length ? `Раунди: ${summary.winsA}-${summary.winsB}${drawSuffix}` : '';
  if (summary.result) {
    statusText = summary.result === 'DRAW' ? 'Статус: нічия' : `Статус: переможець ${summary.result === 'A' ? teamNames[game.teamAId] || game.teamAId : teamNames[game.teamBId] || game.teamBId}`;
    setSelectedResult(summary.result);
  } else if (game.isDraw === 'TRUE' || game.isDraw === true || tournamentState.selectedResult === 'DRAW') {
    statusText = 'Статус: нічия';
    setSelectedResult('DRAW');
  } else if (game.winnerTeamId) {
    const winnerLabel = teamNames[game.winnerTeamId] || game.winnerTeamId;
    statusText = `Статус: переможець ${winnerLabel}`;
    const winner = game.winnerTeamId === game.teamAId ? 'A' : game.winnerTeamId === game.teamBId ? 'B' : '';
    setSelectedResult(winner);
  } else {
    statusText = 'Статус: не зіграно';
    setSelectedResult('');
  }
  const hints = buildSaveHints(game);
  const pieces = [statusText, roundsLabel, hints].filter(Boolean);
  dom.resultStatus.textContent = pieces.join(' · ');
}

function updateDrawAvailability(game) {
  const mode = (game?.mode || '').toUpperCase();
  const allowDraw = isDrawAllowed(mode);
  const drawBtn = dom.resultButtons?.querySelector('[data-result="DRAW"]');
  if (drawBtn) {
    drawBtn.disabled = !allowDraw;
    drawBtn.title = allowDraw ? '' : 'Нічия недоступна для цього режиму';
    if (!allowDraw && tournamentState.selectedResult === 'DRAW') setSelectedResult('');
  }
}

function handleGameSelection() {
  const gameId = dom.gamesSelect?.value;
  tournamentState.selectedGame = gameId;
  const game = (tournamentState.data?.games || tournamentState.games || []).find(g => g.gameId === gameId);
  if (game) {
    const fallbackCount = tournamentState.rounds[gameId]?.count || Number(dom.roundCount?.value) || 3;
    ensureRoundState(gameId, fallbackCount);
  }
  renderMatchPanel(game);
  renderAwards(game);
  updateDrawAvailability(game);
}

async function refreshTournamentData() {
  if (!tournamentState.currentId) return;
  try {
    const data = await fetchTournamentData(tournamentState.currentId);
    const teams = Array.isArray(data?.teams) ? data.teams : [];
    const games = filterValidGames(data?.games);
    hydrateRoundsFromGames(games);
    tournamentState.data = { ...data, teams, games };
    setTeamsToForm(teams);
    tournamentState.games = games;
    renderGameOptions();
    handleGameSelection();
  } catch (err) {
    console.error(err);
    showMessage('Не вдалося оновити дані турніру', 'error');
  }
}

function toggleLobbySelection(source) {
  const checked = !!source?.checked;
  tournamentState.lobbySelection.clear();
  dom.lobbyTableBody?.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = checked;
    if (checked && cb.value) tournamentState.lobbySelection.add(cb.value);
  });
}

async function loadLobbyPlayers() {
  try {
    const league = normalizeLeague(dom.league?.value || tournamentState.lobbyLeague);
    tournamentState.lobbyLeague = league;
    let players = lobbyCache.get(league);
    if (!players) {
      const csv = await fetchLeagueCsv(league);
      players = parsePlayersFromCsv(csv).map(p => ({ ...p, games: p.games || p.matches || 0 }));
      lobbyCache.set(league, players);
    }
    tournamentState.players = players;
    tournamentState.playerLookup = buildPlayerLookup(players);
    tournamentState.lobby = players;
    syncLobbyWithTeams();
    renderLobby();
    renderPool();
    renderTeams();
  } catch (err) {
    console.error(err);
    showMessage('Не вдалося завантажити лоббі', 'error');
  }
}

async function handleTournamentChange() {
  tournamentState.currentId = dom.tournamentSelect?.value || '';
  tournamentState.data = null;
  tournamentState.rounds = {};
  if (tournamentState.currentId) await refreshTournamentData();
}

async function handleCreateTournament() {
  const name = dom.tournamentName?.value.trim();
  if (!name) {
    showMessage('Вкажіть назву турніру', 'warn');
    return;
  }
  const notes = dom.tournamentNotes?.value.trim() || '';
  const teamCount = clampTeamsCount(dom.teamCountSelect?.value || tournamentState.teamCount);
  tournamentState.teamCount = teamCount;
  ensureTeamObjects();
  renderTeams();
  try {
    const tournamentId = await createTournament({
      name,
      league: tournamentState.league,
      notes,
      teamCount,
      modes: getSelectedModes(),
    });
    showMessage('Турнір створено', 'success');
    if (dom.tournamentName) dom.tournamentName.value = '';
    if (dom.tournamentNotes) dom.tournamentNotes.value = '';
    await refreshTournamentsList();
    if (dom.tournamentSelect) dom.tournamentSelect.value = tournamentId;
    tournamentState.currentId = tournamentId;
    await refreshTournamentData();
  } catch (err) {
    console.error(err);
    showMessage('Не вдалося створити турнір', 'error');
  }
}

async function submitCreateTournament() {
  return handleCreateTournament();
}

async function handleSaveTeams() {
  if (!tournamentState.currentId) {
    showMessage('Оберіть турнір перед збереженням складів', 'warn');
    return;
  }
  const teams = collectTeamsFromForm();
  const validationError = validateTeamsBeforeSave(teams);
  if (validationError) {
    showMessage(validationError, 'warn');
    return;
  }
  try {
    await saveTournamentTeams({ tournamentId: tournamentState.currentId, teams });
    showMessage('Склади команд оновлено', 'success');
    await refreshTournamentData();
  } catch (err) {
    console.error(err);
    showMessage('Не вдалося зберегти склади', 'error');
  }
}

function getSelectedModes() {
  const checks = Array.from(dom.root?.querySelectorAll('.mode-check') || []);
  const enabled = checks.filter(cb => cb.checked).map(cb => (cb.value || '').toUpperCase()).filter(Boolean);
  return enabled.length ? enabled : [...TOURNAMENT_GAME_MODES];
}

function generateRoundRobinGames(teams, modes, bestOf = 1) {
  if (!Array.isArray(teams) || teams.length < 2) return [];
  const validModes = (modes && modes.length ? modes : TOURNAMENT_GAME_MODES).map(m => m.toUpperCase());
  const series = Number.isFinite(bestOf) && bestOf > 0 ? Math.max(1, Math.min(5, Math.trunc(bestOf))) : 1;
  const games = [];
  let idx = 1;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      validModes.forEach(mode => {
        for (let k = 0; k < series; k++) {
          games.push({
            gameId: `G${idx++}`,
            mode,
            teamAId: teams[i].teamId,
            teamBId: teams[j].teamId,
          });
        }
      });
    }
  }
  return games;
}

async function handleGenerateGames() {
  if (!tournamentState.currentId) {
    showMessage('Оберіть турнір перед генерацією матчів', 'warn');
    return;
  }
  const teams = collectTeamsFromForm().filter(t => t.teamId && t.players.length);
  if (teams.length < 2) {
    showMessage('Потрібно щонайменше дві команди зі складами', 'warn');
    return;
  }
  const modes = getSelectedModes();
  const bestOf = Number(dom.root?.querySelector('#tournament-bestof')?.value || 1);
  const games = generateRoundRobinGames(teams, modes, bestOf);
  const prepared = normalizeGeneratedGames(games);
  if (prepared.error) {
    showMessage(prepared.error, 'warn');
    return;
  }
  try {
    await createTournamentGames({ tournamentId: tournamentState.currentId, games: prepared.games, league: tournamentState.league });
    showMessage('Матчі створено', 'success');
    await refreshTournamentData();
  } catch (err) {
    console.error(err);
    showMessage('Не вдалося створити матчі', 'error');
  }
}

async function handleSaveGame() {
  if (!tournamentState.currentId) {
    showMessage('Оберіть турнір перед збереженням результату', 'warn');
    return;
  }
  const availableGames = tournamentState.data?.games || tournamentState.games || [];
  if (!availableGames.length) {
    showMessage('Спочатку згенеруйте матчі', 'warn');
    return;
  }
  const gameId = dom.gamesSelect?.value;
  if (!gameId) {
    showMessage('Оберіть матч для збереження', 'warn');
    return;
  }
  const roundSummary = summarizeRounds(gameId);
  if (!tournamentState.selectedResult && roundSummary.result) {
    setSelectedResult(roundSummary.result);
  }
  if (!tournamentState.selectedResult) {
    showMessage('Оберіть результат матчу', 'warn');
    return;
  }
  const game = availableGames.find(g => g.gameId === gameId);
  if (!game || !game.gameId) {
    showMessage('Матч не знайдено', 'error');
    return;
  }
  const mode = (game.mode || '').toUpperCase();
  if (tournamentState.selectedResult === 'DRAW' && !isDrawAllowed(mode)) {
    showMessage('Нічия недоступна для цього режиму', 'warn');
    return;
  }
  const teamAPlayers = getTeamPlayers(game.teamAId);
  const teamBPlayers = getTeamPlayers(game.teamBId);
  if (!teamAPlayers.length || !teamBPlayers.length) {
    showMessage('Обидві команди мають містити гравців перед збереженням результату', 'warn');
    return;
  }
  const awards = {
    mvp: dom.awards.mvp?.value.trim() || '',
    second: dom.awards.second?.value.trim() || '',
    third: dom.awards.third?.value.trim() || '',
  };

  const allowedPlayers = getAllowedAwardSet(game);
  const seenAwards = new Set();
  for (const [label, nick] of Object.entries(awards)) {
    if (!nick) continue;
    if (!allowedPlayers.has(nick)) {
      showMessage(`Гравець ${nick} не входить до складу матчу`, 'warn');
      return;
    }
    if (seenAwards.has(nick)) {
      showMessage('Один гравець не може отримати кілька нагород', 'warn');
      return;
    }
    seenAwards.add(nick);
  }

  const payload = {
    tournamentId: tournamentState.currentId,
    gameId,
    result: tournamentState.selectedResult,
    mode,
    gameMode: mode,
    teamAId: game.teamAId,
    teamBId: game.teamBId,
    teamAPlayers,
    teamBPlayers,
    winnerTeamId: tournamentState.selectedResult === 'A' ? game.teamAId : tournamentState.selectedResult === 'B' ? game.teamBId : '',
    isDraw: tournamentState.selectedResult === 'DRAW',
    mvp: awards.mvp,
    second: awards.second,
    third: awards.third,
    exportAsRegularGame: !!dom.exportRegular?.checked,
    league: tournamentState.league,

    series: roundSummary.results.length ? `${roundSummary.winsA}-${roundSummary.winsB}` : '',
    rounds: roundSummary.results,
    roundCount: roundSummary.count,
    notes: buildRoundNote(roundSummary) || game.notes || '',


  };
  const requiredFields = ['tournamentId', 'gameId', 'result', 'teamAId', 'teamBId'];
  const missingField = requiredFields.find(key => !payload[key]);
  if (missingField) {
    showMessage('Оберіть матч та результат перед збереженням', 'warn');
    return;
  }
  if (!['A', 'B', 'DRAW'].includes(payload.result)) {
    showMessage('Некоректний результат матчу', 'warn');
    return;
  }
  if (!payload.gameMode || !payload.teamAId || !payload.teamBId) {
    showMessage('Некоректні дані матчу', 'error');
    return;
  }
  try {
    await saveTournamentGame(payload);
    showMessage('Результат збережено', 'success');
    await refreshTournamentData();
  } catch (err) {
    console.error(err);
    showMessage('Не вдалося зберегти результат', 'error');
  }
}

function bindResultButtons() {
  if (!dom.resultButtons) return;
  dom.resultButtons.addEventListener('click', e => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const result = target.dataset.result;
    if (!result || target.disabled) return;
    setSelectedResult(result);
    const gameId = dom.gamesSelect?.value;
    const game = (tournamentState.data?.games || tournamentState.games || []).find(g => g.gameId === gameId);
    if (game) applyGameStatus(game);
  });
}

async function loadLeague() {
  tournamentState.league = normalizeLeague(dom.league?.value || tournamentState.league);
  tournamentState.rounds = {};
  await refreshTournamentsList();
  await loadLobbyPlayers();
  const saved = restoreState();
  if (saved?.league === tournamentState.league) {
    tournamentState.teamCount = clampTeamsCount(saved.teamCount || tournamentState.teamCount);
    if (dom.teamCountSelect) dom.teamCountSelect.value = String(tournamentState.teamCount);
    tournamentState.pool = new Set(saved.pool || []);
    setTeamsToForm(saved.teams || []);
    tournamentState.games = saved.games || [];
    tournamentState.rounds = saved.rounds || {};
    renderPool();
  }
}

function initTournamentMode() {
  cacheDomRefs();
  if (!dom.root || !dom.panel) return;

  const modeButtons = Array.from(document.querySelectorAll('#mode-switch [data-mode]'));
  modeButtons.forEach(btn => btn.addEventListener('click', () => setAppMode(btn.dataset.mode)));

  dom.league?.addEventListener('change', loadLeague);
  dom.tournamentSelect?.addEventListener('change', handleTournamentChange);
  dom.tournamentCreate?.addEventListener('click', handleCreateTournament);
  dom.tournamentRefresh?.addEventListener('click', refreshTournamentsList);

  dom.teamCountSelect?.addEventListener('change', applyTeamCountVisibility);
  dom.auto?.addEventListener('click', fillTeamsFromAutoBalance);
  dom.saveTeams?.addEventListener('click', handleSaveTeams);
  dom.clearTeams?.addEventListener('click', () => {
    tournamentState.teams = {};
    renderTeams();
    persistState();
  });

  dom.lobbySearch?.addEventListener('input', renderLobby);
  dom.lobbySelectAll?.addEventListener('change', e => toggleLobbySelection(e.target));
  dom.lobbyAdd?.addEventListener('click', addSelectedLobbyToPool);
  dom.lobbyClear?.addEventListener('click', clearPool);
  dom.sortButtons?.forEach(btn => btn.addEventListener('click', () => setSort(btn.dataset.sort)));

  dom.poolInput?.addEventListener('input', () => {
    tournamentState.pool = new Set(parsePlayerList(dom.poolInput.value));
    renderPool();
  });

  dom.generate?.addEventListener('click', handleGenerateGames);
  dom.gamesSelect?.addEventListener('change', handleGameSelection);
  dom.roundCount?.addEventListener('change', () => {
    const gameId = dom.gamesSelect?.value;
    const count = Math.max(1, Number.parseInt(dom.roundCount.value, 10) || 3);
    if (!gameId) {
      dom.roundCount.value = count;
      return;
    }
    ensureRoundState(gameId, count);
    const game = (tournamentState.data?.games || tournamentState.games || []).find(g => g.gameId === gameId);
    renderRounds(game);
    applyGameStatus(game);
  });
  dom.saveGame?.addEventListener('click', handleSaveGame);
  dom.refreshData?.addEventListener('click', refreshTournamentData);

  dom.root.querySelector('#tournament-load')?.addEventListener('click', loadLeague);
  dom.root.querySelector('#tournament-reload-lobby')?.addEventListener('click', loadLobbyPlayers);
  dom.root.querySelector('#tournament-reload-state')?.addEventListener('click', refreshTournamentData);

  bindResultButtons();
  setAppMode('regular');
  loadLeague();
}

document.addEventListener('DOMContentLoaded', initTournamentMode);
