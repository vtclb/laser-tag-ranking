// Tournament mode controller
import { fetchLeagueCsv, parsePlayersFromCsv } from './api.js';
import { autoBalance2 as autoBalanceTwo, autoBalanceN as autoBalanceMany } from './balanceUtils.js';
import { AVATAR_PLACEHOLDER } from './avatarConfig.js';

const TOURNAMENT_GAME_MODES = ['DM', 'KT', 'TR'];
const MAX_TEAMS = 5;
const MIN_TEAMS = 2;

const tournamentState = {
  league: 'kids',
  players: [],
  lobby: new Map(),
  pool: new Map(),
  teams: {},
  games: [],
};

const dom = {};

function cacheDom() {
  dom.panel = document.getElementById('tournament-panel');
  if (!dom.panel) return false;
  dom.league = document.getElementById('tournament-league');
  dom.load = document.getElementById('tournament-load');
  dom.search = document.getElementById('tournament-search');
  dom.tableBody = document.querySelector('#tournament-table tbody');
  dom.addPool = document.getElementById('tournament-add-pool');
  dom.clear = document.getElementById('tournament-clear');
  dom.pool = document.getElementById('tournament-pool');
  dom.teamSelect = document.getElementById('tournament-teams');
  dom.auto = document.getElementById('tournament-auto');
  dom.teamsWrap = document.getElementById('tournament-teams-wrap');
  dom.modeChecks = Array.from(document.querySelectorAll('.mode-check'));
  dom.generate = document.getElementById('tournament-generate');
  dom.games = document.getElementById('tournament-games');
  dom.match = document.getElementById('tournament-match');
  return true;
}

function setModeActive(isActive) {
  if (!dom.panel) return;
  dom.panel.classList.toggle('active', isActive);
  if (isActive) {
    renderLobby();
    renderPool();
    renderTeams();
  }
}

function parseLeague(value) {
  return value === 'olds' ? 'olds' : 'kids';
}

async function loadLeague() {
  const league = parseLeague(dom.league?.value);
  tournamentState.league = league;
  const csv = await fetchLeagueCsv(league);
  tournamentState.players = parsePlayersFromCsv(csv);
  renderLobby();
}

function filteredPlayers() {
  const term = (dom.search?.value || '').trim().toLowerCase();
  if (!term) return [...tournamentState.players];
  return tournamentState.players.filter(p => p.nick.toLowerCase().includes(term));
}

