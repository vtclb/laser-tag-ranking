const TEAM_KEYS = ['team1', 'team2', 'team3', 'team4'];

export const state = {
  league: 'sundaygames',
  balanceMode: 'auto',
  teamsCount: 4,
  players: [],
  lobbyPlayers: [],
  teams: {
    team1: [],
    team2: [],
    team3: [],
    team4: [],
  },
};

function replaceArrayContents(target, source) {
  target.length = 0;
  if (Array.isArray(source) && source.length) {
    target.push(...source);
  }
  return target;
}

export function getTeamKeys() {
  return [...TEAM_KEYS];
}

export function getTeamKey(team) {
  if (TEAM_KEYS.includes(team)) {
    return team;
  }
  const asString = String(team ?? '').trim();
  if (!asString) {
    return null;
  }
  const numeric = Number.parseInt(asString.replace(/^team/, ''), 10);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= TEAM_KEYS.length) {
    return TEAM_KEYS[numeric - 1];
  }
  return null;
}

export function getTeamNumber(team) {
  if (TEAM_KEYS.includes(team)) {
    return TEAM_KEYS.indexOf(team) + 1;
  }
  const asString = String(team ?? '').trim();
  if (!asString) {
    return null;
  }
  const numeric = Number.parseInt(asString.replace(/^team/, ''), 10);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= TEAM_KEYS.length) {
    return numeric;
  }
  return null;
}

export function setLeague(league) {
  if (typeof league === 'string' && league.trim()) {
    state.league = league.trim();
  }
  return state.league;
}

export function setBalanceMode(mode) {
  state.balanceMode = mode === 'manual' ? 'manual' : 'auto';
  return state.balanceMode;
}

export function setTeamsCount(count) {
  const numeric = Number(count);
  if (Number.isInteger(numeric) && numeric >= 0) {
    state.teamsCount = Math.min(TEAM_KEYS.length, numeric);
  } else {
    state.teamsCount = 0;
  }
  return state.teamsCount;
}

export function setPlayers(players = []) {
  return replaceArrayContents(state.players, Array.isArray(players) ? players : []);
}

export function setLobbyPlayers(players = []) {
  return replaceArrayContents(state.lobbyPlayers, Array.isArray(players) ? players : []);
}

export function clearTeams() {
  TEAM_KEYS.forEach(key => {
    state.teams[key] = replaceArrayContents(state.teams[key], []);
  });
  return state.teams;
}

export function setTeamMembers(team, members = []) {
  const key = getTeamKey(team);
  if (!key) {
    return [];
  }
  return replaceArrayContents(state.teams[key], Array.isArray(members) ? members : []);
}

export function setTeams(map = {}) {
  clearTeams();
  if (!map || typeof map !== 'object') {
    return state.teams;
  }
  TEAM_KEYS.forEach((key, index) => {
    const source = [
      map[key],
      map[index + 1],
      map[`team${index + 1}`],
    ].find(Array.isArray);
    if (source) {
      replaceArrayContents(state.teams[key], source);
    }
  });
  return state.teams;
}

export function getTeamMembers(team) {
  const key = getTeamKey(team);
  return key ? state.teams[key] : [];
}
