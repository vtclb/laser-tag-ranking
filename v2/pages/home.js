import { listSeasonMasters, getSeasonMaster, safeErrorMessage } from '../core/dataHub.js';
import { leagueLabelUA } from '../core/naming.js';

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function title(id) { return String(id || '').replaceAll('_', ' '); }

function top5(players = [], league) {
  return players.filter((p) => p.league === league).sort((a, b) => (b.rating_end || 0) - (a.rating_end || 0)).slice(0, 5);
}

function heroesCard(players, league) {
  const rows = top5(players, league).map((player, index) => `<li>#${index + 1} ${esc(player.nickname)} · рейтинг ${player.rating_end ?? 'Немає даних'}${player.matches ? ` · матчі ${player.matches}` : ''}</li>`).join('');
  return `<article class="px-card"><h3>${leagueLabelUA(league)}</h3>${rows ? `<ol>${rows}</ol>` : '<p class="px-card__text">Немає даних</p>'}</article>`;
}

export async function initHomePage() {
  const root = document.getElementById('view');
  if (!root) return;
  root.innerHTML = `<section class="hero"><h1 class="hero__title">LaserTag Ranking</h1><p class="hero__subtitle" id="heroText">Завантаження актуального сезону…</p><p class="px-card__text" id="stateBox" aria-live="polite"></p><div class="hero__actions"><a class="btn btn--primary" href="#seasons">Сезони</a><a class="btn btn--secondary" href="#rules">Правила</a></div></section><div class="px-divider"></div><section class="section"><h2 class="px-card__title">Герої сезону</h2><div class="hero-grid section" id="topHeroes"></div></section>`;

  const heroText = document.getElementById('heroText');
  const stateBox = document.getElementById('stateBox');
  const topHeroes = document.getElementById('topHeroes');
  if (!heroText || !stateBox || !topHeroes) return;

  try {
    const seasons = await listSeasonMasters();
    const currentSeason = seasons.includes('winter_2025_2026') ? 'winter_2025_2026' : seasons[0];
    const master = await getSeasonMaster(currentSeason);
    const players = Array.isArray(master?.sections?.players) ? master.sections.players : [];

    window.__v2LastSeason = { kids: currentSeason, sundaygames: currentSeason };
    heroText.textContent = `Актуальний сезон: ${title(currentSeason)}`;
    stateBox.textContent = master?.sections?.season_meta?.updated_at ? `Оновлено: ${master.sections.season_meta.updated_at}` : '';
    topHeroes.innerHTML = heroesCard(players, 'kids') + heroesCard(players, 'sundaygames');
  } catch (error) {
    const msg = safeErrorMessage(error, 'Дані тимчасово недоступні');
    stateBox.textContent = msg;
    topHeroes.innerHTML = `<article class="px-card"><p class="px-card__text">${esc(msg)}</p></article>`;
  }
}
