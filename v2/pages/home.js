import { getHomeFast, safeErrorMessage, rankMeta } from '../core/dataHub.js';

const ranks = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

function top5Card(players, leagueLabel, leagueSlug, ctaLabel) {
  const rows = (players || []).slice(0, 5).map((player, idx) => {
    const meta = rankMeta(player.rankLetter);
    const gamesPlayed = Number.isFinite(player.playedGames) ? player.playedGames : 0;
    const wr = Number.isFinite(player.winRate) ? `${Math.round(player.winRate)}%` : '—';
    return `<li class="top5-row">
      <span class="top5-pos">#${idx + 1}</span>
      <span class="rank-badge ${meta.cssClass}">${meta.label}</span>
      <span class="top5-nick" title="${player.nick || '—'}">${player.nick || '—'}</span>
      <span class="top5-points">${player.points ?? 0}</span>
      <span class="top5-wr">${wr}</span>
      <span class="top5-games">${gamesPlayed} ігор</span>
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
  const progress = total ? Math.round((completed / total) * 100) : 0;

  return `<article class="card mini home-block">
    <h3 class="home-block-title">Сезонний прогрес · ${leagueLabel}</h3>
    <p class="tag">Season progress: <strong>зіграно ${completed} / всього ${total} ігрових днів</strong></p>
    <div class="progress-shell"><div class="progress-bar" style="width:${progress}%"></div></div>
    <div class="season-kpi-grid">
      <p><span>Rounds</span><strong>${metrics.roundsCount || 0}</strong></p>
      <p><span>Games</span><strong>${metrics.gamesCount || 0}</strong></p>
      <p><span>Active players in season</span><strong>${metrics.activePlayersCount || 0}</strong></p>
      <p><span>Залишилось днів</span><strong>${schedule?.upcoming || 0}</strong></p>
    </div>
  </article>`;
}

function buildBarSegments(dist, leagueLabel) {
  const total = ranks.reduce((sum, rank) => sum + (dist?.[rank] || 0), 0);
  const segments = ranks.map((rank) => {
    const value = dist?.[rank] || 0;
    const percent = total ? Math.round((value / total) * 100) : 0;
    const meta = rankMeta(rank);
    return `<button type="button" class="rank-segment ${meta.cssClass}" style="width:${Math.max(percent, value ? 3 : 0)}%" title="${rank}: ${value} (${percent}%)">
      <span>${rank}</span>
    </button>`;
  }).join('');
  const legend = ranks.map((rank) => {
    const value = dist?.[rank] || 0;
    const percent = total ? Math.round((value / total) * 100) : 0;
    return `<li><strong>${rank}</strong>: ${value} (${percent}%)</li>`;
  }).join('');

  return `<div class="rank-compare-row">
    <p class="tag rank-label">${leagueLabel}</p>
    <div class="rank-stack" role="img" aria-label="${leagueLabel} rank distribution">${segments || '<span class="tag">Немає даних</span>'}</div>
    <p class="tag rank-total">${total} players</p>
    <ul class="rank-legend">${legend}</ul>
  </div>`;
}

function rankDistributionCard(kidsDist, adultsDist) {
  return `<article class="card mini home-block rank-merged">
    <h3 class="home-block-title">Ранги (Kids vs Sundaygames)</h3>
    ${buildBarSegments(kidsDist, 'Kids')}
    ${buildBarSegments(adultsDist, 'Adults')}
  </article>`;
}

function renderBlockSkeleton() {
  return '<article class="card mini skeleton-block home-block"><div class="skeleton-overlay"><div class="laser-scan"></div><div class="pixel-sparks"><span></span><span></span><span></span></div><div class="runner-mini"></div></div><div class="skeleton skeleton-line lg"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></article>';
}

function renderSkeleton() {
  document.getElementById('topHeroes').innerHTML = renderBlockSkeleton() + renderBlockSkeleton();
  document.getElementById('overviewStats').innerHTML = renderBlockSkeleton() + renderBlockSkeleton();
  document.getElementById('charts').innerHTML = renderBlockSkeleton();
}

function renderErrorBlocks(msg) {
  const err = `<article class="card mini home-block"><h3 class="home-block-title">Не вдалося завантажити дані</h3><p class="tag">${msg}</p></article>`;
  document.getElementById('topHeroes').innerHTML = err + err;
  document.getElementById('overviewStats').innerHTML = err + err;
  document.getElementById('charts').innerHTML = err;
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
    document.getElementById('currentSeason').textContent = `${data.seasonTitle} · ${data.seasonDateStart} — ${data.seasonDateEnd}`;
    document.getElementById('topHeroes').innerHTML = top5Card(data.top5Kids, 'ТОП-5 Kids', 'kids', 'Перейти до статистики Kids')
      + top5Card(data.top5Adults, 'ТОП-5 Sundaygames', 'sundaygames', 'Перейти до статистики Sundaygames');
    document.getElementById('overviewStats').innerHTML = seasonProgressCard(data.kidsMetrics, data.seasonSchedule, 'Kids')
      + seasonProgressCard(data.adultsMetrics, data.seasonSchedule, 'Sundaygames');
    document.getElementById('charts').innerHTML = rankDistributionCard(data.rankDistKids, data.rankDistAdults);
    stateBox.textContent = 'Home показує сезонні метрики та прогрес ігрових днів (Wed/Fri/Sun).';
  } catch (error) {
    const msg = safeErrorMessage(error, 'Дані тимчасово недоступні');
    document.getElementById('currentSeason').textContent = 'Дані тимчасово недоступні';
    stateBox.textContent = msg;
    renderErrorBlocks(msg);
  } finally {
    setLoadedState();
  }
}

init();
