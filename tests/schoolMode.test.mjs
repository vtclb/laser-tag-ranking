import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventModeLimits } from '../v2/scripts/balance2/config.js';
import { normalizeManualPoints, calculateSchoolStandings } from '../v2/scripts/balance2/schoolMode.js';

test('school limits', () => {
  const school = getEventModeLimits('school');
  assert.equal(school.maxPlayers, 50);
  assert.equal(school.maxTeams, 12);
});

test('manual points normalization', () => {
  assert.equal(normalizeManualPoints(0), 0);
  assert.equal(normalizeManualPoints(10), 10);
  assert.equal(normalizeManualPoints(-1), null);
  assert.equal(normalizeManualPoints(11), null);
  assert.equal(normalizeManualPoints(5.5), null);
  assert.equal(normalizeManualPoints('abc'), null);
  assert.equal(normalizeManualPoints(''), null);
});

test('standings sort and battlesPlayed', () => {
  const teams = [
    { id: 't1', teamName: 'Команда 1', schoolName: 'Школа А', schoolNumber: '1', players: [1,2] },
    { id: 't2', teamName: 'Команда 2', schoolName: 'Школа Б', schoolNumber: '2', players: [1] },
    { id: 't3', teamName: 'Команда 3', schoolName: 'Школа В', schoolNumber: '3', players: [1] },
  ];
  const battles = [
    { results: [{ teamId: 't1', points: 8 }, { teamId: 't2', points: 8 }] },
    { results: [{ teamId: 't1', points: 1 }, { teamId: 't2', points: 0 }] },
  ];
  const rows = calculateSchoolStandings(teams, battles);
  assert.equal(rows[0].teamId, 't1');
  assert.equal(rows.find((x) => x.teamId === 't3').battlesPlayed, 0);
});
