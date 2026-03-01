import { state, getParticipants, computeSeriesSummary, isSelected, getTeamLabel } from './state.js';
import { movePlayerToTeam } from './manual.js';

const TEAM_KEYS = ['team1', 'team2', 'team3', 'team4'];

function sumByNicks(nicks) {
  const map = new Map(state.players.map((p) => [p.nick, p]));
  return nicks.reduce((acc, n) => acc + (Number(map.get(n)?.points ?? map.get(n)?.pts) || 0), 0);
}

function sortPlayers(players) {
  const copy = [...players];
  switch (state.sortMode) {
    case 'name_desc':
      copy.sort((a, b) => b.nick.localeCompare(a.nick, 'uk'));
      break;
    case 'points_desc':
      copy.sort((a, b) => ((Number(b.points ?? b.pts) || 0) - (Number(a.points ?? a.pts) || 0)) || a.nick.localeCompare(b.nick, 'uk'));
      break;
    case 'points_asc':
      copy.sort((a, b) => ((Number(a.points ?? a.pts) || 0) - (Number(b.points ?? b.pts) || 0)) || a.nick.localeCompare(b.nick, 'uk'));
      break;
    default:
      copy.sort((a, b) => a.nick.localeCompare(b.nick, 'uk'));
  }
  return copy;
}

export function render() {
  renderTeamCountControl();
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

function renderTeamCountControl() {
  document.querySelectorAll('[data-team-count]').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.teamCount) === state.teamCount);
  });
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
  count.textContent = `Гравців: ${players.length}`;
  selectedCount.textContent = `Обрано: ${state.selected.length} / 15`;

  const frag = document.createDocumentFragment();
  for (const p of players) {
    const selected = isSelected(p.nick);
    const points = Number(p.points ?? p.pts) || 0;
    const rank = p.rank || '—';
    const row = document.createElement('div');
    row.className = `player-row ${selected ? 'selected' : ''}`;
    row.dataset.toggle = p.nick;
    row.innerHTML = `<span>${p.nick} <small class="tag">${points} (${rank})</small></span><span class="tag">${selected ? '✅ у лобі' : 'Додати'}</span>`;
    frag.appendChild(row);
  }
  list.replaceChildren(frag);
}

function renderLobby() {
  const wrap = document.getElementById('lobbyList');
  if (!wrap) return;
  const frag = document.createDocumentFragment();
  for (const nick of state.selected) {
    const player = state.players.find((p) => p.nick === nick);
    const points = Number(player?.points ?? player?.pts) || 0;
    const rank = player?.rank || '—';
    const row = document.createElement('div');
    row.className = 'lobby-row';
    row.innerHTML = `<span>${nick} <small class="tag">${points} (${rank})</small></span><button class="chip" data-remove="${nick}">Прибрати</button>`;
    frag.appendChild(row);
  }
  wrap.replaceChildren(frag);
}

function teamNameControl(key) {
  const name = getTeamLabel(key);
  return `<div class="team-name-wrap" data-team-name-wrap="${key}"><strong class="team-name-label">${name}</strong><button class="chip" type="button" data-rename-team="${key}">✏️ Перейменувати</button></div>`;
}

function renderTeams() {
  const grid = document.getElementById('teamsGrid');
  if (!grid) return;
  const keys = TEAM_KEYS.slice(0, state.teamCount);
  const frag = document.createDocumentFragment();
  const sums = [];

  for (const key of keys) {
    const nicks = state.teams[key];
    const total = sumByNicks(nicks);
    sums.push(total);
    const card = document.createElement('div');
    card.className = 'team-card';
    const players = nicks.map((nick) => `<div class="team-player"><span>${nick}</span><div class="team-actions"><button class="chip" data-move="${nick}:bench">Лавка</button></div></div>`).join('');
    card.innerHTML = `<h4>${teamNameControl(key)} <span class="tag">Σ ${total}</span></h4>${players || '<div class="tag">порожньо</div>'}`;
    frag.appendChild(card);
  }

  if (sums.length > 1) {
    const delta = Math.max(...sums) - Math.min(...sums);
    const info = document.createElement('div');
    info.className = 'tag';
    info.textContent = `Баланс Δ(макс-мін): ${delta}`;
    frag.appendChild(info);
  }

  if (state.mode === 'manual') {
    const bench = state.selected.filter((nick) => !keys.some((k) => state.teams[k].includes(nick)));
    const benchCard = document.createElement('div');
    benchCard.className = 'team-card';
    benchCard.innerHTML = `<h4>Лавка</h4>${bench.map((nick) => `<div class="team-player"><span>${nick}</span><div class="team-actions">${keys.map((k) => `<button class="chip" data-move="${nick}:${k}">→ ${getTeamLabel(k)}</button>`).join('')}</div></div>`).join('') || '<div class="tag">порожньо</div>'}`;
    frag.appendChild(benchCard);
  }

  grid.replaceChildren(frag);
}

