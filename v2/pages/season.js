import { listSeasonMasters, getSeasonMaster, normalizeLeague, safeErrorMessage } from '../core/dataHub.js';

const DEFAULT_SEASON_ID = 'winter_2025_2026';
const SEASON_LABELS = {
  summer_2025: 'Літо 2025',
  autumn_2025: 'Осінь 2025',
  winter_2025_2026: 'Зима 2025–2026',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function dash(value) {
  if (value === null || value === undefined) return '—';
  const text = String(value).trim();
  return text ? escapeHtml(text) : '—';
}

function numberOrDash(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return dash(value);
  return String(Number.isInteger(n) ? n : Number(n.toFixed(2)));
}

function seasonTitle(seasonId) {
  return SEASON_LABELS[seasonId] || String(seasonId || '').replaceAll('_', ' ');
}

function leagueLabel(league) {
  return league === 'kids' ? 'Kids' : 'Sunday Games';
}

function normalizeLeagueSummary(summary = {}) {
  const source = (summary && typeof summary === 'object') ? summary : {};
  const normalized = {};
  Object.entries(source).forEach(([key, value]) => {
    const league = normalizeLeague(key);
    if (!league) return;
    normalized[league] = (value && typeof value === 'object') ? value : {};
  });
  return normalized;
}

function leagueCardsHtml(leagueSummary = {}) {
  const normalized = normalizeLeagueSummary(leagueSummary);
  return ['kids', 'sundaygames'].map((league) => {
    const row = normalized[league] || {};
    return `<article class="season-stat-card"><h3>${leagueLabel(league)}</h3><dl><div><dt>Матчі</dt><dd>${numberOrDash(row.matches ?? row.games)}</dd></div><div><dt>Гравці</dt><dd>${numberOrDash(row.players)}</dd></div><div><dt>Сер. рейтинг</dt><dd>${numberOrDash(row.avg_rating ?? row.average_rating ?? row.rating_avg)}</dd></div></dl></article>`;
  }).join('');
}

function awardValue(value) {
  if (value && typeof value === 'object') return value.player || value.nick || value.title || value.value || '—';
  return value;
}

function awardsHtml(awards = {}) {
  const entries = Object.entries((awards && typeof awards === 'object') ? awards : {}).sort(([a], [b]) => a.localeCompare(b, 'uk'));
  if (!entries.length) return '<p class="px-card__text">Немає awards для цього сезону.</p>';
  return `<div class="season-awards-grid">${entries.map(([key, value]) => `<article class="season-award"><small>${dash(key)}</small><strong>${dash(awardValue(value))}</strong></article>`).join('')}</div>`;
}

function seriesHtml(seriesSummary = {}) {
  const rows = Object.entries((seriesSummary && typeof seriesSummary === 'object') ? seriesSummary : {})
    .sort((a, b) => a[0].localeCompare(b[0], 'uk'));
  if (!rows.length) return '<p class="px-card__text">Немає даних серій.</p>';
  return `<div class="season-series-list">${rows.map(([key, value]) => {
    const qty = (value && typeof value === 'object') ? (value.count ?? value.total ?? value.qty) : value;
    const share = (value && typeof value === 'object') ? (value.share ?? value.percent ?? value.ratio) : null;
    return `<article class="season-series-item"><strong>${dash(key)}</strong><span>${numberOrDash(qty)}${share !== null && share !== undefined && share !== '' ? ` • ${numberOrDash(share)}%` : ''}</span></article>`;
  }).join('')}</div>`;
}

function playersTableHtml(players = []) {
  const rows = Array.isArray(players) ? [...players] : [];
  if (!rows.length) return '<p class="px-card__text">Немає гравців у цьому сезоні.</p>';

  rows.sort((a, b) => (Number(b.Rating_end ?? b.rating_end) || 0) - (Number(a.Rating_end ?? a.rating_end) || 0));
  return `<div class="season-table-wrap"><table class="season-table"><thead><tr><th>Ліга</th><th>Nickname</th><th>Matches</th><th>Wins</th><th>Draws</th><th>Losses</th><th>MVP</th><th>Rating</th><th>Δ Rating</th><th>Rank</th></tr></thead><tbody>${rows.map((player) => {
    const league = normalizeLeague(player.league || player.League || player.league_id || player.lg);
    return `<tr><td>${dash(leagueLabel(league))}</td><td>${dash(player.nickname ?? player.nick ?? player.player)}</td><td>${numberOrDash(player.matches)}</td><td>${numberOrDash(player.wins)}</td><td>${numberOrDash(player.draws)}</td><td>${numberOrDash(player.losses)}</td><td>${numberOrDash(player.MVP_total ?? player.mvp_total)}</td><td>${numberOrDash(player.Rating_end ?? player.rating_end)}</td><td>${numberOrDash(player.Rating_delta ?? player.rating_delta)}</td><td>${numberOrDash(player.Rank_final ?? player.rank_final)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderSeason(seasonId, master) {
  const sections = master?.sections || {};
  const meta = sections.season_meta || {};

  const titleEl = document.getElementById('seasonPageTitle');
  const heroEl = document.getElementById('seasonHero');
  const summaryEl = document.getElementById('seasonLeagueSummary');
  const awardsEl = document.getElementById('seasonAwards');
  const playersEl = document.getElementById('seasonPlayers');
  const seriesEl = document.getElementById('seasonSeries');

  if (titleEl) titleEl.textContent = seasonTitle(seasonId);
  if (heroEl) heroEl.innerHTML = `<h2 class="px-card__title">${dash(meta.title || seasonTitle(seasonId))}</h2><p class="px-card__text">Період: ${dash(meta.period || meta.date_range)}</p><p class="px-card__text">Оновлено: ${dash(meta.generated || meta.updated || meta.updated_at)}</p>`;
  if (summaryEl) summaryEl.innerHTML = leagueCardsHtml(sections.league_summary);
  if (awardsEl) awardsEl.innerHTML = awardsHtml(sections.awards);
  if (playersEl) playersEl.innerHTML = playersTableHtml(sections.players);
  if (seriesEl) seriesEl.innerHTML = seriesHtml(sections.series_summary);
}

async function loadAndRenderSeason(seasonId) {
  const stateEl = document.getElementById('seasonState');
  if (stateEl) stateEl.textContent = 'Завантаження...';
  try {
    const master = await getSeasonMaster(seasonId);
    renderSeason(seasonId, master);
    if (stateEl) stateEl.textContent = '';
  } catch (error) {
    if (stateEl) stateEl.textContent = safeErrorMessage(error, 'Не вдалося завантажити сезонні дані');
  }
}

export async function initSeasonPage(params = {}) {
  const root = document.getElementById('view');
  if (!root) return;

  root.innerHTML = `<section class="px-card season-header"><h1 class="px-card__title" id="seasonPageTitle">Сезон</h1></section><section class="px-card px-card--accent"><div class="season-controls-row"><select id="seasonSelect" class="search-input" aria-label="Обрати сезон"></select></div><div id="seasonHero"></div></section><section class="px-card"><h2 class="px-card__title">League summary</h2><div class="season-league-cards" id="seasonLeagueSummary"></div></section><section class="px-card"><h2 class="px-card__title">Awards</h2><div id="seasonAwards"></div></section><section class="px-card"><h2 class="px-card__title">Players</h2><div id="seasonPlayers"></div></section><section class="px-card"><h2 class="px-card__title">Series summary</h2><div id="seasonSeries"></div><p class="px-card__text" id="seasonState"></p></section>`;

  const select = document.getElementById('seasonSelect');
  if (!select) return;

  let seasons = [];
  try {
    seasons = await listSeasonMasters();
  } catch {
    seasons = [];
  }
  if (!seasons.length) seasons = ['summer_2025', 'autumn_2025', 'winter_2025_2026'];

  const selected = seasons.includes(params.season) ? params.season : (seasons.includes(DEFAULT_SEASON_ID) ? DEFAULT_SEASON_ID : seasons[0]);
  select.innerHTML = seasons.map((seasonId) => `<option value="${escapeHtml(seasonId)}">${escapeHtml(seasonTitle(seasonId))}</option>`).join('');
  select.value = selected;
  select.onchange = () => { location.hash = `#season?season=${encodeURIComponent(select.value)}`; };

  await loadAndRenderSeason(selected);
}
