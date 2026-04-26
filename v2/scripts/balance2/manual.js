import { state, syncSelectedMap, MAX_LOBBY_PLAYERS } from './state.js';

export function clearTeams() {
  state.teamsState.teams.team1 = [];
  state.teamsState.teams.team2 = [];
  state.teamsState.teams.team3 = [];
  state.teamsState.teams.team4 = [];
}

export function syncSelectedFromTeamsAndBench() {
  const inTeams = new Set(Object.values(state.teamsState.teams).flat());
  const withBench = [...inTeams];
  for (const nick of state.playersState.selected) {
    if (!inTeams.has(nick)) withBench.push(nick);
  }
  state.playersState.selected = [...new Set(withBench)].slice(0, MAX_LOBBY_PLAYERS);
  syncSelectedMap();
}

export function movePlayerToTeam(nick, teamKey) {
  Object.keys(state.teamsState.teams).forEach((key) => {
    state.teamsState.teams[key] = state.teamsState.teams[key].filter((playerNick) => playerNick !== nick);
  });

  if (teamKey && state.teamsState.teams[teamKey]) {
    state.teamsState.teams[teamKey].push(nick);
    state.app.mode = 'manual';
  }

  syncSelectedFromTeamsAndBench();
}