function renderMatchTeams() {
  const root = document.getElementById('matchTeamsPreview');
  if (!root) return;
  const keys = TEAM_KEYS.slice(0, state.teamCount);
  const hasTeams = keys.some((k) => state.teams[k].length > 0);
  if (!hasTeams) {
    root.innerHTML = '<div class="tag">Спочатку збалансуй або розклади команди</div>';
    return;
  }
  root.innerHTML = keys.map((key) => {
    const nicks = state.teams[key];
    const list = nicks.length ? nicks.map((nick) => `<li>${nick}</li>`).join('') : '<li class="tag">порожньо</li>';
    return `<div class="team-card"><h4>${getTeamLabel(key)} <span class="tag">Σ ${sumByNicks(nicks)}</span></h4><ul class="team-list-preview">${list}</ul></div>`;
  }).join('');
}

function renderSeriesEditor() {
  const root = document.getElementById('seriesRounds');
  const countRoot = document.getElementById('seriesCountOptions');
  if (!root) return;
  const hasRoundValues = Array.isArray(state.seriesRounds) && state.seriesRounds.some((value) => value !== null && value !== undefined);
  const rounds = hasRoundValues
    ? state.seriesRounds.slice(0, 7)
    : (Array.isArray(state.series) ? state.series.slice(0, 7).map((value) => {
      const numeric = Number(value);
      return value === '-' || Number.isNaN(numeric) ? null : numeric;
    }) : Array(7).fill(null));
  const count = Math.min(7, Math.max(3, Number(state.seriesCount) || 3));
  const teamOptions = TEAM_KEYS.slice(0, state.teamCount).map((_, idx) => ({ val: idx + 1, label: `К${idx + 1}` }));

  if (countRoot) {
    countRoot.querySelectorAll('[data-series-count]').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.seriesCount) === count);
    });
  }

  root.innerHTML = rounds.slice(0, count).map((round, idx) => {
    const options = [...teamOptions, { val: 0, label: 'Нічия' }];
    const row = options.map((option) => `<button class="chip round-btn" type="button" data-round="${idx}" data-value="${option.val}">${option.label}</button>`).join('');
    const chip = round === null ? '—' : (round === 0 ? 'Ніч.' : `К${round}`);
    return `<div class="round-card"><div class="series-row"><span>Бій ${idx + 1} <small class="round-chip">${chip}</small></span><div class="round-row">${row}</div></div></div>`;
  }).join('');

  root.querySelectorAll('.round-btn').forEach((btn) => {
    const roundIndex = Number(btn.dataset.round);
    const currentValue = Number(state.seriesRounds[roundIndex]);
    const buttonValue = Number(btn.dataset.value);
    btn.classList.toggle('active', buttonValue === currentValue);
  });
}

function renderMatchSummary() {
  const root = document.getElementById('matchSummary');
  if (!root) return;
  const summary = computeSeriesSummary();
  const keys = TEAM_KEYS.slice(0, state.teamCount);
  const winsText = keys.map((key, idx) => `К${idx + 1}: <strong>${summary.wins[key]}</strong>`).join(' ');
  const winnerLabel = summary.winner === 'tie' ? 'Нічия' : `Команда ${summary.winner.replace('team', '')}`;
  root.innerHTML = [
    `<div class="summary-pill">Рахунок серії: ${winsText} Ніч.: <strong>${summary.draws}</strong></div>`,
    `<div class="summary-pill">Зіграно: <strong>${summary.played}</strong> / <strong>${state.seriesCount}</strong></div>`,
    `<div class="summary-pill">Переможець: <strong>${winnerLabel}</strong></div>`,
    `<div class="summary-pill">Серія: <strong>${summary.series || '—'}</strong></div>`,
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
  const roundsContainer = document.getElementById('seriesRounds');
  if (roundsContainer) {
    roundsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.round-btn');
      if (!btn || !roundsContainer.contains(btn)) return;
      const roundIndex = Number(btn.dataset.round);
      const value = Number(btn.dataset.value);
      if (!Number.isInteger(roundIndex) || !Number.isFinite(value)) return;
      handlers.onSeriesResult(roundIndex, value);
    });
  }

  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-toggle]')?.dataset.toggle;
    const remove = e.target.closest('[data-remove]')?.dataset.remove;
    const move = e.target.closest('[data-move]')?.dataset.move;
    const seriesCount = e.target.closest('[data-series-count]')?.dataset.seriesCount;
    const teamCount = e.target.closest('[data-team-count]')?.dataset.teamCount;
    const clearSeries = e.target.closest('[data-series-reset]');
    const pen = e.target.closest('[data-pen]')?.dataset.pen;
    const renameTeam = e.target.closest('[data-rename-team]')?.dataset.renameTeam;
    if (toggle) handlers.onTogglePlayer(toggle);
    if (remove) handlers.onRemove(remove);
    if (move) {
      const [nick, team] = move.split(':');
      movePlayerToTeam(nick, team === 'bench' ? '' : team);
      handlers.onChanged();
    }
    if (teamCount) handlers.onTeamCount(Number(teamCount));
    if (seriesCount) handlers.onSeriesCount(Number(seriesCount));
    if (clearSeries) handlers.onSeriesReset();
    if (pen) {
      const [nick, delta] = pen.split(':');
      handlers.onPenalty(nick, Number(delta));
    }
    if (renameTeam) handlers.onRenameStart(renameTeam);
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
