import { state, getParticipants, computeSeriesSummary, isSelected, getTeamLabel } from './state.js';
import { movePlayerToTeam } from './manual.js';

const TEAM_KEYS = ['team1', 'team2', 'team3', 'team4'];

function sortPlayers(players) {
  const copy = [...players];
  switch (state.app.sortMode) {
    case 'name_desc':
      copy.sort((a, b) => b.nick.localeCompare(a.nick, 'uk'));
      break;
    case 'points_asc':
      copy.sort((a, b) => ((Number(a.points ?? a.pts) || 0) - (Number(b.points ?? b.pts) || 0)) || a.nick.localeCompare(b.nick, 'uk'));
      break;
    case 'name_asc':
      copy.sort((a, b) => a.nick.localeCompare(b.nick, 'uk'));
      break;
    case 'points_desc':
    default:
      copy.sort((a, b) => ((Number(b.points ?? b.pts) || 0) - (Number(a.points ?? a.pts) || 0)) || a.nick.localeCompare(b.nick, 'uk'));
      break;
  }
  return copy;
}

function formatPlayer(playerOrNick) {
  if (!playerOrNick) return { nick: '—', points: 0, rank: '—' };
  if (typeof playerOrNick === 'string') return { nick: playerOrNick, points: 0, rank: '—' };
  return {
    nick: playerOrNick.nick,
    points: Number(playerOrNick.points ?? playerOrNick.pts) || 0,
    rank: playerOrNick.rank || '—',
  };
}

function playerMetaHtml(player) {
  const parsed = formatPlayer(player);
  return `<span class="player-meta"><strong>${parsed.nick}</strong> <small>${parsed.points} pts · ${parsed.rank}</small></span>`;
}

export function render() {
  renderLeagueControls();
  renderPlayers();
  renderLobby();
  renderTeams();
  renderMatchTeams();
  renderSeriesEditor();
  renderMatchSummary();
  renderPenalties();
  renderMatchFields();
}

export function renderLeagueControls() {
  const select = document.getElementById('leagueSelect');
  const sortSelect = document.getElementById('sortMode');
  if (select && select.value !== state.app.league) select.value = state.app.league;
  if (sortSelect && sortSelect.value !== state.app.sortMode) sortSelect.value = state.app.sortMode;

  document.querySelectorAll('[data-team-count]').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.teamCount) === state.teamsState.teamCount);
  });
}

export function renderPlayers() {
  const list = document.getElementById('playerList');
  const count = document.getElementById('playersCount');
  const selectedCount = document.getElementById('selectedCount');
  if (!list || !count || !selectedCount) return;

  const q = state.app.query.toLowerCase().trim();
  const filtered = q
    ? state.playersState.players.filter((p) => p.nick.toLowerCase().includes(q))
    : state.playersState.players;
  const players = sortPlayers(filtered);

  count.textContent = `Гравців: ${players.length}`;
  selectedCount.textContent = `Обрано: ${state.playersState.selected.length} / 15`;

  list.innerHTML = players.map((player) => {
    const selected = isSelected(player.nick);
    return `<div class="player-row ${selected ? 'selected' : ''}" data-toggle="${player.nick}">${playerMetaHtml(player)}<span class="tag">${selected ? '✅ у лобі' : 'Додати'}</span></div>`;
  }).join('');
}

export function renderLobby() {
  const wrap = document.getElementById('lobbyList');
  if (!wrap) return;
  const playersMap = new Map(state.playersState.players.map((p) => [p.nick, p]));
  wrap.innerHTML = state.playersState.selected.map((nick) => {
    const player = playersMap.get(nick) || { nick, points: 0, rank: '—' };
    return `<div class="lobby-row">${playerMetaHtml(player)}<button class="chip" data-remove="${nick}">Прибрати</button></div>`;
  }).join('');
}

function teamNameControl(key) {
  return `<div class="team-name-wrap" data-team-name-wrap="${key}"><strong class="team-name-label">${getTeamLabel(key)}</strong><button class="chip" type="button" data-rename-team="${key}">✏️ Назва</button></div>`;
}

function sumByNicks(nicks) {
  const map = new Map(state.playersState.players.map((p) => [p.nick, p]));
  return nicks.reduce((acc, nick) => acc + (Number(map.get(nick)?.points ?? map.get(nick)?.pts) || 0), 0);
}

