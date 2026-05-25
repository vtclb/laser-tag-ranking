import { MAX_LOBBY_PLAYERS, MAX_TEAM_COUNT } from './state.js';

export const EVENT_MODE_LIMITS = {
  tournament: {
    maxPlayers: MAX_LOBBY_PLAYERS,
    maxTeams: MAX_TEAM_COUNT,
  },
  school: {
    maxPlayers: 50,
    minTeams: 10,
    maxTeams: 10,
    groupCount: 2,
    teamsPerGroup: 5,
    directQualifiersPerGroup: 2,
    finalMinTeams: 4,
    finalMaxTeams: 5,
    minManualPoints: 0,
    maxManualPoints: 10,
  },
};

export function getEventModeLimits(eventMode = 'tournament') {
  return EVENT_MODE_LIMITS[eventMode === 'school' ? 'school' : 'tournament'];
}
