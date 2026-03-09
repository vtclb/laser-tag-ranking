import { getLeagueSnapshot, getSeasonsList, safeErrorMessage } from '../core/dataHub.js';
import { normalizeLeague, leagueLabelUA, toDataHubLeague } from '../core/naming.js';

function rankBadge(rank) {
  const label = String(rank || 'F').toUpperCase();
  return `<span class="rank-badge rank--${label}">${label}</span>`;
}

function renderError(root, message) {
  root.innerHTML = `<section class="px-card px-card--accent"><h1 class="px-card__title">Статистика ліги</h1><p class="px-card__text">${message}</p></section>`;
}

function sortRows(rows, sortBy = 'points') {
  const copy = [...rows];
  const val = (item, key) => Number(item?.[key]) || 0;
  if (sortBy === 'games') copy.sort((a, b) => val(b, 'games') - val(a, 'games'));
  else if (sortBy === 'wr') copy.sort((a, b) => val(b, 'winRate') - val(a, 'winRate'));
  else copy.sort((a, b) => val(b, 'points') - val(a, 'points'));
  return copy;
}

function renderTable(rows, sortBy) {
  const sorted = sortRows(rows, sortBy);
  return sorted.map((player, idx) => `<tr><td>${idx + 1}</td><td>${player.nick || '—'}</td><td>${player.points ?? 0}</td><td>${player.games ?? 0}</td><td>${player.winRate ?? 0}%</td><td>${rankBadge(player.rankLetter)}</td></tr>`).join('');
}

export async function initLeagueStatsPage(params = {}) {
  const root = document.getElementById('view');
  if (!root) return;

  const league = normalizeLeague(params.league) || 'kids';
  root.innerHTML = `<section class="px-card px-card--accent"><h1 class="px-card__title">Статистика · ${leagueLabelUA(league)}</h1><p class="px-card__text" id="leagueStatsState">Завантаження…</p></section><section class="px-card"><div class="season-controls-row"><select id="leagueSort" class="search-input"><option value="points">Сортувати: Очки</option><option value="games">Сортувати: Ігри</option><option value="wr">Сортувати: WR</option></select></div><div class="season-table-wrap"><table class="season-table league-table"><thead><tr><th>#</th><th>Гравець</th><th>Очки</th><th>Ігор</th><th>WR</th><th>Ранг</th></tr></thead><tbody id="leagueStatsRows"><tr><td colspan="6">Завантаження…</td></tr></tbody></table></div></section>`;

  const state = document.getElementById('leagueStatsState');
  const rowsEl = document.getElementById('leagueStatsRows');
  const sortEl = document.getElementById('leagueSort');
  if (!state || !rowsEl || !sortEl) return renderError(root, 'Не вдалося підготувати інтерфейс');

  try {
    const seasons = await getSeasonsList();
    const latestSeasonId = seasons?.[0]?.id;
    if (!latestSeasonId) throw new Error('Немає доступних сезонів');

    const snapshot = await getLeagueSnapshot(toDataHubLeague(league), latestSeasonId);
    const tableRows = Array.isArray(snapshot?.table) ? snapshot.table : [];
    state.textContent = `${snapshot?.seasonTitle || latestSeasonId}`;

    const paint = () => {
      rowsEl.innerHTML = tableRows.length ? renderTable(tableRows, sortEl.value) : '<tr><td colspan="6">Немає даних</td></tr>';
    };
    sortEl.addEventListener('change', paint);
    paint();
  } catch (error) {
    renderError(root, safeErrorMessage(error, 'Помилка завантаження статистики'));
  }
}
