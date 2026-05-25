import test from 'node:test';
import assert from 'node:assert/strict';

import {
  state,
  getPlayerKey,
  syncSelectedMap,
  assignPlayerToTeam,
  removePlayerFromAllTeams,
  getMaxLobbyPlayersForEventMode,
} from '../v2/scripts/balance2/state.js';

test('balance2 player selection smoke: add, dedupe, remove, school independence', () => {
  const snapshot = {
    eventMode: state.app.eventMode,
    players: state.playersState.players,
    selected: state.playersState.selected,
    selectedMap: state.playersState.selectedMap,
    teams: state.teamsState.teams,
  };

  try {
    state.app.eventMode = 'tournament';
    state.playersState.players = [{ uid: 'p1', nick: 'P1', points: 100 }];
    state.playersState.selected = [];
    syncSelectedMap();
    state.teamsState.teams = { ...state.teamsState.teams, team1: [], team2: [] };

    assert.equal(state.playersState.selected.length, 0);

    const p1Key = getPlayerKey(state.playersState.players[0]);
    state.playersState.selected.push(p1Key);
    syncSelectedMap();
    assert.equal(state.playersState.selected.length, 1);

    if (!state.playersState.selectedMap.has(p1Key)) {
      state.playersState.selected.push(p1Key);
      syncSelectedMap();
    }
    assert.equal(state.playersState.selected.length, 1);

    assert.equal(assignPlayerToTeam(p1Key, 'team1'), true);
    assert.equal(removePlayerFromAllTeams(p1Key), true);

    state.playersState.selected = state.playersState.selected.filter((id) => id !== p1Key);
    syncSelectedMap();
    assert.equal(state.playersState.selected.length, 0);

    assert.equal(getMaxLobbyPlayersForEventMode('tournament'), getMaxLobbyPlayersForEventMode('tournament'));
  } finally {
    state.app.eventMode = snapshot.eventMode;
    state.playersState.players = snapshot.players;
    state.playersState.selected = snapshot.selected;
    state.playersState.selectedMap = snapshot.selectedMap;
    state.teamsState.teams = snapshot.teams;
  }
});
