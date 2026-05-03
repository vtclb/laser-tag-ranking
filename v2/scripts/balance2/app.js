import {
  state,
  normalizeLeague,
  normalizePlayerSourceMode,
  getSelectedPlayers,
  computeSeriesSummary,
  syncSelectedMap,
  rankLetterForPoints,
  sortByPointsDesc,
  getPlayerKey,
  getAvailableTeamKeys,
  getActiveMatchTeams,
  getTeamLabel,
  MAX_LOBBY_PLAYERS,
  TEAM_KEYS,
  ensureTeamsForManualAssignment,
  assignPlayerToTeam,
  removePlayerFromTeam,
  removePlayerFromAllTeams,
  resolvePlayerByKey,
} from './state.js';
import { autoBalance2, balanceIntoNTeams } from './balance.js';
import { syncSelectedFromTeamsAndBench } from './manual.js';
import { render, bindUiEvents, setTournamentStatus, clearTournamentStatus } from './ui.js';
import { loadPlayersForSource, saveMatch, createTournament, saveTournamentTeams, saveTournamentGame } from './api.js';
import { saveLobby, restoreLobby, peekLobbyRestore, clearPlayersCache, saveLastSavedGame, readLastSavedGame } from './storage.js';
import { setStatus, lockSaveButton } from './status.js';
import { debugLog } from '../../core/debug.js';

const $ = (id) => document.getElementById(id);
const LEAGUE_KEY = 'balance2:league';
const MVP_IDS = ['mvp1', 'mvp2', 'mvp3'];
const MIXED_MVP_DUPLICATE_WARNING = 'Уточни MVP: є кілька гравців з таким ніком у різних лігах';
const MIXED_MVP_SAVE_BLOCK = 'Уточни MVP: вибери гравця зі списку';
let saveLocked = false;
let saveStatusResetTimer = 0;

function escapeAttr(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setTournamentRequestMeta({ action = '', requestStatus = '', error = '' } = {}) {
  state.tournamentState.lastAction = action;
  state.tournamentState.lastRequestStatus = requestStatus;
  state.tournamentState.lastErrorMessage = error;
}

function ensureSaveStatusState() {
  if (!['idle', 'saving', 'success', 'error'].includes(state.saveStatus)) state.saveStatus = 'idle';
  if (typeof state.saveMessage !== 'string') state.saveMessage = '';
}

function setSaveFeedback(saveStatus = 'idle', saveMessage = '', { renderNow = true } = {}) {
  ensureSaveStatusState();
  state.saveStatus = ['idle', 'saving', 'success', 'error'].includes(saveStatus) ? saveStatus : 'idle';
  state.saveMessage = String(saveMessage || '');

  if (saveStatusResetTimer) {
    window.clearTimeout(saveStatusResetTimer);
    saveStatusResetTimer = 0;
  }

  if (state.saveStatus === 'success' || state.saveStatus === 'error') {
    saveStatusResetTimer = window.setTimeout(() => {
      state.saveStatus = 'idle';
      state.saveMessage = '';
      saveStatusResetTimer = 0;
      renderAndSync();
    }, 4000);
  }

  if (renderNow) renderAndSync();
}

function normalizeEventAndSourceState(nextEventMode = state.app.eventMode, nextSourceMode = state.app.playerSourceMode) {
  const eventMode = nextEventMode === 'tournament' ? 'tournament' : 'regular';
  let playerSourceMode = normalizePlayerSourceMode(nextSourceMode, eventMode);
  if (eventMode === 'regular' && playerSourceMode === 'mixed') {
    playerSourceMode = 'sundaygames';
  }
  if (eventMode === 'tournament' && !['sundaygames', 'kids', 'mixed'].includes(playerSourceMode)) {
    playerSourceMode = 'sundaygames';
  }
  state.app.eventMode = eventMode;
  state.app.playerSourceMode = playerSourceMode;
  state.app.league = normalizeLeague(playerSourceMode);
}

function setTournamentDirty(message = 'Команди змінено — збережи їх повторно перед матчем') {
  if (state.app.eventMode !== 'tournament') return;
  state.tournamentState.teamsSaved = false;
  state.tournamentState.savedTournamentTeamIds = [];
  setTournamentStatus(message, 'warning');
}

function generateRoundRobinSchedule(teamIds = []) {
  const teams = teamIds.filter((teamId) => TEAM_KEYS.includes(teamId));
  const schedule = [];
  let gameNumber = 1;
  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      schedule.push({
        gameId: `G${String(gameNumber).padStart(3, '0')}`,
        teamAId: teams[i],
        teamBId: teams[j],
        status: gameNumber === 1 ? 'current' : 'pending',
      });
      gameNumber += 1;
    }
  }
  return schedule;
}

function getCurrentGroupMatch() {
  if (state.tournamentState.tournamentType !== 'group') return null;
  const schedule = Array.isArray(state.tournamentState.tournamentSchedule) ? state.tournamentState.tournamentSchedule : [];
  return schedule.find((match) => match.gameId === state.tournamentState.currentScheduleGameId)
    || schedule.find((match) => match.status === 'current')
    || null;
}

function syncCurrentGroupMatch() {
  const match = getCurrentGroupMatch();
  if (!match) return;
  state.tournamentState.currentScheduleGameId = match.gameId;
  state.tournamentState.currentGameId = match.gameId;
  state.activeTeamAId = match.teamAId;
  state.activeTeamBId = match.teamBId;
}

function refreshGroupSchedule({ force = false } = {}) {
  if (state.app.eventMode !== 'tournament' || state.tournamentState.tournamentType !== 'group') return;
  const teamIds = TEAM_KEYS
    .slice(0, state.teamsState.teamCount)
    .filter((teamId) => (state.teamsState.teams[teamId] || []).length > 0);
  if (teamIds.length < 2) {
    state.tournamentState.tournamentSchedule = [];
    state.tournamentState.currentScheduleGameId = '';
    state.tournamentState.currentGameId = '';
    return;
  }
  if (force || !Array.isArray(state.tournamentState.tournamentSchedule) || state.tournamentState.tournamentSchedule.length === 0) {
    state.tournamentState.tournamentSchedule = generateRoundRobinSchedule(teamIds);
    state.tournamentState.currentScheduleGameId = state.tournamentState.tournamentSchedule[0]?.gameId || '';
  }
  syncCurrentGroupMatch();
}

function selectGroupScheduleMatch(gameId) {
  const schedule = Array.isArray(state.tournamentState.tournamentSchedule) ? state.tournamentState.tournamentSchedule : [];
  const target = schedule.find((match) => match.gameId === gameId);
  if (!target || target.status === 'done') return false;
  schedule.forEach((match) => {
    if (match.status !== 'done') match.status = match.gameId === gameId ? 'current' : 'pending';
  });
  state.tournamentState.currentScheduleGameId = target.gameId;
  syncCurrentGroupMatch();
  resetMatchOnlyState();
  syncSeriesMirror();
  return true;
}

