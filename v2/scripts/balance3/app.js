import { MAX_PLAYERS, TEAM_IDS } from './config.js';
import { loadLeagueGames, loadLeaguePlayers, createRequestId, saveRegularGame } from './api.js';
import { balancePlayers, emptyManualTeams } from './balance.js';
import {
  activeTeamIds,
  buildRegularPayload,
  createInitialState,
  normalizePlayer,
  regularGameFingerprint,
  selectedPlayers,
  teamPlayers,
  unassignedPlayers,
  validateTeamFormation,
} from './domain.js';
import {
  clearDraft,
  clearPendingWrite,
  readDraft,
  readPendingWrite,
  saveDraft,
  savePendingWrite,
} from './storage.js';
import { getState, replaceState, subscribe, updateState } from './state.js';
import { hideRestoreBanner, initializeStaticOptions, render, showRestoreBanner } from './ui.js';

const $ = (id) => document.getElementById(id);
let pendingDraft = readDraft();
let pendingWrite = readPendingWrite();
let saveInFlight = false;
let draftDecisionPending = Boolean(pendingDraft?.selectedKeys?.length);

function notice(status, message, { requestId } = {}) {
  updateState((state) => ({
    ...state,
    save: {
      status,
      message,
      requestId: requestId === undefined ? state.save.requestId : requestId,
    },
  }));
}

function resetTeamsAndMatch(state) {
  return {
    ...state,
    stage: 'players',
    teams: emptyManualTeams(),
    activeTeamA: 'team1',
    activeTeamB: 'team2',
    rounds: state.rounds.map(() => null),
    mvp: { mvp1: '', mvp2: '', mvp3: '' },
    save: { status: 'neutral', message: '', requestId: '' },
  };
}

function ensureActiveTeams(state) {
  const nonEmpty = activeTeamIds(state).filter((teamId) => teamPlayers(state, teamId).length > 0);
  const activeTeamA = nonEmpty.includes(state.activeTeamA) ? state.activeTeamA : nonEmpty[0] || 'team1';
  const activeTeamB = nonEmpty.includes(state.activeTeamB) && state.activeTeamB !== activeTeamA
    ? state.activeTeamB
    : nonEmpty.find((teamId) => teamId !== activeTeamA) || 'team2';
  return { ...state, activeTeamA, activeTeamB };
}

async function loadPlayers({ force = false } = {}) {
  pendingDraft = null;
  draftDecisionPending = false;
  hideRestoreBanner();
  notice('saving', 'Завантажуємо актуальний склад...', { requestId: '' });
  try {
    const league = getState().league;
    const players = await loadLeaguePlayers(league, { force });
    updateState((state) => ({
      ...resetTeamsAndMatch(state),
      players,
      playersLoaded: true,
      selectedKeys: state.selectedKeys.filter((key) => players.some((player) => player.key === key)),
      save: {
        status: 'success',
        message: `Завантажено гравців: ${players.length}. Внутрішня оцінка сили готова.`,
        requestId: '',
      },
    }));
  } catch (error) {
    notice('error', error?.message || 'Не вдалося завантажити гравців', { requestId: '' });
  }
}

function togglePlayer(playerKey) {
  updateState((state) => {
    const selected = new Set(state.selectedKeys);
    if (selected.has(playerKey)) selected.delete(playerKey);
    else if (selected.size < MAX_PLAYERS) selected.add(playerKey);
    else return { ...state, save: { status: 'warning', message: `Максимум гравців: ${MAX_PLAYERS}`, requestId: '' } };
    return {
      ...resetTeamsAndMatch(state),
      selectedKeys: [...selected],
      save: { status: 'neutral', message: '', requestId: '' },
    };
  });
}

