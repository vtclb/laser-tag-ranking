import { listSeasonMasters, getSeasonMaster, safeErrorMessage } from '../core/dataHub.js';
import { leagueLabelUA, normalizeLeague } from '../core/naming.js';

const DEFAULT_SEASON_ID = 'winter_2025_2026';

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function seasonTitle(seasonId) { return String(seasonId || 'Сезон').replaceAll('_', ' '); }
function num(v, fb = null) { const n = Number(v); return Number.isFinite(n) ? n : fb; }
function rankBadge(rank) { const label = String(rank || '—').toUpperCase(); return `<span class="rank-badge rank--${label}">${label}</span>`; }

function sortPlayers(players, sortKey = 'rating') {
  const get = (p) => ({
    rating: num(p.rating_end, -1e9),
    matches: num(p.matches, 0),
    mvp: num(p.mvp_total, 0),
    delta: num(p.rating_delta, -1e9)
  }[sortKey] ?? num(p.rating_end, -1e9));
  return [...players].sort((a, b) => get(b) - get(a) || String(a.nickname).localeCompare(String(b.nickname), 'uk'));
}

function getTop10(players = []) {
  return [...players].sort((a, b) => {
    const rankA = num(a.rank_final, null);
    const rankB = num(b.rank_final, null);
    if (rankA !== null || rankB !== null) {
      if (rankA === null) return 1;
      if (rankB === null) return -1;
      return rankA - rankB;
    }
    return (num(b.rating_end, 0) - num(a.rating_end, 0));
  }).slice(0, 10);
}

function summaryMetrics(summaryRow = {}, players = []) {
  const matches = num(summaryRow.matches ?? summaryRow.games, players.reduce((s, p) => s + (p.matches || 0), 0)) || 0;
  const activePlayers = num(summaryRow.players ?? summaryRow.active_players, players.length) || 0;
  const avgRating = num(summaryRow.avg_rating ?? summaryRow.average_rating, null);
  const mvpTotal = players.reduce((sum, player) => sum + (num(player.mvp_total, 0) || 0), 0);
  return { matches, activePlayers, avgRating, mvpTotal };
}

function updateHash(season, league) {
  location.hash = `#season?season=${encodeURIComponent(season)}&league=${league}`;
}

