import {
  state,
  normalizeLeague,
  getSelectedPlayers,
  computeSeriesSummary,
  syncSelectedMap,
  rankLetterForPoints,
  sortByPointsDesc,
  getAvailableTeamKeys,
  getActiveMatchTeams,
  getTeamLabel,
} from './state.js';
import { autoBalance2, balanceIntoNTeams } from './balance.js';
import { clearTeams, syncSelectedFromTeamsAndBench } from './manual.js';
import { render, bindUiEvents } from './ui.js';
import { loadPlayers, saveMatch } from './api.js';
import { saveLobby, restoreLobby, peekLobbyRestore, clearPlayersCache, saveLastSavedGame, readLastSavedGame } from './storage.js';
import { setStatus, lockSaveButton } from './status.js';

const $ = (id) => document.getElementById(id);
const TEAM_KEYS = ['team1', 'team2', 'team3', 'team4'];
const LEAGUE_KEY = 'balance2:league';
let saveLocked = false;

function normalizeLoadedPlayers(players = []) {
  return players
    .map((player) => {
      const nick = String(player.nick || player.nickname || '').trim();
      if (!nick) return null;
      const points = Number(player.points ?? player.pts) || 0;
      return { nick, points, pts: points, rank: String(player.rank || rankLetterForPoints(points)) };
    })
    .filter(Boolean)
    .sort(sortByPointsDesc);
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
  state.teamsState.teamCount = Math.min(4, Math.max(2, Number(rawValue) || 2));
  TEAM_KEYS.slice(state.teamsState.teamCount).forEach((key) => { state.teamsState.teams[key] = []; });
  state.matchState.seriesRounds = state.matchState.seriesRounds.map((value) => {
    const numeric = Number(value);
    if (value === null) return null;
    if (numeric === 0 || numeric === 1 || numeric === 2) return numeric;
    return null;
  });
  ensureActiveMatchState();
  syncSeriesMirror();
}

function runBalance() {
  const selected = getSelectedPlayers();
  clearTeams();
  if (state.teamsState.teamCount === 2) {
    const teams = autoBalance2(selected);
    state.teamsState.teams.team1 = teams.team1.map((p) => p.nick);
    state.teamsState.teams.team2 = teams.team2.map((p) => p.nick);
  } else {
    const teams = balanceIntoNTeams(selected, state.teamsState.teamCount);
    TEAM_KEYS.forEach((key) => {
      state.teamsState.teams[key] = (teams[key] || []).map((p) => p.nick);
    });
  }
  state.app.mode = 'auto';
  ensureActiveMatchState();
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
  const [teamA, teamB] = getActiveMatchTeams();
  const hasTeams = state.teamsState.teams[teamA]?.length > 0 && state.teamsState.teams[teamB]?.length > 0;
  const canSave = hasTeams && computeSeriesSummary().played >= 3;
  btn.disabled = saveLocked || !canSave;
}

function renderAndSync() {
  ensureActiveMatchState();
  render();
  syncSaveButtonState();
}

