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
  MAX_SERIES_ROUNDS,
  normalizeTeamCount,
  getAssignedTeamId,
  getTeamCountOptionsForEventMode,
  getMaxLobbyPlayersForEventMode,
} from './state.js';
import { movePlayerToTeam } from './manual.js';
import { formatSchoolDisplay, getSchoolGroupProgress, canFormSchoolFinalGroup, getWildcardCandidates, getFinalGroupProgress, getSchoolWorkflowStage } from './schoolMode.js';

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

function getMvpKeyId(id) {
  return `${id}Key`;
}

function mvpOptionLabel(player, playerKey) {
  const nick = String(player?.nick || playerKey || '').trim();
  const leagueLabel = String(player?.sourceLeagueLabel || '').trim();
  return leagueLabel && state.app.eventMode === 'tournament' && state.app.playerSourceMode === 'mixed'
    ? `${nick} · ${leagueLabel}`
    : nick;
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
  renderStepFlow();
  renderLeagueControls();
  renderTeamSettings();
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
  renderSavePreview();
  renderSaveStatus();
  renderLastSavedGame();
}

function getFlowState() {
  const [teamA, teamB] = state.app.eventMode === 'tournament'
    ? [state.activeTeamAId, state.activeTeamBId]
    : getActiveMatchTeams();
  const hasLobby = state.playersState.selected.length > 0;
  const hasTeams = (state.teamsState.teams[teamA] || []).length > 0 && (state.teamsState.teams[teamB] || []).length > 0;
  const hasResult = computeSeriesSummary().played >= 3;
  const hasMvp = ['mvp1', 'mvp2', 'mvp3'].some((id) => state.matchState.match[id] || state.matchState.match[getMvpKeyId(id)]);
  const mvpReady = state.requireMvp === false || hasMvp;

  let active = 1;
  if (state.uiState.flowStarted) active = 2;
  if (state.uiState.flowStarted && state.app.playerSourceMode) active = 3;
  if (state.playersState.playersLoaded) active = 4;
  if (state.playersState.playersLoaded && hasLobby) active = 5;
  if (state.playersState.playersLoaded && hasLobby && hasTeams) active = 6;
  if (state.playersState.playersLoaded && hasLobby && hasTeams && hasResult && mvpReady) active = 7;

  const hints = {
    1: 'Обери тип події',
    2: 'Обери джерело гравців',
    3: 'Вибери кількість команд і режим балансу',
    4: 'Завантаж гравців і додай їх у lobby',
    5: 'Сформуй команди',
    6: 'Внеси результат і MVP',
    7: 'Перевір дані та збережи',
  };

  return { active, hint: hints[active] };
}

function renderStepFlow() {
  const root = document.querySelector('.balance2-root');
  const statusCard = document.getElementById('statusBox');
  if (!root || !statusCard) return;

  let flow = document.getElementById('balanceStepFlow');
  if (!flow) {
    flow = document.createElement('section');
    flow.id = 'balanceStepFlow';
    flow.className = 'balance-flow';
    statusCard.insertAdjacentElement('afterend', flow);
  }

  const { active, hint } = getFlowState();
  const steps = [
    [1, 'Тип події'],
    [2, 'Джерело'],
    [3, 'Налаштування'],
    [4, 'Lobby'],
    [5, 'Команди'],
    [6, 'Результат'],
    [7, 'Збереження'],
  ];
  flow.innerHTML = `
    <div class="balance-flow-steps">
      ${steps.map(([index, label]) => `<div class="balance-flow-step ${index === active ? 'active' : ''} ${index < active ? 'done' : ''}"><strong>${index}</strong> ${escapeHtml(label)}</div>`).join('')}
    </div>
    <div class="balance-flow-hint">${escapeHtml(hint)}</div>
  `;
  updateFlowSections(active);
}

function markFlowSection(element, step, active) {
  if (!element) return;
  element.dataset.flowStep = String(step);
  element.classList.toggle('flow-section-muted', step > active + 1);
  let hint = element.querySelector(':scope > .flow-disabled-hint');
  if (step > active + 1) {
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'flow-disabled-hint';
      element.insertBefore(hint, element.firstElementChild?.nextSibling || element.firstChild);
    }
    hint.textContent = step === 4 ? 'Спочатку завантаж гравців' : (step === 5 ? 'Спочатку додай гравців' : (step === 6 ? 'Спочатку сформуй команди' : 'Спочатку внеси результат'));
  } else {
    hint?.remove();
  }
}

function updateFlowSections(active) {
  markFlowSection(document.querySelector('.balance-step--event')?.closest('section.card'), 1, active);
  markFlowSection(document.querySelector('.balance-step--source')?.closest('section.card'), 2, active);
  markFlowSection(document.getElementById('teamSettingsCard'), 3, active);
  markFlowSection(document.getElementById('playerList')?.closest('section.card'), 4, active);
  markFlowSection(document.getElementById('lobbyList')?.closest('section.card'), 4, active);
  markFlowSection(document.getElementById('teamsCard'), 5, active);
  markFlowSection(document.getElementById('matchCard'), 6, active);
}

function getSaveStatusRoot() {
  let root = document.getElementById('saveStatus');
  if (root) return root;

  const sticky = document.querySelector('.save-sticky');
  if (!sticky?.parentNode) return null;

  root = document.createElement('div');
  root.id = 'saveStatus';
  root.setAttribute('aria-live', 'polite');
  sticky.parentNode.insertBefore(root, sticky);
  return root;
}

