import { getSeasonsList, safeErrorMessage } from '../core/dataHub.js';

const root = document.getElementById('seasonsRoot') || document.querySelector('main .container') || document.querySelector('main');

function seasonCard(season = {}) {
  const dateFrom = season.dateFrom || '—';
  const dateTo = season.dateTo || '—';
  const seasonId = encodeURIComponent(season.id || '');
  return `<article class="px-card px-card--accent season-list-card">
    <h2 class="px-card__title">${season.title || season.id || 'Season'}</h2>
    <p class="px-card__text">${dateFrom} — ${dateTo}</p>
    <div class="hero__actions">
      <a class="btn btn--primary" href="#/season?season=${seasonId}&league=kids">Kids</a>
      <a class="btn btn--secondary" href="#/season?season=${seasonId}&league=olds">Olds</a>
    </div>
  </article>`;
}

function renderError(message) {
  if (!root) return;
  root.innerHTML = `<section class="px-card px-card--accent"><h2 class="px-card__title">Data unavailable</h2><p class="px-card__text">${message}</p></section>`;
}

async function renderSeasons() {
  if (!root) return;
  root.innerHTML = '<section class="px-card"><p class="px-card__text">Loading seasons…</p></section>';
  try {
    const seasons = await getSeasonsList();
    if (!Array.isArray(seasons) || seasons.length === 0) {
      root.innerHTML = '<section class="px-card"><h2 class="px-card__title">Seasons</h2><p class="px-card__text">No seasons available yet.</p></section>';
      return;
    }
    root.innerHTML = `<section class="section">${seasons.map(seasonCard).join('')}</section>`;
  } catch (error) {
    console.debug('[seasons] failed to load list', error);
    renderError(safeErrorMessage(error, 'Не вдалося завантажити список сезонів'));
  }
}

renderSeasons();
