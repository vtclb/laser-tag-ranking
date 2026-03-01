import { getSeasonsList, safeErrorMessage } from '../core/dataHub.js';
import { leagueLabelUA } from '../core/naming.js';

function seasonCard(season = {}) {
  const dateFrom = season.dateFrom || '—';
  const dateTo = season.dateTo || '—';
  const seasonId = encodeURIComponent(season.id || '');
  return `<article class="px-card px-card--accent season-list-card"><h2 class="px-card__title">${season.title || season.id || 'Сезон'}</h2><p class="px-card__text">${dateFrom} — ${dateTo}</p><div class="hero__actions"><a class="btn btn--primary" href="#season?season=${seasonId}&league=kids">${leagueLabelUA('kids')}</a><a class="btn btn--secondary" href="#season?season=${seasonId}&league=olds">${leagueLabelUA('olds')}</a></div></article>`;
}

export async function initSeasonsPage() {
  const root = document.getElementById('seasonsRoot');
  if (!root) return;
  root.innerHTML = '<section class="px-card"><p class="px-card__text">Завантаження сезонів…</p></section>';
  try {
    const seasons = await getSeasonsList();
    if (!Array.isArray(seasons) || seasons.length === 0) {
      root.innerHTML = '<section class="px-card"><h2 class="px-card__title">Сезони</h2><p class="px-card__text">Немає доступних сезонів.</p></section>';
      return;
    }
    root.innerHTML = `<section class="section">${seasons.map(seasonCard).join('')}</section>`;
  } catch (error) {
    root.innerHTML = `<section class="px-card px-card--accent"><h2 class="px-card__title">Не вдалося завантажити</h2><p class="px-card__text">${safeErrorMessage(error, 'Не вдалося завантажити список сезонів')}</p></section>`;
  }
}
