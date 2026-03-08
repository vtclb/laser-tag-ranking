import { listSeasonMasters, safeErrorMessage } from '../core/dataHub.js';

const SEASON_LABELS = {
  summer_2025: 'Літо 2025',
  autumn_2025: 'Осінь 2025',
  winter_2025_2026: 'Зима 2025–2026'
};

function seasonCard(seasonId = '') {
  const seasonKey = encodeURIComponent(seasonId);
  const label = SEASON_LABELS[seasonId] || seasonId;
  return `<article class="px-card px-card--accent season-list-card"><h2 class="px-card__title">${label}</h2><div class="hero__actions"><a class="btn btn--primary" href="#season?season=${seasonKey}">Відкрити сезон</a></div></article>`;
}

export async function initSeasonsPage() {
  const root = document.getElementById('view');
  if (!root) return;
  root.innerHTML = '<section class="px-card"><p class="px-card__text">Завантаження сезонів…</p></section>';
  try {
    const seasons = await listSeasonMasters();
    if (!Array.isArray(seasons) || seasons.length === 0) {
      root.innerHTML = '<section class="px-card"><h2 class="px-card__title">Сезони</h2><p class="px-card__text">Немає доступних сезонів.</p></section>';
      return;
    }
    root.innerHTML = `<section class="section">${seasons.map(seasonCard).join('')}</section>`;
  } catch (error) {
    root.innerHTML = `<section class="px-card px-card--accent"><h2 class="px-card__title">Не вдалося завантажити</h2><p class="px-card__text">${safeErrorMessage(error, 'Не вдалося завантажити список сезонів')}</p></section>`;
  }
}
