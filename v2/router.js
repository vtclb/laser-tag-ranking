import { ensureGlobalStyles } from './pages/global-styles.js';

const app = document.getElementById('app');
const templateCache = new Map();
let mountTick = 0;

function parseHashRoute() {
  const raw = location.hash.replace(/^#/, '').trim();
  if (!raw) return { route: 'home', params: new URLSearchParams() };

  const normalized = raw.startsWith('/') ? raw.slice(1) : raw;
  const queryStart = normalized.indexOf('?');

  if (queryStart >= 0) {
    const route = (normalized.slice(0, queryStart) || 'home').toLowerCase();
    return { route, params: new URLSearchParams(normalized.slice(queryStart + 1)) };
  }

  const [route = 'home', ...parts] = normalized.split('&');
  const params = new URLSearchParams();
  for (const part of parts) {
    if (!part) continue;
    const [key, value = ''] = part.split('=');
    params.set(decodeURIComponent(key), decodeURIComponent(value));
  }

  return { route: route.toLowerCase(), params };
}

function buildHash(route, params = {}) {
  const q = new URLSearchParams(params);
  const query = q.toString();
  return `#/${route}${query ? `?${query}` : ''}`;
}

function normalizeHashHref(href) {
  if (!href) return href;
  if (href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return href;

  const [path, queryString = ''] = href.split('?');
  const cleanPath = path.replace(/^\.\//, '').replace(/^\/v2\//, '').toLowerCase();
  const query = new URLSearchParams(queryString);

  if (cleanPath.endsWith('index.html') || cleanPath === '') return '#/home';
  if (cleanPath.endsWith('seasons.html')) return '#/seasons';
  if (cleanPath.endsWith('rules.html')) return '#/rules';
  if (cleanPath.endsWith('league.html') || cleanPath.endsWith('season.html')) {
    const rawLeague = query.get('league') || 'kids';
    const league = rawLeague === 'sundaygames' ? 'olds' : rawLeague;
    const season = query.get('season') || '';
    return buildHash('season', { league, season });
  }
  return href;
}

function rewriteLinks(scope = document) {
  scope.querySelectorAll('a[href]').forEach((anchor) => {
    const current = anchor.getAttribute('href');
    let normalized = normalizeHashHref(current);
    if (normalized?.startsWith('#') && !normalized.startsWith('#/')) {
      normalized = normalized.replace(/^#/, '#/');
    }
    if (normalized && normalized !== current) {
      anchor.setAttribute('href', normalized);
    }
  });
}

document.addEventListener('click', (event) => {
  const anchor = event.target.closest('a[href]');
  if (!anchor) return;
  const href = anchor.getAttribute('href');
  const normalized = normalizeHashHref(href);
  if (normalized && normalized.startsWith('#') && normalized !== href) {
    event.preventDefault();
    location.hash = normalized;
  }
});

async function fetchTemplate(path) {
  if (!templateCache.has(path)) {
    templateCache.set(path, fetch(path).then((response) => {
      if (!response.ok) throw new Error(`Template load failed: ${path}`);
      return response.text();
    }));
  }
  return templateCache.get(path);
}

async function mountTemplate(path, selector = 'body > *') {
  const html = await fetchTemplate(path);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const nodes = selector === 'body > *'
    ? Array.from(doc.body.children)
    : Array.from(doc.querySelectorAll(selector));

  app.replaceChildren(...nodes.map((node) => node.cloneNode(true)));
  app.querySelectorAll('script').forEach((script) => script.remove());
  rewriteLinks(app);
}

function syncSeasonControls(params) {
  const leagueSelect = document.getElementById('leagueSelect');
  if (!leagueSelect) return;

  const hashLeague = params.get('league');
  const league = hashLeague === 'olds' ? 'sundaygames' : hashLeague;
  if (league && [...leagueSelect.options].some((opt) => opt.value === league)) {
    leagueSelect.value = league;
  }
}

async function renderRoute() {
  mountTick += 1;
  const currentTick = mountTick;
  const { route, params } = parseHashRoute();

  if (!location.hash) {
    location.replace('#/home');
    return;
  }

  if (route === 'home') {
    await mountTemplate('./pages/index.html');
    if (currentTick !== mountTick) return;
    await import(`./pages/home.js?route=${currentTick}`);
  } else if (route === 'seasons') {
    await mountTemplate('./pages/seasons.html');
    if (currentTick !== mountTick) return;
    await import(`./pages/seasons.js?route=${currentTick}`);
  } else if (route === 'season') {
    await mountTemplate('./pages/season.html');
    syncSeasonControls(params);
    if (currentTick !== mountTick) return;
    await import(`./pages/season.js?route=${currentTick}`);
  } else if (route === 'rules') {
    await mountTemplate('./pages/rules.html', 'main');
  } else {
    location.replace('#/home');
    return;
  }

  ensureGlobalStyles();
  rewriteLinks(document);
}

window.addEventListener('hashchange', () => {
  renderRoute().catch((error) => {
    app.innerHTML = `<main class="page"><div class="container section"><section class="px-card"><h1 class="px-card__title">Routing error</h1><p class="px-card__text">${error.message}</p></section></div></main>`;
  });
});

renderRoute().catch((error) => {
  app.innerHTML = `<main class="page"><div class="container section"><section class="px-card"><h1 class="px-card__title">Routing error</h1><p class="px-card__text">${error.message}</p></section></div></main>`;
});

const observer = new MutationObserver((entries) => {
  entries.forEach((entry) => {
    if (!(entry.target instanceof Element)) return;
    rewriteLinks(entry.target);
  });
});

observer.observe(app, { childList: true, subtree: true });
