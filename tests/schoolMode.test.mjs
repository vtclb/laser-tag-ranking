import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventModeLimits } from '../v2/scripts/balance2/config.js';
import {
  normalizeManualPoints,
  generateRoundRobinMatches,
  calculateSchoolRoundRobinStandings,
  calculateSchoolGroupStandings,
} from '../v2/scripts/balance2/schoolMode.js';
import { validateSchoolTournament } from '../v2/scripts/balance2/validation.js';
import { buildSchoolEventPayload } from '../v2/scripts/balance2/schoolPayload.js';

function mkTeams(n = 10) { return Array.from({ length: n }, (_, i) => ({ id: `team${i + 1}`, teamName: `T${i + 1}`, schoolName: `S${i + 1}`, schoolNumber: String(i + 1), players: [] })); }

test('school limits', () => {
  const school = getEventModeLimits('school');
  assert.equal(school.maxTeams, 10);
  assert.equal(school.groupCount, 2);
  assert.equal(school.teamsPerGroup, 5);
  assert.equal(school.finalMaxTeams, 5);
});

test('schedule generation for groups/final', () => {
  assert.equal(generateRoundRobinMatches(['a', 'b', 'c', 'd', 'e']).length, 10);
  assert.equal(generateRoundRobinMatches(['a', 'b', 'c', 'd'], { stage: 'final', groupId: 'FINAL' }).length, 6);
  assert.equal(generateRoundRobinMatches(['a', 'b', 'c', 'd', 'e'], { stage: 'final', groupId: 'FINAL' }).length, 10);
});

test('standings scoring', () => {
  const teams = mkTeams(2);
  const matches = [{ teamAId: 'team1', teamBId: 'team2', status: 'completed', result: { pointsA: 3, pointsB: 3 } }];
  const rows = calculateSchoolRoundRobinStandings(teams, matches);
  assert.equal(rows[0].tournamentPoints, 1);
  assert.equal(rows[1].tournamentPoints, 1);
});

test('group standings filter by group', () => {
  const teams = mkTeams(3);
  const matches = [
    { groupId: 'A', teamAId: 'team1', teamBId: 'team2', status: 'completed', result: { pointsA: 5, pointsB: 1 } },
    { groupId: 'B', teamAId: 'team3', teamBId: 'team2', status: 'completed', result: { pointsA: 2, pointsB: 1 } },
  ];
  const a = calculateSchoolGroupStandings(teams, matches, 'A');
  assert.equal(a.length, 2);
  assert.equal(a[0].teamId, 'team1');
});

test('payload + validation for school tournament', () => {
  const state = {
    schoolState: {
      eventId: 'school_1', title: 'Test', date: '2026-05-25', status: 'draft',
      teamMeta: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`team${i + 1}`, { schoolName: `School ${i + 1}`, schoolNumber: String(i + 1), teamName: `Team ${i + 1}` }])),
      groups: { A: { teamIds: ['team1', 'team2', 'team3', 'team4', 'team5'] }, B: { teamIds: ['team6', 'team7', 'team8', 'team9', 'team10'] } },
      groupMatches: [], qualifiers: { A: ['team1', 'team2'], B: ['team6', 'team7'] },
      wildcard: { enabled: false, teamId: '', selectedByAdmin: false, reason: '' },
      finalGroup: { teamIds: ['team1', 'team2', 'team6', 'team7'], matches: [], standings: [], championTeamId: '' },
      changeLog: [],
    },
    teamsState: { teamCount: 10, teams: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`team${i + 1}`, []])) },
    playersState: { players: [] },
  };
  const payload = buildSchoolEventPayload(state);
  assert.equal(payload.eventMode, 'school');
  assert.equal(payload.format, 'school_groups_final');
  assert.equal(payload.affectsPlayerRating, false);
  assert.equal(payload.teams.length, 10);
  const v = validateSchoolTournament(payload);
  assert.equal(v.ok, true);
});

test('manual points normalization', () => {
  assert.equal(normalizeManualPoints(0), 0);
  assert.equal(normalizeManualPoints(10), 10);
  assert.equal(normalizeManualPoints(11), null);
});
