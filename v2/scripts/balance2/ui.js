import {
  state,
  getParticipants,
  computeSeriesSummary,
  isSelected,
  getTeamLabel,
  getAvailableTeamKeys,
  getActiveMatchTeams,
  syncSelectedMap,
  getPlayerKey,
  TEAM_KEYS,
  TEAM_COUNT_OPTIONS,
  MAX_LOBBY_PLAYERS,
  normalizeTeamCount,
  getAssignedTeamId,
} from './state.js';
import { movePlayerToTeam } from './manual.js';

function escapeHtml(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value = '') {
  return escapeHtml(value);
}

export function setTournamentStatus(message, type = 'idle') {
  state.tournamentState.status = {
    message: String(message || ''),
    type: ['idle', 'loading', 'success', 'error', 'warning'].includes(type) ? type : 'idle',
  };
}

export function clearTournamentStatus() {
  setTournamentStatus('', 'idle');
}

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
    sourceLeagueLabel: playerOrNick.sourceLeagueLabel || '',
  };
}

function playerMetaHtml(player) {
  const parsed = formatPlayer(player);
  const leagueMarker = parsed.sourceLeagueLabel ? ` · <span class="league-marker">${escapeHtml(parsed.sourceLeagueLabel)}</span>` : '';
  return `<span class="player-meta"><strong>${escapeHtml(parsed.nick)}</strong> <small>${parsed.points} pts · ${escapeHtml(parsed.rank)}${leagueMarker}</small></span>`;
}

function sanitizeTeamCount(value) {
  return normalizeTeamCount(value);
}

function sumPoints(team) {
  return team.reduce((acc, player) => acc + (Number(player.points ?? player.pts) || 0), 0);
}

function balanceIntoNTeamsLocal(players, rawTeamCount) {
  const teamCount = sanitizeTeamCount(rawTeamCount);
  const teams = Object.fromEntries(TEAM_KEYS.map((key) => [key, []]));
  const sorted = [...players].sort((a, b) => ((Number(b.points ?? b.pts) || 0) - (Number(a.points ?? a.pts) || 0)));
  const targets = Array.from(
    { length: teamCount },
    (_, i) => Math.floor(sorted.length / teamCount) + (i < sorted.length % teamCount ? 1 : 0),
  );

  sorted.forEach((player) => {
    const idx = Array.from({ length: teamCount }, (_, i) => i)
      .filter((i) => teams[`team${i + 1}`].length < targets[i])
      .sort((a, b) => sumPoints(teams[`team${a + 1}`]) - sumPoints(teams[`team${b + 1}`]))[0] ?? 0;
    teams[`team${idx + 1}`].push(player);
  });
  return teams;
}

export function render() {
  renderLeagueControls();
  renderLegacyControls();
  renderPlayers();
  renderLobby();
  renderTeams();
  renderMatchConfig();
  renderMatchTeams();
  renderSeriesEditor();
  renderMatchSummary();
  renderPenalties();
  renderMatchFields();
  renderLastSavedGame();
}

function sourceOptionsForEventMode() {
  return state.app.eventMode === 'tournament'
    ? [
      { value: 'sundaygames', label: 'Дорослі' },
      { value: 'kids', label: 'Дитяча' },
      { value: 'mixed', label: 'Змішаний турнір' },
    ]
    : [
      { value: 'sundaygames', label: 'Дорослі' },
      { value: 'kids', label: 'Дитяча' },
    ];
}

export function renderLeagueControls() {
  const sourceOptions = sourceOptionsForEventMode();
  const sourceLabel = state.app.eventMode === 'tournament' ? 'Джерело гравців' : 'Ліга';
  const controlsSection = document.getElementById('leagueSelect')?.closest('section.card');
  if (controlsSection) {
    controlsSection.innerHTML = `
      <section class="balance-step balance-step--event">
        <h3>1. Тип події</h3>
        <div class="event-mode-switch">
          <button type="button" class="chip event-mode-button ${state.app.eventMode === 'regular' ? 'active' : ''}" data-event-mode="regular">Рейтинговий матч</button>
          <button type="button" class="chip event-mode-button ${state.app.eventMode === 'tournament' ? 'active' : ''}" data-event-mode="tournament">Турнір</button>
        </div>
      </section>
      <section class="balance-step balance-step--source">
        <h3>2. Джерело гравців</h3>
        <div class="player-source-control">
          <label class="league-label" for="leagueSelect">${escapeHtml(sourceLabel)}</label>
          <select id="leagueSelect" class="chip" data-role="player-source-mode">
            ${sourceOptions.map((option) => `<option value="${escapeAttr(option.value)}">${escapeHtml(option.label)}</option>`).join('')}
          </select>
          <button id="loadPlayersBtn" class="chip" type="button" data-load-players="1">Завантажити гравців</button>
        </div>
      </section>
    `;
  }

  const sourceSelect = document.querySelector('select[data-role="player-source-mode"]');
  if (!sourceSelect) return;
  sourceSelect.innerHTML = sourceOptions.map((option) => `<option value="${escapeAttr(option.value)}">${escapeHtml(option.label)}</option>`).join('');
  sourceSelect.value = sourceOptions.some((option) => option.value === state.app.playerSourceMode)
    ? state.app.playerSourceMode
    : 'sundaygames';
}

