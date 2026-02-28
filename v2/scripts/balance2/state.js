export const state = {
  league: 'sundaygames',
  teamsCount: 2,
  mode: 'auto',
  query: '',
  players: [],
  selected: [],
  teams: { team1: [], team2: [], team3: [] },
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

export function getParticipants() {
  const keys = ['team1', 'team2', 'team3'].slice(0, state.teamsCount);
  return keys.flatMap((k) => state.teams[k]);
}
