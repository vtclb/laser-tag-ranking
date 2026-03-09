import { listSeasonMasters, getSeasonMaster, safeErrorMessage } from '../core/dataHub.js';
import { leagueLabelUA, normalizeLeague, normalizeLeagueSummary } from '../core/naming.js';

const DEFAULT_SEASON_ID = 'winter_2025_2026';

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function dash(v) { return (v === null || v === undefined || v === '') ? '—' : esc(v); }

function rankBadge(rank) {
  const label = String(rank || 'F').toUpperCase();
  return `<span class="rank-badge rank--${label}">${label}</span>`;
}

function seasonTitle(seasonId) { return String(seasonId || 'Сезон').replaceAll('_', ' '); }

function svgStatsChart(player = {}) {
  const stats = [
    { k: 'Матчі', v: num(player.matches) || 0, m: 20 },
    { k: 'Перемоги', v: num(player.wins) || 0, m: 20 },
    { k: 'MVP', v: num(player.MVP_total ?? player.mvp_total) || 0, m: 15 },
    { k: 'Рейтинг', v: num(player.Rating_end ?? player.rating_end) || 0, m: 1400 }
  ];
  const hasData = stats.some((item) => item.v > 0);
  if (!hasData) return '<p class="px-card__text">Немає даних для графіка</p>';

  const cx = 120; const cy = 110; const radius = 72;
  const toPoint = (idx, value, max) => {
    const angle = ((Math.PI * 2) / stats.length) * idx - Math.PI / 2;
    const r = Math.max(0, Math.min(1, value / max)) * radius;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  };

  const axes = stats.map((item, idx) => {
    const [x, y] = toPoint(idx, item.m, item.m);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="rgba(255,255,255,.25)" />`;
  }).join('');
  const labels = stats.map((item, idx) => {
    const [x, y] = toPoint(idx, item.m + 2, item.m);
    return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" fill="var(--fg-1)" font-size="10" text-anchor="middle">${item.k}</text>`;
  }).join('');
  const polygon = stats.map((item, idx) => {
    const [x, y] = toPoint(idx, item.v, item.m);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  return `<svg viewBox="0 0 240 220" class="season-radar" role="img" aria-label="Міні графік показників"><polygon points="${polygon}" fill="rgba(183,255,42,.35)" stroke="var(--accent)" stroke-width="2"/>${axes}${labels}<circle cx="${cx}" cy="${cy}" r="2" fill="var(--accent-2)"/></svg>`;
}

function renderSeason(seasonId, master) {
  const sections = master?.sections || {};
  const meta = sections.season_meta || {};
  const summary = normalizeLeagueSummary(sections.league_summary);
  const awardsEntries = Object.entries(sections.awards || {});
  const players = Array.isArray(sections.players) ? [...sections.players] : [];
  players.sort((a, b) => (num(b.Rating_end ?? b.rating_end) || 0) - (num(a.Rating_end ?? a.rating_end) || 0));
  const maxDelta = Math.max(1, ...players.map((p) => Math.abs(num(p.Rating_delta ?? p.rating_delta) || 0)));

  const titleEl = document.getElementById('seasonPageTitle');
  const heroEl = document.getElementById('seasonHero');
  const summaryEl = document.getElementById('seasonLeagueSummary');
  const awardsEl = document.getElementById('seasonAwards');
  const playersEl = document.getElementById('seasonPlayers');
  const chartEl = document.getElementById('seasonChart');

  if (titleEl) titleEl.textContent = seasonTitle(seasonId);
  if (heroEl) heroEl.innerHTML = `<h2 class="px-card__title">${dash(meta.title || seasonTitle(seasonId))}</h2><p class="px-card__text">Період: ${dash(meta.period || meta.date_range)}</p>`;

  if (summaryEl) {
    summaryEl.innerHTML = ['kids', 'olds'].map((league) => {
      const row = summary[league] || {};
      return `<div class="season-stat-card"><h3>${leagueLabelUA(league)}</h3><p>Матчі: <strong>${dash(row.matches ?? row.games)}</strong></p><p>Гравці: <strong>${dash(row.players)}</strong></p><p>Сер. рейтинг: <strong>${dash(row.avg_rating ?? row.average_rating)}</strong></p></div>`;
    }).join('');
  }

  if (awardsEl) {
    awardsEl.innerHTML = awardsEntries.length
      ? `<ul class="season-awards-list">${awardsEntries.map(([k, v]) => `<li><strong>${dash(k)}:</strong> ${dash(v?.player || v?.nick || v)}</li>`).join('')}</ul>`
      : '<p class="px-card__text">Немає нагород</p>';
  }

  if (playersEl) {
    playersEl.innerHTML = players.length ? `<div class="season-table-wrap"><table class="season-table"><thead><tr><th>#</th><th>Гравець</th><th>Ліга</th><th>Матчі</th><th>Перемоги</th><th>MVP</th><th>Рейтинг</th><th>Δ Rating</th><th>Ранг</th></tr></thead><tbody>${players.map((p, idx) => {
      const delta = num(p.Rating_delta ?? p.rating_delta) || 0;
      const width = Math.min(100, Math.round((Math.abs(delta) / maxDelta) * 100));
      const league = normalizeLeague(p.league || p.League || p.league_id || p.lg);
      const rank = p.Rank_final ?? p.rank_final ?? p.rankLetter;
      return `<tr><td>${idx + 1}</td><td>${dash(p.nickname ?? p.nick ?? p.player)}</td><td>${leagueLabelUA(league)}</td><td>${dash(p.matches)}</td><td>${dash(p.wins)}</td><td>${dash(p.MVP_total ?? p.mvp_total)}</td><td>${dash(p.Rating_end ?? p.rating_end)}</td><td><span class="delta-bar"><span style="width:${width}%"></span></span> ${delta > 0 ? '+' : ''}${delta}</td><td>${rankBadge(rank)}</td></tr>`;
    }).join('')}</tbody></table></div>` : '<p class="px-card__text">Немає гравців</p>';
  }

  if (chartEl) chartEl.innerHTML = svgStatsChart(players[0]);
}

async function loadAndRenderSeason(selectedSeasonId) {
  const seasonState = document.getElementById('seasonState');
  if (seasonState) seasonState.textContent = 'Завантаження сезону…';
  try {
    const master = await getSeasonMaster(selectedSeasonId);
    renderSeason(selectedSeasonId, master);
    if (seasonState) seasonState.textContent = '';
  } catch (error) {
    if (seasonState) seasonState.textContent = safeErrorMessage(error, 'Не вдалося завантажити сезон');
  }
}

export async function initSeasonPage(params = {}) {
  const root = document.getElementById('view');
  if (!root) return;

  root.innerHTML = `<section class="px-card season-header"><h1 id="seasonPageTitle">Сезон</h1></section><section class="px-card px-card--accent"><div class="season-controls-row"><select id="seasonSelect" class="search-input"></select></div><div id="seasonHero"></div><p id="seasonState" class="px-card__text"></p></section><section class="px-card"><h2 class="px-card__title">Статистика ліг</h2><div class="season-league-cards" id="seasonLeagueSummary"></div></section><section class="px-card"><h2 class="px-card__title">Нагороди</h2><div id="seasonAwards"></div></section><section class="px-card"><h2 class="px-card__title">Порівняння показників</h2><div id="seasonChart"></div></section><section class="px-card"><h2 class="px-card__title">Гравці сезону</h2><div id="seasonPlayers"></div></section>`;

  const select = document.getElementById('seasonSelect');
  if (!select) return;

  let seasons = [];
  try { seasons = await listSeasonMasters(); } catch { seasons = []; }
  if (!seasons.length) seasons = [DEFAULT_SEASON_ID];

  const selectedSeasonId = seasons.includes(params.season)
    ? params.season
    : (seasons.includes(DEFAULT_SEASON_ID) ? DEFAULT_SEASON_ID : seasons[0]);

  select.innerHTML = seasons.map((seasonId) => `<option value="${esc(seasonId)}">${esc(seasonTitle(seasonId))}</option>`).join('');
  select.value = selectedSeasonId;
  select.addEventListener('change', () => {
    const nextSeasonId = select.value;
    location.hash = `#season?season=${encodeURIComponent(nextSeasonId)}`;
    loadAndRenderSeason(nextSeasonId);
  });

  await loadAndRenderSeason(selectedSeasonId);
}
