import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../v2/pages/tournaments.js', import.meta.url), 'utf8');
test('standings expose real table structure rather than button rows without cells', () => {
  assert.match(source, /standings.setAttribute\('aria-colcount', '9'\)/);
  assert.match(source, /cell.setAttribute\('role', 'columnheader'\)/);
  assert.match(source, /row.setAttribute\('role', 'rowgroup'\)/);
  assert.match(source, /topLine.setAttribute\('role', 'row'\)/);
  assert.match(source, /column === 1 \? 'rowheader' : 'cell'/);
  assert.match(source, /rosterCell.setAttribute\('aria-colspan', '9'\)/);
});
test('team disclosures retain native keyboard control and synchronized hidden state', () => {
  assert.match(source, /createElement\('button', 'tournament-team-toggle'/);
  assert.match(source, /toggle.setAttribute\('aria-controls', roster.id\)/);
  assert.match(source, /roster.hidden = !expandedTeams.has\(teamKey\)/);
  assert.match(source, /toggle.setAttribute\('aria-expanded', String\(expandedTeams.has\(teamKey\)\)\)/);
});
