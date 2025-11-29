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
};

const lobbyCache = new Map();
const dom = {
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
  dom.panel = document.getElementById('tournament-panel');
  dom.regularPanel = document.getElementById('regular-panel');
  dom.league = document.getElementById('tournament-league');
  dom.tournamentSelect = document.getElementById('tournament-select');
  dom.tournamentName = document.getElementById('tournament-name');
  dom.tournamentCreate = document.getElementById('tournament-create');
  dom.tournamentRefresh = document.getElementById('tournament-refresh');

  dom.teamCountSelect = document.getElementById('tournament-team-count')
    || document.getElementById('tournament-teams');
  dom.teamsWrap = document.getElementById('tournament-teams-wrap');
  dom.auto = document.getElementById('tournament-auto');
  dom.saveTeams = document.getElementById('tournament-save-teams');
  dom.clearTeams = document.getElementById('tournament-clear-teams');

  dom.lobbySearch = document.getElementById('tournament-lobby-search');
  dom.lobbySelectAll = document.getElementById('tournament-lobby-select-all');
  dom.lobbyTableBody = document.getElementById('tournament-lobby-table')?.querySelector('tbody')
    || document.getElementById('tournament-table')?.querySelector('tbody');
  dom.lobbyAdd = document.getElementById('tournament-add-pool');
  dom.lobbyClear = document.getElementById('tournament-clear');

  dom.pool = document.getElementById('tournament-pool');
  dom.poolInput = document.getElementById('tournament-player-pool');

  dom.generate = document.getElementById('tournament-generate');
  dom.gamesList = document.getElementById('tournament-games-list');
  dom.gamesSelect = document.getElementById('tournament-game-select')
    || document.getElementById('tournament-games');
  dom.match = document.getElementById('tournament-match');
  dom.resultButtons = document.getElementById('tournament-result-buttons');
  dom.resultStatus = document.getElementById('tournament-game-status');
  dom.awards = {
    mvp: document.getElementById('t-mvp'),
    second: document.getElementById('t-second'),
    third: document.getElementById('t-third'),
  };
  dom.exportRegular = document.getElementById('t-export-regular');
  dom.saveGame = document.getElementById('tournament-save-game');
  dom.refreshData = document.getElementById('tournament-refresh-data');
  dom.sortButtons = Array.from((dom.panel || document).querySelectorAll('[data-sort]'));
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
      li.appendChild(removeBtn);
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
  const team = tournamentState.teams[slot];
  const player = findPlayerRecord(nick);
  if (!team || !player) return;
  removePlayerFromTeams(nick);
  const targetIndex = index === null || index > team.players.length ? team.players.length : index;
  team.players.splice(targetIndex, 0, nick);
  tournamentState.lobbySelection.delete(nick);
  renderLobby();
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
    name.innerHTML = `<strong>${player.nick}</strong><div class="muted">${player.rank || ''}</div>`;
    tdNick.append(img, name);

    const tdPts = document.createElement('td');
    tdPts.textContent = Number(player.pts || 0).toFixed(0);

    const tdGames = document.createElement('td');
    tdGames.textContent = player.games || player.matches || 0;

    addRankClass(tr, player.rank);
    tr.append(tdCheck, tdNick, tdPts, tdGames);
    tbody.appendChild(tr);
  });
}

function renderLobbyTable(players = []) {
  if (players.length) {
    tournamentState.lobby = players;
  }
  renderLobby();
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
    const tournaments = await fetchTournaments({ league: tournamentState.league, status: 'ACTIVE' });
    tournamentState.tournaments = tournaments;
    tournaments.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.tournamentId;
      opt.textContent = `${t.name || t.tournamentId} (${t.league || ''})`;
      selectEl.appendChild(opt);
    });
    if (tournamentState.currentId) selectEl.value = tournamentState.currentId;
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
    const status = game.isDraw === 'TRUE' ? 'нічия' : game.winnerTeamId ? `переможець ${teamNames[game.winnerTeamId] || game.winnerTeamId}` : 'не зіграно';
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

  const preferred = games.find(g => g.gameId === tournamentState.selectedGame)?.gameId || games[0]?.gameId || '';
  dom.gamesSelect.value = preferred;
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
  if (!game) {
    dom.resultStatus.textContent = '';
    return;
  }
  const teams = tournamentState.data?.teams || collectTeamsFromForm();
  const teamNames = Object.fromEntries(teams.map(t => [t.teamId, t.teamName || t.teamId]));
  if (game.isDraw === 'TRUE' || game.isDraw === true || tournamentState.selectedResult === 'DRAW') {
    dom.resultStatus.textContent = 'Статус: нічия';
    setSelectedResult('DRAW');
  } else if (game.winnerTeamId) {
    const winnerLabel = teamNames[game.winnerTeamId] || game.winnerTeamId;
    dom.resultStatus.textContent = `Статус: переможець ${winnerLabel}`;
    const winner = game.winnerTeamId === game.teamAId ? 'A' : game.winnerTeamId === game.teamBId ? 'B' : '';
    setSelectedResult(winner);
  } else {
    dom.resultStatus.textContent = 'Статус: не зіграно';
    setSelectedResult('');
  }
}

