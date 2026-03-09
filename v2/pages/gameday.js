import { getLeagueLiveData, safeErrorMessage } from '../core/dataHub.js';
import { normalizeLeague, leagueLabelUA } from '../core/naming.js';

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function fmt(v) { const n = Number(v) || 0; return `${n > 0 ? '+' : ''}${n}`; }

function resolveLeague() {
  const qp = new URLSearchParams(location.search);
  return normalizeLeague(qp.get('league') || 'sundaygames') || 'sundaygames';
}

function summaryFromGames(games = []) {
  const date = games[0]?.timestamp || '—';
  const players = new Set(games.flatMap((g) => g.teams || []).map((n) => String(n || '').trim().toLowerCase()).filter(Boolean));
  const mvp = games[0]?.mvp || '—';
  return { date, matches: games.length, players: players.size, mvp };
}

function render(root, league, data) {
  const games = (data.recentGames || []).slice(0, 12);
  const logs = (data.recentLogs || []).slice(0, 20);
  const summary = summaryFromGames(games);
  const grow = [...(data.players || [])].sort((a, b) => (b.delta || 0) - (a.delta || 0))[0];
  const minus = [...(data.players || [])].sort((a, b) => (a.delta || 0) - (b.delta || 0))[0];
  const mvp = [...(data.players || [])].sort((a, b) => (b.mvp || 0) - (a.mvp || 0))[0];

  root.innerHTML = `<section class="px-card home-card"><h1 class="px-card__title">Ігровий день / Логи</h1>
    <div class="season-controls-row"><label>Ліга <select id="leagueFilter" class="search-input"><option value="sundaygames" ${league === 'sundaygames' ? 'selected' : ''}>Доросла</option><option value="kids" ${league === 'kids' ? 'selected' : ''}>Дитяча</option></select></label></div>
    <p class="px-card__text">${esc(leagueLabelUA(league))} · Останній день: ${esc(summary.date)}</p>
    <div class="px-card__actions"><a class="btn" href="./${league === 'kids' ? 'kids' : 'sunday'}.html">Назад до ліги</a></div>
  </section>

  <section class="px-card home-card"><h2 class="px-card__title">Summary дня</h2><div class="home-stats-strip"><span>Матчів: ${summary.matches}</span><span>Гравців: ${summary.players}</span><span>MVP: ${esc(summary.mvp)}</span><span>Активність: ${data.summary?.avgActivity || 0}</span></div></section>

  <section class="px-card home-card"><h2 class="px-card__title">Список матчів</h2><div class="home-full-list">${games.map((g) => `<div class="home-player-row"><strong>${esc(g.winner || '—')}</strong><span>${esc((g.teams || []).join(', '))}</span><span>MVP: ${esc(g.mvp || '—')}</span><span>Серія: ${esc(g.series || '—')}</span><span>${esc(g.timestamp || '—')}</span></div>`).join('') || '<p class="px-card__text">Немає матчів</p>'}</div></section>

  <section class="px-card home-card"><h2 class="px-card__title">Логи рейтингу</h2><div class="home-full-list">${logs.map((l) => `<div class="home-player-row"><strong>${esc(l.nickname)}</strong><span>${fmt(l.delta)}</span><span>${l.newPoints ?? '—'}</span><span>${esc(l.timestamp || '—')}</span></div>`).join('') || '<p class="px-card__text">Немає логів</p>'}</div></section>

  <section class="px-card home-card"><h2 class="px-card__title">Лідери дня</h2><div class="home-progress-grid">
    <article class="home-card"><h3>Найбільший приріст</h3><p>${esc(grow?.nickname || '—')} · ${fmt(grow?.delta)}</p></article>
    <article class="home-card"><h3>Найбільша втрата</h3><p>${esc(minus?.nickname || '—')} · ${fmt(minus?.delta)}</p></article>
    <article class="home-card"><h3>MVP дня</h3><p>${esc(mvp?.nickname || '—')} · ${mvp?.mvp || 0} MVP</p></article>
  </div></section>`;

  root.querySelector('#leagueFilter')?.addEventListener('change', (event) => {
    const lg = normalizeLeague(event.target.value) || 'sundaygames';
    location.search = `?league=${encodeURIComponent(lg)}`;
  });
}

export async function initGameDayPage() {
  const root = document.getElementById('view');
  if (!root) return;
  root.innerHTML = '<section class="px-card home-card"><h1 class="px-card__title">Ігровий день</h1><p class="px-card__text">Завантаження…</p></section>';
  try {
    const league = resolveLeague();
    const data = await getLeagueLiveData(league);
    render(root, league, data);
  } catch (error) {
    root.innerHTML = `<section class="px-card home-card"><h1 class="px-card__title">Ігровий день</h1><p class="px-card__text">${esc(safeErrorMessage(error, 'Помилка завантаження'))}</p></section>`;
  }
}

if (document.getElementById('view') && !window.location.hash) initGameDayPage();
