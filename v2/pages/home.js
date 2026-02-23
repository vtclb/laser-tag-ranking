import { getHomeFast, safeErrorMessage, rankMeta } from '../core/dataHub.js';

const placeholder = '../assets/default-avatar.svg';
const ranks = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

function top5Card(players, leagueLabel, leagueSlug, ctaLabel) {
  const rows = (players || []).slice(0, 5).map((player, idx) => {
    const meta = rankMeta(player.rankLetter);
    return `<li class="top5-row">
      <span class="top5-pos">${idx + 1}</span>
      <img class="avatar" src="${player.avatarUrl || placeholder}" alt="avatar" onerror="this.src='${placeholder}'">
      <span class="top5-nick">${player.nick || '—'}</span>
      <span class="top5-points">${player.points ?? '—'}</span>
      <span class="rank-badge ${meta.cssClass}">${meta.label}</span>
    </li>`;
  }).join('');

  return `<article class="card mini top5-card home-block">
    <h3 class="home-block-title">${leagueLabel}</h3>
    <ol class="top5-list">${rows || '<li class="top5-empty">Немає даних</li>'}</ol>
    <a class="chip" href="./league.html?league=${leagueSlug}">${ctaLabel}</a>
  </article>`;
}

function seasonProgressCard(metrics, schedule) {
  const completed = schedule?.completed || 0;
  const total = schedule?.total || 0;
  const upcoming = schedule?.upcoming || 0;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  return `<article class="card mini home-block">
    <h3 class="home-block-title">Kids Season Progress</h3>
    <div class="season-kpi-grid">
      <p><span>Раундів</span><strong>${metrics.roundsCount || 0}</strong></p>
      <p><span>Боїв</span><strong>${metrics.battlesCount || 0}</strong></p>
      <p><span>Активних гравців</span><strong>${metrics.activePlayersCount || 0}</strong></p>
      <p><span>Ігрових днів</span><strong>${metrics.gameDaysCount || 0}</strong></p>
    </div>
    <p class="tag">Сезонні ігрові дні (Ср/Пт/Нд): ${completed} / ${total}. Залишилось: ${upcoming}.</p>
    <div class="progress-shell"><div class="progress-bar" style="width:${progress}%"></div></div>
  </article>`;
}

function combinedDistChart(kidsDist, adultsDist) {
  const renderRows = (dist) => {
    const max = Math.max(1, ...ranks.map((rank) => dist?.[rank] || 0));
    return ranks.map((rank) => {
      const value = dist?.[rank] || 0;
      const width = Math.max(6, Math.round((value / max) * 100));
      const meta = rankMeta(rank);
      return `<div class="dist-grid-row">
        <span class="dist-rank ${meta.cssClass}">${rank}</span>
        <span class="dist-bar-wrap"><span class="dist-fill ${meta.cssClass}" style="width:${width}%"></span></span>
        <span class="dist-num">${value}</span>
      </div>`;
    }).join('');
  };

  return `<article class="card mini home-block rank-merged">
    <h3 class="home-block-title">Rank Distribution</h3>
    <div class="rank-merged-grid">
      <section>
        <p class="tag">Kids</p>
        ${renderRows(kidsDist)}
      </section>
      <section>
        <p class="tag">Olds</p>
        ${renderRows(adultsDist)}
      </section>
    </div>
  </article>`;
}

function renderBlockSkeleton() {
  return '<article class="card mini skeleton-block home-block"><div class="skeleton skeleton-line lg"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></article>';
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function createSnakeLoader() {
  const host = document.getElementById('homeLoader');
  if (!host) return () => {};

  if (prefersReducedMotion()) {
    host.innerHTML = '<div class="loader-static" aria-live="polite">Loading<span>.</span><span>.</span><span>.</span></div>';
    return () => { host.innerHTML = ''; };
  }

  host.innerHTML = '<div class="snake-wrap"><canvas id="snakeCanvas" width="180" height="180"></canvas><p class="tag">Loading Home… tap для зміни напрямку</p></div>';
  const canvas = document.getElementById('snakeCanvas');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return () => { host.innerHTML = ''; };

  const grid = 12;
  const cell = 15;
  const state = {
    snake: [{ x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }],
    direction: { x: 1, y: 0 },
    food: { x: 9, y: 5 }
  };

  const directions = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
  const turn = () => {
    const currentIndex = directions.findIndex((d) => d.x === state.direction.x && d.y === state.direction.y);
    state.direction = directions[(currentIndex + 1) % directions.length];
  };
  canvas.addEventListener('pointerdown', turn);

  let raf = 0;
  let tick = 0;
  const draw = () => {
    tick += 1;
    if (tick % 6 === 0) {
      const head = state.snake[0];
      const next = {
        x: (head.x + state.direction.x + grid) % grid,
        y: (head.y + state.direction.y + grid) % grid
      };
      state.snake.unshift(next);
      if (next.x === state.food.x && next.y === state.food.y) {
        state.food = { x: (state.food.x + 5) % grid, y: (state.food.y + 7) % grid };
      } else {
        state.snake.pop();
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(17,25,42,0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i <= grid; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell);
      ctx.lineTo(canvas.width, i * cell);
      ctx.stroke();
    }

    ctx.fillStyle = '#31d0ff';
    state.snake.forEach((part) => ctx.fillRect(part.x * cell + 2, part.y * cell + 2, cell - 4, cell - 4));

    ctx.fillStyle = '#7cff72';
    ctx.fillRect(state.food.x * cell + 3, state.food.y * cell + 3, cell - 6, cell - 6);

    raf = window.requestAnimationFrame(draw);
  };

  raf = window.requestAnimationFrame(draw);
  return () => {
    window.cancelAnimationFrame(raf);
    canvas.removeEventListener('pointerdown', turn);
    host.innerHTML = '';
  };
}

function renderSkeleton() {
  document.getElementById('topHeroes').innerHTML = renderBlockSkeleton() + renderBlockSkeleton();
  document.getElementById('overviewStats').innerHTML = renderBlockSkeleton();
  document.getElementById('charts').innerHTML = renderBlockSkeleton();
}

async function init() {
  const stateBox = document.getElementById('stateBox');
  renderSkeleton();
  const stopLoader = createSnakeLoader();
  try {
    const data = await getHomeFast();
    document.getElementById('currentSeason').textContent = data.seasonTitle;
    document.getElementById('topHeroes').innerHTML = top5Card(data.top5Kids, 'ТОП-5 Kids', 'kids', 'Статистика Kids')
      + top5Card(data.top5Adults, 'ТОП-5 Olds', 'sundaygames', 'Статистика Olds');
    document.getElementById('overviewStats').innerHTML = seasonProgressCard(data.kidsMetrics, data.seasonSchedule);
    document.getElementById('charts').innerHTML = combinedDistChart(data.rankDistKids, data.rankDistAdults);
    stateBox.textContent = 'Метрики сезону рахуються лише за games та без множення на гравців.';
  } catch (error) {
    document.getElementById('currentSeason').textContent = 'Дані тимчасово недоступні';
    stateBox.textContent = safeErrorMessage(error, 'Дані тимчасово недоступні');
  } finally {
    stopLoader();
  }
}

init();