function advanceGroupScheduleAfterSave() {
  const schedule = Array.isArray(state.tournamentState.tournamentSchedule) ? state.tournamentState.tournamentSchedule : [];
  const currentId = state.tournamentState.currentScheduleGameId;
  const current = schedule.find((match) => match.gameId === currentId) || schedule.find((match) => match.status === 'current');
  if (current) current.status = 'done';
  const next = schedule.find((match) => match.status === 'pending');
  if (!next) {
    state.tournamentState.currentScheduleGameId = '';
    state.tournamentState.currentGameId = '';
    setTournamentStatus('Усі матчі групового турніру зіграно', 'success');
    return false;
  }
  next.status = 'current';
  state.tournamentState.currentScheduleGameId = next.gameId;
  syncCurrentGroupMatch();
  resetMatchOnlyState();
  syncSeriesMirror();
  return true;
}

function finishTournamentSaving() {
  state.tournamentState.isSaving = false;
  saveLocked = false;
  lockSaveButton(false);
  syncSaveButtonState();
  renderAndSync();
}

function normalizeLoadedPlayers(players = []) {
  return players
    .map((player) => {
      const nick = String(player.nick || player.nickname || '').trim();
      if (!nick) return null;
      const points = Number(player.points ?? player.pts) || 0;
      return {
        ...player,
        nick,
        points,
        pts: points,
        rank: String(player.rank || rankLetterForPoints(points)),
      };
    })
    .filter(Boolean)
    .sort(sortByPointsDesc);
}

function getPlayersByKeyMap() {
  return new Map(state.playersState.players.map((player) => [getPlayerKey(player), player]));
}

function getMvpKeyId(id) {
  return `${id}Key`;
}

function getMvpLabel(player, playerKey = getPlayerKey(player)) {
  const nick = String(player?.nick || playerKey || '').trim();
  const leagueLabel = String(player?.sourceLeagueLabel || '').trim();
  return leagueLabel && state.app.eventMode === 'tournament' && state.app.playerSourceMode === 'mixed'
    ? `${nick} · ${leagueLabel}`
    : nick;
}

function getActiveMvpOptions() {
  const playerKeys = state.app.eventMode === 'tournament'
    ? [...new Set([...(state.teamsState.teams[state.activeTeamAId] || []), ...(state.teamsState.teams[state.activeTeamBId] || [])])]
    : [...new Set(getParticipants())];
  const playersMap = getPlayersByKeyMap();
  return playerKeys
    .map((playerKey) => {
      const player = playersMap.get(playerKey);
      const nick = String(player?.nick || playerKey || '').trim();
      if (!nick) return null;
      return { key: playerKey, nick, label: getMvpLabel(player, playerKey) };
    })
    .filter(Boolean);
}

function resolveMvpNick(id) {
  if (state.app.eventMode !== 'tournament') return state.matchState.match[id] || '';
  const playerKey = state.matchState.match[getMvpKeyId(id)];
  const player = playerKey ? resolvePlayerByKey(playerKey) : null;
  return player?.nick || state.matchState.match[id] || '';
}

function hasSelectedMvp() {
  return MVP_IDS.some((id) => state.matchState.match[getMvpKeyId(id)] || state.matchState.match[id]);
}

function syncRequireMvpAfterMvpInput() {
  if (hasSelectedMvp()) state.requireMvp = true;
}

function isMixedTournamentMode() {
  return state.app.eventMode === 'tournament' && state.app.playerSourceMode === 'mixed';
}

function resolveMvpInputValue(value) {
  const options = getActiveMvpOptions();
  const selectedByLabelOrKey = options.find((option) => option.label === value || option.key === value);
  if (selectedByLabelOrKey) return { selected: selectedByLabelOrKey, ambiguous: false };

  const nickMatches = options.filter((option) => option.nick === value);
  if (nickMatches.length === 1) return { selected: nickMatches[0], ambiguous: false };
  return { selected: null, ambiguous: nickMatches.length > 1 };
}

function hasAmbiguousMixedMvp() {
  if (!isMixedTournamentMode()) return false;
  const options = getActiveMvpOptions();
  return MVP_IDS.some((id) => {
    const nick = String(state.matchState.match[id] || '').trim();
    const playerKey = state.matchState.match[getMvpKeyId(id)];
    if (!nick || playerKey) return false;
    return options.filter((option) => option.nick === nick).length > 1;
  });
}

const saveReadinessMessages = new Set(['Додайте гравців', 'Сформуйте команди', 'Вкажіть результат', 'Оберіть MVP', 'Спочатку створи турнір', 'Спочатку збережи команди турніру', MIXED_MVP_DUPLICATE_WARNING, MIXED_MVP_SAVE_BLOCK]);

function getSaveReadinessMessage() {
  const [teamA, teamB] = state.app.eventMode === 'tournament'
    ? [state.activeTeamAId, state.activeTeamBId]
    : getActiveMatchTeams();
  if (!state.playersState.selected.length) return 'Додайте гравців';
  if (!state.teamsState.teams[teamA]?.length || !state.teamsState.teams[teamB]?.length) return 'Сформуйте команди';
  if (state.app.eventMode === 'tournament' && !state.tournamentState.tournamentId) return 'Спочатку створи турнір';
  if (state.app.eventMode === 'tournament' && !state.tournamentState.teamsSaved) return 'Спочатку збережи команди турніру';
  if (computeSeriesSummary().played < 3) return 'Вкажіть результат';
  if (hasAmbiguousMixedMvp()) return MIXED_MVP_SAVE_BLOCK;
  if (state.requireMvp !== false && !hasSelectedMvp()) return 'Оберіть MVP';
  return '';
}

function buildRoundRobinSchedule() {
  const keys = getAvailableTeamKeys();
  if (keys.length < 3) return [];
  const schedule = [];
  let idx = 1;
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      const teamA = keys[i];
      const teamB = keys[j];
      schedule.push({
        id: `${teamA}-${teamB}`,
        teamA,
        teamB,
        label: `${getTeamLabel(teamA)} vs ${getTeamLabel(teamB)}`,
        played: false,
        lastSavedAt: '',
        resultSummary: '',
        order: idx,
      });
      idx += 1;
    }
  }
  return schedule;
}

function ensureActiveMatchState() {
  const keys = getAvailableTeamKeys();
  if (keys.length <= 2) {
    state.activeMatch.mode = 'manual';
    state.activeMatch.teamA = 'team1';
    state.activeMatch.teamB = 'team2';
    state.activeMatch.schedule = [];
    state.activeMatch.selectedScheduleMatchId = '';
    return;
  }

  if (!['manual', 'schedule'].includes(state.activeMatch.mode)) state.activeMatch.mode = 'manual';
  if (!Array.isArray(state.activeMatch.schedule) || state.activeMatch.schedule.length === 0) {
    state.activeMatch.schedule = buildRoundRobinSchedule();
  } else {
    const existing = new Map(state.activeMatch.schedule.map((m) => [`${m.teamA}-${m.teamB}`, m]));
    state.activeMatch.schedule = buildRoundRobinSchedule().map((next) => {
      const prev = existing.get(`${next.teamA}-${next.teamB}`);
      return prev ? { ...next, played: !!prev.played, lastSavedAt: prev.lastSavedAt || '', resultSummary: prev.resultSummary || '' } : next;
    });
  }

  const validIds = new Set(state.activeMatch.schedule.map((item) => item.id));
  if (!validIds.has(state.activeMatch.selectedScheduleMatchId)) {
    state.activeMatch.selectedScheduleMatchId = state.activeMatch.schedule[0]?.id || '';
  }

  const [a, b] = getActiveMatchTeams();
  state.activeMatch.teamA = a;
  state.activeMatch.teamB = b;

  if (state.activeMatch.mode === 'schedule') {
    const selected = state.activeMatch.schedule.find((item) => item.id === state.activeMatch.selectedScheduleMatchId);
    if (selected) {
      state.activeMatch.teamA = selected.teamA;
      state.activeMatch.teamB = selected.teamB;
    }
  }
}

