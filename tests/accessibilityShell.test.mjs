import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const globalStylesSource = await readFile(new URL('../v2/pages/global-styles.js', import.meta.url), 'utf8');
const loadingSource = await readFile(new URL('../v2/scripts/loading-cubes.js', import.meta.url), 'utf8');
const routerSource = await readFile(new URL('../v2/core/router.js', import.meta.url), 'utf8');
const mainCss = await readFile(new URL('../v2/assets/css/main.css', import.meta.url), 'utf8');
const balanceHtml = await readFile(new URL('../v2/balance2.html', import.meta.url), 'utf8');
const balanceCss = await readFile(new URL('../v2/styles/balance2.css', import.meta.url), 'utf8');

test('global navigation uses landmarks and keeps the closed dialog out of the accessibility tree', () => {
  assert.match(globalStylesSource, /document\.createElement\('nav'\)/);
  assert.match(globalStylesSource, /sheet\.hidden = true/);
  assert.match(globalStylesSource, /sheet\.inert = true/);
  assert.match(globalStylesSource, /sheet\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(globalStylesSource, /aria-controls/);
  assert.match(globalStylesSource, /aria-expanded/);
});

test('navigation sheet supports keyboard containment and focus restoration', () => {
  assert.match(globalStylesSource, /event\.key !== 'Tab'/);
  assert.match(globalStylesSource, /lastFocusedElement\.focus/);
  assert.match(globalStylesSource, /event\.key === 'Escape'/);
});

test('loading overlay is hidden when idle and exposes busy state only while loading', () => {
  assert.match(loadingSource, /overlay\.hidden = true/);
  assert.match(loadingSource, /overlay\.inert = true/);
  assert.match(loadingSource, /setAttribute\('aria-busy', 'true'\)/);
  assert.match(loadingSource, /removeAttribute\('aria-busy'\)/);
});

test('router always makes the route view programmatically focusable', () => {
  assert.match(routerSource, /view\.tabIndex = -1/);
  assert.match(routerSource, /function focusRouteContent\(/);
  assert.match(routerSource, /view\.querySelector\('h1'\)/);
  assert.match(routerSource, /window\.scrollTo\(\{ top: 0/);
  assert.match(routerSource, /function stabilizeRouteFocus\(renderId\)/);
  assert.match(routerSource, /focusRouteContent\(\{ onlyWhenIdle: true \}\)/);
});

test('skip link focuses content without changing the SPA hash route', () => {
  assert.match(globalStylesSource, /function ensureSkipLink\(\)/);
  assert.match(globalStylesSource, /skipLink\.addEventListener\('click'/);
  assert.match(globalStylesSource, /event\.preventDefault\(\)/);
  assert.match(globalStylesSource, /view\.scrollIntoView/);
});

test('bottom navigation keeps player league context and gameday active state', () => {
  assert.match(globalStylesSource, /route === 'player'.*linkRoute === 'league-stats'/);
  assert.match(globalStylesSource, /route === 'gameday'.*linkRoute === 'gameday'/);
  assert.match(globalStylesSource, /'#league-stats\?league=sundaygames': 'Доросла ліга'/);
});

test('bottom navigation respects safe areas and exposes a visible keyboard focus', () => {
  assert.match(mainCss, /env\(safe-area-inset-bottom, 0px\)/);
  assert.match(mainCss, /\.v2-bottom-nav \.v2-nav-btn:focus-visible/);
  assert.match(mainCss, /min-height: 52px !important/);
});

test('balance2 has a page heading, live status, keyboard focus and 44px controls', () => {
  assert.match(balanceHtml, /<h1 id="balance2Title">Балансер команд<\/h1>/);
  assert.match(balanceHtml, /role="status" aria-live="polite"/);
  assert.match(balanceCss, /min-height: 44px/);
  assert.match(balanceCss, /:focus-visible/);
  assert.doesNotMatch(balanceCss, /^nav,\s*\.header/m);
});
