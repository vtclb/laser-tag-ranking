import { getHomeLiveData, rankFromPoints, safeErrorMessage } from '../core/dataHub.js';
import { leagueLabelUA, normalizeLeague } from '../core/naming.js';

const HOME_CURRENT_SEASON = { id: 'spring_2026', label: 'Весна 2026' };
const HOME_LEAGUES = ['sundaygames', 'kids'];

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function fmtSigned(v) { const n = Number(v); return Number.isFinite(n) ? `${n > 0 ? '+' : ''}${n}` : '—'; }

function currentRankingCard(players = []) {
  if (!players.length) return '<p class="px-card__text">Немає даних</p>';
  const rows = players.slice(0, 10).map((player) => `
    <div class="home-current-row">
      <span>#${player.place}</span>
      <strong>${esc(player.nickname)}</strong>
      <span>${esc(player.rankText || rankFromPoints(player.points))}</span>
      <span>${esc(player.points)}</span>
    </div>`).join('');
  return `<div class="home-current-table">${rows}</div>`;
}

function heroCard(player, league, isPrimary = false) {
  if (!player) return `<article class="px-card home-card ${isPrimary ? 'home-hero-card home-hero-card--primary' : 'home-hero-card'}"><h3>${esc(leagueLabelUA(league))}</h3><p class="px-card__text">Немає даних</p></article>`;
  return `<article class="px-card home-card ${isPrimary ? 'home-hero-card home-hero-card--primary' : 'home-hero-card'}">
    <div class="home-hero-card__head"><span class="px-badge">${esc(leagueLabelUA(league))}</span><strong class="home-hero-card__place">#1</strong></div>
    <h3 class="home-hero-card__name">${esc(player.nickname)}</h3>
    <p class="home-hero-card__rating">Ранг: <strong>${esc(player.rankText || rankFromPoints(player.points))}</strong> · Очки: <strong>${esc(player.points)}</strong></p>
  </article>`;
}

function leagueProgressCard(logs = []) {
  const aggregate = new Map();
  logs.forEach((entry) => {
    const key = entry.nickname.toLowerCase().trim();
    const prev = aggregate.get(key) || { nickname: entry.nickname, delta: 0 };
    prev.delta += Number(entry.delta) || 0;
    aggregate.set(key, prev);
  });
  const rows = [...aggregate.values()];
  const topPositive = rows.filter((x) => x.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3);
  const topNegative = rows.filter((x) => x.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3);

  const list = (title, items) => `<div><h5>${title}</h5>${items.length ? `<ul>${items.map((p) => `<li>${esc(p.nickname)} <strong>${fmtSigned(p.delta)}</strong></li>`).join('')}</ul>` : '<p class="px-card__text">Немає даних</p>'}</div>`;
  return `<div class="home-progress-grid">${list('Топ приросту', topPositive)}${list('Топ падіння', topNegative)}</div>`;
}

function lastGameDayCard(games = [], league) {
  if (!games.length) return '<p class="px-card__text">Немає даних</p>';
  const latestTs = Math.max(...games.map((g) => g.tsMs));
  const latestDate = new Date(latestTs).toISOString().slice(0, 10);
  const sameDay = games.filter((game) => String(game.timestamp).slice(0, 10) === latestDate && game.league === league);
  if (!sameDay.length) return '<p class="px-card__text">Немає матчів у останній день для ліги</p>';
  const players = [...new Set(sameDay.flatMap((game) => game.teams))];
  const mvps = [...new Set(sameDay.map((game) => game.mvp).filter(Boolean))];
  return `<div class="home-summary-strip">
    <p><strong>Дата:</strong> ${esc(latestDate)}</p>
    <p><strong>Матчів:</strong> ${sameDay.length}</p>
    <p><strong>Грали:</strong> ${esc(players.join(', '))}</p>
    ${mvps.length ? `<p><strong>MVP:</strong> ${esc(mvps.join(', '))}</p>` : ''}
  </div>`;
}

