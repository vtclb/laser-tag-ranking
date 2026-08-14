import test from 'node:test';
import assert from 'node:assert/strict';

import { calculatePlayerWinStreak } from '../v2/core/dataHub.js';

test('win streak continues across different days and skips games without the player', () => {
  const matches = [
    { timestamp: '2026-05-01T10:00:00Z', team1: ['Alpha'], team2: ['Bravo'], winner: 'team1' },
    { timestamp: '2026-05-08T10:00:00Z', team1: ['Charlie'], team2: ['Alpha'], winner: 'team2' },
    { timestamp: '2026-05-09T10:00:00Z', team1: ['Charlie'], team2: ['Delta'], winner: 'team1' },
    { timestamp: '2026-06-02T10:00:00Z', team1: ['Alpha'], team2: ['Echo'], winner: 'team1' }
  ];
  const result = calculatePlayerWinStreak(matches, ' alpha ');
  assert.equal(result.longest, 3);
  assert.equal(result.current, 3);
  assert.equal(result.gamesCount, 3);
  assert.equal(result.startDate, '2026-05-01');
  assert.equal(result.endDate, '2026-06-02');
});

test('loss and draw both interrupt a streak', () => {
  const result = calculatePlayerWinStreak([
    { date: '2026-01-01', team1: ['Alpha'], team2: ['Bravo'], winner: 'team1' },
    { date: '2026-01-02', team1: ['Alpha'], team2: ['Bravo'], winner: 'team1' },
    { date: '2026-01-03', team1: ['Alpha'], team2: ['Bravo'], winner: 'tie' },
    { date: '2026-01-04', team1: ['Alpha'], team2: ['Bravo'], winner: 'team2' },
    { date: '2026-01-05', team1: ['Alpha'], team2: ['Bravo'], winner: 'team1' }
  ], 'Alpha');
  assert.equal(result.longest, 2);
  assert.equal(result.current, 1);
  assert.equal(result.gamesCount, 5);
});

test('matches are ordered by timestamp before calculating the streak', () => {
  const result = calculatePlayerWinStreak([
    { timestamp: '2026-03-03T10:00:00Z', team1: ['Alpha'], team2: ['Bravo'], winner: 'team1' },
    { timestamp: '2026-03-01T10:00:00Z', team1: ['Alpha'], team2: ['Bravo'], winner: 'team1' },
    { timestamp: '2026-03-02T10:00:00Z', team1: ['Alpha'], team2: ['Bravo'], winner: 'team2' }
  ], 'Alpha');
  assert.equal(result.longest, 1);
  assert.equal(result.current, 1);
  assert.equal(result.startDate, '2026-03-01');
});

test('four-team winner tokens and corrupted input stay safe', () => {
  const result = calculatePlayerWinStreak([
    { date: '2026-01-01', team1: ['A'], team2: ['B'], team3: ['Alpha'], team4: ['D'], winner: 'team3' },
    null,
    { date: '2026-01-02', teams: { sideA: ['A'], sideB: ['Alpha'] }, winner: '2' }
  ], 'Alpha');
  assert.equal(result.longest, 2);
  assert.equal(calculatePlayerWinStreak('bad', '').longest, 0);
});