function syncSeriesMirror() {
  const rounds = Array.isArray(state.matchState.seriesRounds) ? state.matchState.seriesRounds.slice(0, 7) : Array(7).fill(null);
  while (rounds.length < 7) rounds.push(null);
  state.matchState.seriesRounds = rounds;
  state.matchState.series = rounds.map((value) => (value === null ? '-' : String(value)));
}

function setTeamCount(rawValue) {
  const previousCount = state.teamsState.teamCount;
  const hadTeams = TEAM_KEYS.some((key) => (state.teamsState.teams[key] || []).length > 0);
  ensureTeamsForManualAssignment(rawValue);
  const changed = previousCount !== state.teamsState.teamCount;
  if (changed && hadTeams) clearAllTeams();
  state.matchState.seriesRounds = state.matchState.seriesRounds.map((value) => {
    const numeric = Number(value);
    if (value === null) return null;
    if (numeric === 0 || numeric === 1 || numeric === 2) return numeric;
    return null;
  });
  ensureActiveMatchState();
  if (state.teamsState.teamCount === 2) {
    state.activeTeamAId = 'team1';
    state.activeTeamBId = 'team2';
  }
  syncSeriesMirror();
  if (changed) {
    state.tournamentState.teamsSaved = false;
    state.tournamentState.savedTournamentTeamIds = [];
    state.tournamentState.tournamentSchedule = [];
    state.tournamentState.currentScheduleGameId = '';
    state.tournamentState.currentGameId = '';
    setStatus({ state: 'error', text: 'Кількість команд змінено — сформуй команди повторно', retryVisible: false });
    setTournamentDirty('Кількість команд змінено — сформуй команди повторно');
  }
}

function clearAllTeams() {
  TEAM_KEYS.forEach((key) => { state.teamsState.teams[key] = []; });
}

function runBalance() {
  const selected = getSelectedPlayers();
  clearAllTeams();
  if (state.teamsState.teamCount === 2) {
    const teams = autoBalance2(selected);
    state.teamsState.teams.team1 = teams.team1.map((p) => getPlayerKey(p));
    state.teamsState.teams.team2 = teams.team2.map((p) => getPlayerKey(p));
  } else {
    const teams = balanceIntoNTeams(selected, state.teamsState.teamCount);
    TEAM_KEYS.forEach((key) => {
      state.teamsState.teams[key] = (teams[key] || []).map((p) => getPlayerKey(p));
    });
  }
  state.app.mode = 'auto';
  setTournamentDirty();
  ensureActiveMatchState();
  if (state.teamsState.teamCount === 2) {
    state.activeTeamAId = 'team1';
    state.activeTeamBId = 'team2';
  }
  refreshGroupSchedule({ force: true });
  saveLobby();
}

function toPenaltiesString() {
  return Object.entries(state.matchState.match.penalties)
    .filter(([, value]) => Number(value))
    .map(([nick, value]) => `${nick}:${value}`)
    .join(',');
}

function syncSaveButtonState() {
  const btn = $('saveBtn');
  if (!btn) return;
  const readinessMessage = getSaveReadinessMessage();
  state.saveReadinessMessage = readinessMessage;
  const canSave = !readinessMessage;
  btn.disabled = saveLocked || state.tournamentState.isSaving || !canSave;
  if (!saveLocked && !state.tournamentState.isSaving) {
    if (readinessMessage && (state.saveStatus === 'idle' || saveReadinessMessages.has(state.saveMessage))) {
      state.saveStatus = 'error';
      state.saveMessage = readinessMessage;
    } else if (!readinessMessage && state.saveStatus === 'error' && saveReadinessMessages.has(state.saveMessage)) {
      state.saveStatus = 'idle';
      state.saveMessage = '';
    }
  }
}

function renderAndSync() {
  ensureSaveStatusState();
  ensureActiveMatchState();
  refreshGroupSchedule();
  const available = getAvailableTeamKeys();
  const fallbackA = available[0] || 'team1';
  const fallbackB = available.find((key) => key !== fallbackA) || 'team2';
  if (!available.includes(state.activeTeamAId)) state.activeTeamAId = fallbackA;
  if (!available.includes(state.activeTeamBId) || state.activeTeamBId === state.activeTeamAId) state.activeTeamBId = fallbackB;
  cleanupTournamentMvp();
  syncSaveButtonState();
  render();
  syncSaveButtonState();
}

function buildPayload() {
  const summary = computeSeriesSummary();
  state.matchState.match.series = summary.series;
  state.matchState.match.winner = summary.winner;
  const [teamA, teamB] = getActiveMatchTeams();

  const playersMap = getPlayersByKeyMap();
  const toNick = (playerKey) => playersMap.get(playerKey)?.nick || playerKey;
  return {
    league: normalizeLeague(state.app.league),
    team1: state.teamsState.teams[teamA].map(toNick).join(', '),
    team2: state.teamsState.teams[teamB].map(toNick).join(', '),
    team3: '',
    team4: '',
    winner: summary.winner,
    mvp1: state.matchState.match.mvp1,
    mvp2: state.matchState.match.mvp2,
    mvp3: state.matchState.match.mvp3,
    penalties: toPenaltiesString(),
    series: summary.series,
  };
}

function buildTournamentTeamsPayload() {
  const playersMap = getPlayersByKeyMap();
  return TEAM_KEYS
    .slice(0, state.teamsState.teamCount)
    .filter((teamId) => (state.teamsState.teams[teamId] || []).length > 0)
    .map((teamId) => ({
      teamId,
      teamName: state.teamsState.teamNames[teamId] || `Команда ${teamId.replace('team', '')}`,
      players: [...new Set((state.teamsState.teams[teamId] || [])
        .map((playerKey) => String(playersMap.get(playerKey)?.nick || playerKey || '').trim())
        .filter(Boolean))],
    }));
}

function buildTournamentGamePayload() {
  const gameNumber = Number(state.tournamentState.nextGameNumber) || 1;
  const groupMatch = getCurrentGroupMatch();
  const gameId = groupMatch?.gameId || state.tournamentState.currentGameId || `G${String(gameNumber).padStart(3, '0')}`;
  const result = mapTournamentResult();
  return {
    tournamentId: state.tournamentState.tournamentId,
    gameId,
    gameMode: state.tournamentState.gameMode,
    teamAId: state.activeTeamAId,
    teamBId: state.activeTeamBId,
    result,
    mvp1: resolveMvpNick('mvp1'),
    mvp2: resolveMvpNick('mvp2'),
    mvp3: resolveMvpNick('mvp3'),
    notes: toPenaltiesString(),
  };
}

