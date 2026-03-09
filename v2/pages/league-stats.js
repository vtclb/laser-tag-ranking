import { getLeagueLiveData, rankFromPoints, safeErrorMessage } from '../core/dataHub.js';
import { normalizeLeague, leagueLabelUA } from '../core/naming.js';

const RANKS = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];
const FALLBACK_AVATAR = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22%3E%3Crect width=%2248%22 height=%2248%22 fill=%22%23121a2a%22/%3E%3Ccircle cx=%2224%22 cy=%2218%22 r=%229%22 fill=%22%235b6c89%22/%3E%3Crect x=%2211%22 y=%2230%22 width=%2226%22 height=%2212%22 rx=%220%22 fill=%22%235b6c89%22/%3E%3C/svg%3E';

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function fmtSigned(v) { const n = Number(v) || 0; return `${n > 0 ? '+' : ''}${n}`; }
function rankClass(rank) { return `rank-${String(rank || 'F').trim().toLowerCase()}`; }
function rankValue(player) { return String(player.rankText || rankFromPoints(player.points) || 'F').toUpperCase(); }
function avatar(player) { return `<img class="league-avatar" src="${esc(player?.avatarUrl || FALLBACK_AVATAR)}" alt="${esc(player?.nickname || 'player')}">`; }

function toWinrate(player) {
  const wins = Number(player?.wins);
  const draws = Number(player?.draws);
  const losses = Number(player?.losses);
  if (Number.isFinite(wins) && Number.isFinite(draws) && Number.isFinite(losses)) {
    const total = wins + draws + losses;
    if (total <= 0) return '—';
    return `${Math.round((wins / total) * 100)}%`;
  }
  const games = Number(player?.games);
  if (Number.isFinite(wins) && Number.isFinite(games) && games > 0) return `${Math.round((wins / games) * 100)}%`;
  return '—';
}

function fullRow(player, i) {
  const r = rankValue(player);
  return `<div class="league-table-row">
    <span class="league-table-cell league-col-place" data-label="Місце">#${i + 1}</span>
    <span class="league-table-cell league-col-rank" data-label="Ранг"><span class="league-rank-letter ${rankClass(r)}">${esc(r)}</span></span>
    <span class="league-table-cell league-col-avatar" data-label="Аватар"><span class="league-avatar-wrap league-rank-frame ${rankClass(r)}">${avatar(player)}</span></span>
    <span class="league-table-cell league-col-nickname" data-label="Нік">${esc(player.nickname)}</span>
    <span class="league-table-cell league-col-points" data-label="Очки">${esc(player.points)}</span>
    <span class="league-table-cell league-col-games" data-label="Ігри">${esc(player.games || 0)}</span>
    <span class="league-table-cell league-col-winrate" data-label="Winrate">${esc(toWinrate(player))}</span>
    <span class="league-table-cell league-col-mvp" data-label="MVP">${esc(player.mvp || 0)}</span>
    <span class="league-table-cell league-col-delta" data-label="Δ">${esc(fmtSigned(player.delta || 0))}</span>
  </div>`;
}

function progressCard(player, value, label, isSigned = false, extra = '') {
  const r = rankValue(player || {});
  const renderedValue = isSigned ? fmtSigned(value || 0) : `${esc(value || 0)}${extra}`;
  return `<article class="league-progress-card">
    <div class="league-progress-card__media">
      <span class="league-avatar-wrap league-rank-frame ${rankClass(r)}">${avatar(player || {})}</span>
      <span class="league-progress-card__name">${esc(player?.nickname || '—')}</span>
    </div>
    <div class="league-progress-card__value">${renderedValue}</div>
    <div class="league-progress-card__label">${esc(label)}</div>
  </article>`;
}

function sortPlayers(players, sortBy) {
  const arr = [...players];
  const by = (k) => (v) => Number(v?.[k]) || 0;
  if (sortBy === 'games') arr.sort((a, b) => by('games')(b) - by('games')(a));
  else if (sortBy === 'mvp') arr.sort((a, b) => by('mvp')(b) - by('mvp')(a));
  else if (sortBy === 'delta') arr.sort((a, b) => by('delta')(b) - by('delta')(a));
  else arr.sort((a, b) => by('points')(b) - by('points')(a));
  return arr.map((p, idx) => ({ ...p, place: idx + 1 }));
}

