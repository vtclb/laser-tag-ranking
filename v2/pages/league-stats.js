import { getCurrentLeagueLiveStats, getCurrentSeason, safeErrorMessage } from '../core/dataHub.js';
import { normalizeLeague, leagueLabelUA } from '../core/naming.js';
import { getRouteState } from '../core/utils.js';

const RANKS = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];
const FALLBACK_AVATAR = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22%3E%3Crect width=%2248%22 height=%2248%22 fill=%22%23121a2a%22/%3E%3Ccircle cx=%2224%22 cy=%2218%22 r=%229%22 fill=%22%235b6c89%22/%3E%3Crect x=%2211%22 y=%2230%22 width=%2226%22 height=%2212%22 fill=%22%235b6c89%22/%3E%3C/svg%3E';

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function rankClass(rank) { return `rank-${String(rank || 'F').trim().toLowerCase()}`; }
function winRateText(value) { return value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`; }
function fmtSigned(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n}`;
}
function isSeasonActive(player = {}) {
  const hasActiveFlag = Object.prototype.hasOwnProperty.call(player || {}, 'active');
  const activeFlag = hasActiveFlag ? Boolean(player.active) : true;
  return activeFlag && Number(player.matches || 0) > 0;
}

const SORTERS = {
  points: (a, b) => (Number(b.points) || 0) - (Number(a.points) || 0),
  matches: (a, b) => (Number(b.matches) || 0) - (Number(a.matches) || 0),
  battles: (a, b) => (Number(b.battles) || 0) - (Number(a.battles) || 0),
  winRate: (a, b) => (Number(b.winRate) || 0) - (Number(a.winRate) || 0),
  mvpTotal: (a, b) => (Number(b.mvpTotal) || 0) - (Number(a.mvpTotal) || 0),
  delta: (a, b) => (Number(b.delta) || 0) - (Number(a.delta) || 0)
};

function playerProfileHash(league, nickname) {
  return `#player?league=${encodeURIComponent(league)}&nick=${encodeURIComponent(nickname)}`;
}

function rankDistributionTiles(distribution = {}) {
  return RANKS
    .map((rank) => `<article class="league-rank-tile league-rank-tile--${rank.toLowerCase()}"><strong>${rank}</strong><span>${distribution[rank] || 0}</span></article>`)
    .join('');
}

