import { state, normalizeLeague, getSelectedPlayers, computeSeriesSummary, syncSelectedMap, rankLetterForPoints } from './state.js';
import { autoBalance2, balanceIntoNTeams } from './balance.js';
import { clearTeams, syncSelectedFromTeamsAndBench } from './manual.js';
import { render, bindUiEvents } from './ui.js';
import { loadPlayers, saveMatch } from './api.js';
import { saveLobby, restoreLobby, peekLobbyRestore } from './storage.js';
import { setStatus, lockSaveButton } from './status.js';

const $ = (id) => document.getElementById(id);
const TEAM_KEYS = ['team1', 'team2', 'team3', 'team4'];
const LEAGUE_KEY = 'balance2:league';
let saveLocked = false;

function syncSeriesMirror() {
  const rounds = Array.isArray(state.seriesRounds) ? state.seriesRounds.slice(0, 7) : Array(7).fill(null);
  while (rounds.length < 7) rounds.push(null);
  state.seriesRounds = rounds;
  state.series = rounds.map((value) => (value === null ? '-' : String(value)));
}

function normalizeLoadedPlayers(players = []) {
  return players.map((player) => {
    const points = Number(player.points ?? player.pts) || 0;
    return {
      ...player,
      points,
      pts: points,
      rank: String(player.rank || rankLetterForPoints(points)),
    };
  });
}

function setTeamCount(rawValue) {
  state.teamCount = Math.min(4, Math.max(2, Number(rawValue) || 2));
  TEAM_KEYS.slice(state.teamCount).forEach((key) => { state.teams[key] = []; });
  state.seriesRounds = state.seriesRounds.map((value) => {
    const numeric = Number(value);
    if (value === null) return null;
    if (numeric === 0 || (numeric >= 1 && numeric <= state.teamCount)) return numeric;
    return null;
  });
  syncSeriesMirror();
}

function runBalance() {
  const selected = getSelectedPlayers();
  clearTeams();
  if (state.teamCount === 2) {
    const t = autoBalance2(selected);
    state.teams.team1 = t.team1.map((p) => p.nick);
    state.teams.team2 = t.team2.map((p) => p.nick);
  } else {
    const t = balanceIntoNTeams(selected, state.teamCount);
    TEAM_KEYS.forEach((key) => {
      state.teams[key] = (t[key] || []).map((p) => p.nick);
    });
  }
  state.mode = 'auto';
  saveLobby();
}

function toPenaltiesString() {
  return Object.entries(state.match.penalties)
    .filter(([, v]) => Number(v))
    .map(([n, v]) => `${n}:${v}`)
    .join(',');
}

function syncSaveButtonState() {
  const btn = $('saveBtn');
  if (!btn) return;
  const keys = TEAM_KEYS.slice(0, state.teamCount);
  const hasTeams = keys.every((key) => state.teams[key].length > 0);
  const canSave = hasTeams && computeSeriesSummary().played >= 3;
  btn.disabled = saveLocked || !canSave;
}

function renderAndSync() {
  render();
  syncSaveButtonState();
}

function buildPayload() {
  const summary = computeSeriesSummary();
  state.match.series = summary.series;
  state.match.winner = summary.winner;
  return {
    league: state.league,
    team1: state.teams.team1.join(', '),
    team2: state.teams.team2.join(', '),
    team3: state.teamCount >= 3 ? state.teams.team3.join(', ') : '',
    team4: state.teamCount >= 4 ? state.teams.team4.join(', ') : '',
    winner: summary.winner,
    mvp1: state.match.mvp1,
    mvp2: state.match.mvp2,
    mvp3: state.match.mvp3,
    penalties: toPenaltiesString(),
    series: summary.series,
  };
}

function applySavedPlayers(updatedPlayers = []) {
  const byNick = new Map(updatedPlayers.map((p) => [String(p.nick || p.nickname || '').trim(), p]));
  state.players = state.players.map((player) => {
    const next = byNick.get(player.nick);
    if (!next) return player;
    const points = Number(next.points ?? player.points ?? player.pts) || 0;
    return {
      ...player,
      points,
      pts: points,
      rank: String(next.rank || rankLetterForPoints(points)),
    };
  });
}

