import { state, normalizeLeague, computeSeriesSummary, syncSelectedMap } from './state.js';

const KEY = 'balance2:lobby';
const PLAYERS_KEY = 'balance2:playersCache';

export function saveLobby() {
  const data = {
    league: state.league,
    teamCount: state.teamCount,
    selected: state.selected,
    teams: state.teams,
    teamNames: state.teamNames,
    mode: state.mode,
    sortMode: state.sortMode,
    seriesCount: state.seriesCount,
    series: state.series,
    match: state.match,
  };
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function peekLobbyRestore() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

export function restoreLobby() {
  const data = peekLobbyRestore();
  if (!data) return false;
  state.league = normalizeLeague(data.league);
  state.teamCount = Math.min(4, Math.max(2, Number(data.teamCount || data.teamsCount) || 2));
  state.selected = Array.isArray(data.selected) ? data.selected.slice(0, 15) : [];
  syncSelectedMap();
  state.teams = {
    team1: Array.isArray(data?.teams?.team1) ? data.teams.team1 : [],
    team2: Array.isArray(data?.teams?.team2) ? data.teams.team2 : [],
    team3: Array.isArray(data?.teams?.team3) ? data.teams.team3 : [],
    team4: Array.isArray(data?.teams?.team4) ? data.teams.team4 : [],
  };
  state.teamNames = {
    team1: String(data?.teamNames?.team1 || 'Team 1').trim() || 'Team 1',
    team2: String(data?.teamNames?.team2 || 'Team 2').trim() || 'Team 2',
    team3: String(data?.teamNames?.team3 || 'Team 3').trim() || 'Team 3',
    team4: String(data?.teamNames?.team4 || 'Team 4').trim() || 'Team 4',
  };
  ['team1', 'team2', 'team3', 'team4'].slice(state.teamCount).forEach((key) => { state.teams[key] = []; });
  state.mode = data.mode === 'manual' ? 'manual' : 'auto';
  state.sortMode = ['name_asc', 'name_desc', 'points_desc', 'points_asc'].includes(data?.sortMode) ? data.sortMode : 'name_asc';
  state.seriesCount = Math.min(7, Math.max(3, Number(data?.seriesCount) || 3));
  const restoredSeries = Array.isArray(data?.series) ? data.series.slice(0, 7) : [];
  state.series = restoredSeries.map((v) => (['0', '1', '2', '3', '4'].includes(v) ? v : '-'));
  while (state.series.length < 7) state.series.push('-');
  state.match = {
    winner: data?.match?.winner || '',
    mvp1: data?.match?.mvp1 || '',
    mvp2: data?.match?.mvp2 || '',
    mvp3: data?.match?.mvp3 || '',
    series: data?.match?.series || '',
    penalties: data?.match?.penalties && typeof data.match.penalties === 'object' ? data.match.penalties : {},
  };

  if (!Array.isArray(data?.series) && Array.isArray(data?.match?.seriesRounds)) {
    const legacy = data.match.seriesRounds.slice(0, 7).map((v) => (['0', '1', '2', '3', '4'].includes(v) ? v : '-'));
    while (legacy.length < 7) legacy.push('-');
    state.series = legacy;
    state.seriesCount = Math.min(7, Math.max(3, Number(legacy.filter((v) => v !== '-').length) || 3));
  }

  const summary = computeSeriesSummary();
  state.match.winner = summary.winner;
  state.match.series = summary.series;
  return true;
}

export function savePlayersCache() {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(state.cache));
}

export function loadPlayersCache() {
  try {
    const data = JSON.parse(localStorage.getItem(PLAYERS_KEY) || '{}');
    if (data && typeof data === 'object') state.cache = data;
  } catch {
    state.cache = {};
  }
}
