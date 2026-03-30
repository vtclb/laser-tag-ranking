import { getCurrentLeagueLiveStats, safeErrorMessage } from '../core/dataHub.js';
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
function isSeasonActive(player = {}) { return Number(player.matches || 0) > 0; }

const SORTERS = {
  points: (a, b) => (Number(b.points) || 0) - (Number(a.points) || 0),
  matches: (a, b) => (Number(b.matches) || 0) - (Number(a.matches) || 0),
  battles: (a, b) => (Number(b.battles) || 0) - (Number(a.battles) || 0),
  winRate: (a, b) => (Number(b.winRate) || 0) - (Number(a.winRate) || 0),
  mvpTotal: (a, b) => (Number(b.mvpTotal) || 0) - (Number(a.mvpTotal) || 0),
  delta: (a, b) => (Number(b.delta) || 0) - (Number(a.delta) || 0)
};

function tableHeader() {
  return `<span class="league-table__hcell league-table__hcell--place">#</span><span class="league-table__hcell league-table__hcell--rank">Ранг</span><span class="league-table__hcell league-table__hcell--player">Гравець</span><span class="league-table__hcell league-table__hcell--points">Очки</span>`;
}

function playerProfileHash(league, nickname) {
  return `#player?league=${encodeURIComponent(league)}&nick=${encodeURIComponent(nickname)}`;
}