function renderLeagueSection({ league, players, logs, games, expanded }) {
  return `<section class="px-card home-card home-league" data-league="${league}">
    <div class="home-league__head"><h3>${esc(leagueLabelUA(league))}</h3><button type="button" class="btn btn--secondary home-expand-btn ${expanded ? 'is-active' : ''}" data-toggle-league="${league}">Розгорнути статистику</button></div>
    <div class="home-expanded ${expanded ? 'is-open' : ''}" id="expanded-${league}">
      <article class="home-panel"><h4>Поточний топ-10</h4>${currentRankingCard(players)}</article>
      <article class="home-panel"><h4>Прогрес ліги</h4>${leagueProgressCard(logs)}</article>
      <article class="home-panel"><h4>Останній ігровий день</h4>${lastGameDayCard(games, league)}</article>
    </div>
  </section>`;
}

export async function initHomePage() {
  const root = document.getElementById('view');
  if (!root) return;
  root.classList.add('home-v2');
  root.innerHTML = `<section class="hero home-hero"><span class="hero__kicker">HOME V2</span><h1 class="hero__title">LaserTag Ranking</h1><p class="home-current-season">Актуальний сезон: ${HOME_CURRENT_SEASON.label}</p><p class="px-card__text" id="stateBox" aria-live="polite" hidden></p><div class="hero__actions"><a class="btn btn--primary" href="#seasons">Сезони</a><a class="btn btn--secondary" href="#rules">Правила</a></div></section>
  <div class="px-divider"></div>
  <section class="section"><h2 class="px-card__title">Лідери зараз</h2><div class="home-heroes" id="topHeroes"></div></section>
  <section class="section"><article class="px-card home-card home-panel"><h3>Поточний рейтинг дорослої ліги</h3><div id="currentRankingAdults" class="home-skeleton"></div></article></section>
  <section class="section"><article class="px-card home-card home-panel"><h3>Поточний рейтинг дитячої ліги</h3><div id="currentRankingKids" class="home-skeleton"></div></article></section>
  <section class="section" id="leagueSections"></section>`;

  const stateBox = document.getElementById('stateBox');
  const topHeroes = document.getElementById('topHeroes');
  const leagueSections = document.getElementById('leagueSections');
  const currentRankingAdults = document.getElementById('currentRankingAdults');
  const currentRankingKids = document.getElementById('currentRankingKids');
  if (!stateBox || !topHeroes || !leagueSections || !currentRankingAdults || !currentRankingKids) return;

  const homeState = { activeLeague: 'sundaygames', expandedLeague: 'sundaygames' };

  const renderHome = (data) => {
    const adultsPlayers = data.adults.players;
    const kidsPlayers = data.kids.players;

    currentRankingAdults.classList.remove('home-skeleton');
    currentRankingKids.classList.remove('home-skeleton');
    currentRankingAdults.innerHTML = currentRankingCard(adultsPlayers);
    currentRankingKids.innerHTML = currentRankingCard(kidsPlayers);

    leagueSections.innerHTML = HOME_LEAGUES.map((league) => renderLeagueSection({
      league,
      players: league === 'sundaygames' ? adultsPlayers : kidsPlayers,
      logs: data.logs.filter((x) => x.league === league),
      games: data.games,
      expanded: homeState.expandedLeague === league
    })).join('');

    leagueSections.querySelectorAll('[data-toggle-league]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const clickedLeague = normalizeLeague(btn.getAttribute('data-toggle-league')) || 'sundaygames';
        homeState.expandedLeague = clickedLeague;
        homeState.activeLeague = clickedLeague;
        renderHome(data);
      });
    });
  };

  try {
    const live = await getHomeLiveData();
    stateBox.hidden = true;
    stateBox.textContent = '';
    topHeroes.innerHTML = heroCard(live.adults.players[0] || null, 'sundaygames', true) + heroCard(live.kids.players[0] || null, 'kids');
    renderHome(live);
  } catch (error) {
    const msg = safeErrorMessage(error, 'Дані тимчасово недоступні');
    stateBox.hidden = false;
    stateBox.textContent = msg;
    topHeroes.innerHTML = `<article class="px-card home-card"><p class="px-card__text">${esc(msg)}</p></article>`;
    currentRankingAdults.classList.remove('home-skeleton');
    currentRankingKids.classList.remove('home-skeleton');
    currentRankingAdults.innerHTML = `<p class="px-card__text">${esc(msg)}</p>`;
    currentRankingKids.innerHTML = `<p class="px-card__text">${esc(msg)}</p>`;
    leagueSections.innerHTML = '';
  }
}
