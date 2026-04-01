import { normalizeLeague } from '../core/naming.js';

const V2_BASE_URL = new URL('../', import.meta.url);

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
  ensureLink({ id: 'v2-assets-main', href: new URL('assets/css/main.css', V2_BASE_URL).href });
}

function ensureTopNav() {
  const header = document.querySelector('header.topbar, header.topnav');
  if (!header || header.dataset.v2Topnav === '1') return;
  header.className = 'topnav';
  header.innerHTML = `<div class="container topnav__row"><nav class="topnav__actions topnav__links v2-nav" aria-label="Головна навігація"><div class="v2-nav-grid"><a class="topnav__pill v2-nav-item" href="#main">Головна</a><a class="topnav__pill v2-nav-item" href="#league-stats?league=sundaygames">Доросла ліга</a><a class="topnav__pill v2-nav-item" href="#league-stats?league=kids">Дитяча ліга</a><a class="topnav__pill v2-nav-item" href="#gameday?league=sundaygames">Ігровий день</a></div><a class="topnav__pill v2-nav-item v2-nav-item--wide" href="#rules">Правила</a></nav></div>`;
  header.dataset.v2Topnav = '1';
}

async function ensureNavSheet() {
  if (document.getElementById('v2-navsheet')) return;

  const sheet = document.createElement('aside');
  sheet.id = 'v2-navsheet';
  sheet.className = 'navsheet';
  sheet.innerHTML = `<button type="button" class="navsheet__backdrop" data-nav-close="1" aria-label="Закрити меню"></button><div class="navsheet__panel" role="dialog" aria-modal="true" aria-label="Навігація"><section class="navsheet__section"><div class="navsheet__grid"><a class="btn" href="#main" data-nav-link="1">Головна</a><a class="btn" href="#league-stats?league=sundaygames" data-nav-link="1">Доросла ліга</a><a class="btn" href="#league-stats?league=kids" data-nav-link="1">Дитяча ліга</a><a class="btn" href="#gameday?league=sundaygames" data-nav-link="1">Ігровий день</a><a class="btn" href="#rules" data-nav-link="1">Правила</a></div></section></div>`;

  let scrollY = 0;
  let touchStartY = 0;
  const close = (afterClose) => {
    sheet.classList.remove('is-open');
    document.body.classList.remove('navsheet-open');
    document.body.style.top = '';
    window.scrollTo(0, scrollY);
    if (typeof afterClose === 'function') afterClose();
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
      location.hash = href;
      close();
    });
  });
  const panel = sheet.querySelector('.navsheet__panel');
  panel?.addEventListener('touchstart', (e) => { touchStartY = e.touches[0]?.clientY || 0; }, { passive: true });
  panel?.addEventListener('touchend', (e) => {
    const endY = e.changedTouches[0]?.clientY || 0;
    if (endY - touchStartY > 60) close();
  }, { passive: true });

  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  window.addEventListener('hashchange', () => close());
  window.addEventListener('v2:route-rendered', () => close());
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

function updateTopNavActiveState() {
  try {
    const hash = String(location.hash || '#main').replace(/^#/, '');
    const [route = 'main', queryString = ''] = hash.split('?');
    const qp = new URLSearchParams(queryString);
    const league = normalizeLeague?.(qp.get('league') || qp.get('lg') || '') || '';

    document.querySelectorAll('.topnav__links .v2-nav-item').forEach((link) => {
      const href = String(link.getAttribute('href') || '');
      const [linkRoute = '', linkQs = ''] = href.replace(/^#/, '').split('?');
      const linkParams = new URLSearchParams(linkQs);
      const linkLeague = normalizeLeague?.(linkParams.get('league') || linkParams.get('lg') || '') || '';

      const isCurrent = (
        (route === 'main' && linkRoute === 'main')
        || (route === 'rules' && linkRoute === 'rules')
        || (route === 'league-stats' && linkRoute === 'league-stats' && (!linkLeague || linkLeague === league))
        || (route === 'gameday' && linkRoute === 'gameday' && (!linkLeague || linkLeague === league))
      );

      if (isCurrent) {
        link.setAttribute('aria-current', 'page');
        link.classList.add('active');
      } else {
        link.removeAttribute('aria-current');
        link.classList.remove('active');
      }
    });
  } catch (error) {
    console.error('[global-styles] updateTopNavActiveState failed', error);
  }
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
  try {
    updateTopNavActiveState();
  } catch (error) {
    console.error('[global-styles] topnav active-state bootstrap failed', error);
  }
  if (!window.__v2TopNavActiveBound) {
    window.__v2TopNavActiveBound = true;
    window.addEventListener('hashchange', () => {
      try {
        updateTopNavActiveState();
      } catch (error) {
        console.error('[global-styles] hashchange topnav active-state failed', error);
      }
    });
    window.addEventListener('v2:route-rendered', () => {
      try {
        updateTopNavActiveState();
      } catch (error) {
        console.error('[global-styles] route-rendered topnav active-state failed', error);
      }
    });
  }
  ensureLoadingScript();
  attachLoadingHooks();
}

ensureGlobalStyles();
