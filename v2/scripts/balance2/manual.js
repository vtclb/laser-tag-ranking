import { state, syncSelectedMap } from './state.js';

export function clearTeams() {
  state.teams.team1 = [];
  state.teams.team2 = [];
  state.teams.team3 = [];
}

export function syncSelectedFromTeamsAndBench() {
  const inTeams = new Set(Object.values(state.teams).flat());
  const withBench = [...inTeams];
  for (const nick of state.selected) {
    if (!inTeams.has(nick)) withBench.push(nick);
  }
  state.selected = [...new Set(withBench)].slice(0, 15);
  syncSelectedMap();
}

export function movePlayerToTeam(nick, teamKey) {
  Object.keys(state.teams).forEach((k) => {
    state.teams[k] = state.teams[k].filter((n) => n !== nick);
  });
  if (teamKey && state.teams[teamKey]) {
    state.teams[teamKey].push(nick);
    state.mode = 'manual';
  }
  syncSelectedFromTeamsAndBench();
}