export function renderLegacyControls() {
  const sortSelect = document.getElementById('sortMode');
  const teamCountControl = document.getElementById('teamCountControl');
  if (sortSelect && sortSelect.value !== state.app.sortMode) sortSelect.value = state.app.sortMode;
  if (teamCountControl) {
    const existing = new Set(Array.from(teamCountControl.querySelectorAll('[data-team-count]'))
      .map((btn) => Number(btn.dataset.teamCount))
      .filter(Number.isFinite));
    TEAM_COUNT_OPTIONS.forEach((count) => {
      if (existing.has(count)) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.dataset.teamCount = String(count);
      btn.textContent = `${count} команд${count < 5 ? 'и' : ''}`;
      teamCountControl.appendChild(btn);
    });
  }

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
  selectedCount.textContent = `Обрано: ${state.playersState.selected.length} / ${MAX_LOBBY_PLAYERS}`;

  list.innerHTML = players.map((player) => {
    const key = getPlayerKey(player);
    const selected = isSelected(key);
    return `<div class="player-row ${selected ? 'selected' : ''}" data-toggle="${escapeAttr(key)}">${playerMetaHtml(player)}<span class="tag">${selected ? '✅ у лобі' : 'Додати'}</span></div>`;
  }).join('');
}

export function renderLobby() {
  const wrap = document.getElementById('lobbyList');
  if (!wrap) return;
  const availableTeamKeys = getAvailableTeamKeys();
  const playersMap = new Map(state.playersState.players.map((p) => [getPlayerKey(p), p]));
  wrap.innerHTML = state.playersState.selected.map((playerKey) => {
    const player = playersMap.get(playerKey) || { nick: playerKey, points: 0, rank: '—' };
    const assignedTeamId = getAssignedTeamId(playerKey);
    const status = assignedTeamId ? `У команді: ${getTeamLabel(assignedTeamId)}` : 'Не в команді';
    return `<div class="lobby-row"><div>${playerMetaHtml(player)}<div class="player-assignment-status">${escapeHtml(status)}</div></div><div class="manual-assign-control"><select class="team-assignment-select" data-role="assign-player-team" data-player-key="${escapeAttr(playerKey)}"><option value="">У команду...</option>${availableTeamKeys.map((teamKey) => `<option value="${escapeAttr(teamKey)}" ${assignedTeamId === teamKey ? 'selected' : ''}>${escapeHtml(getTeamLabel(teamKey))}</option>`).join('')}</select><button class="chip" data-remove="${escapeAttr(playerKey)}">Прибрати</button></div></div>`;
  }).join('');
}

function teamNameControl(key) {
  return `<div class="team-name-wrap" data-team-name-wrap="${escapeAttr(key)}"><strong class="team-name-label">${escapeHtml(getTeamLabel(key))}</strong><button class="chip" type="button" data-rename-team="${escapeAttr(key)}">✏️ Назва</button></div>`;
}

function sumByNicks(playerKeys) {
  const map = new Map(state.playersState.players.map((p) => [getPlayerKey(p), p]));
  return playerKeys.reduce((acc, playerKey) => acc + (Number(map.get(playerKey)?.points ?? map.get(playerKey)?.pts) || 0), 0);
}