function mapTournamentResult() {
  const summary = computeSeriesSummary();
  if (summary.played < 1) return '';
  if (summary.winner === 'tie') return 'DRAW';
  if (summary.winner === 'team1') return 'A';
  if (summary.winner === 'team2') return 'B';
  return '';
}

function resetMatchOnlyState() {
  state.matchState.seriesRounds = Array(7).fill(null);
  state.matchState.series = ['-', '-', '-', '-', '-', '-', '-'];
  state.matchState.match.winner = '';
  state.matchState.match.series = '';
  MVP_IDS.forEach((id) => {
    state.matchState.match[id] = '';
    state.matchState.match[getMvpKeyId(id)] = '';
  });
  state.matchState.match.penalties = {};
}

function validateSave() {
  const selectedCount = state.playersState.selected.length;
  if (!selectedCount) return 'Додайте гравців';

  if (state.app.eventMode === 'tournament') {
    if (!state.tournamentState.tournamentId) return 'Спочатку створи турнір';
    if (!state.tournamentState.teamsSaved) return 'Спочатку збережи команди турніру';
    if (state.tournamentState.tournamentType === 'group') {
      const currentMatch = getCurrentGroupMatch();
      if (!currentMatch) return 'Обери матч із календаря турніру';
      if (state.activeTeamAId !== currentMatch.teamAId || state.activeTeamBId !== currentMatch.teamBId) return 'Обери матч із календаря турніру';
    }
    if (!state.activeTeamAId || !state.activeTeamBId) return 'Обери дві команди матчу';
    if (state.activeTeamAId === state.activeTeamBId) return 'Обери дві різні команди матчу';
    if (!state.tournamentState.savedTournamentTeamIds.includes(state.activeTeamAId) || !state.tournamentState.savedTournamentTeamIds.includes(state.activeTeamBId)) return 'Обрані активні команди не збережені в турнірі';
    const teamAPlayers = state.teamsState.teams[state.activeTeamAId] || [];
    const teamBPlayers = state.teamsState.teams[state.activeTeamBId] || [];
    if (!teamAPlayers.length || !teamBPlayers.length) return 'Сформуйте команди';
    if (!['DM', 'TR', 'KT'].includes(state.tournamentState.gameMode)) return 'Невірний режим матчу';
    const mappedResult = mapTournamentResult();
    if (!mappedResult) return 'Вкажи результат матчу';
    if (!['A', 'B', 'DRAW'].includes(mappedResult)) return 'Вкажи коректний результат матчу';
    if (state.tournamentState.gameMode === 'KT' && mappedResult === 'DRAW') return 'Для KT нічия недоступна';
    const allowed = new Set([...teamAPlayers, ...teamBPlayers]);
    const playersMap = getPlayersByKeyMap();
    const allowedNicks = new Set([...allowed].map((playerKey) => playersMap.get(playerKey)?.nick || playerKey));
    if (hasAmbiguousMixedMvp()) return MIXED_MVP_SAVE_BLOCK;
    for (const id of MVP_IDS) {
      const playerKey = state.matchState.match[getMvpKeyId(id)];
      if (playerKey && !allowed.has(playerKey)) return 'MVP має бути гравцем активних команд';
      const nick = state.matchState.match[id];
      if (nick && !allowedNicks.has(nick)) return 'MVP має бути гравцем активних команд';
    }
  }
  const [teamA, teamB] = state.app.eventMode === 'tournament'
    ? [state.activeTeamAId, state.activeTeamBId]
    : getActiveMatchTeams();
  if (!state.teamsState.teams[teamA]?.length || !state.teamsState.teams[teamB]?.length) return 'Сформуйте команди';
  if (state.requireMvp !== false && !hasSelectedMvp()) return 'Оберіть MVP';
  if (state.app.eventMode !== 'tournament' && computeSeriesSummary().played < 3) return 'Потрібно мінімум 3 зіграні бої';
  return '';
}

function createLastSavedSnapshot() {
  const summary = computeSeriesSummary();
  const [teamA, teamB] = getActiveMatchTeams();
  return {
    savedAt: new Date().toISOString(),
    league: state.app.league,
    teamA: getTeamLabel(teamA),
    teamB: getTeamLabel(teamB),
    summary: `${summary.wins.team1}-${summary.wins.team2}`,
    mvp: resolveMvpNick('mvp1') || resolveMvpNick('mvp2') || resolveMvpNick('mvp3') || '—',
    penalties: Object.values(state.matchState.match.penalties || {}).reduce((acc, value) => acc + (Number(value) || 0), 0),
  };
}

function markScheduledMatchPlayed(resultSummary) {
  if (state.activeMatch.mode !== 'schedule') return;
  const id = state.activeMatch.selectedScheduleMatchId;
  if (!id) return;
  const match = state.activeMatch.schedule.find((item) => item.id === id);
  if (!match) return;
  match.played = true;
  match.lastSavedAt = new Date().toISOString();
  match.resultSummary = resultSummary;
}

async function doSave(retry = false) {
  const eventMode = state.app?.eventMode === 'tournament' ? 'tournament' : 'regular';
  debugLog('[balance2:save] mode', eventMode);
  const error = validateSave();
  if (error) {
    setSaveFeedback('error', error, { renderNow: false });
    if (eventMode === 'tournament') {
      debugLog(`[balance2:tournament] validation failed ${error}`);
      setTournamentStatus(error, 'error');
      setTournamentRequestMeta({ action: 'saveGame', requestStatus: 'ERR', error });
      renderAndSync();
    }
    setStatus({ state: 'error', text: `❌ Помилка: ${error}`, retryVisible: false });
    renderAndSync();
    return;
  }

  if (eventMode === 'tournament') {
    await handleSaveTournamentGame(retry);
    return;
  }

  await handleSaveRegularGame(retry);
}

