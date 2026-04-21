import { listSeasonMasters, getSeasonMaster, safeErrorMessage } from '../core/dataHub.js';

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function title(id) { return String(id || '').replaceAll('_', ' '); }

function previewCard(seasonId, league, master) {
  const summary = master?.sections?.league_summary?.[league] || {};
  const players = (master?.sections?.players || []).filter((p) => p.league === league);
  const top1 = [...players].sort((a, b) => (b.rating_end || 0) - (a.rating_end || 0))[0];
  const label = league === 'kids' ? 'Дитяча ліга' : 'Доросла ліга';
  return `<article class="px-card season-list-card"><h3>${label}</h3><p>Ігри: <strong>${summary.matches ?? summary.games ?? 'Немає даних'}</strong></p><p>Гравці: <strong>${summary.players ?? players.length}</strong></p><p>Топ-1: <strong>${esc(top1?.nickname || 'Немає даних')}</strong></p><a class="btn btn--secondary" href="#season?season=${encodeURIComponent(seasonId)}&league=${league}">Відкрити лігу</a></article>`;
}

export async function initSeasonsPage() {
  const root = document.getElementById('seasonsRoot') || document.getElementById('view');
  if (!root) return;
  root.innerHTML = '<section class="px-card"><p class="px-card__text">Завантаження сезонів…</p></section>';

  try {
    const seasons = await listSeasonMasters();
    if (!Array.isArray(seasons) || seasons.length === 0) {
      root.innerHTML = '<section class="px-card"><p class="px-card__text">Сезони недоступні.</p></section>';
      return;
    }
    const masters = await Promise.all(seasons.map(async (id) => [id, await getSeasonMaster(id).catch(() => null)]));

    root.innerHTML = `<section class="season-list">${masters.map(([seasonId, master]) => {
      const meta = master?.sections?.season_meta || {};
      return `<article class="px-card px-card--accent"><h2>${esc(title(seasonId))}</h2><p>Період: ${esc(meta.period || meta.date_range || 'Немає даних')}</p><div class="kpi kpi-2">${previewCard(seasonId, 'kids', master)}${previewCard(seasonId, 'sundaygames', master)}</div></article>`;
    }).join('')}</section>`;
  } catch (error) {
    root.innerHTML = `<section class="px-card"><p class="px-card__text">${esc(safeErrorMessage(error, 'Помилка завантаження сезонів'))}</p></section>`;
  }
}
