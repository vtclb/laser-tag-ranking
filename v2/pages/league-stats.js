import { getCurrentLeagueLiveStats, getCurrentSeason } from '../core/dataHub.js';
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

function playerCountText(count) {
  const n = Number(count) || 0;
  if (n % 10 === 1 && n % 100 !== 11) return `${n} гравець`;
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return `${n} гравці`;
  return `${n} гравців`;
}

function playerProfileHash(league, nickname) {
  return `#player?league=${encodeURIComponent(league)}&nick=${encodeURIComponent(nickname)}`;
}

function rankDistributionTiles(distribution = {}) {
  return RANKS
    .map((rank) => {
      const count = distribution[rank] || 0;
      const rankKey = rank.toLowerCase();
      return `<article class="league-rank-tile rank-card rank-${rankKey} card league-rank-tile--${rankKey}"><div class="league-rank-tile__rank">${rank}</div><div class="league-rank-tile__count">${count}</div><div class="league-rank-tile__label"><span class="league-rank-tile__icon" aria-hidden="true">👤</span>${playerCountText(count)}</div></article>`;
    })
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

function statCard({ label, value, level = 'secondary', icon = '', divider = false, progress = null }) {
  const progressMarkup = progress
    ? `<div class="winrate-bar" aria-hidden="true"><div class="winrate-fill" style="width:${esc(progress.width)}"></div></div>`
    : '';
  return `<article class="kpi-card kpi-card--${esc(level)} card">
    <div class="kpi-label">${icon ? `<span class="kpi-icon" aria-hidden="true">${icon}</span>` : ''}${esc(label)}</div>
    <div class="kpi-value kpi-${esc(level)}">${esc(value)}</div>
    ${divider ? '<div class="kpi-divider" aria-hidden="true"></div>' : ''}
    ${progressMarkup}
  </article>`;
}

function calculateRemainingGameDays(data, currentSeason) {
  const seasonStartRaw = String(currentSeason?.dateStart || '').slice(0, 10);
  const seasonEndRaw = String(currentSeason?.dateEnd || '').slice(0, 10);
  if (!seasonStartRaw || !seasonEndRaw) return '—';

  const seasonStart = new Date(`${seasonStartRaw}T00:00:00Z`);
  const seasonEnd = new Date(`${seasonEndRaw}T00:00:00Z`);
  if (Number.isNaN(seasonStart.getTime()) || Number.isNaN(seasonEnd.getTime())) return '—';
  if (seasonEnd < seasonStart) return '0';

  const todayRaw = new Date().toISOString().slice(0, 10);
  const today = new Date(`${todayRaw}T00:00:00Z`);
  if (Number.isNaN(today.getTime())) return '—';

  const seasonAnchor = today < seasonStart ? seasonStart : today;
  if (seasonAnchor > seasonEnd) return '0';

  // Базова оцінка розкладу: 3 ігрові дні щотижня (вт/чт/сб).
  const scheduleDays = new Set([2, 4, 6]);
  let remaining = 0;
  const cursor = new Date(seasonAnchor);
  while (cursor <= seasonEnd) {
    if (scheduleDays.has(cursor.getUTCDay())) {
      remaining += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return `${remaining}`;
}

function highlightCard(player, value, label, tone) {
  const valueClass = tone === 'minus' ? 'negative' : 'positive';
  if (!player) {
    return `<article class="highlight-card card">
      <div class="highlight-top">
        <span class="rank-badge rank-f">—</span>
        <img class="avatar" src="${esc(FALLBACK_AVATAR)}" alt="Аватар">
        <div class="highlight-type">${esc(label)}</div>
      </div>
      <div class="highlight-content">
        <div class="highlight-name">—</div>
        <div class="highlight-value ${valueClass}">—</div>
      </div>
    </article>`;
  }
  const rank = String(player.rankLetter || 'F').toUpperCase();
  return `<article class="highlight-card card">
    <div class="highlight-top">
      <span class="rank-badge ${rankClass(rank)}">${esc(rank)}</span>
      <img class="avatar" src="${esc(player.avatarUrl || FALLBACK_AVATAR)}" alt="${esc(player.nickname)}">
      <div class="highlight-type">${esc(label)}</div>
    </div>
    <div class="highlight-content">
      <div class="highlight-name">${esc(player.nickname)}</div>
      <div class="highlight-value ${valueClass}">${esc(value)}</div>
    </div>
  </article>`;
}

function renderHero(root, league, data, remainingGameDays) {
  root.innerHTML = `<h1 class="px-card__title league-section-title">${esc(leagueLabelUA(league))}</h1>
  <p class="px-card__text league-season-title">Поточні live дані: <strong>${esc(data.seasonLabel)}</strong></p>
  <div class="live-grid">
    <article class="live-card card">
      <div class="live-value">${esc(data.summary.activePlayersCount ?? 0)}</div>
      <div class="live-label">гравців</div>
    </article>
    <article class="live-card card">
      <div class="live-value">${esc(data.summary.matchesCount ?? 0)}</div>
      <div class="live-label">матчів</div>
    </article>
    <article class="live-card card">
      <div class="live-value">${esc(data.lastGameDay?.date || '—')}</div>
      <div class="live-label">ігровий день</div>
    </article>
    <article class="live-card card">
      <div class="live-value">${esc(remainingGameDays)}</div>
      <div class="live-label">днів залишилось</div>
    </article>
  </div>
  <div class="px-card__actions league-actions"><a class="button-primary" href="#gameday?league=${encodeURIComponent(league)}">Ігровий день</a></div>`;
}

function renderInfographic(root, data) {
  const totalDeltaPoints = data.activePlayers.reduce((sum, player) => sum + (Number(player.delta) || 0), 0);
  const averageWinRateValue = data.summary.activePlayersCount
    ? (data.activePlayers.reduce((sum, player) => sum + (Number(player.winRate) || 0), 0) / data.summary.activePlayersCount)
    : null;
  const averageWinRate = averageWinRateValue === null ? '—' : `${averageWinRateValue.toFixed(1)}%`;
  const averageWinRateWidth = averageWinRateValue === null ? '0%' : `${Math.max(0, Math.min(100, averageWinRateValue)).toFixed(1)}%`;
  root.innerHTML = `<h2 class="px-card__title league-section-title">Інфографіка ліги</h2>
  <section class="league-dashboard-group league-dashboard-group--kpi">
    <h3 class="league-subtitle">KPI ліги</h3>
    <div class="league-kpi-grid league-kpi-grid--primary">
    ${statCard({ label: 'Активні гравці', value: data.summary.activePlayersCount, level: 'primary', icon: '👤' })}
    ${statCard({ label: 'Матчі', value: data.summary.matchesCount, level: 'primary', divider: true })}
    </div>
    <div class="league-kpi-grid league-kpi-grid--secondary">
    ${statCard({ label: 'Бої', value: data.summary.battlesCount, level: 'secondary' })}
    ${statCard({ label: 'Сер. рейтинг', value: data.summary.avgRating, level: 'secondary' })}
    </div>
    <div class="league-kpi-grid league-kpi-grid--tertiary">
    ${statCard({ label: 'Total MVP', value: data.summary.totalMvp, level: 'tertiary' })}
    ${statCard({ label: 'Winrate', value: averageWinRate, level: 'tertiary', progress: { width: averageWinRateWidth } })}
    </div>
  </section>
  <section class="league-dashboard-group league-dashboard-group--ranks">
    <h3 class="league-subtitle">Розподіл за рангами</h3>
    <div class="league-rank-grid">${rankDistributionTiles(data.summary.rankDistribution || {})}<article class="league-rank-tile league-rank-tile--meta rank-card card"><div class="league-rank-tile__rank">Σ Δ</div><div class="league-rank-tile__count">${esc(fmtSigned(totalDeltaPoints))}</div><div class="league-rank-tile__label">сумарна зміна</div></article></div>
  </section>
  <section class="league-dashboard-group league-dashboard-group--moments">
    <h3 class="league-subtitle">Ключові моменти</h3>
    <div class="league-highlights-grid">
    ${highlightCard(data.progress?.bestGrowth, fmtSigned(data.progress?.bestGrowth?.delta), 'Найкращий приріст', 'gain')}
    ${highlightCard(data.progress?.mostMvp, data.progress?.mostMvp ? `${data.progress.mostMvp.mvpTotal || 0} MVP` : '—', 'Найбільше MVP', 'mvp')}
    ${highlightCard(data.progress?.biggestMinus, fmtSigned(data.progress?.biggestMinus?.delta), 'Найбільший мінус', 'minus')}
    </div>
  </section>`;
}

function renderLastGameDay(root, lastGameDay, league) {
  const day = lastGameDay || { date: '', matchesCount: 0, battlesCount: 0, mvp: null };
  root.innerHTML = `<h2 class="px-card__title league-section-title">Ігровий день</h2>
  <div class="league-game-day-grid">
    <article class="league-game-day-card card"><span class="league-game-day-card__label">Дата</span><strong class="league-game-day-card__value">${esc(day.date || '—')}</strong></article>
    <article class="league-game-day-card card"><span class="league-game-day-card__label">Матчів</span><strong class="league-game-day-card__value">${esc(day.matchesCount || 0)}</strong></article>
    <article class="league-game-day-card card"><span class="league-game-day-card__label">Боїв</span><strong class="league-game-day-card__value">${esc(day.battlesCount || 0)}</strong></article>
    <article class="league-game-day-card card"><span class="league-game-day-card__label">MVP дня</span><strong class="league-game-day-card__value">${esc(day.mvp || '—')}</strong></article>
  </div>
  <div class="px-card__actions league-actions league-actions--center"><a class="button-primary" href="#gameday?league=${encodeURIComponent(league)}">ВІДКРИТИ ІГРОВИЙ ДЕНЬ</a></div>`;
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
  await initPage(root, params);
}

export async function initPage(root, params = {}) {
  if (!root) return;
  console.log('[league-stats] init start');
  try {
    await safeInitLeagueStatsPage(root, params);
  } catch (err) {
    console.error('[league-stats] fatal crash:', err);
    root.innerHTML = `
      <div style="padding:20px;color:#fff">
        ❌ Помилка завантаження сторінки
      </div>
    `;
  }
}

async function safeInitLeagueStatsPage(root, params = {}) {
  renderLoading(root);
  const league = resolveLeague(params);
  const data = await getCurrentLeagueLiveStats(league);
  console.log('[league-stats] data loaded', data);
  if (!data) {
    console.warn('[league-stats] no data, rendering empty state');
    root.innerHTML = `<section class="px-card league-hero"><h1 class="px-card__title league-section-title">Статистика ліги</h1><p class="px-card__text">Немає даних для відображення.</p></section>`;
    return;
  }
  const currentSeason = await getCurrentSeason().catch((error) => {
    console.warn('[league-stats] optional season context unavailable', error);
    return null;
  });
  const remainingGameDays = calculateRemainingGameDays(data, currentSeason);
  const safeData = {
    ...data,
    players: Array.isArray(data?.players) ? data.players : [],
    activePlayers: Array.isArray(data?.activePlayers) ? data.activePlayers : [],
    summary: data?.summary || {},
    progress: data?.progress || {},
    lastGameDay: data?.lastGameDay || null
  };

  const hero = root.querySelector('#leagueHero');
  const rankingTable = root.querySelector('#leagueTableBody');
  const tableTitle = root.querySelector('#leagueTableTitle');
  const expandBtn = root.querySelector('#leagueExpandBtn');
  const infographic = root.querySelector('#leagueInfographic');
  const lastGameDay = root.querySelector('#leagueLastGameDay');
  const searchInput = root.querySelector('#leagueSearchInput');
  const sortControls = root.querySelector('#leagueSortControls');

  if (!hero || !rankingTable || !tableTitle || !expandBtn || !infographic || !lastGameDay || !searchInput || !sortControls) {
    console.warn('[league-stats] template nodes missing, rendering empty state');
    root.innerHTML = `<section class="px-card league-hero"><h1 class="px-card__title league-section-title">Статистика ліги</h1><p class="px-card__text">Немає даних для відображення.</p></section>`;
    return;
  }

  const state = {
    isFullOpen: false,
    searchTerm: '',
    sortBy: 'default',
    sortDirection: 'desc'
  };
  const activePlayersBase = [...(safeData.players || [])].filter((player) => isSeasonActive(player));

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

  renderHero(hero, league, safeData, remainingGameDays);
  renderInfographic(infographic, safeData);
  renderLastGameDay(lastGameDay, safeData.lastGameDay, league);
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
}
