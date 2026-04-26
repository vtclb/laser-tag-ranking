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
} from './state.js';
import { autoBalance2, balanceIntoNTeams } from './balance.js';
import { clearTeams, syncSelectedFromTeamsAndBench } from './manual.js';
import { render, bindUiEvents, setTournamentStatus, clearTournamentStatus } from './ui.js';
import { loadPlayersForSource, saveMatch, createTournament, saveTournamentTeams, saveTournamentGame } from './api.js';
import { saveLobby, restoreLobby, peekLobbyRestore, clearPlayersCache, saveLastSavedGame, readLastSavedGame } from './storage.js';
import { setStatus, lockSaveButton } from './status.js';

const $ = (id) => document.getElementById(id);
const TEAM_KEYS = ['team1', 'team2', 'team3', 'team4', 'team5', 'team6'];
const LEAGUE_KEY = 'balance2:league';
let saveLocked = false;

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

function setTournamentDirty(message = 'Команди змінилися — збережи їх повторно') {
  if (state.app.eventMode !== 'tournament') return;
  state.tournamentState.teamsSaved = false;
  state.tournamentState.savedTournamentTeamIds = [];
  setTournamentStatus(message, 'warning');
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
  state.teamsState.teamCount = Math.min(6, Math.max(2, Number(rawValue) || 2));
  TEAM_KEYS.slice(state.teamsState.teamCount).forEach((key) => { state.teamsState.teams[key] = []; });
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
  setTournamentDirty();
}

function runBalance() {
  const selected = getSelectedPlayers();
  clearTeams();
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
  const [teamA, teamB] = state.app.eventMode === 'tournament'
    ? [state.activeTeamAId, state.activeTeamBId]
    : getActiveMatchTeams();
  const hasTeams = state.teamsState.teams[teamA]?.length > 0 && state.teamsState.teams[teamB]?.length > 0;
  const canSave = hasTeams && computeSeriesSummary().played >= 3;
  btn.disabled = saveLocked || state.tournamentState.isSaving || !canSave;
}