export function renderTeams() {
  const grid = document.getElementById('teamsGrid');
  if (!grid) return;

  const keys = TEAM_KEYS.slice(0, state.teamsState.teamCount);
  const map = new Map(state.playersState.players.map((p) => [getPlayerKey(p), p]));
  const cards = keys.map((key) => {
    const playerKeys = state.teamsState.teams[key] || [];
    const total = sumByNicks(playerKeys);
    const members = playerKeys.map((playerKey) => {
      const player = map.get(playerKey) || { nick: playerKey, points: 0, rank: '—' };
      return `<div class="team-player">${playerMetaHtml(player)}<button class="team-player-remove" type="button" data-role="remove-player-from-team" data-player-key="${escapeAttr(playerKey)}" data-team-id="${escapeAttr(key)}">Прибрати</button></div>`;
    }).join('') || '<div class="team-empty-state">Додай гравців із lobby</div>';
    return `<div class="team-card"><h4>${teamNameControl(key)} <span class="tag">Σ ${total}</span></h4>${members}</div>`;
  });

  grid.innerHTML = cards.join('');
}

export function renderMatchConfig() {
  const root = document.getElementById('activeMatchConfig');
  if (!root) return;
  const eventMode = state.app.eventMode === 'tournament' ? 'tournament' : 'regular';
  const keys = getAvailableTeamKeys();
  const [teamA, teamB] = eventMode === 'tournament'
    ? [state.activeTeamAId || 'team1', state.activeTeamBId || 'team2']
    : getActiveMatchTeams();
  const teamOptions = (current, other, side) => keys.map((key) => `<option value="${key}" ${key === current ? 'selected' : ''} ${key === other ? 'disabled' : ''}>${escapeHtml(getTeamLabel(key))} (${side})</option>`).join('');

  const scheduleItems = state.activeMatch.schedule.map((match) => {
    const selected = match.id === state.activeMatch.selectedScheduleMatchId;
    const status = match.played ? `<span class="tag">Зіграно ${match.resultSummary ? `· ${escapeHtml(match.resultSummary)}` : ''}</span>` : '<span class="tag">Ще не зіграно</span>';
    return `<label class="schedule-item ${selected ? 'active' : ''}"><input type="radio" name="scheduleMatch" data-schedule-pick="${escapeAttr(match.id)}" ${selected ? 'checked' : ''}/><span>${escapeHtml(match.label)}</span>${status}</label>`;
  }).join('');

  const regularContent = keys.length <= 2 ? '' : `
    <div class="series-count"><span>Режим бою:</span><div class="series-count-choices">
      <button class="chip ${state.activeMatch.mode === 'manual' ? 'active' : ''}" type="button" data-match-mode="manual">Ручний вибір</button>
      <button class="chip ${state.activeMatch.mode === 'schedule' ? 'active' : ''}" type="button" data-match-mode="schedule">Розклад ігор</button>
    </div></div>
    ${state.activeMatch.mode === 'manual' ? `
      <div class="match-pick-grid">
        <label>Команда A <select data-match-team="A">${teamOptions(teamA, teamB, 'A')}</select></label>
        <label>Команда B <select data-match-team="B">${teamOptions(teamB, teamA, 'B')}</select></label>
      </div>
    ` : `<div class="schedule-list">${scheduleItems}</div>`}
  `;

  root.innerHTML = `
    ${eventMode === 'regular' ? regularContent : `
      <div class="tournament-panel">
        <div class="tag">Змішаний турнір завантажує гравців з дорослої та дитячої ліги.</div>
        <label>Назва турніру <input class="search-input" data-tournament-name type="text" value="${escapeAttr(state.tournamentState.tournamentName || '')}" placeholder="Весняний турнір"></label>
        <label>Режим бою
          <select class="chip" data-tournament-game-mode>
            ${['DM', 'TR', 'KT'].map((mode) => `<option value="${escapeAttr(mode)}" ${state.tournamentState.gameMode === mode ? 'selected' : ''}>${escapeHtml(mode)}</option>`).join('')}
          </select>
        </label>
        <div class="row-btns">
          <button class="chip" type="button" data-tournament-create="1" ${state.tournamentState.isSaving ? 'disabled' : ''}>Створити турнір</button>
          <button class="chip" type="button" data-tournament-save-teams="1" ${state.tournamentState.isSaving ? 'disabled' : ''}>Зберегти команди</button>
        </div>
        <div class="tag">Tournament ID: ${escapeHtml(state.tournamentState.tournamentId || '—')}</div>
        <div class="tag">Teams saved: ${state.tournamentState.teamsSaved ? '✅ так' : '❗ ні'}</div>
        <div class="tournament-debug">
          <div><strong>Остання дія:</strong> ${escapeHtml(state.tournamentState.lastAction || '—')}</div>
          <div><strong>Статус:</strong> ${escapeHtml(state.tournamentState.lastRequestStatus || '—')}</div>
          <div><strong>Помилка:</strong> ${escapeHtml(state.tournamentState.lastErrorMessage || '—')}</div>
        </div>
        <div id="tournamentStatus" class="balance-status" data-status-type="${escapeAttr(state.tournamentState.status?.type || 'idle')}">${escapeHtml(state.tournamentState.status?.message || '')}</div>
      </div>
      <div class="match-pick-grid">
        <label>Команда A <select data-tournament-team="A">${teamOptions(teamA, teamB, 'A')}</select></label>
        <label>Команда B <select data-tournament-team="B">${teamOptions(teamB, teamA, 'B')}</select></label>
      </div>
    `}
  `;
}