export function renderSaveStatus() {
  const root = getSaveStatusRoot();
  if (!root) return;

  const status = ['saving', 'success', 'error'].includes(state.saveStatus) ? state.saveStatus : 'idle';
  const message = String(state.saveMessage || '');
  root.className = `save-status save-status--${status}${status === 'idle' ? ' hidden' : ''}`;
  root.textContent = message;
}

function getSavePreviewRoot() {
  let root = document.getElementById('savePreview');
  if (root) return root;

  const sticky = document.querySelector('.save-sticky');
  if (!sticky?.parentNode) return null;

  root = document.createElement('div');
  root.id = 'savePreview';
  root.className = 'save-preview';
  sticky.parentNode.insertBefore(root, sticky);
  return root;
}

function sourceLabel() {
  if (state.app.playerSourceMode === 'mixed') return 'Змішаний турнір';
  return state.app.playerSourceMode === 'kids' ? 'Дитяча' : 'Дорослі';
}

function winnerLabel(teamA, teamB) {
  const summary = computeSeriesSummary();
  if (summary.played < 1) return 'не вказано';
  if (summary.winner === 'tie') return 'нічия';
  if (summary.winner === 'team1') return getTeamLabel(teamA);
  if (summary.winner === 'team2') return getTeamLabel(teamB);
  return 'не вказано';
}

function previewMvpLabel(id, map) {
  const playerKey = state.matchState.match[getMvpKeyId(id)];
  const player = playerKey ? map.get(playerKey) : null;
  return player ? mvpOptionLabel(player, playerKey) : (state.matchState.match[id] || 'не вказано');
}

