import { getCurrentLeagueLiveStats, getHomeLiveData, rankFromPoints, safeErrorMessage } from '../core/dataHub.js';
import { leagueLabelUA } from '../core/naming.js';

const HOME_LEAGUES = ['sundaygames', 'kids'];
const STATS_LINKS = {
  sundaygames: '#league-stats?league=sundaygames',
  kids: '#league-stats?league=kids'
};
const FALLBACK_AVATAR = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22%3E%3Crect width=%2248%22 height=%2248%22 fill=%22%23121a2a%22/%3E%3Ccircle cx=%2224%22 cy=%2218%22 r=%229%22 fill=%22%235b6c89%22/%3E%3Crect x=%2211%22 y=%2230%22 width=%2226%22 height=%2212%22 rx=%220%22 fill=%22%235b6c89%22/%3E%3C/svg%3E';

function esc(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isCurrentSeasonActive(player = {}) {
  const hasActiveFlag = Object.prototype.hasOwnProperty.call(player || {}, 'active');
  const activeFlag = hasActiveFlag ? Boolean(player.active) : true;
  return activeFlag && Number(player.matches || 0) > 0;
}

function byPointsDesc(a, b) {
  return (Number(b?.points) || 0) - (Number(a?.points) || 0);
}

function playerRow(player) {
  const rankText = String(player.rankText || rankFromPoints(player.points) || 'F').toUpperCase();
  const rankClass = ['S', 'A', 'B', 'C', 'D', 'E', 'F'].includes(rankText) ? `rank-${rankText.toLowerCase()}` : 'rank-f';
  const topClass = Number(player.place) <= 3 ? 'is-top3' : '';
  const avatarSrc = player?.avatarUrl || FALLBACK_AVATAR;
  return `<div class="home-current-row home-player-row ${topClass}">
    <span class="home-place">#${player.place}</span>
    <span class="home-rank-letter ${rankClass}">${esc(rankText)}</span>
    <span class="home-avatar-wrap home-rank-frame ${rankClass}"><img class="home-avatar" src="${esc(avatarSrc)}" alt="${esc(player?.nickname || 'Player')}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>
    <span class="home-player-name">${esc(player.nickname)}</span>
    <span class="home-points-box">${esc(player.points)}</span>
  </div>`;
}

function currentRankingCard(players = []) {
  if (!players.length) return '<p class="px-card__text">Немає даних</p>';
  return `<div class="home-current-table">${players.slice(0, 10).map(playerRow).join('')}</div>`;
}

function formatWinRate(value) {
  const num = Number(value || 0);
  return `${num.toFixed(1)}% WR`;
}

function rankClass(rank = '') {
  return `leader-hero-card__rank--${String(rank).trim().toLowerCase() || 'e'}`;
}

function renderLeaderCard({ leagueTitle, subtitle, leader, variant }) {
  if (!leader) {
    return `
      <article class="leader-hero-card leader-hero-card--${variant}">
        <div class="leader-hero-card__league">${escapeHtml(leagueTitle)}</div>
        <div class="leader-hero-card__subtitle">${escapeHtml(subtitle)}</div>
        <div class="leader-hero-card__main">
          <div class="leader-hero-card__identity">
            <div class="leader-hero-card__name">Немає активних даних</div>
            <div class="leader-hero-card__points">—</div>
          </div>
        </div>
        <div class="leader-hero-card__stats">
          <span>0 ігор</span>
          <span>0.0% WR</span>
          <span>0 MVP</span>
        </div>
      </article>
    `;
  }

  const avatar = escapeHtml(leader.avatarUrl || leader.avatar || FALLBACK_AVATAR);
  const nick = escapeHtml(leader.nickname || 'Гравець');
  const rank = escapeHtml(leader.rankText || leader.rankLetter || leader.rank || rankFromPoints(leader.points) || 'E');
  const points = Number(leader.points || 0);
  const matches = Number(leader.matches || 0);
  const winRate = formatWinRate(leader.winRate || 0);
  const mvp = Number(
    leader.mvpTotal ??
    ((Number(leader.mvp1 || 0)) + (Number(leader.mvp2 || 0)) + (Number(leader.mvp3 || 0)))
  );

  return `
    <article class="leader-hero-card leader-hero-card--${variant}">
      <div class="leader-hero-card__league">${escapeHtml(leagueTitle)}</div>
      <div class="leader-hero-card__subtitle">${escapeHtml(subtitle)}</div>

      <div class="leader-hero-card__main">
        <img class="leader-hero-card__avatar" src="${avatar}" alt="${nick}" />
        <div class="leader-hero-card__identity">
          <div class="leader-hero-card__name-row">
            <div class="leader-hero-card__name">${nick}</div>
            <div class="leader-hero-card__rank ${rankClass(rank)}">${rank}</div>
          </div>
          <div class="leader-hero-card__points">${points}</div>
        </div>
      </div>

      <div class="leader-hero-card__stats">
        <span>${matches} ігор</span>
        <span>${winRate}</span>
        <span>${mvp} MVP</span>
      </div>
    </article>
  `;
}

function renderLeadersNow(adultLeader, kidsLeader) {
  return `
    <section class="leaders-now section">
      <div class="section-title">ЛІДЕРИ ЗАРАЗ</div>
      <div class="leaders-grid">
        ${renderLeaderCard({
          leagueTitle: 'ДОРОСЛА ЛІГА',
          subtitle: 'Поточний лідер сезону',
          leader: adultLeader,
          variant: 'adult',
        })}
        ${renderLeaderCard({
          leagueTitle: 'ДИТЯЧА ЛІГА',
          subtitle: 'Поточний лідер сезону',
          leader: kidsLeader,
          variant: 'kids',
        })}
      </div>
    </section>
  `;
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
  <section class="section" id="leadersNowMount"></section>
  <section class="section" id="leagueSections"></section>
  <section class="section" id="homeFooter"></section>`;

  const stateBox = document.getElementById('stateBox');
  const leadersNowMount = document.getElementById('leadersNowMount');
  const leagueSections = document.getElementById('leagueSections');
  const homeFooter = document.getElementById('homeFooter');
  if (!stateBox || !leadersNowMount || !leagueSections || !homeFooter) return;

  const renderHome = async () => {
    const [adultsLive, kidsLive] = await Promise.all([
      getCurrentLeagueLiveStats('sundaygames'),
      getCurrentLeagueLiveStats('kids')
    ]);
    const pickSeasonActive = (livePlayers = []) => (livePlayers || []).filter((player) => isCurrentSeasonActive(player)).sort(byPointsDesc);
    const adultsPlayers = pickSeasonActive(adultsLive.players);
    const kidsPlayers = pickSeasonActive(kidsLive.players);

    leadersNowMount.innerHTML = renderLeadersNow(adultsPlayers[0] || null, kidsPlayers[0] || null);

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
    leadersNowMount.innerHTML = `<section class="leaders-now section"><div class="section-title">ЛІДЕРИ ЗАРАЗ</div><p class="px-card__text">${esc(msg)}</p></section>`;
    leagueSections.innerHTML = '';
    homeFooter.innerHTML = footerBlock();
  }
}
