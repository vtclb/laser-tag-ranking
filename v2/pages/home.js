import { getCurrentLeagueLiveStats, getHomeLiveData, rankFromPoints, safeErrorMessage } from '../core/dataHub.js';
import { leagueLabelUA } from '../core/naming.js';

const HOME_LEAGUES = ['sundaygames', 'kids'];
const STATS_LINKS = {
  sundaygames: '#league-stats?league=sundaygames',
  kids: '#league-stats?league=kids'
};
const FALLBACK_AVATAR = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22%3E%3Crect width=%2248%22 height=%2248%22 fill=%22%23121a2a%22/%3E%3Ccircle cx=%2224%22 cy=%2218%22 r=%229%22 fill=%22%235b6c89%22/%3E%3Crect x=%2211%22 y=%2230%22 width=%2226%22 height=%2212%22 rx=%220%22 fill=%22%235b6c89%22/%3E%3C/svg%3E';

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
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
  const leagueTitle = league === 'kids' ? 'Дитяча ліга' : 'Доросла ліга';
  if (!player) {
    return `<article class="px-card home-card ${isPrimary ? 'home-hero-card home-hero-card--primary' : 'home-hero-card'}">
      <h3 class="home-hero-card__league">${esc(leagueTitle)}</h3>
      <p class="home-hero-card__subtitle">Поточний лідер сезону</p>
      <p class="home-hero-card__note">Немає активних даних</p>
    </article>`;
  }
  const rankText = String(player.rankText || rankFromPoints(player.points) || 'F').toUpperCase();
  const rankClass = getRankClass(rankText);
  const winRateText = Number.isFinite(Number(player.winRate)) ? `${Number(player.winRate).toFixed(1)}%` : '—';
  const mvpSummary = Number.isFinite(Number(player.mvpTotal))
    ? String(player.mvpTotal)
    : `${Number(player.mvp1 || 0) + Number(player.mvp2 || 0) + Number(player.mvp3 || 0)}`;
  return `<article class="px-card home-card ${isPrimary ? 'home-hero-card home-hero-card--primary' : 'home-hero-card'}">
    <h3 class="home-hero-card__league">${esc(leagueTitle)}</h3>
    <p class="home-hero-card__subtitle">Поточний лідер сезону</p>
    <div class="home-hero-card__hero-line">
      <span class="home-hero-card__avatar">${avatarImage(player)}</span>
      <div class="home-hero-card__identity">
        <h4 class="home-hero-card__name">${esc(player.nickname)}</h4>
        <span class="home-rank-letter home-hero-card__rank-badge ${rankClass}" aria-label="Ранг ${esc(rankText)}">${esc(rankText)}</span>
      </div>
    </div>
    <strong class="home-hero-card__points-value">${esc(player.points)}</strong>
    <p class="home-hero-card__stats" aria-label="Ключова статистика">${esc(player.matches)} · WR ${esc(winRateText)} · MVP ${esc(mvpSummary)}</p>
  </article>`;
}

function renderLeagueSection({ league, players }) {
  const statsLink = STATS_LINKS[league] || '#league-stats';
  return `<section class="px-card home-card home-league home-leaders home-leaders-frame" data-league="${league}">
    <div class="home-league__head"><h3 class="home-league__title">${esc(leagueLabelUA(league))} — top 10</h3></div>
    <article class="home-panel home-section-panel"><h4 class="home-section-title">Поточний топ-10</h4>${currentRankingCard(players)}</article>
    <div class="home-cta-row"><a class="btn btn--secondary" href="${statsLink}">Детальна статистика</a></div>
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

  const renderHome = async () => {
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
      players: league === 'sundaygames' ? adultsPlayers : kidsPlayers
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
    await getHomeLiveData();
    stateBox.hidden = true;
    stateBox.textContent = '';
    await renderHome();
  } catch (error) {
    const msg = safeErrorMessage(error, 'Дані тимчасово недоступні');
    stateBox.hidden = false;
    stateBox.textContent = msg;
    topHeroes.innerHTML = `<article class="px-card home-card"><p class="px-card__text">${esc(msg)}</p></article>`;
    leagueSections.innerHTML = '';
    homeFooter.innerHTML = footerBlock();
  }
}
