import { state, getParticipants, computeSeriesSummary, isSelected, getTeamLabel } from './state.js';
import { movePlayerToTeam } from './manual.js';

function sumByNicks(nicks) {
  const map = new Map(state.players.map((p) => [p.nick, p]));
  return nicks.reduce((acc, n) => acc + (map.get(n)?.pts || 0), 0);
}

function sortPlayers(players) {
  const copy = [...players];
  switch (state.sortMode) {
    case 'name_desc':
      copy.sort((a, b) => b.nick.localeCompare(a.nick, 'uk'));
      break;
    case 'points_desc':
      copy.sort((a, b) => (b.pts - a.pts) || a.nick.localeCompare(b.nick, 'uk'));
      break;
    case 'points_asc':
      copy.sort((a, b) => (a.pts - b.pts) || a.nick.localeCompare(b.nick, 'uk'));
      break;
    default:
      copy.sort((a, b) => a.nick.localeCompare(b.nick, 'uk'));
  }
  return copy;
}

export function render() {
  renderPlayers();
  renderLobby();
  renderTeams();
  renderMatchTeams();
  renderSeriesEditor();
  renderMatchSummary();
  renderPenalties();
  renderMatchDatalist();
  renderMatchFields();
}

export function setActiveTab(tab) {
  document.getElementById('teamsCard').style.display = tab === 'teams' ? '' : 'none';
  document.getElementById('matchCard').style.display = tab === 'match' ? '' : 'none';
}

function renderPlayers() {
  const list = document.getElementById('playerList');
  const count = document.getElementById('playersCount');
  const selectedCount = document.getElementById('selectedCount');
  const sortSelect = document.getElementById('sortMode');
  if (!list || !count || !selectedCount) return;
  if (sortSelect && sortSelect.value !== state.sortMode) sortSelect.value = state.sortMode;

  const q = state.query.toLowerCase().trim();
  const filtered = q ? state.players.filter((p) => p.nick.toLowerCase().includes(q)) : state.players;
  const players = sortPlayers(filtered);
  count.textContent = `Players: ${players.length}`;
  selectedCount.textContent = `Обрано: ${state.selected.length} / 15`;

  const frag = document.createDocumentFragment();
  for (const p of players) {
    const selected = isSelected(p.nick);
    const row = document.createElement('div');
    row.className = `player-row ${selected ? 'selected' : ''}`;
    row.dataset.toggle = p.nick;
    row.innerHTML = `<span>${p.nick} <small class="tag">${p.pts}</small></span><span class="tag">${selected ? '✅ у лобі' : 'Додати'}</span>`;
    frag.appendChild(row);
  }
  list.replaceChildren(frag);
}

function renderLobby() {
  const wrap = document.getElementById('lobbyList');
  if (!wrap) return;
  const frag = document.createDocumentFragment();
  for (const nick of state.selected) {
    const row = document.createElement('div');
    row.className = 'lobby-row';
    row.innerHTML = `<span>${nick}</span><button class="chip" data-remove="${nick}">Remove</button>`;
    frag.appendChild(row);
  }
  wrap.replaceChildren(frag);
}

function teamNameControl(key) {
  const name = getTeamLabel(key);
  return `<div class="team-name-wrap" data-team-name-wrap="${key}"><strong class="team-name-label">${name}</strong><button class="chip" type="button" data-rename-team="${key}">✏️ Rename</button></div>`;
}

function renderTeams() {
  const grid = document.getElementById('teamsGrid');
  if (!grid) return;
  const keys = ['team1', 'team2', 'team3'].slice(0, state.teamsCount);
  const frag = document.createDocumentFragment();
  for (const key of keys) {
    const nicks = state.teams[key];
    const card = document.createElement('div');
    card.className = 'team-card';
    const players = nicks.map((nick) => `<div class="team-player"><span>${nick}</span><div class="team-actions"><button class="chip" data-move="${nick}:bench">Bench</button></div></div>`).join('');
    card.innerHTML = `<h4>${teamNameControl(key)} <span class="tag">Σ ${sumByNicks(nicks)}</span></h4>${players || '<div class="tag">empty</div>'}`;
    frag.appendChild(card);
  }

  if (state.mode === 'manual') {
    const bench = state.selected.filter((nick) => !keys.some((k) => state.teams[k].includes(nick)));
    const benchCard = document.createElement('div');
    benchCard.className = 'team-card';
    benchCard.innerHTML = `<h4>Bench</h4>${bench.map((nick) => `<div class="team-player"><span>${nick}</span><div class="team-actions">${keys.map((k) => `<button class="chip" data-move="${nick}:${k}">${getTeamLabel(k)}</button>`).join('')}</div></div>`).join('') || '<div class="tag">empty</div>'}`;
    frag.appendChild(benchCard);
  }

  grid.replaceChildren(frag);
}

