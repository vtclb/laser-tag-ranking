import { ensureGlobalStyles } from '../pages/global-styles.js?v=20260715-table1';
import { debugInfo, debugLog } from './debug.js';
import { normalizeLeague } from './naming.js';

const templateCache = new Map();
const TEMPLATE_TIMEOUT_MS = 10_000;
let routeRenderSequence = 0;
const knownRoutes = new Set(['main', 'seasons', 'season', 'league-stats', 'player', 'gameday', 'rules', 'tournaments']);
const routeTitles = {
  main: 'Головна',
  seasons: 'Архів сезонів',
  season: 'Статистика сезону',
  'league-stats': 'Статистика ліги',
  player: 'Профіль гравця',
  gameday: 'Ігровий день',
  rules: 'Правила',
  tournaments: 'Турніри'
};

function updateRouteContext(route, queryParams = {}) {
  const baseTitle = routeTitles[route] || 'Лазертаг рейтинг';
  const pageTitle = route === 'player' && queryParams.nick
    ? `${queryParams.nick} | ${baseTitle}`
    : baseTitle;
  document.title = `${pageTitle} | Варта`;

  const routeStatus = document.getElementById('routeStatus');
  if (routeStatus) routeStatus.textContent = `Відкрито: ${pageTitle}`;
}

function getView() {
  return document.getElementById('view');
}

function buildHash(route = 'main', params = {}) {
  const normalizedRoute = String(route || 'main').trim().replace(/^#+/, '').replace(/^\/+/, '').toLowerCase();
  const finalRoute = knownRoutes.has(normalizedRoute) ? normalizedRoute : 'main';
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const qs = query.toString();
  return `#${finalRoute}${qs ? `?${qs}` : ''}`;
}

function parseHashRoute() {
  const rawHash = String(location.hash || '').replace(/^#/, '').trim();
  if (!rawHash) return { route: 'main', queryParams: {} };
  const [routePart, qs = ''] = rawHash.split('?');
  const route = String(routePart || '').replace(/^\/+/, '').toLowerCase();
  const queryParams = Object.fromEntries(new URLSearchParams(qs).entries());
  if (!knownRoutes.has(route)) return { route: 'main', queryParams: {} };
  return { route, queryParams };
}

function toHashFromHref(href = '') {
  const raw = String(href || '').trim();
  if (!raw) return '';

  if (raw.startsWith('#')) {
    const hash = raw.slice(1);
    const [route, qs = ''] = hash.split('?');
    const cleanRoute = route.replace(/^\/+/, '').toLowerCase();
    if (!knownRoutes.has(cleanRoute)) return buildHash('main');
    return `#${cleanRoute}${qs ? `?${qs}` : ''}`;
  }

  const lower = raw.toLowerCase();
  const [pathOnly, queryString = ''] = lower.split('?');
  const qp = new URLSearchParams(queryString);

  if (/index\.html$|pages\/index\.html$/.test(pathOnly)) return buildHash('main');
  if (/seasons\.html$|pages\/seasons\.html$/.test(pathOnly)) return buildHash('seasons');
  if (/rules\.html$|pages\/rules\.html$/.test(pathOnly)) return buildHash('rules');
  if (/tournaments\.html$|pages\/tournaments\.html$/.test(pathOnly)) return buildHash('tournaments');

  if (/season\.html$|pages\/season\.html$/.test(pathOnly)) {
    return buildHash('season', { season: qp.get('season') || '', league: qp.get('league') || '' });
  }

  if (/gameday\.html$|pages\/gameday\.html$/.test(pathOnly)) {
    const league = normalizeLeague(qp.get('league') || qp.get('lg')) || 'sundaygames';
    const date = qp.get('date') || '';
    return buildHash('gameday', { league, date });
  }

  if (/profile\.html$|player\.html$|pages\/profile\.html$/.test(pathOnly)) {
    const league = normalizeLeague(qp.get('league') || qp.get('lg')) || 'kids';
    const nick = qp.get('nick') || '';
    return buildHash('player', { league, nick });
  }

  if (/league\.html$|league-stats\.html$|balance2\.html$|pages\/league\.html$/.test(pathOnly)) {
    const league = normalizeLeague(qp.get('league') || qp.get('lg')) || 'kids';
    return buildHash('league-stats', { league });
  }

  return '';
}

function rewriteLinks(scope = document) {
  scope.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const nextHref = toHashFromHref(href);
    if (nextHref) link.setAttribute('href', nextHref);
  });
}

