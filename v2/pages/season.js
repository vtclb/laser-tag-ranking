import { getSeasonsList, getSeasonDashboard, getSeasonPlayerQuickCard, safeErrorMessage } from '../core/dataHub.js';

const seasonSelect = document.getElementById('seasonSelect');
const leagueSelect = document.getElementById('leagueSelect');
const seasonPageTitle = document.getElementById('seasonPageTitle');
const heroStats = document.getElementById('heroStats');
const rankDistribution = document.getElementById('rankDistribution');
const playersList = document.getElementById('playersList');
const state = document.getElementById('state');
const modal = document.getElementById('playerModal');
const modalBody = document.getElementById('modalBody');
const playerActionSheet = document.getElementById('playerActionSheet');
const placeholder = '../assets/default-avatar.svg';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const viewState = { players: [], selectedPlayerNick: null, selectedPlayer: null };

function getRankClass(rank) {
  return `rank--${String(rank || 'F').toUpperCase()}`;
}

function safeValue(value, suffix = '') {
  if (value === null || value === undefined || value === '' || Number.isNaN(value)) return '—';
  return `${value}${suffix}`;
}

function rankRows(dist = {}) {
  const maxValue = Math.max(1, ...Object.values(dist).map((value) => Number(value) || 0));
  return ['S', 'A', 'B', 'C', 'D', 'E', 'F'].map((rank) => {
    const count = Number(dist[rank]) || 0;
    const width = maxValue ? Math.max(0, Math.round((count / maxValue) * 100)) : 0;
    return `<div class="rank-row"><span class="rank-badge ${getRankClass(rank)}">${rank}</span><div class="rank-bar"><div class="rank-fill ${getRankClass(rank)}" data-width="${width}" style="width:${reducedMotion ? width : 0}%"></div></div><b data-countup="${count}">0</b></div>`;
  }).join('');
}

function playerRow(player) {
  return `<article class="player-row" data-player-id="${player.nick}" role="button" tabindex="0" aria-label="Відкрити дії для ${player.nick}">
    <div class="player-pos">#${safeValue(player.place)}</div>
    <img class="avatar" src="${player.avatarUrl || placeholder}" alt="${player.nick}" onerror="this.src='${placeholder}'">
    <div class="player-meta"><strong>${player.nick}</strong><span>${safeValue(player.games)} ігор</span></div>
    <div class="player-score"><strong>${safeValue(player.points)} pts</strong><span>WR ${safeValue(player.winRate, '%')}</span></div>
    <div class="player-rankbadge rank-badge ${getRankClass(player.rank.label)}">${player.rank.label}</div>
  </article>`;
}

