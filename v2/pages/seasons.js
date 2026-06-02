import { listSeasonMasters, getSeasonMaster, safeErrorMessage } from '../core/dataHub.js';
import { leagueLabelUA } from '../core/naming.js';

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function titleFromId(id = '') {
  const known = {
    spring_2026: 'Весна 2026',
    winter_2025_2026: 'Зима 2025–2026',
    autumn_2025: 'Осінь 2025',
    summer_2025: 'Літо 2025'
  };
  return known[id] || String(id || 'Сезон').replaceAll('_', ' ');
}

function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function periodText(meta = {}) {
  const start = meta.dateStart || meta.date_start || meta.Date_start || meta.start || '';
  const end = meta.dateEnd || meta.date_end || meta.Date_end || meta.end || '';
  if (start && end) return `${start} - ${end}`;
  return meta.period || meta.date_range || meta.dateRange || 'Архівний сезон';
}

function leaguePreview(seasonId, league, master) {
  const sections = master?.sections || {};
  const summary = sections.league_summary?.[league] || {};
  const players = (Array.isArray(sections.players) ? sections.players : [])
    .filter((player) => player.league === league);
  const leader = [...players].sort((a, b) => numberValue(b.rating_end, -1) - numberValue(a.rating_end, -1))[0];
  const topMvp = [...players].sort((a, b) => numberValue(b.mvp_total, 0) - numberValue(a.mvp_total, 0))[0];
  const games = numberValue(summary.matches ?? summary.games, players.reduce((sum, p) => sum + numberValue(p.matches, 0), 0));
  const active = numberValue(summary.players ?? summary.activePlayers, players.filter((p) => numberValue(p.matches, 0) > 0).length);

  return `<article class="season-archive-league">
    <div class="season-archive-league__top">
      <span>${esc(leagueLabelUA(league))}</span>
      <strong>${active}</strong>
    </div>
    <div class="season-archive-league__leader">
      <span>Лідер</span>
      <strong>${esc(leader?.nickname || 'Немає даних')}</strong>
      <em>${leader ? `${numberValue(leader.rating_end)} очок` : '—'}</em>
    </div>
    <div class="season-archive-league__meta">
      <span>${games} ігор</span>
      <span>MVP: ${esc(topMvp?.nickname || '—')}</span>
    </div>
    <a class="season-archive-link" href="#season?season=${encodeURIComponent(seasonId)}&league=${encodeURIComponent(league)}">Відкрити сезон</a>
  </article>`;
}

function seasonCard(seasonId, master) {
  const sections = master?.sections || {};
  const meta = sections.season_meta || {};
  const title = meta.title || meta.seasonTitle || titleFromId(seasonId);
  const players = Array.isArray(sections.players) ? sections.players : [];
  const activePlayers = players.filter((p) => numberValue(p.matches, 0) > 0).length;
  const totalMatches = ['sundaygames', 'kids']
    .reduce((sum, league) => sum + numberValue(sections.league_summary?.[league]?.matches ?? sections.league_summary?.[league]?.games, 0), 0);

  return `<article class="season-archive-card">
    <header class="season-archive-card__head">
      <div>
        <p class="season-archive-card__eyebrow">Архів сезону</p>
        <h2>${esc(title)}</h2>
        <span>${esc(periodText(meta))}</span>
      </div>
      <a class="season-archive-card__open" href="#season?season=${encodeURIComponent(seasonId)}&league=sundaygames">Деталі</a>
    </header>
    <div class="season-archive-card__stats">
      <div><strong>${totalMatches}</strong><span>ігор</span></div>
      <div><strong>${activePlayers}</strong><span>активних</span></div>
      <div><strong>${players.length}</strong><span>записів</span></div>
    </div>
    <div class="season-archive-card__leagues">
      ${leaguePreview(seasonId, 'sundaygames', master)}
      ${leaguePreview(seasonId, 'kids', master)}
    </div>
  </article>`;
}

export async function initSeasonsPage() {
  const root = document.getElementById('seasonsRoot') || document.getElementById('view');
  if (!root) return;

  root.innerHTML = `<section class="seasons-archive-page">
    <header class="season-archive-hero">
      <p>АРХІВ РЕЙТИНГУ</p>
      <h1>Сезони</h1>
      <span>Підсумки ліг, топи, MVP, приріст рейтингу і фінальні місця гравців.</span>
    </header>
    <section class="season-archive-loading">Завантаження архівів...</section>
  </section>`;

  try {
    const seasons = await listSeasonMasters();
    if (!Array.isArray(seasons) || !seasons.length) {
      root.querySelector('.season-archive-loading').textContent = 'Архіви сезонів поки недоступні.';
      return;
    }

    const masters = await Promise.all(seasons.map(async (seasonId) => {
      const master = await getSeasonMaster(seasonId).catch(() => null);
      return [seasonId, master];
    }));

    root.innerHTML = `<section class="seasons-archive-page">
      <header class="season-archive-hero">
        <p>АРХІВ РЕЙТИНГУ</p>
        <h1>Сезони</h1>
        <span>Підсумки ліг, топи, MVP, приріст рейтингу і фінальні місця гравців.</span>
      </header>
      <div class="season-archive-list">
        ${masters.map(([seasonId, master]) => seasonCard(seasonId, master)).join('')}
      </div>
    </section>`;
  } catch (error) {
    root.innerHTML = `<section class="season-archive-hero">
      <p>АРХІВ РЕЙТИНГУ</p>
      <h1>Сезони</h1>
      <span>${esc(safeErrorMessage(error, 'Не вдалося завантажити архіви сезонів'))}</span>
    </section>`;
  }
}
