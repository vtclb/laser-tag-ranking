import { getSeasonsList } from '../core/dataHub.js';

const V2_BASE_URL = new URL('../', import.meta.url);
const lastSeasonCache = { kids: '', olds: '', loaded: false };

function hashHref(route, params = {}) {
  const cleanRoute = String(route || 'main').replace(/^\/+/, '');
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const qs = query.toString();
  return `#${cleanRoute}${qs ? `?${qs}` : ''}`;
}

async function ensureLastSeasons() {
  if (lastSeasonCache.loaded) return lastSeasonCache;
  const seasons = await getSeasonsList();
  const fallback = seasons[0]?.id || 'winter_2025_2026';
  lastSeasonCache.kids = window.__v2LastSeason?.kids || fallback;
  lastSeasonCache.olds = window.__v2LastSeason?.olds || fallback;
  lastSeasonCache.loaded = true;
  return lastSeasonCache;
}

function ensureLink({ id, rel = 'stylesheet', href, crossOrigin }) {
  let link = document.getElementById(id);
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = rel;
    link.href = href;
    if (crossOrigin) link.crossOrigin = crossOrigin;
  }
  document.head.appendChild(link);
  return link;
}

function ensureStyleOrder() {
  ['assets/styles.css', 'assets/css/main.css', 'assets/pixel-layer.css'].forEach((badHref) => {
    document.querySelectorAll(`link[rel="stylesheet"][href*="${badHref}"]`).forEach((link) => link.remove());
  });
  ensureLink({ id: 'v2-tokens', href: new URL('styles/tokens.css', V2_BASE_URL).href });
  ensureLink({ id: 'v2-pixel-layer', href: new URL('styles/pixel-layer.css', V2_BASE_URL).href });
  ensureLink({ id: 'v2-icons', href: new URL('styles/icons.css', V2_BASE_URL).href });
  ensureLink({ id: 'v2-loading-cubes', href: new URL('styles/loading-cubes.css', V2_BASE_URL).href });
}

function ensureTopNav() {
  const header = document.querySelector('header.topbar, header.topnav');
  if (!header || header.dataset.v2Topnav === '1') return;
  header.className = 'topnav';
  header.innerHTML = `<div class="container topnav__row"><a class="topnav__logo" href="#main">LaserTag v2</a><div class="topnav__actions"><button type="button" class="topnav__pill" id="globalMenuBtn"><span class="icon icon--menu" aria-hidden="true"></span> MENU</button></div></div>`;
  header.dataset.v2Topnav = '1';
}

async function ensureNavSheet() {
  if (document.getElementById('v2-navsheet')) return;
  const seasonMap = await ensureLastSeasons();

  const sheet = document.createElement('aside');
  sheet.id = 'v2-navsheet';
  sheet.className = 'navsheet';
  sheet.innerHTML = `<button type="button" class="navsheet__backdrop" data-nav-close="1" aria-label="Закрити меню"></button><div class="navsheet__panel" role="dialog" aria-modal="true" aria-label="Навігація"><div class="navsheet__head"><strong>MENU</strong><button class="topnav__pill" type="button" data-nav-close="1"><span class="icon icon--close"></span> Закрити</button></div><section class="navsheet__section"><h3>NAV</h3><div class="navsheet__grid"><a class="btn" href="#main" data-nav-link="1">Головна</a><a class="btn" href="#seasons" data-nav-link="1">Сезони</a><button class="btn" type="button" data-open-stats="1">Статистика</button><a class="btn" href="#rules" data-nav-link="1">Правила</a></div><div class="navsheet__grid" id="statsLeagueChooser" hidden><a class="btn" href="#season?season=${encodeURIComponent(seasonMap.kids)}&league=kids" data-nav-link="1">Дитяча ліга</a><a class="btn" href="#season?season=${encodeURIComponent(seasonMap.olds)}&league=olds" data-nav-link="1">Доросла ліга</a></div></section><section class="navsheet__section"><h3>ЛІГИ</h3><div class="navsheet__grid"><a class="btn" href="${hashHref('season', { season: seasonMap.kids, league: 'kids' })}" data-nav-link="1">Дитяча ліга</a><a class="btn" href="${hashHref('season', { season: seasonMap.olds, league: 'olds' })}" data-nav-link="1">Доросла ліга</a></div></section></div>`;

  let scrollY = 0;
  let touchStartY = 0;
  const close = (afterClose) => {
    sheet.classList.remove('is-open');
    document.body.classList.remove('navsheet-open');
    document.body.style.top = '';
    window.scrollTo(0, scrollY);
    if (typeof afterClose === 'function') setTimeout(afterClose, 120);
  };
  const open = () => {
    scrollY = window.scrollY;
    sheet.classList.add('is-open');
    document.body.classList.add('navsheet-open');
    document.body.style.top = `-${scrollY}px`;
  };

  sheet.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.navClose === '1') close();
  });
  sheet.querySelectorAll('[data-nav-link="1"]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      const href = el.getAttribute('href') || '#main';
      close(() => { location.hash = href; });
    });
  });
  sheet.querySelector('[data-open-stats="1"]')?.addEventListener('click', () => {
    const chooser = sheet.querySelector('#statsLeagueChooser');
    if (chooser) chooser.hidden = !chooser.hidden;
  });

  const panel = sheet.querySelector('.navsheet__panel');
  panel?.addEventListener('touchstart', (e) => { touchStartY = e.touches[0]?.clientY || 0; }, { passive: true });
  panel?.addEventListener('touchend', (e) => {
    const endY = e.changedTouches[0]?.clientY || 0;
    if (endY - touchStartY > 60) close();
  }, { passive: true });

  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  document.body.addEventListener('click', (event) => {
    const trigger = event.target.closest('#globalMenuBtn, [data-open-global-menu="1"]');
    if (!trigger) return;
    event.preventDefault();
    if (sheet.classList.contains('is-open')) close(); else open();
  });

  document.body.appendChild(sheet);
}

function ensureFonts() {
  ensureLink({ id: 'v2-fonts-preconnect-googleapis', rel: 'preconnect', href: 'https://fonts.googleapis.com' });
  ensureLink({ id: 'v2-fonts-preconnect-gstatic', rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' });
  ensureLink({ id: 'v2-fonts-css', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@500;700&family=Oswald:wght@500;700&display=swap' });
}

function ensureLoadingScript() {
  if (window.LoadingCubes || document.getElementById('v2-loading-cubes-script')) return;
  const script = document.createElement('script');
  script.type = 'module';
  script.id = 'v2-loading-cubes-script';
  script.src = new URL('scripts/loading-cubes.js', V2_BASE_URL).href;
  document.head.appendChild(script);
}

function attachLoadingHooks() {
  if (window.__v2LoadingHooksBound) return;
  window.__v2LoadingHooksBound = true;
  let activeRequests = 0;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    activeRequests += 1;
    window.LoadingCubes?.show('Синхронізація даних…');
    try { return await nativeFetch(...args); }
    finally {
      activeRequests = Math.max(0, activeRequests - 1);
      if (!activeRequests) window.LoadingCubes?.hide();
    }
  };
}

export function ensureGlobalStyles() {
  document.body?.classList.add('theme-game');
  ensureStyleOrder();
  ensureFonts();
  ensureTopNav();
  ensureNavSheet();
  ensureLoadingScript();
  attachLoadingHooks();
}
