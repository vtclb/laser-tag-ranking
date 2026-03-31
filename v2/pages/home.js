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
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatLeaderWinRate(value) {
  const n = Number(value || 0);
  return `${n.toFixed(1)}% WR`;
}

function getLeaderRankClass(rank = '') {
  const key = String(rank || '').trim().toLowerCase();
  return `leaders-now-card__rank--${key || 'e'}`;
}

function renderLeadersNowCard({ title, subtitle, leader, variant }) {
  if (!leader) {
    return `
      <article class="leaders-now-card leaders-now-card--${variant}">
        <div class="leaders-now-card__title">${escapeHtml(title)}</div>
        <div class="leaders-now-card__subtitle">${escapeHtml(subtitle)}</div>
        <div class="leaders-now-card__main leaders-now-card__main--empty">
          <div class="leaders-now-card__name">Немає активних даних</div>
          <div class="leaders-now-card__points">—</div>
        </div>
        <div class="leaders-now-card__stats">
          <span>0 ігор</span>
          <span>0.0% WR</span>
          <span>0 MVP</span>
        </div>
      </article>
    `;
  }

  const nickname = escapeHtml(leader.nickname || 'Гравець');
  const avatarUrl = escapeHtml(leader.avatarUrl || leader.avatar || '');
  const rank = escapeHtml(leader.rankLetter || leader.rank || 'E');
  const points = Number(leader.points || 0);
  const matches = Number(leader.matches || 0);
  const winRate = formatLeaderWinRate(leader.winRate || 0);
  const mvpTotal = Number(
    leader.mvpTotal ??
    (Number(leader.mvp1 || 0) + Number(leader.mvp2 || 0) + Number(leader.mvp3 || 0))
  );

  return `
    <article class="leaders-now-card leaders-now-card--${variant}">
      <div class="leaders-now-card__title">${escapeHtml(title)}</div>
      <div class="leaders-now-card__subtitle">${escapeHtml(subtitle)}</div>

      <div class="leaders-now-card__main">
        <img
          class="leaders-now-card__avatar"
          src="${avatarUrl}"
          alt="${nickname}"
          loading="lazy"
        />

        <div class="leaders-now-card__identity">
          <div class="leaders-now-card__name-row">
            <div class="leaders-now-card__name">${nickname}</div>
            <div class="leaders-now-card__rank ${getLeaderRankClass(rank)}">${rank}</div>
          </div>

          <div class="leaders-now-card__points">${points}</div>
        </div>
      </div>

      <div class="leaders-now-card__stats">
        <span>${matches} ігор</span>
        <span>${winRate}</span>
        <span>${mvpTotal} MVP</span>
      </div>
    </article>
  `;
}

function renderLeadersNow(adultLeader, kidsLeader) {
  return `
    <section class="leaders-now section">
      <div class="section-title">ЛІДЕРИ ЗАРАЗ</div>

      <div class="leaders-now-grid">
        ${renderLeadersNowCard({
          title: 'ДОРОСЛА ЛІГА',
          subtitle: 'Поточний лідер сезону',
          leader: adultLeader,
          variant: 'adult'
        })}
        ${renderLeadersNowCard({
          title: 'ДИТЯЧА ЛІГА',
          subtitle: 'Поточний лідер сезону',
          leader: kidsLeader,
          variant: 'kids'
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
