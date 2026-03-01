import { getHomeFast, safeErrorMessage, rankMeta } from '../core/dataHub.js';
import { leagueLabelUA } from '../core/naming.js';

const ranks = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

function top5Card(players, leagueKey, ctaLabel) {
  const rows = (players || []).slice(0, 5).map((player, idx) => {
    const meta = rankMeta(player.rankLetter);
    const gamesPlayed = Number.isFinite(player.playedGames) ? player.playedGames : 0;
    const wr = Number.isFinite(player.winRate) ? `${Math.round(player.winRate)}%` : (gamesPlayed ? '0%' : '—');
    return `<li class="top5-row"><span class="top5-pos">#${idx + 1}</span><span class="rank-badge ${meta.cssClass}">${meta.label}</span><span class="top5-nick" title="${player.nick || '—'}">${player.nick || '—'}</span><span class="top5-main"><span class="top5-points">${player.points ?? 0} pts</span><span class="top5-wr">WR ${wr}</span></span><span class="top5-games">${gamesPlayed} ігор</span></li>`;
  }).join('');

  return `<article class="px-card px-card--accent top5-card home-block section"><span class="px-badge">Маніфест ліги</span><h3 class="px-card__title">${leagueLabelUA(leagueKey)}</h3><ol class="top5-list">${rows || '<li class="top5-empty">Немає даних</li>'}</ol><div class="px-card__actions"><a class="btn btn--secondary" href="#league-stats?league=${leagueKey}">${ctaLabel}</a></div></article>`;
}

function seasonProgressCard(metrics, schedule, leagueKey) {
  const completed = schedule?.completed || 0;
  const total = schedule?.total || 0;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  const metricValue = (value) => (Number.isFinite(value) ? value : 'N/A');

  return `<article class="px-card home-block section"><span class="px-badge">Стан сезону</span><h3 class="px-card__title">Сезонний прогрес · ${leagueLabelUA(leagueKey)}</h3><p class="px-card__text"><strong>Зіграно ${completed} / всього ${total} ігрових днів</strong></p><div class="progress-shell"><div class="progress-bar" style="width:${progress}%"></div></div><div class="season-kpi-grid"><p><span>Раундів</span><strong>${metricValue(metrics.roundsCount)}</strong></p><p><span>Ігор</span><strong>${metricValue(metrics.gamesCount)}</strong></p><p><span>Активних гравців</span><strong>${metricValue(metrics.activePlayersCount)}</strong></p><p><span>Залишилось днів</span><strong>${schedule?.upcoming || 0}</strong></p></div></article>`;
}

function buildBarSegments(dist, leagueKey) {
  const total = ranks.reduce((sum, rank) => sum + (dist?.[rank] || 0), 0);
  const segments = ranks.map((rank) => {
    const value = dist?.[rank] || 0;
    const percent = total ? Math.round((value / total) * 100) : 0;
    const meta = rankMeta(rank);
    return `<button type="button" class="rank-segment ${meta.cssClass}" style="width:${Math.max(percent, value ? 3 : 0)}%" title="${rank}: ${value} (${percent}%)"><span>${rank}</span></button>`;
  }).join('');

  return `<div class="rank-compare-row"><span class="px-badge rank-label">${leagueLabelUA(leagueKey)}</span><div class="rank-stack" role="img" aria-label="${leagueLabelUA(leagueKey)} rank distribution">${segments || '<span class="tag">Немає даних</span>'}</div><p class="tag rank-total">${total} гравців</p></div>`;
}

function rankDistributionCard(kidsDist, adultsDist) {
  return `<article class="px-card home-block rank-merged section"><span class="px-badge">Баланс рангів</span><h3 class="px-card__title">Ранги ліг</h3>${buildBarSegments(kidsDist, 'kids')}${buildBarSegments(adultsDist, 'olds')}</article>`;
}

function renderBlockSkeleton() {
  return '<article class="px-card skeleton-block home-block"><div class="skeleton-overlay"><div class="laser-scan"></div></div><div class="skeleton skeleton-line lg"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></article>';
}

function renderHomeStructure(root) {
  root.innerHTML = `<main><div class="container section"><section class="hero"><div class="hero__kicker">LaserTag</div><h1 class="hero__title">Головна</h1><p class="hero__subtitle" id="currentSeason">—</p><p class="px-card__text" id="stateBox" aria-live="polite"></p><div class="hero__actions"><a class="btn btn--primary" href="#seasons">Сезони</a><a class="btn btn--secondary" href="#rules">Правила</a></div></section><div class="px-divider"></div><section class="section"><h2 class="px-card__title">Герої сезону</h2><div class="hero-grid section" id="topHeroes"></div></section><div class="px-divider"></div><section class="section"><h2 class="px-card__title">Прогрес сезону</h2><div class="kpi kpi-2 section" id="overviewStats"></div></section><div class="px-divider"></div><section class="section"><h2 class="px-card__title">Маніфест рангів</h2><div class="kpi kpi-2 section" id="charts"></div></section></div></main>`;
}

function renderSkeleton() {
  document.getElementById('topHeroes').innerHTML = renderBlockSkeleton() + renderBlockSkeleton();
  document.getElementById('overviewStats').innerHTML = renderBlockSkeleton() + renderBlockSkeleton();
  document.getElementById('charts').innerHTML = renderBlockSkeleton();
}

export async function initHomePage() {
  const homeRoot = document.getElementById('homeRoot');
  if (!homeRoot) return;
  renderHomeStructure(homeRoot);
  const stateBox = document.getElementById('stateBox');
  renderSkeleton();

  try {
    const data = await getHomeFast();
    window.__v2LastSeason = { kids: data.seasonId, olds: data.seasonId };
    document.getElementById('currentSeason').textContent = `${data.seasonTitle} · ${data.seasonDateStart} — ${data.seasonDateEnd}`;
    document.getElementById('topHeroes').innerHTML = top5Card(data.top5Kids, 'kids', 'Перейти до статистики') + top5Card(data.top5Adults, 'olds', 'Перейти до статистики');
    document.getElementById('overviewStats').innerHTML = seasonProgressCard(data.kidsMetrics, data.seasonSchedule, 'kids') + seasonProgressCard(data.adultsMetrics, data.seasonSchedule, 'olds');
    document.getElementById('charts').innerHTML = rankDistributionCard(data.rankDistKids, data.rankDistAdults);
    stateBox.textContent = 'Головна показує сезонні метрики та прогрес ігрових днів.';
  } catch (error) {
    const msg = safeErrorMessage(error, 'Дані тимчасово недоступні');
    stateBox.textContent = msg;
    document.getElementById('topHeroes').innerHTML = `<article class="px-card"><p class="px-card__text">${msg}</p></article>`;
    document.getElementById('overviewStats').innerHTML = '';
    document.getElementById('charts').innerHTML = '';
  }
}
