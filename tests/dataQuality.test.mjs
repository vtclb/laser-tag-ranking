import test from 'node:test';
import assert from 'node:assert/strict';

import { auditLeagueData } from '../v2/core/dataQuality.js';

test('auditLeagueData warns when MVP is not in game participants', () => {
  const result = auditLeagueData({
    league: 'kids',
    players: [{ nick: 'Alice', points: 100 }, { nick: 'Bob', points: 90 }, { nick: 'Mvp', points: 80 }],
    games: [{ team1: ['Alice'], team2: ['Bob'], winner: 'team1', mvp: 'Mvp' }]
  });
  assert.equal(result.ok, false);
  assert.equal(result.warnings.some((item) => item.type === 'MVP_NOT_IN_GAME'), true);
});

test('auditLeagueData warns on unknown game participant', () => {
  const result = auditLeagueData({
    league: 'kids',
    players: [{ nick: 'Alice', points: 100 }],
    games: [{ team1: ['Alice'], team2: ['Ghost'], winner: 'team1' }]
  });
  assert.equal(result.ok, false);
  assert.equal(result.warnings.some((item) => item.type === 'UNKNOWN_PLAYER'), true);
});

test('auditLeagueData warns on duplicate nick', () => {
  const result = auditLeagueData({
    league: 'kids',
    players: [{ nick: 'Alice', points: 100 }, { nick: 'alice', points: 90 }],
    games: []
  });
  assert.equal(result.ok, false);
  assert.equal(result.warnings.some((item) => item.type === 'DUPLICATE_NICK'), true);
});

test('auditLeagueData warns on invalid points', () => {
  const result = auditLeagueData({
    league: 'kids',
    players: [{ nick: 'Alice', points: 'oops' }],
    games: []
  });
  assert.equal(result.ok, false);
  assert.equal(result.warnings.some((item) => item.type === 'INVALID_POINTS'), true);
});

test('auditLeagueData warns on invalid winner', () => {
  const result = auditLeagueData({
    league: 'kids',
    players: [{ nick: 'Alice', points: 100 }, { nick: 'Bob', points: 90 }],
    games: [{ team1: ['Alice'], team2: ['Bob'], winner: 'team3' }]
  });
  assert.equal(result.ok, false);
  assert.equal(result.warnings.some((item) => item.type === 'INVALID_WINNER'), true);
});

test('auditLeagueData returns ok for clean data', () => {
  const result = auditLeagueData({
    league: 'kids',
    players: [{ nick: 'Alice', points: 100 }, { nick: 'Bob', points: 90 }],
    games: [{ team1: ['Alice'], team2: ['Bob'], winner: 'team1', mvp: 'Alice' }]
  });
  assert.deepEqual(result, { ok: true, warnings: [] });
});