function formTeams({ nextSeed = false } = {}) {
  const state = getState();
  const validation = validateTeamFormation(state);
  if (!validation.ok) {
    notice('warning', validation.message, { requestId: '' });
    return;
  }
  const balanceSeed = nextSeed ? state.balanceSeed + 1 : state.balanceSeed;
  if (state.balanceMode === 'manual') {
    updateState((current) => ({ ...current, stage: 'teams', teams: emptyManualTeams(), balanceSeed, save: { status: 'neutral', message: 'Розподіліть усіх гравців по командах', requestId: '' } }));
    return;
  }
  try {
    const balanced = balancePlayers(selectedPlayers(state), state.teamCount, balanceSeed, { ratingModel: state.ratingModel });
    updateState((current) => ensureActiveTeams({
      ...current,
      stage: 'teams',
      teams: balanced.teams,
      balanceSeed,
      rounds: current.rounds.map(() => null),
      mvp: { mvp1: '', mvp2: '', mvp3: '' },
      save: { status: 'success', message: 'Команди сформовано', requestId: '' },
    }));
  } catch (error) {
    notice('error', error?.message || 'Не вдалося сформувати команди', { requestId: '' });
  }
}

function movePlayer(playerKey, teamId) {
  updateState((state) => {
    const teams = Object.fromEntries(TEAM_IDS.map((id) => [id, [...(state.teams[id] || [])].filter((key) => key !== playerKey)]));
    if (activeTeamIds(state).includes(teamId)) teams[teamId].push(playerKey);
    return ensureActiveTeams({ ...state, teams, rounds: state.rounds.map(() => null), mvp: { mvp1: '', mvp2: '', mvp3: '' } });
  });
}

function continueToResult() {
  const state = getState();
  if (unassignedPlayers(state).length) {
    notice('warning', 'Розподіліть усіх гравців по командах', { requestId: '' });
    return;
  }
  if (activeTeamIds(state).some((teamId) => teamPlayers(state, teamId).length === 0)) {
    notice('warning', 'Кожна команда повинна мати хоча б одного гравця', { requestId: '' });
    return;
  }
  updateState((current) => ({ ...ensureActiveTeams(current), stage: 'result', save: { status: 'neutral', message: '', requestId: '' } }));
}

function resetMatchSelection(state) {
  return { ...state, rounds: state.rounds.map(() => null), mvp: { mvp1: '', mvp2: '', mvp3: '' }, save: { status: 'neutral', message: '', requestId: '' } };
}

function parseGameTimestamp(value) {
  const source = String(value || '').trim();
  const match = source.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4]) || 0, Number(match[5]) || 0, Number(match[6]) || 0).getTime();
  return Date.parse(source);
}

async function verifyPendingWrite(record) {
  if (!record?.payload) return false;
  try {
    const games = await loadLeagueGames(record.payload.league);
    const expected = regularGameFingerprint(record.payload);
    const threshold = Number(record.startedAt) - (2 * 60 * 1000);
    return games.slice(-50).some((game, index, recent) => {
      if (regularGameFingerprint(game) !== expected) return false;
      const timestamp = parseGameTimestamp(game.timestamp);
      return Number.isFinite(timestamp) ? timestamp >= threshold : index >= recent.length - 10;
    });
  } catch {
    return false;
  }
}

function mergeSavedPlayerUpdates(players, refreshedPlayers, returnedPlayers, league) {
  const refreshedByKey = new Map((refreshedPlayers || []).map((player) => [player.key, player]));
  const returnedByNick = new Map((returnedPlayers || []).map((player) => [String(player.nick || '').trim(), player]));
  return players.map((player) => {
    const base = refreshedByKey.get(player.key) || player;
    const returned = returnedByNick.get(player.nick);
    if (!returned || !Number.isFinite(Number(returned.points))) return base;
    return normalizePlayer({ ...base, points: Number(returned.points), rating: Number(returned.points) }, league);
  });
}

