// Tournament mode controller
import { fetchLeagueCsv, parsePlayersFromCsv } from './api.js';
import { autoBalance2 as autoBalanceTwo, autoBalanceN as autoBalanceMany } from './balanceUtils.js';
import { AVATAR_PLACEHOLDER } from './avatarConfig.js';

const TOURNAMENT_GAME_MODES = ['DM', 'KT', 'TR'];
const MAX_TEAMS = 5;
const MIN_TEAMS = 2;
const STORAGE_KEY = 'tournament-state-v3';

const RANK_COLORS = {
  bronze: '#8d5524',
  silver: '#d3d3d3',
  gold: '#ffd700',
  platinum: '#00eaff',
  diamond: '#27e0ff',
  master: '#ff27e0',
  grandmaster: '#ff0000'
};

const tournamentState = {
  league: 'kids',
  players: [],
  playerMap: new Map(),
  lobby: new Map(),
  pool: new Map(),
  teams: {},
  games: [],
  teamCount: 3,
  sort: { key: 'nick', dir: 'asc' },
  selectedGame: ''
};

const dom = {};

function cacheDom() {
  dom.panel = document.getElementById('tournament-panel');
  if (!dom.panel) return false;
  dom.league = document.getElementById('tournament-league');
  dom.load = document.getElementById('tournament-load');
  dom.reloadLobby = document.getElementById('tournament-reload-lobby');
  dom.reloadState = document.getElementById('tournament-reload-state');
  dom.search = document.getElementById('tournament-search');
  dom.tableBody = document.querySelector('#tournament-table tbody');
  dom.addPool = document.getElementById('tournament-add-pool');
  dom.clear = document.getElementById('tournament-clear');
  dom.pool = document.getElementById('tournament-pool');
  dom.teamSelect = document.getElementById('tournament-teams');
  dom.auto = document.getElementById('tournament-auto');
  dom.teamsWrap = document.getElementById('tournament-teams-wrap');
  dom.saveTeams = document.getElementById('tournament-save-teams');
  dom.clearTeams = document.getElementById('tournament-clear-teams');
  dom.modeChecks = Array.from(document.querySelectorAll('.mode-check'));
  dom.bestOf = document.getElementById('tournament-bestof');
  dom.generate = document.getElementById('tournament-generate');
  dom.games = document.getElementById('tournament-games');
  dom.gamesList = document.getElementById('tournament-games-list');
  dom.match = document.getElementById('tournament-match');
  dom.result = {
    status: document.getElementById('tournament-result-status'),
    resultA: document.getElementById('result-team-a'),
    resultB: document.getElementById('result-team-b'),
    resultDraw: document.getElementById('result-draw'),
    mvp: document.getElementById('result-mvp'),
    second: document.getElementById('result-second'),
    third: document.getElementById('result-third'),
    save: document.getElementById('tournament-save-result'),
    refresh: document.getElementById('tournament-refresh')
  };
  dom.sortButtons = Array.from(document.querySelectorAll('[data-sort]'));
  return true;
}

function setModeActive(isActive) {
  if (!dom.panel) return;
  dom.panel.classList.toggle('active', isActive);
  if (isActive) {
    renderLobby();
    renderPool();
    renderTeams();
    renderGames();
    renderMatchPanel();
  }
}

function parseLeague(value) {
  if (value === 'olds') return 'olds';
  if (value === 'sundaygames') return 'sundaygames';
  return 'kids';
}

function clampTeamsCount(raw) {
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value)) return MIN_TEAMS;
  return Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, value));
}

function rankKey(rank) {
  return String(rank || '').trim().toLowerCase();
}

function rankColor(rank) {
  const color = RANK_COLORS[rankKey(rank)];
  return color || '';
}

function addRankClass(el, rank) {
  const key = rankKey(rank);
  if (!key) return;
  el.dataset.rank = key;
  const color = rankColor(rank);
  if (color) {
    el.style.boxShadow = `inset 0 0 0 1px ${color}30`;
    el.style.background = `${color}0f`;
  }
}

