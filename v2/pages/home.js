import { getCurrentLeagueLiveStats, getHomeLiveData, rankFromPoints, safeErrorMessage } from '../core/dataHub.js';
import { leagueLabelUA } from '../core/naming.js';

const HOME_LEAGUES = ['sundaygames', 'kids'];
const STATS_LINKS = {
  sundaygames: '#league-stats?league=sundaygames',
  kids: '#league-stats?league=kids'
};
const FALLBACK_AVATAR = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22%3E%3Crect width=%2248%22 height=%2248%22 fill=%22%23121a2a%22/%3E%3Ccircle cx=%2224%22 cy=%2218%22 r=%229%22 fill=%22%235b6c89%22/%3E%3Crect x=%2211%22 y=%2230%22 width=%2226%22 height=%2212%22 rx=%220%22 fill=%22%235b6c89%22/%3E%3C/svg%3E';

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function fmtSigned(v) { const n = Number(v); return Number.isFinite(n) ? `${n > 0 ? '+' : ''}${n}` : '—'; }
function isCurrentSeasonActive(player = {}) {
  const hasActiveFlag = Object.prototype.hasOwnProperty.call(player || {}, 'active');
  const activeFlag = hasActiveFlag ? Boolean(player.active) : true;
  return activeFlag && Number(player.matches || 0) > 0;
}
function byPointsDesc(a, b) {
  return (Number(b?.points) || 0) - (Number(a?.points) || 0);
}
function getRankClass(rank) {
  const normalized = String(rank || '').trim().toUpperCase();
  return ['S', 'A', 'B', 'C', 'D', 'E', 'F'].includes(normalized) ? `rank-${normalized.toLowerCase()}` : 'rank-f';
}
function avatarImage(player) {
  const src = player?.avatarUrl || FALLBACK_AVATAR;
  return `<img class="home-avatar" src="${esc(src)}" alt="${esc(player?.nickname || 'Player')}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
}

function playerRow(player) {
  const rankText = String(player.rankText || rankFromPoints(player.points) || 'F').toUpperCase();
  const rankClass = getRankClass(rankText);
  const topClass = Number(player.place) <= 3 ? 'is-top3' : '';
  return `<div class="home-current-row home-player-row ${topClass}">
    <span class="home-place">#${player.place}</span>
    <span class="home-rank-letter ${rankClass}">${esc(rankText)}</span>
    <span class="home-avatar-wrap home-rank-frame ${rankClass}">${avatarImage(player)}</span>
    <span class="home-player-name">${esc(player.nickname)}</span>
    <span class="home-points-box">${esc(player.points)}</span>
  </div>`;
}

function currentRankingCard(players = []) {
  if (!players.length) return '<p class="px-card__text">Немає даних</p>';
  return `<div class="home-current-table">${players.slice(0, 10).map(playerRow).join('')}</div>`;
}

function heroCard(player, league, isPrimary = false) {
  if (!player) {
    return `<article class="px-card home-card ${isPrimary ? 'home-hero-card home-hero-card--primary' : 'home-hero-card'}">
      <h3 class="home-hero-card__league">${esc(leagueLabelUA(league))}</h3>
      <p class="home-hero-card__note">Немає активних даних для ліги</p>
    </article>`;
  }
  const rankText = player.rankText || rankFromPoints(player.points);
  const rankClass = getRankClass(rankText);
  const winRateText = Number.isFinite(Number(player.winRate)) ? `${Number(player.winRate).toFixed(1)}%` : '—';
  const mvpSummary = Number.isFinite(Number(player.mvpTotal))
    ? String(player.mvpTotal)
    : `${Number(player.mvp1 || 0)}/${Number(player.mvp2 || 0)}/${Number(player.mvp3 || 0)}`;
  const leaderTitle = league === 'kids' ? 'Лідер дитячої ліги' : 'Лідер дорослої ліги';
  return `<article class="px-card home-card ${isPrimary ? 'home-hero-card home-hero-card--primary' : 'home-hero-card'}">
    <h3 class="home-hero-card__league">${esc(leaderTitle)}</h3>
    <p class="home-hero-card__subtitle">${esc(leagueLabelUA(league))} — поточний лідер сезону</p>
    <span class="home-avatar-wrap home-rank-frame ${rankClass} home-hero-card__avatar">${avatarImage(player)}</span>
    <h4 class="home-hero-card__name">${esc(player.nickname)}</h4>
    <p class="home-hero-card__line">Ранг: <strong class="home-rank-letter ${rankClass}">${esc(rankText)}</strong></p>
    <p class="home-hero-card__line">Очки: <strong>${esc(player.points)}</strong></p>
    <p class="home-hero-card__line">Матчі: <strong>${esc(player.matches)}</strong></p>
    <p class="home-hero-card__line">WinRate: <strong>${esc(winRateText)}</strong></p>
    <p class="home-hero-card__line">MVP: <strong>${esc(mvpSummary)}</strong></p>
    <p class="home-hero-card__note">Поточний лідер ліги серед активних гравців сезону</p>
  </article>`;
}

function getLeagueProgress(logs = [], games = [], league) {
  const aggregate = new Map();
  logs.forEach((entry) => {
    const key = String(entry.nickname || '').trim().toLowerCase();
    if (!key) return;
    const prev = aggregate.get(key) || { nickname: entry.nickname, delta: 0 };
    prev.delta += Number(entry.delta) || 0;
    aggregate.set(key, prev);
  });
  const bestGrowth = [...aggregate.values()].sort((a, b) => b.delta - a.delta)[0] || null;
  const biggestMinus = [...aggregate.values()].sort((a, b) => a.delta - b.delta)[0] || null;

  const leagueGames = games.filter((game) => game.league === league);
  const mvpCount = new Map();
  leagueGames.forEach((game) => {
    const mvp = String(game.mvp || '').trim();
    if (!mvp) return;
    mvpCount.set(mvp, (mvpCount.get(mvp) || 0) + 1);
  });
  const mostMvp = [...mvpCount.entries()].sort((a, b) => b[1] - a[1])[0] || null;

  return { bestGrowth, biggestMinus, mostMvp };
}

function findPlayerByNickname(players = [], nickname = '') {
  const key = String(nickname).trim().toLowerCase();
  if (!key) return null;
  return players.find((player) => String(player.nickname || '').trim().toLowerCase() === key) || null;
}

function progressCard({ label, value, player = null, rankText = null }) {
  if (!value) {
    return `<article class="home-card home-progress-card"><div class="home-progress-card__media"></div><div class="home-progress-card__value">Немає даних</div><div class="home-progress-card__label">${esc(label)}</div></article>`;
  }
  const rankClass = getRankClass(rankText || player?.rankText || rankFromPoints(player?.points));
  const name = player?.nickname || '—';
  return `<article class="home-card home-progress-card">
    <div class="home-progress-card__media">
      <span class="home-avatar-wrap home-rank-frame ${rankClass}">${avatarImage(player)}</span>
      <span class="home-progress-card__name">${esc(name)}</span>
    </div>
    <div class="home-progress-card__value">${esc(value)}</div>
    <div class="home-progress-card__label">${esc(label)}</div>
  </article>`;
}

function leagueProgressInfographic(logs = [], games = [], league, players = []) {
  const progress = getLeagueProgress(logs, games, league);
  const growthPlayer = findPlayerByNickname(players, progress.bestGrowth?.nickname);
  const mvpPlayer = findPlayerByNickname(players, progress.mostMvp?.[0]);
  const minusPlayer = findPlayerByNickname(players, progress.biggestMinus?.nickname);

  return `<div class="home-progress-grid">
    ${progressCard({
      label: 'Найкращий приріст',
      value: progress.bestGrowth ? fmtSigned(progress.bestGrowth.delta) : null,
      player: growthPlayer
    })}
    ${progressCard({
      label: 'Найбільше MVP',
      value: progress.mostMvp ? `${progress.mostMvp[1]} MVP` : null,
      player: mvpPlayer
    })}
    ${progressCard({
      label: 'Найбільший мінус',
      value: progress.biggestMinus ? fmtSigned(progress.biggestMinus.delta) : null,
      player: minusPlayer
    })}
  </div>`;
}

function renderLeagueSection({ league, players, logs, games }) {
  const statsLink = STATS_LINKS[league] || '#league-stats';
  return `<section class="px-card home-card home-league home-leaders home-leaders-frame" data-league="${league}">
    <div class="home-league__head"><h3 class="home-league__title">${esc(leagueLabelUA(league))} — top 10</h3></div>
    <article class="home-panel home-section-panel"><h4 class="home-section-title">Поточний топ-10</h4>${currentRankingCard(players)}</article>
    <div class="home-cta-row"><a class="btn btn--secondary" href="${statsLink}">Детальна статистика</a></div>
    <article class="home-panel home-section-panel"><h4 class="home-section-title">Прогрес ліги</h4>${leagueProgressInfographic(logs, games, league, players)}</article>
  </section>`;
}

function footerBlock() {
  return `<section class="px-card home-card home-footer-block" id="homeFooterBlock">
    <p class="home-footer-days">Швидкі переходи до ліг та статистики</p>
    <div class="home-footer-actions">
      <button type="button" class="btn btn--secondary" id="homeScrollTopBtn">Вгору</button>
      <a class="btn btn--secondary" href="${STATS_LINKS.sundaygames}">Детальна статистика дорослої ліги</a>
      <a class="btn btn--secondary" href="${STATS_LINKS.kids}">Детальна статистика дитячої ліги</a>
    </div>
  </section>`;
}

export async function initHomePage() {
  const root = document.getElementById('homeRoot') || document.getElementById('view');
  if (!root) return;
  root.classList.add('home-v2');
  root.innerHTML = `<section class="hero home-hero"><span class="hero__kicker">HOME V2</span><h1 class="hero__title">Лазертаг рейтинг</h1><p class="home-current-season">Live рейтинг клубу</p><p class="px-card__text" id="stateBox" aria-live="polite" hidden></p><div class="hero__actions home-hero-buttons"><a class="btn btn--secondary" href="#rules">Правила</a></div></section>
  <div class="px-divider"></div>
  <section class="section home-leaders-frame"><h2 class="px-card__title">Лідери зараз</h2><div class="home-heroes" id="topHeroes"></div></section>
  <section class="section" id="leagueSections"></section>
  <section class="section" id="homeFooter"></section>`;

  const stateBox = document.getElementById('stateBox');
  const topHeroes = document.getElementById('topHeroes');
  const leagueSections = document.getElementById('leagueSections');
  const homeFooter = document.getElementById('homeFooter');
  if (!stateBox || !topHeroes || !leagueSections || !homeFooter) return;

  const renderHome = async (data) => {
    const [adultsLive, kidsLive] = await Promise.all([
      getCurrentLeagueLiveStats('sundaygames'),
      getCurrentLeagueLiveStats('kids')
    ]);
    const pickSeasonActive = (livePlayers = []) => (livePlayers || []).filter((player) => isCurrentSeasonActive(player)).sort(byPointsDesc);
    const adultsPlayers = pickSeasonActive(adultsLive.players);
    const kidsPlayers = pickSeasonActive(kidsLive.players);

    topHeroes.innerHTML = heroCard(adultsPlayers[0] || null, 'sundaygames', true) + heroCard(kidsPlayers[0] || null, 'kids');

    leagueSections.innerHTML = HOME_LEAGUES.map((league) => renderLeagueSection({
      league,
      players: league === 'sundaygames' ? adultsPlayers : kidsPlayers,
      logs: data.logs.filter((x) => x.league === league),
      games: data.games
    })).join('');

    homeFooter.innerHTML = footerBlock();
    const scrollTopBtn = document.getElementById('homeScrollTopBtn');
    if (scrollTopBtn) {
      scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  };

  try {
    const live = await getHomeLiveData();
    stateBox.hidden = true;
    stateBox.textContent = '';
    await renderHome(live);
  } catch (error) {
    const msg = safeErrorMessage(error, 'Дані тимчасово недоступні');
    stateBox.hidden = false;
    stateBox.textContent = msg;
    topHeroes.innerHTML = `<article class="px-card home-card"><p class="px-card__text">${esc(msg)}</p></article>`;
    leagueSections.innerHTML = '';
    homeFooter.innerHTML = footerBlock();
  }
}
