import { getSeasonsList, getSeasonDashboard, safeErrorMessage } from '../core/dataHub.js';
import { normalizeLeague, leagueLabelUA, toDataHubLeague } from '../core/naming.js';

function errorCard(message) {
  return `<section class="px-card px-card--accent"><h2 class="px-card__title">Помилка</h2><p class="px-card__text">${message}</p><div class="px-card__actions"><a class="btn" href="#seasons">Повернутись до сезонів</a></div></section>`;
}

function playerRow(player) {
  return `<article class="player-row"><div class="player-pos">#${player.place ?? '—'}</div><div class="player-meta"><strong>${player.nick || '—'}</strong><span>${player.games ?? 0} ігор</span></div><div class="player-score"><strong>${player.points ?? 0} pts</strong><span>WR ${player.winRate ?? 0}%</span></div><div class="player-rankbadge rank-badge rank--${String(player.rank?.label || 'F').toUpperCase()}">${player.rank?.label || 'F'}</div></article>`;
}

function rankRows(dist = {}) {
  return ['S', 'A', 'B', 'C', 'D', 'E', 'F'].map((rank) => `<div class="rank-row"><span class="rank-badge rank--${rank}">${rank}</span><b>${Number(dist[rank]) || 0}</b></div>`).join('');
}

async function renderDashboard({ seasonId, league }) {
  const seasonPageTitle = document.getElementById('seasonPageTitle');
  const heroStats = document.getElementById('heroStats');
  const rankDistribution = document.getElementById('rankDistribution');
  const playersList = document.getElementById('playersList');
  const state = document.getElementById('state');
  const seasonSelect = document.getElementById('seasonSelect');
  const leagueSelect = document.getElementById('leagueSelect');

  if (!seasonPageTitle || !heroStats || !rankDistribution || !playersList || !state || !seasonSelect || !leagueSelect) {
    throw new Error('Сторінка сезону не ініціалізована');
  }

  const seasons = await getSeasonsList();
  seasonSelect.innerHTML = seasons.map((season) => `<option value="${season.id}">${season.title}</option>`).join('');
  seasonSelect.value = seasonId;
  leagueSelect.value = league;

  const pushRoute = () => {
    location.hash = `#season?league=${leagueSelect.value}&season=${encodeURIComponent(seasonSelect.value)}`;
  };
  seasonSelect.onchange = pushRoute;
  leagueSelect.onchange = pushRoute;

  heroStats.innerHTML = '<p class="px-card__text">Завантаження…</p>';

  try {
    const data = await getSeasonDashboard(seasonId, toDataHubLeague(league));
    seasonPageTitle.textContent = `Деталі сезону · ${leagueLabelUA(league)}`;
    heroStats.innerHTML = `<div class="px-badge">${leagueLabelUA(league)}</div><h2 class="px-card__title">${data.seasonTitle}</h2><div class="stat-grid"><article class="stat-tile"><small>Раундів</small><strong>${data.totals.rounds ?? 0}</strong></article><article class="stat-tile"><small>Гравців</small><strong>${data.totals.players ?? 0}</strong></article><article class="stat-tile"><small>Ігор</small><strong>${data.totals.games ?? 0}</strong></article></div>`;
    rankDistribution.innerHTML = `<h2 class="px-card__title">Розподіл рангів</h2><div class="rank-bars">${rankRows(data.rankDistribution)}</div>`;
    const players = Array.isArray(data.tablePlayers) ? data.tablePlayers : [];
    if (!players.length) {
      playersList.innerHTML = '<p class="px-card__text">Немає даних за цей сезон</p><a class="btn" href="#seasons">Повернутись до сезонів</a>';
      state.textContent = 'Немає даних';
      return;
    }
    playersList.innerHTML = players.map(playerRow).join('');
    state.textContent = '';
  } catch (error) {
    playersList.innerHTML = `<p class="px-card__text">${safeErrorMessage(error, 'Дані тимчасово недоступні')}</p><a class="btn" href="#seasons">Повернутись до сезонів</a>`;
    rankDistribution.innerHTML = '';
    state.textContent = 'Немає даних';
  }
}

export async function initSeasonPage(params = {}) {
  const root = document.getElementById('view');
  if (!root) return;

  const league = normalizeLeague(params.league);
  const seasonId = String(params.season || '').trim();

  if (!seasonId) {
    root.innerHTML = errorCard('Не вказано сезон');
    return;
  }
  if (!league) {
    root.innerHTML = errorCard('Не вказано лігу');
    return;
  }

  root.innerHTML = `<section class="px-card season-header"><h1 class="px-card__title" id="seasonPageTitle">Деталі сезону</h1></section><section class="px-card px-card--accent season-controls-card"><div class="season-controls-row"><select id="seasonSelect" class="search-input" aria-label="Обрати сезон"></select><select id="leagueSelect" class="search-input" aria-label="Обрати лігу"><option value="kids">${leagueLabelUA('kids')}</option><option value="olds">${leagueLabelUA('olds')}</option></select></div><div id="heroStats"></div></section><section class="px-card" id="rankDistribution"></section><section class="px-card"><h2 class="px-card__title">Гравці сезону</h2><div id="playersList"></div><p class="px-card__text" id="state"></p></section>`;

  await renderDashboard({ seasonId, league });
}