async function handleSaveTournamentGame(retry = false) {
  const payload = retry ? state.meta.lastPayload : buildTournamentGamePayload();
  state.meta.lastPayload = payload;
  debugLog('[balance2:tournament] save payload', payload);

  saveLocked = true;
  state.tournamentState.isSaving = true;
  lockSaveButton(true);
  syncSaveButtonState();
  setSaveFeedback('saving', 'Зберігаємо...', { renderNow: false });
  setStatus({ state: 'saving', text: 'Зберігаю турнірний матч...', retryVisible: false });
  setTournamentStatus(`Зберігаю матч ${payload.gameId}...`, 'loading');
  setTournamentRequestMeta({ action: 'saveGame', requestStatus: 'PENDING', error: '' });
  renderAndSync();

  let res;
  try {
    res = await saveTournamentGame(payload);
  } catch (saveError) {
    const message = saveError?.message || 'Не вдалося зберегти гру';
    setSaveFeedback('error', message, { renderNow: false });
    setTournamentStatus(`Не вдалося зберегти матч: ${message}`, 'error');
    setTournamentRequestMeta({ action: 'saveGame', requestStatus: 'ERR', error: message });
    setStatus({ state: 'error', text: `Не вдалося зберегти турнірний матч: ${message}`, retryVisible: true });
    finishTournamentSaving();
    return;
  }

  if (res.ok) {
    const snapshot = createLastSavedSnapshot();
    state.lastSavedGame = snapshot;
    saveLastSavedGame(snapshot);
    state.tournamentState.nextGameNumber += 1;
    if (state.tournamentState.tournamentType === 'group') {
      const hasNext = advanceGroupScheduleAfterSave();
      if (hasNext) setTournamentStatus(`Матч ${payload.gameId} збережено. Наступна гра: ${state.tournamentState.currentScheduleGameId}`, 'success');
    } else {
      state.tournamentState.currentGameId = '';
      resetMatchOnlyState();
      syncSeriesMirror();
    }
    saveLobby();
    debugLog('[balance2:tournament] saved without regular rating update', res);
    setSaveFeedback('success', 'Турнір збережено', { renderNow: false });
    setStatus({ state: 'saved', text: `Турнірний матч ${payload.gameId} збережено. Основний рейтинг не змінювався.`, retryVisible: false });
    if (state.tournamentState.tournamentType !== 'group') setTournamentStatus(`Матч ${payload.gameId} збережено`, 'success');
    setTournamentRequestMeta({ action: 'saveGame', requestStatus: 'OK', error: '' });
    finishTournamentSaving();
    return;
  }

  const message = res.message || 'Не вдалося зберегти гру';
  setSaveFeedback('error', message, { renderNow: false });
  setTournamentStatus(`Не вдалося зберегти матч: ${message}`, 'error');
  setTournamentRequestMeta({ action: 'saveGame', requestStatus: 'ERR', error: message });
  setStatus({ state: 'error', text: `Не вдалося зберегти турнірний матч: ${message}`, retryVisible: true });
  finishTournamentSaving();
}

async function handleSaveRegularGame(retry = false) {
  if (state.app?.eventMode === 'tournament') {
    const message = 'Tournament mode cannot use regular save flow';
    debugLog(`[balance2:regular] guard blocked save: ${message}`);
    setSaveFeedback('error', 'Не вдалося зберегти гру', { renderNow: false });
    setStatus({ state: 'error', text: `❌ ${message}`, retryVisible: false });
    renderAndSync();
    return;
  }

  const payload = retry ? state.meta.lastPayload : buildPayload();
  state.meta.lastPayload = payload;
  debugLog('[balance2:regular] save payload', payload);

  saveLocked = true;
  lockSaveButton(true);
  syncSaveButtonState();
  setSaveFeedback('saving', 'Зберігаємо...', { renderNow: false });
  setStatus({ state: 'saving', text: 'Зберігаю…', retryVisible: false });

  let res;
  try {
    res = await saveMatch(payload, 20000);
  } catch (saveError) {
    const message = saveError?.message || 'Не вдалося зберегти гру';
    setSaveFeedback('error', message, { renderNow: false });
    setStatus({ state: 'error', text: `❌ ${message}`, retryVisible: true });
    saveLocked = false;
    lockSaveButton(false);
    syncSaveButtonState();
    renderAndSync();
    return;
  }

  if (res.ok) {
    try {
      clearPlayersCache(normalizeLeague(state.app.league));
      const freshPlayers = await loadPlayersForSource(state.app.playerSourceMode, { force: true, timeoutMs: 15000 });
      state.playersState.players = normalizeLoadedPlayers(freshPlayers.players || []);

      const snapshot = createLastSavedSnapshot();
      state.lastSavedGame = snapshot;
      saveLastSavedGame(snapshot);
      markScheduledMatchPlayed(snapshot.summary);

      resetMatchOnlyState();
      syncSeriesMirror();
      saveLobby();
      setSaveFeedback('success', 'Гру збережено', { renderNow: false });
      setStatus({ state: 'saved', text: 'Рейтинговий матч збережено. Рейтинг оновлено.', retryVisible: false });
      renderAndSync();
    } catch (loadError) {
      const message = loadError?.message || 'Не вдалося зберегти гру';
      setSaveFeedback('error', message, { renderNow: false });
      setStatus({ state: 'error', text: `❌ Не вдалося отримати відповідь від сервера: ${message}`, retryVisible: true });
    }
  } else {
    const message = res.message || 'Не вдалося зберегти гру';
    setSaveFeedback('error', message, { renderNow: false });
    setStatus({ state: 'error', text: `❌ ${message}`, retryVisible: true });
  }

  saveLocked = false;
  lockSaveButton(false);
  syncSaveButtonState();
}

function toggleSelectedPlayer(nick) {
  if (state.playersState.selectedMap.has(nick)) {
    state.playersState.selected = state.playersState.selected.filter((n) => n !== nick);
    removePlayerFromAllTeams(nick);
  } else if (state.playersState.selected.length < MAX_LOBBY_PLAYERS) {
    state.playersState.selected = [...state.playersState.selected, nick];
  }
  syncSelectedMap();
  setTournamentDirty();
  ensureActiveMatchState();
}

function startRenameTeam(teamKey) {
  const wrap = document.querySelector(`[data-team-name-wrap="${teamKey}"]`);
  if (!wrap) return;
  const current = state.teamsState.teamNames[teamKey] || '';
  wrap.innerHTML = `<input class="search-input" data-team-name-input="${escapeAttr(teamKey)}" value="${escapeAttr(current)}" maxlength="32" />`;
  const input = wrap.querySelector('input');
  input?.focus();
  input?.select();
}

function saveTeamName(teamKey, rawValue) {
  if (!state.teamsState.teamNames[teamKey]) return;
  const value = String(rawValue || '').trim();
  state.teamsState.teamNames[teamKey] = value || `Команда ${teamKey.replace('team', '')}`;
  ensureActiveMatchState();
  setTournamentDirty();
  saveLobby();
  renderAndSync();
}

function cleanupTournamentMvp() {
  const allowed = new Set([...(state.teamsState.teams[state.activeTeamAId] || []), ...(state.teamsState.teams[state.activeTeamBId] || [])]);
  const playersMap = getPlayersByKeyMap();
  const allowedNicks = new Set([...allowed].map((playerKey) => playersMap.get(playerKey)?.nick || playerKey));
  MVP_IDS.forEach((id) => {
    const keyId = getMvpKeyId(id);
    const playerKey = state.matchState.match[keyId];
    if (playerKey && !allowed.has(playerKey)) {
      state.matchState.match[id] = '';
      state.matchState.match[keyId] = '';
      return;
    }
    if (!playerKey && state.matchState.match[id] && !allowedNicks.has(state.matchState.match[id])) state.matchState.match[id] = '';
  });
}