function renderLobby() {
  if (!dom.tableBody) return;
  dom.tableBody.innerHTML = '';
  filteredPlayers().forEach(player => {
    const tr = document.createElement('tr');
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
}

function clearSelection() {
  tournamentState.pool.clear();
  tournamentState.teams = {};
  tournamentState.games = [];
  renderPool();
  renderTeams();
  renderGames();
}

function renderPool() {
  if (!dom.pool) return;
  dom.pool.innerHTML = '';
  tournamentState.pool.forEach(p => {
    const chip = document.createElement('span');
    chip.className = 'tag';
    chip.textContent = `${p.nick} · ${Number(p.pts || 0).toFixed(0)}`;
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

function renderTeams() {
  if (!dom.teamsWrap) return;
  dom.teamsWrap.innerHTML = '';
  const teamsCount = Math.min(Math.max(parseInt(dom.teamSelect?.value || '3', 10), MIN_TEAMS), MAX_TEAMS);
  const players = Array.from(tournamentState.pool.values());
  const teams = players.length ? computeBalance(players, teamsCount) : {};
  tournamentState.teams = teams;

  for (let i = 1; i <= teamsCount; i++) {
    const list = teams[i] || [];
    const card = document.createElement('div');
    card.className = 'team-card';
    const title = document.createElement('h4');
    title.textContent = `Команда ${i}`;
    const ul = document.createElement('ul');
    ul.className = 'team-list';
    const teamTotal = list.reduce((s, p) => s + (Number(p.pts) || 0), 0);
    list.forEach(p => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${p.nick}</span><span>${Number(p.pts || 0).toFixed(0)}</span>`;
      ul.appendChild(li);
    });
    const avg = list.length ? (teamTotal / list.length).toFixed(1) : '0.0';
    const meta = document.createElement('div');
    meta.className = 'metrics';
    meta.innerHTML = `<span class="tag">Σ ${teamTotal.toFixed(0)}</span><span class="tag">Avg ${avg}</span><span class="tag">${list.length} грав.</span>`;
    card.append(title, ul, meta);
    dom.teamsWrap.appendChild(card);
  }
}

function collectModes() {
  return dom.modeChecks
    .filter(inp => inp.checked)
    .map(inp => inp.value)
    .filter(mode => TOURNAMENT_GAME_MODES.includes(mode));
}

function generateRoundRobinGames(teamIds, modes) {
  const games = [];
  let modeIndex = 0;
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const mode = modes[modeIndex % modes.length];
      games.push({ teamA: teamIds[i], teamB: teamIds[j], mode });
      modeIndex += 1;
    }
  }
  return games;
}

function generateGames() {
  const modes = collectModes();
  if (!modes.length) {
    showToast?.('Оберіть хоча б один режим', 'warn');
    return;
  }
  const teamIds = Object.keys(tournamentState.teams);
  if (teamIds.length < MIN_TEAMS) {
    showToast?.('Додайте щонайменше дві команди', 'warn');
    return;
  }

  const ordered = teamIds.sort();
  const games = [];

  if (ordered.length === 2) {
    // BO3 cycling through modes
    for (let i = 0; i < 3; i++) {
      games.push({ teamA: ordered[0], teamB: ordered[1], mode: modes[i % modes.length], round: i + 1 });
    }
  } else {
    const rr = generateRoundRobinGames(ordered, modes);
    rr.forEach((g, index) => games.push({ ...g, round: index + 1 }));
  }

  tournamentState.games = games;
  renderGames();
}

function renderGames() {
  if (!dom.games || !dom.match) return;
  dom.games.innerHTML = '';
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = '— оберіть матч —';
  dom.games.appendChild(defaultOpt);

  tournamentState.games.forEach((game, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = `${game.teamA} vs ${game.teamB} — ${game.mode} (Раунд ${game.round})`;
    dom.games.appendChild(opt);
  });

  dom.match.innerHTML = '';
}

function renderMatchDetails(index) {
  if (!dom.match) return;
  dom.match.innerHTML = '';
  const game = tournamentState.games[Number(index)];
  if (!game) return;

  const createTeamBlock = (teamId) => {
    const block = document.createElement('div');
    block.className = 'team-card';
    const title = document.createElement('h4');
    title.textContent = teamId;
    const ul = document.createElement('ul');
    ul.className = 'team-list';
    const team = tournamentState.teams[teamId] || [];
    const total = team.reduce((s, p) => s + (Number(p.pts) || 0), 0);
    team.forEach(p => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${p.nick}</span><span>${Number(p.pts || 0).toFixed(0)}</span>`;
      ul.appendChild(li);
    });
    const avg = team.length ? (total / team.length).toFixed(1) : '0.0';
    const meta = document.createElement('div');
    meta.className = 'metrics';
    meta.innerHTML = `<span class="tag">Σ ${total.toFixed(0)}</span><span class="tag">Avg ${avg}</span><span class="tag">${team.length} грав.</span>`;
    block.append(title, ul, meta);
    return block;
  };

  const meta = document.createElement('div');
  meta.className = 'metrics';
  meta.innerHTML = `<span class="tag">Режим: ${game.mode}</span><span class="tag">Раунд ${game.round}</span>`;
  dom.match.append(createTeamBlock(game.teamA), createTeamBlock(game.teamB), meta);
}

function attachEvents() {
  dom.load?.addEventListener('click', loadLeague);
  dom.league?.addEventListener('change', loadLeague);
  dom.search?.addEventListener('input', renderLobby);
  dom.addPool?.addEventListener('click', addToPool);
  dom.clear?.addEventListener('click', clearSelection);
  dom.teamSelect?.addEventListener('change', renderTeams);
  dom.auto?.addEventListener('click', renderTeams);
  dom.generate?.addEventListener('click', generateGames);
  dom.games?.addEventListener('change', e => renderMatchDetails(e.target.value));
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
  loadLeague();
}

document.addEventListener('DOMContentLoaded', init);
