import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { findPlayerByNick, normalizeNewPlayerInput } from '../v2/scripts/balance3/domain.js';

test('new player input trims nick and accepts optional age', () => {
  assert.deepEqual(normalizeNewPlayerInput({ nick: '  New   Player  ', age: '16' }), {
    ok: true,
    nick: 'New Player',
    age: 16,
  });
  assert.deepEqual(normalizeNewPlayerInput({ nick: 'Solo', age: '' }), {
    ok: true,
    nick: 'Solo',
    age: '',
  });
});

test('new player input rejects missing nick and invalid age', () => {
  assert.equal(normalizeNewPlayerInput({ nick: ' ' }).ok, false);
  assert.equal(normalizeNewPlayerInput({ nick: 'Player', age: '4' }).ok, false);
  assert.equal(normalizeNewPlayerInput({ nick: 'Player', age: '100' }).ok, false);
});

test('player lookup detects duplicate nick without case sensitivity', () => {
  const player = { key: 'sundaygames::Morti', nick: 'Morti' };
  assert.equal(findPlayerByNick([player], ' morti '), player);
  assert.equal(findPlayerByNick([player], 'Other'), null);
});

test('Balance3 player creation is mobile-accessible and protected by the admin key', async () => {
  const [html, app, gas] = await Promise.all([
    readFile(new URL('../v2/balance3.html', import.meta.url), 'utf8'),
    readFile(new URL('../v2/scripts/balance3/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../gas/doPost.gs', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="newPlayerButton"/);
  assert.match(html, /id="newPlayerDialog"/);
  assert.match(html, /Створити й додати в лобі/);
  assert.match(app, /adminCreatePlayer\(\{ adminKey, league, nick: input\.nick, age: input\.age \}\)/);
  assert.match(app, /selectNick: input\.nick/);
  assert.match(gas, /function handleAdminCreatePlayer_\(payload\) \{\s*requireRegularEditKey_\(payload\);/);
  assert.match(gas, /LockService\.getScriptLock\(\)/);
});
