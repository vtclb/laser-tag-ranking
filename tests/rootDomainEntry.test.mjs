import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const v2Html = await readFile(new URL('../v2/index.html', import.meta.url), 'utf8');
const routerJs = await readFile(new URL('../v2/core/router.js', import.meta.url), 'utf8');

test('root domain boots the current v2 app without exposing the v2 path', () => {
  assert.match(rootHtml, /src="\.\/v2\/core\/router\.js/);
  assert.doesNotMatch(rootHtml, /http-equiv="refresh"|location\.replace\([^)]*v2\/index\.html/);
  assert.match(routerJs, /new URL\(path, V2_BASE_URL\)\.href/);
  assert.match(routerJs, /if \(location\.hash &&/);
});

test('root and legacy v2 entry expose the branded social preview', () => {
  for (const html of [rootHtml, v2Html]) {
    assert.match(html, /property="og:title" content="Рейтингова система «Варта»"/);
    assert.match(html, /property="og:image" content="https:\/\/lasertagif\.online\/v2\/assets\/og-varta-ranking-v2\.png"/);
    assert.match(html, /property="og:image:width" content="1200"/);
    assert.match(html, /property="og:image:height" content="630"/);
    assert.match(html, /name="twitter:card" content="summary_large_image"/);
    assert.match(html, /rel="canonical" href="https:\/\/lasertagif\.online\/"/);
  }
});
