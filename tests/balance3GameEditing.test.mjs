import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const gasSource = await fs.readFile(new URL('../gas/doPost.gs', import.meta.url), 'utf8');
const appSource = await fs.readFile(new URL('../v2/scripts/balance3/app.js', import.meta.url), 'utf8');
const htmlSource = await fs.readFile(new URL('../v2/balance3.html', import.meta.url), 'utf8');

const gasHelpers = new Function(`${gasSource}\nreturn { regularWinnerFromSeries_, scoreRegularGame_ };`)();

test('regular game correction derives winner from every saved battle', () => {
  assert.equal(gasHelpers.regularWinnerFromSeries_('222'), 'team2');
  assert.equal(gasHelpers.regularWinnerFromSeries_('1011'), 'team1');
  assert.equal(gasHelpers.regularWinnerFromSeries_('120'), 'tie');
  assert.throws(() => gasHelpers.regularWinnerFromSeries_('---'), /Серія/);
});

test('winner correction propagates rank threshold effects through later games', () => {
  const games = [
    ['Sem,Pantazi_ko,wiedii,SixSeven', 'Justy,Morti,Wolfie,Оксанка', 'team2', ['Morti','Оксанка','Wolfie']],
    ['Pantazi_ko,wiedii,SixSeven,Morti', 'Justy,Оксанка,Wolfie,Sem', 'team1', ['Morti','Justy','wiedii']],
    ['Pantazi_ko,Morti,wiedii,SixSeven', 'Sem,Justy,Оксанка,Wolfie', 'team1', ['Pantazi_ko','Morti','Sem']],
    ['Sem,Оксанка,Wolfie', 'Pantazi_ko,wiedii,SixSeven', 'team1', ['Оксанка','Pantazi_ko','Wolfie']],
    ['Pantazi_ko,wiedii,SixSeven', 'Sem,Оксанка,Wolfie', 'team1', ['Pantazi_ko','Оксанка','SixSeven']],
    ['Pantazi_ko,Оксанка,SixSeven', 'Sem,wiedii,Wolfie', 'team1', ['wiedii','Pantazi_ko','Оксанка']],
  ].map(([team1, team2, winner, mvp]) => ({team1, team2, winner, mvp:mvp[0], mvp2:mvp[1], mvp3:mvp[2]}));
  const points = {Pantazi_ko:1023, Sem:1004, wiedii:583, SixSeven:227, Justy:840, Morti:811, Wolfie:811, 'Оксанка':819};
  games.forEach((game) => gasHelpers.scoreRegularGame_(game, points));
  assert.deepEqual(points, {
    Pantazi_ko: 1069,
    Sem: 965,
    wiedii: 616,
    SixSeven: 286,
    Justy: 837,
    Morti: 872,
    Wolfie: 797,
    'Оксанка': 848,
  });
});

test('GAS editing is keyed, locked, versioned and audited', () => {
  assert.match(gasSource, /BALANCE3_ADMIN_EDIT_KEY/);
  assert.match(gasSource, /action === 'editRegularGame'/);
  assert.match(gasSource, /lock\.waitLock\(20000\)/);
  assert.match(gasSource, /original\.revision !== expectedRevision/);
  assert.match(gasSource, /game_corrections/);
  assert.match(gasSource, /createTextFinder\(requestId\)\.matchEntireCell\(true\)/);
});

test('Balance3 exposes a mobile saved-game editor and refreshes hidden ratings', () => {
  assert.match(htmlSource, /id="historyButton"/);
  assert.match(htmlSource, /id="historyDialog"/);
  assert.match(htmlSource, /id="historyRounds"/);
  assert.match(appSource, /syncSkillRatingsFromGames/);
  assert.match(appSource, /expectedRevision: editingGame\.revision/);
  assert.match(appSource, /sessionStorage\.setItem\('balance3:admin-edit-key'/);
});
