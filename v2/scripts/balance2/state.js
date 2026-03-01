export const state = {
  league: 'sundaygames',
  teamCount: 2,
  mode: 'auto',
  query: '',
  sortMode: 'name_asc',
  seriesCount: 3,
  series: ['-', '-', '-', '-', '-', '-', '-'],
  players: [],
  selected: [],
  selectedMap: new Set(),
  teams: { team1: [], team2: [], team3: [], team4: [] },
  teamNames: { team1: 'Команда 1', team2: 'Команда 2', team3: 'Команда 3', team4: 'Команда 4' },
  match: { winner: '', mvp1: '', mvp2: '', mvp3: '', series: '', penalties: {} },
  lastPayload: null,
  cache: {},
};

export function normalizeLeague(league) {
  const key = String(league || '').trim().toLowerCase();
  return key === 'kids' ? 'kids' : 'sundaygames';
}

export function getSelectedPlayers() {
  const map = new Map(state.players.map((p) => [p.nick, p]));
  return state.selected.map((nick) => map.get(nick)).filter(Boolean);
}

export function syncSelectedMap() {
  state.selectedMap = new Set(state.selected);
}

export function isSelected(nick) {
  return state.selectedMap.has(nick);
}

export function getTeamLabel(teamKey) {
  return state.teamNames[teamKey] || teamKey.toUpperCase();
}

export function getParticipants() {
  const keys = ['team1', 'team2', 'team3', 'team4'].slice(0, state.teamCount);
  return keys.flatMap((k) => state.teams[k]);
}

export function computeSeriesSummary() {
  const rounds = Array.isArray(state.series) ? state.series.slice(0, 7) : [];
  const count = Math.min(7, Math.max(3, Number(state.seriesCount) || 3));
  const allowed = ['0', '1', '2', '3', '4'];
  const normalized = rounds.map((r) => (allowed.includes(r) ? r : '-'));
  while (normalized.length < 7) normalized.push('-');
  const active = normalized.slice(0, count);
  const wins = {
    team1: active.filter((r) => r === '1').length,
    team2: active.filter((r) => r === '2').length,
    team3: active.filter((r) => r === '3').length,
    team4: active.filter((r) => r === '4').length,
  };
  const draws = active.filter((r) => r === '0').length;
  const played = Object.values(wins).reduce((acc, value) => acc + value, 0) + draws;
  const activeTeamKeys = ['team1', 'team2', 'team3', 'team4'].slice(0, state.teamCount);
  const maxWins = Math.max(...activeTeamKeys.map((key) => wins[key]), 0);
  const leaders = activeTeamKeys.filter((key) => wins[key] === maxWins);
  const winner = maxWins > 0 && leaders.length === 1 ? leaders[0] : 'tie';

  const series = active.join('').replace(/-+$/, '');

  return {
    wins,
    draws,
    played,
    winner,
    series,
  };
}
