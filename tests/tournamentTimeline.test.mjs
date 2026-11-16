import test from 'node:test';
import assert from 'node:assert/strict';
import { tournamentDay, tournamentStatus, tournamentPresentation, sortTournaments, featuredTournaments } from '../v2/core/tournamentTimeline.js';

const now = new Date('2026-11-16T12:00:00Z');
const event = (id, dateStart, status = 'ACTIVE', extra = {}) => ({ tournamentId: id, dateStart, status, ...extra });
const present = item => tournamentPresentation(item, now);

test('past ACTIVE records are archive entries, never silently completed', () => {
  const item = Object.freeze(event('may', '2026-05-25'));
  assert.equal(present(item).group, 'past');
  assert.equal(present(item).label, 'Минула подія · статус не уточнено');
  assert.equal(item.status, 'ACTIVE');
});
test('current day, future events and multi-day windows are distinct', () => {
  assert.equal(present(event('today', '2026-11-16')).group, 'current');
  assert.equal(present(event('future', '2026-11-20')).group, 'upcoming');
  assert.equal(present(event('range', '2026-11-14', 'ACTIVE', { dateEnd: '2026-11-17' })).group, 'current');
  assert.equal(present(event('ended', '2026-11-14', 'ACTIVE', { dateEnd: '2026-11-15' })).group, 'past');
});
test('exact statuses do not treat INACTIVE as ACTIVE', () => {
  for (const status of ['INACTIVE', 'REACTIVE', 'DRAFT', '']) {
    assert.notEqual(tournamentStatus(status), 'active');
    assert.equal(present(event('draft', '2026-11-20', status)).group, 'undated');
  }
  assert.equal(tournamentStatus(' активний '), 'active');
});
test('explicit completion/cancellation takes priority over dates and inferred completion', () => {
  assert.equal(present(event('done', '2026-11-20', 'FINISHED')).label, 'Завершений');
  assert.equal(present(event('cancel', '2026-11-20', 'CANCELLED', { displayStatus: 'FINISHED' })).label, 'Скасований');
  assert.equal(present(event('done', '2026-05-25', 'ACTIVE', { displayStatus: 'FINISHED' })).label, 'Завершений');
});
test('missing, invalid and contradictory dates cannot promote active events', () => {
  for (const date of ['', 'wrong', '2026-02-30', '2026-13-01']) assert.equal(present(event('bad', date)).group, 'undated');
  assert.equal(present(event('bad', '2026-11-16', 'ACTIVE', {dateEnd:'2026-11-15'})).group, 'undated');
  assert.equal(present(event('bad', '2026-11-16', 'ACTIVE', {dateEnd:'bad'})).group, 'undated');
});
test('Kyiv calendar boundary is independent of machine timezone', () => {
  assert.equal(tournamentDay('2026-11-15T23:30:00Z'), '2026-11-16');
  assert.equal(tournamentDay('2026-05-25T22:30:00Z'), '2026-05-26');
  assert.equal(tournamentDay('2026-05-25T10:00:00'), '2026-05-25');
  assert.equal(tournamentPresentation(event('today', '2026-11-16'), new Date('2026-11-15T22:30:00Z')).group, 'current');
});
test('homepage prefers current/upcoming; archive is newest-first; no input mutation', () => {
  const old = Object.freeze([event('older','2026-05-25'),event('newer','2026-05-26')].map(Object.freeze));
  assert.deepEqual(featuredTournaments(old, now).map(x=>x.tournamentId), ['newer','older']);
  const all = [...old, event('future','2026-11-20'), event('today','2026-11-16'), event('unknown','')];
  assert.deepEqual(featuredTournaments(all, now).map(x=>x.tournamentId), ['today','future']);
  assert.equal(sortTournaments(all, now).length, all.length);
  assert.equal(all[0].tournamentId, 'older');
  assert.deepEqual(featuredTournaments([event('unknown','')], now), []);
});
