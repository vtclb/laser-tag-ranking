import { getLeagueSnapshot, getSeasonsList, safeErrorMessage } from '../core/dataHub.js';
import { normalizeLeague, leagueLabelUA, toDataHubLeague } from '../core/naming.js';

function getViewRoot() {
  return document.getElementById('view');
}

function renderError(root, message) {
  root.innerHTML = `<section class="px-card px-card--accent"><h1 class="px-card__title">Статистика ліги</h1><p class="px-card__text">${message}</p><div class="px-card__actions"><a class="btn" href="#main">На головну</a></div></section>`;
}

function playerRow(player = {}) {
  return `<tr><td>${player.place ?? '—'}</td><td>${player.nick || '—'}</td><td>${player.points ?? 0}</td><td>${player.games ?? 0}</td><td>${player.winRate ?? 0}%</td><td><span class="rank-badge rank--${String(player.rankLetter || 'F').toUpperCase()}">${String(player.rankLetter || 'F').toUpperCase()}</span></td></tr>`;
}

export async function initLeagueStatsPage(params = {}) {
  const root = getViewRoot();
  if (!root) return;

  const league = normalizeLeague(params.league);
  if (!league) {
    renderError(root, 'Не вказано лігу');
    return;
  }

  root.innerHTML = `<section class="px-card px-card--accent"><h1 class="px-card__title">Статистика · ${leagueLabelUA(league)}</h1><p class="px-card__text" id="leagueStatsState">Завантаження…</p></section><section class="px-card"><div class="table-wrap"><table><thead><tr><th>#</th><th>Гравець</th><th>Pts</th><th>Ігор</th><th>WR</th><th>Ранг</th></tr></thead><tbody id="leagueStatsRows"><tr><td colspan="6">Завантаження…</td></tr></tbody></table></div></section>`;

  const state = document.getElementById('leagueStatsState');
  const rows = document.getElementById('leagueStatsRows');
  if (!state || !rows) {
    renderError(root, 'Не вдалося підготувати сторінку статистики');
    return;
  }

  try {
    const seasons = await getSeasonsList();
    const seasonId = seasons[0]?.id;
    if (!seasonId) {
      state.textContent = 'Немає даних';
      rows.innerHTML = '<tr><td colspan="6">Немає даних</td></tr>';
      return;
    }

    const snapshot = await getLeagueSnapshot(toDataHubLeague(league), seasonId);
    const tableRows = Array.isArray(snapshot?.table) ? snapshot.table : [];

    state.textContent = `${snapshot?.seasonTitle || seasonId} · ${leagueLabelUA(league)}`;
    rows.innerHTML = tableRows.length
      ? tableRows.map(playerRow).join('')
      : '<tr><td colspan="6">Немає даних</td></tr>';
  } catch (error) {
    const message = safeErrorMessage(error, 'Дані тимчасово недоступні');
    state.textContent = message;
    rows.innerHTML = `<tr><td colspan="6">${message}</td></tr>`;
  }
}