function persistState() {
  try {
    const payload = {
      league: tournamentState.league,
      teamCount: tournamentState.teamCount,
      sort: tournamentState.sort,
      teams: Object.values(tournamentState.teams).map(team => ({
        teamId: team.teamId,
        teamName: team.teamName,
        players: [...team.players]
      })),
      games: tournamentState.games,
      pool: [...tournamentState.pool.keys()]
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('Persist tournament state failed', err);
  }
}

function restoreState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Restore tournament state failed', err);
    return null;
  }
}

function buildPlayerMap(players) {
  tournamentState.playerMap = new Map(players.map(p => [p.nick, p]));
}

function createTeam(index, existing) {
  const suffix = index + 1;
  return {
    teamId: existing?.teamId || `team-${suffix}`,
    teamName: existing?.teamName || existing?.name || `Команда ${suffix}`,
    players: Array.isArray(existing?.players) ? [...existing.players] : []
  };
}

function ensureTeams() {
  const count = clampTeamsCount(dom.teamSelect?.value || tournamentState.teamCount);
  tournamentState.teamCount = count;
  const next = {};
  const currentTeams = Object.values(tournamentState.teams);
  for (let i = 0; i < count; i++) {
    next[i + 1] = createTeam(i, currentTeams[i]);
  }

  const removed = currentTeams.slice(count);
  removed.forEach(team => {
    team?.players?.forEach(nick => {
      const player = tournamentState.playerMap.get(nick);
      if (player) tournamentState.lobby.set(nick, player);
    });
  });
  tournamentState.teams = next;
}

function applySavedState(saved) {
  if (!saved || saved.league !== tournamentState.league) return;
  tournamentState.teamCount = clampTeamsCount(saved.teamCount || tournamentState.teamCount);
  if (dom.teamSelect) dom.teamSelect.value = String(tournamentState.teamCount);
  const savedTeams = Array.isArray(saved.teams) ? saved.teams : [];
  tournamentState.teams = {};
  for (let i = 0; i < tournamentState.teamCount; i++) {
    const existing = savedTeams[i];
    const team = createTeam(i, existing);
    team.players = team.players.filter(nick => tournamentState.playerMap.has(nick));
    tournamentState.teams[i + 1] = team;
  }
  const poolPairs = Array.isArray(saved.pool)
    ? saved.pool
        .map(nick => {
          const player = tournamentState.playerMap.get(nick);
          return player ? [nick, player] : null;
        })
        .filter(Boolean)
    : [];
  tournamentState.pool = new Map(poolPairs);
  tournamentState.games = Array.isArray(saved.games) ? saved.games : [];
  tournamentState.selectedGame = '';
  tournamentState.sort = saved.sort || tournamentState.sort;
  syncLobbyWithTeams();
}

async function loadLeague() {
  const league = parseLeague(dom.league?.value);
  tournamentState.league = league;
  const csv = await fetchLeagueCsv(league);
  const players = parsePlayersFromCsv(csv);
  tournamentState.players = players;
  buildPlayerMap(players);
  tournamentState.lobby = new Map(players.map(p => [p.nick, p]));
  const saved = restoreState();
  applySavedState(saved);
  renderLobby();
  renderPool();
  renderTeams();
  renderGames();
  renderMatchPanel();
}

function syncLobbyWithTeams() {
  const assigned = new Set();
  Object.values(tournamentState.teams).forEach(team => {
    team.players.forEach(nick => assigned.add(nick));
  });
  tournamentState.lobby.forEach((_, nick) => {
    if (assigned.has(nick)) tournamentState.lobby.delete(nick);
  });
  tournamentState.players.forEach(p => {
    if (!assigned.has(p.nick)) tournamentState.lobby.set(p.nick, p);
  });
}

function filteredPlayers() {
  const term = (dom.search?.value || '').trim().toLowerCase();
  let list = Array.from(tournamentState.lobby.values());
  if (term) {
    list = list.filter(p => p.nick.toLowerCase().includes(term));
  }
  const dir = tournamentState.sort.dir === 'desc' ? -1 : 1;
  const key = tournamentState.sort.key;
  list.sort((a, b) => {
    if (key === 'pts') return (Number(b.pts || 0) - Number(a.pts || 0)) * dir;
    if (key === 'games') return (Number(b.games || b.matches || 0) - Number(a.games || a.matches || 0)) * dir;
    if (key === 'rank') return rankKey(a.rank).localeCompare(rankKey(b.rank)) * dir;
    return a.nick.localeCompare(b.nick) * dir;
  });
  return list;
}

