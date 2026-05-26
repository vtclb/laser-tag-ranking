import { getCurrentLeagueLiveStats, rankFromPoints, safeErrorMessage } from '../core/dataHub.js';
import { debugLog, debugWarn } from '../core/debug.js';
import { leagueLabelUA } from '../core/naming.js';
import { loadTournamentsList, getTournamentFormatLabel, formatTournamentDate } from './tournaments.js';
import { makeDataStatus, resolveDataStatusTone } from '../core/dataStatus.js';

const HOME_LEAGUES = ['sundaygames', 'kids'];
const STATS_LINKS = {
  sundaygames: '#league-stats?league=sundaygames',
  kids: '#league-stats?league=kids'
};
const FALLBACK_AVATAR = './assets/default-avatar.svg';

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

function avatarFallbackAttr() {
  return `onerror="this.onerror=null;this.src='${FALLBACK_AVATAR}';"`;
}

function playerProfileHref(league, nickname) {
  const safeLeague = String(league || '').trim();
  const safeNickname = String(nickname || '').trim();
  if (!safeLeague || !safeNickname) return '';
  return `#player?league=${encodeURIComponent(safeLeague)}&nick=${encodeURIComponent(safeNickname)}`;
}

function currentRankingCard(players = [], league = '') {
  const rows = (players || []).slice(0, 10).map((player, index) => {
    const rawNickname = String(player?.nickname || '').trim();
    const avatarUrl = esc(player?.avatarUrl || player?.avatar || FALLBACK_AVATAR);
    const nickname = esc(rawNickname || `Гравець ${index + 1}`);
    const points = Number(player?.points || 0);
    const rank = esc(player?.rankLetter || rankFromPoints(points) || 'E');
    const rankKey = rankKeyFromPlayer(player);
    const topClass = index < 3 ? ` home-ranking__row--top-${index + 1}` : '';
    const href = playerProfileHref(league, rawNickname);
    const content = `
      <span class="home-ranking__place">#${index + 1}</span>
      <span class="home-ranking__rank rank-${rankKey}">${rank}</span>
      <span class="home-ranking__identity">
        <span class="home-ranking__avatar-wrap rank-${rankKey}"><img class="home-ranking__avatar" src="${avatarUrl}" alt="${nickname || 'Аватар гравця'}" loading="lazy" ${avatarFallbackAttr()} /></span>
        <span class="home-ranking__name">${nickname}</span>
      </span>
      <span class="home-ranking__points"><strong>${points}</strong><small>очки</small></span>`;
    return href
      ? `<li class="home-ranking__row rank-${rankKey}${topClass}"><a class="home-ranking__link" href="${href}">${content}</a></li>`
      : `<li class="home-ranking__row rank-${rankKey}${topClass}">${content}</li>`;
  }).join('');

  if (!rows) {
    return '<p class="px-card__text">Немає активних гравців</p>';
  }

  return `<ol class="home-ranking">${rows}</ol>`;
}

function renderLeadersNowCard({ leader, league, leagueLabel, variant = 'secondary' }) {
  const hasLeader = Boolean(leader);
  const leagueType = variant === 'primary' ? 'adult' : 'kids';
  const rawNickname = String(leader?.nickname || '').trim();
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

  const href = hasLeader ? playerProfileHref(league, rawNickname) : '';
  const tagName = href ? 'a' : 'article';
  const hrefAttr = href ? ` href="${href}"` : '';

  return `
    <${tagName} class="home-leader-v3 home-leader-v3--${leagueType}"${hrefAttr}>
      <div class="home-leader-v3__league">${escapeHtml(leagueLabel)}</div>
      <div class="home-leader-v3__body">
        <img class="home-leader-v3__avatar" src="${avatarUrl}" alt="${nickname || 'Аватар гравця'}" loading="lazy" ${avatarFallbackAttr()} />
        <div class="home-leader-v3__info">
          <div class="home-leader-v3__nameRow">
            <span class="home-leader-v3__name">${nickname}</span>
            <span class="home-leader-v3__rank rank-${rankKey}">${rank}</span>
          </div>
          <div class="home-leader-v3__meta">${matches} ігор · ${winRate} · ${mvpTotal} MVP</div>
        </div>
        <div class="home-leader-v3__score">
          <strong>${points}</strong>
          <span>очок</span>
        </div>
      </div>
    </${tagName}>
  `;
}

