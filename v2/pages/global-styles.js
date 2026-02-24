const V2_BASE_URL = new URL('../', import.meta.url);

function ensureLink({ id, rel = 'stylesheet', href, crossOrigin }) {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = rel;
  link.href = href;
  if (crossOrigin) link.crossOrigin = crossOrigin;
  document.head.appendChild(link);
}

export function ensureGlobalStyles() {
  const styles = [
    { id: 'belage-tokens', href: new URL('assets/tokens.css', V2_BASE_URL).href },
    { id: 'belage-pixel', href: new URL('assets/pixel-layer.css', V2_BASE_URL).href }
  ];

  styles.forEach(ensureLink);

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
}

ensureGlobalStyles();
window.addEventListener('popstate', ensureGlobalStyles);
window.addEventListener('hashchange', ensureGlobalStyles);
document.addEventListener('visibilitychange', ensureGlobalStyles);
