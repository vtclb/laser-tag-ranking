export const state = {
  league: 'kids',
  teamCount: 2,
  mode: 'auto',
  query: '',
  sortMode: 'name_asc',
  seriesCount: 3,
  seriesRounds: Array(7).fill(null),
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

export function rankLetterForPoints(points) {
  const pts = Number(points);
  if (!Number.isFinite(pts)) return 'F';
  if (pts >= 1000) return 'S';
  if (pts >= 900) return 'A';
  if (pts >= 800) return 'B';
  if (pts >= 700) return 'C';
  if (pts >= 600) return 'D';
  if (pts >= 500) return 'E';
  return 'F';
}

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
  const hasRoundValues = Array.isArray(state.seriesRounds) && state.seriesRounds.some((value) => value !== null && value !== undefined);
  const rounds = hasRoundValues
    ? state.seriesRounds.slice(0, 7)
    : (Array.isArray(state.series) ? state.series.slice(0, 7) : []);
  const count = Math.min(7, Math.max(3, Number(state.seriesCount) || 3));
  const normalized = rounds.map((r) => {
    const value = Number(r);
    if (r === null || Number.isNaN(value)) return null;
    if (value === 0) return 0;
    if (value >= 1 && value <= 4) return value;
    return null;
  });
  while (normalized.length < 7) normalized.push(null);
  const active = normalized.slice(0, count);
  const wins = {
    team1: active.filter((r) => r === 1).length,
    team2: active.filter((r) => r === 2).length,
    team3: active.filter((r) => r === 3).length,
    team4: active.filter((r) => r === 4).length,
  };
  const draws = active.filter((r) => r === 0).length;
  const played = Object.values(wins).reduce((acc, value) => acc + value, 0) + draws;
  const activeTeamKeys = ['team1', 'team2', 'team3', 'team4'].slice(0, state.teamCount);
  const maxWins = Math.max(...activeTeamKeys.map((key) => wins[key]), 0);
  const leaders = activeTeamKeys.filter((key) => wins[key] === maxWins);
  const winner = maxWins > 0 && leaders.length === 1 ? leaders[0] : 'tie';

  const series = active.map((r) => (r === null ? '-' : String(r))).join('').replace(/-+$/, '');

  return {
    wins,
    draws,
    played,
    winner,
    series,
  };
}
