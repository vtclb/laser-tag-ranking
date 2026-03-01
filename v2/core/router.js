import { ensureGlobalStyles } from '../pages/global-styles.js';
import { normalizeLeague } from './naming.js';

const templateCache = new Map();
const knownRoutes = new Set(['main', 'seasons', 'season', 'rules', 'league-stats']);

function getAppRoot() {
  let root = document.getElementById('app');
  if (!root) {
    root = document.createElement('div');
    root.id = 'app';
    document.body.appendChild(root);
  }
  return root;
}

function buildHash(route = 'main', params = {}) {
  const cleanRoute = String(route || 'main').replace(/^\/+/, '').trim().toLowerCase() || 'main';
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const qs = query.toString();
  return `#${cleanRoute}${qs ? `?${qs}` : ''}`;
}

function parseHashRoute() {
  const rawHash = String(location.hash || '').replace(/^#/, '').trim();
  const normalized = rawHash.replace(/^\/+/, '');
  if (!normalized) return { route: 'main', queryParams: {} };

  const [routeRaw, qs = ''] = normalized.split('?');
  const route = String(routeRaw || 'main').replace(/^\/+/, '').toLowerCase();
  const queryParams = Object.fromEntries(new URLSearchParams(qs).entries());

  if (!knownRoutes.has(route)) return { route: 'main', queryParams: {} };
  return { route, queryParams };
}

function normalizeLegacyHash(hashValue = '') {
  const raw = String(hashValue || '').replace(/^#/, '').trim();
  const normalized = raw.replace(/^\/+/, '').toLowerCase();
  const [route, qs = ''] = normalized.split('?');

  if (route === 'home' || route === 'index') return buildHash('main');
  if (route === 'rules') return buildHash('rules');
  if (route === 'seasons') return buildHash('seasons');
  if (route === 'season') return `#season${qs ? `?${qs}` : ''}`;
  if (route === 'league-stats') return `#league-stats${qs ? `?${qs}` : ''}`;
  return '';
}

function rewriteLinks(scope = document) {
  scope.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (!href) return;

    if (href.startsWith('#')) {
      const rewrittenHash = normalizeLegacyHash(href);
      if (rewrittenHash) link.setAttribute('href', rewrittenHash);
      return;
    }

    if (!/pages\/.+\.html/i.test(href)) return;
    const path = href.split('?')[0].toLowerCase();
    if (path.endsWith('/index.html') || path.endsWith('/pages/index.html')) {
      link.setAttribute('href', buildHash('main'));
    } else if (path.endsWith('/seasons.html') || path.endsWith('/pages/seasons.html')) {
      link.setAttribute('href', buildHash('seasons'));
    } else if (path.endsWith('/rules.html') || path.endsWith('/pages/rules.html')) {
      link.setAttribute('href', buildHash('rules'));
    } else if (path.endsWith('/season.html') || path.endsWith('/pages/season.html')) {
      link.setAttribute('href', buildHash('season'));
    }
  });
}

async function fetchTemplate(path) {
  if (!templateCache.has(path)) {
    templateCache.set(path, fetch(path).then((response) => {
      if (!response.ok) throw new Error(`Template load failed: ${path}`);
      return response.text();
    }));
  }
  return templateCache.get(path);
}

async function mountTemplate(path) {
  const html = await fetchTemplate(path);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const view = document.getElementById('view');
  if (!view) throw new Error('View container is missing');

  const main = doc.querySelector('main');
  if (main) {
    view.innerHTML = main.innerHTML;
  } else {
    view.innerHTML = doc.body?.innerHTML || html;
  }
  rewriteLinks(view);
}

function routeErrorCard(message) {
  const app = getAppRoot();
  app.innerHTML = `<header class="topbar"></header><main class="page"><div class="container section"><section class="px-card px-card--accent"><h1 class="px-card__title">Помилка маршруту</h1><p class="px-card__text">${message}</p><div class="px-card__actions"><a class="btn" href="#main">Повернутися на головну</a></div></section></div></main>`;
  ensureGlobalStyles();
}

async function renderRoute() {
  const app = getAppRoot();
  const { route, queryParams } = parseHashRoute();

  app.innerHTML = '<header class="topbar"></header><main class="page"><div class="container section" id="view"></div></main>';
  ensureGlobalStyles();

  if (!location.hash || !knownRoutes.has(String(location.hash || '').replace(/^#/, '').split('?')[0].replace(/^\/+/, '').toLowerCase())) {
    location.replace(buildHash('main'));
    return;
  }

  if (route === 'main') {
    await mountTemplate('./pages/index.html');
    const { initHomePage } = await import('../pages/home.js');
    await initHomePage();
    return;
  }

  if (route === 'seasons') {
    await mountTemplate('./pages/seasons.html');
    const { initSeasonsPage } = await import('../pages/seasons.js');
    await initSeasonsPage();
    return;
  }

  if (route === 'season') {
    await mountTemplate('./pages/season.html');
    const { initSeasonPage } = await import('../pages/season.js');
    await initSeasonPage({ season: queryParams.season, league: normalizeLeague(queryParams.league) });
    return;
  }

  if (route === 'league-stats') {
    await mountTemplate('./pages/season.html');
    const { initLeagueStatsPage } = await import('../pages/league-stats.js');
    await initLeagueStatsPage({ league: normalizeLeague(queryParams.league) });
    return;
  }

  if (route === 'rules') {
    await mountTemplate('./pages/rules.html');
  }
}

window.addEventListener('hashchange', () => {
  renderRoute().catch((error) => routeErrorCard(error?.message || 'Невідома помилка маршруту'));
});

renderRoute().catch((error) => routeErrorCard(error?.message || 'Невідома помилка маршруту'));
