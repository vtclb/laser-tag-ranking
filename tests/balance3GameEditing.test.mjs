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

test('winner correction changes only the edited game outcome bonus', () => {
  const original = {
    team1: 'Sem,Pantazi_ko,wiedii,SixSeven',
    team2: 'Justy,Morti,Wolfie,Оксанка',
    winner: 'team1',
    mvp: 'Morti',
    mvp2: 'Оксанка',
    mvp3: 'Wolfie'
  };
  const before = {Pantazi_ko:1023, Sem:1004, wiedii:583, SixSeven:227, Justy:840, Morti:811, Wolfie:811, 'Оксанка':819};
  const originalPoints = {...before};
  const correctedPoints = {...before};
  gasHelpers.scoreRegularGame_(original, originalPoints);
  gasHelpers.scoreRegularGame_({...original, winner:'team2'}, correctedPoints);
  const delta = Object.fromEntries(Object.keys(before).map((nick) => [nick, correctedPoints[nick] - originalPoints[nick]]));
  assert.deepEqual(delta, {
    Pantazi_ko: -20,
    Sem: -20,
    wiedii: -20,
    SixSeven: -20,
    Justy: 20,
    Morti: 20,
    Wolfie: 20,
    'Оксанка': 20,
  });
  assert.doesNotMatch(gasSource, /futureGames/);
});

test('GAS editing is keyed, locked, versioned and audited', () => {
  assert.match(gasSource, /BALANCE3_ADMIN_EDIT_KEY/);
  assert.match(gasSource, /action === 'editRegularGame'/);
  assert.match(gasSource, /lock\.waitLock\(20000\)/);
  assert.match(gasSource, /original\.revision !== expectedRevision/);
  assert.match(gasSource, /game_corrections/);
  assert.match(gasSource, /createTextFinder\(requestId\)\.matchEntireCell\(true\)/);
});

test('GAS keeps the live read endpoint required by the rating site', () => {
  assert.match(gasSource, /action === 'getSheetRaw'/);
  assert.match(gasSource, /handleGetSheetRaw_/);
  assert.match(gasSource, /PUBLIC_READABLE_SHEETS_/);
  assert.match(gasSource, /PUBLIC_SHEET_READ_LIMIT_/);
});

test('Balance3 exposes a mobile saved-game editor and refreshes hidden ratings', () => {
  assert.match(htmlSource, /id="historyButton"/);
  assert.match(htmlSource, /id="historyDialog"/);
  assert.match(htmlSource, /id="historyRounds"/);
  assert.match(appSource, /syncSkillRatingsFromGames/);
  assert.match(appSource, /expectedRevision: editingGame\.revision/);
  assert.match(appSource, /sessionStorage\.setItem\('balance3:admin-edit-key'/);
});
