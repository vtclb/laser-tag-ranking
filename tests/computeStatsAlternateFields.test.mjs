import assert from 'node:assert/strict';

globalThis.window = {
  __SESS: null,
  addEventListener() {},
};
globalThis.location = {
  hostname: 'example.com',
  origin: 'https://example.com',
  pathname: '/index.html',
};

const { computeStats } = await import('../scripts/ranking.js');

const alias = {};

const rank = [
  { Nickname: 'Alpha', Points: '150' },
  { Nickname: 'Bravo', Points: '120' },
];

const games = [
  {
    'Team 1': 'Alpha, Charlie',
    'Team 2': 'Bravo',
    Winner: 'Team 1',
    'Score 1': '10',
    'Score 2': '5',
    Timestamp: '2025-07-12T12:00:00Z',
  },
  {
    Team1: 'Bravo',
    Team2: 'Alpha',
    Winner: 'Team2',
    Score1: '7',
    Score2: '9',
    Timestamp: '2025-07-13T12:00:00Z',
  },
];

const { players, totalGames, totalRounds, minDate, maxDate } = computeStats(rank, games, {
  alias,
  league: 'kids',
});

assert.equal(players.length, 2);
assert.equal(totalGames, 2);
assert.equal(totalRounds, 31);
assert.equal(minDate instanceof Date && !Number.isNaN(minDate.valueOf()), true);
assert.equal(maxDate instanceof Date && !Number.isNaN(maxDate.valueOf()), true);

const alpha = players.find((p) => p.nickname === 'Alpha');
const bravo = players.find((p) => p.nickname === 'Bravo');

assert.equal(alpha.games, 2);
assert.equal(alpha.wins, 2);
assert.equal(alpha.winRate, '100.00');
assert.equal(bravo.games, 2);
assert.equal(bravo.wins, 0);
assert.equal(bravo.winRate, '0.00');