function renderLeadersNow(adultLeader, kidsLeader) {
  const leaders = [
    { leader: adultLeader, league: 'sundaygames', leagueLabel: 'Доросла ліга' },
    { leader: kidsLeader, league: 'kids', leagueLabel: 'Дитяча ліга' }
  ];

  return `
    <section class="home-leaders-v3">
      <div class="home-leaders-v3__title">Лідери сезону</div>
      <div class="home-leaders-v3__grid">
        ${renderLeadersNowCard({ ...leaders[0], variant: 'primary' })}
        ${renderLeadersNowCard({ ...leaders[1], variant: 'secondary' })}
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
  const tone = resolveDataStatusTone(safeStatus);
  return `<p class="data-status-line ${tone.className}">${esc(tone.label)}</p>`;
}

function countActivePlayers(live) {
  if (Array.isArray(live?.activePlayers)) return live.activePlayers.length;
  return (live?.players || []).filter((player) => isCurrentSeasonActive(player)).length;
}

function pickLatestGameDay(adultsLive, kidsLive) {
  const dates = [adultsLive?.lastGameDay?.date, kidsLive?.lastGameDay?.date]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));
  return dates[0] || '';
}

function pickLatestGameDaySummary(adultsLive, kidsLive) {
  const items = [
    { league: 'sundaygames', label: 'Доросла ліга', day: adultsLive?.lastGameDay },
    { league: 'kids', label: 'Дитяча ліга', day: kidsLive?.lastGameDay }
  ]
    .map((item) => ({
      ...item,
      date: String(item.day?.date || '').trim(),
      matchesCount: Number(item.day?.matchesCount || 0),
      battlesCount: Number(item.day?.battlesCount || 0),
      mvp: String(item.day?.mvp || '').trim()
    }))
    .filter((item) => item.date)
    .sort((a, b) => b.date.localeCompare(a.date));
  return items[0] || null;
}

function pickSeasonMovement(adultsLive, kidsLive) {
  const progressItems = [adultsLive?.progress, kidsLive?.progress].filter(Boolean);
  const mostMvp = progressItems
    .map((progress) => progress.mostMvp)
    .filter(Boolean)
    .sort((a, b) => Number(b?.mvpTotal ?? b?.mvp ?? 0) - Number(a?.mvpTotal ?? a?.mvp ?? 0))[0];
  if (mostMvp) {
    const nick = mostMvp.nickname || mostMvp.nick || 'Гравець';
    const count = Number(mostMvp.mvpTotal ?? mostMvp.mvp ?? 0);
    return count ? `${nick} · ${count} MVP` : `${nick} · MVP`;
  }

  const bestGrowth = progressItems
    .map((progress) => progress.bestGrowth)
    .filter(Boolean)
    .sort((a, b) => Number(b?.delta || 0) - Number(a?.delta || 0))[0];
  if (bestGrowth) {
    const nick = bestGrowth.nickname || bestGrowth.nick || 'Гравець';
    const delta = Number(bestGrowth.delta || 0);
    return `${nick} · ${delta >= 0 ? '+' : ''}${delta}`;
  }

  return 'Дані накопичуються';
}

function renderSeasonPulse(adultsLive, kidsLive) {
  const activePlayersCount = countActivePlayers(adultsLive) + countActivePlayers(kidsLive);
  const matchesCount = Number(adultsLive?.summary?.matchesCount || 0) + Number(kidsLive?.summary?.matchesCount || 0);
  const latestGameDay = pickLatestGameDay(adultsLive, kidsLive);
  const movement = pickSeasonMovement(adultsLive, kidsLive);

  return `<section class="home-season-pulse" aria-label="Живий сезон">
    <div class="home-season-pulse__head">
      <h2 class="home-season-pulse__title">Живий сезон</h2>
      <p class="home-season-pulse__subtitle">Короткий стан рейтингу на зараз</p>
    </div>
    <div class="home-season-pulse__grid">
      <article class="home-season-pulse__card home-season-pulse__card--positive">
        <span class="home-season-pulse__label">Активні гравці</span>
        <strong class="home-season-pulse__value">${activePlayersCount}</strong>
        <span class="home-season-pulse__meta">доросла + дитяча ліги</span>
      </article>
      <article class="home-season-pulse__card home-season-pulse__card--neutral">
        <span class="home-season-pulse__label">Матчі сезону</span>
        <strong class="home-season-pulse__value">${matchesCount}</strong>
        <span class="home-season-pulse__meta">за live-даними</span>
      </article>
      <article class="home-season-pulse__card home-season-pulse__card--highlight">
        <span class="home-season-pulse__label">Останній ігровий день</span>
        <strong class="home-season-pulse__value">${esc(latestGameDay || 'Ще немає даних')}</strong>
        <span class="home-season-pulse__meta">найновіший день у лігах</span>
      </article>
      <article class="home-season-pulse__card home-season-pulse__card--neutral">
        <span class="home-season-pulse__label">Рух сезону</span>
        <strong class="home-season-pulse__value">${esc(movement)}</strong>
        <span class="home-season-pulse__meta">MVP або приріст</span>
      </article>
    </div>
  </section>`;
}

function renderGameDayTeaser(adultsLive, kidsLive) {
  const latest = pickLatestGameDaySummary(adultsLive, kidsLive);
  const href = latest
    ? `#gameday?league=${encodeURIComponent(latest.league)}&date=${encodeURIComponent(latest.date)}`
    : '#gameday?league=sundaygames';
  const matchesLabel = latest
    ? `${latest.matchesCount || 0} матчів${latest.battlesCount ? ` · ${latest.battlesCount} боїв` : ''}`
    : 'Ігрові дні ще накопичуються';
  const mvpLabel = latest?.mvp ? `MVP дня: ${latest.mvp}` : 'Переглянь результати та MVP';

  return `<section class="home-gameday-teaser" aria-label="Останній ігровий день">
    <div class="home-gameday-teaser__content">
      <div>
        <p class="home-gameday-teaser__kicker">Останній ігровий день</p>
        <h2 class="home-gameday-teaser__title">${esc(latest?.date || 'Ігрові дні ще накопичуються')}</h2>
      </div>
      <div class="home-gameday-teaser__meta">
        <span>${esc(latest?.label || 'Сезон триває')}</span>
        <span>${esc(matchesLabel)}</span>
        <span>${esc(mvpLabel)}</span>
      </div>
    </div>
    <a class="home-gameday-teaser__cta" href="${href}">До ігор</a>
  </section>`;
}

