import { getCurrentLeagueLiveStats, safeErrorMessage } from '../core/dataHub.js';
import { normalizeLeague, leagueLabelUA } from '../core/naming.js';

const RANKS = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];
const FALLBACK_AVATAR = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22%3E%3Crect width=%2248%22 height=%2248%22 fill=%22%23121a2a%22/%3E%3Ccircle cx=%2224%22 cy=%2218%22 r=%229%22 fill=%22%235b6c89%22/%3E%3Crect x=%2211%22 y=%2230%22 width=%2226%22 height=%2212%22 fill=%22%235b6c89%22/%3E%3C/svg%3E';

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function rankClass(rank) { return `rank-${String(rank || 'F').trim().toLowerCase()}`; }
function winRateText(value) { return value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`; }
function fmtSigned(v) { const n = Number(v) || 0; return `${n > 0 ? '+' : ''}${n}`; }

function tableHeader() {
  return '<span>Місце</span><span>Ранг</span><span>Аватар</span><span>Нік</span><span>Бали</span><span>Ігри</span><span>Бої</span><span>WinRate</span><span>MVP1</span><span>MVP2</span><span>MVP3</span>';
}

function playerProfileHash(league, nickname) {
  return `#player?league=${encodeURIComponent(league)}&nick=${encodeURIComponent(nickname)}`;
}

function rowMarkup(player, league) {
  const rank = String(player.rankLetter || 'F').toUpperCase();
  const href = playerProfileHash(league, player.nickname);
  return `<a class="league-table-row league-player-row" href="${href}">
    <span class="league-table-cell">#${player.place}</span>
    <span class="league-table-cell"><span class="league-rank-letter ${rankClass(rank)}">${esc(rank)}</span></span>
    <span class="league-table-cell"><span class="league-avatar-wrap league-rank-frame ${rankClass(rank)}"><img class="league-avatar" src="${esc(player.avatarUrl || FALLBACK_AVATAR)}" alt="${esc(player.nickname)}"></span></span>
    <span class="league-table-cell league-col-nickname">${esc(player.nickname)}</span>
    <span class="league-table-cell">${esc(player.points)}</span>
    <span class="league-table-cell">${esc(player.matches)}</span>
    <span class="league-table-cell">${esc(player.battles)}</span>
    <span class="league-table-cell">${esc(winRateText(player.winRate))}</span>
    <span class="league-table-cell">${esc(player.mvp1)}</span>
    <span class="league-table-cell">${esc(player.mvp2)}</span>
    <span class="league-table-cell">${esc(player.mvp3)}</span>
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

function renderHero(root, league, data) {
  root.innerHTML = `<h1 class="px-card__title">${esc(leagueLabelUA(league))}</h1>
  <p class="px-card__text">Сезон: <strong>${esc(data.seasonLabel)}</strong></p>
  <div class="league-summary-strip"><span>Активних гравців: ${data.summary.playersCount}</span><span>Матчів: ${data.summary.matchesCount}</span></div>
  <div class="px-card__actions"><a class="btn" href="#gameday?league=${encodeURIComponent(league)}">Ігровий день</a></div>`;
}

function renderInfographic(root, data) {
  const dist = data.summary.rankDistribution || {};
  root.innerHTML = `<h2 class="px-card__title">Інфографіка ліги</h2>
  <div class="league-summary-strip"><span>Активних гравців: ${data.summary.playersCount}</span><span>Матчів: ${data.summary.matchesCount}</span><span>Боїв: ${data.summary.battlesCount}</span><span>Сер. рейтинг: ${data.summary.avgRating}</span><span>Total MVP: ${data.summary.totalMvp}</span></div>
  <div class="league-rank-grid">${RANKS.map((rank) => `<div class="league-rank-card"><strong>${rank}</strong><span>${dist[rank] || 0}</span></div>`).join('')}</div>
  <div class="league-progress-grid">
    ${progressCard(data.progress?.bestGrowth, fmtSigned(data.progress?.bestGrowth?.delta), 'Найкращий приріст')}
    ${progressCard(data.progress?.mostMvp, `${data.progress?.mostMvp?.mvpTotal || 0} MVP`, 'Найбільше MVP')}
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
  const hashQuery = String(location.hash || '').split('?')[1] || '';
  const qp = new URLSearchParams(hashQuery);
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

    topHeader.innerHTML = tableHeader();
    fullHeader.innerHTML = tableHeader();
    top10Table.innerHTML = data.top10.map((player) => rowMarkup(player, league)).join('') || '<p class="px-card__text">Немає даних.</p>';
    fullTable.innerHTML = data.players.map((player) => rowMarkup(player, league)).join('') || '<p class="px-card__text">Немає даних.</p>';

    renderHero(hero, league, data);
    renderInfographic(infographic, data);
    renderAwards(awards, data.awards);
    renderLastGameDay(lastGameDay, data.lastGameDay, league);

    expandBtn?.addEventListener('click', () => {
      const isHidden = fullSection.hasAttribute('hidden');
      if (isHidden) {
        fullSection.removeAttribute('hidden');
        expandBtn.textContent = 'Сховати повний список';
      } else {
        fullSection.setAttribute('hidden', 'hidden');
        expandBtn.textContent = 'Показати всіх гравців';
      }
    });
  } catch (error) {
    root.innerHTML = `<section class="px-card league-hero"><h1 class="px-card__title">Статистика ліги</h1><p class="px-card__text">${esc(safeErrorMessage(error, 'Помилка завантаження live-даних'))}</p></section>`;
  }
}
