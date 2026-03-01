const V2_BASE_URL = new URL('../', import.meta.url);

function hashHref(route, params = {}) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `#${route}${query ? `&${query}` : ''}`;
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

function ensureThemeFlag() {
  document.body?.classList.add('theme-game');
}

function ensureStyleOrder() {
  const disallowedStyles = [
    'assets/styles.css',
    'assets/css/main.css',
    'assets/pixel-layer.css'
  ];

  Array.from(document.querySelectorAll('link[rel="stylesheet"]')).forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (disallowedStyles.some((style) => href.includes(style))) {
      link.remove();
    }
  });

  ensureLink({ id: 'v2-tokens', href: new URL('styles/tokens.css', V2_BASE_URL).href });
  ensureLink({ id: 'v2-pixel-layer', href: new URL('styles/pixel-layer.css', V2_BASE_URL).href });
  ensureLink({ id: 'v2-icons', href: new URL('styles/icons.css', V2_BASE_URL).href });
  ensureLink({ id: 'v2-loading-cubes', href: new URL('styles/loading-cubes.css', V2_BASE_URL).href });
}

function pageCta() {
  const route = location.hash.replace(/^#/, '').split('&')[0] || 'home';
  if (route === 'season') return { href: hashHref('seasons'), label: 'SEASONS' };
  if (route === 'balance') return { href: hashHref('home'), label: 'HOME' };
  return null;
}

function ensureTopNav() {
  const header = document.querySelector('header.topbar, header.topnav');
  if (!header || header.dataset.v2Topnav === '1') return;

  const cta = pageCta();
  const legacyActions = header.querySelector('.header-actions');
  const extraActions = legacyActions ? legacyActions.outerHTML : '';

  header.className = 'topnav';
  header.innerHTML = `
    <div class="container topnav__row">
      <a class="topnav__logo" href="${hashHref('home')}">LaserTag v2</a>
      <div class="topnav__actions">
        ${cta ? `<a class="topnav__pill" href="${cta.href}">${cta.label}</a>` : ''}
        <button type="button" class="topnav__pill" id="globalMenuBtn"><span class="icon icon--menu" aria-hidden="true"></span> MENU</button>
      </div>
    </div>
    ${extraActions ? `<div class="container topnav__extra">${extraActions}</div>` : ''}`;
  header.dataset.v2Topnav = '1';
}

function ensureNavSheet() {
  if (document.getElementById('v2-navsheet')) return;

  const nav = [
    { href: hashHref('home'), label: 'Home' },
    { href: hashHref('seasons'), label: 'Seasons' },
    { href: hashHref('season', { league: 'kids' }), label: 'League stats' },
    { href: hashHref('balance'), label: 'Balancer' },
    { href: hashHref('rules'), label: 'Rules' }
  ];

  const sheet = document.createElement('aside');
  sheet.id = 'v2-navsheet';
  sheet.className = 'navsheet';
  sheet.innerHTML = `
    <button type="button" class="navsheet__backdrop" data-nav-close="1" aria-label="Close menu"></button>
    <div class="navsheet__panel" role="dialog" aria-modal="true" aria-label="Navigation">
      <div class="navsheet__head">
        <strong>MENU</strong>
        <button class="topnav__pill" type="button" data-nav-close="1"><span class="icon icon--close"></span> CLOSE</button>
      </div>
      <section class="px-card"><h3 class="px-card__title">NAV</h3><div class="hero__actions">${nav.map((item) => `<a class="btn" href="${item.href}">${item.label}</a>`).join('')}</div></section>
      <section class="px-card"><h3 class="px-card__title">LEAGUES</h3><div class="hero__actions"><a class="btn" href="${hashHref('season', { league: 'kids' })}">Kids</a><a class="btn" href="${hashHref('season', { league: 'olds' })}">Olds</a></div></section>
      <section class="px-card"><h3 class="px-card__title">SYSTEM</h3><div class="hero__actions"><button class="btn" type="button" data-nav-close="1">Theme: Game</button></div></section>
    </div>`;

  const close = () => {
    sheet.classList.remove('is-open');
    document.body.classList.remove('navsheet-open');
  };

  sheet.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.navClose === '1') close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  document.body.appendChild(sheet);

  document.body.addEventListener('click', (event) => {
    const trigger = event.target.closest('#globalMenuBtn, [data-open-global-menu="1"]');
    if (!trigger) return;
    event.preventDefault();
    sheet.classList.add('is-open');
    document.body.classList.add('navsheet-open');
  });
}

function ensureFonts() {
  ensureLink({ id: 'v2-fonts-preconnect-googleapis', rel: 'preconnect', href: 'https://fonts.googleapis.com' });
  ensureLink({ id: 'v2-fonts-preconnect-gstatic', rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' });
  ensureLink({ id: 'v2-fonts-css', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@500;700&family=Oswald:wght@500;700&display=swap' });
}

function ensureLoadingScript() {
  if (window.LoadingCubes) return;
  if (document.getElementById('v2-loading-cubes-script')) return;
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
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    activeRequests += 1;
    window.LoadingCubes?.show('Syncing data…');
    try {
      return await originalFetch(...args);
    } finally {
      activeRequests = Math.max(0, activeRequests - 1);
      if (activeRequests === 0) window.LoadingCubes?.hide();
    }
  };

  window.addEventListener('pageshow', () => window.LoadingCubes?.hide());
  window.addEventListener('load', () => window.LoadingCubes?.hide());
}

export function ensureGlobalStyles() {
  ensureThemeFlag();
  ensureStyleOrder();
  ensureFonts();
  ensureTopNav();
  ensureNavSheet();
  ensureLoadingScript();
  attachLoadingHooks();
}

ensureGlobalStyles();
window.addEventListener('DOMContentLoaded', ensureGlobalStyles);
