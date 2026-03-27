import { ensureGlobalStyles } from '../pages/global-styles.js';
import { normalizeLeague } from './naming.js';

const templateCache = new Map();
const knownRoutes = new Set(['main', 'seasons', 'season', 'league-stats', 'player', 'rules']);

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

  if (/season\.html$|pages\/season\.html$/.test(pathOnly)) {
    return buildHash('season', { season: qp.get('season') || '', league: qp.get('league') || '' });
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
  const view = getView();
  if (!view) throw new Error('View container is missing');

  view.replaceChildren();
  const source = doc.querySelector('main') || doc.body;
  view.innerHTML = source ? source.innerHTML : '';
  rewriteLinks(view);
}

function renderShell() {
  let app = document.getElementById('app');
  if (!app) {
    app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);
  }
  app.innerHTML = '<header class="topbar"></header><main class="page"><div class="container section" id="view"></div></main>';
  ensureGlobalStyles();
}

function routeErrorCard(message) {
  const view = getView();
  if (!view) return;
  view.innerHTML = `<section class="px-card px-card--accent"><h1 class="px-card__title">Помилка маршруту</h1><p class="px-card__text">${message}</p><div class="px-card__actions"><a class="btn" href="#main">Повернутися на головну</a></div></section>`;
}

async function renderRoute() {
  renderShell();
  const { route, queryParams } = parseHashRoute();

  if (!location.hash || String(location.hash || '').replace(/^#/, '').split('?')[0].replace(/^\/+/, '').toLowerCase() !== route) {
    location.replace(buildHash(route, queryParams));
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
    const { initSeasonPage } = await import('../pages/season.js');
    await initSeasonPage({ season: queryParams.season, league: queryParams.league });
    return;
  }

  if (route === 'league-stats') {
    await mountTemplate('./pages/league.html');
    const { initLeagueStatsPage } = await import('../pages/league-stats.js');
    await initLeagueStatsPage({ league: queryParams.league });
    return;
  }

  if (route === 'player') {
    const league = normalizeLeague(queryParams.league) || 'kids';
    const nick = String(queryParams.nick || '').trim();
    const view = getView();
    if (view) {
      view.innerHTML = `<section class="px-card"><h1 class="px-card__title">Профіль гравця</h1><p class="px-card__text">Сторінка профілю гравця в розробці.</p><p class="px-card__text"><strong>Ліга:</strong> ${league}</p><p class="px-card__text"><strong>Нік:</strong> ${nick || '—'}</p><div class="px-card__actions"><a class="btn btn--secondary" href="${buildHash('league-stats', { league })}">Повернутися до ліги</a></div></section>`;
    }
    return;
  }

  const { initRulesPage } = await import('../pages/rules.js');
  await initRulesPage();
}

window.addEventListener('hashchange', () => {
  renderRoute().catch((error) => routeErrorCard(error?.message || 'Невідома помилка маршруту'));
});

renderRoute().catch((error) => {
  renderShell();
  routeErrorCard(error?.message || 'Невідома помилка маршруту');
});