export function renderMatchTeams() {
  const root = document.getElementById('matchTeamsPreview');
  if (!root) return;
  const [teamA, teamB] = state.app.eventMode === 'tournament'
    ? [state.activeTeamAId || 'team1', state.activeTeamBId || 'team2']
    : getActiveMatchTeams();
  const matchTitle = document.getElementById('activeMatchLabel');
  if (matchTitle) matchTitle.textContent = `${getTeamLabel(teamA)} vs ${getTeamLabel(teamB)}`;

  const hasTeams = state.teamsState.teams[teamA].length > 0 || state.teamsState.teams[teamB].length > 0;
  if (!hasTeams) {
    root.innerHTML = '<div class="tag">Спочатку сформуй команди.</div>';
    return;
  }

  const map = new Map(state.playersState.players.map((p) => [getPlayerKey(p), p]));
  root.innerHTML = [teamA, teamB].map((key, idx) => {
    const items = state.teamsState.teams[key].map((playerKey) => {
      const player = map.get(playerKey);
      const leagueLabel = player?.sourceLeagueLabel ? ` · ${escapeHtml(player.sourceLeagueLabel)}` : '';
      return `<li>${escapeHtml(player?.nick || playerKey)}${leagueLabel}</li>`;
    }).join('');
    const label = idx === 0 ? 'A' : 'B';
    return `<div class="team-card"><h4>${label} · ${escapeHtml(getTeamLabel(key))}</h4><ul class="match-team-preview">${items || '<li>порожньо</li>'}</ul></div>`;
  }).join('');
}

export function renderSeriesEditor() {
  const root = document.getElementById('seriesRounds');
  const countRoot = document.getElementById('seriesCountOptions');
  if (!root) return;

  const count = Math.min(7, Math.max(3, Number(state.matchState.seriesCount) || 3));
  const rounds = state.matchState.seriesRounds.slice(0, 7);
  while (rounds.length < 7) rounds.push(null);

  if (countRoot) {
    countRoot.querySelectorAll('[data-series-count]').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.seriesCount) === count);
    });
  }

  root.innerHTML = rounds.slice(0, count).map((round, idx) => {
    const chip = round === null ? '—' : (round === 0 ? 'Нічия' : (round === 1 ? 'A' : 'B'));
    return `<div class="round-card"><div class="series-row"><span>Бій ${idx + 1}<small class="round-chip">${chip}</small></span><div class="round-row">${[{ val: 1, label: 'Перемога A' }, { val: 0, label: 'Нічия' }, { val: 2, label: 'Перемога B' }].map((option) => `<button class="chip round-btn ${Number(round) === option.val ? 'active' : ''}" type="button" data-round="${idx}" data-value="${option.val}">${option.label}</button>`).join('')}</div></div></div>`;
  }).join('');
}

export function renderMatchSummary() {
  const root = document.getElementById('matchSummary');
  if (!root) return;
  const summary = computeSeriesSummary();
  const winnerLabel = summary.winner === 'tie' ? 'Нічия' : (summary.winner === 'team1' ? 'A' : 'B');

  root.innerHTML = `<div class="summary-pill">A: <strong>${summary.wins.team1}</strong></div><div class="summary-pill">B: <strong>${summary.wins.team2}</strong></div><div class="summary-pill">Нічиї: <strong>${summary.draws}</strong></div><div class="summary-pill">Поточний переможець: <strong>${winnerLabel}</strong></div>`;
}

