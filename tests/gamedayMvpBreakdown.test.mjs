import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayersTable } from '../v2/pages/gameday.js';

test('daily player rows show each MVP place separately, never the total', () => {
  const html = buildPlayersTable([{ nick: 'Player', mvp1: 2, mvp2: 3, mvp3: 4, mvpTotal: 99 }]);
  for (const [place, count] of [[1, 2], [2, 3], [3, 4]]) {
    assert.ok(html.includes(`gameday-player-row__award--${place} is-earned`));
    assert.ok(html.includes(`aria-label="MVP ${place}: ${count}"`));
    assert.ok(html.includes(`>×${count}</b>`));
  }
  assert.ok(!html.includes('99'));
});

test('missing and invalid daily award counts display zero', () => {
  const html = buildPlayersTable([{ nick: '<Player>', mvp1: -1, mvp2: 'bad' }]);
  assert.equal((html.match(/is-empty/g) || []).length, 3);
  assert.ok(html.includes('&lt;Player&gt;'));
});
