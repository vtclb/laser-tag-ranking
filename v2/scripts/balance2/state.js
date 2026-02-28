export const state = {
  league: 'sundaygames',
  teamsCount: 2,
  mode: 'auto',
  query: '',
  players: [],
  selected: [],
  teams: { team1: [], team2: [], team3: [] },
  match: { winner: '', mvp1: '', mvp2: '', mvp3: '', series: '', seriesRounds: ['', '', ''], penalties: {} },
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

export function getParticipants() {
  const keys = ['team1', 'team2', 'team3'].slice(0, state.teamsCount);
  return keys.flatMap((k) => state.teams[k]);
}

export function computeSeriesSummary() {
  const rounds = Array.isArray(state.match.seriesRounds) ? state.match.seriesRounds : [];
  const selected = rounds.filter((r) => r === '1' || r === '2' || r === '0');
  const wins1 = selected.filter((r) => r === '1').length;
  const wins2 = selected.filter((r) => r === '2').length;
  const draws = selected.filter((r) => r === '0').length;
  let winner = 'tie';
  if (wins1 > wins2) winner = 'team1';
  else if (wins2 > wins1) winner = 'team2';
  return {
    wins1,
    wins2,
    draws,
    winner,
    selected,
    series: selected.join(''),
  };
}
