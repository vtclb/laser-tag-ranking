// scripts/tournamentMode.js
import {
  fetchTournaments,
  createTournament,
  saveTournamentTeams,
  createTournamentGames,
  saveTournamentGame,
  fetchTournamentData,
  fetchLeagueCsv,
  parsePlayersFromCsv,
} from './api.js?v=2025-09-19-balance-hotfix-1';
import { AVATAR_PLACEHOLDER } from './avatarConfig.js?v=2025-09-19-avatars-2';
import { autoBalance } from './balance.js?v=2025-09-19-balance-hotfix-1';
import { state } from './state.js?v=2025-09-19-balance-hotfix-1';

const DEFAULT_TEAMS = 3;
const MIN_TEAMS = 2;
const MAX_TEAMS = 5;
const tournamentState = {
  appMode: 'regular',
  currentId: '',
  data: null,
  selectedResult: '',
  lobby: [],
  lobbyLeague: 'kids',
};
const lobbyCache = new Map();

const dom = {
  teamCards: {},
  teamNames: {},
  teamPlayers: {},
  teamMetrics: {},
  teamCountSelect: null,
  lobbyTableBody: null,
  lobbySearch: null,
  lobbySelectAll: null,
  lobbyPool: null,
  gameSelect: null,
  resultButtons: null,
};

function showMessage(msg, type = 'info') {
  if (typeof showToast === 'function') {
    showToast(msg, type);
  } else {
    alert(msg);
  }
}

function setAppMode(mode) {
  tournamentState.appMode = mode === 'tournament' ? 'tournament' : 'regular';
  if (document.body) {
    document.body.dataset.appMode = tournamentState.appMode;
  }
  const regularBtn = document.getElementById('mode-regular');
  const tournamentBtn = document.getElementById('mode-tournament');
  if (regularBtn) regularBtn.classList.toggle('btn-primary', tournamentState.appMode === 'regular');
  if (tournamentBtn) tournamentBtn.classList.toggle('btn-primary', tournamentState.appMode === 'tournament');
}

function cacheDomRefs() {
  dom.teamCountSelect = document.getElementById('tournament-team-count');
  dom.lobbyTableBody = document.querySelector('#tournament-lobby-table tbody');
  dom.lobbySearch = document.getElementById('tournament-lobby-search');
  dom.lobbySelectAll = document.getElementById('tournament-lobby-select-all');
  dom.lobbyPool = document.getElementById('tournament-player-pool');
  dom.gameSelect = document.getElementById('tournament-game-select');
  dom.resultButtons = document.querySelector('#tournament-result-buttons');

  for (let i = 1; i <= MAX_TEAMS; i++) {
    dom.teamCards[i] = document.querySelector(`.team-card[data-slot="${i}"]`);
    dom.teamNames[i] = document.getElementById(`t-team-name-${i}`);
    dom.teamPlayers[i] = document.getElementById(`t-team-players-${i}`);
    dom.teamMetrics[i] = document.getElementById(`t-team-metrics-${i}`);
  }
}

function parsePlayerList(raw) {
  return String(raw || '')
    .split(/[,;\n]/)
    .map(p => p.trim())
    .filter(Boolean);
}

function findPlayerRecord(nick) {
  return state.players.find(p => p && p.nick === nick);
}

function buildPlayerLookup() {
  const lookup = new Map();
  state.players.forEach(p => {
    if (p?.nick) lookup.set(p.nick.toLowerCase(), p);
  });
  return lookup;
}

function toBalanceObject(nick) {
  const rec = findPlayerRecord(nick);
  if (rec) return rec;
  return { nick, pts: 0 };
}

function renderTeamMetrics(slot, metrics) {
  const el = dom.teamMetrics[slot];
  if (!el) return;
  if (!metrics) {
    el.textContent = '';
    return;
  }
  el.innerHTML = `Σ ${metrics.totalPts.toFixed(0)} · Avg ${metrics.avgPts.toFixed(1)} · SI ${metrics.strengthIndex.toFixed(1)} · ${metrics.count} грав.`;
}

