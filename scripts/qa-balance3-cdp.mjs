import fs from 'node:fs/promises';

const DEBUG_PORT = 9333;
const APP_URL = 'http://127.0.0.1:4193/v2/balance3.html';
const OUT_DIR = new URL('../artifacts/balance3-qa/', import.meta.url);
const LIVE_READONLY = process.argv.includes('--live-readonly');

await fs.mkdir(OUT_DIR, { recursive: true });

const target = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(APP_URL)}`, { method: 'PUT' }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const browserErrors = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') {
    const details = message.params.exceptionDetails;
    browserErrors.push(details?.exception?.description || details?.text || 'Runtime exception');
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    browserErrors.push(message.params.args.map((arg) => arg.value || arg.description || '').join(' '));
  }
});

function command(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Evaluation failed');
  return result.result.value;
}

async function waitFor(expression, timeoutMs = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  const diagnostics = await evaluate(`({
    status: document.querySelector('#statusText')?.textContent || '',
    players: document.querySelectorAll('[data-player-key]').length
  })`).catch(() => ({}));
  throw new Error(`Timed out waiting for: ${expression}; diagnostics=${JSON.stringify(diagnostics)}; browserErrors=${browserErrors.join(' | ')}`);
}

async function screenshot(name) {
  const result = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await fs.writeFile(new URL(name, OUT_DIR), Buffer.from(result.data, 'base64'));
}

await command('Page.enable');
await command('Runtime.enable');
await command('Network.enable');
await command('Network.setCacheDisabled', { cacheDisabled: true });
await command('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
});

const csv = [
  'Nickname,Points',
  ...Array.from({ length: 50 }, (_, index) => `Player ${String(index + 1).padStart(2, '0')},${1500 - index * 23}`),
].join('\n');
const gamesCsv = [
  'Timestamp,League,Team1,Team2,Winner,MVP,mvp2,mvp3,Series,penalties,Points',
  ...Array.from({ length: 24 }, (_, index) => {
    const winner = index % 3 === 0 ? 'team2' : 'team1';
    return `2026-08-${String(index + 1).padStart(2, '0')},sundaygames,"Player 01, Player 02, Player 03","Player 04, Player 05, Player 06",${winner},Player 01,Player 04,Player 02,111,,`;
  }),
].join('\n');

if (!LIVE_READONLY) await command('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    (() => {
      if (!sessionStorage.getItem('balance3:qa-preserve-storage')) {
        localStorage.removeItem('balance3:draft:v1');
        localStorage.removeItem('balance3:pending-write:v1');
      }
      const csv = ${JSON.stringify(csv)};
      const gamesCsv = ${JSON.stringify(gamesCsv)};
      const qa = window.__balance3Qa = { saveMode: 'success', saveCalls: 0, savedRows: [] };
      const csvCell = (value) => '"' + String(value || '').replaceAll('"', '""') + '"';
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init = {}) => {
        const url = String(input?.url || input || '');
        if (url.includes('laser-proxy.vartaclub.workers.dev/fetchLeagueCsv')) {
          return new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv' } });
        }
        if (url.includes('docs.google.com/spreadsheets') && url.includes('gid=249347260')) {
          return new Response([gamesCsv, ...qa.savedRows].join('\\n'), { status: 200, headers: { 'Content-Type': 'text/csv' } });
        }
        if (url.includes('laser-proxy.vartaclub.workers.dev')) {
          qa.saveCalls += 1;
          const payload = Object.fromEntries(new URLSearchParams(String(init.body || '')));
          if (qa.saveMode === 'ambiguousSaved') {
            qa.savedRows.push([
              new Date().toISOString(), payload.league, csvCell(payload.team1), csvCell(payload.team2), payload.winner,
              payload.mvp, payload.mvp2, payload.mvp3, payload.series, payload.penalties, ''
            ].join(','));
            throw new TypeError('Mock connection closed after write');
          }
          if (qa.saveMode === 'ambiguousMissing') throw new TypeError('Mock connection closed before write');
          return new Response(JSON.stringify({ status: 'OK', message: 'Mock saved', players: [{ nick: 'Player 01', points: 1511 }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return originalFetch(input, init);
      };
    })();
  `,
});
await command('Page.navigate', { url: APP_URL });
await waitFor(`document.readyState === 'complete' && document.querySelector('#loadPlayersButton')`);