function updateDrawAvailability(game) {
  const mode = (game?.mode || '').toUpperCase();
  const allowDraw = mode !== 'KT';
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
  if (tournamentState.currentId) await refreshTournamentData();
}

async function handleCreateTournament() {
  const name = dom.tournamentName?.value.trim();
  if (!name) {
    showMessage('Вкажіть назву турніру', 'warn');
    return;
  }
  try {
    const tournamentId = await createTournament({ name, league: tournamentState.league });
    showMessage('Турнір створено', 'success');
    if (dom.tournamentName) dom.tournamentName.value = '';
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

function generateRoundRobinGames(teams) {
  if (!Array.isArray(teams) || teams.length < 2) return [];
  const games = [];
  if (teams.length === 2) {
    for (let i = 0; i < 3; i++) {
      games.push({
        gameId: `G${i + 1}`,
        mode: 'TR',
        teamAId: teams[0].teamId,
        teamBId: teams[1].teamId,
      });
    }
    return games;
  }
  let idx = 1;
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      games.push({
        gameId: `G${idx++}`,
        mode: 'TR',
        teamAId: teams[i].teamId,
        teamBId: teams[j].teamId,
      });
    }
  }
  return games;
}

async function handleGenerateGames() {
  if (!tournamentState.currentId) {
    showMessage('Спочатку оберіть турнір', 'warn');
    return;
  }
  const teams = collectTeamsFromForm().filter(t => t.teamId && t.players.length);
  if (teams.length < 2) {
    showMessage('Потрібно щонайменше дві команди зі складами', 'warn');
    return;
  }
  const games = generateRoundRobinGames(teams);
  const prepared = normalizeGeneratedGames(games);
  if (prepared.error) {
    showMessage(prepared.error, 'warn');
    return;
  }
  try {
    await createTournamentGames({ tournamentId: tournamentState.currentId, games: prepared.games });
    showMessage('Матчі створено', 'success');
    await refreshTournamentData();
  } catch (err) {
    console.error(err);
    showMessage('Не вдалося створити матчі', 'error');
  }
}

async function handleSaveGame() {
  if (!tournamentState.currentId) {
    showMessage('Оберіть турнір', 'warn');
    return;
  }
  const gameId = dom.gamesSelect?.value;
  if (!gameId) {
    showMessage('Оберіть матч для збереження', 'warn');
    return;
  }
  if (!tournamentState.selectedResult) {
    showMessage('Оберіть результат матчу', 'warn');
    return;
  }
  const game = (tournamentState.data?.games || tournamentState.games || []).find(g => g.gameId === gameId);
  if (!game || !game.gameId) {
    showMessage('Матч не знайдено', 'error');
    return;
  }
  const payload = {
    tournamentId: tournamentState.currentId,
    gameId,
    mode: (game.mode || '').toUpperCase(),
    teamAId: game.teamAId,
    teamBId: game.teamBId,
    result: tournamentState.selectedResult,
    exportAsRegularGame: !!dom.exportRegular?.checked,
  };
  if (!payload.mode || !payload.teamAId || !payload.teamBId) {
    showMessage('Некоректні дані матчу', 'error');
    return;
  }
  const awards = {
    mvp: dom.awards.mvp?.value.trim(),
    second: dom.awards.second?.value.trim(),
    third: dom.awards.third?.value.trim(),
  };
  Object.entries(awards).forEach(([key, value]) => {
    if (value) payload[key] = value;
  });
  const cleanedPayload = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== '' && value !== null && value !== undefined));
  const rowsPayload = { ...cleanedPayload };
  cleanedPayload.rows = [rowsPayload];
  console.log('Saving tournament game payload', cleanedPayload);
  try {
    await saveTournamentGame(cleanedPayload);
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
  });
}

async function loadLeague() {
  tournamentState.league = normalizeLeague(dom.league?.value || tournamentState.league);
  await refreshTournamentsList();
  await loadLobbyPlayers();
  const saved = restoreState();
  if (saved?.league === tournamentState.league) {
    tournamentState.teamCount = clampTeamsCount(saved.teamCount || tournamentState.teamCount);
    if (dom.teamCountSelect) dom.teamCountSelect.value = String(tournamentState.teamCount);
    tournamentState.pool = new Set(saved.pool || []);
    setTeamsToForm(saved.teams || []);
    tournamentState.games = saved.games || [];
    renderPool();
  }
}

function initTournamentMode() {
  cacheDomRefs();
  if (!dom.panel) return;

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
  dom.saveGame?.addEventListener('click', handleSaveGame);
  dom.refreshData?.addEventListener('click', refreshTournamentData);

  document.getElementById('tournament-load')?.addEventListener('click', loadLeague);
  document.getElementById('tournament-reload-lobby')?.addEventListener('click', loadLobbyPlayers);
  document.getElementById('tournament-reload-state')?.addEventListener('click', refreshTournamentData);

  bindResultButtons();
  setAppMode('regular');
  loadLeague();
}

document.addEventListener('DOMContentLoaded', initTournamentMode);
