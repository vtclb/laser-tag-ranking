import { getCurrentLeagueLiveStats, rankFromPoints, safeErrorMessage } from '../core/dataHub.js';
import { leagueLabelUA } from '../core/naming.js';
import { loadTournamentsList } from './tournaments.js';
import { formatDataUpdatedAt, makeDataStatus } from '../core/dataStatus.js';

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
      <span class="home-ranking__identity">
        <span class="home-ranking__avatar-wrap rank-${rankKey}"><img class="home-ranking__avatar" src="${avatarUrl}" alt="${nickname}" loading="lazy" /></span>
        <span class="home-ranking__name">${nickname}</span>
      </span>
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

function pickHomeStatus(adultsStatus, kidsStatus) {
  const statuses = [adultsStatus, kidsStatus]
    .filter((status) => status && typeof status === 'object')
    .map((status) => makeDataStatus(status));
  if (!statuses.length) return makeDataStatus({ source: 'unknown', ok: false, message: 'Data unavailable' });
  const withDate = statuses
    .map((status) => ({ status, ts: Date.parse(status.updatedAt || '') }))
    .filter((entry) => Number.isFinite(entry.ts))
    .sort((a, b) => b.ts - a.ts);
  return withDate[0]?.status || statuses[0];
}

function renderDataStatusLine(status) {
  const safeStatus = makeDataStatus(status);
  const timeLabel = formatDataUpdatedAt(safeStatus.updatedAt);
  if (safeStatus.ok && timeLabel) {
    return `<p class="data-status-line data-status-line--ok">Дані оновлено: ${esc(timeLabel)}</p>`;
  }
  if (safeStatus.source === 'cache' && timeLabel) {
    return `<p class="data-status-line data-status-line--warning">Показуємо кеш · оновлено: ${esc(timeLabel)}</p>`;
  }
  return '<p class="data-status-line data-status-line--error">Дані тимчасово недоступні</p>';
}

function renderLeagueSection({ league, players }) {
  const statsLink = STATS_LINKS[league] || '#league-stats';
  return `<section class="px-card home-card home-league home-leaders" data-league="${league}">
    <div class="home-league__head"><h3 class="home-league__title">${esc(leagueLabelUA(league))} — top 10</h3></div>
    <article class="home-panel home-section-panel">${currentRankingCard(players)}</article>
    <div class="home-cta-row"><a class="btn btn--secondary" href="${statsLink}">Детальна статистика</a></div>
  </section>`;
}

function formatHomeTournamentMeta(item = {}) {
  const league = escapeHtml(leagueLabelUA(item?.league) || item?.league || 'Ліга');
  const rawStatus = String(item?.status || '').trim();
  const status = escapeHtml(rawStatus ? rawStatus.toUpperCase() : 'ПЛАНУЄТЬСЯ');
  const dateStart = item?.dateStart ? new Date(item.dateStart) : null;
  if (dateStart && !Number.isNaN(dateStart.getTime())) {
    const dateLabel = escapeHtml(dateStart.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }));
    return `${league} · ${status} · ${dateLabel}`;
  }
  return `${league} · ${status}`;
}