function renderLobby() {
  if (!dom.tableBody) return;
  dom.tableBody.innerHTML = '';
  filteredPlayers().forEach(player => {
    const tr = document.createElement('tr');
    tr.draggable = true;
    tr.dataset.nick = player.nick;
    tr.addEventListener('dragstart', handleDragFromLobby);
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.nick = player.nick;
    const tdCb = document.createElement('td');
    tdCb.appendChild(cb);

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
    tr.append(tdCb, tdNick, tdPts, tdGames);
    dom.tableBody.appendChild(tr);
  });
}

function selectedFromTable() {
  const boxes = Array.from(dom.tableBody?.querySelectorAll('input[type="checkbox"]:checked') || []);
  const selected = new Set();
  boxes.forEach(cb => selected.add(cb.dataset.nick));
  return tournamentState.players.filter(p => selected.has(p.nick));
}

function addToPool() {
  selectedFromTable().forEach(p => tournamentState.pool.set(p.nick, p));
  renderPool();
  persistState();
}

function clearSelection() {
  tournamentState.pool.clear();
  renderPool();
  persistState();
}

function renderPool() {
  if (!dom.pool) return;
  dom.pool.innerHTML = '';
  tournamentState.pool.forEach(p => {
    const chip = document.createElement('span');
    chip.className = 'tag';
    chip.textContent = `${p.nick} · ${Number(p.pts || 0).toFixed(0)}`;
    addRankClass(chip, p.rank);
    dom.pool.appendChild(chip);
  });
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

function applyAutoBalance() {
  const teamsCount = clampTeamsCount(dom.teamSelect?.value || tournamentState.teamCount);
  const merged = new Map();
  const poolPlayers = tournamentState.pool.size ? Array.from(tournamentState.pool.values()) : [];
  const lobbyPlayers = Array.from(tournamentState.lobby.values());
  const assignedPlayers = Object.values(tournamentState.teams)
    .flatMap(team => team.players)
    .map(nick => tournamentState.playerMap.get(nick))
    .filter(Boolean);
  [...poolPlayers, ...assignedPlayers, ...lobbyPlayers].forEach(p => merged.set(p.nick, p));

  const balanced = computeBalance(Array.from(merged.values()), teamsCount);
  const prevTeams = { ...tournamentState.teams };
  tournamentState.teamCount = teamsCount;
  if (dom.teamSelect) dom.teamSelect.value = String(teamsCount);
  tournamentState.teams = {};
  for (let i = 1; i <= teamsCount; i++) {
    const members = balanced[i] || [];
    const base = createTeam(i - 1, prevTeams[i]);
    base.teamId = prevTeams[i]?.teamId || base.teamId;
    base.teamName = prevTeams[i]?.teamName || base.teamName;
    tournamentState.teams[i] = base;
    tournamentState.teams[i].players = members.map(p => p.nick);
  }
  syncLobbyWithTeams();
  renderTeams();
  persistState();
}

function removePlayerFromTeams(nick) {
  Object.values(tournamentState.teams).forEach(team => {
    const idx = team.players.indexOf(nick);
    if (idx >= 0) team.players.splice(idx, 1);
  });
}

function movePlayerToTeam(nick, teamId, index = null) {
  const player = tournamentState.playerMap.get(nick);
  if (!player || !tournamentState.teams[teamId]) return;
  removePlayerFromTeams(nick);
  tournamentState.lobby.delete(nick);
  const list = tournamentState.teams[teamId].players;
  const targetIndex = index === null || index > list.length ? list.length : index;
  list.splice(targetIndex, 0, nick);
  syncLobbyWithTeams();
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

function handleTeamDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleTeamDrop(e) {
  e.preventDefault();
  const nick = e.dataTransfer.getData('text/plain');
  const teamId = e.currentTarget.dataset.teamId;
  if (!nick || !teamId) return;
  const items = Array.from(e.currentTarget.querySelectorAll('li'));
  const y = e.clientY;
  let insertIndex = items.length;
  for (let i = 0; i < items.length; i++) {
    const rect = items[i].getBoundingClientRect();
    if (y < rect.top + rect.height / 2) {
      insertIndex = i;
      break;
    }
  }
  movePlayerToTeam(nick, teamId, insertIndex);
}

function resetTeams() {
  Object.values(tournamentState.teams).forEach(team => team.players.splice(0, team.players.length));
  tournamentState.games = [];
  syncLobbyWithTeams();
  renderLobby();
  renderTeams();
  renderGames();
  renderMatchPanel();
  persistState();
}

function renderTeams() {
  if (!dom.teamsWrap) return;
  ensureTeams();
  dom.teamsWrap.innerHTML = '';
  const teams = Object.entries(tournamentState.teams);
  teams.forEach(([key, team], idx) => {
    const card = document.createElement('div');
    card.className = 'team-card droppable';
    card.dataset.teamId = key;

    const headerRow = document.createElement('div');
    headerRow.className = 'team-header';
    const title = document.createElement('span');
    title.className = 'muted';
    title.textContent = `ID: ${team.teamId}`;
    const nameInput = document.createElement('input');
    nameInput.className = 'team-name';
    nameInput.value = team.teamName;
    nameInput.addEventListener('input', () => {
      team.teamName = nameInput.value || `Команда ${idx + 1}`;
      persistState();
      renderGames();
    });
    headerRow.append(title, nameInput);

    const ul = document.createElement('ul');
    ul.className = 'team-list';
    ul.dataset.teamId = key;
    ul.addEventListener('dragover', handleTeamDragOver);
    ul.addEventListener('drop', handleTeamDrop);

    let teamTotal = 0;
    team.players.forEach((nick, index) => {
      const player = tournamentState.playerMap.get(nick);
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
        const data = tournamentState.playerMap.get(nick);
        if (data) tournamentState.lobby.set(nick, data);
        renderLobby();
        renderTeams();
        persistState();
      });
      li.appendChild(removeBtn);

      ul.appendChild(li);
      teamTotal += Number(player?.pts || 0);
    });

    const avg = team.players.length ? (teamTotal / team.players.length).toFixed(1) : '0.0';
    const meta = document.createElement('div');
    meta.className = 'metrics';
    meta.innerHTML = `<span class="tag">Σ ${teamTotal.toFixed(0)}</span><span class="tag">Avg ${avg}</span><span class="tag">${team.players.length} грав.</span>`;

    card.append(headerRow, ul, meta);
    dom.teamsWrap.appendChild(card);
  });
}

