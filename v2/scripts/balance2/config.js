import { MAX_LOBBY_PLAYERS, MAX_TEAM_COUNT } from './state.js';

export const EVENT_MODE_LIMITS = {
  tournament: {
    maxPlayers: MAX_LOBBY_PLAYERS,
    maxTeams: MAX_TEAM_COUNT,
  },
  school: {
    maxPlayers: 50,
    maxTeams: 12,
    minManualPoints: 0,
    maxManualPoints: 10,
  },
};

export function getEventModeLimits(eventMode = 'tournament') {
  return EVENT_MODE_LIMITS[eventMode === 'school' ? 'school' : 'tournament'];
}
