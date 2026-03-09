const GRID_SIZE = 24;
let timer = null;
let cells = [];
let tick = 0;

function ensureOverlay() {
  let overlay = document.getElementById('loadingOverlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.className = 'loadingCubes';
  overlay.innerHTML = '<div class="loadingCubes__panel px-card px-card--accent"><div class="loadingCubes__grid" id="loadingGrid"></div><div class="loadingCubes__meta"><span class="px-badge">SYSTEM</span><div class="loadingCubes__title">LOADING</div><div class="loadingCubes__sub" id="loadingSub">Syncing…</div></div></div>';
  document.body.appendChild(overlay);
  return overlay;
}

function ensureGrid() {
  const grid = document.getElementById('loadingGrid');
  if (!grid || cells.length) return;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i += 1) {
    const cell = document.createElement('div');
    cell.className = 'loadingCubes__cell';
    fragment.appendChild(cell);
    cells.push(cell);
  }
  grid.appendChild(fragment);
}

function paint() {
  tick += 1;
  cells.forEach((cell, idx) => {
    const wave = (idx + tick) % 19;
    if (wave < 8) cell.style.background = 'var(--accent)';
    else if (wave < 12) cell.style.background = 'var(--accent-2)';
    else cell.style.background = 'rgba(242,245,255,.08)';
    cell.style.opacity = wave < 12 ? '1' : '.5';
  });
}

function start() {
  if (timer) clearInterval(timer);
  paint();
  timer = setInterval(paint, 70);
}

function stop() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

function show(message = 'Syncing…') {
  const overlay = ensureOverlay();
  ensureGrid();
  const sub = document.getElementById('loadingSub');
  if (sub) sub.textContent = message;
  overlay.classList.add('is-visible');
  start();
}

function hide() {
  ensureOverlay().classList.remove('is-visible');
  stop();
}

window.LoadingCubes = { show, hide };
if (document.readyState !== 'loading') ensureOverlay();
else document.addEventListener('DOMContentLoaded', ensureOverlay, { once: true });