export function renderPenalties() {
  const root = document.getElementById('penaltiesList');
  const section = document.getElementById('penaltiesSection');
  const chevron = document.getElementById('penaltiesChevron');
  if (!root || !section || !chevron) return;

  const collapsed = state.uiState.penaltiesCollapsed !== false;
  section.classList.toggle('collapsed', collapsed);
  chevron.textContent = collapsed ? '▸' : '▾';

  const map = new Map(state.playersState.players.map((p) => [getPlayerKey(p), p]));
  root.innerHTML = getParticipants().map((playerKey) => {
    const player = map.get(playerKey);
    const val = Number(state.matchState.match.penalties[playerKey] || 0);
    return `<div class="penalty-row"><span>${escapeHtml(player?.nick || playerKey)}</span><div class="penalty-controls"><button class="chip" data-pen-player-key="${escapeAttr(playerKey)}" data-pen-delta="-1">-</button><strong>${val}</strong><button class="chip" data-pen-player-key="${escapeAttr(playerKey)}" data-pen-delta="1">+</button></div></div>`;
  }).join('');
}

export function renderMatchFields() {
  const participantKeys = state.app.eventMode === 'tournament'
    ? [...new Set([...(state.teamsState.teams[state.activeTeamAId] || []), ...(state.teamsState.teams[state.activeTeamBId] || [])])]
    : [...new Set(getParticipants())];
  const map = new Map(state.playersState.players.map((p) => [getPlayerKey(p), p]));
  const participants = participantKeys.map((playerKey) => map.get(playerKey)?.nick || playerKey);
  const dl = document.getElementById('participantsDatalist');
  if (dl) dl.innerHTML = participants.map((nick) => `<option value="${escapeAttr(nick)}"></option>`).join('');

  ['mvp1', 'mvp2', 'mvp3'].forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    const value = state.matchState.match[id] || '';
    if (input.value !== value) input.value = value;
  });
}

function formatSavedTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

