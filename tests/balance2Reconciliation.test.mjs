import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildRatingReconciliation,
  getBalanceSpread,
  snapshotPlayerPoints,
  snapshotTeamTotals,
} from '../v2/scripts/balance2/reconciliation.js';
import { autoBalance2 } from '../v2/scripts/balance2/balance.js';
import { MAX_SERIES_ROUNDS, state } from '../v2/scripts/balance2/state.js';

test('rating reconciliation reports player and team deltas after save', () => {
  const beforePlayers = [
    { nick: 'Alpha', points: 100 },
    { nick: 'Bravo', points: 90 },
    { nick: 'Charlie', points: 80 },
    { nick: 'Delta', points: 70 },
  ];
  const teams = { team1: ['Alpha', 'Delta'], team2: ['Bravo', 'Charlie'] };
  const beforePoints = snapshotPlayerPoints(beforePlayers);
  const beforeTeamTotals = snapshotTeamTotals(teams, beforePoints);
  const result = buildRatingReconciliation({
    beforePoints,
    beforeTeamTotals,
    teams,
    participantKeys: Object.values(teams).flat(),
    afterPlayers: [
      { nick: 'Alpha', points: 107 },
      { nick: 'Bravo', points: 86 },
      { nick: 'Charlie', points: 84 },
      { nick: 'Delta', points: 67 },
    ],
  });

  assert.equal(result.confirmed, true);
  assert.deepEqual(result.changedPlayers.map(({ nick, delta }) => ({ nick, delta })), [
    { nick: 'Alpha', delta: 7 },
    { nick: 'Delta', delta: -3 },
    { nick: 'Bravo', delta: -4 },
    { nick: 'Charlie', delta: 4 },
  ]);
  assert.deepEqual(result.teamChanges, [
    { teamId: 'team1', before: 170, after: 174, delta: 4 },
    { teamId: 'team2', before: 170, after: 170, delta: 0 },
  ]);
  assert.equal(result.beforeSpread, 0);
  assert.equal(result.afterSpread, 4);
});

test('rating reconciliation stays pending when server still returns old points', () => {
  const players = [{ nick: 'Alpha', points: 100 }, { nick: 'Bravo', points: 90 }];
  const teams = { team1: ['Alpha'], team2: ['Bravo'] };
  const beforePoints = snapshotPlayerPoints(players);
  const result = buildRatingReconciliation({
    beforePoints,
    beforeTeamTotals: snapshotTeamTotals(teams, beforePoints),
    teams,
    participantKeys: ['Alpha', 'Bravo'],
    afterPlayers: players,
  });

  assert.equal(result.confirmed, false);
  assert.equal(result.changedPlayers.length, 0);
  assert.equal(getBalanceSpread({ team1: 100, team2: 90 }), 10);
});

test('two-team balance handles 50 players without loss or duplicates', () => {
  const players = Array.from({ length: 50 }, (_, index) => ({ nick: `P${index + 1}`, points: 1000 - index * 7 }));
  const teams = autoBalance2(players);
  const assigned = [...teams.team1, ...teams.team2];

  assert.equal(teams.team1.length, 25);
  assert.equal(teams.team2.length, 25);
  assert.equal(assigned.length, 50);
  assert.equal(new Set(assigned.map((player) => player.nick)).size, 50);
});

test('series state supports the full ten rounds', () => {
  assert.equal(MAX_SERIES_ROUNDS, 10);
  assert.equal(state.matchState.seriesRounds.length, 10);
  assert.equal(state.matchState.series.length, 10);
});

test('admin UI exposes ten rounds and keeps school mode hidden', () => {
  const html = readFileSync(new URL('../v2/balance2.html', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../v2/scripts/balance2/ui.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../v2/styles/balance2.css', import.meta.url), 'utf8');

  assert.match(html, /data-series-count="10"/);
  assert.doesNotMatch(ui, /data-event-mode="school"/);
  assert.match(html, /class="mobile-workspace-nav"/);
  assert.match(html, /href="#playersCard"/);
  assert.match(html, /href="#matchCard"/);
  assert.match(html, /href="\.\/index\.html#main"/);
  assert.match(css, /\.v2-bottom-nav \{ display: none !important; \}/);
  assert.match(ui, /team-summary-text/);
  assert.doesNotMatch(ui, /team-card-summary-text/);
  assert.match(ui, /useMobileAccordion/);
  assert.match(ui, /data-event-mode="regular"/);
  assert.match(ui, /round !== null && Number\(round\) === option\.val/);
  assert.match(ui, /outcome-winner/);
  assert.match(ui, /outcome-loser/);
  assert.match(ui, /outcome-draw/);
  assert.match(css, /\.round-btn\.outcome-winner/);
  assert.match(css, /\.round-btn\.outcome-loser/);
  assert.match(css, /\.round-btn\.outcome-draw/);
  assert.match(css, /\.round-card\[data-result="2"\]/);
  assert.match(css, /\.rating-sync-panel--confirmed/);
});