function collectModes() {
  return dom.modeChecks
    .filter(inp => inp.checked)
    .map(inp => inp.value)
    .filter(mode => TOURNAMENT_GAME_MODES.includes(mode));
}

function getActiveTeams() {
  return Object.entries(tournamentState.teams)
    .slice(0, tournamentState.teamCount)
    .map(([key, team]) => ({
      key,
      teamId: team.teamId,
      teamName: team.teamName || team.teamId,
      players: [...team.players]
    }));
}

function generateGames() {
  const modes = collectModes();
  if (!modes.length) {
    showToast?.('Оберіть хоча б один режим', 'warn');
    return;
  }
  const teams = getActiveTeams();
  if (teams.length < MIN_TEAMS) {
    showToast?.('Додайте щонайменше дві команди', 'warn');
    return;
  }

  const bestOf = Math.max(1, Number.parseInt(dom.bestOf?.value || '1', 10) || 1);
  const games = [];

  if (teams.length === 2) {
    modes.forEach(mode => {
      for (let i = 0; i < bestOf; i++) {
        games.push({
          id: `g-${mode}-${i + 1}-${Date.now()}`,
          teamA: teams[0].key,
          teamB: teams[1].key,
          mode,
          round: i + 1,
          winnerTeamId: '',
          isDraw: false,
          mvpNick: '',
          secondNick: '',
          thirdNick: ''
        });
      }
    });
  } else {
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        modes.forEach((mode, index) => {
          games.push({
            id: `g-${mode}-${i}-${j}-${index}-${Date.now()}`,
            teamA: teams[i].key,
            teamB: teams[j].key,
            mode,
            round: games.length + 1,
            winnerTeamId: '',
            isDraw: false,
            mvpNick: '',
            secondNick: '',
            thirdNick: ''
          });
        });
      }
    }
  }

  tournamentState.games = games;
  tournamentState.selectedGame = '';
  renderGames();
  renderMatchPanel();
  persistState();
}

