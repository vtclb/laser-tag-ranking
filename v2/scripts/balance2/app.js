import { state, normalizeLeague, getSelectedPlayers, computeSeriesSummary, syncSelectedMap } from './state.js';
import { autoBalance2, balanceIntoNTeams } from './balance.js';
import { clearTeams, syncSelectedFromTeamsAndBench } from './manual.js';
import { render, bindUiEvents, setActiveTab } from './ui.js';
import { loadPlayers, saveMatch } from './api.js';
import { saveLobby, restoreLobby, peekLobbyRestore } from './storage.js';
import { setStatus, lockSaveButton } from './status.js';

const $ = (id) => document.getElementById(id);
const TEAM_KEYS = ['team1', 'team2', 'team3', 'team4'];
let saveLocked = false;

function setTeamCount(rawValue) {
  state.teamCount = Math.min(4, Math.max(2, Number(rawValue) || 2));
  TEAM_KEYS.slice(state.teamCount).forEach((key) => { state.teams[key] = []; });
  state.series = state.series.map((value) => {
    if (value === '-') return value;
    const numeric = Number(value);
    if (value === '0' || (numeric >= 1 && numeric <= state.teamCount)) return value;
    return '-';
  });
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

function validateSave() {
  const keys = TEAM_KEYS.slice(0, state.teamCount);
  if (!keys.every((key) => state.teams[key].length > 0)) return 'Команди не заповнені';
  if (computeSeriesSummary().played < 3) return 'Потрібно мінімум 3 зіграні бої';
  return '';
}

async function doSave(retry = false) {
  const error = validateSave();
  if (error) return setStatus({ state: 'error', text: `Помилка ❌ ${error}`, retryVisible: false });
  const payload = retry ? state.lastPayload : buildPayload();
  state.lastPayload = payload;
  saveLocked = true;
  lockSaveButton(true);
  syncSaveButtonState();
  setStatus({ state: 'saving', text: 'Зберігаю…', retryVisible: false });
  const res = await saveMatch(payload, 14000);
  if (res.ok) {
    setStatus({ state: 'saved', text: `Збережено ✅ ${new Date().toLocaleTimeString('uk-UA')}`, retryVisible: false });
  } else {
    setStatus({ state: 'error', text: `Помилка ❌ ${res.message || 'Не вдалося зберегти'}`, retryVisible: true });
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
      $('leagueSelect').value = state.league;
      $('sortMode').value = state.sortMode;
      await ensurePlayersLoaded();
      renderAndSync();
      $('restoreCard').classList.add('hidden');
    }
  });

  $('leagueSelect').addEventListener('change', (e) => {
    state.league = normalizeLeague(e.target.value);
    saveLobby();
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

  document.querySelectorAll('.bottom-nav [data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { mode, tab } = btn.dataset;
      if (mode === 'manual') state.mode = 'manual';
      if (mode === 'auto') state.mode = 'auto';
      setActiveTab(tab);
      renderAndSync();
    });
  });

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
      const rounds = Array.isArray(state.series) ? state.series.slice(0, 7) : ['-', '-', '-', '-', '-', '-', '-'];
      while (rounds.length < 7) rounds.push('-');
      if (idx < 0 || idx >= state.seriesCount) return;
      const nextVal = ['0', '1', '2', '3', '4'].includes(val) ? val : '-';
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
    onRenameStart(teamKey) { startRenameTeam(teamKey); },
    onRenameSave(teamKey, value) { saveTeamName(teamKey, value); },
    onBackTab(tab) { setActiveTab(tab); renderAndSync(); },
    onChanged() { saveLobby(); renderAndSync(); },
  });

  $('leagueSelect').value = state.league;
  $('sortMode').value = state.sortMode;
  syncSelectedMap();
  await ensurePlayersLoaded();
  renderAndSync();
  setActiveTab('teams');
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
    state.players = await loadPlayers(league);
    setStatus({ state: 'saved', text: `Готово: ${state.players.length} гравців`, retryVisible: false });
  } catch (e) {
    setStatus({ state: 'error', text: `Помилка ❌ ${e.message}`, retryVisible: false });
  } finally {
    btn.disabled = false;
    btn.textContent = original;
    renderAndSync();
  }
}

init();
