import test from 'node:test';
import assert from 'node:assert/strict';

import {
  state,
  TEAM_KEYS,
  syncSelectedMap,
} from '../v2/scripts/balance2/state.js';
import { restoreLobby } from '../v2/scripts/balance2/storage.js';

const LOBBY_KEY = 'balance2:lobby';

class LocalStorageMock {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

globalThis.localStorage = new LocalStorageMock();

const defaultTournamentState = structuredClone(state.tournamentState);

function resetBalanceState() {
  localStorage.clear();
  state.app.league = 'kids';
  state.app.playerSourceMode = 'kids';
  state.app.mode = 'auto';
  state.app.eventMode = 'tournament';
  state.app.sortMode = 'points_desc';
  state.app.query = '';
  state.playersState.selected = [];
  state.playersState.players = [];
  state.playersState.playersLoaded = false;
  syncSelectedMap();
  state.teamsState.teamCount = 2;
  state.teamsState.teams = Object.fromEntries(TEAM_KEYS.map((key) => [key, []]));
  state.teamsState.teamNames = Object.fromEntries(TEAM_KEYS.map((key, idx) => [key, `Команда ${idx + 1}`]));
  state.matchState.seriesCount = 3;
  state.matchState.seriesRounds = Array(10).fill(null);
  state.matchState.series = Array(10).fill('-');
  state.matchState.match = { winner: '', series: '', mvp1: '', mvp2: '', mvp3: '', mvp1Key: '', mvp2Key: '', mvp3Key: '', penalties: {} };
  state.tournamentState = structuredClone(defaultTournamentState);
  state.activeTeamAId = 'team1';
  state.activeTeamBId = 'team2';
  state.uiState = { penaltiesCollapsed: true };
}

function writeLobbySnapshot(snapshot) {
  localStorage.setItem(LOBBY_KEY, JSON.stringify(snapshot));
}

test('restoreLobby preserves mixed tournament source, tournament fields, MVP keys and 50/12 state', () => {
  resetBalanceState();
  const selected = Array.from({ length: 50 }, (_, idx) => `p${idx + 1}`);
  const teams = Object.fromEntries(TEAM_KEYS.map((key, idx) => [key, [`p${idx + 1}`]]));
  const teamNames = Object.fromEntries(TEAM_KEYS.map((key, idx) => [key, `Squad ${idx + 1}`]));
  const tournamentSchedule = [
    { gameId: 'G001', teamA: 'team1', teamB: 'team2', status: 'completed' },
    { gameId: 'G002', teamA: 'team3', teamB: 'team4', status: 'pending' },
  ];

  writeLobbySnapshot({
    app: {
      league: 'kids',
      mode: 'manual',
      eventMode: 'tournament',
      playerSourceMode: 'mixed',
      sortMode: 'name_asc',
    },
    playersState: { selected },
    teamsState: { teamCount: 12, teams, teamNames },
    matchState: {
      seriesCount: 10,
      series: ['1', '2', '0'],
      match: {
        winner: 'team1',
        series: '120',
        mvp1: 'Alex',
        mvp2: 'Sam',
        mvp3: 'Kim',
        mvp1Key: 'kids:alex',
        mvp2Key: 'sg:sam',
        mvp3Key: 'kids:kim',
        penalties: { p1: 1 },
      },
    },
    tournamentState: {
      tournamentId: 'T-123',
      tournamentName: 'May Cup',
      tournamentTitle: 'May Cup title',
      gameMode: 'TR',
      teamsSaved: true,
      savedTournamentTeamIds: TEAM_KEYS,
      tournamentType: 'group',
      tournamentSchedule,
      games: [{ gameId: 'G001' }],
      teams: [{ teamId: 'team1' }],
      createdAt: '2026-05-25T20:00:00.000Z',
      updatedAt: '2026-05-25T21:00:00.000Z',
      currentScheduleGameId: 'G002',
      gamesCreated: true,
      currentGameId: 'G002',
      nextGameNumber: 7,
      isSaving: true,
      status: { message: 'Ready', type: 'success' },
      lastAction: 'saveTeams',
      lastRequestStatus: 'OK',
      lastErrorMessage: '',
    },
    activeTeamAId: 'team3',
    activeTeamBId: 'team4',
    uiState: { penaltiesCollapsed: false },
  });

  assert.equal(restoreLobby(), true);
  assert.equal(state.app.playerSourceMode, 'mixed');
  assert.equal(state.app.eventMode, 'tournament');
  assert.equal(state.teamsState.teamCount, 12);
  assert.equal(state.playersState.selected.length, 50);
  assert.deepEqual(state.playersState.selected, selected);
  assert.equal(Object.keys(state.teamsState.teams).length, 12);
  assert.deepEqual(state.teamsState.teams.team12, ['p12']);
  assert.equal(state.teamsState.teamNames.team12, 'Squad 12');
  assert.equal(state.matchState.seriesCount, 10);
  assert.equal(state.matchState.match.mvp1Key, 'kids:alex');
  assert.equal(state.matchState.match.mvp2Key, 'sg:sam');
  assert.equal(state.matchState.match.mvp3Key, 'kids:kim');
  assert.equal(state.tournamentState.tournamentType, 'group');
  assert.equal(state.tournamentState.tournamentTitle, 'May Cup title');
  assert.deepEqual(state.tournamentState.savedTournamentTeamIds, TEAM_KEYS);
  assert.deepEqual(state.tournamentState.tournamentSchedule, tournamentSchedule);
  assert.deepEqual(state.tournamentState.games, [{ gameId: 'G001' }]);
  assert.deepEqual(state.tournamentState.teams, [{ teamId: 'team1' }]);
  assert.equal(state.tournamentState.createdAt, '2026-05-25T20:00:00.000Z');
  assert.equal(state.tournamentState.updatedAt, '2026-05-25T21:00:00.000Z');
  assert.equal(state.tournamentState.currentScheduleGameId, 'G002');
  assert.equal(state.tournamentState.currentGameId, 'G002');
  assert.deepEqual(state.tournamentState.status, { message: 'Ready', type: 'success' });
  assert.equal(state.tournamentState.lastAction, 'saveTeams');
  assert.equal(state.tournamentState.lastRequestStatus, 'OK');
  assert.equal(state.tournamentState.isSaving, false);
  assert.equal(state.activeTeamAId, 'team3');
  assert.equal(state.activeTeamBId, 'team4');
});

test('restoreLobby keeps old snapshots backward compatible', () => {
  resetBalanceState();
  writeLobbySnapshot({
    app: { eventMode: 'tournament' },
    selected: ['p1', 'p2'],
    teamCount: 6,
    teams: { team1: ['p1'], team6: ['p2'] },
    match: { mvp1: 'Old MVP' },
    tournamentState: { tournamentId: 'OLD-1', teamsSaved: true },
  });

  assert.equal(restoreLobby(), true);
  assert.equal(state.app.playerSourceMode, 'kids');
  assert.equal(state.teamsState.teamCount, 6);
  assert.deepEqual(state.teamsState.teams.team1, ['p1']);
  assert.deepEqual(state.teamsState.teams.team6, ['p2']);
  assert.deepEqual(state.teamsState.teams.team12, []);
  assert.equal(state.matchState.match.mvp1, 'Old MVP');
  assert.equal(state.matchState.match.mvp1Key, '');
  assert.equal(state.tournamentState.tournamentId, 'OLD-1');
  assert.equal(state.tournamentState.teamsSaved, true);
  assert.equal(state.tournamentState.tournamentType, 'custom');
  assert.deepEqual(state.tournamentState.savedTournamentTeamIds, []);
});

test('restoreLobby ignores corrupted tournamentState safely', () => {
  resetBalanceState();
  writeLobbySnapshot({
    app: { eventMode: 'tournament', playerSourceMode: 'mixed' },
    playersState: { selected: ['p1'] },
    teamsState: { teamCount: 12, teams: { team12: ['p1'] } },
    tournamentState: 'not an object',
  });

  assert.equal(restoreLobby(), true);
  assert.equal(state.app.playerSourceMode, 'mixed');
  assert.equal(state.teamsState.teamCount, 12);
  assert.deepEqual(state.teamsState.teams.team12, ['p1']);
  assert.equal(state.tournamentState.tournamentId, '');
  assert.equal(state.tournamentState.tournamentType, 'custom');
  assert.deepEqual(state.tournamentState.tournamentSchedule, []);
  assert.deepEqual(state.tournamentState.status, { message: '', type: 'idle' });
});
