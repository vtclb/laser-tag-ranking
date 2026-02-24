const NAV_LINKS = [
  { href: "index.html", label: "Головна" },
  { href: "about.html", label: "Про лігу" },
  { href: "rules.html", label: "Правила" },
  { href: "balance.html", label: "Балансер" },
  { href: "profile.html", label: "Профіль" }
];

function createShell() {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  const header = document.createElement('header');
  header.className = 'topnav';
  header.innerHTML = `
    <div class="container">
      <div class="topnav__row">
        <a class="topnav__logo" href="index.html">BELAGE</a>
        <button class="topnav__pill" id="navOpenBtn" type="button">MENU</button>
      </div>
    </div>
  `;

  const sheet = document.createElement('div');
  sheet.className = 'navsheet';
  sheet.id = 'navSheet';
  sheet.setAttribute('aria-hidden', 'true');
  sheet.innerHTML = `
    <div class="navsheet__backdrop" id="navBackdrop"></div>
    <div class="navsheet__panel px-card">
      <div class="navsheet__head">
        <span class="px-badge">NAV</span>
        <button class="topnav__pill" id="navCloseBtn" type="button">CLOSE</button>
      </div>
      ${NAV_LINKS.map((link) => `<a class="btn btn--secondary ${current === link.href ? 'is-active' : ''}" href="${link.href}">${link.label}</a>`).join('')}
    </div>
  `;

  const loading = document.createElement('div');
  loading.className = 'loading';
  loading.id = 'loadingOverlay';
  loading.setAttribute('aria-hidden', 'true');
  loading.innerHTML = `
    <div class="loading__panel px-card px-card--accent">
      <span class="px-badge">SYSTEM</span>
      <h2 class="px-card__title">LOADING</h2>
      <p class="px-card__text">Завантаження...</p>
      <div class="loading__bar"><div class="loading__barFill"></div></div>
    </div>
  `;

  document.body.prepend(header);
  document.body.append(sheet, loading);

  const openBtn = document.getElementById('navOpenBtn');
  const closeBtn = document.getElementById('navCloseBtn');
  const backdrop = document.getElementById('navBackdrop');

  const closeSheet = () => {
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };
  const openSheet = () => {
    sheet.classList.add('is-open');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  openBtn?.addEventListener('click', openSheet);
  closeBtn?.addEventListener('click', closeSheet);
  backdrop?.addEventListener('click', closeSheet);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSheet();
  });

  window.showLoading = () => {
    loading.classList.add('is-open');
    loading.setAttribute('aria-hidden', 'false');
  };
  window.hideLoading = () => {
    loading.classList.remove('is-open');
    loading.setAttribute('aria-hidden', 'true');
  };

  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href') || '';
    if (href.startsWith('#') || href.startsWith('http') || anchor.target === '_blank') return;
    window.showLoading();
  });

  window.addEventListener('pageshow', () => window.hideLoading());
  window.addEventListener('load', () => window.hideLoading());
}

function wrapMain() {
  document.querySelectorAll('nav, .topnav, header').forEach((el) => {
    if (el.querySelector('#navOpenBtn')) return;
    el.remove();
  });
  const existingMain = document.querySelector('main');
  if (existingMain) return;
  const main = document.createElement('main');
  const container = document.createElement('div');
  container.className = 'container stack';

  const nodes = Array.from(document.body.children).filter((el) => !el.classList?.contains('topnav'));
  for (const node of nodes) {
    if (node.id === 'navSheet' || node.id === 'loadingOverlay' || node.tagName === 'SCRIPT') continue;
    container.appendChild(node);
  }

  main.appendChild(container);
  const firstScript = document.body.querySelector('script');
  if (firstScript) {
    document.body.insertBefore(main, firstScript);
  } else {
    document.body.appendChild(main);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  createShell();
  wrapMain();
});