function renderAndSync() {
  ensureActiveMatchState();
  const available = getAvailableTeamKeys();
  const fallbackA = available[0] || 'team1';
  const fallbackB = available.find((key) => key !== fallbackA) || 'team2';
  if (!available.includes(state.activeTeamAId)) state.activeTeamAId = fallbackA;
  if (!available.includes(state.activeTeamBId) || state.activeTeamBId === state.activeTeamAId) state.activeTeamBId = fallbackB;
  cleanupTournamentMvp();
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
  const gameId = state.tournamentState.currentGameId || `G${String(gameNumber).padStart(3, '0')}`;
  const result = mapTournamentResult();
  return {
    tournamentId: state.tournamentState.tournamentId,
    gameId,
    gameMode: state.tournamentState.gameMode,
    teamAId: state.activeTeamAId,
    teamBId: state.activeTeamBId,
    result,
    mvp1: state.matchState.match.mvp1 || '',
    mvp2: state.matchState.match.mvp2 || '',
    mvp3: state.matchState.match.mvp3 || '',
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
  state.matchState.match.mvp1 = '';
  state.matchState.match.mvp2 = '';
  state.matchState.match.mvp3 = '';
  state.matchState.match.penalties = {};
}

function validateSave() {
  if (state.app.eventMode === 'tournament') {
    if (!state.tournamentState.tournamentId) return 'Спочатку створи турнір';
    if (!state.tournamentState.teamsSaved) return 'Спочатку збережи команди турніру';
    if (!state.activeTeamAId || !state.activeTeamBId) return 'Обери дві команди матчу';
    if (state.activeTeamAId === state.activeTeamBId) return 'Обери дві різні команди матчу';
    if (!state.tournamentState.savedTournamentTeamIds.includes(state.activeTeamAId) || !state.tournamentState.savedTournamentTeamIds.includes(state.activeTeamBId)) return 'Обрані активні команди не збережені в турнірі';
    const teamAPlayers = state.teamsState.teams[state.activeTeamAId] || [];
    const teamBPlayers = state.teamsState.teams[state.activeTeamBId] || [];
    if (!teamAPlayers.length || !teamBPlayers.length) return 'Обидві активні команди мають гравців';
    if (!['DM', 'TR', 'KT'].includes(state.tournamentState.gameMode)) return 'Невірний режим матчу';
    const mappedResult = mapTournamentResult();
    if (!mappedResult) return 'Вкажи результат матчу';
    if (!['A', 'B', 'DRAW'].includes(mappedResult)) return 'Вкажи коректний результат матчу';
    if (state.tournamentState.gameMode === 'KT' && mappedResult === 'DRAW') return 'Для KT нічия недоступна';
    const allowed = new Set([...teamAPlayers, ...teamBPlayers]);
    const playersMap = getPlayersByKeyMap();
    const allowedNicks = new Set([...allowed].map((playerKey) => playersMap.get(playerKey)?.nick || playerKey));
    for (const id of ['mvp1', 'mvp2', 'mvp3']) {
      const nick = state.matchState.match[id];
      if (nick && !allowedNicks.has(nick)) return 'MVP має бути гравцем активних команд';
    }
  }
  const [teamA, teamB] = state.app.eventMode === 'tournament'
    ? [state.activeTeamAId, state.activeTeamBId]
    : getActiveMatchTeams();
  if (!state.teamsState.teams[teamA]?.length || !state.teamsState.teams[teamB]?.length) return 'Активні команди не заповнені';
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
    mvp: state.matchState.match.mvp1 || state.matchState.match.mvp2 || state.matchState.match.mvp3 || '—',
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
  const error = validateSave();
  if (error) {
    if (state.app.eventMode === 'tournament') {
      console.debug(`[balance2:tournament] validation failed ${error}`);
      setTournamentStatus(error, 'error');
      setTournamentRequestMeta({ action: 'saveGame', requestStatus: 'ERR', error });
      renderAndSync();
    }
    setStatus({ state: 'error', text: `❌ Помилка: ${error}`, retryVisible: false });
    return;
  }

  const payload = retry ? state.meta.lastPayload : (state.app.eventMode === 'tournament' ? buildTournamentGamePayload() : buildPayload());
  state.meta.lastPayload = payload;

  saveLocked = true;
  if (state.app.eventMode === 'tournament') state.tournamentState.isSaving = true;
  lockSaveButton(true);
  syncSaveButtonState();
  setStatus({ state: 'saving', text: state.app.eventMode === 'tournament' ? 'Збереження турнірного матчу...' : 'Зберігаю…', retryVisible: false });
  if (state.app.eventMode === 'tournament') {
    setTournamentStatus(`Зберігаю матч ${payload.gameId}...`, 'loading');
    setTournamentRequestMeta({ action: 'saveGame', requestStatus: 'PENDING', error: '' });
    renderAndSync();
  }

  const res = state.app.eventMode === 'tournament'
    ? await saveTournamentGame(payload)
    : await saveMatch(payload, 20000);
  if (res.ok) {
    if (state.app.eventMode === 'tournament') {
      const snapshot = createLastSavedSnapshot();
      state.lastSavedGame = snapshot;
      saveLastSavedGame(snapshot);
      state.tournamentState.nextGameNumber += 1;
      state.tournamentState.currentGameId = '';
      resetMatchOnlyState();
      syncSeriesMirror();
      saveLobby();
      setStatus({ state: 'saved', text: '✅ Турнірний матч збережено', retryVisible: false });
      setTournamentStatus(`Матч ${payload.gameId} збережено`, 'success');
      setTournamentRequestMeta({ action: 'saveGame', requestStatus: 'OK', error: '' });
      finishTournamentSaving();
      return;
    }
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
      setStatus({ state: 'saved', text: `✅ Збережено (${new Date().toLocaleTimeString('uk-UA')})`, retryVisible: false });
      renderAndSync();
    } catch (loadError) {
      setStatus({ state: 'error', text: `❌ Не вдалося отримати відповідь від сервера: ${loadError.message}`, retryVisible: true });
    }
  } else {
    if (state.app.eventMode === 'tournament') {
      const message = res.message || 'Невідома помилка';
      setTournamentStatus(`Не вдалося зберегти матч: ${message}`, 'error');
      setTournamentRequestMeta({ action: 'saveGame', requestStatus: 'ERR', error: message });
    }
    setStatus({ state: 'error', text: `❌ ${res.message || 'Не вдалося отримати відповідь від сервера'}`, retryVisible: true });
  }

  if (state.app.eventMode === 'tournament') {
    finishTournamentSaving();
  } else {
    saveLocked = false;
    lockSaveButton(false);
    syncSaveButtonState();
  }
}