export function renderLastSavedGame() {
  const root = document.getElementById('lastSavedGame');
  if (!root) return;
  if (!state.lastSavedGame) {
    root.innerHTML = '<div class="tag">Ще немає збережених ігор у цій сесії.</div>';
    return;
  }
  const g = state.lastSavedGame;
  root.innerHTML = `<div class="summary-pill">${escapeHtml(formatSavedTime(g.savedAt))} — ${escapeHtml(g.teamA)} vs ${escapeHtml(g.teamB)}</div><div class="summary-pill">Серія: <strong>${escapeHtml(g.summary)}</strong></div><div class="summary-pill">MVP: <strong>${escapeHtml(g.mvp)}</strong></div><div class="summary-pill">Штрафи: <strong>${escapeHtml(g.penalties)}</strong></div>`;
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

  const balanceBtn = document.getElementById('balanceBtn');
  if (balanceBtn) {
    balanceBtn.addEventListener('click', (e) => {
      const selected = state.playersState.selected.length;
      const teamCount = sanitizeTeamCount(state.teamsState.teamCount);
      if (selected < teamCount) {
        e.preventDefault();
        e.stopImmediatePropagation();
        window.alert(`Недостатньо гравців для ${teamCount} команд. Мінімум: ${teamCount}.`);
        return;
      }
      const map = new Map(state.playersState.players.map((p) => [getPlayerKey(p), p]));
      const picked = state.playersState.selected.map((playerKey) => map.get(playerKey)).filter(Boolean);
      const teams = balanceIntoNTeamsLocal(picked, teamCount);
      TEAM_KEYS.forEach((key) => {
        state.teamsState.teams[key] = (teams[key] || []).map((p) => getPlayerKey(p));
      });
      state.teamsState.teamCount = teamCount;
      e.preventDefault();
      e.stopImmediatePropagation();
      handlers.onChanged();
    }, true);
  }

  document.addEventListener('change', (e) => {
    const matchMode = e.target.closest('[data-match-mode]')?.dataset.matchMode;
    const teamPick = e.target.closest('select[data-match-team]');
    const schedulePick = e.target.closest('[data-schedule-pick]')?.dataset.schedulePick;
    const eventMode = e.target.closest('[data-event-mode]')?.dataset.eventMode;
    const tournamentTeamPick = e.target.closest('select[data-tournament-team]');
    const gameModePick = e.target.closest('select[data-tournament-game-mode]');
    const playerSourceModePick = e.target.closest('select[data-role="player-source-mode"]');
    const assignPlayerTeam = e.target.closest('select[data-role="assign-player-team"]');
    if (matchMode) handlers.onMatchMode(matchMode);
    if (teamPick) handlers.onMatchTeamPick(teamPick.dataset.matchTeam, teamPick.value);
    if (schedulePick) handlers.onSchedulePick(schedulePick);
    if (eventMode) handlers.onEventMode(eventMode);
    if (tournamentTeamPick) handlers.onTournamentTeamPick(tournamentTeamPick.dataset.tournamentTeam, tournamentTeamPick.value);
    if (gameModePick) handlers.onTournamentGameMode(gameModePick.value);
    if (playerSourceModePick) handlers.onPlayerSourceMode(playerSourceModePick.value);
    if (assignPlayerTeam) handlers.onAssignPlayerTeam(assignPlayerTeam.dataset.playerKey, assignPlayerTeam.value);
  });

  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-toggle]')?.dataset.toggle;
    const remove = e.target.closest('[data-remove]')?.dataset.remove;
    const moveBtn = e.target.closest('[data-move-player-key]');
    const seriesCount = e.target.closest('[data-series-count]')?.dataset.seriesCount;
    const teamCount = e.target.closest('[data-team-count]')?.dataset.teamCount;
    const clearSeries = e.target.closest('[data-series-reset]');
    const penBtn = e.target.closest('[data-pen-player-key]');
    const renameTeam = e.target.closest('[data-rename-team]')?.dataset.renameTeam;
    const penaltiesToggle = e.target.closest('[data-toggle-penalties]');
    const matchMode = e.target.closest('[data-match-mode]')?.dataset.matchMode;
    const eventMode = e.target.closest('[data-event-mode]')?.dataset.eventMode;
    const createTournament = e.target.closest('[data-tournament-create]');
    const saveTeams = e.target.closest('[data-tournament-save-teams]');
    const loadPlayers = e.target.closest('[data-load-players]');
    const removeFromTeam = e.target.closest('[data-role="remove-player-from-team"]');

    if (toggle) {
      const alreadySelected = state.playersState.selectedMap.has(toggle);
      if (alreadySelected) {
        state.playersState.selected = state.playersState.selected.filter((n) => n !== toggle);
        Object.keys(state.teamsState.teams).forEach((key) => {
          state.teamsState.teams[key] = state.teamsState.teams[key].filter((n) => n !== toggle);
        });
      } else if (state.playersState.selected.length >= MAX_LOBBY_PLAYERS) {
        window.alert(`Лобі заповнене. Максимум ${MAX_LOBBY_PLAYERS} гравців.`);
        return;
      } else {
        state.playersState.selected = [...state.playersState.selected, toggle];
      }
      syncSelectedMap();
      handlers.onChanged();
    }
    if (remove) {
      state.playersState.selected = state.playersState.selected.filter((n) => n !== remove);
      Object.keys(state.teamsState.teams).forEach((key) => {
        state.teamsState.teams[key] = state.teamsState.teams[key].filter((n) => n !== remove);
      });
      syncSelectedMap();
      handlers.onChanged();
    }
    if (moveBtn) {
      const playerKey = moveBtn.dataset.movePlayerKey || '';
      const team = moveBtn.dataset.moveTeam || '';
      movePlayerToTeam(playerKey, team === 'bench' ? '' : team);
      handlers.onChanged();
    }
    if (teamCount) {
      state.teamsState.teamCount = sanitizeTeamCount(teamCount);
      handlers.onChanged();
    }
    if (seriesCount) handlers.onSeriesCount(Number(seriesCount));
    if (clearSeries) handlers.onSeriesReset();
    if (penBtn) {
      const playerKey = penBtn.dataset.penPlayerKey || '';
      const delta = Number(penBtn.dataset.penDelta || 0);
      handlers.onPenalty(playerKey, delta);
    }
    if (renameTeam) handlers.onRenameStart(renameTeam);
    if (penaltiesToggle) handlers.onTogglePenalties();
    if (matchMode) handlers.onMatchMode(matchMode);
    if (eventMode) handlers.onEventMode(eventMode);
    if (loadPlayers) handlers.onLoadPlayers();
    if (createTournament) handlers.onCreateTournament();
    if (saveTeams) handlers.onSaveTournamentTeams();
    if (removeFromTeam) handlers.onRemovePlayerFromTeam(removeFromTeam.dataset.playerKey, removeFromTeam.dataset.teamId);
  });

  document.addEventListener('input', (e) => {
    const tournamentNameInput = e.target.closest('[data-tournament-name]');
    if (tournamentNameInput) handlers.onTournamentName(tournamentNameInput.value);
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
