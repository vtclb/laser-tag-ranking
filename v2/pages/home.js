import { getCurrentLeagueLiveStats, rankFromPoints, safeErrorMessage } from '../core/dataHub.js';
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

function isCurrentSeasonActive(player = null) {
  if (!player || typeof player !== 'object') return false;
  if (player.isSeasonActive === false) return false;
  if (player.isSeasonActive === true) return true;
  const matches = Number(player.matches || 0);
  return matches > 0;
}

function byPointsDesc(a = {}, b = {}) {
  return Number(b?.points || 0) - Number(a?.points || 0);
}

function rankKeyFromPlayer(player = {}) {
  return String(player?.rankLetter || rankFromPoints(Number(player?.points || 0)) || 'E').toLowerCase();
}

function currentRankingCard(players = []) {
  const rows = (players || []).slice(0, 10).map((player, index) => {
    const avatarUrl = esc(player?.avatarUrl || player?.avatar || FALLBACK_AVATAR);
    const nickname = esc(player?.nickname || `Гравець ${index + 1}`);
    const points = Number(player?.points || 0);
    const rank = esc(player?.rankLetter || rankFromPoints(points) || 'E');
    const rankKey = rankKeyFromPlayer(player);
    return `<li class="home-ranking__row rank-${rankKey}">
      <span class="home-ranking__place">#${index + 1}</span>
      <span class="home-ranking__rank rank-${rankKey}">${rank}</span>
      <span class="home-ranking__avatar-wrap rank-${rankKey}"><img class="home-ranking__avatar" src="${avatarUrl}" alt="${nickname}" loading="lazy" /></span>
      <span class="home-ranking__name">${nickname}</span>
      <span class="home-ranking__points"><small>очки</small>${points}</span>
    </li>`;
  }).join('');

  if (!rows) {
    return '<p class="px-card__text">Немає активних гравців</p>';
  }

  return `<ol class="home-ranking">${rows}</ol>`;
}

function renderLeadersNowCard({ leader, leagueLabel }) {
  const hasLeader = Boolean(leader);
  const nickname = escapeHtml(hasLeader ? (leader.nickname || 'Гравець') : 'Немає активних даних');
  const avatarUrl = escapeHtml(hasLeader ? (leader.avatarUrl || leader.avatar || FALLBACK_AVATAR) : FALLBACK_AVATAR);
  const rank = escapeHtml(hasLeader ? (leader.rankLetter || leader.rank || 'E') : '—');
  const rankKey = hasLeader ? rankKeyFromPlayer(leader) : 'e';
  const points = hasLeader ? Number(leader.points || 0) : '—';
  const matches = hasLeader ? Number(leader.matches || 0) : 0;
  const winRate = hasLeader ? `${Number(leader.winRate || 0).toFixed(0)}%` : '0%';
  const mvpTotal = hasLeader
    ? Number(
      leader.mvpTotal ??
      (Number(leader.mvp1 || 0) + Number(leader.mvp2 || 0) + Number(leader.mvp3 || 0))
    )
    : 0;

  return `
    <div class="leader-card rank-${rankKey}">
      <div class="leader-league-label">${escapeHtml(leagueLabel)}</div>
      <div class="leader-top">
        <div class="leader-avatar-wrap rank-${rankKey}"><img class="leader-avatar" src="${avatarUrl}" alt="${nickname}" loading="lazy" /></div>

        <div class="leader-info">
          <div class="leader-name">${nickname}</div>
          <div class="leader-rank rank-${rankKey}">${rank}</div>
        </div>
      </div>

      <div class="leader-points"><small>очки</small>${points}</div>

      <div class="leader-stats">
        <span>${matches} ігор</span>
        <span>${winRate}</span>
        <span>${mvpTotal} MVP</span>
      </div>
    </div>
  `;
}

function renderLeadersNow(adultLeader, kidsLeader) {
  return `
    <section class="leaders-now">
      <h2 class="px-card__title">Лідери сезону</h2>
      <div class="leaders-now-grid">
        ${renderLeadersNowCard({ leader: adultLeader, leagueLabel: 'Доросла ліга' })}
        ${renderLeadersNowCard({ leader: kidsLeader, leagueLabel: 'Дитяча ліга' })}
      </div>
    </section>
  `;
}

function renderLeagueSection({ league, players }) {
  const statsLink = STATS_LINKS[league] || '#league-stats';
  return `<section class="px-card home-card home-league home-leaders" data-league="${league}">
    <div class="home-league__head"><h3 class="home-league__title">${esc(leagueLabelUA(league))} — top 10</h3></div>
    <article class="home-panel home-section-panel"><h4 class="home-section-title">Поточний топ-10</h4>${currentRankingCard(players)}</article>
    <div class="home-cta-row"><a class="btn btn--secondary" href="${statsLink}">Детальна статистика</a></div>
  </section>`;
}

export async function initHomePage() {
  const root = document.getElementById('homeRoot') || document.getElementById('view');
  if (!root) return;
  root.classList.add('home-v2');
  root.innerHTML = `<section class="hero home-hero"><span class="hero__kicker">ВАРТА КЛУБ</span><h1 class="hero__title">ЛАЗЕРТАГ РЕЙТИНГ</h1><p class="home-current-season">Весняний сезон 2026 року</p><p class="px-card__text" id="stateBox" aria-live="polite" hidden></p></section>
  <div class="px-divider"></div>
  <section class="section" id="leadersNowMount"></section>
  <section class="section" id="leagueSections"></section>`;

  const stateBox = document.getElementById('stateBox');
  const leadersNowMount = document.getElementById('leadersNowMount');
  const leagueSections = document.getElementById('leagueSections');
  if (!stateBox || !leadersNowMount || !leagueSections) return;

  const renderHome = async () => {
    const [adultsResult, kidsResult] = await Promise.allSettled([
      getCurrentLeagueLiveStats('sundaygames'),
      getCurrentLeagueLiveStats('kids')
    ]);
    const adultsLive = adultsResult.status === 'fulfilled' ? adultsResult.value : { players: [] };
    const kidsLive = kidsResult.status === 'fulfilled' ? kidsResult.value : { players: [] };
    const pickSeasonActive = (livePlayers = []) => (livePlayers || []).filter((player) => isCurrentSeasonActive(player)).sort(byPointsDesc);
    const adultsPlayers = pickSeasonActive(adultsLive.players);
    const kidsPlayers = pickSeasonActive(kidsLive.players);

    if (adultsResult.status === 'rejected') {
      console.warn('[home] optional league data failed: sundaygames', adultsResult.reason);
    }
    if (kidsResult.status === 'rejected') {
      console.warn('[home] optional league data failed: kids', kidsResult.reason);
    }
    if (!adultsPlayers.length && !kidsPlayers.length) {
      throw new Error('Не вдалося завантажити live-рейтинг');
    }

    leadersNowMount.innerHTML = renderLeadersNow(adultsPlayers[0] || null, kidsPlayers[0] || null);

    leagueSections.innerHTML = HOME_LEAGUES.map((league) => renderLeagueSection({
      league,
      players: league === 'sundaygames' ? adultsPlayers : kidsPlayers
    })).join('');

  };

  try {
    stateBox.hidden = true;
    stateBox.textContent = '';
    await renderHome();
  } catch (error) {
    const msg = safeErrorMessage(error, 'Дані тимчасово недоступні');
    stateBox.hidden = false;
    stateBox.textContent = msg;
    leadersNowMount.innerHTML = renderLeadersNow(null, null);
    leagueSections.innerHTML = '';
  }
}