function previewRow(label, value) {
  return `<div class="save-preview-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

export function renderSavePreview() {
  const root = getSavePreviewRoot();
  if (!root) return;

  const eventMode = ['regular', 'tournament', 'school'].includes(state.app.eventMode) ? state.app.eventMode : 'regular';
  const [teamA, teamB] = eventMode === 'tournament'
    ? [state.activeTeamAId || 'team1', state.activeTeamBId || 'team2']
    : getActiveMatchTeams();
  const map = new Map(state.playersState.players.map((p) => [getPlayerKey(p), p]));
  const readiness = state.saveReadinessMessage || '';
  const saveState = readiness ? `Не готово: ${readiness}` : 'Готово до збереження';
  const mvp = ['mvp1', 'mvp2', 'mvp3'].map((id) => previewMvpLabel(id, map)).join(' / ');

  const rows = eventMode === 'tournament'
    ? [
      ['Тип', 'Турнір'],
      ['Tournament ID', state.tournamentState.tournamentId || 'ще не створено'],
      ['Джерело гравців', sourceLabel()],
      ['Активний матч', `${getTeamLabel(teamA)} vs ${getTeamLabel(teamB)}`],
      ['Переможець', winnerLabel(teamA, teamB)],
      ['MVP1/MVP2/MVP3', mvp],
      ['Команди збережені', state.tournamentState.teamsSaved ? 'так' : 'ні'],
      ['Save', saveState],
    ]
    : [
      ['Тип', 'Рейтинговий матч'],
      ['Ліга', sourceLabel()],
      ['Команди', `${getTeamLabel(teamA)} vs ${getTeamLabel(teamB)}`],
      ['Переможець', winnerLabel(teamA, teamB)],
      ['MVP1/MVP2/MVP3', mvp],
      ['Гравців у lobby', String(state.playersState.selected.length)],
      ['Save', saveState],
    ];

  root.innerHTML = `
    <div class="save-preview-title">Preview перед збереженням</div>
    <div class="save-preview-grid">${rows.map(([label, value]) => previewRow(label, value)).join('')}</div>
  `;
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
          <button type="button" class="chip event-mode-button ${state.app.eventMode === 'regular' ? 'active' : ''}" data-event-mode="regular">Рейтингові ігри</button>
          <button type="button" class="chip event-mode-button ${state.app.eventMode === 'tournament' ? 'active' : ''}" data-event-mode="tournament">Турнір</button>
          <button type="button" class="chip event-mode-button ${state.app.eventMode === 'school' ? 'active' : ''}" data-event-mode="school">Школа</button>
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
  if (sortSelect && sortSelect.value !== state.app.sortMode) sortSelect.value = state.app.sortMode;
  const teamCountSelect = document.querySelector('select[data-role="team-count-select"]');
  if (teamCountSelect && Number(teamCountSelect.value) !== state.teamsState.teamCount) {
    teamCountSelect.value = String(state.teamsState.teamCount);
  }
}

export function renderTeamSettings() {
  const lobbySection = document.getElementById('lobbyList')?.closest('section.card');
  if (!lobbySection?.parentNode) return;

  let settings = document.getElementById('teamSettingsCard');
  if (!settings) {
    settings = document.createElement('section');
    settings.id = 'teamSettingsCard';
    settings.className = 'card team-settings-card';
    lobbySection.parentNode.insertBefore(settings, lobbySection);
  }

  let modeControl = document.getElementById('balanceModeControl');
  if (!modeControl) {
    modeControl = document.createElement('div');
    modeControl.id = 'balanceModeControl';
    modeControl.className = 'series-count-choices';
  }
  modeControl.innerHTML = `
    <button type="button" class="chip ${state.app.mode !== 'manual' ? 'active' : ''}" data-balance-mode="auto">Автобаланс</button>
    <button type="button" class="chip ${state.app.mode === 'manual' ? 'active' : ''}" data-balance-mode="manual">Ручний баланс</button>
  `;

  const primaryActionLabel = state.app.mode === 'manual' ? 'Ручне формування' : 'Сформувати команди';
  const primaryActionMode = state.app.mode === 'manual' ? 'manual' : 'auto';

  const isSchool = state.app.eventMode === 'school';
  settings.innerHTML = `
    <h3>3. Налаштування команд</h3>
    <p class="section-hint">Обери кількість команд і режим балансу до формування lobby.</p>
    <div class="team-settings-grid">
      <div class="team-settings-group" data-team-count-slot>
        <label class="team-count-select-label">Кількість команд
          <select class="chip team-count-select" data-role="team-count-select">
            ${getTeamCountOptionsForEventMode(state.app.eventMode).map((count) => `<option value="${escapeAttr(count)}" ${count === state.teamsState.teamCount ? 'selected' : ''}>${count} ${count < 5 ? 'команди' : 'команд'}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="team-settings-group" data-balance-mode-slot>
        <strong>Режим балансу</strong>
      </div>
    </div>
    <div class="team-settings-actions">
      ${isSchool ? '<button class="chip" type="button" data-school-build-teams="1">Сформувати 10 команд</button>' : `<button class="chip balance-primary-action" type="button" data-role="balance-primary-action" data-balance-primary="${escapeAttr(primaryActionMode)}">${escapeHtml(primaryActionLabel)}</button>`}
    </div>
    ${isSchool ? '<div class="team-settings-actions"><button class="chip" type="button" data-school-build-groups="1">Сформувати групи</button></div><div id="schoolGroupsPreview"></div>' : ''}
    ${isSchool ? `<div class="school-event-meta"><label>Назва турніру <input class="search-input" data-school-title="1" value="${escapeAttr(state.schoolState?.title || 'Шкільний турнір')}"></label><label>Дата турніру <input class="search-input" type="date" data-school-date="1" value="${escapeAttr(state.schoolState?.date || new Date().toISOString().slice(0, 10))}"></label></div>` : ''}
  `;
  settings.querySelector('[data-balance-mode-slot]')?.appendChild(modeControl);
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
  selectedCount.textContent = `Обрано: ${state.playersState.selected.length} / ${getMaxLobbyPlayersForEventMode(state.app.eventMode)}`;

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

function scheduleStatusLabel(status) {
  if (status === 'done') return 'Зіграно';
  if (status === 'current') return 'Поточна';
  return 'Далі';
}

function renderTournamentSchedule() {
  const schedule = Array.isArray(state.tournamentState.tournamentSchedule) ? state.tournamentState.tournamentSchedule : [];
  if (state.app.eventMode !== 'tournament' || state.tournamentState.tournamentType !== 'group') return '';
  if (!schedule.length) {
    return '<div class="tournament-schedule"><h4>Календар турніру</h4><div class="tag">Сформуй команди, щоб побачити календар матчів.</div></div>';
  }
  const rows = schedule.map((match) => {
    const isDone = match.status === 'done';
    const canPick = !isDone;
    return `
      <div class="tournament-schedule-row tournament-schedule-row--${escapeAttr(match.status || 'pending')}">
        <div>
          <strong>${escapeHtml(match.gameId)}</strong>
          <span>${escapeHtml(getTeamLabel(match.teamAId))} vs ${escapeHtml(getTeamLabel(match.teamBId))}</span>
        </div>
        <span class="tag">${escapeHtml(scheduleStatusLabel(match.status))}</span>
        ${canPick ? `<button class="chip" type="button" data-tournament-schedule-pick="${escapeAttr(match.gameId)}">Обрати цей матч</button>` : ''}
      </div>
    `;
  }).join('');
  return `
    <div class="tournament-schedule">
      <div class="section-head">
        <h4>Календар турніру</h4>
        <button class="chip" type="button" data-tournament-next-match="1">Наступна гра</button>
      </div>
      <div class="tournament-schedule-list">${rows}</div>
    </div>
  `;
}

function schoolTeamDisplay(teamId) {
  const meta = state.schoolState?.teamMeta?.[teamId] || {};
  const fallbackTeamName = state.teamsState.teamNames?.[teamId] || `Команда ${String(teamId || '').replace('team', '')}`;
  const labels = formatSchoolDisplay(meta, fallbackTeamName);
  return `${labels.schoolLabel} · ${labels.teamLabel}`;
}

function renderSchoolGroupMatches() {
  if (state.app.eventMode !== 'school') return '';
  const matches = Array.isArray(state.schoolState.groupMatches) ? state.schoolState.groupMatches : [];
  const byGroup = (gid) => matches.filter((m) => m.groupId === gid);
  const error = state.schoolState?.lastError ? `<div class="tag">${escapeHtml(state.schoolState.lastError)}</div>` : '';
  const canGenerate = (state.schoolState?.groups?.A?.teamIds?.length || 0) === 5 && (state.schoolState?.groups?.B?.teamIds?.length || 0) === 5;
  const groupBlock = (gid) => `<div class="team-card"><h4>Група ${gid} — матчі</h4>${byGroup(gid).map((match, idx) => {
    const title = match.title || `Група ${gid} · Матч ${idx + 1}`;
    return `<div class="tournament-schedule-row"><div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(schoolTeamDisplay(match.teamAId))} vs ${escapeHtml(schoolTeamDisplay(match.teamBId))}</span></div><label>A <input type="number" min="0" max="10" step="1" data-school-group-score-a="${escapeAttr(match.id)}" value="${escapeAttr(match?.result?.pointsA ?? '')}"></label><label>B <input type="number" min="0" max="10" step="1" data-school-group-score-b="${escapeAttr(match.id)}" value="${escapeAttr(match?.result?.pointsB ?? '')}"></label><span class="tag">${escapeHtml(match.status || 'pending')}</span>${match.status === 'current' ? '<button class="chip" type="button" disabled>Поточний</button>' : `<button class="chip" type="button" data-school-group-current="${escapeAttr(match.id)}">Обрати як поточний</button>`}${(Number.isInteger(match?.result?.pointsA) || Number.isInteger(match?.result?.pointsB)) ? `<button class="chip" type="button" data-school-group-clear="${escapeAttr(match.id)}">Очистити результат</button>` : ''}</div>`;
  }).join('') || '<div class="tag">Матчі ще не згенеровано.</div>'}</div>`;
  const standingsTable = (gid) => {
    const rows = state.schoolState?.groupStandings?.[gid] || [];
    return `<div class="team-card"><h4>Таблиця Групи ${gid}</h4><table><thead><tr><th>Місце</th><th>Команда / школа</th><th>І</th><th>В</th><th>Н</th><th>П</th><th>Турнірні бали</th><th>Забито</th><th>Пропущено</th><th>Різниця</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.place}</td><td>${escapeHtml(schoolTeamDisplay(r.teamId))}</td><td>${r.matchesPlayed}</td><td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td><td>${r.tournamentPoints}</td><td>${r.pointsFor}</td><td>${r.pointsAgainst}</td><td>${r.pointsDiff}</td></tr>`).join('')}</tbody></table></div>`;
  };
  const progress = getSchoolGroupProgress(matches);
  const canFormFinal = canFormSchoolFinalGroup(state.schoolState);
  const qualifiers = new Set([...(state.schoolState?.qualifiers?.A || []), ...(state.schoolState?.qualifiers?.B || [])]);
  const wildcardCandidates = getWildcardCandidates(state.schoolState);
  const wildcardSelected = state.schoolState?.wildcard?.teamId || '';
  const finalRows = (state.schoolState?.finalGroup?.teamIds || []).map((teamId) => {
    const rowA = (state.schoolState?.groupStandings?.A || []).find((r) => r.teamId === teamId);
    const rowB = (state.schoolState?.groupStandings?.B || []).find((r) => r.teamId === teamId);
    const row = rowA || rowB;
    const path = !qualifiers.has(teamId) ? 'Wildcard' : `${rowA ? 'Group A' : 'Group B'} · #${row?.place || ''}`;
    return `<li>${escapeHtml(schoolTeamDisplay(teamId))} · ${escapeHtml(path)}${!qualifiers.has(teamId) ? ' · Wildcard' : ''}</li>`;
  }).join('');
  const finalistsSection = ['A', 'B'].map((gid) => (state.schoolState?.qualifiers?.[gid] || []).map((teamId) => {
    const row = (state.schoolState?.groupStandings?.[gid] || []).find((r) => r.teamId === teamId);
    return row ? `<li>#${row.place} · ${escapeHtml(schoolTeamDisplay(teamId))} · TP ${row.tournamentPoints} · W ${row.wins} · Diff ${row.pointsDiff} · PF ${row.pointsFor}</li>` : '';
  }).join('')).join('');
  const wildcardRows = wildcardCandidates.map((row) => `<option value="${escapeAttr(row.teamId)}" ${row.teamId === wildcardSelected ? 'selected' : ''}>${escapeHtml(`Group ${row.groupId} · #${row.place} · ${schoolTeamDisplay(row.teamId)}`)}</option>`).join('');
  const finalMatches = Array.isArray(state.schoolState?.finalGroup?.matches) ? state.schoolState.finalGroup.matches : [];
  const finalCanGenerate = [4, 5].includes((state.schoolState?.finalGroup?.teamIds || []).length) && new Set(state.schoolState?.finalGroup?.teamIds || []).size === (state.schoolState?.finalGroup?.teamIds || []).length;
  const finalProgress = getFinalGroupProgress(finalMatches);
  const finalStandings = state.schoolState?.finalGroup?.standings || [];
  const champion = finalStandings[0];
  const stage = state.uiState?.schoolWorkflowStage || getSchoolWorkflowStage(state.schoolState);
  const stageLabel = {
    setup: 'Налаштування',
    teams: 'Команди',
    groups: 'Групи',
    group_matches: 'Групові матчі',
    final_group: 'Фінальна група',
    final_matches: 'Фінальні матчі',
    completed: 'Завершено',
  }[stage] || 'Налаштування';
  const finalMatchesHtml = finalMatches.map((match, idx) => `<div class="tournament-schedule-row"><div><strong>${escapeHtml(match.title || `Фінальна група · Матч ${idx + 1}`)}</strong><span>${escapeHtml(schoolTeamDisplay(match.teamAId))}${!qualifiers.has(match.teamAId) ? ' · Wildcard' : ''} vs ${escapeHtml(schoolTeamDisplay(match.teamBId))}${!qualifiers.has(match.teamBId) ? ' · Wildcard' : ''}</span></div><label>A <input type="number" min="0" max="10" step="1" data-school-final-score-a="${escapeAttr(match.id)}" value="${escapeAttr(match?.result?.pointsA ?? '')}"></label><label>B <input type="number" min="0" max="10" step="1" data-school-final-score-b="${escapeAttr(match.id)}" value="${escapeAttr(match?.result?.pointsB ?? '')}"></label><span class="tag">${escapeHtml(match.status || 'pending')}</span>${match.status === 'current' ? '<button class="chip" type="button" disabled>Поточний</button>' : `<button class="chip" type="button" data-school-final-current="${escapeAttr(match.id)}">Обрати як поточний</button>`}${(Number.isInteger(match?.result?.pointsA) || Number.isInteger(match?.result?.pointsB)) ? `<button class="chip" type="button" data-school-final-clear="${escapeAttr(match.id)}">Очистити результат</button>` : ''}</div>`).join('') || '<div class="tag">Фінальні матчі ще не згенеровано.</div>';
  const finalStandingsHtml = `<table><thead><tr><th>Місце</th><th>Команда / школа</th><th>І</th><th>В</th><th>Н</th><th>П</th><th>Турнірні бали</th><th>Забито</th><th>Пропущено</th><th>Різниця</th></tr></thead><tbody>${finalStandings.map((r) => `<tr><td>${r.place}</td><td>${escapeHtml(schoolTeamDisplay(r.teamId))}</td><td>${r.matchesPlayed}</td><td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td><td>${r.tournamentPoints}</td><td>${r.pointsFor}</td><td>${r.pointsAgainst}</td><td>${r.pointsDiff}</td></tr>`).join('')}</tbody></table>`;
  return `<div class="school-group-stage"><div class="tag">Поточний етап: ${escapeHtml(stageLabel)}</div><div class="team-settings-actions"><button class="chip" type="button" data-school-export-json="1">Експортувати JSON</button><button class="chip" type="button" data-school-generate-group-matches="1" ${canGenerate ? '' : 'disabled'}>Згенерувати матчі груп</button></div><h4>Групові матчі</h4>${error}<div class="tag">Груповий етап: Зіграно ${progress.completedTotal} / ${progress.total} · Група A: ${progress.completedA} / ${progress.totalA} · Група B: ${progress.completedB} / ${progress.totalB}</div><div class="tag">${progress.completedTotal === 20 ? 'Груповий етап завершено. Можна формувати фінальну групу.' : 'Завершіть усі групові матчі, щоб сформувати фінальну групу.'}</div>${groupBlock('A')}${groupBlock('B')}${standingsTable('A')}${standingsTable('B')}<div class="team-settings-actions"><button class="chip" type="button" data-school-form-final-group="1" ${canFormFinal ? '' : 'disabled'}>Сформувати фінальну групу</button></div>${canFormFinal ? '' : '<div class="tag">Фінальна група буде доступна після завершення всіх 20 групових матчів.</div>'}<div class="team-card"><h4>Фіналісти</h4><ol>${finalistsSection || '<li>Сформуйте фінальну групу.</li>'}</ol></div><div class="team-card"><h4>Wildcard</h4><button class="chip" type="button" data-school-suggest-wildcard="1">Запропонувати найкращу wildcard</button><label>Обрати wildcard вручну<select data-school-wildcard-select><option value="">Не вибрано</option>${wildcardRows}</select></label><label><input type="checkbox" data-school-wildcard-enabled ${state.schoolState?.wildcard?.enabled ? 'checked' : ''}/> Додати wildcard у фінальну групу</label></div><div class="team-card"><h4>Фінальна група</h4><div class="tag">Команд: ${(state.schoolState?.finalGroup?.teamIds || []).length || 0}</div><ul>${finalRows || '<li>Ще не сформовано.</li>'}</ul><button class="chip" type="button" data-school-generate-final-matches="1" ${finalCanGenerate ? '' : 'disabled'}>Згенерувати фінальні матчі</button></div><div class="team-card"><h4>Фінальні матчі</h4>${finalMatchesHtml}</div><div class="team-card"><h4>Фінальний етап</h4><div class="tag">Зіграно: ${finalProgress.completed} / ${finalProgress.total || ((state.schoolState?.finalGroup?.teamIds || []).length === 5 ? 10 : 6)}</div><div class="tag">${finalProgress.total > 0 && finalProgress.completed === finalProgress.total ? 'Фінальний етап завершено. Чемпіон визначений.' : 'Чемпіон буде визначений після завершення всіх фінальних матчів.'}</div></div><div class="team-card"><h4>Фінальна таблиця</h4>${finalStandingsHtml}</div><div class="team-card"><h4>Чемпіон шкільного турніру</h4>${champion && finalProgress.total > 0 && finalProgress.completed === finalProgress.total ? `<div>${escapeHtml(schoolTeamDisplay(champion.teamId))}</div><div class="tag">TP ${champion.tournamentPoints} · W ${champion.wins} · Diff ${champion.pointsDiff} · PF ${champion.pointsFor}</div>` : '<div class="tag">Чемпіон буде визначений після завершення всіх фінальних матчів.</div>'}</div></div>`;
}