function renderLeagueSection({ league, players }) {
  const statsLink = STATS_LINKS[league] || '#league-stats';
  return `<section class="px-card home-card home-league home-leaders" data-league="${league}">
    <div class="home-league__head"><h3 class="home-league__title">${esc(leagueLabelUA(league))} — top 10</h3></div>
    <article class="home-panel home-section-panel">${currentRankingCard(players, league)}</article>
    <div class="home-cta-row"><a class="btn btn--secondary" href="${statsLink}">Детальна статистика</a></div>
  </section>`;
}

function formatHomeTournamentMeta(item = {}) {
  const format = escapeHtml(getTournamentFormatLabel(item) || 'Турнір');
  const rawStatus = String(item?.status || '').trim();
  const status = escapeHtml(rawStatus ? rawStatus : 'Планується');
  const date = escapeHtml(formatTournamentDate(item?.dateStart));
  return `${format} · ${status} · ${date}`;
}

function renderHomeTournamentsCard(items = [], status = 'empty') {
  const hasItems = Array.isArray(items) && items.length > 0;
  const visibleItems = hasItems ? items.slice(0, 2) : [];
  const list = visibleItems.map((item) => (
    `<a class="home-tournaments-teaser__row" href="${item?.tournamentId ? `#tournaments?selected=${encodeURIComponent(item.tournamentId)}` : '#tournaments'}">
      <div class="home-tournaments-teaser__left">
        <strong>${escapeHtml(item?.name || item?.tournamentId || 'Турнір')}</strong>
        <span class="home-tournaments-teaser__meta">${formatHomeTournamentMeta(item)}</span>
        <span class="home-tournaments-teaser__stats">${Number(item?.teamsCount || 0)} команд · ${Number(item?.gamesCount || 0)} матчів</span>
      </div>
      <span class="home-tournaments-teaser__open">Відкрити</span>
    </a>`
  )).join('');

  if (status === 'error') {
    debugWarn('[home] tournaments unavailable, using neutral fallback');
  }

  return `<section class="home-tournaments-teaser">
    <div class="home-tournaments-teaser__header">
      <div class="home-tournaments-teaser__titleBlock">
        <p class="home-tournaments-teaser__kicker">ТУРНІРНИЙ РЕЖИМ</p>
        <h2>Активні турніри</h2>
      </div>
    </div>
    <div class="home-tournaments-teaser__content">
      ${hasItems ? list : `<div class="home-tournaments-teaser__empty">
        <strong>Поки немає активних турнірів</strong>
        <p>Коли турнір стартує, тут з’явиться швидкий доступ до таблиці та матчів.</p>
      </div>`}
    </div>
    <a href="#tournaments" class="home-tournaments-teaser__cta">Відкрити турнір</a>
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
  debugLog('[home] init called');
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
      <section class="section" id="homeDataStatusMount"></section>
      <section class="section" id="leadersNowMount"></section>
      <section class="section" id="leagueSections"></section>
      <section class="section home-dashboard-level home-dashboard-level--tertiary" id="homeSeasonPulseMount"></section>
      <section class="home-dashboard-level home-dashboard-level--secondary" aria-label="Додаткові блоки">
        <div id="homeGameDayMount"></div>
        <div id="homeTournamentsMount"></div>
      </section>
    </div>`;

  const lifecycle = setHomeLoadingLifecycle(root);
  const stateBox = document.getElementById('stateBox');
  const leadersNowMount = document.getElementById('leadersNowMount');
  const homeDataStatusMount = document.getElementById('homeDataStatusMount');
  const homeSeasonPulseMount = document.getElementById('homeSeasonPulseMount');
  const homeGameDayMount = document.getElementById('homeGameDayMount');
  const homeTournamentsMount = document.getElementById('homeTournamentsMount');
  const leagueSections = document.getElementById('leagueSections');
  if (!stateBox || !leadersNowMount || !homeDataStatusMount || !homeSeasonPulseMount || !homeGameDayMount || !leagueSections || !homeTournamentsMount) {
    lifecycle.destroy();
    lifecycle.revealContent();
    return;
  }

  const renderEmptyState = () => {
    stateBox.hidden = false;
    stateBox.textContent = 'Дані тимчасово недоступні';
    leadersNowMount.innerHTML = renderLeadersNow(null, null);
    homeDataStatusMount.innerHTML = renderDataStatusLine(makeDataStatus({ source: 'unknown', ok: false, message: 'Data unavailable' }));
    homeSeasonPulseMount.innerHTML = renderSeasonPulse(null, null);
    homeGameDayMount.innerHTML = renderGameDayTeaser(null, null);
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
      debugWarn('[home] adult failed', adultResult.reason);
    }
    if (kidsResult.status === 'rejected') {
      debugWarn('[home] kids failed', kidsResult.reason);
    }

    debugLog('[home] data loaded', { adultsLive, kidsLive });
    if (!adultsLive && !kidsLive) {
      debugWarn('[home] no data, rendering empty state');
      renderEmptyState();
      return;
    }

    const pickSeasonActive = (livePlayers = []) => (livePlayers || []).filter((player) => isCurrentSeasonActive(player)).sort(byPointsDesc);
    const adultsPlayers = pickSeasonActive(adultsLive?.players || []);
    const kidsPlayers = pickSeasonActive(kidsLive?.players || []);
    const homeStatus = pickHomeStatus(adultsLive?.dataStatus, kidsLive?.dataStatus);

    leadersNowMount.innerHTML = renderLeadersNow(adultsPlayers[0] || null, kidsPlayers[0] || null);
    homeDataStatusMount.innerHTML = renderDataStatusLine(homeStatus);
    homeSeasonPulseMount.innerHTML = renderSeasonPulse(adultsLive, kidsLive);
    homeGameDayMount.innerHTML = renderGameDayTeaser(adultsLive, kidsLive);
    homeTournamentsMount.innerHTML = renderHomeTournamentsCard([], 'loading');
    fetchHomeTournaments()
      .then((items) => {
        homeTournamentsMount.innerHTML = renderHomeTournamentsCard(items, 'empty');
      })
      .catch((error) => {
        debugWarn('[home] tournaments unavailable', error);
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
    homeSeasonPulseMount.innerHTML = renderSeasonPulse(null, null);
    homeGameDayMount.innerHTML = renderGameDayTeaser(null, null);
    leagueSections.innerHTML = '';
  } finally {
    lifecycle.revealContent();
  }
}