function renderGames() {
  if (!dom.games || !dom.gamesList) return;
  dom.games.innerHTML = '';
  dom.gamesList.innerHTML = '';
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = '— оберіть матч —';
  dom.games.appendChild(defaultOpt);

  const teams = getActiveTeams();
  const teamNames = Object.fromEntries(teams.map(t => [t.key, t.teamName || t.teamId]));

  tournamentState.games.forEach((game, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx);
    const label = `${teamNames[game.teamA] || game.teamA} vs ${teamNames[game.teamB] || game.teamB} — ${game.mode}`;
    opt.textContent = label;
    dom.games.appendChild(opt);

    const row = document.createElement('div');
    row.className = 'game-row';
    row.dataset.index = idx;
    const statusText = game.isDraw
      ? 'Нічия'
      : (game.winnerTeamId ? `Переможець: ${teamNames[game.winnerTeamId] || game.winnerTeamId}` : 'Не зіграно');
    row.innerHTML = `<div class="game-row__label">${label}</div><div class="game-row__meta">${statusText}</div>`;
    row.addEventListener('click', () => {
      dom.games.value = String(idx);
      handleGameSelection({ target: { value: String(idx) } });
    });
    dom.gamesList.appendChild(row);
  });

  if (tournamentState.selectedGame !== '') {
    dom.games.value = String(tournamentState.selectedGame);
  }
}

function playersForGame(game) {
  if (!game) return [];
  const teamA = tournamentState.teams[game.teamA]?.players || [];
  const teamB = tournamentState.teams[game.teamB]?.players || [];
  return [...teamA, ...teamB]
    .map(nick => tournamentState.playerMap.get(nick))
    .filter(Boolean);
}

function renderMatchPanel() {
  if (!dom.match) return;
  dom.match.innerHTML = '';
  const game = tournamentState.games[Number(tournamentState.selectedGame)];
  if (!game) return;
  const teams = getActiveTeams();
  const teamNames = Object.fromEntries(teams.map(t => [t.key, t.teamName || t.teamId]));

  const createTeamBlock = (teamKey) => {
    const block = document.createElement('div');
    block.className = 'team-card';
    const title = document.createElement('h4');
    title.textContent = teamNames[teamKey] || teamKey;
    const ul = document.createElement('ul');
    ul.className = 'team-list';
    const team = tournamentState.teams[teamKey] || { players: [] };
    team.players.forEach(nick => {
      const player = tournamentState.playerMap.get(nick);
      const li = document.createElement('li');
      li.innerHTML = `<span class="avatar-cell"><img class="avatar" src="${player?.avatar || AVATAR_PLACEHOLDER}" alt="${nick}"><strong>${nick}</strong></span><span>${Number(player?.pts || 0).toFixed(0)}</span>`;
      addRankClass(li, player?.rank);
      ul.appendChild(li);
    });
    block.append(title, ul);
    return block;
  };

  const meta = document.createElement('div');
  meta.className = 'metrics';
  meta.innerHTML = `<span class="tag">Режим: ${game.mode}</span><span class="tag">Раунд ${game.round || 1}</span>`;
  dom.match.append(createTeamBlock(game.teamA), createTeamBlock(game.teamB), meta);

  populateResultSelectors(game);
  applyGameStatus();
}

function populateResultSelectors(game) {
  const contenders = playersForGame(game);
  const targets = [dom.result.mvp, dom.result.second, dom.result.third];
  targets.forEach(sel => {
    if (!sel) return;
    sel.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '—';
    sel.appendChild(empty);
    contenders.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.nick;
      opt.textContent = `${p.nick} (${p.rank || '—'})`;
      sel.appendChild(opt);
    });
  });

  if (dom.result.resultA) dom.result.resultA.dataset.teamId = game.teamA;
  if (dom.result.resultB) dom.result.resultB.dataset.teamId = game.teamB;

  dom.result.resultA.checked = game.winnerTeamId === game.teamA;
  dom.result.resultB.checked = game.winnerTeamId === game.teamB;
  dom.result.resultDraw.checked = !!game.isDraw;

  dom.result.mvp.value = game.mvpNick || '';
  dom.result.second.value = game.secondNick || '';
  dom.result.third.value = game.thirdNick || '';
}