async function finalizeSavedGame(record, result = null, { recovered = false } = {}) {
  let refreshedPlayers = null;
  try {
    refreshedPlayers = await loadLeaguePlayers(record.payload.league, { force: true });
  } catch {
    // The game is saved; a rating refresh failure must not turn it into a failed save.
  }
  const returnedPlayers = Array.isArray(result?.data?.players) ? result.data.players : [];
  updateState((state) => {
    const safeRefreshedPlayers = recovered && !returnedPlayers.length ? null : refreshedPlayers;
    const players = mergeSavedPlayerUpdates(state.players, safeRefreshedPlayers, returnedPlayers, record.payload.league);
    return {
      ...state,
      players,
      rounds: state.rounds.map(() => null),
      mvp: { mvp1: '', mvp2: '', mvp3: '' },
      save: {
        status: 'success',
        message: recovered
          ? 'Запис знайдено в історії. Повторне надсилання скасовано. Поінти оновіть за хвилину.'
          : (refreshedPlayers || returnedPlayers.length ? 'Гру збережено, поінти оновлено' : 'Гру збережено, але поінти не вдалося оновити'),
        requestId: '',
        canForceRetry: false,
      },
      lastSavedGame: {
        savedAt: new Date().toISOString(),
        requestId: record.requestId,
        payload: record.payload,
        recovered,
        ratingsRefreshed: Boolean(safeRefreshedPlayers || returnedPlayers.length),
      },
    };
  });
  clearPendingWrite();
  pendingWrite = null;
  try {
    localStorage.setItem('gamedayRefresh', String(Date.now()));
  } catch {
    // Cross-page refresh is best effort only.
  }
}

async function checkPendingWrite() {
  if (!pendingWrite || saveInFlight) return;
  saveInFlight = true;
  notice('saving', 'Перевіряємо, чи сервер уже записав гру...', { requestId: pendingWrite.requestId });
  const found = await verifyPendingWrite(pendingWrite);
  if (found) await finalizeSavedGame(pendingWrite, null, { recovered: true });
  else updateState((state) => ({
    ...state,
    save: {
      status: 'error',
      message: 'Запис поки не знайдено. Перевірте ще раз або явно надішліть повторно.',
      requestId: pendingWrite.requestId,
      canForceRetry: true,
    },
  }));
  saveInFlight = false;
}

async function performSave(record) {
  if (saveInFlight) return;
  saveInFlight = true;
  pendingWrite = record;
  savePendingWrite(record);
  notice('saving', 'Зберігаємо гру. Не закривайте сторінку.', { requestId: record.requestId });
  const result = await saveRegularGame(record.payload);
  if (result.ok) {
    await finalizeSavedGame(record, result);
    saveInFlight = false;
    return;
  }

  const found = await verifyPendingWrite(record);
  if (found) await finalizeSavedGame(record, result, { recovered: true });
  else updateState((state) => ({
    ...state,
    save: {
      status: 'error',
      message: `Гру не підтверджено: ${result.message}. Не надсилайте повторно без перевірки.`,
      requestId: record.requestId,
      canForceRetry: true,
    },
  }));
  saveInFlight = false;
}

async function saveGame() {
  if (saveInFlight) return;
  if (pendingWrite) {
    await checkPendingWrite();
    return;
  }
  const initial = getState();
  const requestId = createRequestId('save-game');
  let payload;
  try {
    payload = buildRegularPayload(initial, requestId);
  } catch (error) {
    notice('warning', error.message, { requestId: '' });
    return;
  }
  await performSave({ requestId, payload, startedAt: Date.now() });
}

async function forceRetrySave() {
  if (!pendingWrite || saveInFlight) return;
  await performSave({ ...pendingWrite, forcedAt: Date.now() });
}

function cancelPendingSave() {
  if (!pendingWrite || saveInFlight) return;
  clearPendingWrite();
  pendingWrite = null;
  updateState((state) => ({
    ...state,
    save: {
      status: 'warning',
      message: 'Очікування скасовано. Перед новим збереженням перевірте історію ігор.',
      requestId: '',
      canForceRetry: false,
    },
  }));
}