function calculateTeamMetrics(players) {
  const lookup = buildPlayerLookup();
  const list = parsePlayerList(players);
  const ptsValues = list.map(n => lookup.get(n.toLowerCase())?.pts || 0);
  const totalPts = ptsValues.reduce((sum, v) => sum + (Number(v) || 0), 0);
  const count = ptsValues.length;
  const avgPts = count ? totalPts / count : 0;
  return {
    totalPts,
    avgPts,
    strengthIndex: avgPts,
    count,
  };
}

function recomputeAllTeamMetrics() {
  for (let i = 1; i <= MAX_TEAMS; i++) {
    const textarea = dom.teamPlayers[i];
    const metrics = textarea ? calculateTeamMetrics(textarea.value || '') : null;
    renderTeamMetrics(i, metrics);
  }
}

function fillTeamsFromAutoBalance() {
  const poolEl = dom.lobbyPool;
  const poolList = parsePlayerList(poolEl ? poolEl.value : '');
  const players = poolList.map(toBalanceObject);
  if (!players.length) {
    showMessage('Додайте гравців у пул для автопідбору', 'warn');
    return;
  }
  const desiredCount = Number(dom.teamCountSelect?.value || DEFAULT_TEAMS);
  const teamCount = Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, desiredCount));
  const balanced = autoBalance(players, teamCount);
  Object.entries(balanced).forEach(([idx, members]) => {
    const slot = Number(idx);
    const textarea = dom.teamPlayers[slot];
    if (textarea) {
      textarea.value = members.map(p => p.nick).join(',');
    }
  });
}

function collectTeamsFromForm() {
  const desiredCount = Number(dom.teamCountSelect?.value || DEFAULT_TEAMS);
  const total = Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, desiredCount));
  const teams = [];
  for (let i = 1; i <= total; i++) {
    const nameInput = dom.teamNames[i];
    const playersInput = dom.teamPlayers[i];
    const slotEl = dom.teamCards[i];
    const teamId = slotEl?.dataset.teamId || `${tournamentState.currentId || 'T'}_TEAM${i}`;
    const teamName = (nameInput?.value || '').trim() || `Команда ${i}`;
    const players = parsePlayerList(playersInput?.value || '');
    teams.push({ teamId, teamName, players });
  }
  return teams;
}

function setTeamsToForm(teams = []) {
  const total = Array.isArray(teams) ? Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, teams.length || DEFAULT_TEAMS)) : DEFAULT_TEAMS;
  if (dom.teamCountSelect) dom.teamCountSelect.value = total;

  for (let i = 1; i <= MAX_TEAMS; i++) {
    const slotEl = dom.teamCards[i];
    const team = teams[i - 1];
    if (!slotEl) continue;
    slotEl.hidden = i > total;
    if (team) {
      slotEl.dataset.teamId = team.teamId || '';
      const nameInput = dom.teamNames[i];
      const playersInput = dom.teamPlayers[i];
      if (nameInput) nameInput.value = team.teamName || '';
      if (playersInput) playersInput.value = parsePlayerList(team.players || '').join(',');
      renderTeamMetrics(i, calculateTeamMetrics(playersInput?.value || ''));
    } else {
      slotEl.dataset.teamId = '';
      const nameInput = dom.teamNames[i];
      const playersInput = dom.teamPlayers[i];
      if (nameInput) nameInput.value = '';
      if (playersInput) playersInput.value = '';
      renderTeamMetrics(i, calculateTeamMetrics(playersInput?.value || ''));
    }
  }
}

function applyTeamCountVisibility() {
  const total = Number(dom.teamCountSelect?.value || DEFAULT_TEAMS);
  for (let i = 1; i <= MAX_TEAMS; i++) {
    const slotEl = dom.teamCards[i];
    if (slotEl) {
      slotEl.hidden = i > total;
    }
  }
  recomputeAllTeamMetrics();
}

