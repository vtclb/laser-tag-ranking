function ensureOverlay() {
  let overlay = document.getElementById('loadingOverlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.className = 'loadingCubes';
  overlay.innerHTML = '<div class="loadingCubes__panel"><span class="px-badge">SYSTEM</span><h2 class="loadingCubes__title">Завантаження статистики</h2><p class="loadingCubes__sub" id="loadingSub">Підтягуємо актуальні дані сезону</p><div class="loadingCubes__line" aria-hidden="true"></div></div>';
  document.body.appendChild(overlay);
  return overlay;
}

function show(message = 'Підтягуємо актуальні дані сезону') {
  const overlay = ensureOverlay();
  const sub = document.getElementById('loadingSub');
  if (sub) sub.textContent = message;
  overlay.classList.add('is-visible');
}

function hide() {
  ensureOverlay().classList.remove('is-visible');
}

window.LoadingCubes = { show, hide };
if (document.readyState !== 'loading') ensureOverlay();
else document.addEventListener('DOMContentLoaded', ensureOverlay, { once: true });
