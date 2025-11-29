// scripts/tournamentMode.js
import {
  fetchTournaments,
  createTournament,
  saveTournamentTeams,
  createTournamentGames,
  saveTournamentGame,
  fetchTournamentData,
} from './api.js?v=2025-09-19-balance-hotfix-1';
import { autoBalance } from './balance.js?v=2025-09-19-balance-hotfix-1';
import { state } from './state.js?v=2025-09-19-balance-hotfix-1';

const DEFAULT_TEAMS = 3;
const tournamentState = {
  appMode: 'regular',
  currentId: '',
  data: null,
  selectedResult: '',
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

function parsePlayerList(raw) {
  return String(raw || '')
    .split(/[,;\n]/)
    .map(p => p.trim())
    .filter(Boolean);
}

function findPlayerRecord(nick) {
  return state.players.find(p => p && p.nick === nick);
}

function toBalanceObject(nick) {
  const rec = findPlayerRecord(nick);
  if (rec) return rec;
  return { nick, pts: 0 };
}

function fillTeamsFromAutoBalance() {
  const poolEl = document.getElementById('tournament-player-pool');
  const poolList = parsePlayerList(poolEl ? poolEl.value : '');
  const players = poolList.map(toBalanceObject);
  if (!players.length) {
    showMessage('Додайте гравців у пул для автопідбору', 'warn');
    return;
  }
  const balanced = autoBalance(players, DEFAULT_TEAMS);
  Object.entries(balanced).forEach(([idx, members]) => {
    const slot = Number(idx);
    const textarea = document.getElementById(`t-team-players-${slot}`);
    if (textarea) {
      textarea.value = members.map(p => p.nick).join(',');
    }
  });
}

function collectTeamsFromForm() {
  const teams = [];
  for (let i = 1; i <= DEFAULT_TEAMS; i++) {
    const nameInput = document.getElementById(`t-team-name-${i}`);
    const playersInput = document.getElementById(`t-team-players-${i}`);
    const slotEl = document.querySelector(`.team-card[data-slot="${i}"]`);
    const teamId = slotEl?.dataset.teamId || `${tournamentState.currentId || 'T'}_TEAM${i}`;
    const teamName = (nameInput?.value || '').trim() || `Команда ${i}`;
    const players = parsePlayerList(playersInput?.value || '');
    teams.push({ teamId, teamName, players });
  }
  return teams;
}

function setTeamsToForm(teams = []) {
  for (let i = 1; i <= DEFAULT_TEAMS; i++) {
    const slotEl = document.querySelector(`.team-card[data-slot="${i}"]`);
    const team = teams[i - 1];
    if (!slotEl) continue;
    if (team) {
      slotEl.dataset.teamId = team.teamId || '';
      const nameInput = document.getElementById(`t-team-name-${i}`);
      const playersInput = document.getElementById(`t-team-players-${i}`);
      if (nameInput) nameInput.value = team.teamName || '';
      if (playersInput) playersInput.value = parsePlayerList(team.players || '').join(',');
    } else {
      slotEl.dataset.teamId = '';
      const nameInput = document.getElementById(`t-team-name-${i}`);
      const playersInput = document.getElementById(`t-team-players-${i}`);
      if (nameInput) nameInput.value = '';
      if (playersInput) playersInput.value = '';
    }
  }
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
  const selectEl = document.getElementById('tournament-game-select');
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
  const allowDraw = allowMap[(game?.mode || '').toUpperCase()] !== false;
  const drawBtn = document.querySelector('#tournament-result-buttons [data-result="DRAW"]');
  if (drawBtn) {
    drawBtn.disabled = !allowDraw;
    drawBtn.title = allowDraw ? '' : 'Нічия недоступна для цього режиму';
  }
}

function handleGameSelection() {
  const selectEl = document.getElementById('tournament-game-select');
  if (!selectEl) return;
  const gameId = selectEl.value;
  const game = (tournamentState.data?.games || []).find(g => g.gameId === gameId);
  renderAwards(game);
  applyGameStatus(game);
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
  try {
    await saveTournamentTeams({ tournamentId: tournamentState.currentId, teams: collectTeamsFromForm() });
    showMessage('Склади команд оновлено', 'success');
    await refreshTournamentData();
  } catch (err) {
    console.error(err);
    showMessage('Не вдалося зберегти склади', 'error');
  }
}

function generateRoundRobinGames(teams) {
  const modes = ['DM', 'KT', 'TR'];
  const result = [];
  let idx = 1;
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
  const gameSelect = document.getElementById('tournament-game-select');
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
  const container = document.getElementById('tournament-result-buttons');
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

  const gameSelect = document.getElementById('tournament-game-select');
  if (gameSelect) gameSelect.addEventListener('change', handleGameSelection);

  bindResultButtons();
  setAppMode('regular');
  refreshTournamentsList();
}
window.addEventListener('DOMContentLoaded', initTournamentMode);