function applyGameStatus() {
  const game = tournamentState.games[Number(tournamentState.selectedGame)];
  if (!game || !dom.result.status) return;
  const teams = getActiveTeams();
  const teamNames = Object.fromEntries(teams.map(t => [t.key, t.teamName || t.teamId]));
  if (game.isDraw) {
    dom.result.status.textContent = 'Результат: нічия';
  } else if (game.winnerTeamId) {
    dom.result.status.textContent = `Переможець: ${teamNames[game.winnerTeamId] || game.winnerTeamId}`;
  } else {
    dom.result.status.textContent = 'Результат ще не збережено';
  }
}

function handleGameSelection(e) {
  tournamentState.selectedGame = e?.target?.value ?? '';
  renderMatchPanel();
}

function handleSaveGame() {
  const idx = Number(tournamentState.selectedGame);
  const game = tournamentState.games[idx];
  if (!game) return;
  const winnerA = dom.result.resultA?.checked;
  const winnerB = dom.result.resultB?.checked;
  const draw = dom.result.resultDraw?.checked;

  game.isDraw = !!draw;
  game.winnerTeamId = draw ? '' : winnerA ? game.teamA : winnerB ? game.teamB : '';
  game.mvpNick = dom.result.mvp?.value || '';
  game.secondNick = dom.result.second?.value || '';
  game.thirdNick = dom.result.third?.value || '';

  applyGameStatus();
  renderGames();
  persistState();
  showToast?.('Результат матчу збережено', 'success');
}

function handleReloadState() {
  const saved = restoreState();
  applySavedState(saved);
  tournamentState.selectedGame = '';
  renderLobby();
  renderPool();
  renderTeams();
  renderGames();
  renderMatchPanel();
}

function handleReloadLobby() {
  loadLeague();
}

function clearTeamsButton() {
  resetTeams();
}

function setSort(key) {
  if (tournamentState.sort.key === key) {
    tournamentState.sort.dir = tournamentState.sort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    tournamentState.sort = { key, dir: 'asc' };
  }
  renderLobby();
  persistState();
}

function initSortButtons() {
  dom.sortButtons.forEach(btn => btn.addEventListener('click', () => setSort(btn.dataset.sort)));
}

function attachEvents() {
  dom.load?.addEventListener('click', loadLeague);
  dom.league?.addEventListener('change', loadLeague);
  dom.reloadLobby?.addEventListener('click', handleReloadLobby);
  dom.reloadState?.addEventListener('click', handleReloadState);
  dom.search?.addEventListener('input', renderLobby);
  dom.addPool?.addEventListener('click', addToPool);
  dom.clear?.addEventListener('click', clearSelection);
  dom.teamSelect?.addEventListener('change', () => { ensureTeams(); renderTeams(); persistState(); });
  dom.auto?.addEventListener('click', applyAutoBalance);
  dom.saveTeams?.addEventListener('click', () => { persistState(); showToast?.('Команди збережено', 'success'); });
  dom.clearTeams?.addEventListener('click', clearTeamsButton);
  dom.generate?.addEventListener('click', generateGames);
  dom.games?.addEventListener('change', handleGameSelection);
  dom.result.save?.addEventListener('click', handleSaveGame);
  dom.result.refresh?.addEventListener('click', handleReloadState);
  initSortButtons();
}

function initModeListener() {
  document.addEventListener('mode:change', (e) => {
    const mode = e.detail?.mode || 'regular';
    setModeActive(mode === 'tournament');
  });
}

function init() {
  if (!cacheDom()) return;
  initModeListener();
  attachEvents();
  const saved = restoreState();
  if (saved?.league) dom.league.value = saved.league;
  loadLeague();
}

document.addEventListener('DOMContentLoaded', init);
