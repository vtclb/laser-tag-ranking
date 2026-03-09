import { listSeasonMasters, getHomeFast, safeErrorMessage } from '../core/dataHub.js';

const SEASON_LABELS = {
  summer_2025: 'Літо 2025',
  autumn_2025: 'Осінь 2025',
  winter_2025_2026: 'Зима 2025–2026'
};

function seasonLabel(seasonId = '') {
  return SEASON_LABELS[seasonId] || String(seasonId || '').replaceAll('_', ' ');
}

function seasonLeagueCard(seasonId, league, activeSeasonId) {
  const isKids = league === 'kids';
  const leagueLabel = isKids ? 'Дитяча' : 'Доросла';
  const className = `px-card px-card--accent season-list-card season-league-card season-league-card--${league} ${seasonId === activeSeasonId ? 'card--active' : ''}`;
  return `<a class="${className}" href="#season?season=${encodeURIComponent(seasonId)}&league=${league}"><h2 class="px-card__title">${seasonLabel(seasonId)} (${leagueLabel})</h2><p class="px-card__text">Відкрити сезон</p></a>`;
}

export async function initSeasonsPage() {
  const root = document.getElementById('view');
  if (!root) return;
  root.innerHTML = '<section class="px-card"><p class="px-card__text">Завантаження сезонів…</p></section>';
  try {
    const [seasons, home] = await Promise.all([listSeasonMasters(), getHomeFast().catch(() => null)]);
    if (!Array.isArray(seasons) || seasons.length === 0) {
      root.innerHTML = '<section class="px-card"><h2 class="px-card__title">Сезони</h2><p class="px-card__text">Немає доступних сезонів</p></section>';
      return;
    }
    const sorted = [...seasons].sort((a, b) => String(b).localeCompare(String(a), 'uk'));
    const activeSeasonId = home?.seasonId || '';
    root.innerHTML = `<section class="section">${sorted.flatMap((seasonId) => [
      seasonLeagueCard(seasonId, 'kids', activeSeasonId),
      seasonLeagueCard(seasonId, 'olds', activeSeasonId)
    ]).join('')}</section>`;
  } catch (error) {
    root.innerHTML = `<section class="px-card px-card--accent"><h2 class="px-card__title">Не вдалося завантажити</h2><p class="px-card__text">${safeErrorMessage(error, 'Не вдалося завантажити список сезонів')}</p></section>`;
  }
}