function validateSave() {
  const keys = TEAM_KEYS.slice(0, state.teamCount);
  if (!keys.every((key) => state.teams[key].length > 0)) return 'Команди не заповнені';
  if (computeSeriesSummary().played < 3) return 'Потрібно мінімум 3 зіграні бої';
  return '';
}

async function doSave(retry = false) {
  const error = validateSave();
  if (error) return setStatus({ state: 'error', text: `❌ Помилка: ${error}`, retryVisible: false });
  const payload = retry ? state.lastPayload : buildPayload();
  state.lastPayload = payload;
  saveLocked = true;
  lockSaveButton(true);
  syncSaveButtonState();
  setStatus({ state: 'saving', text: 'Зберігаю…', retryVisible: false });
  const res = await saveMatch(payload, 14000);
  if (res.ok) {
    applySavedPlayers(res.data?.players || []);
    try {
      state.cache[state.league] = [];
      state.players = normalizeLoadedPlayers(await loadPlayers(state.league));
    } catch (_) {
      // fallback: list is already updated from save response
    }
    setStatus({ state: 'saved', text: `✅ Збережено (${new Date().toLocaleTimeString('uk-UA')})`, retryVisible: false });
    renderAndSync();
  } else {
    setStatus({ state: 'error', text: `❌ Помилка: ${res.message || 'Не вдалося зберегти'}`, retryVisible: true });
  }
  saveLocked = false;
  lockSaveButton(false);
  syncSaveButtonState();
}

function toggleSelectedPlayer(nick) {
  if (state.selectedMap.has(nick)) {
    state.selected = state.selected.filter((n) => n !== nick);
    Object.keys(state.teams).forEach((k) => { state.teams[k] = state.teams[k].filter((n) => n !== nick); });
  } else if (state.selected.length < 15) {
    state.selected = [...state.selected, nick];
  }
  syncSelectedMap();
}

function startRenameTeam(teamKey) {
  const wrap = document.querySelector(`[data-team-name-wrap="${teamKey}"]`);
  if (!wrap) return;
  const current = state.teamNames[teamKey] || '';
  wrap.innerHTML = `<input class="search-input" data-team-name-input="${teamKey}" value="${current}" maxlength="32" />`;
  const input = wrap.querySelector('input');
  input.focus();
  input.select();
}

function saveTeamName(teamKey, rawValue) {
  if (!state.teamNames[teamKey]) return;
  const value = String(rawValue || '').trim();
  state.teamNames[teamKey] = value || `Команда ${teamKey.replace('team', '')}`;
  saveLobby();
  renderAndSync();
}