function toggleSelectedPlayer(nick) {
  if (state.playersState.selectedMap.has(nick)) {
    state.playersState.selected = state.playersState.selected.filter((n) => n !== nick);
    Object.keys(state.teamsState.teams).forEach((key) => {
      state.teamsState.teams[key] = state.teamsState.teams[key].filter((n) => n !== nick);
    });
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
  ['mvp1', 'mvp2', 'mvp3'].forEach((id) => {
    if (state.matchState.match[id] && !allowed.has(state.matchState.match[id])) state.matchState.match[id] = '';
  });
}

function onPlayerSourceChanged(nextMode, { warnOnLobby = false } = {}) {
  const sourceMode = normalizePlayerSourceMode(nextMode, state.app.eventMode);
  const changed = sourceMode !== state.app.playerSourceMode;
  state.app.playerSourceMode = sourceMode;
  state.app.league = sourceMode;
  localStorage.setItem(LEAGUE_KEY, sourceMode);
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
  const sourceFromControl = state.app.eventMode === 'tournament'
    ? document.querySelector('select[data-role="player-source-mode"]')?.value
    : $('leagueSelect')?.value;
  const sourceMode = normalizePlayerSourceMode(sourceFromControl || state.app.playerSourceMode || state.app.league, state.app.eventMode);

  state.app.playerSourceMode = sourceMode;
  state.app.league = sourceMode;
  localStorage.setItem(LEAGUE_KEY, sourceMode);
  console.debug('[balance2] load players source', {
    eventMode: state.app?.eventMode,
    league: state.app.league,
    playerSourceMode: state.app.playerSourceMode,
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
    $('leagueSelect').value = state.app.league;
    $('sortMode').value = state.app.sortMode;
    await ensurePlayersLoaded();
    renderAndSync();
    $('restoreCard')?.classList.add('hidden');
  });

  $('leagueSelect')?.addEventListener('change', (e) => {
    onPlayerSourceChanged(e.target.value);
    state.playersState.selected = [];
    syncSelectedMap();
    clearTeams();
    setTournamentDirty();
    ensureActiveMatchState();
    saveLobby();
    renderAndSync();
  });

  $('sortMode')?.addEventListener('change', (e) => {
    state.app.sortMode = e.target.value;
    saveLobby();
    renderAndSync();
  });

  $('loadPlayersBtn')?.addEventListener('click', () => ensurePlayersLoaded({ force: true }));
  $('balanceBtn')?.addEventListener('click', () => { runBalance(); renderAndSync(); });
  $('manualBtn')?.addEventListener('click', () => { state.app.mode = 'manual'; syncSelectedFromTeamsAndBench(); ensureActiveMatchState(); setTournamentDirty(); saveLobby(); renderAndSync(); });
  $('clearLobbyBtn')?.addEventListener('click', () => { state.playersState.selected = []; syncSelectedMap(); clearTeams(); ensureActiveMatchState(); setTournamentDirty(); saveLobby(); renderAndSync(); });

  const debouncedSearch = (() => {
    let timer;
    return (value) => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.app.query = value; renderAndSync(); }, 180);
    };
  })();
  $('searchInput')?.addEventListener('input', (e) => debouncedSearch(e.target.value));

  ['mvp1', 'mvp2', 'mvp3'].forEach((id) => {
    $(id)?.addEventListener('input', (e) => {
      const value = e.target.value.trim();
      if (state.app.eventMode === 'tournament') {
        const allowed = new Set([...(state.teamsState.teams[state.activeTeamAId] || []), ...(state.teamsState.teams[state.activeTeamBId] || [])]);
        const playersMap = getPlayersByKeyMap();
        const allowedNicks = new Set([...allowed].map((playerKey) => playersMap.get(playerKey)?.nick || playerKey));
        state.matchState.match[id] = allowedNicks.has(value) || !value ? value : '';
      } else {
        state.matchState.match[id] = value;
      }
      saveLobby();
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
      Object.keys(state.teamsState.teams).forEach((key) => {
        state.teamsState.teams[key] = state.teamsState.teams[key].filter((n) => n !== nick);
      });
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
      state.app.eventMode = mode === 'tournament' ? 'tournament' : 'regular';
      if (state.app.eventMode === 'regular' && state.app.playerSourceMode === 'mixed') {
        onPlayerSourceChanged('sundaygames');
        setStatus({ state: 'error', text: '⚠️ Змішаний режим доступний тільки для турніру.', retryVisible: false });
      } else {
        onPlayerSourceChanged(state.app.playerSourceMode);
      }
      if (state.app.eventMode === 'regular') clearTournamentStatus();
      syncSaveButtonState();
      saveLobby();
      renderAndSync();
    },
    onPlayerSourceMode(sourceMode) {
      onPlayerSourceChanged(sourceMode, { warnOnLobby: true });
      saveLobby();
      renderAndSync();
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
    onTournamentTeamPick(side, teamKey) {
      if (side === 'A') state.activeTeamAId = teamKey;
      if (side === 'B') state.activeTeamBId = teamKey;
      if (state.activeTeamAId === state.activeTeamBId) {
        console.debug('[balance2:tournament] validation failed Обери дві різні команди матчу');
        setTournamentStatus('Обери дві різні команди матчу', 'error');
        setStatus({ state: 'error', text: '❌ Команда A і Команда B не можуть бути однаковими', retryVisible: false });
      }
      cleanupTournamentMvp();
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
        console.debug(`[balance2:tournament] validation failed ${message}`);
        setTournamentStatus(message, 'warning');
        setTournamentRequestMeta({ action: 'createTournament', requestStatus: 'ERR', error: message });
        renderAndSync();
        return;
      }
      if (!['kids', 'sundaygames', 'mixed'].includes(state.app.playerSourceMode)) {
        const message = 'Обери лігу kids, sundaygames або mixed';
        console.debug(`[balance2:tournament] validation failed ${message}`);
        setTournamentStatus(message, 'error');
        setTournamentRequestMeta({ action: 'createTournament', requestStatus: 'ERR', error: message });
        renderAndSync();
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
        const message = 'Невірна дата старту турніру';
        console.debug(`[balance2:tournament] validation failed ${message}`);
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
        console.debug(`[balance2:tournament] validation failed ${message}`);
        setTournamentStatus(message, 'warning');
        setTournamentRequestMeta({ action: 'saveTeams', requestStatus: 'ERR', error: message });
        renderAndSync();
        return;
      }
      if (!state.tournamentState.tournamentId) {
        const message = 'Спочатку створи турнір';
        console.debug(`[balance2:tournament] validation failed ${message}`);
        setTournamentStatus(message, 'error');
        setTournamentRequestMeta({ action: 'saveTeams', requestStatus: 'ERR', error: message });
        renderAndSync();
        return;
      }
      const teams = buildTournamentTeamsPayload();
      if (teams.length < 2) {
        const message = 'Спочатку збалансуй гравців у команди';
        console.debug(`[balance2:tournament] validation failed ${message}`);
        setTournamentStatus(message, 'error');
        setTournamentRequestMeta({ action: 'saveTeams', requestStatus: 'ERR', error: message });
        renderAndSync();
        return;
      }
      if (teams.some((team) => !team.players.length)) {
        const message = 'Кожна команда має містити хоча б 1 гравця';
        console.debug(`[balance2:tournament] validation failed ${message}`);
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
  });

  state.app.playerSourceMode = normalizePlayerSourceMode(localStorage.getItem(LEAGUE_KEY) || state.app.playerSourceMode, state.app.eventMode);
  state.app.league = state.app.playerSourceMode;
  state.lastSavedGame = readLastSavedGame();
  $('leagueSelect').value = state.app.league;
  $('sortMode').value = state.app.sortMode;
  syncSelectedMap();
  ensureActiveMatchState();
  syncSeriesMirror();
  renderAndSync();
}

init();
