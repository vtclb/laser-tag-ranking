export const state = {
  league: 'sundaygames',
  teamsCount: 2,
  mode: 'auto',
  query: '',
  sortMode: 'name_asc',
  seriesCount: 3,
  series: ['-', '-', '-', '-', '-', '-', '-'],
  players: [],
  selected: [],
  selectedMap: new Set(),
  teams: { team1: [], team2: [], team3: [] },
  teamNames: { team1: 'Team 1', team2: 'Team 2', team3: 'Team 3' },
  match: { winner: '', mvp1: '', mvp2: '', mvp3: '', series: '', penalties: {} },
  lastPayload: null,
  cache: {},
};

export function normalizeLeague(league) {
  const key = String(league || '').trim().toLowerCase();
  if (key === 'olds') return 'sundaygames';
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
  const keys = ['team1', 'team2', 'team3'].slice(0, state.teamsCount);
  return keys.flatMap((k) => state.teams[k]);
}

export function computeSeriesSummary() {
  const rounds = Array.isArray(state.series) ? state.series.slice(0, 7) : [];
  const count = Math.min(7, Math.max(3, Number(state.seriesCount) || 3));
  const normalized = rounds.map((r) => (r === '1' || r === '2' || r === '0' ? r : '-'));
  while (normalized.length < 7) normalized.push('-');
  const active = normalized.slice(0, count);
  const wins1 = active.filter((r) => r === '1').length;
  const wins2 = active.filter((r) => r === '2').length;
  const draws = active.filter((r) => r === '0').length;
  const played = wins1 + wins2 + draws;
  let winner = 'tie';
  if (wins1 > wins2) winner = 'team1';
  else if (wins2 > wins1) winner = 'team2';

  const series = active.join('').replace(/-+$/, '');

  return {
    wins1,
    wins2,
    draws,
    played,
    winner,
    series,
  };
}
