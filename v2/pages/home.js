import { getHomeFast, safeErrorMessage, rankMeta } from '../core/dataHub.js';
import { leagueLabelUA } from '../core/naming.js';

const ranks = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

function top5Card(players, leagueKey) {
  const rows = (players || []).slice(0, 5).map((player, idx) => {
    const meta = rankMeta(player.rankLetter);
    const rankClass = `rank--${meta.label}`;
    const gamesPlayed = Number.isFinite(player.playedGames) ? player.playedGames : 0;
    const wr = Number.isFinite(player.winRate) ? `${Math.round(player.winRate)}%` : (gamesPlayed ? '0%' : '—');
    return `<li class="top5-row"><span class="top5-pos">#${idx + 1}</span><span class="rank-badge ${rankClass}">${meta.label}</span><span class="top5-nick" title="${player.nick || '—'}">${player.nick || '—'}</span><span class="top5-main"><span class="top5-points">${player.points ?? 0} очок</span><span class="top5-wr">WR ${wr}</span></span><span class="top5-games">${gamesPlayed} ігор</span></li>`;
  }).join('');

  return `<article class="px-card px-card--accent top5-card home-block section"><h3 class="px-card__title">${leagueLabelUA(leagueKey)}</h3><ol class="top5-list">${rows || '<li class="top5-empty">Немає даних</li>'}</ol></article>`;
}

function seasonProgressCard(metrics, schedule, leagueKey) {
  const completed = schedule?.completed || 0;
  const total = schedule?.total || 0;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  const metricValue = (value) => (Number.isFinite(value) ? value : 0);
  const daysLeft = Math.max(0, schedule?.upcoming || 0);
  const totalDays = Math.max(1, daysLeft + completed);

  const items = [
    ['Раундів', metricValue(metrics.roundsCount), 220],
    ['Ігор', metricValue(metrics.gamesCount), 120],
    ['Активних гравців', metricValue(metrics.activePlayersCount), 80],
    ['Днів залишилось', daysLeft, totalDays]
  ];

  return `<article class="px-card home-block section"><h3 class="px-card__title">${leagueLabelUA(leagueKey)}</h3><p class="px-card__text"><strong>Прогрес сезону: ${completed}/${total} днів</strong></p><div class="progress-shell"><div class="progress-bar" style="width:${progress}%"></div></div>${items.map(([label, value, max]) => {
    const width = Math.min(100, Math.round((Number(value) / Math.max(1, Number(max))) * 100));
    return `<p class="progress-line"><span>${label}: <strong>${value}</strong></span><div class="progress-shell"><div class="progress-bar" style="width:${width}%"></div></div></p>`;
  }).join('')}</article>`;
}

function buildBarSegments(dist, leagueKey) {
  const total = ranks.reduce((sum, rank) => sum + (dist?.[rank] || 0), 0);
  const segments = ranks.map((rank) => {
    const value = dist?.[rank] || 0;
    const percent = total ? Math.round((value / total) * 100) : 0;
    const meta = rankMeta(rank);
    return `<button type="button" class="rank-segment ${meta.cssClass}" style="width:0%" data-target-width="${Math.max(percent, value ? 3 : 0)}" title="Ранг ${rank}: ${value} (${percent}%)"><span>${rank}</span></button>`;
  }).join('');

  return `<div class="rank-compare-row"><span class="px-badge rank-label">${leagueLabelUA(leagueKey)}</span><div class="rank-stack" role="img" aria-label="${leagueLabelUA(leagueKey)} розподіл рангів">${segments || '<span class="tag">Немає даних</span>'}</div><p class="tag rank-total">${total} гравців</p></div>`;
}

function rankDistributionCard(kidsDist, adultsDist) {
  return `<article class="px-card home-block rank-merged section"><h3 class="px-card__title">Баланс рангів</h3>${buildBarSegments(kidsDist, 'kids')}${buildBarSegments(adultsDist, 'olds')}</article>`;
}

function renderHomeStructure(root) {
  root.innerHTML = `<section class="hero"><h1 class="hero__title">LaserTag Ranking</h1><p class="hero__subtitle">Весняний сезон розпочато! Запрошуємо всіх на ігри.</p><p class="px-card__text" id="stateBox" aria-live="polite"></p><div class="hero__actions"><a class="btn btn--primary" href="#seasons">Сезони</a><a class="btn btn--secondary" href="#rules">Правила</a></div></section><div class="px-divider"></div><section class="section"><h2 class="px-card__title">Герої сезону</h2><div class="hero-grid section" id="topHeroes"></div></section><div class="px-divider"></div><section class="section"><h2 class="px-card__title">Прогрес сезону</h2><div class="kpi kpi-2 section" id="overviewStats"></div></section><div class="px-divider"></div><section class="section"><h2 class="px-card__title">Баланс рангів</h2><div class="kpi kpi-2 section" id="charts"></div></section>`;
}

function renderBlockSkeleton() {
  return '<article class="px-card skeleton-block home-block"><div class="skeleton-overlay"><div class="laser-scan"></div></div><div class="skeleton skeleton-line lg"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></article>';
}

function renderSkeleton(topHeroes, overviewStats, charts) {
  topHeroes.innerHTML = renderBlockSkeleton() + renderBlockSkeleton();
  overviewStats.innerHTML = renderBlockSkeleton() + renderBlockSkeleton();
  charts.innerHTML = renderBlockSkeleton();
}

export async function initHomePage() {
  const homeRoot = document.getElementById('view');
  if (!homeRoot) return;

  renderHomeStructure(homeRoot);

  const stateBox = document.getElementById('stateBox');
  const topHeroes = document.getElementById('topHeroes');
  const overviewStats = document.getElementById('overviewStats');
  const charts = document.getElementById('charts');

  if (!stateBox || !topHeroes || !overviewStats || !charts) {
    homeRoot.innerHTML = '<section class="px-card px-card--accent"><h2 class="px-card__title">Помилка</h2><p class="px-card__text">Не вдалося ініціалізувати головну сторінку.</p></section>';
    return;
  }

  renderSkeleton(topHeroes, overviewStats, charts);

  try {
    const data = await getHomeFast();
    window.__v2LastSeason = { kids: data.seasonId, olds: data.seasonId };
    topHeroes.innerHTML = top5Card(data.top5Kids, 'kids') + top5Card(data.top5Adults, 'olds');
    overviewStats.innerHTML = seasonProgressCard(data.kidsMetrics, data.seasonSchedule, 'kids') + seasonProgressCard(data.adultsMetrics, data.seasonSchedule, 'olds');
    charts.innerHTML = rankDistributionCard(data.rankDistKids, data.rankDistAdults);
    requestAnimationFrame(() => {
      charts.querySelectorAll('.rank-segment[data-target-width]').forEach((segment) => {
        segment.style.transition = 'width .7s ease';
        segment.style.width = `${segment.dataset.targetWidth || 0}%`;
      });
    });
    stateBox.textContent = `Актуальний сезон: ${data.seasonTitle}`;
  } catch (error) {
    const msg = safeErrorMessage(error, 'Дані тимчасово недоступні');
    stateBox.textContent = msg;
    topHeroes.innerHTML = `<article class="px-card"><p class="px-card__text">${msg}</p></article>`;
    overviewStats.innerHTML = '';
    charts.innerHTML = '';
  }
}
