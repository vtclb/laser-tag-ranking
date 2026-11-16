import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../v2/pages/global-styles.js', import.meta.url), 'utf8');
test('club links use real destinations and the existing league intake', () => {
  assert.match(source, /site.href = 'https:\/\/lasertagif.com.ua\/'/);
  assert.match(source, /booking.href = 'https:\/\/lasertagif.com.ua\/contacts\?event=league#contact-inquiry-uk'/);
  assert.match(source, /if \(document.getElementById\('v2-club-links'\)\) return/);
  assert.match(source, /app.prepend\(nav\)/);
  const bottom = source.slice(source.indexOf('function ensureBottomNav'), source.indexOf('function ensureSkipLink'));
  assert.equal((bottom.match(/data-route="/g) || []).length, 6);
});