function renderPage(root, league, data) {
  const summary = data.summary || {};
  const dist = summary.rankDistribution || {};
  const lastGame = data.recentGames[0] || {};
  const lastDay = lastGame.timestamp || '—';
  const mvpDay = lastGame.mvp || '—';
  const activePlayers = (data.players || []).filter((p) => !p.inactive);

  root.innerHTML = `<section class="px-card league-hero">
      <h1 class="px-card__title">${esc(leagueLabelUA(league))}</h1>
      <p class="px-card__text">Детальна статистика поточного сезону: повний рейтинг, інфографіка, прогрес і підсумки останнього дня.</p>
      <div class="league-summary-strip"><span>Сезон: Поточний</span><span>Активних гравців: ${activePlayers.length || summary.playersCount || 0}</span><span>Матчів: ${summary.matchesCount || 0}</span></div>
      <div class="px-card__actions"><a class="btn" href="./gameday.html?league=${encodeURIComponent(league)}">Ігровий день / Логи</a></div>
    </section>

    <section class="px-card league-table">
      <div class="league-table-head"><h2 class="px-card__title">Повний рейтинг ліги</h2><div class="league-controls-row"><input id="leagueSearch" class="search-input" placeholder="Пошук по ніку"><select id="leagueSort" class="search-input"><option value="points">Очки</option><option value="games">Ігри</option><option value="mvp">MVP</option><option value="delta">Прогрес</option></select></div></div>
      <div class="league-table-header" aria-hidden="true"><span>Місце</span><span>Ранг</span><span>Аватар</span><span>Нік</span><span>Очки</span><span>Ігри</span><span>Winrate</span><span>MVP</span><span>Δ</span></div>
      <div id="fullTable" class="league-table-list"></div>
    </section>

    <section class="px-card league-distribution"><h2 class="px-card__title">Інфографіка ліги</h2><div class="league-summary-strip"><span>Сер. рейтинг: ${summary.avgRating || 0}</span><span>Матчів всього: ${summary.matchesCount || 0}</span><span>Активних гравців: ${activePlayers.length || summary.playersCount || 0}</span><span>Всього MVP: ${summary.totalMvp || 0}</span></div><div class="league-rank-grid">${RANKS.map((r) => `<div class="league-rank-card"><strong>${r}</strong><span>${dist[r] || 0}</span></div>`).join('')}</div></section>

    <section class="px-card league-progress"><h2 class="px-card__title">Прогрес ліги</h2><div class="league-progress-grid">
      ${progressCard(data.progress?.bestGrowth, data.progress?.bestGrowth?.delta, 'Найкращий приріст', true)}
      ${progressCard(data.progress?.mostMvp, data.progress?.mostMvp?.mvp, 'Найбільше MVP', false, ' MVP')}
      ${progressCard(data.progress?.biggestMinus, data.progress?.biggestMinus?.delta, 'Найбільший мінус', true)}
    </div></section>

    <section class="px-card league-awards"><h2 class="px-card__title">Нагороди / бейджі</h2><div class="league-awards-grid">${(data.awards || []).slice(0, 6).map((a) => `<article class="league-award-card"><span class="px-badge">${esc(a.title)}</span><p><strong>${esc(a.nickname)}</strong></p><p class="px-card__text">${esc(a.note)}</p></article>`).join('') || '<p class="px-card__text">Немає нагород</p>'}</div></section>

    <section class="px-card league-last-day"><h2 class="px-card__title">Останній ігровий день</h2><div class="league-summary-strip"><span>Дата: ${esc(lastDay)}</span><span>Матчів: ${esc(lastGame.matchesCount || lastGame.battlesCount || 1)}</span><span>MVP дня: ${esc(mvpDay)}</span></div><div class="px-card__actions"><a class="btn" href="./gameday.html?league=${encodeURIComponent(league)}">Відкрити ігровий день</a></div></section>`;

  const fullTable = root.querySelector('#fullTable');
  const searchEl = root.querySelector('#leagueSearch');
  const sortEl = root.querySelector('#leagueSort');
  const paint = () => {
    const needle = String(searchEl?.value || '').trim().toLowerCase();
    const sorted = sortPlayers(activePlayers, sortEl?.value || 'points');
    const filtered = needle ? sorted.filter((p) => String(p.nickname || '').toLowerCase().includes(needle)) : sorted;
    fullTable.innerHTML = filtered.map((p, i) => fullRow(p, i)).join('') || '<p class="px-card__text">Немає даних</p>';
  };
  searchEl?.addEventListener('input', paint);
  sortEl?.addEventListener('change', paint);
  paint();
}

function resolveLeague(params = {}) {
  const qp = new URLSearchParams(location.search);
  return normalizeLeague(params.league || qp.get('league') || document.body.dataset.league || 'kids') || 'kids';
}

function renderLoading(root) {
  root.innerHTML = `<section class="px-card league-hero league-loading-block">
    <h1 class="px-card__title">Статистика ліги</h1>
    <p class="px-card__text">Підтягуємо live-дані, будуємо повний рейтинг і метрики ліги…</p>
    <div class="league-loading-skeleton"><span></span><span></span><span></span></div>
  </section>`;
}

export async function initLeagueStatsPage(params = {}) {
  const root = document.getElementById('view');
  if (!root) return;
  renderLoading(root);
  try {
    const league = resolveLeague(params);
    const data = await getLeagueLiveData(league);
    renderPage(root, league, data);
  } catch (error) {
    root.innerHTML = `<section class="px-card league-hero"><h1 class="px-card__title">Статистика ліги</h1><p class="px-card__text">${esc(safeErrorMessage(error, 'Помилка завантаження'))}</p></section>`;
  }
}

if (document.body?.dataset?.league) initLeagueStatsPage({ league: document.body.dataset.league });