function animateInfographics(scope = document) {
  if (!reducedMotion) {
    scope.querySelectorAll('.rank-fill[data-width]').forEach((fill) => {
      const width = Number(fill.dataset.width) || 0;
      requestAnimationFrame(() => { fill.style.width = `${width}%`; });
    });
  }

  scope.querySelectorAll('[data-countup]').forEach((el) => {
    const target = Number(el.dataset.countup) || 0;
    if (reducedMotion) {
      el.textContent = `${target}`;
      return;
    }

    const start = performance.now();
    const duration = 600;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      el.textContent = `${Math.round(target * progress)}`;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function renderPlayers() {
  playersList.innerHTML = viewState.players.length ? viewState.players.map(playerRow).join('') : '<p class="px-card__text">Дані відсутні</p>';
}

function computeRadarAxes(player) {
  return [
    { key: 'WR', value: Number(player.winrate), max: 100 },
    { key: 'WINS', value: Number(player.wins), max: Math.max(1, Number(player.games) || 1) },
    { key: 'TOP1', value: Number(player.mvp1), max: Math.max(1, Number(player.games) || 1) },
    { key: 'TOP2', value: Number(player.mvp2), max: Math.max(1, Number(player.games) || 1) },
    { key: 'POINTS', value: Number(player.points), max: Math.max(200, Number(player.points) || 200) }
  ].filter((axis) => Number.isFinite(axis.value));
}

function renderRadarSVG(player) {
  const axes = computeRadarAxes(player);
  if (axes.length < 3) return '<p class="px-card__text">Недостатньо даних для графіка</p>';

  const size = 220;
  const center = size / 2;
  const radius = 78;
  const angleStep = (Math.PI * 2) / axes.length;
  const axisPoints = axes.map((axis, index) => {
    const angle = (-Math.PI / 2) + (angleStep * index);
    return { ...axis, x: center + (Math.cos(angle) * radius), y: center + (Math.sin(angle) * radius), angle };
  });

  const polygon = axisPoints.map((axis) => {
    const ratio = Math.max(0, Math.min(1, axis.value / (axis.max || 1)));
    return `${center + (Math.cos(axis.angle) * radius * ratio)},${center + (Math.sin(axis.angle) * radius * ratio)}`;
  }).join(' ');

  return `<div class="radar" aria-label="Radar chart"><svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Radar quick stats"><circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="rgba(173,232,255,0.25)"></circle><circle cx="${center}" cy="${center}" r="${radius * 0.66}" fill="none" stroke="rgba(173,232,255,0.18)"></circle><circle cx="${center}" cy="${center}" r="${radius * 0.33}" fill="none" stroke="rgba(173,232,255,0.12)"></circle>${axisPoints.map((axis) => `<line x1="${center}" y1="${center}" x2="${axis.x}" y2="${axis.y}" stroke="rgba(173,232,255,0.2)"></line>`).join('')}<polygon points="${polygon}" fill="rgba(183,255,42,0.25)" stroke="rgba(183,255,42,0.8)" stroke-width="2"></polygon>${axisPoints.map((axis) => `<text x="${axis.x}" y="${axis.y - 6}" text-anchor="middle" font-size="9" fill="#d8e9ff">${axis.key}</text>`).join('')}</svg></div>`;
}

function closePlayerStats() {
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  viewState.selectedPlayer = null;
}

function closeActionSheet() {
  playerActionSheet.hidden = true;
  playerActionSheet.setAttribute('aria-hidden', 'true');
  viewState.selectedPlayerNick = null;
}

function renderPlayerModal(player) {
  modalBody.innerHTML = `<header class="player-head"><img class="avatar lg" src="${player.avatarUrl || placeholder}" alt="${player.nick}" onerror="this.src='${placeholder}'"><div><h3>${player.nick}</h3><p><span class="player-rankbadge rank-badge ${getRankClass(player.rank.label)}">${player.rank.label}</span></p></div></header><section class="stat-grid"><article class="stat-tile"><small>Points</small><strong data-countup="${Number(player.points) || 0}">0</strong></article><article class="stat-tile"><small>Games</small><strong data-countup="${Number(player.games) || 0}">0</strong></article><article class="stat-tile"><small>W/L/D</small><strong>${safeValue(player.wins)}/${safeValue(player.losses)}/${safeValue(player.draws)}</strong></article><article class="stat-tile"><small>WR%</small><strong>${safeValue(player.winrate, '%')}</strong></article><article class="stat-tile"><small>AVG Δ</small><strong>${safeValue(player.pointsDelta)}</strong></article></section>${renderRadarSVG(player)}<button type="button" class="btn modal__close" data-close-modal="1">ЗАКРИТИ</button>`;
  animateInfographics(modalBody);
}

async function openPlayerStats(nick) {
  window.LoadingCubes?.show('Loading player quick stats…');
  const player = await getSeasonPlayerQuickCard({ seasonId: seasonSelect.value, league: leagueSelect.value, nick });
  window.LoadingCubes?.hide();
  if (!player) return;
  viewState.selectedPlayer = player;
  renderPlayerModal(player);
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  closeActionSheet();
}

function renderDashboard(data) {
  seasonPageTitle.textContent = 'LEAGUE SEASON DETAILS';
  const leagueLabel = data.league === 'kids' ? 'KIDS LEAGUE' : 'OLDS LEAGUE';
  heroStats.innerHTML = `<div class="px-badge">${leagueLabel}</div><h2 class="px-card__title">${data.seasonTitle}</h2><div class="stat-grid"><article class="stat-tile"><small>Rounds</small><strong data-countup="${Number(data.totals.rounds) || 0}">0</strong></article><article class="stat-tile"><small>Players</small><strong data-countup="${Number(data.totals.players) || 0}">0</strong></article><article class="stat-tile"><small>AVG Δ</small><strong>${safeValue(data.totals.avgPointsDeltaPerGame)}</strong></article><article class="stat-tile"><small>WLD</small><strong>${safeValue(data.totals.wldLabel)}</strong></article></div>`;
  rankDistribution.innerHTML = `<h2 class="px-card__title">RANK DISTRIBUTION</h2><div class="rank-bars">${rankRows(data.rankDistribution)}</div>`;

  viewState.players = data.tablePlayers;
  renderPlayers();
  animateInfographics(document);
}

function renderSkeleton() {
  heroStats.innerHTML = '<div class="stat-grid"><article class="stat-tile skeleton">Loading…</article><article class="stat-tile skeleton">Loading…</article><article class="stat-tile skeleton">Loading…</article><article class="stat-tile skeleton">Loading…</article></div>';
  rankDistribution.innerHTML = '<h2 class="px-card__title">RANK DISTRIBUTION</h2><p class="px-card__text">Loading…</p>';
  playersList.innerHTML = '<p class="px-card__text">Loading players…</p>';
}

async function loadDashboard() {
  renderSkeleton();
  window.LoadingCubes?.show('Syncing season dashboard…');
  try {
    const data = await getSeasonDashboard(seasonSelect.value, leagueSelect.value);
    renderDashboard(data);
    state.textContent = '';
  } catch (error) {
    state.textContent = safeErrorMessage(error, 'Дані тимчасово недоступні');
  } finally {
    window.LoadingCubes?.hide();
  }
}

playersList.addEventListener('click', (event) => {
  const row = event.target.closest('.player-row');
  if (!row) return;
  viewState.selectedPlayerNick = row.dataset.playerId;
  playerActionSheet.hidden = false;
  playerActionSheet.setAttribute('aria-hidden', 'false');
});

playersList.addEventListener('keydown', (event) => {
  if ((event.key !== 'Enter' && event.key !== ' ') || !event.target.closest('.player-row')) return;
  event.preventDefault();
  const row = event.target.closest('.player-row');
  viewState.selectedPlayerNick = row.dataset.playerId;
  playerActionSheet.hidden = false;
  playerActionSheet.setAttribute('aria-hidden', 'false');
});

playerActionSheet.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.closeSheet === '1') {
    closeActionSheet();
    return;
  }
  if (target.dataset.action === 'open-stats-sheet' && viewState.selectedPlayerNick) {
    await openPlayerStats(viewState.selectedPlayerNick);
  }
});

modal.addEventListener('click', (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.dataset.closeModal === '1') closePlayerStats();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!modal.hidden) closePlayerStats();
  closeActionSheet();
});

async function init() {
  const seasons = await getSeasonsList();
  seasonSelect.innerHTML = seasons.map((season) => `<option value="${season.id}">${season.title}</option>`).join('');
  seasonSelect.value = seasons[0]?.id;
  seasonSelect.addEventListener('change', loadDashboard);
  leagueSelect.addEventListener('change', loadDashboard);
  await loadDashboard();
}

init();
