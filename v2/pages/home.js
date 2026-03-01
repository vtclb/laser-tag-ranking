import { getHomeFast, safeErrorMessage, rankMeta } from '../core/dataHub.js';

const ranks = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

function top5Card(players, leagueLabel, leagueSlug, ctaLabel) {
  const rows = (players || []).slice(0, 5).map((player, idx) => {
    const meta = rankMeta(player.rankLetter);
    const gamesPlayed = Number.isFinite(player.playedGames) ? player.playedGames : 0;
    const wr = Number.isFinite(player.winRate) ? `${Math.round(player.winRate)}%` : (gamesPlayed ? '0%' : '—');
    return `<li class="top5-row">
      <span class="top5-pos">#${idx + 1}</span>
      <span class="rank-badge ${meta.cssClass}">${meta.label}</span>
      <span class="top5-nick" title="${player.nick || '—'}">${player.nick || '—'}</span>
      <span class="top5-main"><span class="top5-points">${player.points ?? 0} pts</span><span class="top5-wr">WR ${wr}</span></span>
      <span class="top5-games">${gamesPlayed} ігор</span>
    </li>`;
  }).join('');

  return `<article class="px-card px-card--accent top5-card home-block section">
    <span class="px-badge">Маніфест ліги</span>
    <h3 class="px-card__title">${leagueLabel}</h3>
    
    <ol class="top5-list">${rows || '<li class="top5-empty">Немає даних</li>'}</ol>
    <div class="px-card__actions"><a class="btn btn--secondary" href="#/season?league=${leagueSlug === 'sundaygames' ? 'olds' : leagueSlug}">${ctaLabel}</a></div>
  </article>`;
}

function seasonProgressCard(metrics, schedule, leagueLabel) {
  const completed = schedule?.completed || 0;
  const total = schedule?.total || 0;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  const metricValue = (value) => (Number.isFinite(value) ? value : 'N/A');

  return `<article class="px-card home-block section">
    <span class="px-badge">Стан сезону</span>
    <h3 class="px-card__title">Сезонний прогрес · ${leagueLabel}</h3>
    <p class="px-card__text">Season progress: <strong>зіграно ${completed} / всього ${total} ігрових днів</strong></p>
    <div class="progress-shell"><div class="progress-bar" style="width:${progress}%"></div></div>
    <div class="season-kpi-grid">
      <p><span>Rounds</span><strong>${metricValue(metrics.roundsCount)}</strong></p>
      <p><span>Games</span><strong>${metricValue(metrics.gamesCount)}</strong></p>
      <p><span>Active players in season</span><strong>${metricValue(metrics.activePlayersCount)}</strong></p>
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
    <span class="px-badge rank-label">${leagueLabel}</span>
    <div class="rank-stack" role="img" aria-label="${leagueLabel} rank distribution">${segments || '<span class="tag">Немає даних</span>'}</div>
    <p class="tag rank-total">${total} players</p>
    <ul class="rank-legend">${legend}</ul>
  </div>`;
}

function rankDistributionCard(kidsDist, adultsDist) {
  return `<article class="px-card home-block rank-merged section">
    <span class="px-badge">Баланс рангів</span>
    <h3 class="px-card__title">Ранги (Kids vs Olds)</h3>
    ${buildBarSegments(kidsDist, 'Kids')}
    ${buildBarSegments(adultsDist, 'Olds')}
  </article>`;
}

function renderBlockSkeleton() {
  return '<article class="px-card skeleton-block home-block"><div class="skeleton-overlay"><div class="laser-scan"></div><div class="pixel-sparks"><span></span><span></span><span></span></div><div class="runner-mini"></div></div><div class="skeleton skeleton-line lg"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></article>';
}

function renderSkeleton() {
  document.getElementById('topHeroes').innerHTML = renderBlockSkeleton() + renderBlockSkeleton();
  document.getElementById('overviewStats').innerHTML = renderBlockSkeleton() + renderBlockSkeleton();
  document.getElementById('charts').innerHTML = renderBlockSkeleton();
}

function renderHomeStructure() {
  const homeRoot = document.getElementById('homeRoot');
  if (!homeRoot) return;

  homeRoot.innerHTML = `<main>
    <div class="container section">
      <section class="hero">
        <div class="hero__kicker">Game Entry Screen</div>
        <h1 class="hero__title">Головна</h1>
        <p class="hero__subtitle" id="currentSeason">—</p>
        <p class="px-card__text" id="stateBox" aria-live="polite"></p>
        <div class="hero__actions">
          <a class="btn btn--primary" href="#/home">▶ Game Day</a>
          <a class="btn btn--secondary" href="#/seasons">🏆 Season</a>
        </div>
      </section>

      <div class="px-divider"></div>

      <section class="section">
        <span class="px-badge">heroes</span>
        <h2 class="px-card__title">Герої сезону</h2>
        <p class="px-card__text">ТОП-5 гравців у двох лігах.</p>
        <div class="hero-grid section" id="topHeroes"></div>
      </section>

      <div class="px-divider"></div>

      <section class="section">
        <span class="px-badge">progress</span>
        <h2 class="px-card__title">Прогрес сезону</h2>
        <p class="px-card__text">Ключові метрики активності по лігах.</p>
        <div class="kpi kpi-2 section" id="overviewStats"></div>
      </section>

      <div class="px-divider"></div>

      <section class="section">
        <span class="px-badge">rank</span>
        <h2 class="px-card__title">Маніфест рангів</h2>
        <p class="px-card__text">Розподіл рангів між Kids та Olds.</p>
        <div class="kpi kpi-2 section" id="charts"></div>
      </section>

      <div class="px-divider"></div>

      <section class="px-card section">
        <span class="px-badge">rules</span>
        <h2 class="px-card__title">Швидкі переходи</h2>
        <p class="px-card__text">Усі ключові розділи Home збережено.</p>
        <div class="px-card__actions">
          <a class="btn btn--secondary" href="#/season?league=kids">👥 Leagues</a>
          <a class="btn btn--secondary" href="#/rules">📜 Rules</a>
        </div>
      </section>
    </div>
  </main>`;
}

function renderErrorBlocks(msg) {
  const err = `<article class="px-card home-block"><h3 class="px-card__title">Не вдалося завантажити дані</h3><p class="px-card__text">${msg}</p></article>`;
  document.getElementById('topHeroes').innerHTML = err + err;
  document.getElementById('overviewStats').innerHTML = err + err;
  document.getElementById('charts').innerHTML = err;
}

function setLoadedState() {
  const homeRoot = document.getElementById('homeRoot');
  if (homeRoot) homeRoot.classList.add('isLoaded');
}

async function init() {
  renderHomeStructure();
  const stateBox = document.getElementById('stateBox');
  renderSkeleton();

  try {
    const data = await getHomeFast();
    document.getElementById('currentSeason').textContent = `${data.seasonTitle} · ${data.seasonDateStart} — ${data.seasonDateEnd}`;
    document.getElementById('topHeroes').innerHTML = top5Card(data.top5Kids, 'ТОП-5 Kids', 'kids', 'Перейти до статистики Kids')
      + top5Card(data.top5Adults, 'ТОП-5 Olds', 'sundaygames', 'Перейти до статистики Olds');
    document.getElementById('overviewStats').innerHTML = seasonProgressCard(data.kidsMetrics, data.seasonSchedule, 'Kids')
      + seasonProgressCard(data.adultsMetrics, data.seasonSchedule, 'Olds');
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