function renderHomeTournamentsCard(items = [], status = 'empty') {
  const hasItems = Array.isArray(items) && items.length > 0;
  const visibleItems = hasItems ? items.slice(0, 2) : [];
  const list = visibleItems.map((item) => (
    `<a class="home-tournaments-teaser__row" href="${item?.tournamentId ? `#tournaments?selected=${encodeURIComponent(item.tournamentId)}` : '#tournaments'}">
      <div>
        <strong>${escapeHtml(item?.name || item?.tournamentId || 'Турнір')}</strong>
        <span class="home-tournaments-teaser__meta">${formatHomeTournamentMeta(item)}</span>
      </div>
      <span class="home-tournaments-teaser__arrow" aria-hidden="true">→</span>
    </a>`
  )).join('');

  if (status === 'error') {
    console.warn('[home] tournaments unavailable, using neutral fallback');
  }

  return `<section class="home-tournaments-teaser">
    <div class="home-tournaments-teaser__header">
      <div class="home-tournaments-teaser__titleBlock">
        <p class="home-tournaments-teaser__kicker">ТУРНІРНИЙ РЕЖИМ</p>
        <h2>Активні турніри</h2>
      </div>
      <a href="#tournaments" class="home-tournaments-teaser__cta">До турнірів</a>
    </div>
    <p class="home-tournaments-teaser__text">Слідкуй за турнірною таблицею, матчами та статистикою команд.</p>
    <div class="home-tournaments-teaser__content">
      ${hasItems ? list : `<div class="home-tournaments-teaser__empty">
        <strong>Поки немає активних турнірів</strong>
        <p>Коли турнір стартує, тут з’явиться швидкий доступ до таблиці та матчів.</p>
      </div>`}
    </div>
  </section>`;
}

async function fetchHomeTournaments() {
  return loadTournamentsList();
}

function renderHomeLoadingSkeleton() {
  return `
    <section class="home-loader" id="homeLoading" aria-live="polite" aria-busy="true">
      <div class="home-loader__panel">
        <p class="home-loader__title">ІНІЦІАЛІЗАЦІЯ РЕЙТИНГУ</p>
        <p class="home-loader__subtitle">System boot / VTCLB ranking node</p>
      </div>

      <div class="home-loader__console" id="homeLoaderConsole"></div>

      <section class="home-loader__progress" aria-label="Стан завантаження">
        <div class="home-loader__progress-head">
          <span class="home-loader__progress-label">SYNC IN PROGRESS</span>
          <span class="home-loader__progress-percent" id="homeLoaderPercent">08%</span>
        </div>
        <div class="home-loader__progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="8" id="homeLoaderBar">
          <div class="home-loader__progress-fill" id="homeLoaderFill"></div>
        </div>
      </section>

      <section class="home-loader__preview" aria-hidden="true">
        <div class="home-loader__hero skeleton-shimmer"></div>
        <div class="home-loader__leaders">
          <article class="home-loader__leader-card skeleton-shimmer"></article>
          <article class="home-loader__leader-card skeleton-shimmer"></article>
        </div>
        <div class="home-loader__rows">
          <div class="home-loader__row skeleton-shimmer"></div>
          <div class="home-loader__row skeleton-shimmer"></div>
          <div class="home-loader__row skeleton-shimmer"></div>
          <div class="home-loader__row skeleton-shimmer"></div>
          <div class="home-loader__row skeleton-shimmer"></div>
          <div class="home-loader__row skeleton-shimmer"></div>
        </div>
      </section>

      <p class="home-loader__slow" id="homeLoadingSlow" hidden>Триває синхронізація даних, зачекайте ще кілька секунд</p>
    </section>
  `;
}

function setHomeLoadingLifecycle(root) {
  const loadingRoot = root.querySelector('#homeLoading');
  const contentRoot = root.querySelector('#homeContent');
  const loadingSlow = root.querySelector('#homeLoadingSlow');
  const loaderConsole = root.querySelector('#homeLoaderConsole');
  const progressFill = root.querySelector('#homeLoaderFill');
  const progressBar = root.querySelector('#homeLoaderBar');
  const progressPercent = root.querySelector('#homeLoaderPercent');

  if (!loadingRoot || !contentRoot) {
    return {
      revealContent() {},
      destroy() {}
    };
  }

  const logLines = [
    { status: 'boot', text: '[BOOT] VTCLB ranking node' },
    { status: 'ok', text: '[ OK ] Ініціалізація ядра' },
    { status: 'ok', text: '[ OK ] Підключення сезону Весна 2026' },
    { status: 'load', text: '[ ... ] Завантаження дорослої ліги' },
    { status: 'load', text: '[ ... ] Завантаження дитячої ліги' },
    { status: 'wait', text: '[ WAIT ] Синхронізація таблиці лідерів' },
    { status: 'load', text: '[ ... ] Формування статистики' },
    { status: 'ok', text: '[ OK ] Підготовка інтерфейсу' }
  ];

  contentRoot.classList.add('home-content--hidden');

  let nextLine = 0;
  let progressValue = 8;
  const timerIds = [];
  let progressIntervalId = null;

  const pushLogLine = () => {
    if (!loaderConsole || nextLine >= logLines.length) return;
    const { status, text } = logLines[nextLine++];
    const line = document.createElement('p');
    line.className = `home-loader__line home-loader__line--${status === 'boot' ? 'load' : status}`;
    line.textContent = text;
    loaderConsole.append(line);
    loaderConsole.scrollTop = loaderConsole.scrollHeight;

    if (!loaderConsole.querySelector('.home-loader__cursor')) {
      const cursor = document.createElement('span');
      cursor.className = 'home-loader__cursor';
      cursor.setAttribute('aria-hidden', 'true');
      loaderConsole.append(cursor);
    } else {
      loaderConsole.append(loaderConsole.querySelector('.home-loader__cursor'));
    }
  };

  const setProgress = (nextValue) => {
    progressValue = Math.min(100, Math.max(progressValue, nextValue));
    if (progressFill) {
      progressFill.style.width = `${progressValue}%`;
    }
    if (progressPercent) {
      progressPercent.textContent = `${String(progressValue).padStart(2, '0')}%`;
    }
    if (progressBar) {
      progressBar.setAttribute('aria-valuenow', String(progressValue));
    }
  };

  pushLogLine();

  timerIds.push(window.setTimeout(() => {
    const stageInterval = window.setInterval(() => {
      pushLogLine();
      setProgress(progressValue + 7);
      if (nextLine >= logLines.length) {
        window.clearInterval(stageInterval);
      }
    }, 420);
    timerIds.push(stageInterval);
  }, 450));

  progressIntervalId = window.setInterval(() => {
    if (progressValue < 92) {
      setProgress(progressValue + 2);
    }
  }, 700);

  const delayedSlowTimer = window.setTimeout(() => {
    if (loadingSlow) loadingSlow.hidden = false;
  }, 6800);

  const destroy = () => {
    timerIds.forEach((timerId) => window.clearTimeout(timerId));
    window.clearTimeout(delayedSlowTimer);
    if (progressIntervalId) {
      window.clearInterval(progressIntervalId);
      progressIntervalId = null;
    }
  };

  const revealContent = () => {
    destroy();
    setProgress(100);
    if (nextLine < logLines.length) {
      pushLogLine();
    }
    if (loaderConsole) {
      const readyLine = document.createElement('p');
      readyLine.className = 'home-loader__line home-loader__line--ok';
      readyLine.textContent = '[READY] Система готова';
      loaderConsole.append(readyLine);
    }
    contentRoot.classList.remove('home-content--hidden');
    loadingRoot.classList.add('is-complete');
    loadingRoot.setAttribute('aria-busy', 'false');
    window.setTimeout(() => loadingRoot.remove(), 260);
  };

  return { revealContent, destroy };
}

export async function initHomePage() {
  const root = document.getElementById('homeRoot') || document.getElementById('view');
  if (!root) return;
  await initPage(root);
}

export async function initPage(root) {
  if (!root) return;
  console.log('[home] init called');
  try {
    await safeInitHomePage(root);
  } catch (err) {
    console.error('[home] fatal crash:', err);
    root.innerHTML = `
      <div style="padding:20px;color:#fff">
        ❌ Помилка завантаження сторінки
      </div>
    `;
  }
}

async function safeInitHomePage(root) {
  root.classList.add('home-v2');
  root.innerHTML = `${renderHomeLoadingSkeleton()}
    <div class="home-content" id="homeContent">
      <section class="hero home-hero"><span class="hero__kicker">ВАРТА КЛУБ</span><h1 class="hero__title">ЛАЗЕРТАГ РЕЙТИНГ</h1><p class="home-current-season">Весняний сезон 2026 року</p><p class="px-card__text" id="stateBox" aria-live="polite" hidden></p></section>
      <div class="px-divider"></div>
      <section class="section" id="leadersNowMount"></section>
      <section class="section" id="homeDataStatusMount"></section>
      <section class="section" id="homeTournamentsMount"></section>
      <section class="section" id="leagueSections"></section>
    </div>`;

  const lifecycle = setHomeLoadingLifecycle(root);
  const stateBox = document.getElementById('stateBox');
  const leadersNowMount = document.getElementById('leadersNowMount');
  const homeDataStatusMount = document.getElementById('homeDataStatusMount');
  const homeTournamentsMount = document.getElementById('homeTournamentsMount');
  const leagueSections = document.getElementById('leagueSections');
  if (!stateBox || !leadersNowMount || !homeDataStatusMount || !leagueSections || !homeTournamentsMount) {
    lifecycle.destroy();
    lifecycle.revealContent();
    return;
  }

  const renderEmptyState = () => {
    stateBox.hidden = false;
    stateBox.textContent = 'Дані тимчасово недоступні';
    leadersNowMount.innerHTML = renderLeadersNow(null, null);
    homeDataStatusMount.innerHTML = renderDataStatusLine(makeDataStatus({ source: 'unknown', ok: false, message: 'Data unavailable' }));
    homeTournamentsMount.innerHTML = renderHomeTournamentsCard([], 'error');
    leagueSections.innerHTML = '';
  };

  const renderHome = async () => {
    const [adultResult, kidsResult] = await Promise.allSettled([
      getCurrentLeagueLiveStats('sundaygames'),
      getCurrentLeagueLiveStats('kids')
    ]);

    const adultsLive = adultResult.status === 'fulfilled' ? adultResult.value : null;
    const kidsLive = kidsResult.status === 'fulfilled' ? kidsResult.value : null;

    if (adultResult.status === 'rejected') {
      console.warn('[home] adult failed', adultResult.reason);
    }
    if (kidsResult.status === 'rejected') {
      console.warn('[home] kids failed', kidsResult.reason);
    }

    console.log('[home] data loaded', { adultsLive, kidsLive });
    if (!adultsLive && !kidsLive) {
      console.warn('[home] no data, rendering empty state');
      renderEmptyState();
      return;
    }

    const pickSeasonActive = (livePlayers = []) => (livePlayers || []).filter((player) => isCurrentSeasonActive(player)).sort(byPointsDesc);
    const adultsPlayers = pickSeasonActive(adultsLive?.players || []);
    const kidsPlayers = pickSeasonActive(kidsLive?.players || []);
    const homeStatus = pickHomeStatus(adultsLive?.dataStatus, kidsLive?.dataStatus);

    leadersNowMount.innerHTML = renderLeadersNow(adultsPlayers[0] || null, kidsPlayers[0] || null);
    homeDataStatusMount.innerHTML = renderDataStatusLine(homeStatus);
    homeTournamentsMount.innerHTML = renderHomeTournamentsCard([], 'loading');
    fetchHomeTournaments()
      .then((items) => {
        homeTournamentsMount.innerHTML = renderHomeTournamentsCard(items, 'empty');
      })
      .catch((error) => {
        console.warn('[home] tournaments unavailable', error);
        homeTournamentsMount.innerHTML = renderHomeTournamentsCard([], 'error');
      });

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
    homeDataStatusMount.innerHTML = renderDataStatusLine(makeDataStatus({ source: 'unknown', ok: false, message: 'Data unavailable' }));
    leagueSections.innerHTML = '';
  } finally {
    lifecycle.revealContent();
  }
}
