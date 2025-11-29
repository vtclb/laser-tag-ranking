// Regular mode controller
import { fetchLeagueCsv, normalizeLeague, parsePlayersFromCsv, safeSet } from './api.js';
import { autoBalance2 as autoBalanceTwo, autoBalanceN as autoBalanceMany } from './balanceUtils.js';
import { AVATAR_PLACEHOLDER } from './avatarConfig.js';

const regularState = {
  players: [],
  lobby: new Map(),
  league: 'kids',
  teamsCount: 2,
  teams: {},
};

const dom = {};

function cacheDom() {
  dom.panel = document.getElementById('regular-panel');
  if (!dom.panel) return false;
  dom.league = document.getElementById('regular-league');
  dom.load = document.getElementById('regular-load');
  dom.search = document.getElementById('regular-search');
  dom.tableBody = document.querySelector('#regular-table tbody');
  dom.add = document.getElementById('regular-add');
  dom.clear = document.getElementById('regular-clear');
  dom.teamSelect = document.getElementById('regular-teams');
  dom.auto = document.getElementById('regular-auto');
  dom.teamsWrap = document.getElementById('regular-teams-wrap');
  dom.summary = document.getElementById('regular-summary');
  dom.avatarBtn = document.getElementById('open-avatar');
  return true;
}

function setModeActive(isActive) {
  if (!dom.panel) return;
  dom.panel.classList.toggle('active', isActive);
  if (isActive) {
    renderPlayers();
    renderTeams();
  }
}

  function parseLeague(value) {
    return normalizeLeague(value);
  }

  async function loadLeague() {
    const league = parseLeague(dom.league?.value);
    regularState.league = league;
    try {
      const csv = await fetchLeagueCsv(league);
      regularState.players = parsePlayersFromCsv(csv);
      safeSet(localStorage, 'regular-league', league);
      renderPlayers();
    } catch (err) {
      console.error('League load failed', err);
      showToast?.('Не вдалося завантажити лігу', 'error');
    }
  }

function filteredPlayers() {
  const term = (dom.search?.value || '').trim().toLowerCase();
  if (!term) return [...regularState.players];
  return regularState.players.filter(p => p.nick.toLowerCase().includes(term));
}

function renderPlayers() {
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
  const set = new Set();
  boxes.forEach(cb => set.add(cb.dataset.nick));
  return regularState.players.filter(p => set.has(p.nick));
}

function addToLobby() {
  const selected = selectedFromTable();
  selected.forEach(p => regularState.lobby.set(p.nick, p));
  renderTeams();
}

function clearLobby() {
  regularState.lobby.clear();
  regularState.teams = {};
  renderTeams();
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
  const teamsCount = parseInt(dom.teamSelect?.value || '2', 10);
  regularState.teamsCount = teamsCount;
  const players = Array.from(regularState.lobby.values());
  const teams = players.length ? computeBalance(players, teamsCount) : {};
  regularState.teams = teams;

  let totalPts = 0;
  let totalCount = 0;

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
    const meta = document.createElement('div');
    const avg = list.length ? (teamTotal / list.length).toFixed(1) : '0.0';
    meta.className = 'metrics';
    meta.innerHTML = `<span class="tag">Σ ${teamTotal.toFixed(0)}</span><span class="tag">Avg ${avg}</span><span class="tag">${list.length} грав.</span>`;
    card.append(title, ul, meta);
    dom.teamsWrap.appendChild(card);
    totalPts += teamTotal;
    totalCount += list.length;
  }

  if (dom.summary) {
    const avg = totalCount ? (totalPts / totalCount).toFixed(1) : '0.0';
    dom.summary.innerHTML = `<span class="tag">Lobby: ${totalCount}</span><span class="tag">Σ ${totalPts.toFixed(0)}</span><span class="tag">Avg ${avg}</span>`;
  }
}

function attachEvents() {
  dom.load?.addEventListener('click', loadLeague);
  dom.league?.addEventListener('change', loadLeague);
  dom.search?.addEventListener('input', renderPlayers);
  dom.add?.addEventListener('click', addToLobby);
  dom.clear?.addEventListener('click', clearLobby);
  dom.teamSelect?.addEventListener('change', renderTeams);
  dom.auto?.addEventListener('click', renderTeams);
  dom.avatarBtn?.addEventListener('click', () => document.dispatchEvent(new CustomEvent('avatar:open')));
}

function initAvatarModal() {
  const modal = document.getElementById('avatar-modal');
  const openButtons = [dom.avatarBtn];
  const closeBtn = document.getElementById('close-avatar');
  function setOpen(open) {
    if (!modal) return;
    modal.classList.toggle('active', open);
    modal.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.style.overflow = open ? 'hidden' : '';
  }
  openButtons.forEach(btn => btn?.addEventListener('click', () => setOpen(true)));
  closeBtn?.addEventListener('click', () => setOpen(false));
  modal?.addEventListener('click', e => { if (e.target === modal) setOpen(false); });
  document.addEventListener('avatar:open', () => setOpen(true));
}

function initModeToggle() {
  const buttons = Array.from(document.querySelectorAll('#mode-switch [data-mode]'));
  function apply(mode) {
    document.body.dataset.appMode = mode;
    buttons.forEach(btn => btn.classList.toggle('btn-primary', btn.dataset.mode === mode));
    setModeActive(mode === 'regular');
    document.dispatchEvent(new CustomEvent('mode:change', { detail: { mode } }));
  }
  buttons.forEach(btn => btn.addEventListener('click', () => apply(btn.dataset.mode)));
  apply(document.body.dataset.appMode || 'regular');
}

function init() {
  if (!cacheDom()) return;
  initModeToggle();
  attachEvents();
  initAvatarModal();
  const savedLeague = localStorage ? localStorage.getItem('regular-league') : '';
  if (savedLeague) dom.league.value = savedLeague;
  loadLeague();
}

document.addEventListener('DOMContentLoaded', init);