async function fetchTemplate(path) {
  if (!templateCache.has(path)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TEMPLATE_TIMEOUT_MS);
    const request = fetch(path, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Template load failed: ${path}`);
        return response.text();
      })
      .catch((error) => {
        templateCache.delete(path);
        if (error?.name === 'AbortError') throw new Error(`Template load timeout: ${path}`);
        throw error;
      })
      .finally(() => clearTimeout(timer));
    templateCache.set(path, request);
  }
  return templateCache.get(path);
}

function isCurrentRouteRender(renderId) {
  return renderId === routeRenderSequence;
}

async function mountTemplate(path, renderId) {
  const html = await fetchTemplate(path);
  if (!isCurrentRouteRender(renderId)) return false;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const view = getView();
  if (!view) throw new Error('View container is missing');

  view.replaceChildren();
  const source = doc.querySelector('main') || doc.body;
  view.innerHTML = source ? source.innerHTML : '';
  rewriteLinks(view);
  return true;
}

function ensureShell() {
  let app = document.getElementById('app');
  if (!app) {
    app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);
  }

  let header = app.querySelector('header.topbar, header.topnav');
  if (!header) {
    header = document.createElement('header');
    header.className = 'topbar';
    app.appendChild(header);
  }

  let page = app.querySelector('main.page');
  if (!page) {
    page = document.createElement('main');
    page.className = 'page';
    app.appendChild(page);
  }

  let container = page.querySelector('.container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'container section';
    page.appendChild(container);
  }

  let view = page.querySelector('#view');
  if (!view) {
    view = document.createElement('div');
    view.id = 'view';
    container.appendChild(view);
  }
  view.tabIndex = -1;

  ensureGlobalStyles();
}

function animateRouteView() {
  const view = getView();
  if (!view) return;
  view.classList.remove('route-enter-active');
  view.classList.add('route-enter');
  requestAnimationFrame(() => {
    view.classList.add('route-enter-active');
  });
}

function focusRouteContent({ onlyWhenIdle = false } = {}) {
  const view = getView();
  if (!view) return;
  const active = document.activeElement;
  if (onlyWhenIdle && active
    && active !== document.body
    && active !== document.documentElement
    && active !== view
    && active.dataset?.routeFocusTarget !== '1') return;
  const heading = view.querySelector('h1');
  const target = heading instanceof HTMLElement ? heading : view;
  if (target !== view && !target.hasAttribute('tabindex')) {
    target.tabIndex = -1;
    target.dataset.routeFocusTarget = '1';
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  target.focus({ preventScroll: true });
}

function stabilizeRouteFocus(renderId) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (isCurrentRouteRender(renderId)) focusRouteContent({ onlyWhenIdle: true });
    });
  });
}

function routeErrorCard(message) {
  const view = getView();
  if (!view) return;
  view.innerHTML = `<section class="px-card px-card--accent"><h1 class="px-card__title">Помилка маршруту</h1><p class="px-card__text">${message}</p><div class="px-card__actions"><a class="btn" href="#main">Повернутися на головну</a></div></section>`;
}

function routeInitErrorCard(route, message) {
  const view = getView();
  if (!view) return;
  view.innerHTML = `<section class="px-card px-card--accent"><h1 class="px-card__title">Сторінка тимчасово недоступна</h1><p class="px-card__text">[${route}] ${message}</p><div class="px-card__actions"><a class="btn" href="#main">Повернутися на головну</a></div></section>`;
}

async function runPageInit(route, initFn, params = {}, renderId) {
  if (!isCurrentRouteRender(renderId)) return;
  debugLog('[router] loading route:', route);
  if (typeof initFn !== 'function') {
    console.error('INIT FUNCTION NOT FOUND');
    if (isCurrentRouteRender(renderId)) routeInitErrorCard(route, 'INIT FUNCTION NOT FOUND');
    return;
  }
  try {
    debugInfo('[router] init:start', { route, params });
    await initFn(params);
    if (isCurrentRouteRender(renderId)) debugInfo('[router] init:ok', { route });
  } catch (error) {
    if (!isCurrentRouteRender(renderId)) return;
    console.error('[router] init:fail', { route, error });
    routeInitErrorCard(route, error?.message || 'Помилка ініціалізації сторінки');
  }
}

async function renderRoute() {
  const renderId = ++routeRenderSequence;
  const startedAt = performance.now();
  ensureShell();
  const { route, queryParams } = parseHashRoute();
  updateRouteContext(route, queryParams);
  debugInfo('[router] render:start', { hash: location.hash, route, queryParams });

  try {
    if (!location.hash || String(location.hash || '').replace(/^#/, '').split('?')[0].replace(/^\/+/, '').toLowerCase() !== route) {
      location.replace(buildHash(route, queryParams));
      return;
    }

    if (route === 'main') {
      if (!await mountTemplate('./pages/index.html', renderId)) return;
      const { initHomePage } = await import('../pages/home.js?v=20260715-clean5');
      await runPageInit(route, initHomePage, {}, renderId);
      return;
    }

    if (route === 'seasons') {
      if (!await mountTemplate('./pages/seasons.html', renderId)) return;
      const { initSeasonsPage } = await import('../pages/seasons.js?v=20260715-clean5');
      await runPageInit(route, initSeasonsPage, {}, renderId);
      return;
    }

    if (route === 'season') {
      if (!await mountTemplate('./pages/season.html', renderId)) return;
      const { initSeasonPage } = await import('../pages/season.js?v=20260715-clean5');
      await runPageInit(route, initSeasonPage, { season: queryParams.season, league: queryParams.league }, renderId);
      return;
    }

    if (route === 'league-stats') {
      if (!await mountTemplate('./pages/league.html?v=20260715-table1', renderId)) return;
      const { initLeagueStatsPage } = await import('../pages/league-stats.js?v=20260715-table1');
      await runPageInit(route, initLeagueStatsPage, { league: queryParams.league }, renderId);
      return;
    }

    if (route === 'gameday') {
      if (!await mountTemplate('./pages/gameday.html', renderId)) return;
      const { initGameDayPage } = await import('../pages/gameday.js?v=20260715-clean5');
      await runPageInit(route, initGameDayPage, { league: queryParams.league, date: queryParams.date }, renderId);
      return;
    }

    if (route === 'player') {
      if (!await mountTemplate('./pages/profile.html', renderId)) return;
      const { initProfilePage } = await import('../pages/profile.js?v=20260715-clean5');
      await runPageInit(route, initProfilePage, { league: queryParams.league, nick: queryParams.nick }, renderId);
      return;
    }

    if (route === 'rules') {
      if (!await mountTemplate('./pages/rules.html', renderId)) return;
      const { initRulesPage } = await import('../pages/rules.js?v=20260714-archive2');
      await runPageInit(route, initRulesPage, {}, renderId);
      return;
    }

    if (route === 'tournaments') {
      if (!await mountTemplate('./pages/tournaments.html', renderId)) return;
      const { initTournamentsPage } = await import('../pages/tournaments.js?v=20260715-clean5');
      await runPageInit(route, initTournamentsPage, {
        selected: queryParams.selected || queryParams.id || ''
      }, renderId);
      return;
    }

    location.replace(buildHash('main'));
  } catch (error) {
    if (!isCurrentRouteRender(renderId)) return;
    throw error;
  } finally {
    if (isCurrentRouteRender(renderId)) {
      debugInfo('[router] render:end', { route, durationMs: Math.round(performance.now() - startedAt) });
      animateRouteView();
      focusRouteContent();
      stabilizeRouteFocus(renderId);
      window.dispatchEvent(new CustomEvent('v2:route-rendered', { detail: { route } }));
    }
  }
}

window.addEventListener('hashchange', () => {
  renderRoute().catch((error) => routeErrorCard(error?.message || 'Невідома помилка маршруту'));
});

renderRoute().catch((error) => {
  ensureShell();
  routeErrorCard(error?.message || 'Невідома помилка маршруту');
});