function rowMarkup(player, league, { showDelta = false, showInactive = false } = {}) {
  const rank = String(player.rankLetter || 'F').toUpperCase();
  const rankKey = String(rank || 'F').trim().toLowerCase();
  const href = playerProfileHash(league, player.nickname);
  const inactiveClass = player.isSeasonActive ? '' : ' is-inactive league-table__row--inactive';
  const inactiveLabel = showInactive && !player.isSeasonActive ? '<span class="league-status-tag">inactive</span>' : '';
  const deltaValue = Number(player.delta || 0);
  const deltaText = showDelta ? `<span class="league-row-delta ${deltaValue >= 0 ? 'is-positive' : 'is-negative'}">Δ ${esc(fmtSigned(deltaValue))}</span>` : '';
  return `<a class="league-table-row league-player-row league-table__row league-table__row--rank-${rankKey}${inactiveClass}" href="${href}">
    <div class="league-row-top league-table__main">
      <span class="league-place league-table__place">${player.place ? `#${player.place}` : '—'}</span>
      <span class="league-rank-letter league-table__rank ${rankClass(rank)}">${esc(rank)}</span>
      <span class="league-avatar-wrap league-rank-frame league-table__avatar ${rankClass(rank)}"><img class="league-avatar" src="${esc(player.avatarUrl || FALLBACK_AVATAR)}" alt="${esc(player.nickname)}"></span>
      <span class="league-col-nickname league-table__nickname">${esc(player.nickname)} ${inactiveLabel}</span>
      <span class="league-points league-table__points">${esc(player.points)}</span>
    </div>
    <div class="league-row-meta league-table__meta">
      <span>Ігри: ${esc(player.matches)}</span>
      <span>Бої: ${esc(player.battles)}</span>
      <span>WR: ${esc(winRateText(player.winRate))}</span>
      <span>MVP: ${esc(player.mvp1)}/${esc(player.mvp2)}/${esc(player.mvp3)}</span>
      ${deltaText}
    </div>
  </a>`;
}

function progressCard(player, value, label, icon = '✦') {
  if (!player) return `<article class="league-progress-card"><div class="league-progress-card__value">—</div><div class="league-progress-card__label">${esc(label)}</div></article>`;
  const rank = String(player.rankLetter || 'F').toUpperCase();
  return `<article class="league-progress-card">
    <div class="league-progress-card__media"><span class="league-avatar-wrap league-rank-frame ${rankClass(rank)}"><img class="league-avatar" src="${esc(player.avatarUrl || FALLBACK_AVATAR)}" alt="${esc(player.nickname)}"></span><span class="league-progress-card__name">${esc(player.nickname)}</span></div>
    <div class="league-progress-card__value">${esc(icon)} ${esc(value)}</div>
    <div class="league-progress-card__label">${esc(label)}</div>
  </article>`;
}

function statCard(label, value, icon) {
  return `<article class="league-stat-card"><div class="league-stat-card__label">${esc(icon)} ${esc(label)}</div><div class="league-stat-card__value">${esc(value)}</div></article>`;
}

function renderHero(root, league, data) {
  root.innerHTML = `<h1 class="px-card__title league-section-title">${esc(leagueLabelUA(league))}</h1>
  <p class="px-card__text league-season-title">Сезон: <strong>${esc(data.seasonLabel)}</strong></p>
  <div class="league-summary-strip"><span>Активних гравців: ${data.summary.activePlayersCount}</span><span>Матчів: ${data.summary.matchesCount}</span><span>Ігровий день: ${esc(data.lastGameDay?.date || '—')}</span></div>
  <div class="px-card__actions league-actions"><a class="btn" href="#gameday?league=${encodeURIComponent(league)}">Ігровий день</a></div>`;
}

function renderInfographic(root, data) {
  const dist = data.summary.rankDistribution || {};
  root.innerHTML = `<h2 class="px-card__title league-section-title">Інфографіка ліги</h2>
  <div class="league-infographic-cards">
    ${statCard('Активних гравців', data.summary.activePlayersCount, '👥')}
    ${statCard('Усього в ростері', data.summary.playersCount, '🧾')}
    ${statCard('Матчів', data.summary.matchesCount, '🎯')}
    ${statCard('Боїв', data.summary.battlesCount, '⚔️')}
    ${statCard('Сер. рейтинг', data.summary.avgRating, '📈')}
    ${statCard('Total MVP', data.summary.totalMvp, '🏅')}
  </div>
  <div class="league-rank-grid">${RANKS.map((rank) => `<div class="league-rank-card league-rank-card--${String(rank).toLowerCase()}"><strong>${rank}</strong><span>${dist[rank] || 0}</span></div>`).join('')}</div>
  <div class="league-progress-grid">
    ${progressCard(data.progress?.bestGrowth, fmtSigned(data.progress?.bestGrowth?.delta), 'Найкращий приріст', '🚀')}
    ${progressCard(data.progress?.mostMvp, data.progress?.mostMvp ? `${data.progress.mostMvp.mvpTotal || 0} MVP` : '—', 'Найбільше MVP', '🏆')}
    ${progressCard(data.progress?.biggestMinus, fmtSigned(data.progress?.biggestMinus?.delta), 'Найбільший мінус', '📉')}
  </div>`;
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
  const loadingMarkup = `<h1 class="px-card__title league-section-title">Статистика ліги</h1><p class="px-card__text">Завантажуємо live статистику поточного сезону…</p><div class="league-loading-bar" aria-hidden="true"></div>`;
  const hero = root.querySelector('#leagueHero');
  if (hero) {
    hero.classList.add('league-loading-block');
    hero.innerHTML = loadingMarkup;
    return;
  }
  root.innerHTML = `<section class="px-card league-hero league-loading-block">${loadingMarkup}</section>`;
}

function sortAndFilterPlayers(players, sortBy, searchTerm, { keepInactiveAtBottom = false } = {}) {
  const term = String(searchTerm || '').trim().toLowerCase();
  const filtered = (Array.isArray(players) ? players : []).filter((player) => String(player.nickname || '').toLowerCase().includes(term));
  const byName = (a, b) => String(a.nickname || '').localeCompare(String(b.nickname || ''), 'uk');

  if (sortBy === 'default') {
    const base = [...filtered].sort((a, b) => (a.place || Number.MAX_SAFE_INTEGER) - (b.place || Number.MAX_SAFE_INTEGER)
      || SORTERS.points(a, b)
      || byName(a, b));
    if (!keepInactiveAtBottom) return base;
    return [...base].sort((a, b) => Number(b.isSeasonActive) - Number(a.isSeasonActive));
  }

  const sorter = SORTERS[sortBy] || SORTERS.points;
  return [...filtered].sort((a, b) => sorter(a, b)
    || SORTERS.points(a, b)
    || byName(a, b));
}

export async function initLeagueStatsPage(params = {}) {
  const root = document.getElementById('view');
  if (!root) return;
  renderLoading(root);
  try {
    const league = resolveLeague(params);
    const data = await getCurrentLeagueLiveStats(league);

    const hero = root.querySelector('#leagueHero');
    const top10Table = root.querySelector('#leagueTop10Table');
    const fullTable = root.querySelector('#leagueFullTable');
    const topHeader = root.querySelector('#leagueTop10Section .league-table-header');
    const fullHeader = root.querySelector('#leagueFullSection .league-table-header');
    const expandBtn = root.querySelector('#leagueExpandBtn');
    const fullSection = root.querySelector('#leagueFullSection');
    const infographic = root.querySelector('#leagueInfographic');
    const lastGameDay = root.querySelector('#leagueLastGameDay');
    const searchInput = root.querySelector('#leagueSearchInput');
    const sortSelect = root.querySelector('#leagueSortSelect');

    if (!hero || !top10Table || !fullTable || !topHeader || !fullHeader || !expandBtn || !fullSection || !infographic || !lastGameDay || !searchInput || !sortSelect) {
      throw new Error('League stats template не знайдено.');
    }

    topHeader.innerHTML = tableHeader();
    fullHeader.innerHTML = tableHeader();

    const state = {
      isFullOpen: false,
      searchTerm: '',
      sortBy: 'default'
    };

    const baseTop10 = (data.top10 || []).filter(isSeasonActive).slice(0, 10);
    const fullBase = [...(data.players || [])];

    const renderTables = () => {
      const topRows = sortAndFilterPlayers(baseTop10, state.sortBy, state.searchTerm)
        .slice(0, 10)
        .map((player) => rowMarkup(player, league, { showDelta: true }))
        .join('');
      top10Table.innerHTML = topRows || '<p class="px-card__text">Немає активних гравців у цьому сезоні.</p>';

      if (!state.isFullOpen) return;

      const fullRows = sortAndFilterPlayers(fullBase, state.sortBy, state.searchTerm, { keepInactiveAtBottom: state.sortBy === 'default' })
        .map((player) => rowMarkup(player, league, { showDelta: true, showInactive: true }))
        .join('');
      fullTable.innerHTML = fullRows || '<p class="px-card__text">Немає гравців за вибраним пошуком.</p>';
    };

    renderHero(hero, league, data);
    renderInfographic(infographic, data);
    renderLastGameDay(lastGameDay, data.lastGameDay, league);
    renderTables();

    expandBtn.addEventListener('click', () => {
      state.isFullOpen = !state.isFullOpen;
      if (state.isFullOpen) {
        fullSection.removeAttribute('hidden');
        expandBtn.textContent = 'Сховати повний список';
      } else {
        fullSection.setAttribute('hidden', 'hidden');
        fullTable.innerHTML = '';
        expandBtn.textContent = 'Показати всіх гравців';
      }
      renderTables();
    });

    searchInput.addEventListener('input', () => {
      state.searchTerm = searchInput.value || '';
      renderTables();
    });

    sortSelect.addEventListener('change', () => {
      state.sortBy = sortSelect.value || 'default';
      renderTables();
    });
  } catch (error) {
    root.innerHTML = `<section class="px-card league-hero"><h1 class="px-card__title league-section-title">Статистика ліги</h1><p class="px-card__text">${esc(safeErrorMessage(error, 'Помилка завантаження live-даних'))}</p></section>`;
  }
}
