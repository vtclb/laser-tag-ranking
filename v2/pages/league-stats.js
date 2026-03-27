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

function tableHeader() {
  return '<span>#</span><span>Ранг</span><span>Гравець</span><span>Очки</span><span>Статистика</span>';
}

function playerProfileHash(league, nickname) {
  return `#player?league=${encodeURIComponent(league)}&nick=${encodeURIComponent(nickname)}`;
}

function rowMarkup(player, league, { showDelta = false, showInactive = false } = {}) {
  const rank = String(player.rankLetter || 'F').toUpperCase();
  const href = playerProfileHash(league, player.nickname);
  const inactiveClass = player.isSeasonActive ? '' : ' is-inactive';
  const inactiveLabel = showInactive && !player.isSeasonActive ? '<span class="league-status-tag">inactive</span>' : '';
  const deltaText = showDelta ? `<span class="league-row-delta ${Number(player.delta || 0) >= 0 ? 'is-positive' : 'is-negative'}">Δ ${esc(fmtSigned(player.delta || 0))}</span>` : '';
  return `<a class="league-table-row league-player-row${inactiveClass}" href="${href}">
    <div class="league-row-top">
      <span class="league-place">${player.place ? `#${player.place}` : '—'}</span>
      <span class="league-rank-letter ${rankClass(rank)}">${esc(rank)}</span>
      <span class="league-avatar-wrap league-rank-frame ${rankClass(rank)}"><img class="league-avatar" src="${esc(player.avatarUrl || FALLBACK_AVATAR)}" alt="${esc(player.nickname)}"></span>
      <span class="league-col-nickname">${esc(player.nickname)} ${inactiveLabel}</span>
      <span class="league-points">${esc(player.points)}</span>
    </div>
    <div class="league-row-meta">
      <span>Ігри: ${esc(player.matches)}</span>
      <span>Бої: ${esc(player.battles)}</span>
      <span>WR: ${esc(winRateText(player.winRate))}</span>
      <span>MVP: ${esc(player.mvp1)}/${esc(player.mvp2)}/${esc(player.mvp3)}</span>
      ${deltaText}
    </div>
  </a>`;
}

function progressCard(player, value, label) {
  if (!player) return `<article class="league-progress-card"><div class="league-progress-card__value">—</div><div class="league-progress-card__label">${esc(label)}</div></article>`;
  const rank = String(player.rankLetter || 'F').toUpperCase();
  return `<article class="league-progress-card">
    <div class="league-progress-card__media"><span class="league-avatar-wrap league-rank-frame ${rankClass(rank)}"><img class="league-avatar" src="${esc(player.avatarUrl || FALLBACK_AVATAR)}" alt="${esc(player.nickname)}"></span><span class="league-progress-card__name">${esc(player.nickname)}</span></div>
    <div class="league-progress-card__value">${esc(value)}</div>
    <div class="league-progress-card__label">${esc(label)}</div>
  </article>`;
}

function statCard(label, value) {
  return `<article class="league-stat-card"><div class="league-stat-card__label">${esc(label)}</div><div class="league-stat-card__value">${esc(value)}</div></article>`;
}

function renderHero(root, league, data) {
  root.innerHTML = `<h1 class="px-card__title">${esc(leagueLabelUA(league))}</h1>
  <p class="px-card__text">Сезон: <strong>${esc(data.seasonLabel)}</strong></p>
  <div class="league-summary-strip"><span>Активних гравців: ${data.summary.activePlayersCount}</span><span>Матчів: ${data.summary.matchesCount}</span></div>
  <div class="px-card__actions league-actions"><a class="btn" href="#gameday?league=${encodeURIComponent(league)}">Ігровий день</a></div>`;
}

function renderInfographic(root, data) {
  const dist = data.summary.rankDistribution || {};
  root.innerHTML = `<h2 class="px-card__title">Інфографіка ліги</h2>
  <div class="league-infographic-cards">
    ${statCard('Активних гравців', data.summary.activePlayersCount)}
    ${statCard('Усього в ростері', data.summary.playersCount)}
    ${statCard('Матчів', data.summary.matchesCount)}
    ${statCard('Боїв', data.summary.battlesCount)}
    ${statCard('Сер. рейтинг', data.summary.avgRating)}
    ${statCard('Total MVP', data.summary.totalMvp)}
  </div>
  <div class="league-rank-grid">${RANKS.map((rank) => `<div class="league-rank-card"><strong>${rank}</strong><span>${dist[rank] || 0}</span></div>`).join('')}</div>
  <div class="league-progress-grid">
    ${progressCard(data.progress?.bestGrowth, fmtSigned(data.progress?.bestGrowth?.delta), 'Найкращий приріст')}
    ${progressCard(data.progress?.mostMvp, data.progress?.mostMvp ? `${data.progress.mostMvp.mvpTotal || 0} MVP` : '—', 'Найбільше MVP')}
    ${progressCard(data.progress?.biggestMinus, fmtSigned(data.progress?.biggestMinus?.delta), 'Найбільший мінус')}
  </div>`;
}

function renderAwards(root, awards = []) {
  root.innerHTML = `<h2 class="px-card__title">Нагороди поточного сезону</h2>
    <div class="league-awards-grid">${awards.length ? awards.map((award) => `<article class="league-award-card"><span class="px-badge">${esc(award.title)}</span><p><strong>${esc(award.nickname)}</strong></p><p class="px-card__text">${esc(award.note)}</p></article>`).join('') : '<p class="px-card__text">Нагороди будуть додані після затвердження правил.</p>'}</div>`;
}

function renderLastGameDay(root, lastGameDay, league) {
  const day = lastGameDay || { date: '', matchesCount: 0, battlesCount: 0, mvp: null };
  root.innerHTML = `<h2 class="px-card__title">Останній ігровий день</h2>
  <div class="league-summary-strip"><span>Дата: ${esc(day.date || '—')}</span><span>Матчів: ${esc(day.matchesCount || 0)}</span><span>Боїв: ${esc(day.battlesCount || 0)}</span><span>MVP дня: ${esc(day.mvp || '—')}</span></div>
  <div class="px-card__actions"><a class="btn btn--secondary" href="#gameday?league=${encodeURIComponent(league)}">Відкрити ігровий день</a></div>`;
}

function resolveLeague(params = {}) {
  const { query: qp } = getRouteState();
  return normalizeLeague(params.league || qp.get('league') || 'kids') || 'kids';
}

function renderLoading(root) {
  const hero = root.querySelector('#leagueHero');
  if (hero) {
    hero.innerHTML = '<h1 class="px-card__title">Статистика ліги</h1><p class="px-card__text">Завантажуємо live статистику поточного сезону…</p>';
    return;
  }
  root.innerHTML = `<section class="px-card league-hero league-loading-block"><h1 class="px-card__title">Статистика ліги</h1><p class="px-card__text">Завантажуємо live статистику поточного сезону…</p></section>`;
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
    const awards = root.querySelector('#leagueAwards');
    const lastGameDay = root.querySelector('#leagueLastGameDay');

    if (!hero || !top10Table || !fullTable || !topHeader || !fullHeader || !expandBtn || !fullSection || !infographic || !awards || !lastGameDay) {
      throw new Error('League stats template не знайдено.');
    }

    topHeader.innerHTML = tableHeader();
    fullHeader.innerHTML = tableHeader();
    top10Table.innerHTML = data.top10.map((player) => rowMarkup(player, league)).join('') || '<p class="px-card__text">Немає активних гравців у цьому сезоні.</p>';
    const fullRows = data.players.map((player) => rowMarkup(player, league, { showDelta: true, showInactive: true })).join('');
    fullTable.innerHTML = '';
    fullSection.setAttribute('hidden', 'hidden');
    expandBtn.textContent = 'Показати всіх гравців';
    let isFullOpen = false;

    renderHero(hero, league, data);
    renderInfographic(infographic, data);
    renderAwards(awards, data.awards);
    renderLastGameDay(lastGameDay, data.lastGameDay, league);

    expandBtn.addEventListener('click', () => {
      if (!isFullOpen) {
        fullTable.innerHTML = fullRows || '<p class="px-card__text">Немає даних.</p>';
        fullSection.removeAttribute('hidden');
        expandBtn.textContent = 'Сховати повний список';
        isFullOpen = true;
      } else {
        fullSection.setAttribute('hidden', 'hidden');
        fullTable.innerHTML = '';
        expandBtn.textContent = 'Показати всіх гравців';
        isFullOpen = false;
      }
    });
  } catch (error) {
    root.innerHTML = `<section class="px-card league-hero"><h1 class="px-card__title">Статистика ліги</h1><p class="px-card__text">${esc(safeErrorMessage(error, 'Помилка завантаження live-даних'))}</p></section>`;
  }
}