export async function initSeasonPage(params = {}) {
  const root = document.getElementById('view');
  if (!root) return;

  root.innerHTML = `<section class="season-header px-card px-card--accent"><h1 id="seasonPageTitle">Сезон</h1><p id="seasonPeriod" class="px-card__text">Період: —</p><p id="seasonUpdated" class="px-card__text">Оновлення: —</p></section>
<section class="px-card"><div class="season-controls-row"><select id="seasonSelect" class="search-input"></select><div class="league-toggle"><label><input type="radio" name="leagueToggle" value="kids"> Дитяча ліга</label><label><input type="radio" name="leagueToggle" value="sundaygames"> Доросла ліга</label></div><select id="seasonSort" class="search-input"><option value="rating">Сортувати: рейтинг</option><option value="matches">Сортувати: матчі</option><option value="mvp">Сортувати: MVP</option><option value="delta">Сортувати: Δ рейтингу</option></select></div><p id="seasonState" class="px-card__text"></p></section>
<section class="season-league-summary px-card"><h2>Summary ліги</h2><div id="seasonLeagueSummary"></div></section>
<section class="season-awards px-card"><h2>Герої сезону</h2><div id="seasonAwards"></div></section>
<section class="season-top10 px-card"><h2>ТОП-10 гравців сезону</h2><div id="seasonTop10"></div></section>
<section class="season-players px-card"><h2>Всі гравці ліги</h2><div id="seasonPlayers"></div></section>
<section class="season-series px-card"><h2>Series summary</h2><div id="seasonSeries"></div></section>
<section class="px-card"><h2>Інфографіка сезону</h2><div id="seasonChart"></div></section>`;

  const select = document.getElementById('seasonSelect');
  const state = document.getElementById('seasonState');
  const sort = document.getElementById('seasonSort');
  if (!select || !state || !sort) return;

  let seasons = [];
  try { seasons = await listSeasonMasters(); } catch { seasons = []; }
  if (!seasons.length) seasons = [DEFAULT_SEASON_ID];

  let selectedSeason = seasons.includes(params.season) ? params.season : (seasons[0] || DEFAULT_SEASON_ID);
  let selectedLeague = normalizeLeague(params.league) || 'kids';

  select.innerHTML = seasons.map((seasonId) => `<option value="${esc(seasonId)}">${esc(seasonTitle(seasonId))}</option>`).join('');
  select.value = selectedSeason;
  root.querySelector(`input[name="leagueToggle"][value="${selectedLeague}"]`)?.setAttribute('checked', 'checked');

  async function load() {
    state.textContent = 'Завантаження сезону…';
    try {
      const master = await getSeasonMaster(selectedSeason);
      const sections = master?.sections || {};
      const meta = sections.season_meta || {};
      const players = (Array.isArray(sections.players) ? sections.players : []).filter((player) => normalizeLeague(player.league) === selectedLeague);
      const summaryRow = sections.league_summary?.[selectedLeague] || {};
      const awards = Array.isArray(sections.awards?.[selectedLeague]) ? sections.awards[selectedLeague] : [];
      const series = Array.isArray(sections.series_summary?.[selectedLeague]) ? sections.series_summary[selectedLeague] : [];
      const top10 = getTop10(players);
      const metrics = summaryMetrics(summaryRow, players);

      document.getElementById('seasonPageTitle').textContent = `${seasonTitle(selectedSeason)} · ${leagueLabelUA(selectedLeague)}`;
      document.getElementById('seasonPeriod').textContent = `Період: ${meta.period || meta.date_range || meta.dateRange || 'Немає даних'}`;
      document.getElementById('seasonUpdated').textContent = `Оновлення: ${meta.updated_at || meta.updated || 'Немає даних'}`;

      document.getElementById('seasonLeagueSummary').innerHTML = `<div class="season-stat-card"><p>Матчі: <strong>${metrics.matches}</strong></p><p>Гравці: <strong>${metrics.activePlayers}</strong></p><p>Середній рейтинг: <strong>${metrics.avgRating ?? 'Немає даних'}</strong></p></div>`;

      const awardsMap = { mvp: 'MVP сезону', progress: 'Найкращий прогрес', active: 'Найактивніший', stable: 'Найстабільніший' };
      document.getElementById('seasonAwards').innerHTML = awards.length
        ? `<div class="hero-grid">${awards.map((item) => {
          const key = String(item.award || item.type || item.category || '').toLowerCase();
          const title = awardsMap[key] || item.award || item.type || 'Нагорода';
          return `<article class="px-card"><h3>${esc(title)}</h3><p>${esc(item.nickname || item.player || item.nick || '—')}</p></article>`;
        }).join('')}</div>`
        : '<p class="px-card__text">Нагороди ще не сформовані</p>';

      const renderTable = (rows) => `<div class="season-table-wrap"><table class="season-table"><thead><tr><th>#</th><th>Нік</th><th>Матчі</th><th>Перемоги</th><th>Нічиї</th><th>Поразки</th><th>MVP</th><th>Фін. рейтинг</th><th>Δ рейтингу</th><th>Ранг</th></tr></thead><tbody>${rows.map((p, idx) => `<tr><td>${idx + 1}</td><td>${esc(p.nickname || '—')}</td><td>${p.matches ?? '—'}</td><td>${p.wins ?? '—'}</td><td>${p.draws ?? '—'}</td><td>${p.losses ?? '—'}</td><td>${p.mvp_total ?? '—'}</td><td>${p.rating_end ?? '—'}</td><td>${(p.rating_delta > 0 ? '+' : '')}${p.rating_delta ?? 0}</td><td>${rankBadge(p.rank_final)}</td></tr>`).join('')}</tbody></table></div>`;
      document.getElementById('seasonTop10').innerHTML = top10.length ? renderTable(top10) : '<p class="px-card__text">Немає даних</p>';
      document.getElementById('seasonPlayers').innerHTML = players.length ? renderTable(sortPlayers(players, sort.value)) : '<p class="px-card__text">Немає даних</p>';

      document.getElementById('seasonSeries').innerHTML = series.length
        ? `<ul>${series.map((item) => `<li>${esc(item.format || item.series || 'Серія')}: <strong>${esc(item.count ?? item.total ?? '—')}</strong>${item.percent || item.share ? ` (${esc(item.percent || item.share)}%)` : ''}</li>`).join('')}</ul>`
        : '<p class="px-card__text">Немає даних</p>';

      const rankDist = players.reduce((acc, p) => {
        const key = String(p.rank_final || '—').toUpperCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const rankList = Object.entries(rankDist).sort(([a], [b]) => a.localeCompare(b));
      document.getElementById('seasonChart').innerHTML = `<p>Матчі: <strong>${metrics.matches}</strong></p><p>Активні гравці: <strong>${metrics.activePlayers}</strong></p><p>Середній рейтинг: <strong>${metrics.avgRating ?? 'Немає даних'}</strong></p><p>Загальні MVP: <strong>${metrics.mvpTotal}</strong></p>${rankList.length ? `<div>${rankList.map(([rank, count]) => `<span class="tag">${rank}: ${count}</span>`).join(' ')}</div>` : '<p>Rank distribution: Немає даних</p>'}`;

      state.textContent = '';
    } catch (error) {
      state.textContent = safeErrorMessage(error, 'Не вдалося завантажити сезон');
    }
  }

  select.addEventListener('change', () => {
    selectedSeason = select.value;
    updateHash(selectedSeason, selectedLeague);
    load();
  });

  sort.addEventListener('change', load);

  root.querySelectorAll('input[name="leagueToggle"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      selectedLeague = normalizeLeague(radio.value) || 'kids';
      updateHash(selectedSeason, selectedLeague);
      load();
    });
  });

  await load();
}
