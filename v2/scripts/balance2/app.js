import { state, normalizeLeague, getSelectedPlayers, computeSeriesSummary } from './state.js';
import { autoBalance2, autoBalance3 } from './balance.js';
import { clearTeams, syncSelectedFromTeamsAndBench } from './manual.js';
import { render, bindUiEvents, setActiveTab } from './ui.js';
import { loadPlayers, saveMatch } from './api.js';
import { saveLobby, restoreLobby, peekLobbyRestore } from './storage.js';
import { setStatus, lockSaveButton } from './status.js';

const $ = (id) => document.getElementById(id);
let saveLocked = false;

function runBalance() {
  const selected = getSelectedPlayers();
  clearTeams();
  if (state.teamsCount === 2) {
    const t = autoBalance2(selected);
    state.teams.team1 = t.team1.map((p) => p.nick);
    state.teams.team2 = t.team2.map((p) => p.nick);
  } else {
    const t = autoBalance3(selected);
    state.teams.team1 = t.team1.map((p) => p.nick);
    state.teams.team2 = t.team2.map((p) => p.nick);
    state.teams.team3 = t.team3.map((p) => p.nick);
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
  const hasTeams = state.teams.team1.length && state.teams.team2.length;
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
    team3: state.teamsCount === 3 ? state.teams.team3.join(', ') : '',
    winner: summary.winner,
    mvp1: state.match.mvp1,
    mvp2: state.match.mvp2,
    mvp3: state.match.mvp3,
    penalties: toPenaltiesString(),
    series: summary.series,
  };
}

function validateSave() {
  const hasTeams = state.teams.team1.length && state.teams.team2.length;
  if (!hasTeams) return 'Команди не заповнені';
  if (computeSeriesSummary().played < 3) return 'Потрібно мінімум 3 зіграні бої';
  return '';
}

async function doSave(retry = false) {
  const error = validateSave();
  if (error) return setStatus({ state: 'error', text: `ERROR ✗ ${error}`, retryVisible: false });
  const payload = retry ? state.lastPayload : buildPayload();
  state.lastPayload = payload;
  saveLocked = true;
  lockSaveButton(true);
  syncSaveButtonState();
  setStatus({ state: 'saving', text: 'SAVING…', retryVisible: false });
  const res = await saveMatch(payload, 14000);
  if (res.ok) {
    setStatus({ state: 'saved', text: `SAVED ✓ ${new Date().toLocaleTimeString('uk-UA')}`, retryVisible: false });
  } else {
    setStatus({ state: 'error', text: `ERROR ✗ ${res.message || 'Save failed'}`, retryVisible: true });
  }
  saveLocked = false;
  lockSaveButton(false);
  syncSaveButtonState();
}

async function init() {
  if (peekLobbyRestore()) $('restoreCard').classList.remove('hidden');
  else $('restoreCard').classList.add('hidden');

  $('restoreBtn').addEventListener('click', async () => {
    if (restoreLobby()) {
      $('leagueSelect').value = state.league;
      $('teamsCount').value = String(state.teamsCount);
      await ensurePlayersLoaded();
      renderAndSync();
      $('restoreCard').classList.add('hidden');
    }
  });

  $('leagueSelect').addEventListener('change', (e) => {
    state.league = normalizeLeague(e.target.value);
    saveLobby();
  });
  $('teamsCount').addEventListener('change', (e) => {
    state.teamsCount = Number(e.target.value) === 3 ? 3 : 2;
    if (state.teamsCount === 2) state.teams.team3 = [];
    saveLobby();
    renderAndSync();
  });

  $('loadPlayersBtn').addEventListener('click', ensurePlayersLoaded);
  $('balanceBtn').addEventListener('click', () => { runBalance(); renderAndSync(); });
  $('manualBtn').addEventListener('click', () => { state.mode = 'manual'; syncSelectedFromTeamsAndBench(); saveLobby(); renderAndSync(); });
  $('clearLobbyBtn').addEventListener('click', () => { state.selected = []; clearTeams(); saveLobby(); renderAndSync(); });

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

  document.querySelectorAll('.bottom-nav [data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
  });

  bindUiEvents({
    onAdd(nick) {
      if (state.selected.includes(nick) || state.selected.length >= 15) return;
      state.selected.push(nick);
      saveLobby();
      renderAndSync();
    },
    onRemove(nick) {
      state.selected = state.selected.filter((n) => n !== nick);
      Object.keys(state.teams).forEach((k) => { state.teams[k] = state.teams[k].filter((n) => n !== nick); });
      saveLobby();
      renderAndSync();
    },
    onSeriesResult(idx, val) {
      const rounds = Array.isArray(state.series) ? state.series.slice(0, 7) : ['-', '-', '-', '-', '-', '-', '-'];
      while (rounds.length < 7) rounds.push('-');
      if (idx < 0 || idx >= state.seriesCount) return;
      const nextVal = val === '1' || val === '2' || val === '0' ? val : '-';
      rounds[idx] = rounds[idx] === nextVal ? '-' : nextVal;
      state.series = rounds;
      const summary = computeSeriesSummary();
      state.match.winner = summary.winner;
      state.match.series = summary.series;
      saveLobby();
      renderAndSync();
    },
    onSeriesCount(count) {
      state.seriesCount = Math.min(7, Math.max(3, Number(count) || 3));
      saveLobby();
      renderAndSync();
    },
    onSeriesReset() {
      const rounds = Array.isArray(state.series) ? state.series.slice(0, 7) : ['-', '-', '-', '-', '-', '-', '-'];
      for (let i = 0; i < state.seriesCount; i += 1) rounds[i] = '-';
      state.series = rounds;
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
    onChanged() { saveLobby(); renderAndSync(); }
  });

  await ensurePlayersLoaded();
  renderAndSync();
  setActiveTab('teams');
}

async function ensurePlayersLoaded() {
  try {
    state.players = await loadPlayers(state.league);
  } catch (e) {
    setStatus({ state: 'error', text: `ERROR ✗ ${e.message}`, retryVisible: false });
  }
}

init();
