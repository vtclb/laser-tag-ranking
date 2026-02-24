import { getHomeFast, safeErrorMessage, rankMeta } from '../core/dataHub.js';

const ranks = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

function top5Card(players, leagueLabel, leagueSlug, ctaLabel) {
  const rows = (players || []).slice(0, 5).map((player, idx) => {
    const meta = rankMeta(player.rankLetter);
    const wr = Number.isFinite(player.winRate) ? `${Math.round(player.winRate)}%` : '—';
    return `<li class="top5-row">
      <span class="top5-pos">#${idx + 1}</span>
      <span class="rank-badge ${meta.cssClass}">${meta.label}</span>
      <span class="top5-nick" title="${player.nick || '—'}">${player.nick || '—'}</span>
      <span class="top5-points">${player.points ?? 0}</span>
      <span class="top5-wr">${wr}</span>
    </li>`;
  }).join('');

  return `<article class="card mini top5-card home-block">
    <h3 class="home-block-title">${leagueLabel}</h3>
    <div class="top5-head">
      <span>Позиція</span><span>Ранг</span><span>Нік</span><span>Points</span><span>WR%</span>
    </div>
    <ol class="top5-list">${rows || '<li class="top5-empty">Немає даних</li>'}</ol>
    <a class="chip" href="./league.html?league=${leagueSlug}">${ctaLabel}</a>
  </article>`;
}

function seasonProgressCard(metrics, schedule, leagueLabel) {
  const completed = schedule?.completed || 0;
  const total = schedule?.total || 0;
  const upcoming = schedule?.upcoming || 0;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  return `<article class="card mini home-block">
    <h3 class="home-block-title">Сезонний прогрес · ${leagueLabel}</h3>
    <p class="tag">Ігрові дні сезону: <strong>${completed} / ${total}</strong></p>
    <div class="progress-shell"><div class="progress-bar" style="width:${progress}%"></div></div>
    <p class="tag">Залишилось ігрових днів: ${upcoming}</p>
    <div class="season-kpi-grid">
      <p><span>Бої</span><strong>${metrics.battlesCount || 0}</strong></p>
      <p><span>Раунди</span><strong>${metrics.roundsCount || 0}</strong></p>
      <p><span>Активні гравці</span><strong>${metrics.activePlayersCount || 0}</strong></p>
    </div>
  </article>`;
}

function rankDistributionCard(kidsDist, adultsDist) {
  const renderRows = (dist) => {
    const total = ranks.reduce((sum, rank) => sum + (dist?.[rank] || 0), 0);
    const max = Math.max(1, ...ranks.map((rank) => dist?.[rank] || 0));
    return ranks.map((rank) => {
      const value = dist?.[rank] || 0;
      const width = Math.max(4, Math.round((value / max) * 100));
      const percent = total ? Math.round((value / total) * 100) : 0;
      const meta = rankMeta(rank);
      return `<div class="dist-grid-row">
        <span class="dist-rank rank-badge ${meta.cssClass}">${rank}</span>
        <span class="dist-bar-wrap"><span class="dist-fill ${meta.cssClass}" style="width:${width}%"></span></span>
        <span class="dist-num">${value}</span>
        <span class="dist-pct">${percent}%</span>
      </div>`;
    }).join('');
  };

  return `<article class="card mini home-block rank-merged">
    <h3 class="home-block-title">Розподіл рангів</h3>
    <div class="rank-merged-grid">
      <section>
        <p class="tag">Kids</p>
        ${renderRows(kidsDist)}
      </section>
      <section>
        <p class="tag">Sundaygames</p>
        ${renderRows(adultsDist)}
      </section>
    </div>
  </article>`;
}

function renderBlockSkeleton() {
  return '<article class="card mini skeleton-block home-block"><div class="skeleton skeleton-line lg"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></article>';
}

function renderSkeleton() {
  document.getElementById('topHeroes').innerHTML = renderBlockSkeleton() + renderBlockSkeleton();
  document.getElementById('overviewStats').innerHTML = renderBlockSkeleton() + renderBlockSkeleton();
  document.getElementById('charts').innerHTML = renderBlockSkeleton();
}

function setLoadedState() {
  const homeRoot = document.getElementById('homeRoot');
  if (homeRoot) homeRoot.classList.add('isLoaded');
}

async function init() {
  const stateBox = document.getElementById('stateBox');
  renderSkeleton();

  try {
    const data = await getHomeFast();
    document.getElementById('currentSeason').textContent = data.seasonTitle;
    document.getElementById('topHeroes').innerHTML = top5Card(data.top5Kids, 'ТОП-5 Kids', 'kids', 'Перейти до статистики Kids')
      + top5Card(data.top5Adults, 'ТОП-5 Sundaygames', 'sundaygames', 'Перейти до статистики Sundaygames');
    document.getElementById('overviewStats').innerHTML = seasonProgressCard(data.kidsMetrics, data.seasonSchedule, 'Kids')
      + seasonProgressCard(data.adultsMetrics, data.seasonSchedule, 'Sundaygames');
    document.getElementById('charts').innerHTML = rankDistributionCard(data.rankDistKids, data.rankDistAdults);
    stateBox.textContent = 'Home показує лише сезонні метрики: бої, раунди, активних гравців та прогрес ігрових днів.';
  } catch (error) {
    document.getElementById('currentSeason').textContent = 'Дані тимчасово недоступні';
    stateBox.textContent = safeErrorMessage(error, 'Дані тимчасово недоступні');
  } finally {
    setLoadedState();
  }
}

init();