export function renderTeams() {
  const grid = document.getElementById('teamsGrid');
  if (!grid) return;

  const keys = state.app.eventMode === 'school' ? TEAM_KEYS.slice(0, 10) : TEAM_KEYS.slice(0, state.teamsState.teamCount);
  const map = new Map(state.playersState.players.map((p) => [getPlayerKey(p), p]));
  const cards = keys.map((key) => {
    const playerKeys = state.teamsState.teams[key] || [];
    const total = sumByNicks(playerKeys);
    const members = playerKeys.map((playerKey) => {
      const player = map.get(playerKey) || { nick: playerKey, points: 0, rank: '—' };
      return `<div class="team-player">${playerMetaHtml(player)}<button class="team-player-remove" type="button" data-role="remove-player-from-team" data-player-key="${escapeAttr(playerKey)}" data-team-id="${escapeAttr(key)}">Прибрати</button></div>`;
    }).join('') || '<div class="team-empty-state">Додай гравців із lobby</div>';
    const teamMeta = state.schoolState?.teamMeta?.[key] || {};
    const schoolFields = state.app.eventMode === 'school' ? `<div class="school-meta-grid">
      <input class="search-input" data-school-meta="${escapeAttr(key)}" data-school-meta-field="schoolName" placeholder="Назва школи" value="${escapeAttr(teamMeta.schoolName || '')}">
      <input class="search-input" data-school-meta="${escapeAttr(key)}" data-school-meta-field="schoolNumber" placeholder="Номер школи" value="${escapeAttr(teamMeta.schoolNumber || '')}">
      <input class="search-input" data-school-meta="${escapeAttr(key)}" data-school-meta-field="teamName" placeholder="Назва команди" value="${escapeAttr(teamMeta.teamName || `Команда ${key.replace('team', '')}`)}">
    </div>` : '';
    return `<div class="team-card"><h4>${teamNameControl(key)} <span class="tag">Σ ${total}</span></h4>${schoolFields}${members}</div>`;
  });

  grid.innerHTML = cards.join('');
  const preview = document.getElementById('schoolGroupsPreview');
  if (preview && state.app.eventMode === 'school') {
    const groupA = state.schoolState?.groups?.A?.teamIds || [];
    const groupB = state.schoolState?.groups?.B?.teamIds || [];
    preview.innerHTML = `<div class="tag">Група A: ${groupA.length} команд</div><div class="tag">Група B: ${groupB.length} команд</div><div class="tag">${groupA.length === 5 && groupB.length === 5 ? '✅ 5/5' : '⚠️ Очікується 5/5'}</div>`;
    preview.insertAdjacentHTML('beforeend', renderSchoolGroupMatches());
  }
}