function validateTeamsBeforeSave(teams) {
  const filled = teams.filter(t => (t.players || []).length);
  if (filled.length < MIN_TEAMS) {
    return 'Мінімум дві команди мають містити гравців';
  }

  const lookup = buildPlayerLookup();
  const duplicates = new Map();
  const missing = new Set();
  const strengths = [];
  filled.forEach(team => {
    const metrics = calculateTeamMetrics(team.players || []);
    strengths.push(metrics.strengthIndex);
    (team.players || []).forEach(nick => {
      const key = nick.toLowerCase();
      if (!duplicates.has(key)) {
        duplicates.set(key, []);
      }
      duplicates.get(key).push(team.teamName || team.teamId);
      if (!lookup.has(key)) missing.add(nick);
    });
  });

  const offender = Array.from(duplicates.entries()).find(([, list]) => list.length > 1);
  if (offender) {
    return `Гравець ${offender[0]} дублюється у командах: ${offender[1].join(', ')}`;
  }

  if (missing.size) {
    return `Невідомі гравці: ${Array.from(missing).join(', ')}`;
  }

  const minStrength = Math.min(...strengths);
  const maxStrength = Math.max(...strengths);
  if (strengths.length >= 2 && maxStrength > 0) {
    const diffRatio = (maxStrength - minStrength) / maxStrength;
    if (diffRatio > 0.4) {
      showMessage('Попередження: різниця сили команд перевищує 40%', 'warn');
    }
  }

  return '';
}

async function refreshTournamentsList() {
  const leagueSelect = document.getElementById('league');
  const league = leagueSelect ? leagueSelect.value : 'sundaygames';
  const selectEl = document.getElementById('tournament-select');
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">— Оберіть турнір —</option>';
  try {
    const tournaments = await fetchTournaments({ league, status: 'ACTIVE' });
    tournaments.forEach(t => {
      const option = document.createElement('option');
      option.value = t.tournamentId;
      option.textContent = `${t.name || t.tournamentId} (${t.league || ''})`;
      selectEl.appendChild(option);
    });
  } catch (err) {
    console.error(err);
    showMessage('Не вдалося отримати список турнірів', 'error');
  }
}

function renderGameOptions() {
  const selectEl = dom.gameSelect;
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">— Немає матчів —</option>';
  const games = Array.isArray(tournamentState.data?.games) ? tournamentState.data.games : [];
  const teams = Array.isArray(tournamentState.data?.teams) ? tournamentState.data.teams : [];
  const teamNames = Object.fromEntries(teams.map(t => [t.teamId, t.teamName || t.teamId]));

  games.forEach(game => {
    const label = `${teamNames[game.teamAId] || game.teamAId} vs ${teamNames[game.teamBId] || game.teamBId} — ${game.mode}`;
    const status = game.winnerTeamId || game.isDraw === 'TRUE' ? 'зіграно' : 'не зіграно';
    const option = document.createElement('option');
    option.value = game.gameId;
    option.textContent = `${label} (${status})`;
    selectEl.appendChild(option);
  });

  if (games.length) {
    selectEl.value = games[0].gameId;
  }
}

function renderAwards(game) {
  const selectIds = ['t-mvp', 't-second', 't-third'];
  const teams = Array.isArray(tournamentState.data?.teams) ? tournamentState.data.teams : [];
  const teamMap = Object.fromEntries(teams.map(t => [t.teamId, t]));
  const players = [];
  if (game) {
    parsePlayerList(teamMap[game.teamAId]?.players || []).forEach(n => players.push(n));
    parsePlayerList(teamMap[game.teamBId]?.players || []).forEach(n => players.push(n));
  }
  const unique = Array.from(new Set(players));
  selectIds.forEach(id => {
    const selectEl = document.getElementById(id);
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">—</option>';
    unique.forEach(nick => {
      const opt = document.createElement('option');
      opt.value = nick;
      opt.textContent = nick;
      selectEl.appendChild(opt);
    });
  });
}

