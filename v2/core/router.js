import { ensureGlobalStyles } from '../pages/global-styles.js';
import { normalizeLeague } from './naming.js';

const app = document.getElementById('app');
const templateCache = new Map();
const knownRoutes = new Set(['main', 'seasons', 'season', 'rules', 'league-stats']);

function parseHash() {
  const rawHash = String(location.hash || '').replace(/^#/, '').trim();
  const normalized = rawHash.replace(/^\/+/, '');
  if (!normalized) return { route: 'main', queryParams: {} };

  const [routeRaw, qs = ''] = normalized.split('?');
  const route = (routeRaw || 'main').toLowerCase();
  const queryParams = Object.fromEntries(new URLSearchParams(qs).entries());

  if (!knownRoutes.has(route)) return { route: 'main', queryParams: {} };
  if (route === 'league-stats') return { route: 'season', queryParams };
  return { route, queryParams };
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
  const nodes = doc.body.children.length ? Array.from(doc.body.children) : Array.from(doc.children);
  app.replaceChildren(...nodes.map((node) => node.cloneNode(true)));
}

function routeErrorCard(message) {
  app.innerHTML = `<main class="page"><div class="container section"><section class="px-card px-card--accent"><h1 class="px-card__title">Помилка маршруту</h1><p class="px-card__text">${message}</p><a class="btn" href="#main">На головну</a></section></div></main>`;
}

async function render() {
  const { route, queryParams } = parseHash();
  if (!location.hash || !knownRoutes.has(String(location.hash).replace(/^#/, '').split('?')[0].replace(/^\/+/, ''))) {
    location.replace('#main');
    return;
  }

  if (route === 'main') {
    await mountTemplate('./pages/index.html');
    const { initHomePage } = await import('../pages/home.js');
    await initHomePage();
  } else if (route === 'seasons') {
    await mountTemplate('./pages/seasons.html');
    const { initSeasonsPage } = await import('../pages/seasons.js');
    await initSeasonsPage();
  } else if (route === 'season') {
    await mountTemplate('./pages/season.html');
    await import('../pages/season.js').then(async ({ initSeasonPage }) => {
      await initSeasonPage({ season: queryParams.season, league: normalizeLeague(queryParams.league) });
    });
  } else if (route === 'rules') {
    await mountTemplate('./pages/rules.html');
  }

  ensureGlobalStyles();
}

window.addEventListener('hashchange', () => {
  render().catch((error) => routeErrorCard(error.message));
});

render().catch((error) => routeErrorCard(error.message));