export function renderMatchConfig() {
  const root = document.getElementById('activeMatchConfig');
  if (!root) return;
  const eventMode = ['regular', 'tournament', 'school'].includes(state.app.eventMode) ? state.app.eventMode : 'regular';
  const keys = getAvailableTeamKeys();
  const [teamA, teamB] = eventMode === 'tournament'
    ? [state.activeTeamAId || 'team1', state.activeTeamBId || 'team2']
    : getActiveMatchTeams();
  const teamOptions = (current, other, side) => keys.map((key) => `<option value="${escapeAttr(key)}" ${key === current ? 'selected' : ''} ${key === other ? 'disabled' : ''}>${escapeHtml(getTeamLabel(key))} (${escapeHtml(side)})</option>`).join('');

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
    ${eventMode !== 'tournament' ? regularContent : `
      <div class="tournament-panel">
        <div class="tag">Змішаний турнір завантажує гравців з дорослої та дитячої ліги.</div>
        <label>Назва турніру <input class="search-input" data-tournament-name type="text" value="${escapeAttr(state.tournamentState.tournamentName || '')}" placeholder="Весняний турнір"></label>
        <label>Режим бою
          <select class="chip" data-tournament-game-mode>
            ${['DM', 'TR', 'KT'].map((mode) => `<option value="${escapeAttr(mode)}" ${state.tournamentState.gameMode === mode ? 'selected' : ''}>${escapeHtml(mode)}</option>`).join('')}
          </select>
        </label>
        <div class="tournament-type-control">
          <strong>Тип турніру</strong>
          <div class="series-count-choices">
            <button class="chip ${state.tournamentState.tournamentType !== 'group' ? 'active' : ''}" type="button" data-tournament-type="custom">Кастомний турнір</button>
            <button class="chip ${state.tournamentState.tournamentType === 'group' ? 'active' : ''}" type="button" data-tournament-type="group">Груповий турнір</button>
          </div>
          <div class="section-hint">${state.tournamentState.tournamentType === 'group' ? 'Кожна команда грає з кожною за готовим календарем.' : 'Адміністратор сам обирає, які команди грають.'}</div>
        </div>
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
      ${renderTournamentSchedule()}
      <div class="match-pick-grid ${state.tournamentState.tournamentType === 'group' ? 'hidden' : ''}">
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

  const count = Math.min(MAX_SERIES_ROUNDS, Math.max(3, Number(state.matchState.seriesCount) || 3));
  const rounds = state.matchState.seriesRounds.slice(0, MAX_SERIES_ROUNDS);
  while (rounds.length < MAX_SERIES_ROUNDS) rounds.push(null);

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
  const participants = participantKeys
    .map((playerKey) => {
      const player = map.get(playerKey);
      const nick = String(player?.nick || playerKey || '').trim();
      if (!nick) return null;
      return {
        key: playerKey,
        nick,
        label: mvpOptionLabel(player, playerKey),
      };
    })
    .filter(Boolean);
  const dl = document.getElementById('participantsDatalist');
  if (dl) {
    let requireControl = document.getElementById('mvpRequireControl');
    if (!requireControl) {
      requireControl = document.createElement('label');
      requireControl.id = 'mvpRequireControl';
      requireControl.className = 'tag';
      requireControl.innerHTML = '<input type="checkbox" data-require-mvp="1"> MVP обов’язковий для збереження';
      dl.parentNode?.insertBefore(requireControl, dl);
    }
    const requireInput = requireControl.querySelector('input[data-require-mvp]');
    if (requireInput) requireInput.checked = state.requireMvp !== false;

    dl.innerHTML = participants
      .map((option) => `<option value="${escapeAttr(option.label)}" data-player-key="${escapeAttr(option.key)}" label="${escapeAttr(option.nick)}"></option>`)
      .join('');
    let warning = document.getElementById('mvpDuplicateWarning');
    if (!warning) {
      warning = document.createElement('div');
      warning.id = 'mvpDuplicateWarning';
      warning.className = 'mvp-warning tag hidden';
      dl.parentNode?.insertBefore(warning, dl.nextSibling);
    }
    const nickCounts = participants.reduce((acc, option) => acc.set(option.nick, (acc.get(option.nick) || 0) + 1), new Map());
    const hasDuplicateNick = state.app.eventMode === 'tournament'
      && state.app.playerSourceMode === 'mixed'
      && [...nickCounts.values()].some((count) => count > 1);
    warning.classList.toggle('hidden', !hasDuplicateNick);
    warning.textContent = hasDuplicateNick ? 'Є однакові ніки: оберіть MVP з позначкою ліги.' : '';
  }

  ['mvp1', 'mvp2', 'mvp3'].forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    const playerKey = state.matchState.match[getMvpKeyId(id)];
    const player = playerKey ? map.get(playerKey) : null;
    const value = player ? mvpOptionLabel(player, playerKey) : (state.matchState.match[id] || '');
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
    const teamCountSelect = e.target.closest('select[data-role="team-count-select"]');
    const requireMvp = e.target.closest('input[data-require-mvp]');
    if (matchMode) handlers.onMatchMode(matchMode);
    if (teamPick) handlers.onMatchTeamPick(teamPick.dataset.matchTeam, teamPick.value);
    if (schedulePick) handlers.onSchedulePick(schedulePick);
    if (eventMode) handlers.onEventMode(eventMode);
    if (tournamentTeamPick) handlers.onTournamentTeamPick(tournamentTeamPick.dataset.tournamentTeam, tournamentTeamPick.value);
    if (gameModePick) handlers.onTournamentGameMode(gameModePick.value);
    if (playerSourceModePick) handlers.onPlayerSourceMode(playerSourceModePick.value);
    if (assignPlayerTeam) handlers.onAssignPlayerTeam(assignPlayerTeam.dataset.playerKey, assignPlayerTeam.value);
    if (teamCountSelect) handlers.onTeamCount(Number(teamCountSelect.value));
    if (requireMvp) handlers.onRequireMvpChange(requireMvp.checked);
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
    const balanceMode = e.target.closest('[data-balance-mode]')?.dataset.balanceMode;
    const balancePrimaryBtn = e.target.closest('[data-role="balance-primary-action"]');
    const balancePrimary = balancePrimaryBtn?.dataset.balancePrimary;
    const eventMode = e.target.closest('[data-event-mode]')?.dataset.eventMode;
    const createTournament = e.target.closest('[data-tournament-create]');
    const saveTeams = e.target.closest('[data-tournament-save-teams]');
    const tournamentType = e.target.closest('[data-tournament-type]')?.dataset.tournamentType;
    const schedulePick = e.target.closest('[data-tournament-schedule-pick]')?.dataset.tournamentSchedulePick;
    const nextTournamentMatch = e.target.closest('[data-tournament-next-match]');
    const loadPlayers = e.target.closest('[data-load-players]') || e.target.closest('#loadPlayersBtn');
    const removeFromTeam = e.target.closest('[data-role="remove-player-from-team"]');
    const schoolBuildTeams = e.target.closest('[data-school-build-teams]');
    const schoolBuildGroups = e.target.closest('[data-school-build-groups]');
    const schoolGenerateGroupMatches = e.target.closest('[data-school-generate-group-matches]');
    const schoolCurrent = e.target.closest('[data-school-group-current]')?.dataset.schoolGroupCurrent;
    const schoolClear = e.target.closest('[data-school-group-clear]')?.dataset.schoolGroupClear;
    const schoolFormFinalGroup = e.target.closest('[data-school-form-final-group]');
    const schoolSuggestWildcard = e.target.closest('[data-school-suggest-wildcard]');
    const schoolGenerateFinalMatches = e.target.closest('[data-school-generate-final-matches]');
    const schoolFinalCurrent = e.target.closest('[data-school-final-current]')?.dataset.schoolFinalCurrent;
    const schoolFinalClear = e.target.closest('[data-school-final-clear]')?.dataset.schoolFinalClear;

    if (toggle) {
      if (typeof handlers.onTogglePlayer === 'function') {
        handlers.onTogglePlayer(toggle);
      } else {
        const alreadySelected = state.playersState.selectedMap.has(toggle);
        const maxPlayers = getMaxLobbyPlayersForEventMode(state.app.eventMode);
        if (alreadySelected) {
          state.playersState.selected = state.playersState.selected.filter((n) => n !== toggle);
          Object.keys(state.teamsState.teams).forEach((key) => {
            state.teamsState.teams[key] = state.teamsState.teams[key].filter((n) => n !== toggle);
          });
        } else if (state.playersState.selected.length >= maxPlayers) {
          window.alert(`Лобі заповнене. Максимум ${maxPlayers} гравців.`);
          return;
        } else {
          state.playersState.selected = [...state.playersState.selected, toggle];
        }
        syncSelectedMap();
        handlers.onChanged();
      }
    }
    if (remove) {
      if (typeof handlers.onRemove === 'function') handlers.onRemove(remove);
      else {
        state.playersState.selected = state.playersState.selected.filter((n) => n !== remove);
        Object.keys(state.teamsState.teams).forEach((key) => {
          state.teamsState.teams[key] = state.teamsState.teams[key].filter((n) => n !== remove);
        });
        syncSelectedMap();
        handlers.onChanged();
      }
    }
    if (moveBtn) {
      const playerKey = moveBtn.dataset.movePlayerKey || '';
      const team = moveBtn.dataset.moveTeam || '';
      movePlayerToTeam(playerKey, team === 'bench' ? '' : team);
      handlers.onChanged();
    }
    if (teamCount) {
      handlers.onTeamCount(sanitizeTeamCount(teamCount));
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
    if (balanceMode) handlers.onBalanceMode(balanceMode);
    if (balancePrimaryBtn) {
      e.preventDefault();
      e.stopPropagation();
      const mode = balancePrimary === 'manual' ? 'manual' : (balancePrimary === 'auto' ? 'auto' : (state.app.mode === 'manual' ? 'manual' : 'auto'));
      if (mode === 'manual') handlers.onManualBalance();
      else handlers.onAutoBalance();
      return;
    }
    if (eventMode) handlers.onEventMode(eventMode);
    if (tournamentType) handlers.onTournamentType(tournamentType);
    if (schedulePick) handlers.onTournamentSchedulePick(schedulePick);
    if (nextTournamentMatch) handlers.onTournamentNextMatch();
    if (loadPlayers) handlers.onLoadPlayers();
    if (createTournament) handlers.onCreateTournament();
    if (saveTeams) handlers.onSaveTournamentTeams();
    if (removeFromTeam) handlers.onRemovePlayerFromTeam(removeFromTeam.dataset.playerKey, removeFromTeam.dataset.teamId);
    if (schoolBuildTeams) handlers.onSchoolBuildTeams();
    if (schoolBuildGroups) handlers.onSchoolBuildGroups();
    if (schoolGenerateGroupMatches) handlers.onSchoolGenerateGroupMatches();
    if (schoolCurrent) handlers.onSchoolGroupMatchSetCurrent(schoolCurrent);
    if (schoolClear) handlers.onSchoolGroupMatchClearResult(schoolClear);
    if (schoolFormFinalGroup) handlers.onSchoolFormFinalGroup();
    if (schoolSuggestWildcard) handlers.onSchoolSuggestWildcard();
    if (schoolGenerateFinalMatches) handlers.onSchoolGenerateFinalMatches();
    if (schoolFinalCurrent) handlers.onSchoolFinalMatchSetCurrent(schoolFinalCurrent);
    if (schoolFinalClear) handlers.onSchoolFinalMatchClearResult(schoolFinalClear);
    const schoolExport = e.target.closest('[data-school-export-json]');
    if (schoolExport) handlers.onSchoolExportJson();
  });

  document.addEventListener('input', (e) => {
    const tournamentNameInput = e.target.closest('[data-tournament-name]');
    if (tournamentNameInput) handlers.onTournamentName(tournamentNameInput.value);
    const schoolTitle = e.target.closest('[data-school-title]');
    const schoolDate = e.target.closest('[data-school-date]');
    if (schoolTitle) handlers.onSchoolTitleChange(schoolTitle.value);
    if (schoolDate) handlers.onSchoolDateChange(schoolDate.value);
    const schoolMetaInput = e.target.closest('[data-school-meta]');
    if (schoolMetaInput) handlers.onSchoolMetaChange(schoolMetaInput.dataset.schoolMeta, schoolMetaInput.dataset.schoolMetaField, schoolMetaInput.value);
    const scoreA = e.target.closest('[data-school-group-score-a]');
    const scoreB = e.target.closest('[data-school-group-score-b]');
    if (scoreA || scoreB) {
      const matchId = scoreA?.dataset.schoolGroupScoreA || scoreB?.dataset.schoolGroupScoreB;
      const inputA = document.querySelector(`[data-school-group-score-a="${escapeAttr(matchId)}"]`);
      const inputB = document.querySelector(`[data-school-group-score-b="${escapeAttr(matchId)}"]`);
      handlers.onSchoolGroupMatchScoreChange(matchId, inputA?.value ?? '', inputB?.value ?? '');
    }
    const finalA = e.target.closest('[data-school-final-score-a]');
    const finalB = e.target.closest('[data-school-final-score-b]');
    if (finalA || finalB) {
      const matchId = finalA?.dataset.schoolFinalScoreA || finalB?.dataset.schoolFinalScoreB;
      const inputA = document.querySelector(`[data-school-final-score-a="${escapeAttr(matchId)}"]`);
      const inputB = document.querySelector(`[data-school-final-score-b="${escapeAttr(matchId)}"]`);
      handlers.onSchoolFinalMatchScoreChange(matchId, inputA?.value ?? '', inputB?.value ?? '');
    }
    const wildcardSelect = e.target.closest('[data-school-wildcard-select]');
    if (wildcardSelect) handlers.onSchoolWildcardSelect(wildcardSelect.value);
    const wildcardToggle = e.target.closest('[data-school-wildcard-enabled]');
    if (wildcardToggle) handlers.onSchoolWildcardToggle(Boolean(wildcardToggle.checked));
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