function renderMatchPanel(game) {
  const teams = Array.isArray(tournamentState.data?.teams) ? tournamentState.data.teams : [];
  const teamMap = Object.fromEntries(teams.map(t => [t.teamId, t]));
  const lookup = buildPlayerLookup();

    const fillTeam = (containerId, teamId) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const nameEl = container.querySelector('h4');
      const listEl = container.querySelector('.match-player-list');
      const strengthEl = container.querySelector('p');
      const team = teamMap[teamId];
      if (nameEl) nameEl.textContent = team?.teamName || teamId || '—';
      if (listEl) listEl.innerHTML = '';
      const members = parsePlayerList(team?.players || '');
      const ptsValues = [];
      members.forEach(nick => {
        const li = document.createElement('li');
        li.className = 'match-player-row';
        const record = lookup.get(nick.toLowerCase());
        const pts = record?.pts || 0;
        ptsValues.push(pts);

        const img = document.createElement('img');
        img.className = 'avatar avatar-sm';
        img.alt = nick;
        img.src = record?.avatar || AVATAR_PLACEHOLDER;
        const text = document.createElement('span');
        text.textContent = `${nick} — ${pts}`;
        li.appendChild(img);
        li.appendChild(text);
        listEl?.appendChild(li);
      });
      const totalPts = ptsValues.reduce((s, v) => s + v, 0);
      const avg = ptsValues.length ? totalPts / ptsValues.length : 0;
      if (strengthEl) strengthEl.textContent = members.length ? `Σ ${totalPts.toFixed(0)} · Avg ${avg.toFixed(1)}` : '';
    };

  fillTeam('match-team-a', game?.teamAId);
  fillTeam('match-team-b', game?.teamBId);
}

function setSelectedResult(value) {
  tournamentState.selectedResult = value || '';
  const buttons = document.querySelectorAll('#tournament-result-buttons [data-result]');
  buttons.forEach(btn => {
    const match = btn.dataset.result === value;
    btn.classList.toggle('is-selected', match);
  });
}

function applyGameStatus(game) {
  const statusEl = document.getElementById('tournament-game-status');
  if (!statusEl) return;
  if (!game) {
    statusEl.textContent = '';
    setSelectedResult('');
    return;
  }
  if (game.isDraw === 'TRUE') {
    statusEl.textContent = 'Статус: нічия';
    setSelectedResult('DRAW');
  } else if (game.winnerTeamId) {
    statusEl.textContent = `Статус: переможець ${game.winnerTeamId}`;
    const buttons = document.querySelectorAll('#tournament-result-buttons [data-result]');
    let selected = '';
    buttons.forEach(btn => {
      if (btn.dataset.result === 'A' && game.winnerTeamId === game.teamAId) selected = 'A';
      if (btn.dataset.result === 'B' && game.winnerTeamId === game.teamBId) selected = 'B';
    });
    setSelectedResult(selected);
  } else {
    statusEl.textContent = 'Статус: не зіграно';
    setSelectedResult('');
  }
}

function updateDrawAvailability(game) {
  const allowMap = tournamentState.data?.config || {};
  const mode = (game?.mode || '').toUpperCase();
  const allowDraw = mode !== 'KT' && allowMap[mode] !== false;
  const drawBtn = document.querySelector('#tournament-result-buttons [data-result="DRAW"]');
  if (drawBtn) {
    drawBtn.disabled = !allowDraw;
    drawBtn.title = allowDraw ? '' : 'Нічия недоступна для цього режиму';
  }
}

function handleGameSelection() {
  const selectEl = dom.gameSelect;
  if (!selectEl) return;
  const gameId = selectEl.value;
  const game = (tournamentState.data?.games || []).find(g => g.gameId === gameId);
  renderAwards(game);
  applyGameStatus(game);
  renderMatchPanel(game);
  updateDrawAvailability(game);
}

async function refreshTournamentData() {
  if (!tournamentState.currentId) return;
  try {
    const data = await fetchTournamentData(tournamentState.currentId);
    tournamentState.data = data;
    setTeamsToForm(data?.teams || []);
    renderGameOptions();
    handleGameSelection();
  } catch (err) {
    console.error(err);
    showMessage('Не вдалося оновити дані турніру', 'error');
  }
}

