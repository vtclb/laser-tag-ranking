import { listSeasonMasters, getSeasonMaster, safeErrorMessage } from '../core/dataHub.js';
import { leagueLabelUA, normalizeLeague, normalizeLeagueSummary } from '../core/naming.js';

const DEFAULT_SEASON_ID = 'winter_2025_2026';

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function rankBadge(rank) { const label = String(rank || 'F').toUpperCase(); return `<span class="rank-badge rank--${label}">${label}</span>`; }
function seasonTitle(seasonId) { return String(seasonId || 'Сезон').replaceAll('_', ' '); }

function findLeaguePlayers(players = [], league = 'kids') {
  return players.filter((player) => normalizeLeague(player.league || player.League || player.league_id || player.lg) === league);
}

function miniBars(players = []) {
  if (!players.length) return '<p class="px-card__text">Немає даних для графіка</p>';
  const totalMatches = players.reduce((sum, p) => sum + (num(p.matches) || 0), 0);
  const totalWins = players.reduce((sum, p) => sum + (num(p.wins) || 0), 0);
  const totalMvp = players.reduce((sum, p) => sum + (num(p.MVP_total ?? p.mvp_total) || 0), 0);
  const avgRating = Math.round(players.reduce((sum, p) => sum + (num(p.Rating_end ?? p.rating_end) || 0), 0) / Math.max(1, players.length));
  const stats = [['Матчі', totalMatches], ['Перемоги', totalWins], ['MVP', totalMvp], ['Сер. рейтинг', avgRating]];
  const max = Math.max(1, ...stats.map(([, value]) => value));
  return `<div class="season-mini-bars">${stats.map(([label, value]) => `<p class="progress-line"><span>${label}: <strong>${value}</strong></span><div class="progress-shell"><div class="progress-bar" style="width:${Math.round((value / max) * 100)}%"></div></div></p>`).join('')}</div>`;
}

function renderRows(players, sortKey = 'rating') {
  const sorted = [...players].sort((a, b) => {
    const mapVal = (player) => {
      if (sortKey === 'matches') return num(player.matches) || 0;
      if (sortKey === 'points') return num(player.points ?? player.Points) || 0;
      return num(player.Rating_end ?? player.rating_end) || 0;
    };
    return mapVal(b) - mapVal(a);
  });
  return sorted.map((p, idx) => {
    const delta = num(p.Rating_delta ?? p.rating_delta) || 0;
    const rank = p.Rank_final ?? p.rank_final ?? p.rankLetter;
    return `<tr><td>${idx + 1}</td><td>${esc(p.nickname ?? p.nick ?? p.player ?? '—')}</td><td>${num(p.matches) ?? '—'}</td><td>${num(p.wins) ?? '—'}</td><td>${num(p.draws) ?? '—'}</td><td>${num(p.losses) ?? '—'}</td><td>${num(p.MVP_total ?? p.mvp_total) ?? '—'}</td><td>${num(p.Rating_end ?? p.rating_end) ?? '—'}</td><td>${delta > 0 ? '+' : ''}${delta}</td><td>${rankBadge(rank)}</td></tr>`;
  }).join('');
}

function updateHash(season, league) {
  location.hash = `#season?season=${encodeURIComponent(season)}&league=${league}`;
}