function bindEvents() {
  $('loadPlayersButton').addEventListener('click', () => loadPlayers({ force: true }));
  $('retryButton').addEventListener('click', checkPendingWrite);
  $('forceRetryButton').addEventListener('click', forceRetrySave);
  $('cancelPendingButton').addEventListener('click', cancelPendingSave);
  $('leagueSelect').addEventListener('change', (event) => {
    pendingDraft = null;
    draftDecisionPending = false;
    hideRestoreBanner();
    const next = createInitialState();
    next.league = event.target.value;
    replaceState(next);
  });
  $('playerSearch').addEventListener('input', (event) => updateState((state) => ({ ...state, search: event.target.value })));
  $('playerSort').addEventListener('change', (event) => updateState((state) => ({ ...state, sort: event.target.value })));
  $('playerList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-player-key]');
    if (button) togglePlayer(button.dataset.playerKey);
  });
  $('clearSelectionButton').addEventListener('click', () => updateState((state) => ({ ...resetTeamsAndMatch(state), selectedKeys: [] })));
  $('teamCountSelect').addEventListener('change', (event) => updateState((state) => ({ ...resetTeamsAndMatch(state), teamCount: Number(event.target.value) })));
  document.querySelectorAll('input[name="balanceMode"]').forEach((input) => input.addEventListener('change', (event) => {
    if (event.target.checked) updateState((state) => ({ ...resetTeamsAndMatch(state), balanceMode: event.target.value }));
  }));
  $('formTeamsButton').addEventListener('click', () => formTeams());
  $('rebalanceButton').addEventListener('click', () => formTeams({ nextSeed: true }));
  const moveHandler = (event) => {
    const select = event.target.closest('[data-move-player]');
    if (select) movePlayer(select.dataset.movePlayer, select.value);
  };
  $('teamsGrid').addEventListener('change', moveHandler);
  $('unassignedList').addEventListener('change', moveHandler);
  $('continueToResultButton').addEventListener('click', continueToResult);
  document.querySelector('.b3-steps').addEventListener('click', (event) => {
    const button = event.target.closest('[data-step-target]');
    if (!button) return;
    if (button.dataset.stepTarget === 'players') updateState((state) => ({ ...state, stage: 'players' }));
    else if (button.dataset.stepTarget === 'teams' && selectedPlayers(getState()).length) updateState((state) => ({ ...state, stage: 'teams' }));
    else if (button.dataset.stepTarget === 'result') continueToResult();
  });
  $('teamASelect').addEventListener('change', (event) => updateState((state) => resetMatchSelection({ ...state, activeTeamA: event.target.value })));
  $('teamBSelect').addEventListener('change', (event) => updateState((state) => resetMatchSelection({ ...state, activeTeamB: event.target.value })));
  $('roundCountOptions').addEventListener('click', (event) => {
    const button = event.target.closest('[data-round-count]');
    if (button) updateState((state) => ({ ...state, roundCount: Number(button.dataset.roundCount), rounds: state.rounds.map((value, index) => index < Number(button.dataset.roundCount) ? value : null) }));
  });
  $('roundsList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-round-choice]');
    const row = event.target.closest('[data-round-index]');
    if (!button || !row) return;
    updateState((state) => {
      const rounds = [...state.rounds];
      rounds[Number(row.dataset.roundIndex)] = button.dataset.roundChoice;
      return { ...state, rounds };
    });
  });
  ['mvp1', 'mvp2', 'mvp3'].forEach((field) => $(`${field}Select`).addEventListener('change', (event) => updateState((state) => ({ ...state, mvp: { ...state.mvp, [field]: event.target.value } }))));
  $('saveGameButton').addEventListener('click', saveGame);
  $('restoreButton').addEventListener('click', () => {
    if (pendingDraft) replaceState(pendingDraft);
    pendingDraft = null;
    draftDecisionPending = false;
    hideRestoreBanner();
    saveDraft(getState());
  });
  $('discardDraftButton').addEventListener('click', () => {
    clearDraft();
    pendingDraft = null;
    draftDecisionPending = false;
    hideRestoreBanner();
  });
}

initializeStaticOptions();
bindEvents();
subscribe((state) => {
  render(state);
  if (!draftDecisionPending) saveDraft(state);
});
render(getState());
if (pendingDraft && pendingDraft.selectedKeys.length) showRestoreBanner(pendingDraft);
if (pendingWrite) {
  updateState((state) => ({
    ...state,
    save: {
      status: 'error',
      message: 'Є непідтверджене збереження. Спочатку перевірте запис, щоб не створити дубль.',
      requestId: pendingWrite.requestId,
      canForceRetry: true,
    },
  }));
}