function onPlayerSourceChanged(nextMode, { warnOnLobby = false } = {}) {
  const sourceMode = normalizePlayerSourceMode(nextMode, state.app.eventMode);
  const changed = sourceMode !== state.app.playerSourceMode;
  normalizeEventAndSourceState(state.app.eventMode, sourceMode);
  localStorage.setItem(LEAGUE_KEY, state.app.playerSourceMode);
  if (!changed) return;

  state.playersState.players = [];
  state.playersState.playersLoaded = false;
  state.tournamentState.teamsSaved = false;
  state.tournamentState.savedTournamentTeamIds = [];
  if (warnOnLobby && state.playersState.selected.length > 0) {
    setTournamentStatus('Джерело змінено — перевір lobby перед балансуванням.', 'warning');
  }
}

async function ensurePlayersLoaded({ force = false } = {}) {
  const btn = $('loadPlayersBtn');
  const original = btn?.textContent || 'Завантажити гравців';
  normalizeEventAndSourceState(state.app.eventMode, state.app.playerSourceMode);
  const sourceMode = state.app.playerSourceMode;
  const eventMode = state.app.eventMode;
  localStorage.setItem(LEAGUE_KEY, sourceMode);
  debugLog('[balance2] load players source', {
    eventMode,
    sourceMode,
  });
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Завантаження…';
  }
  setStatus({ state: 'saving', text: sourceMode === 'mixed' ? 'Завантажую дорослу та дитячу ліги...' : 'Завантаження…', retryVisible: false });

  try {
    const loaded = await loadPlayersForSource(sourceMode, { force, timeoutMs: 15000 });
    state.playersState.players = normalizeLoadedPlayers(loaded.players || []);
    state.playersState.playersLoaded = true;
    if (sourceMode === 'mixed') {
      if (!state.playersState.players.length) throw new Error('Не знайдено гравців для змішаного турніру');
      if (loaded.errors?.sundaygames || loaded.errors?.kids) {
        const partialMessage = loaded.errors?.sundaygames || loaded.errors?.kids;
        setStatus({ state: 'error', text: `⚠️ ${partialMessage}`, retryVisible: false });
      } else {
        setStatus({ state: 'saved', text: `✅ Завантажено: ${loaded.counts.sundaygames} дорослих, ${loaded.counts.kids} дитячих`, retryVisible: false });
      }
      const nickCounts = new Map();
      state.playersState.players.forEach((player) => {
        nickCounts.set(player.nick, (nickCounts.get(player.nick) || 0) + 1);
      });
      if ([...nickCounts.values()].some((count) => count > 1)) {
        setTournamentStatus('Є однакові нікнейми в різних лігах — перевір склад перед збереженням.', 'warning');
      }
    } else {
      setStatus({ state: 'saved', text: `✅ Завантажено: ${state.playersState.players.length} гравців`, retryVisible: false });
    }
    renderAndSync();
  } catch (error) {
    state.playersState.playersLoaded = false;
    setStatus({ state: 'error', text: `❌ ${error.message || 'Не вдалося отримати відповідь від сервера'}`, retryVisible: false });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = original;
    }
  }
}

