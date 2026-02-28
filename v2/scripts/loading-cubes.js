const GRID_SIZE = 24;
let timer = null;
let cells = [];
let tick = 0;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function ensureOverlay() {
  let overlay = document.getElementById('loadingOverlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.className = 'loadingCubes';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `<div class="loadingCubes__panel px-card px-card--accent"><div class="loadingCubes__grid" id="loadingGrid" aria-label="Loading"></div><div class="loadingCubes__meta"><span class="px-badge">SYSTEM</span><div class="loadingCubes__title">LOADING</div><div class="loadingCubes__sub" id="loadingSub">Syncing…</div></div></div>`;
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

function paintCells() {
  if (!cells.length) return;
  tick += 1;
  const total = cells.length;
  const sweep = tick % (GRID_SIZE + 12);

  cells.forEach((cell, idx) => {
    if (reduceMotion) {
      cell.style.background = idx % 7 === 0 ? 'rgba(242,245,255,.18)' : 'rgba(242,245,255,.08)';
      return;
    }

    const row = Math.floor(idx / GRID_SIZE);
    if (row <= sweep) {
      cell.style.background = (idx + tick) % 5 === 0 ? 'var(--accent-2)' : 'var(--accent)';
      return;
    }

    const shimmer = Math.random();
    if (shimmer > 0.985) cell.style.background = 'rgba(242,245,255,.45)';
    else if (shimmer > 0.95) cell.style.background = 'rgba(242,245,255,.18)';
    else cell.style.background = 'rgba(242,245,255,.08)';
  });
}

function startLoop() {
  stopLoop();
  paintCells();
  timer = window.setInterval(paintCells, reduceMotion ? 500 : 70);
}

function stopLoop() {
  if (timer) {
    window.clearInterval(timer);
    timer = null;
  }
}

function lockScroll(locked) {
  document.body.style.overflow = locked ? 'hidden' : '';
}

function show(message = 'Syncing…') {
  const overlay = ensureOverlay();
  ensureGrid();
  const sub = document.getElementById('loadingSub');
  if (sub) sub.textContent = message;
  overlay.classList.add('is-visible');
  overlay.setAttribute('aria-hidden', 'false');
  lockScroll(true);
  startLoop();
}

function hide() {
  const overlay = ensureOverlay();
  overlay.classList.remove('is-visible');
  overlay.setAttribute('aria-hidden', 'true');
  lockScroll(false);
  stopLoop();
}

window.LoadingCubes = { show, hide };

if (document.readyState !== 'loading') ensureOverlay();
else document.addEventListener('DOMContentLoaded', ensureOverlay, { once: true });