if (LIVE_READONLY) {
  await evaluate(`localStorage.removeItem('balance3:pending-write:v1'); localStorage.removeItem('balance3:draft:v1')`);
  await evaluate(`document.querySelector('#loadPlayersButton').click()`);
  await waitFor(`document.querySelectorAll('[data-player-key]').length > 0`, 30000);
  const liveReadOnlyCheck = await evaluate(`({
    players: document.querySelectorAll('[data-player-key]').length,
    ratingSelectorHidden: document.querySelector('input[name="ratingModel"]') === null,
    skillValuesHidden: Array.from(document.querySelectorAll('[data-player-key]')).every((node) => !node.textContent.includes('V2')),
    status: document.querySelector('#statusText').textContent,
    overflow: document.documentElement.scrollWidth - window.innerWidth
  })`);
  if (browserErrors.length) throw new Error(`Browser errors: ${browserErrors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, liveReadOnly: true, liveReadOnlyCheck }, null, 2));
  await command('Page.close');
  socket.close();
  process.exit(0);
}

await evaluate(`document.querySelector('#loadPlayersButton').click()`);
await waitFor(`document.querySelectorAll('[data-player-key]').length === 50`);
for (let index = 0; index < 12; index += 1) {
  await evaluate(`document.querySelector('[data-player-key][aria-pressed="false"]').click()`);
}
await waitFor(`document.querySelector('#selectionCount').textContent.includes('12 / 50')`);
await evaluate(`document.querySelector('.b3-settings').scrollIntoView({ block: 'start' })`);
await screenshot('settings-hidden-rating-mobile.png');

await evaluate(`(() => {
  const select = document.querySelector('#teamCountSelect');
  select.value = '2';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#formTeamsButton').click();
})()`);
await waitFor(`!document.querySelector('[data-stage="teams"]').classList.contains('is-hidden')`);
const twoTeamCheck = await evaluate(`({
  cards: document.querySelectorAll('.b3-team').length,
  assigned: document.querySelectorAll('.b3-team-player').length,
  ratingSelectorHidden: document.querySelector('input[name="ratingModel"]') === null,
  skillValuesHidden: !document.querySelector('#teamsGrid').textContent.includes('V2'),
  officialTotalsVisible: Array.from(document.querySelectorAll('.b3-team__head strong')).every((node) => node.textContent.includes('pts')),
  overflow: document.documentElement.scrollWidth - window.innerWidth
})`);
if (twoTeamCheck.cards !== 2 || twoTeamCheck.assigned !== 12 || !twoTeamCheck.ratingSelectorHidden || !twoTeamCheck.skillValuesHidden || !twoTeamCheck.officialTotalsVisible || twoTeamCheck.overflow > 1) throw new Error(`2-team mobile check failed: ${JSON.stringify(twoTeamCheck)}`);

await evaluate(`document.querySelector('[data-step-target="players"]').click()`);
await evaluate(`(() => {
  const select = document.querySelector('#teamCountSelect');
  select.value = '12';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#formTeamsButton').click();
})()`);
await waitFor(`document.querySelectorAll('.b3-team').length === 12`);
const twelveTeamCheck = await evaluate(`({
  cards: document.querySelectorAll('.b3-team').length,
  players: Array.from(document.querySelectorAll('.b3-team__players')).reduce((sum, node) => sum + node.querySelectorAll('.b3-team-player').length, 0),
  empty: Array.from(document.querySelectorAll('.b3-team')).filter((node) => node.textContent.includes('Команда порожня')).length
})`);
if (twelveTeamCheck.cards !== 12 || twelveTeamCheck.players !== 12 || twelveTeamCheck.empty !== 0) throw new Error(`12-team check failed: ${JSON.stringify(twelveTeamCheck)}`);
await screenshot('teams-12-mobile.png');

await evaluate(`document.querySelector('#continueToResultButton').click()`);
await waitFor(`!document.querySelector('[data-stage="result"]').classList.contains('is-hidden')`);
await evaluate(`document.querySelector('[data-round-count="10"]').click()`);
for (let index = 0; index < 10; index += 1) {
  const choice = index === 4 ? 'draw' : index % 3 === 0 ? 'team2' : 'team1';
  await evaluate(`document.querySelector('[data-round-index="${index}"] [data-round-choice="${choice}"]').click()`);
}
await evaluate(`(() => {
  const select = document.querySelector('#mvp1Select');
  select.value = select.options[1].value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
await waitFor(`document.querySelector('#saveGameButton').disabled === false`);
const visualCheck = await evaluate(`({
  rounds: document.querySelectorAll('.b3-round').length,
  chosen: document.querySelectorAll('.b3-round[data-choice]:not([data-choice=""])').length,
  green: getComputedStyle(document.querySelector('.b3-round[data-choice="team1"] [data-round-choice="team1"]')).backgroundColor,
  red: getComputedStyle(document.querySelector('.b3-round[data-choice="team1"] [data-round-choice="team2"]')).backgroundColor,
  draw: getComputedStyle(document.querySelector('.b3-round[data-choice="draw"] [data-round-choice="draw"]')).backgroundColor,
  overflow: document.documentElement.scrollWidth - window.innerWidth
})`);
if (visualCheck.rounds !== 10 || visualCheck.chosen !== 10 || visualCheck.overflow > 1) throw new Error(`Result visual check failed: ${JSON.stringify(visualCheck)}`);
await screenshot('result-10-mobile.png');
await evaluate(`window.scrollTo(0, document.documentElement.scrollHeight)`);
const stickyCheck = await evaluate(`(() => {
  const mvp = document.querySelector('.b3-mvp-grid').getBoundingClientRect();
  const saveBar = document.querySelector('.b3-save-bar').getBoundingClientRect();
  return { mvpBottom: Math.round(mvp.bottom), saveTop: Math.round(saveBar.top) };
})()`);
if (stickyCheck.mvpBottom > stickyCheck.saveTop + 1) throw new Error(`Sticky save bar overlaps MVP controls: ${JSON.stringify(stickyCheck)}`);

await evaluate(`document.querySelector('#saveGameButton').click()`);
await waitFor(`!document.querySelector('#lastSavePanel').classList.contains('is-hidden')`);
const saveReconciliationCheck = await evaluate(`({
  saveCalls: window.__balance3Qa.saveCalls,
  playerUpdated: document.querySelector('[data-player-key="sundaygames::Player 01"]').textContent.includes('1511'),
  pendingCleared: localStorage.getItem('balance3:pending-write:v1') === null
})`);
if (saveReconciliationCheck.saveCalls !== 1 || !saveReconciliationCheck.playerUpdated || !saveReconciliationCheck.pendingCleared) throw new Error(`Save reconciliation failed: ${JSON.stringify(saveReconciliationCheck)}`);

await evaluate(`window.__balance3Qa.saveMode = 'ambiguousSaved'`);
for (let index = 0; index < 10; index += 1) {
  const choice = index === 4 ? 'draw' : index % 3 === 0 ? 'team2' : 'team1';
  await evaluate(`document.querySelector('[data-round-index="${index}"] [data-round-choice="${choice}"]').click()`);
}
await evaluate(`(() => {
  const select = document.querySelector('#mvp1Select');
  select.value = select.options[1].value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#saveGameButton').click();
})()`);
await waitFor(`document.querySelector('#statusText').textContent.includes('Повторне надсилання скасовано')`);
const duplicateRecoveryCheck = await evaluate(`({
  saveCalls: window.__balance3Qa.saveCalls,
  forceHidden: document.querySelector('#forceRetryButton').classList.contains('is-hidden'),
  pendingCleared: localStorage.getItem('balance3:pending-write:v1') === null
})`);
if (duplicateRecoveryCheck.saveCalls !== 2 || !duplicateRecoveryCheck.forceHidden || !duplicateRecoveryCheck.pendingCleared) throw new Error(`Duplicate recovery failed: ${JSON.stringify(duplicateRecoveryCheck)}`);

await evaluate(`window.__balance3Qa.saveMode = 'ambiguousMissing'`);
for (let index = 0; index < 10; index += 1) {
  const choice = index % 2 ? 'team2' : 'team1';
  await evaluate(`document.querySelector('[data-round-index="${index}"] [data-round-choice="${choice}"]').click()`);
}
await evaluate(`(() => {
  const select = document.querySelector('#mvp1Select');
  select.value = select.options[2].value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#saveGameButton').click();
})()`);
await waitFor(`!document.querySelector('#forceRetryButton').classList.contains('is-hidden')`);
await evaluate(`document.querySelector('#retryButton').click()`);
await waitFor(`document.querySelector('#statusText').textContent.includes('Запис поки не знайдено')`);
const noBlindRetryCheck = await evaluate(`({
  saveCalls: window.__balance3Qa.saveCalls,
  pendingPresent: localStorage.getItem('balance3:pending-write:v1') !== null
})`);
if (noBlindRetryCheck.saveCalls !== 3 || !noBlindRetryCheck.pendingPresent) throw new Error(`Blind retry guard failed: ${JSON.stringify(noBlindRetryCheck)}`);
await evaluate(`document.querySelector('#cancelPendingButton').click()`);
await waitFor(`localStorage.getItem('balance3:pending-write:v1') === null`);

await evaluate(`document.querySelector('[data-step-target="players"]').click()`);
await evaluate(`(() => {
  const count = document.querySelector('#teamCountSelect');
  count.value = '3';
  count.dispatchEvent(new Event('change', { bubbles: true }));
  const manual = document.querySelector('input[name="balanceMode"][value="manual"]');
  manual.checked = true;
  manual.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#formTeamsButton').click();
})()`);
await waitFor(`document.querySelectorAll('#unassignedList [data-move-player]').length === 12`);
for (let index = 0; index < 12; index += 1) {
  await evaluate(`(() => {
    const select = document.querySelector('#unassignedList [data-move-player]');
    select.value = 'team${index % 3 + 1}';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}
await waitFor(`document.querySelectorAll('#unassignedList [data-move-player]').length === 0`);
const manualCheck = await evaluate(`Array.from(document.querySelectorAll('.b3-team__players')).map((node) => node.querySelectorAll('.b3-team-player').length)`);
if (manualCheck.length !== 3 || manualCheck.some((size) => size !== 4)) throw new Error(`Manual assignment failed: ${JSON.stringify(manualCheck)}`);

await command('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
  mobile: false,
});
await command('Page.navigate', { url: APP_URL });
await waitFor(`document.readyState === 'complete' && document.querySelector('#loadPlayersButton')`);
await evaluate(`document.querySelector('#loadPlayersButton').click()`);
await waitFor(`document.querySelectorAll('[data-player-key]').length === 50`);
for (let index = 0; index < 10; index += 1) {
  await evaluate(`document.querySelector('[data-player-key][aria-pressed="false"]').click()`);
}
await evaluate(`document.querySelector('#formTeamsButton').click()`);
await waitFor(`document.querySelectorAll('.b3-team').length === 2`);
const desktopCheck = await evaluate(`({
  cards: document.querySelectorAll('.b3-team').length,
  assigned: document.querySelectorAll('.b3-team-player').length,
  overflow: document.documentElement.scrollWidth - window.innerWidth
})`);
if (desktopCheck.cards !== 2 || desktopCheck.assigned !== 10 || desktopCheck.overflow > 1) throw new Error(`Desktop check failed: ${JSON.stringify(desktopCheck)}`);
await screenshot('teams-2-desktop.png');

await evaluate(`(() => {
  sessionStorage.setItem('balance3:qa-preserve-storage', '1');
  localStorage.setItem('balance3:pending-write:v1', JSON.stringify({
    requestId: 'qa-pending-write',
    startedAt: Date.now(),
    payload: { league: 'sundaygames', team1: 'Player 01', team2: 'Player 02', winner: 'team1', mvp: 'Player 01', mvp2: '', mvp3: '', series: '111' }
  }));
  location.reload();
})()`);
await waitFor(`!document.querySelector('#restoreBanner').classList.contains('is-hidden') && document.querySelector('#statusText').textContent.includes('непідтверджене')`);
await evaluate(`location.reload()`);
await waitFor(`!document.querySelector('#restoreBanner').classList.contains('is-hidden') && document.querySelector('#statusText').textContent.includes('непідтверджене')`);
const restoreSurvivalCheck = await evaluate(`(() => {
  const draft = JSON.parse(localStorage.getItem('balance3:draft:v1') || 'null');
  return {
    bannerVisible: !document.querySelector('#restoreBanner').classList.contains('is-hidden'),
    selected: draft?.selectedKeys?.length || 0,
    pendingVisible: !document.querySelector('#forceRetryButton').classList.contains('is-hidden')
  };
})()`);
if (!restoreSurvivalCheck.bannerVisible || restoreSurvivalCheck.selected !== 10 || !restoreSurvivalCheck.pendingVisible) throw new Error(`Restore survival failed: ${JSON.stringify(restoreSurvivalCheck)}`);
await evaluate(`localStorage.removeItem('balance3:pending-write:v1'); sessionStorage.removeItem('balance3:qa-preserve-storage')`);

if (browserErrors.length) throw new Error(`Browser errors: ${browserErrors.join(' | ')}`);
console.log(JSON.stringify({
  ok: true,
  twoTeamCheck,
  twelveTeamCheck,
  visualCheck,
  stickyCheck,
  saveReconciliationCheck,
  duplicateRecoveryCheck,
  noBlindRetryCheck,
  manualCheck,
  desktopCheck,
  restoreSurvivalCheck,
  screenshots: ['artifacts/balance3-qa/settings-hidden-rating-mobile.png', 'artifacts/balance3-qa/teams-12-mobile.png', 'artifacts/balance3-qa/result-10-mobile.png', 'artifacts/balance3-qa/teams-2-desktop.png'],
}, null, 2));

await command('Page.close');
socket.close();
