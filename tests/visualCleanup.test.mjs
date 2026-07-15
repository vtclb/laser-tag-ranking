import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../v2/assets/css/main.css', import.meta.url), 'utf8');

test('final visual cleanup removes nested borders from bottom navigation content', () => {
  assert.match(css, /\.v2-bottom-nav \.v2-nav-btn__icon,[\s\S]*?border:\s*0\s*!important/);
  assert.match(css, /\.v2-bottom-nav \{[\s\S]*?border-radius:\s*6px 6px 0 0\s*!important/);
});

test('profile progress and league ranking use rectangular single-layer styling', () => {
  assert.match(css, /\.profile-rank-progress-card__head[\s\S]*?border-radius:\s*0\s*!important/);
  assert.match(css, /\.league-ranking-table__row \{[\s\S]*?border-radius:\s*0\s*!important;[\s\S]*?box-shadow:\s*none\s*!important/);
  assert.match(css, /\.league-ranking-table__cell \{[\s\S]*?border-bottom:\s*1px solid/);
});

test('archive surfaces keep the shared compact radius', () => {
  assert.match(css, /#seasons \.sx-hero,[\s\S]*?#seasons \.sx-year-top \{[\s\S]*?border-radius:\s*6px\s*!important/);
  assert.match(css, /#seasons \.sx-season-node,[\s\S]*?#seasons \.sx-season-open \{[\s\S]*?border-radius:\s*4px\s*!important/);
});