export async function initSeasonPage(params = {}) {
  const root = document.getElementById('view');
  if (!root) return;

  root.innerHTML = `<section class="season-header px-card px-card--accent"><h1 id="seasonPageTitle">Сезон</h1></section>
<section class="season-meta px-card"><p id="seasonPeriod">—</p><p id="seasonUpdated">Оновлення: —</p></section>
<section class="px-card"><div class="season-controls-row"><select id="seasonSelect" class="search-input"></select><div class="league-toggle"><label><input type="radio" name="leagueToggle" value="kids"> Дитяча ліга</label><label><input type="radio" name="leagueToggle" value="olds"> Доросла ліга</label></div></div><p id="seasonState" class="px-card__text"></p></section>
<section class="season-league-summary px-card"><h2>Статистика ліги</h2><div id="seasonLeagueSummary"></div></section>
<section class="season-awards px-card"><h2>Нагороди</h2><div id="seasonAwards"></div></section>
<section class="season-players px-card"><h2>Гравці</h2><div id="seasonPlayers"></div></section>
<section class="season-series px-card"><h2>Серії</h2><div id="seasonSeries"></div></section>
<section class="px-card"><h2>Інфографіка</h2><div id="seasonChart"></div></section>`;

  const select = document.getElementById('seasonSelect');
  const state = document.getElementById('seasonState');
  if (!select || !state) return;

  let seasons = [];
  try { seasons = await listSeasonMasters(); } catch { seasons = []; }
  if (!seasons.length) seasons = [DEFAULT_SEASON_ID];

  let selectedSeason = seasons.includes(params.season) ? params.season : (seasons[0] || DEFAULT_SEASON_ID);
  let selectedLeague = normalizeLeague(params.league) || 'kids';
  let currentSort = 'rating';

  select.innerHTML = seasons.map((seasonId) => `<option value="${esc(seasonId)}">${esc(seasonTitle(seasonId))}</option>`).join('');
  select.value = selectedSeason;
  root.querySelector(`input[name="leagueToggle"][value="${selectedLeague}"]`)?.setAttribute('checked', 'checked');

  async function load() {
    state.textContent = 'Завантаження сезону…';
    const playersEl = document.getElementById('seasonPlayers');
    if (playersEl) playersEl.innerHTML = '<div class="skeleton skeleton-line lg"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div>';

    try {
      const master = await getSeasonMaster(selectedSeason);
      const sections = master?.sections || {};
      const meta = sections.season_meta || {};
      const summary = normalizeLeagueSummary(sections.league_summary);
      const players = findLeaguePlayers(Array.isArray(sections.players) ? sections.players : [], selectedLeague);
      const awardsRaw = sections.awards?.[selectedLeague] || sections.awards || {};
      const awardsEntries = Object.entries(awardsRaw || {});
      const series = sections.series?.[selectedLeague] || sections.series || {};

      document.getElementById('seasonPageTitle').textContent = `${seasonTitle(selectedSeason)} · ${leagueLabelUA(selectedLeague)}`;
      document.getElementById('seasonPeriod').textContent = `Період: ${meta.period || meta.date_range || '—'}`;
      document.getElementById('seasonUpdated').textContent = `Оновлення: ${meta.updated_at || meta.updated || '—'}`;

      const row = summary[selectedLeague] || {};
      document.getElementById('seasonLeagueSummary').innerHTML = `<div class="season-stat-card"><p>Матчі: <strong>${row.matches ?? row.games ?? 0}</strong></p><p>Гравці: <strong>${row.players ?? players.length}</strong></p><p>Сер. рейтинг: <strong>${row.avg_rating ?? row.average_rating ?? '—'}</strong></p></div>`;
      document.getElementById('seasonAwards').innerHTML = awardsEntries.length ? `<ul>${awardsEntries.map(([k, v]) => `<li><strong>${esc(k)}:</strong> ${esc(v?.player || v?.nick || v)}</li>`).join('')}</ul>` : '<p class="px-card__text">Немає нагород</p>';
      document.getElementById('seasonSeries').innerHTML = Object.keys(series || {}).length ? `<ul>${Object.entries(series).map(([k, v]) => `<li>${esc(k)}: <strong>${esc(v)}</strong></li>`).join('')}</ul>` : '<p class="px-card__text">Немає даних</p>';

      if (!players.length) {
        document.getElementById('seasonPlayers').innerHTML = '<article class="px-card"><p class="px-card__text">Немає даних за цей сезон</p></article>';
        document.getElementById('seasonChart').innerHTML = '<p class="px-card__text">Немає даних для графіка</p>';
      } else {
        const renderTable = () => {
          document.getElementById('seasonPlayers').innerHTML = `<div class="season-table-wrap"><table class="season-table"><thead><tr><th>#</th><th>Nickname</th><th data-sort="matches">Матчі</th><th>Перемоги</th><th>Нічиї</th><th>Поразки</th><th>MVP</th><th data-sort="rating">Рейтинг</th><th>Δ Рейтинг</th><th>Ранг</th></tr></thead><tbody>${renderRows(players, currentSort)}</tbody></table></div>`;
          document.getElementById('seasonPlayers').querySelectorAll('th[data-sort]').forEach((th) => {
            th.style.cursor = 'pointer';
            th.onclick = () => {
              currentSort = th.dataset.sort;
              renderTable();
            };
          });
        };
        renderTable();
        document.getElementById('seasonChart').innerHTML = miniBars(players);
      }

      state.textContent = '';
    } catch (error) {
      state.textContent = safeErrorMessage(error, 'Не вдалося завантажити сезон');
      const msg = safeErrorMessage(error, 'Помилка завантаження');
      const target = document.getElementById('seasonPlayers');
      if (target) target.innerHTML = `<article class="px-card"><p class="px-card__text">${msg}</p></article>`;
    }
  }

  select.addEventListener('change', () => {
    selectedSeason = select.value;
    updateHash(selectedSeason, selectedLeague);
    load();
  });

  root.querySelectorAll('input[name="leagueToggle"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      selectedLeague = normalizeLeague(radio.value) || 'kids';
      updateHash(selectedSeason, selectedLeague);
      load();
    });
  });

  await load();
}