async function init() {
  if (peekLobbyRestore()) $('restoreCard')?.classList.remove('hidden');
  else $('restoreCard')?.classList.add('hidden');

  $('restoreBtn')?.addEventListener('click', async () => {
    if (!restoreLobby()) return;
    normalizeEventAndSourceState(state.app.eventMode, state.app.playerSourceMode);
    $('sortMode').value = state.app.sortMode;
    await ensurePlayersLoaded();
    renderAndSync();
    $('restoreCard')?.classList.add('hidden');
  });

  $('sortMode')?.addEventListener('change', (e) => {
    state.app.sortMode = e.target.value;
    saveLobby();
    renderAndSync();
  });

  $('balanceBtn')?.addEventListener('click', () => { runBalance(); renderAndSync(); });
  $('manualBtn')?.addEventListener('click', () => { state.app.mode = 'manual'; ensureTeamsForManualAssignment(); syncSelectedFromTeamsAndBench(); ensureActiveMatchState(); setTournamentDirty(); saveLobby(); renderAndSync(); });
  $('clearLobbyBtn')?.addEventListener('click', () => { state.playersState.selected = []; syncSelectedMap(); clearAllTeams(); ensureActiveMatchState(); setTournamentDirty(); saveLobby(); renderAndSync(); });

  const debouncedSearch = (() => {
    let timer;
    return (value) => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.app.query = value; renderAndSync(); }, 180);
    };
  })();
  $('searchInput')?.addEventListener('input', (e) => debouncedSearch(e.target.value));

  MVP_IDS.forEach((id) => {
    $(id)?.addEventListener('input', (e) => {
      const value = e.target.value.trim();
      const keyId = getMvpKeyId(id);
      if (state.app.eventMode === 'tournament') {
        const result = isMixedTournamentMode()
          ? resolveMvpInputValue(value)
          : { selected: getActiveMvpOptions().find((option) => option.label === value || option.nick === value || option.key === value), ambiguous: false };
        const selected = result.selected;
        state.matchState.match[id] = selected?.nick || '';
        state.matchState.match[keyId] = selected?.key || '';
        if (result.ambiguous) {
          state.matchState.match[id] = value;
          saveLobby();
          setSaveFeedback('error', MIXED_MVP_DUPLICATE_WARNING);
          return;
        }
        if (selected && e.target.value !== selected.label) e.target.value = selected.label;
        if (selected && saveReadinessMessages.has(state.saveMessage)) {
          syncRequireMvpAfterMvpInput();
          saveLobby();
          setSaveFeedback('idle', '');
          return;
        }
      } else {
        state.matchState.match[id] = value;
        state.matchState.match[keyId] = '';
      }
      syncRequireMvpAfterMvpInput();
      saveLobby();
      renderAndSync();
    });
  });

  $('saveBtn')?.addEventListener('click', () => doSave(false));
  $('retrySaveBtn')?.addEventListener('click', () => doSave(true));

  bindUiEvents({
    onTogglePlayer(nick) {
      toggleSelectedPlayer(nick);
      saveLobby();
      renderAndSync();
    },
    onRemove(nick) {
      state.playersState.selected = state.playersState.selected.filter((n) => n !== nick);
      syncSelectedMap();
      removePlayerFromAllTeams(nick);
      ensureActiveMatchState();
      setTournamentDirty();
      saveLobby();
      renderAndSync();
    },
    onTeamCount(count) {
      setTeamCount(count);
      saveLobby();
      renderAndSync();
    },
    onBalanceMode(mode) {
      const nextMode = mode === 'manual' ? 'manual' : 'auto';
      const changed = state.app.mode !== nextMode;
      const hadTeams = TEAM_KEYS.some((key) => (state.teamsState.teams[key] || []).length > 0);
      state.app.mode = nextMode;
      if (nextMode === 'manual') {
        ensureTeamsForManualAssignment();
        syncSelectedFromTeamsAndBench();
      }
      if (changed && hadTeams) {
        setStatus({ state: 'error', text: 'Режим балансу змінено — перевір команди', retryVisible: false });
      }
      saveLobby();
      renderAndSync();
    },
    onAutoBalance() {
      const selected = state.playersState.selected.length;
      const teamCount = state.teamsState.teamCount;
      if (selected < teamCount) {
        setStatus({ state: 'error', text: 'Недостатньо гравців для обраної кількості команд', retryVisible: false });
        renderAndSync();
        return;
      }
      state.app.mode = 'auto';
      runBalance();
      renderAndSync();
    },
    onManualBalance() {
      state.app.mode = 'manual';
      ensureTeamsForManualAssignment();
      syncSelectedFromTeamsAndBench();
      ensureActiveMatchState();
      setTournamentDirty();
      saveLobby();
      renderAndSync();
    },
    onSeriesResult(idx, value) {
      if (idx < 0 || idx >= state.matchState.seriesCount) return;
      const parsed = Number(value);
      const next = parsed === 0 || parsed === 1 || parsed === 2 ? parsed : null;
      state.matchState.seriesRounds[idx] = next;
      syncSeriesMirror();
      const summary = computeSeriesSummary();
      state.matchState.match.winner = summary.winner;
      state.matchState.match.series = summary.series;
      saveLobby();
      renderAndSync();
    },
    onSeriesCount(count) {
      state.matchState.seriesCount = Math.min(7, Math.max(3, Number(count) || 3));
      for (let i = state.matchState.seriesCount; i < 7; i += 1) state.matchState.seriesRounds[i] = null;
      syncSeriesMirror();
      saveLobby();
      renderAndSync();
    },
    onSeriesReset() {
      for (let i = 0; i < state.matchState.seriesCount; i += 1) state.matchState.seriesRounds[i] = null;
      syncSeriesMirror();
      saveLobby();
      renderAndSync();
    },
    onPenalty(nick, delta) {
      state.matchState.match.penalties[nick] = Number(state.matchState.match.penalties[nick] || 0) + delta;
      saveLobby();
      renderAndSync();
    },
    onRenameStart(teamKey) { startRenameTeam(teamKey); },
    onRenameSave(teamKey, value) { saveTeamName(teamKey, value); },
    onChanged() {
      ensureTeamsForManualAssignment();
      syncSelectedFromTeamsAndBench();
      ensureActiveMatchState();
      setTournamentDirty();
      if (state.teamsState.teamCount === 2) {
        state.activeTeamAId = 'team1';
        state.activeTeamBId = 'team2';
      }
      cleanupTournamentMvp();
      saveLobby();
      renderAndSync();
    },
    onMatchMode(mode) {
      state.activeMatch.mode = mode;
      ensureActiveMatchState();
      saveLobby();
      renderAndSync();
    },
    onMatchTeamPick(side, teamKey) {
      if (side === 'A') state.activeMatch.teamA = teamKey;
      if (side === 'B') state.activeMatch.teamB = teamKey;
      ensureActiveMatchState();
      saveLobby();
      renderAndSync();
    },
    onEventMode(mode) {
      state.uiState.flowStarted = true;
      const nextEventMode = mode === 'tournament' ? 'tournament' : 'regular';
      const changed = nextEventMode !== state.app.eventMode;
      normalizeEventAndSourceState(nextEventMode, state.app.playerSourceMode);
      localStorage.setItem(LEAGUE_KEY, state.app.playerSourceMode);
      state.playersState.players = [];
      state.playersState.playersLoaded = false;
      state.tournamentState.teamsSaved = false;
      state.tournamentState.savedTournamentTeamIds = [];
      const statusText = changed && state.playersState.selected.length > 0
        ? '⚠️ Тип події змінено — перевір lobby перед балансуванням.'
        : 'Обери джерело гравців і завантаж список';
      setStatus({ state: changed && state.playersState.selected.length > 0 ? 'error' : 'idle', text: statusText, retryVisible: false });
      if (state.app.eventMode === 'regular') clearTournamentStatus();
      syncSaveButtonState();
      saveLobby();
      renderAndSync();
    },
    onPlayerSourceMode(sourceMode) {
      state.uiState.flowStarted = true;
      onPlayerSourceChanged(sourceMode, { warnOnLobby: true });
      saveLobby();
      renderAndSync();
    },
    onLoadPlayers() {
      state.uiState.flowStarted = true;
      ensurePlayersLoaded({ force: true });
    },
    onTournamentName(name) {
      state.tournamentState.tournamentName = String(name || '').trimStart();
      saveLobby();
    },
    onTournamentGameMode(mode) {
      state.tournamentState.gameMode = ['DM', 'TR', 'KT'].includes(mode) ? mode : 'DM';
      saveLobby();
      renderAndSync();
    },
    onTournamentType(type) {
      state.tournamentState.tournamentType = type === 'group' ? 'group' : 'custom';
      state.tournamentState.tournamentSchedule = [];
      state.tournamentState.currentScheduleGameId = '';
      state.tournamentState.currentGameId = '';
      if (state.tournamentState.tournamentType === 'group') refreshGroupSchedule({ force: true });
      saveLobby();
      renderAndSync();
    },
    onTournamentSchedulePick(gameId) {
      if (!selectGroupScheduleMatch(gameId)) return;
      saveLobby();
      renderAndSync();
    },
    onTournamentNextMatch() {
      const current = getCurrentGroupMatch();
      if (current && current.status !== 'done') current.status = 'pending';
      const pending = state.tournamentState.tournamentSchedule.find((match) => match.status === 'pending');
      if (pending) selectGroupScheduleMatch(pending.gameId);
      saveLobby();
      renderAndSync();
    },
    onTournamentTeamPick(side, teamKey) {
      if (side === 'A') state.activeTeamAId = teamKey;
      if (side === 'B') state.activeTeamBId = teamKey;
      if (state.activeTeamAId === state.activeTeamBId) {
        debugLog('[balance2:tournament] validation failed Обери дві різні команди матчу');
        setTournamentStatus('Обери дві різні команди матчу', 'error');
        setStatus({ state: 'error', text: '❌ Команда A і Команда B не можуть бути однаковими', retryVisible: false });
      }
      cleanupTournamentMvp();
      saveLobby();
      renderAndSync();
    },
    onAssignPlayerTeam(playerKey, teamId) {
      ensureTeamsForManualAssignment();
      if (!playerKey) return;
      if (!teamId) {
        const removed = removePlayerFromAllTeams(playerKey);
        if (!removed) return;
        setTournamentDirty('Команди змінено — збережи їх перед матчем');
        saveLobby();
        renderAndSync();
        return;
      }
      if (!resolvePlayerByKey(playerKey) && !state.playersState.selected.includes(playerKey)) return;
      if (!assignPlayerToTeam(playerKey, teamId)) return;
      setTournamentDirty(`Гравця додано в ${getTeamLabel(teamId)}`);
      saveLobby();
      renderAndSync();
    },
    onRemovePlayerFromTeam(playerKey, teamId) {
      if (!playerKey || !teamId) return;
      const removed = removePlayerFromTeam(playerKey, teamId);
      if (!removed) return;
      setTournamentDirty('Команди змінено — збережи їх перед матчем');
      saveLobby();
      renderAndSync();
    },
    async onCreateTournament() {
      if (state.tournamentState.isSaving) {
        setTournamentStatus('Запит уже виконується, зачекай', 'warning');
        renderAndSync();
        return;
      }
      if (state.app.eventMode !== 'tournament') {
        const message = 'Увімкни турнірний режим';
        debugLog(`[balance2:tournament] validation failed ${message}`);
        setTournamentStatus(message, 'warning');
        setTournamentRequestMeta({ action: 'createTournament', requestStatus: 'ERR', error: message });
        renderAndSync();
        return;
      }
      if (!['kids', 'sundaygames', 'mixed'].includes(state.app.playerSourceMode)) {
        const message = 'Обери лігу kids, sundaygames або mixed';
        debugLog(`[balance2:tournament] validation failed ${message}`);
        setTournamentStatus(message, 'error');
        setTournamentRequestMeta({ action: 'createTournament', requestStatus: 'ERR', error: message });
        renderAndSync();
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
        const message = 'Невірна дата старту турніру';
        debugLog(`[balance2:tournament] validation failed ${message}`);
        setTournamentStatus(message, 'error');
        setTournamentRequestMeta({ action: 'createTournament', requestStatus: 'ERR', error: message });
        renderAndSync();
        return;
      }
      const leagueLabel = state.app.playerSourceMode === 'kids' ? 'Kids' : (state.app.playerSourceMode === 'mixed' ? 'Mixed' : 'SundayGames');
      const rawName = String(state.tournamentState.tournamentName || '').trim();
      const name = rawName.length >= 3 ? rawName : `Турнір ${leagueLabel} ${today}`;
      const payload = {
        name,
        league: state.app.playerSourceMode === 'mixed' ? 'sundaygames' : state.app.playerSourceMode,
        dateStart: today,
        dateEnd: '',
        status: 'ACTIVE',
        notes: state.app.playerSourceMode === 'mixed' ? 'Mixed tournament: sundaygames + kids' : '',
      };
      state.tournamentState.isSaving = true;
      setTournamentStatus('Створюю турнір...', 'loading');
      setTournamentRequestMeta({ action: 'createTournament', requestStatus: 'PENDING', error: '' });
      renderAndSync();
      const res = await createTournament(payload);
      state.tournamentState.isSaving = false;
      if (!res.ok) {
        const message = res.message || 'Невідома помилка';
        setTournamentStatus(`Не вдалося створити турнір: ${message}`, 'error');
        setTournamentRequestMeta({ action: 'createTournament', requestStatus: 'ERR', error: message });
        renderAndSync();
        return;
      }
      const newTournamentId = res.data?.tournamentId || res.data?.data?.tournamentId || '';
      if (!newTournamentId) {
        const message = 'не повернувся tournamentId';
        setTournamentStatus(`Не вдалося створити турнір: ${message}`, 'error');
        setTournamentRequestMeta({ action: 'createTournament', requestStatus: 'ERR', error: message });
        renderAndSync();
        return;
      }
      state.tournamentState.tournamentName = name;
      state.tournamentState.tournamentId = newTournamentId;
      state.tournamentState.teamsSaved = false;
      state.tournamentState.savedTournamentTeamIds = [];
      saveLobby();
      setTournamentStatus(`Турнір створено: ${state.tournamentState.tournamentId}`, 'success');
      setTournamentRequestMeta({ action: 'createTournament', requestStatus: 'OK', error: '' });
      renderAndSync();
    },
    async onSaveTournamentTeams() {
      if (state.tournamentState.isSaving) {
        setTournamentStatus('Запит уже виконується, зачекай', 'warning');
        renderAndSync();
        return;
      }
      if (state.app.eventMode !== 'tournament') {
        const message = 'Увімкни турнірний режим';
        debugLog(`[balance2:tournament] validation failed ${message}`);
        setTournamentStatus(message, 'warning');
        setTournamentRequestMeta({ action: 'saveTeams', requestStatus: 'ERR', error: message });
        renderAndSync();
        return;
      }
      if (!state.tournamentState.tournamentId) {
        const message = 'Спочатку створи турнір';
        debugLog(`[balance2:tournament] validation failed ${message}`);
        setTournamentStatus(message, 'error');
        setTournamentRequestMeta({ action: 'saveTeams', requestStatus: 'ERR', error: message });
        renderAndSync();
        return;
      }
      const teams = buildTournamentTeamsPayload();
      if (teams.length < 2) {
        const message = 'Спочатку збалансуй гравців у команди';
        debugLog(`[balance2:tournament] validation failed ${message}`);
        setTournamentStatus(message, 'error');
        setTournamentRequestMeta({ action: 'saveTeams', requestStatus: 'ERR', error: message });
        renderAndSync();
        return;
      }
      const activeTeamIds = TEAM_KEYS.slice(0, state.teamsState.teamCount);
      const firstEmptyTeamId = activeTeamIds.find((teamId) => !(state.teamsState.teams[teamId] || []).length);
      if (firstEmptyTeamId) {
        const message = `${getTeamLabel(firstEmptyTeamId)} порожня`;
        debugLog(`[balance2:tournament] validation failed ${message}`);
        setTournamentStatus(message, 'error');
        setTournamentRequestMeta({ action: 'saveTeams', requestStatus: 'ERR', error: message });
        renderAndSync();
        return;
      }
      const payload = {
        tournamentId: state.tournamentState.tournamentId,
        teams,
      };
      state.tournamentState.isSaving = true;
      setTournamentStatus('Зберігаю команди...', 'loading');
      setTournamentRequestMeta({ action: 'saveTeams', requestStatus: 'PENDING', error: '' });
      renderAndSync();
      const res = await saveTournamentTeams(payload);
      state.tournamentState.isSaving = false;
      if (!res.ok) {
        state.tournamentState.teamsSaved = false;
        const message = res.message || 'Невідома помилка';
        setTournamentStatus(`Не вдалося зберегти команди: ${message}`, 'error');
        setTournamentRequestMeta({ action: 'saveTeams', requestStatus: 'ERR', error: message });
        renderAndSync();
        return;
      }
      state.tournamentState.teamsSaved = true;
      state.tournamentState.savedTournamentTeamIds = teams.map((team) => team.teamId);
      saveLobby();
      setTournamentStatus(`Команди турніру збережено: ${teams.length} команд`, 'success');
      setTournamentRequestMeta({ action: 'saveTeams', requestStatus: 'OK', error: '' });
      renderAndSync();
    },
    onSchedulePick(matchId) {
      state.activeMatch.selectedScheduleMatchId = matchId;
      ensureActiveMatchState();
      saveLobby();
      renderAndSync();
    },
    onTogglePenalties() {
      state.uiState.penaltiesCollapsed = !state.uiState.penaltiesCollapsed;
      renderAndSync();
    },
    onRequireMvpChange(required) {
      state.requireMvp = required !== false;
      saveLobby();
      renderAndSync();
    },
  });

  normalizeEventAndSourceState(state.app.eventMode, localStorage.getItem(LEAGUE_KEY) || state.app.playerSourceMode);
  state.lastSavedGame = readLastSavedGame();
  $('sortMode').value = state.app.sortMode;
  syncSelectedMap();
  ensureActiveMatchState();
  syncSeriesMirror();
  renderAndSync();
}

init();