function buildPayload() {
  const summary = computeSeriesSummary();
  state.matchState.match.series = summary.series;
  state.matchState.match.winner = summary.winner;
  const [teamA, teamB] = getActiveMatchTeams();

  return {
    league: state.app.league,
    team1: state.teamsState.teams[teamA].join(', '),
    team2: state.teamsState.teams[teamB].join(', '),
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
  const [teamA, teamB] = getActiveMatchTeams();
  if (!state.teamsState.teams[teamA]?.length || !state.teamsState.teams[teamB]?.length) return 'Активні команди не заповнені';
  if (computeSeriesSummary().played < 3) return 'Потрібно мінімум 3 зіграні бої';
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
    setStatus({ state: 'error', text: `❌ Помилка: ${error}`, retryVisible: false });
    return;
  }

  const payload = retry ? state.meta.lastPayload : buildPayload();
  state.meta.lastPayload = payload;

  saveLocked = true;
  lockSaveButton(true);
  syncSaveButtonState();
  setStatus({ state: 'saving', text: 'Зберігаю…', retryVisible: false });

  const res = await saveMatch(payload, 20000);
  if (res.ok) {
    try {
      clearPlayersCache(state.app.league);
      const freshPlayers = await loadPlayers(state.app.league, { force: true, timeoutMs: 15000 });
      state.playersState.players = normalizeLoadedPlayers(freshPlayers);

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
    setStatus({ state: 'error', text: `❌ ${res.message || 'Не вдалося отримати відповідь від сервера'}`, retryVisible: true });
  }

  saveLocked = false;
  lockSaveButton(false);
  syncSaveButtonState();
}

function toggleSelectedPlayer(nick) {
  if (state.playersState.selectedMap.has(nick)) {
    state.playersState.selected = state.playersState.selected.filter((n) => n !== nick);
    Object.keys(state.teamsState.teams).forEach((key) => {
      state.teamsState.teams[key] = state.teamsState.teams[key].filter((n) => n !== nick);
    });
  } else if (state.playersState.selected.length < 15) {
    state.playersState.selected = [...state.playersState.selected, nick];
  }
  syncSelectedMap();
  ensureActiveMatchState();
}

function startRenameTeam(teamKey) {
  const wrap = document.querySelector(`[data-team-name-wrap="${teamKey}"]`);
  if (!wrap) return;
  const current = state.teamsState.teamNames[teamKey] || '';
  wrap.innerHTML = `<input class="search-input" data-team-name-input="${teamKey}" value="${current}" maxlength="32" />`;
  const input = wrap.querySelector('input');
  input?.focus();
  input?.select();
}

function saveTeamName(teamKey, rawValue) {
  if (!state.teamsState.teamNames[teamKey]) return;
  const value = String(rawValue || '').trim();
  state.teamsState.teamNames[teamKey] = value || `Команда ${teamKey.replace('team', '')}`;
  ensureActiveMatchState();
  saveLobby();
  renderAndSync();
}

async function ensurePlayersLoaded({ force = false } = {}) {
  const btn = $('loadPlayersBtn');
  const original = btn?.textContent || 'Завантажити гравців';
  const league = normalizeLeague($('leagueSelect')?.value || state.app.league);

  state.app.league = league;
  localStorage.setItem(LEAGUE_KEY, league);
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Завантаження…';
  }
  setStatus({ state: 'saving', text: 'Завантаження…', retryVisible: false });

  try {
    const loaded = await loadPlayers(league, { force, timeoutMs: 15000 });
    state.playersState.players = normalizeLoadedPlayers(loaded);
    setStatus({ state: 'saved', text: `✅ Завантажено: ${state.playersState.players.length} гравців`, retryVisible: false });
    renderAndSync();
  } catch (error) {
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
    state.app.league = normalizeLeague(e.target.value);
    localStorage.setItem(LEAGUE_KEY, state.app.league);
    state.playersState.players = [];
    state.playersState.selected = [];
    syncSelectedMap();
    clearTeams();
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
  $('manualBtn')?.addEventListener('click', () => { state.app.mode = 'manual'; syncSelectedFromTeamsAndBench(); ensureActiveMatchState(); saveLobby(); renderAndSync(); });
  $('clearLobbyBtn')?.addEventListener('click', () => { state.playersState.selected = []; syncSelectedMap(); clearTeams(); ensureActiveMatchState(); saveLobby(); renderAndSync(); });

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
      state.matchState.match[id] = e.target.value.trim();
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
    onChanged() { syncSelectedFromTeamsAndBench(); ensureActiveMatchState(); saveLobby(); renderAndSync(); },
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

  state.app.league = normalizeLeague(localStorage.getItem(LEAGUE_KEY) || state.app.league);
  state.lastSavedGame = readLastSavedGame();
  $('leagueSelect').value = state.app.league;
  $('sortMode').value = state.app.sortMode;
  syncSelectedMap();
  ensureActiveMatchState();
  syncSeriesMirror();
  renderAndSync();
}

init();
