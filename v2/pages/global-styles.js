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

function ensureThemeFlag() {
  document.body?.classList.add('theme-game');
}

function ensureStyleOrder() {
  const legacyStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).filter((link) => {
    const href = link.getAttribute('href') || '';
    return href.includes('styles.css') || href.includes('main.css');
  });

  legacyStyles.forEach((link) => document.head.appendChild(link));

  ensureLink({ id: 'belage-tokens', href: new URL('assets/tokens.css', V2_BASE_URL).href });
  ensureLink({ id: 'belage-pixel', href: new URL('assets/pixel-layer.css', V2_BASE_URL).href });
}

function ensureNavSheet() {
  const menuTrigger = document.querySelector('.topbar .nav-link');
  if (!menuTrigger || menuTrigger.dataset.navsheetBound === '1') return;

  const label = (menuTrigger.textContent || '').trim().toLowerCase();
  if (!label.includes('menu')) return;

  menuTrigger.classList.remove('nav-link');
  menuTrigger.classList.add('topnav__pill');
  menuTrigger.setAttribute('role', 'button');
  menuTrigger.dataset.navsheetBound = '1';

  if (document.getElementById('v2-navsheet')) return;

  const links = [
    { href: './index.html', label: 'Home' },
    { href: './seasons.html', label: 'Seasons' },
    { href: './gameday.html', label: 'Game day' },
    { href: './rules.html', label: 'Rules' },
    { href: './tournaments.html', label: 'Tournaments' }
  ];

  const sheet = document.createElement('div');
  sheet.id = 'v2-navsheet';
  sheet.className = 'navsheet';
  sheet.innerHTML = `
    <div class="navsheet__backdrop" data-nav-close="1"></div>
    <div class="navsheet__panel px-card" role="dialog" aria-modal="true" aria-label="Navigation">
      <div class="navsheet__head">
        <strong>NAV</strong>
        <button class="topnav__pill" type="button" data-nav-close="1">CLOSE</button>
      </div>
      <div class="hero__actions">
        ${links.map((link) => `<a class="btn" href="${link.href}">${link.label}</a>`).join('')}
      </div>
    </div>
  `;

  const closeSheet = () => sheet.classList.remove('is-open');

  sheet.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.navClose === '1') closeSheet();
  });

  document.body.appendChild(sheet);

  menuTrigger.addEventListener('click', (event) => {
    event.preventDefault();
    sheet.classList.add('is-open');
  });
}

export function ensureGlobalStyles() {
  ensureThemeFlag();
  ensureStyleOrder();

  ensureLink({
    id: 'belage-fonts-preconnect-googleapis',
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com'
  });
  ensureLink({
    id: 'belage-fonts-preconnect-gstatic',
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous'
  });
  ensureLink({
    id: 'belage-fonts-css',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@500;700&family=Oswald:wght@500;700&display=swap'
  });

  ensureNavSheet();
}

ensureGlobalStyles();
window.addEventListener('DOMContentLoaded', ensureGlobalStyles);
window.addEventListener('load', ensureGlobalStyles);
window.addEventListener('popstate', ensureGlobalStyles);
window.addEventListener('hashchange', ensureGlobalStyles);
document.addEventListener('visibilitychange', ensureGlobalStyles);
