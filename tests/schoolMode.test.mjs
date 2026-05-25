import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventModeLimits } from '../v2/scripts/balance2/config.js';
import {
  normalizeManualPoints,
  generateRoundRobinMatches,
  calculateSchoolRoundRobinStandings,
  calculateSchoolGroupStandings,
  getSchoolGroupProgress,
  canFormSchoolFinalGroup,
  buildFinalGroupFromStandings,
  getWildcardCandidates,
  pickBestWildcardCandidate,
  refreshFinalGroupDerivedState,
  getFinalGroupProgress,
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

test('group match generation gives 20 matches for 2x5 groups', () => {
  const groupA = generateRoundRobinMatches(['team1', 'team2', 'team3', 'team4', 'team5'], { stage: 'group', groupId: 'A' });
  const groupB = generateRoundRobinMatches(['team6', 'team7', 'team8', 'team9', 'team10'], { stage: 'group', groupId: 'B' });
  assert.equal(groupA.length + groupB.length, 20);
});

test('group A and B each have 10 matches', () => {
  const groupA = generateRoundRobinMatches(['team1', 'team2', 'team3', 'team4', 'team5'], { stage: 'group', groupId: 'A' });
  const groupB = generateRoundRobinMatches(['team6', 'team7', 'team8', 'team9', 'team10'], { stage: 'group', groupId: 'B' });
  assert.equal(groupA.length, 10);
  assert.equal(groupB.length, 10);
});

test('completed match sets winner and draw semantics', () => {
  const match = generateRoundRobinMatches(['team1', 'team2'], { stage: 'group', groupId: 'A' })[0];
  match.status = 'completed';
  match.result.pointsA = 8;
  match.result.pointsB = 5;
  match.result.winnerTeamId = 'team1';
  assert.equal(match.status, 'completed');
  assert.equal(match.result.winnerTeamId, 'team1');
  match.result.pointsA = 4;
  match.result.pointsB = 4;
  match.result.winnerTeamId = '';
  match.result.isDraw = true;
  assert.equal(match.result.isDraw, true);
});

test('invalid completed score is blocked by validation', () => {
  const payload = {
    eventMode: 'school', eventId: 'e1', title: 'x', players: [], format: 'school_groups_final', affectsPlayerRating: false,
    teams: mkTeams(10),
    groups: { A: { teamIds: ['team1', 'team2', 'team3', 'team4', 'team5'] }, B: { teamIds: ['team6', 'team7', 'team8', 'team9', 'team10'] } },
    groupMatches: [{ title: 'Група A · Матч 1', teamAId: 'team1', teamBId: 'team2', status: 'completed', result: { pointsA: 11, pointsB: 3 } }],
    finalGroup: { teamIds: ['team1', 'team2', 'team6', 'team7'], matches: [] },
  };
  const v = validateSchoolTournament(payload);
  assert.equal(v.ok, false);
  assert.equal(v.errors.some((e) => e.includes('Група A · Матч 1')), true);
});

test('group progress counts completed matches', () => {
  const matches = [
    { groupId: 'A', status: 'completed' }, { groupId: 'A', status: 'pending' },
    { groupId: 'B', status: 'completed' }, { groupId: 'B', status: 'completed' },
  ];
  const progress = getSchoolGroupProgress(matches);
  assert.equal(progress.completedTotal, 3);
  assert.equal(progress.completedA, 1);
  assert.equal(progress.completedB, 2);
});

test('final matches count for 4 and 5 teams', () => {
  assert.equal(generateRoundRobinMatches(['team1', 'team2', 'team3', 'team4'], { stage: 'final', groupId: 'FINAL' }).length, 6);
  assert.equal(generateRoundRobinMatches(['team1', 'team2', 'team3', 'team4', 'team5'], { stage: 'final', groupId: 'FINAL' }).length, 10);
});

test('final result 8:5 sets completed and winner', () => {
  const match = generateRoundRobinMatches(['team1', 'team2'], { stage: 'final', groupId: 'FINAL', titlePrefix: 'Фінальна група' })[0];
  match.result.pointsA = 8; match.result.pointsB = 5; match.status = 'completed'; match.result.winnerTeamId = 'team1';
  assert.equal(match.status, 'completed');
  assert.equal(match.result.winnerTeamId, 'team1');
});

test('final draw 4:4 sets isDraw true', () => {
  const match = generateRoundRobinMatches(['team1', 'team2'], { stage: 'final', groupId: 'FINAL' })[0];
  match.result.pointsA = 4; match.result.pointsB = 4; match.status = 'completed'; match.result.winnerTeamId = ''; match.result.isDraw = true;
  assert.equal(match.result.isDraw, true);
});

test('final progress and champion derived', () => {
  const teams = mkTeams(4);
  const matches = generateRoundRobinMatches(['team1', 'team2', 'team3', 'team4'], { stage: 'final', groupId: 'FINAL', titlePrefix: 'Фінальна група' });
  matches.forEach((m, idx) => { m.status = 'completed'; m.result.pointsA = 10 - idx; m.result.pointsB = idx; m.result.winnerTeamId = m.teamAId; });
  const schoolState = { finalGroup: { teamIds: ['team1', 'team2', 'team3', 'team4'], matches, standings: [], championTeamId: '' }, championTeamId: '' };
  const derived = refreshFinalGroupDerivedState(schoolState, teams);
  assert.equal(derived.allCompleted, true);
  assert.equal(Boolean(schoolState.championTeamId), true);
  const progress = getFinalGroupProgress(matches);
  assert.equal(progress.total, 6);
  assert.equal(progress.completed, 6);
});

test('champion is empty when not all final matches completed', () => {
  const teams = mkTeams(4);
  const matches = generateRoundRobinMatches(['team1', 'team2', 'team3', 'team4'], { stage: 'final', groupId: 'FINAL' });
  matches[0].status = 'completed'; matches[0].result.pointsA = 3; matches[0].result.pointsB = 1;
  const schoolState = { finalGroup: { teamIds: ['team1', 'team2', 'team3', 'team4'], matches, standings: [], championTeamId: '' }, championTeamId: '' };
  refreshFinalGroupDerivedState(schoolState, teams);
  assert.equal(schoolState.championTeamId, '');
});

test('can form final group only after 20 completed matches', () => {
  const schoolState = { groupMatches: Array.from({ length: 20 }, () => ({ status: 'completed' })), groupStandings: { A: Array.from({ length: 5 }, (_, i) => ({ teamId: `team${i + 1}` })), B: Array.from({ length: 5 }, (_, i) => ({ teamId: `team${i + 6}` })) } };
  assert.equal(canFormSchoolFinalGroup(schoolState), true);
  schoolState.groupMatches[0].status = 'pending';
  assert.equal(canFormSchoolFinalGroup(schoolState), false);
});

test('final group is top-2 A + top-2 B', () => {
  const formed = buildFinalGroupFromStandings({ groupStandings: { A: [{ teamId: 'team1' }, { teamId: 'team3' }], B: [{ teamId: 'team6' }, { teamId: 'team8' }] } });
  assert.deepEqual(formed.qualifiers, { A: ['team1', 'team3'], B: ['team6', 'team8'] });
  assert.deepEqual(formed.teamIds, ['team1', 'team3', 'team6', 'team8']);
});

test('wildcard candidates exclude qualifiers and auto suggest works', () => {
  const schoolState = {
    qualifiers: { A: ['team1', 'team2'], B: ['team6', 'team7'] },
    groupStandings: {
      A: [{ teamId: 'team1', place: 1 }, { teamId: 'team2', place: 2 }, { teamId: 'team3', place: 3, tournamentPoints: 6, wins: 2, pointsDiff: 2, pointsFor: 12, schoolNumber: '13', schoolName: 'A', teamName: 'T3' }],
      B: [{ teamId: 'team6', place: 1 }, { teamId: 'team7', place: 2 }, { teamId: 'team8', place: 3, tournamentPoints: 7, wins: 2, pointsDiff: 3, pointsFor: 13, schoolNumber: '8', schoolName: 'B', teamName: 'T8' }],
    },
  };
  const candidates = getWildcardCandidates(schoolState);
  assert.equal(candidates.some((c) => ['team1', 'team2', 'team6', 'team7'].includes(c.teamId)), false);
  assert.equal(pickBestWildcardCandidate(candidates)?.teamId, 'team8');
});
