const V2_BASE_URL = new URL('../', import.meta.url);

function hashHref(route, params = {}) {
  const cleanRoute = String(route || 'home').replace(/^\/+/, '');
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const qs = query.toString();
  return `#/${cleanRoute}${qs ? `?${qs}` : ''}`;
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
  const route = location.hash.replace(/^#\/?/, '').split('?')[0] || 'home';
  if (route === 'season') return { href: hashHref('seasons'), label: 'SEASONS' };
  return null;
}

function ensureTopNav() {
  const header = document.querySelector('header.topbar, header.topnav');
  if (!header || header.dataset.v2Topnav === '1') return;

  const cta = pageCta();

  header.className = 'topnav';
  header.innerHTML = `
    <div class="container topnav__row">
      <a class="topnav__logo" href="${hashHref('home')}">LaserTag v2</a>
      <div class="topnav__actions">
        ${cta ? `<a class="topnav__pill" href="${cta.href}">${cta.label}</a>` : ''}
        <button type="button" class="topnav__pill" id="globalMenuBtn"><span class="icon icon--menu" aria-hidden="true"></span> MENU</button>
      </div>
    </div>`;
  header.dataset.v2Topnav = '1';
}

function ensureNavSheet() {
  if (document.getElementById('v2-navsheet')) return;

  const nav = [
    { href: hashHref('home'), label: 'Home' },
    { href: hashHref('seasons'), label: 'Seasons' },
    { href: hashHref('season', { league: 'kids' }), label: 'League Stats' },
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
      <section class="navsheet__section"><h3>NAV</h3><div class="navsheet__grid">${nav.map((item) => `<a class="btn" href="${item.href}" data-nav-close="1">${item.label}</a>`).join('')}</div></section>
      <section class="navsheet__section"><h3>LEAGUES</h3><div class="navsheet__grid"><a class="btn" href="${hashHref('season', { league: 'kids' })}" data-nav-close="1">Kids</a><a class="btn" href="${hashHref('season', { league: 'olds' })}" data-nav-close="1">Olds</a></div></section>
      <section class="navsheet__section"><h3>SYSTEM</h3><div class="navsheet__grid"><span class="btn navsheet__label">Theme: Game</span></div></section>
    </div>`;

  let scrollY = 0;

  const close = () => {
    sheet.classList.remove('is-open');
    document.body.classList.remove('navsheet-open');
    document.body.style.top = '';
    window.scrollTo(0, scrollY);
  };

  const open = () => {
    scrollY = window.scrollY;
    sheet.classList.add('is-open');
    document.body.classList.add('navsheet-open');
    document.body.style.top = `-${scrollY}px`;
  };

  let touchStartY = null;
  sheet.addEventListener('touchstart', (event) => {
    touchStartY = event.touches[0]?.clientY ?? null;
  }, { passive: true });

  sheet.addEventListener('touchend', (event) => {
    if (touchStartY === null) return;
    const touchEndY = event.changedTouches[0]?.clientY ?? touchStartY;
    if (touchEndY - touchStartY > 70) close();
    touchStartY = null;
  }, { passive: true });

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
    open();
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
