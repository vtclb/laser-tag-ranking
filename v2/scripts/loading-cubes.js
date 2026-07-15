function ensureOverlay() {
  let overlay = document.getElementById('loadingOverlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.className = 'loadingCubes';
  overlay.hidden = true;
  overlay.inert = true;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.setAttribute('aria-atomic', 'true');
  overlay.innerHTML = '<div class="loadingCubes__panel"><span class="loadingCubes__radar" aria-hidden="true"><i></i></span><span class="loadingCubes__copy"><strong class="loadingCubes__title">Синхронізація арени</strong><span class="loadingCubes__sub" id="loadingSub">Оновлюємо статистику</span></span><span class="loadingCubes__signal" aria-hidden="true"><i></i><i></i><i></i></span></div>';
  document.body.appendChild(overlay);
  return overlay;
}

let showTimer = null;
let visible = false;

function show(message = 'Оновлюємо статистику') {
  const overlay = ensureOverlay();
  const sub = document.getElementById('loadingSub');
  if (sub) sub.textContent = message;
  document.getElementById('view')?.setAttribute('aria-busy', 'true');
  if (visible || showTimer) return;
  showTimer = window.setTimeout(() => {
    showTimer = null;
    visible = true;
    overlay.hidden = false;
    overlay.inert = false;
    overlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => overlay.classList.add('is-visible'));
  }, 280);
}

function hide() {
  const overlay = ensureOverlay();
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  overlay.classList.remove('is-visible');
  visible = false;
  overlay.inert = true;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.hidden = true;
  document.getElementById('view')?.removeAttribute('aria-busy');
}

window.LoadingCubes = { show, hide };
if (document.readyState !== 'loading') ensureOverlay();
else document.addEventListener('DOMContentLoaded', ensureOverlay, { once: true });