export function renderTeams() {
  const grid = document.getElementById('teamsGrid');
  if (!grid) return;

  const keys = TEAM_KEYS.slice(0, state.teamsState.teamCount);
  const map = new Map(state.playersState.players.map((p) => [p.nick, p]));
  const cards = keys.map((key) => {
    const nicks = state.teamsState.teams[key];
    const total = sumByNicks(nicks);
    const members = nicks.map((nick) => {
      const player = map.get(nick) || { nick, points: 0, rank: '—' };
      return `<div class="team-player">${playerMetaHtml(player)}<button class="chip" data-move="${nick}:bench">Лавка</button></div>`;
    }).join('') || '<div class="tag">порожньо</div>';
    return `<div class="team-card"><h4>${teamNameControl(key)} <span class="tag">Σ ${total}</span></h4>${members}</div>`;
  });

  if (state.app.mode === 'manual') {
    const bench = state.playersState.selected.filter((nick) => !keys.some((key) => state.teamsState.teams[key].includes(nick)));
    cards.push(`<div class="team-card"><h4>Лавка</h4>${bench.map((nick) => `<div class="team-player"><span>${nick}</span><div class="team-actions">${keys.map((k) => `<button class="chip" data-move="${nick}:${k}">→ ${getTeamLabel(k)}</button>`).join('')}</div></div>`).join('') || '<div class="tag">порожньо</div>'}</div>`);
  }

  grid.innerHTML = cards.join('');
}

export function renderMatchTeams() {
  const root = document.getElementById('matchTeamsPreview');
  if (!root) return;
  const keys = TEAM_KEYS.slice(0, state.teamsState.teamCount);
  const hasTeams = keys.some((k) => state.teamsState.teams[k].length > 0);
  if (!hasTeams) {
    root.innerHTML = '<div class="tag">Спочатку сформуй команди.</div>';
    return;
  }

  root.innerHTML = keys.map((key, idx) => {
    const items = state.teamsState.teams[key].map((nick) => `<li>${nick}</li>`).join('');
    return `<div class="team-card"><h4>К${idx + 1} · ${getTeamLabel(key)}</h4><ul class="match-team-preview">${items || '<li>порожньо</li>'}</ul></div>`;
  }).join('');
}

export function renderSeriesEditor() {
  const root = document.getElementById('seriesRounds');
  const countRoot = document.getElementById('seriesCountOptions');
  if (!root) return;

  const count = Math.min(7, Math.max(3, Number(state.matchState.seriesCount) || 3));
  const rounds = state.matchState.seriesRounds.slice(0, 7);
  while (rounds.length < 7) rounds.push(null);
  const options = TEAM_KEYS.slice(0, state.teamsState.teamCount).map((_, idx) => ({ val: idx + 1, label: `К${idx + 1}` }));

  if (countRoot) {
    countRoot.querySelectorAll('[data-series-count]').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.seriesCount) === count);
    });
  }

  root.innerHTML = rounds.slice(0, count).map((round, idx) => {
    const chip = round === null ? '—' : (round === 0 ? 'Нічия' : `К${round}`);
    return `<div class="round-card"><div class="series-row"><span>Бій ${idx + 1}<small class="round-chip">${chip}</small></span><div class="round-row">${[...options, { val: 0, label: 'Нічия' }].map((option) => `<button class="chip round-btn ${Number(round) === option.val ? 'active' : ''}" type="button" data-round="${idx}" data-value="${option.val}">${option.label}</button>`).join('')}</div></div></div>`;
  }).join('');
}

export function renderMatchSummary() {
  const root = document.getElementById('matchSummary');
  if (!root) return;
  const summary = computeSeriesSummary();
  const keys = TEAM_KEYS.slice(0, state.teamsState.teamCount);
  const roundsByTeams = keys.map((key, idx) => `<div class="summary-pill">К${idx + 1}: <strong>${summary.wins[key]}</strong></div>`).join('');
  const winnerLabel = summary.winner === 'tie' ? 'Нічия' : `К${summary.winner.replace('team', '')}`;

  root.innerHTML = `${roundsByTeams}<div class="summary-pill">Нічиї: <strong>${summary.draws}</strong></div><div class="summary-pill">Поточний переможець: <strong>${winnerLabel}</strong></div>`;
}

export function renderPenalties() {
  const root = document.getElementById('penaltiesList');
  if (!root) return;
  root.innerHTML = getParticipants().map((nick) => {
    const val = Number(state.matchState.match.penalties[nick] || 0);
    return `<div class="penalty-row"><span>${nick}</span><div class="penalty-controls"><button class="chip" data-pen="${nick}:-1">-</button><strong>${val}</strong><button class="chip" data-pen="${nick}:1">+</button></div></div>`;
  }).join('');
}

export function renderMatchFields() {
  const participants = [...new Set(getParticipants())];
  const dl = document.getElementById('participantsDatalist');
  if (dl) dl.innerHTML = participants.map((nick) => `<option value="${nick}"></option>`).join('');

  ['mvp1', 'mvp2', 'mvp3'].forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    const value = state.matchState.match[id] || '';
    if (input.value !== value) input.value = value;
  });
}

export function bindUiEvents(handlers) {
  const roundsContainer = document.getElementById('seriesRounds');
  if (roundsContainer) {
    roundsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.round-btn');
      if (!btn || !roundsContainer.contains(btn)) return;
      handlers.onSeriesResult(Number(btn.dataset.round), Number(btn.dataset.value));
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
