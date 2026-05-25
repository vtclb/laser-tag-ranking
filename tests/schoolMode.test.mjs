import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventModeLimits } from '../v2/scripts/balance2/config.js';
import { normalizeManualPoints, calculateSchoolStandings } from '../v2/scripts/balance2/schoolMode.js';
import { validateSchoolEvent } from '../v2/scripts/balance2/validation.js';
import { buildSchoolEventPayload } from '../v2/scripts/balance2/schoolPayload.js';

function mockState() {
  return {
    schoolState: {
      eventId: 'school_1', title: 'Test', date: '2026-05-25', status: 'draft',
      teamMeta: { team1: { schoolName: 'A', schoolNumber: '12', teamName: 'A1' }, team2: { schoolName: 'B', schoolNumber: '', teamName: 'B1' } },
      battles: [{ id: 'b1', results: [{ teamId: 'team1', points: 8 }, { teamId: 'team2', points: 5 }] }],
      changeLog: [],
    },
    teamsState: { teamCount: 2, teams: { team1: ['p1'], team2: ['p2'] } },
    playersState: { players: [{ uid: 'p1', nick: 'N1' }, { uid: 'p2', nick: 'N2' }] },
  };
}

test('school limits', () => {
  const school = getEventModeLimits('school');
  assert.equal(school.maxPlayers, 50);
  assert.equal(school.maxTeams, 12);
});

test('manual points normalization', () => {
  assert.equal(normalizeManualPoints(0), 0);
  assert.equal(normalizeManualPoints(10), 10);
  assert.equal(normalizeManualPoints(-1), null);
});

test('buildSchoolEventPayload invariants', () => {
  const payload = buildSchoolEventPayload(mockState());
  assert.equal(payload.eventMode, 'school');
  assert.equal(payload.scoringMode, 'manualPoints');
  assert.equal(payload.affectsPlayerRating, false);
  assert.equal(payload.standings[0].teamId, 'team1');
});

test('validateSchoolEvent blocks invalid data', () => {
  const payload = buildSchoolEventPayload(mockState());
  payload.battles[0].results[0].points = 99;
  payload.battles[0].results.push({ teamId: 'team1', points: 5 });
  payload.teams[0].schoolName = '';
  const v = validateSchoolEvent(payload);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes('некоректні бали')));
  assert.ok(v.errors.some((e) => e.includes('дубль teamId')));
  assert.ok(v.errors.some((e) => e.includes('порожня назва школи')));
});

test('standings sort and battlesPlayed', () => {
  const teams = [
    { id: 't1', teamName: 'Команда 1', schoolName: 'Школа А', schoolNumber: '1', players: [1,2] },
    { id: 't2', teamName: 'Команда 2', schoolName: 'Школа Б', schoolNumber: '2', players: [1] },
  ];
  const battles = [{ results: [{ teamId: 't1', points: 8 }, { teamId: 't2', points: 0 }] }];
  const rows = calculateSchoolStandings(teams, battles);
  assert.equal(rows[0].teamId, 't1');
});
