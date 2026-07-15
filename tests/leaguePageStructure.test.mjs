import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const template = await readFile(new URL('../v2/pages/league.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../v2/pages/league-stats.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../v2/assets/css/main.css', import.meta.url), 'utf8');

test('league page starts with the league hero before ranking sections', () => {
  const heroIndex = template.indexOf('id="leagueHero"');
  const analyticsIndex = template.indexOf('id="leagueAnalyticsSection"');
  const fullTableIndex = template.indexOf('id="leagueFullRankingSection"');

  assert.ok(heroIndex >= 0);
  assert.ok(analyticsIndex > heroIndex);
  assert.ok(fullTableIndex > analyticsIndex);
});

test('league page replaces duplicated top 10 with league analytics', () => {
  assert.doesNotMatch(template, /leagueTop10|ТОП-10 гравців/);
  assert.match(template, /id="leagueAnalytics"/);
  assert.match(template, /id="leagueSearchInput"/);
  assert.doesNotMatch(template, /id="leagueSortSelect"|league-mobile-sort/);
  assert.match(template, /league-sort-header/);
  assert.doesNotMatch(script, /compactTop10Markup/);
  assert.match(script, /renderLeagueAnalytics/);
  assert.match(script, /Боротьба за перше місце/);
  assert.match(script, /MVP-ефективність/);
  assert.match(script, /state\.isFullOpen \|\| state\.searchTerm/);
});

test('league page uses one command-center hierarchy instead of stacked px cards', () => {
  assert.match(template, /class="league-command-center"/);
  assert.match(template, /class="league-season-story"/);
  assert.match(template, /class="league-secondary-grid"/);
  assert.doesNotMatch(template, /class="px-card league-(?:hero|infographic|pulse|full-ranking|ranks-section|gameday-section)"/);
  assert.doesNotMatch(template, /<main\b/);
  assert.match(css, /League command center/);
});

test('league page explains a season with no games without hiding starting ratings', () => {
  assert.match(template, /id="leagueSeasonNotice"/);
  assert.match(script, /renderSeasonNotice/);
  assert.match(script, /Сезон ще не стартував/);
  assert.match(script, /стартовий рейтинг/);
});

test('league mobile controls keep touch targets and avoid an oversized player column', () => {
  assert.match(css, /league-search-input[\s\S]*min-height: 44px/);
  assert.match(css, /league-full-ranking \.league-table-shell[\s\S]*overflow-x: auto/);
  assert.match(css, /league-ranking-table[\s\S]*min-width: 580px !important/);
  assert.match(css, /league-ranking-table__cell--player[\s\S]*width: 170px !important/);
  assert.doesNotMatch(script, /league-player-cell__mobile-meta/);
  assert.match(template, /Таблицю можна прокручувати вбік/);
  assert.match(css, /league-pulse__layout[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
});