function renderLobbyTable(players = []) {
  const tbody = dom.lobbyTableBody;
  if (!tbody) return;
  tbody.innerHTML = '';
  const search = (dom.lobbySearch?.value || '').toLowerCase();
  players
    .filter(p => !search || p.nick.toLowerCase().includes(search))
    .sort((a, b) => (Number(b.pts) || 0) - (Number(a.pts) || 0))
    .forEach(player => {
      const tr = document.createElement('tr');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = player.nick;
      checkbox.className = 't-lobby-check';
      const tdCheck = document.createElement('td');
      tdCheck.appendChild(checkbox);
      tr.appendChild(tdCheck);

      const tdAvatar = document.createElement('td');
      const img = document.createElement('img');
      img.className = 'avatar avatar-sm';
      img.alt = player.nick;
      img.src = player.avatar || AVATAR_PLACEHOLDER;
      tdAvatar.appendChild(img);
      tr.appendChild(tdAvatar);

      const cells = [player.nick, Number(player.pts) || 0, player.rank || '', player.games || 0];
      const keys = ['nick', 'pts', 'rank', 'games'];
      cells.forEach((val, idx) => {
        const td = document.createElement('td');
        td.textContent = val;
        td.dataset.field = keys[idx];
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
}

function toggleLobbySelection(source) {
  const rows = document.querySelectorAll('#tournament-lobby-table tbody input[type="checkbox"]');
  rows.forEach(cb => { cb.checked = source?.checked; });
}

function addSelectedLobbyToPool() {
  const selected = Array.from(document.querySelectorAll('#tournament-lobby-table tbody input[type="checkbox"]:checked'))
    .map(cb => cb.value)
    .filter(Boolean);
  if (!selected.length) return;
  const pool = dom.lobbyPool;
  if (!pool) return;
  const existing = parsePlayerList(pool.value);
  const merged = Array.from(new Set([...existing, ...selected]));
  pool.value = merged.join(',');
  recomputeAllTeamMetrics();
}

async function loadLobbyPlayers() {
  try {
    const select = document.getElementById('tournament-lobby-league');
    const league = select ? select.value : 'kids';
    tournamentState.lobbyLeague = league;
    let players = lobbyCache.get(league);
    if (!players) {
      const csv = await fetchLeagueCsv(league);
      players = parsePlayersFromCsv(csv).map(p => ({ ...p, games: p.games || 0 }));
      lobbyCache.set(league, players);
    }
    tournamentState.lobby = players;
    state.players = players;
    renderLobbyTable(players);
    recomputeAllTeamMetrics();
  } catch (err) {
    console.error(err);
    showMessage('Не вдалося завантажити лоббі', 'error');
  }
}

async function handleTournamentChange() {
  const selectEl = document.getElementById('tournament-select');
  tournamentState.currentId = selectEl ? selectEl.value : '';
  tournamentState.data = null;
  if (tournamentState.currentId) {
    await refreshTournamentData();
  }
}

async function handleCreateTournament() {
  const form = document.getElementById('create-tournament-form');
  if (form) form.hidden = !form.hidden;
}

async function submitCreateTournament() {
  const nameEl = document.getElementById('tournament-name');
  const leagueEl = document.getElementById('tournament-league');
  const name = nameEl ? nameEl.value.trim() : '';
  const league = leagueEl ? leagueEl.value : 'sundaygames';
  if (!name) {
    showMessage('Вкажіть назву турніру', 'warn');
    return;
  }
  try {
    const tournamentId = await createTournament({ name, league });
    showMessage('Турнір створено', 'success');
    if (nameEl) nameEl.value = '';
    await refreshTournamentsList();
    const selectEl = document.getElementById('tournament-select');
    if (selectEl) {
      selectEl.value = tournamentId;
      tournamentState.currentId = tournamentId;
      await refreshTournamentData();
    }
  } catch (err) {
    console.error(err);
    showMessage('Не вдалося створити турнір', 'error');
  }
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
  const result = [];
  const modes = ['DM', 'KT', 'TR'];
  let idx = 1;
  if (teams.length === 2) {
    modes.forEach(mode => {
      result.push({
        gameId: `G${idx++}`,
        mode,
        teamAId: teams[0].teamId,
        teamBId: teams[1].teamId,
      });
    });
    return result;
  }

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      modes.forEach(mode => {
        result.push({
          gameId: `G${idx++}`,
          mode,
          teamAId: teams[i].teamId,
          teamBId: teams[j].teamId,
        });
      });
    }
  }
  return result;
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
  try {
    await createTournamentGames({ tournamentId: tournamentState.currentId, games });
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
  const gameSelect = dom.gameSelect;
  const gameId = gameSelect ? gameSelect.value : '';
  if (!gameId) {
    showMessage('Оберіть матч для збереження', 'warn');
    return;
  }
  if (!tournamentState.selectedResult) {
    showMessage('Оберіть результат матчу', 'warn');
    return;
  }
  const game = (tournamentState.data?.games || []).find(g => g.gameId === gameId);
  if (!game) {
    showMessage('Матч не знайдено', 'error');
    return;
  }
  const payload = {
    tournamentId: tournamentState.currentId,
    gameId,
    mode: game.mode,
    teamAId: game.teamAId,
    teamBId: game.teamBId,
    result: tournamentState.selectedResult,
    mvp: document.getElementById('t-mvp')?.value || '',
    second: document.getElementById('t-second')?.value || '',
    third: document.getElementById('t-third')?.value || '',
    exportAsRegularGame: !!document.getElementById('t-export-regular')?.checked,
  };
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
  const container = dom.resultButtons;
  if (!container) return;
  container.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const result = target.dataset.result;
    if (!result || target.disabled) return;
    setSelectedResult(result);
  });
}

function initTournamentMode() {
  cacheDomRefs();
  const regularBtn = document.getElementById('mode-regular');
  const tournamentBtn = document.getElementById('mode-tournament');
  if (regularBtn) regularBtn.addEventListener('click', () => setAppMode('regular'));
  if (tournamentBtn) tournamentBtn.addEventListener('click', () => setAppMode('tournament'));

  const refreshBtn = document.getElementById('refresh-tournaments');
  if (refreshBtn) refreshBtn.addEventListener('click', refreshTournamentsList);

  const selectEl = document.getElementById('tournament-select');
  if (selectEl) selectEl.addEventListener('change', handleTournamentChange);

  const toggleCreate = document.getElementById('open-create-tournament');
  if (toggleCreate) toggleCreate.addEventListener('click', handleCreateTournament);

  const submitCreate = document.getElementById('create-tournament-submit');
  if (submitCreate) submitCreate.addEventListener('click', submitCreateTournament);

  const autoBtn = document.getElementById('btn-autofill-teams');
  if (autoBtn) autoBtn.addEventListener('click', fillTeamsFromAutoBalance);

  const saveTeamsBtn = document.getElementById('btn-save-teams');
  if (saveTeamsBtn) saveTeamsBtn.addEventListener('click', handleSaveTeams);

  const genGamesBtn = document.getElementById('btn-generate-games');
  if (genGamesBtn) genGamesBtn.addEventListener('click', handleGenerateGames);

  const saveGameBtn = document.getElementById('tournament-save-game');
  if (saveGameBtn) saveGameBtn.addEventListener('click', handleSaveGame);

  const refreshGames = document.getElementById('refresh-games');
  if (refreshGames) refreshGames.addEventListener('click', refreshTournamentData);

  if (dom.gameSelect) dom.gameSelect.addEventListener('change', handleGameSelection);

  if (dom.teamCountSelect) dom.teamCountSelect.addEventListener('change', applyTeamCountVisibility);

  const lobbyLoadBtn = document.getElementById('tournament-load-lobby');
  if (lobbyLoadBtn) lobbyLoadBtn.addEventListener('click', loadLobbyPlayers);
  const lobbySearch = dom.lobbySearch;
  if (lobbySearch) lobbySearch.addEventListener('input', () => renderLobbyTable(tournamentState.lobby));
  const lobbySelectAll = dom.lobbySelectAll;
  if (lobbySelectAll) lobbySelectAll.addEventListener('change', (e) => toggleLobbySelection(e.target));
  const lobbyAddBtn = document.getElementById('tournament-lobby-add');
  if (lobbyAddBtn) lobbyAddBtn.addEventListener('click', addSelectedLobbyToPool);

  for (let i = 1; i <= MAX_TEAMS; i++) {
    const textarea = dom.teamPlayers[i];
    if (textarea) textarea.addEventListener('input', recomputeAllTeamMetrics);
  }

  bindResultButtons();
  setAppMode('regular');
  applyTeamCountVisibility();
  recomputeAllTeamMetrics();
  refreshTournamentsList();
}
window.addEventListener('DOMContentLoaded', initTournamentMode);