async function init() {
  if (peekLobbyRestore()) $('restoreCard').classList.remove('hidden');
  else $('restoreCard').classList.add('hidden');

  $('restoreBtn').addEventListener('click', async () => {
    if (restoreLobby()) {
      const restored = Array.isArray(state.series) ? state.series.slice(0, 7) : [];
      while (restored.length < 7) restored.push('-');
      state.seriesRounds = restored.map((value) => {
        const numeric = Number(value);
        return value === '-' || Number.isNaN(numeric) ? null : numeric;
      });
      syncSeriesMirror();
      $('leagueSelect').value = state.league;
      $('sortMode').value = state.sortMode;
      await ensurePlayersLoaded();
      renderAndSync();
      $('restoreCard').classList.add('hidden');
    }
  });

  $('leagueSelect').addEventListener('change', (e) => {
    state.league = normalizeLeague(e.target.value);
    localStorage.setItem(LEAGUE_KEY, state.league);
    state.players = [];
    state.selected = [];
    syncSelectedMap();
    clearTeams();
    saveLobby();
    renderAndSync();
  });

  $('sortMode').addEventListener('change', (e) => {
    state.sortMode = e.target.value;
    saveLobby();
    renderAndSync();
  });

  $('loadPlayersBtn').addEventListener('click', ensurePlayersLoaded);
  $('balanceBtn').addEventListener('click', () => { runBalance(); renderAndSync(); });
  $('manualBtn').addEventListener('click', () => { state.mode = 'manual'; syncSelectedFromTeamsAndBench(); saveLobby(); renderAndSync(); });
  $('clearLobbyBtn').addEventListener('click', () => { state.selected = []; syncSelectedMap(); clearTeams(); saveLobby(); renderAndSync(); });

  const debouncedSearch = (() => {
    let t;
    return (value) => {
      clearTimeout(t);
      t = setTimeout(() => { state.query = value; renderAndSync(); }, 180);
    };
  })();
  $('searchInput').addEventListener('input', (e) => debouncedSearch(e.target.value));

  ['mvp1', 'mvp2', 'mvp3'].forEach((id) => {
    $(id).addEventListener('input', (e) => { state.match[id] = e.target.value.trim(); saveLobby(); });
  });

  $('saveBtn').addEventListener('click', () => doSave(false));
  $('retrySaveBtn').addEventListener('click', () => doSave(true));

  bindUiEvents({
    onTogglePlayer(nick) {
      toggleSelectedPlayer(nick);
      saveLobby();
      renderAndSync();
    },
    onRemove(nick) {
      state.selected = state.selected.filter((n) => n !== nick);
      syncSelectedMap();
      Object.keys(state.teams).forEach((k) => { state.teams[k] = state.teams[k].filter((n) => n !== nick); });
      saveLobby();
      renderAndSync();
    },
    onTeamCount(count) {
      setTeamCount(count);
      saveLobby();
      renderAndSync();
    },
    onSeriesResult(idx, val) {
      const rounds = Array.isArray(state.seriesRounds) ? state.seriesRounds.slice(0, 7) : Array(7).fill(null);
      while (rounds.length < 7) rounds.push(null);
      if (idx < 0 || idx >= state.seriesCount) return;
      const parsed = Number(val);
      const nextVal = parsed === 0 || (parsed >= 1 && parsed <= state.teamCount) ? parsed : null;
      rounds[idx] = nextVal;
      state.seriesRounds = rounds;
      syncSeriesMirror();
      const summary = computeSeriesSummary();
      state.match.winner = summary.winner;
      state.match.series = summary.series;
      saveLobby();
      renderAndSync();
    },
    onSeriesCount(count) {
      state.seriesCount = Math.min(7, Math.max(3, Number(count) || 3));
      syncSeriesMirror();
      saveLobby();
      renderAndSync();
    },
    onSeriesReset() {
      const rounds = Array.isArray(state.seriesRounds) ? state.seriesRounds.slice(0, 7) : Array(7).fill(null);
      for (let i = 0; i < state.seriesCount; i += 1) rounds[i] = null;
      state.seriesRounds = rounds;
      syncSeriesMirror();
      const summary = computeSeriesSummary();
      state.match.winner = summary.winner;
      state.match.series = summary.series;
      saveLobby();
      renderAndSync();
    },
    onPenalty(nick, delta) {
      state.match.penalties[nick] = Number(state.match.penalties[nick] || 0) + delta;
      saveLobby();
      renderAndSync();
    },
    onRenameStart(teamKey) { startRenameTeam(teamKey); },
    onRenameSave(teamKey, value) { saveTeamName(teamKey, value); },
    onChanged() { saveLobby(); renderAndSync(); },
  });

  state.league = normalizeLeague(localStorage.getItem(LEAGUE_KEY) || state.league);
  $('leagueSelect').value = state.league;
  $('sortMode').value = state.sortMode;
  syncSelectedMap();
  syncSeriesMirror();
  renderAndSync();
}

async function ensurePlayersLoaded() {
  const btn = $('loadPlayersBtn');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Завантаження…';
  setStatus({ state: 'saving', text: 'Завантаження…', retryVisible: false });
  try {
    const league = normalizeLeague($('leagueSelect')?.value || state.league);
    state.league = league;
    localStorage.setItem(LEAGUE_KEY, state.league);
    state.players = normalizeLoadedPlayers(await loadPlayers(league));
    setStatus({ state: 'saved', text: `✅ Завантажено: ${state.players.length} гравців`, retryVisible: false });
  } catch (e) {
    setStatus({ state: 'error', text: `❌ Помилка: ${e.message}`, retryVisible: false });
  } finally {
    btn.disabled = false;
    btn.textContent = original;
    renderAndSync();
  }
}

init();
