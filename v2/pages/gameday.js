import { getGameDay, safeErrorMessage } from '../core/dataHub.js';
import { normalizeLeague, leagueLabelUA } from '../core/naming.js';
import { getRouteState } from '../core/utils.js';

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function fmt(v) { const n = Number(v) || 0; return `${n > 0 ? '+' : ''}${n}`; }

function resolveParams(params = {}) {
  const { query: qp } = getRouteState();
  const league = normalizeLeague(params.league || qp.get('league') || 'sundaygames') || 'sundaygames';
  const date = String(params.date || qp.get('date') || '').trim();
  return { league, date };
}

function buildHash(route, params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') q.set(key, String(value));
  });
  const qs = q.toString();
  return `#${route}${qs ? `?${qs}` : ''}`;
}

function render(root, league, data) {
  const players = Array.isArray(data.activePlayers) ? data.activePlayers : [];
  const matches = Array.isArray(data.matches) ? data.matches : [];

  root.innerHTML = `<section class="px-card"><h1 class="px-card__title">Ігровий день</h1>
    <p class="px-card__text">${esc(leagueLabelUA(league))} · Дата: <strong>${esc(data.date || '—')}</strong></p>
    <div class="season-controls-row">
      <label>Ліга
        <select id="leagueFilter" class="search-input">
          <option value="sundaygames" ${league === 'sundaygames' ? 'selected' : ''}>Доросла</option>
          <option value="kids" ${league === 'kids' ? 'selected' : ''}>Дитяча</option>
        </select>
      </label>
      <label>Дата
        <input id="dateFilter" class="search-input" type="date" value="${esc(data.date || '')}">
      </label>
    </div>
    <div class="league-summary-strip"><span>Матчів: ${data.gamesCount ?? 0}</span><span>Боїв: ${data.battlesCount ?? 0}</span><span>Раундів: ${data.roundsCount ?? 0}</span><span>Активних гравців: ${players.length}</span></div>
    <div class="px-card__actions"><a class="btn btn--secondary" href="${buildHash('league-stats', { league })}">Назад до ліги</a></div>
  </section>

  <section class="px-card"><h2 class="px-card__title">Гравці дня</h2>
    <div class="league-table-shell"><div class="league-table-header"><span>Нік</span><span>Матчі</span><span>MVP</span><span>W</span><span>D</span><span>L</span></div>
      <div class="league-table-list">${players.map((p) => `<div class="league-table-row"><span class="league-table-cell">${esc(p.nick)}</span><span class="league-table-cell">${p.matchesToday ?? 0}</span><span class="league-table-cell">${p.mvpToday ?? 0}</span><span class="league-table-cell">${p.winsToday ?? 0}</span><span class="league-table-cell">${p.drawsToday ?? 0}</span><span class="league-table-cell">${p.lossesToday ?? 0}</span></div>`).join('') || '<p class="px-card__text">Немає даних за цей день.</p>'}</div>
    </div>
  </section>

  <section class="px-card"><h2 class="px-card__title">Матчі дня</h2>
    <div class="home-full-list">${matches.map((m) => `<div class="home-player-row"><strong>${esc(m.winner || '—')}</strong><span>${esc([...(m.teams?.sideA || []), ...(m.teams?.sideB || []), ...(m.teams?.sideC || []), ...(m.teams?.sideD || [])].join(', '))}</span><span>MVP: ${esc(m.mvp || '—')}</span><span>Серія: ${esc(m.seriesSummary || m.series || '—')}</span><span>${esc(m.timestamp || '—')}</span></div>`).join('') || '<p class="px-card__text">Немає матчів за цей день.</p>'}</div>
  </section>`;

  root.querySelector('#leagueFilter')?.addEventListener('change', (event) => {
    const nextLeague = normalizeLeague(event.target.value) || 'sundaygames';
    const dateValue = root.querySelector('#dateFilter')?.value || data.date || '';
    location.hash = buildHash('gameday', { league: nextLeague, date: dateValue });
  });

  root.querySelector('#dateFilter')?.addEventListener('change', (event) => {
    const nextDate = String(event.target.value || '').trim();
    location.hash = buildHash('gameday', { league, date: nextDate });
  });
}

export async function initGameDayPage(params = {}) {
  const root = document.getElementById('gamedayRoot') || document.getElementById('view');
  if (!root) return;
  root.innerHTML = '<section class="px-card"><h1 class="px-card__title">Ігровий день</h1><p class="px-card__text">Завантаження…</p></section>';
  try {
    const { league, date } = resolveParams(params);
    const data = await getGameDay({ league, date });
    render(root, league, data);
  } catch (error) {
    root.innerHTML = `<section class="px-card"><h1 class="px-card__title">Ігровий день</h1><p class="px-card__text">${esc(safeErrorMessage(error, 'Помилка завантаження'))}</p></section>`;
  }
}