function tableRowMarkup(player, league) {
  const rank = String(player.rankLetter || 'F').toUpperCase();
  const rankKey = rank.toLowerCase();
  const href = playerProfileHash(league, player.nickname);
  const deltaValue = Number(player.delta || 0);
  const deltaClass = deltaValue >= 0 ? 'is-positive' : 'is-negative';
  return `<tr class="league-ranking-table__row league-ranking-table__row--rank-${rankKey}" data-href="${href}" tabindex="0" role="link" aria-label="Профіль ${esc(player.nickname)}">
    <td class="league-ranking-table__cell league-ranking-table__cell--place">${player.place ? `#${player.place}` : '—'}</td>
    <td class="league-ranking-table__cell league-ranking-table__cell--player">
      <span class="league-player-cell">
        <span class="league-rank-badge ${rankClass(rank)}">${esc(rank)}</span>
        <span class="league-avatar-wrap league-rank-frame ${rankClass(rank)}"><img class="league-avatar" src="${esc(player.avatarUrl || FALLBACK_AVATAR)}" alt="${esc(player.nickname)}"></span>
        <span class="league-player-cell__name">${esc(player.nickname)}</span>
      </span>
    </td>
    <td class="league-ranking-table__cell league-ranking-table__cell--points">${esc(player.points ?? 0)}</td>
    <td class="league-ranking-table__cell league-ranking-table__cell--num">${esc(player.matches ?? 0)}</td>
    <td class="league-ranking-table__cell league-ranking-table__cell--num">${esc(player.battles ?? 0)}</td>
    <td class="league-ranking-table__cell league-ranking-table__cell--num">${esc(winRateText(player.winRate))}</td>
    <td class="league-ranking-table__cell league-ranking-table__cell--num">${esc(player.mvp1 ?? 0)}</td>
    <td class="league-ranking-table__cell league-ranking-table__cell--num">${esc(player.mvp2 ?? 0)}</td>
    <td class="league-ranking-table__cell league-ranking-table__cell--num">${esc(player.mvp3 ?? 0)}</td>
    <td class="league-ranking-table__cell league-ranking-table__cell--num league-ranking-table__cell--delta ${deltaClass}">${esc(fmtSigned(deltaValue))}</td>
  </tr>`;
}

function statCard(label, value, icon) {
  return `<article class="league-kpi-card"><div class="league-kpi-card__label">${esc(icon)} ${esc(label)}</div><div class="league-kpi-card__value">${esc(value)}</div></article>`;
}

function calculateRemainingGameDays(data, currentSeason) {
  const seasonEndRaw = String(currentSeason?.dateEnd || '').slice(0, 10);
  const lastGameDayRaw = String(data?.lastGameDay?.date || '').slice(0, 10);
  if (!seasonEndRaw) return '—';
  const seasonEnd = new Date(`${seasonEndRaw}T00:00:00Z`);
  if (Number.isNaN(seasonEnd.getTime())) return '—';
  const anchorDate = lastGameDayRaw || new Date().toISOString().slice(0, 10);
  const anchor = new Date(`${anchorDate}T00:00:00Z`);
  if (Number.isNaN(anchor.getTime())) return '—';
  const days = Math.ceil((seasonEnd - anchor) / (1000 * 60 * 60 * 24));
  return `${Math.max(days, 0)}`;
}

function highlightCard(player, value, label, icon, tone) {
  if (!player) {
    return `<article class="league-highlight-card league-highlight-card--${tone}">
      <div class="league-highlight-card__name">—</div>
      <div class="league-highlight-card__value">—</div>
      <div class="league-highlight-card__title">${esc(icon)} ${esc(label)}</div>
    </article>`;
  }
  const rank = String(player.rankLetter || 'F').toUpperCase();
  return `<article class="league-highlight-card league-highlight-card--${tone}">
    <div class="league-highlight-card__player">
      <span class="league-rank-badge ${rankClass(rank)}">${esc(rank)}</span>
      <span class="league-avatar-wrap league-rank-frame ${rankClass(rank)}"><img class="league-avatar" src="${esc(player.avatarUrl || FALLBACK_AVATAR)}" alt="${esc(player.nickname)}"></span>
    </div>
    <div class="league-highlight-card__name">${esc(player.nickname)}</div>
    <div class="league-highlight-card__value">${esc(value)}</div>
    <div class="league-highlight-card__title">${esc(icon)} ${esc(label)}</div>
  </article>`;
}

function renderHero(root, league, data, remainingGameDays) {
  root.innerHTML = `<h1 class="px-card__title league-section-title">${esc(leagueLabelUA(league))}</h1>
  <p class="px-card__text league-season-title">Поточні live дані: <strong>${esc(data.seasonLabel)}</strong></p>
  <div class="league-summary-strip"><span>Активних гравців: ${data.summary.activePlayersCount}</span><span>Матчів: ${data.summary.matchesCount}</span><span>Ігровий день: ${esc(data.lastGameDay?.date || '—')}</span><span>Залишилось днів: ${esc(remainingGameDays)}</span></div>
  <div class="px-card__actions league-actions"><a class="btn" href="#gameday?league=${encodeURIComponent(league)}">Ігровий день</a></div>`;
}

function renderInfographic(root, data, remainingGameDays) {
  const averageWinRate = data.summary.activePlayersCount
    ? `${(data.activePlayers.reduce((sum, player) => sum + (Number(player.winRate) || 0), 0) / data.summary.activePlayersCount).toFixed(1)}%`
    : '—';
  root.innerHTML = `<h2 class="px-card__title league-section-title">Інфографіка ліги</h2>
  <section class="league-dashboard-group league-dashboard-group--kpi">
    <h3 class="league-subtitle">KPI ліги</h3>
    <div class="league-kpi-grid">
    ${statCard('Активних гравців', data.summary.activePlayersCount, '👥')}
    ${statCard('Матчів', data.summary.matchesCount, '🎯')}
    ${statCard('Боїв', data.summary.battlesCount, '⚔️')}
    ${statCard('Сер. рейтинг', data.summary.avgRating, '📈')}
    ${statCard('Total MVP', data.summary.totalMvp, '🏅')}
    ${statCard('Середній WR', averageWinRate, '🎯')}
    </div>
  </section>
  <section class="league-dashboard-group league-rank-distribution">
    <h3 class="league-subtitle">Розподіл за рангами</h3>
    <div class="league-rank-grid">${rankDistributionTiles(data.summary.rankDistribution || {})}<article class="league-rank-tile league-rank-tile--meta"><strong>GD</strong><span>${esc(remainingGameDays)}</span></article></div>
  </section>
  <section class="league-dashboard-group">
    <h3 class="league-subtitle">Highlights</h3>
    <div class="league-highlights-grid">
    ${highlightCard(data.progress?.bestGrowth, fmtSigned(data.progress?.bestGrowth?.delta), 'Найкращий приріст', '🚀', 'up')}
    ${highlightCard(data.progress?.mostMvp, data.progress?.mostMvp ? `${data.progress.mostMvp.mvpTotal || 0} MVP` : '—', 'Найбільше MVP', '🏆', 'mvp')}
    ${highlightCard(data.progress?.biggestMinus, fmtSigned(data.progress?.biggestMinus?.delta), 'Найбільший мінус', '📉', 'down')}
    </div>
  </section>`;
}

function renderLastGameDay(root, lastGameDay, league) {
  const day = lastGameDay || { date: '', matchesCount: 0, battlesCount: 0, mvp: null };
  root.innerHTML = `<h2 class="px-card__title league-section-title">Ігровий день</h2>
  <div class="league-summary-strip"><span>Дата: ${esc(day.date || '—')}</span><span>Матчів: ${esc(day.matchesCount || 0)}</span><span>Боїв: ${esc(day.battlesCount || 0)}</span><span>MVP дня: ${esc(day.mvp || '—')}</span></div>
  <div class="px-card__actions"><a class="btn btn--secondary" href="#gameday?league=${encodeURIComponent(league)}">Відкрити ігровий день</a></div>`;
}

function resolveLeague(params = {}) {
  const { query: qp } = getRouteState();
  return normalizeLeague(params.league || qp.get('league') || 'kids') || 'kids';
}

function renderLoading(root) {
  const loadingMarkup = `<h1 class="px-card__title league-section-title">Статистика ліги</h1><p class="px-card__text">Завантажуємо live статистику…</p><div class="league-loading-bar" aria-hidden="true"></div>`;
  const hero = root.querySelector('#leagueHero');
  if (hero) {
    hero.classList.add('league-loading-block');
    hero.innerHTML = loadingMarkup;
    return;
  }
  root.innerHTML = `<section class="px-card league-hero league-loading-block">${loadingMarkup}</section>`;
}

function sortPlayers(players, sortBy, direction = 'desc') {
  const byName = (a, b) => String(a.nickname || '').localeCompare(String(b.nickname || ''), 'uk');
  if (sortBy === 'default') {
    return [...players].sort((a, b) => (a.place || Number.MAX_SAFE_INTEGER) - (b.place || Number.MAX_SAFE_INTEGER)
      || SORTERS.points(a, b)
      || byName(a, b));
  }

  const sorter = SORTERS[sortBy] || SORTERS.points;
  const sign = direction === 'asc' ? -1 : 1;
  return [...players].sort((a, b) => (sorter(a, b) * sign)
    || SORTERS.points(a, b)
    || byName(a, b));
}

function filterPlayers(players, searchTerm) {
  const term = String(searchTerm || '').trim().toLowerCase();
  if (!term) return [...players];
  return players.filter((player) => String(player.nickname || '').toLowerCase().includes(term));
}

export async function initLeagueStatsPage(params = {}) {
  const root = document.getElementById('view');
  if (!root) return;
  renderLoading(root);
  try {
    const league = resolveLeague(params);
    const [data, currentSeason] = await Promise.all([
      getCurrentLeagueLiveStats(league),
      getCurrentSeason()
    ]);
    const remainingGameDays = calculateRemainingGameDays(data, currentSeason);

    const hero = root.querySelector('#leagueHero');
    const rankingTable = root.querySelector('#leagueTableBody');
    const tableTitle = root.querySelector('#leagueTableTitle');
    const expandBtn = root.querySelector('#leagueExpandBtn');
    const infographic = root.querySelector('#leagueInfographic');
    const lastGameDay = root.querySelector('#leagueLastGameDay');
    const searchInput = root.querySelector('#leagueSearchInput');
    const sortControls = root.querySelector('#leagueSortControls');

    if (!hero || !rankingTable || !tableTitle || !expandBtn || !infographic || !lastGameDay || !searchInput || !sortControls) {
      throw new Error('League stats template не знайдено.');
    }

    const state = {
      isFullOpen: false,
      searchTerm: '',
      sortBy: 'default',
      sortDirection: 'desc'
    };

    const activePlayersBase = [...(data.players || [])].filter((player) => isSeasonActive(player));

    const renderTables = () => {
      const filtered = filterPlayers(activePlayersBase, state.searchTerm);
      const sorted = sortPlayers(filtered, state.sortBy, state.sortDirection);
      const visible = state.isFullOpen ? sorted : sorted.slice(0, 10);
      rankingTable.innerHTML = visible.map((player) => tableRowMarkup(player, league)).join('')
        || '<tr><td class="league-ranking-table__empty" colspan="10">Немає активних гравців за вибраним пошуком.</td></tr>';
      tableTitle.textContent = state.isFullOpen ? 'Повний список гравців' : 'ТОП-10 гравців';
    };

    const setSortButtonState = () => {
      sortControls.querySelectorAll('.league-sort-btn').forEach((btn) => {
        const isActive = btn.dataset.sort === state.sortBy;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    };

    const setupRowNavigation = (tbody) => {
      tbody.addEventListener('click', (event) => {
        const row = event.target.closest('tr[data-href]');
        if (!row) return;
        window.location.hash = row.dataset.href;
      });
      tbody.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const row = event.target.closest('tr[data-href]');
        if (!row) return;
        event.preventDefault();
        window.location.hash = row.dataset.href;
      });
    };

    renderHero(hero, league, data, remainingGameDays);
    renderInfographic(infographic, data, remainingGameDays);
    renderLastGameDay(lastGameDay, data.lastGameDay, league);
    setSortButtonState();
    renderTables();

    setupRowNavigation(rankingTable);

    expandBtn.addEventListener('click', () => {
      state.isFullOpen = !state.isFullOpen;
      expandBtn.textContent = state.isFullOpen ? 'Сховати повний список' : 'Показати всіх гравців';
      renderTables();
    });

    searchInput.addEventListener('input', () => {
      state.searchTerm = searchInput.value || '';
      renderTables();
    });

    sortControls.addEventListener('click', (event) => {
      const button = event.target.closest('.league-sort-btn');
      if (!button) return;
      const nextSort = button.dataset.sort || 'default';
      if (state.sortBy === nextSort && nextSort !== 'default') {
        state.sortDirection = state.sortDirection === 'desc' ? 'asc' : 'desc';
      } else {
        state.sortDirection = 'desc';
      }
      state.sortBy = nextSort;
      setSortButtonState();
      renderTables();
    });
  } catch (error) {
    root.innerHTML = `<section class="px-card league-hero"><h1 class="px-card__title league-section-title">Статистика ліги</h1><p class="px-card__text">${esc(safeErrorMessage(error, 'Помилка завантаження live-даних'))}</p></section>`;
  }
}