function renderMatchTeams() {
  const root = document.getElementById('matchTeamsPreview');
  if (!root) return;
  const keys = ['team1', 'team2', 'team3'].slice(0, state.teamsCount);
  const hasTeams = state.teams.team1.length > 0 || state.teams.team2.length > 0 || state.teams.team3.length > 0;
  if (!hasTeams) {
    root.innerHTML = '<div class="tag">Спочатку збалансуй/розклади команди</div><button class="chip" type="button" data-back-tab="teams">Назад</button>';
    return;
  }
  root.innerHTML = keys.map((key) => {
    const nicks = state.teams[key];
    const list = nicks.length ? nicks.map((nick) => `<li>${nick}</li>`).join('') : '<li class="tag">empty</li>';
    return `<div class="team-card"><h4>${getTeamLabel(key)} <span class="tag">Σ ${sumByNicks(nicks)}</span></h4><ul class="team-list-preview">${list}</ul></div>`;
  }).join('');
}

function renderSeriesEditor() {
  const root = document.getElementById('seriesOptions');
  const countRoot = document.getElementById('seriesCountOptions');
  if (!root) return;
  const rounds = Array.isArray(state.series) ? state.series.slice(0, 7) : ['-', '-', '-', '-', '-', '-', '-'];
  const count = Math.min(7, Math.max(3, Number(state.seriesCount) || 3));

  if (countRoot) {
    countRoot.querySelectorAll('[data-series-count]').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.seriesCount) === count);
    });
  }

  root.innerHTML = rounds.slice(0, count).map((round, idx) => {
    const options = [
      { val: '1', label: 'T1' },
      { val: '0', label: 'Нічия' },
      { val: '2', label: 'T2' },
    ];
    const row = options.map((option) => `<button class="chip ${round === option.val ? 'active' : ''}" data-series="${idx}:${option.val}">${option.label}</button>`).join('');
    return `<div class="series-row"><span>Бій ${idx + 1}</span><div class="series-choices">${row}</div></div>`;
  }).join('');
}

function renderMatchSummary() {
  const root = document.getElementById('matchSummary');
  if (!root) return;
  const summary = computeSeriesSummary();
  const winnerLabel = summary.winner === 'team1' ? getTeamLabel('team1') : summary.winner === 'team2' ? getTeamLabel('team2') : 'Нічия';
  root.innerHTML = [
    `<div class="summary-pill">T1: <strong>${summary.wins1}</strong> T2: <strong>${summary.wins2}</strong> Нічиї: <strong>${summary.draws}</strong></div>`,
    `<div class="summary-pill">Зіграно: <strong>${summary.played}</strong> / <strong>${state.seriesCount}</strong></div>`,
    `<div class="summary-pill">Підсумок: <strong>${winnerLabel}</strong></div>`,
    `<div class="summary-pill">series: <strong>${summary.series || '—'}</strong></div>`
  ].join('');
}

function renderPenalties() {
  const root = document.getElementById('penaltiesList');
  if (!root) return;
  const participants = getParticipants();
  root.innerHTML = participants.map((nick) => {
    const val = Number(state.match.penalties[nick] || 0);
    return `<div class="penalty-row"><span>${nick}</span><div class="penalty-controls"><button class="chip" data-pen="${nick}:-1">-</button><strong>${val}</strong><button class="chip" data-pen="${nick}:1">+</button></div></div>`;
  }).join('');
}

function renderMatchDatalist() {
  const dl = document.getElementById('participantsDatalist');
  if (!dl) return;
  const participants = [...new Set(getParticipants())];
  dl.innerHTML = participants.map((nick) => `<option value="${nick}"></option>`).join('');
}

function renderMatchFields() {
  ['mvp1', 'mvp2', 'mvp3'].forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    const value = state.match[id] || '';
    if (input.value !== value) input.value = value;
  });
}

export function bindUiEvents(handlers) {
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-toggle]')?.dataset.toggle;
    const remove = e.target.closest('[data-remove]')?.dataset.remove;
    const move = e.target.closest('[data-move]')?.dataset.move;
    const series = e.target.closest('[data-series]')?.dataset.series;
    const seriesCount = e.target.closest('[data-series-count]')?.dataset.seriesCount;
    const clearSeries = e.target.closest('[data-series-reset]');
    const pen = e.target.closest('[data-pen]')?.dataset.pen;
    const renameTeam = e.target.closest('[data-rename-team]')?.dataset.renameTeam;
    const backTab = e.target.closest('[data-back-tab]')?.dataset.backTab;
    if (toggle) handlers.onTogglePlayer(toggle);
    if (remove) handlers.onRemove(remove);
    if (move) {
      const [nick, team] = move.split(':');
      movePlayerToTeam(nick, team === 'bench' ? '' : team);
      handlers.onChanged();
    }
    if (series) {
      const [idx, val] = series.split(':');
      handlers.onSeriesResult(Number(idx), val);
    }
    if (seriesCount) handlers.onSeriesCount(Number(seriesCount));
    if (clearSeries) handlers.onSeriesReset();
    if (pen) {
      const [nick, delta] = pen.split(':');
      handlers.onPenalty(nick, Number(delta));
    }
    if (renameTeam) handlers.onRenameStart(renameTeam);
    if (backTab) handlers.onBackTab(backTab);
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input[data-team-name-input]') && e.key === 'Enter') {
      handlers.onRenameSave(e.target.dataset.teamNameInput, e.target.value);
    }
  });

  document.addEventListener('focusout', (e) => {
    if (e.target.matches('input[data-team-name-input]')) {
      handlers.onRenameSave(e.target.dataset.teamNameInput, e.target.value);
    }
  });
}
