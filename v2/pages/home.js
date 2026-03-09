import { listSeasonMasters, getSeasonMaster, safeErrorMessage } from '../core/dataHub.js';
import { leagueLabelUA, normalizeLeague } from '../core/naming.js';

const HOME_CURRENT_SEASON = { id: 'spring_2026', label: 'Весна 2026' };
const HOME_LEAGUES = ['sundaygames', 'kids'];

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function toNum(v, fb = null) { const n = Number(v); return Number.isFinite(n) ? n : fb; }
function fmtSigned(v) {
  const n = toNum(v, null);
  if (n === null) return '—';
  return `${n > 0 ? '+' : ''}${n}`;
}

function pickTopPlayers(players = [], league, limit = 10) {
  return players
    .filter((p) => normalizeLeague(p.league) === league)
    .sort((a, b) => (toNum(b.rating_end, -1e9) - toNum(a.rating_end, -1e9)) || (toNum(b.matches, 0) - toNum(a.matches, 0)))
    .slice(0, limit);
}

function statValue(value) {
  return value === null || value === undefined || value === '' ? '—' : esc(value);
}

function heroCard(player, league, isPrimary = false) {
  if (!player) return `<article class="px-card home-card ${isPrimary ? 'home-hero-card home-hero-card--primary' : 'home-hero-card'}"><h3>${esc(leagueLabelUA(league))}</h3><p class="px-card__text">Немає даних</p></article>`;
  const nickname = player.nickname || player.nick || 'Невідомий гравець';
  return `<article class="px-card home-card ${isPrimary ? 'home-hero-card home-hero-card--primary' : 'home-hero-card'}">
    <div class="home-hero-card__head">
      <span class="px-badge">${esc(leagueLabelUA(league))}</span>
      <strong class="home-hero-card__place">#1</strong>
    </div>
    <h3 class="home-hero-card__name">${esc(nickname)}</h3>
    <p class="home-hero-card__rating">Rank: <strong>${statValue(player.rank_final || player.rank)}</strong> · Points: <strong>${statValue(player.rating_end)}</strong></p>
    <div class="home-stats-strip">
      <span>Ігри <strong>${statValue(player.matches)}</strong></span>
      <span>Перемоги <strong>${statValue(player.wins)}</strong></span>
      <span>Нічиї <strong>${statValue(player.draws)}</strong></span>
      <span>Поразки <strong>${statValue(player.losses)}</strong></span>
      <span>MVP <strong>${statValue(player.mvp_total)}</strong></span>
      <span>Δ <strong>${fmtSigned(player.rating_delta)}</strong></span>
    </div>
  </article>`;
}

function rankBalanceCard(players = []) {
  const rankMap = players.reduce((acc, p) => {
    const rank = String(p.rank_final || '—').toUpperCase();
    acc[rank] = (acc[rank] || 0) + 1;
    return acc;
  }, {});
  const total = players.length || 1;
  const rows = Object.entries(rankMap).sort(([a], [b]) => a.localeCompare(b, 'uk'));
  if (!rows.length) return '<p class="px-card__text">Немає даних</p>';
  return `<div class="home-rank-balance">${rows.map(([rank, count]) => {
    const width = Math.max(8, Math.round((count / total) * 100));
    return `<div class="home-rank-row"><span class="home-rank-row__label">${esc(rank)}</span><div class="home-rank-row__bar"><span style="width:${width}%"></span></div><strong>${count}</strong></div>`;
  }).join('')}</div>`;
}

function progressCard(players = []) {
  const withDelta = players
    .map((p) => ({ ...p, delta: toNum(p.rating_delta, null) }))
    .filter((p) => p.delta !== null)
    .sort((a, b) => b.delta - a.delta);

  const up = withDelta.slice(0, 3);
  const down = [...withDelta].reverse().slice(0, 3);
  const list = (rows, title) => `<div><h5>${title}</h5>${rows.length ? `<ul>${rows.map((p) => `<li>${esc(p.nickname || '—')} <strong>${fmtSigned(p.delta)}</strong></li>`).join('')}</ul>` : '<p class="px-card__text">Немає даних</p>'}</div>`;
  return `<div class="home-progress-grid">${list(up, 'Найбільший ріст')}${list(down, 'Найбільша втрата')}</div>`;
}

function topPlayersCard(players = []) {
  if (!players.length) return '<p class="px-card__text">Немає даних</p>';
  return `<div class="home-top-list">${players.slice(0, 10).map((p, idx) => `<article class="home-top-item"><span class="home-top-item__n">#${idx + 1}</span><div><strong>${esc(p.nickname || '—')}</strong><p>Points ${statValue(p.rating_end)} · Δ ${fmtSigned(p.rating_delta)} · MVP ${statValue(p.mvp_total)}</p></div></article>`).join('')}</div>`;
}

function logsCard(series = [], updatedAt = '') {
  const rows = Array.isArray(series) ? series.slice(0, 4) : [];
  if (!rows.length && !updatedAt) return '<p class="px-card__text">Немає даних</p>';
  return `<div class="home-logs"><p class="px-card__text">Останній день: ${esc(updatedAt || 'Немає даних')}</p>${rows.length ? `<ul>${rows.map((item) => `<li>${esc(item.format || item.series || 'Оновлення')}: <strong>${esc(item.count ?? item.total ?? '—')}</strong>${item.percent || item.share ? ` · ${esc(item.percent || item.share)}%` : ''}</li>`).join('')}</ul>` : ''}</div>`;
}

function leagueSummary(summary = {}, players = []) {
  const matches = toNum(summary.matches ?? summary.games, players.reduce((s, p) => s + (toNum(p.matches, 0) || 0), 0)) || 0;
  const participants = toNum(summary.players ?? summary.active_players, players.length) || players.length;
  const avgRating = toNum(summary.avg_rating ?? summary.average_rating, null);
  return `<div class="home-summary-strip"><span>Матчі <strong>${matches}</strong></span><span>Гравці <strong>${participants}</strong></span><span>Середній рейтинг <strong>${avgRating ?? '—'}</strong></span></div>`;
}

function renderLeagueSection({ league, summary, players, series, updatedAt, expanded }) {
  return `<section class="px-card home-card home-league" data-league="${league}">
    <div class="home-league__head"><h3>${esc(leagueLabelUA(league))}</h3><button class="btn btn--secondary home-expand-btn ${expanded ? 'is-active' : ''}" data-toggle-league="${league}">Розгорнути статистику</button></div>
    ${leagueSummary(summary, players)}
    <div class="home-expanded ${expanded ? 'is-open' : ''}" id="expanded-${league}">
      <article class="home-panel"><h4>Топ гравців</h4>${topPlayersCard(players)}</article>
      <article class="home-panel"><h4>Прогрес ліги</h4>${progressCard(players)}</article>
      <article class="home-panel"><h4>Логи останнього ігрового дня</h4>${logsCard(series, updatedAt)}</article>
      <article class="home-panel"><h4>Баланс рангів</h4>${rankBalanceCard(players)}</article>
    </div>
  </section>`;
}

export async function initHomePage() {
  const root = document.getElementById('view');
  if (!root) return;
  root.classList.add('home-v2');
  root.innerHTML = `<section class="hero home-hero"><span class="hero__kicker">HOME V2</span><h1 class="hero__title">LaserTag Ranking</h1><p class="hero__subtitle">Сезонний рейтинг, ключові герої та актуальна динаміка ліг.</p><p class="home-current-season" id="heroText">Актуальний сезон: ${HOME_CURRENT_SEASON.label}</p><p class="px-card__text" id="stateBox" aria-live="polite"></p><div class="hero__actions"><a class="btn btn--primary" href="#seasons">Сезони</a><a class="btn btn--secondary" href="#rules">Правила</a></div></section>
  <div class="px-divider"></div>
  <section class="section"><h2 class="px-card__title">Герої сезону</h2><div class="home-heroes" id="topHeroes"></div></section>
  <section class="section" id="leagueSections"></section>`;

  const stateBox = document.getElementById('stateBox');
  const topHeroes = document.getElementById('topHeroes');
  const leagueSections = document.getElementById('leagueSections');
  if (!stateBox || !topHeroes || !leagueSections) return;

  const state = { expandedLeague: 'sundaygames', sections: null };

  function renderLeagues(data) {
    leagueSections.innerHTML = HOME_LEAGUES.map((league) => {
      const players = pickTopPlayers(data.playersAll, league, 200);
      return renderLeagueSection({
        league,
        summary: data.leagueSummary[league] || {},
        players,
        series: data.seriesSummary[league] || [],
        updatedAt: data.updatedAt,
        expanded: state.expandedLeague === league
      });
    }).join('');

    leagueSections.querySelectorAll('[data-toggle-league]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.expandedLeague = btn.getAttribute('data-toggle-league') || 'sundaygames';
        renderLeagues(data);
      });
    });
  }

  try {
    const seasons = await listSeasonMasters();
    const fetchSeasonId = seasons.includes(HOME_CURRENT_SEASON.id) ? HOME_CURRENT_SEASON.id : (seasons[0] || HOME_CURRENT_SEASON.id);
    const master = await getSeasonMaster(fetchSeasonId);
    const sections = master?.sections || {};
    const playersAll = Array.isArray(sections.players) ? sections.players : [];

    window.__v2LastSeason = { kids: fetchSeasonId, olds: fetchSeasonId, sundaygames: fetchSeasonId };
    stateBox.textContent = sections?.season_meta?.updated_at ? `Оновлено: ${sections.season_meta.updated_at}` : 'Дані сезону оновлюються автоматично.';

    const data = {
      playersAll,
      leagueSummary: sections.league_summary || {},
      seriesSummary: sections.series_summary || {},
      updatedAt: sections?.season_meta?.updated_at || ''
    };

    const adultTop = pickTopPlayers(playersAll, 'sundaygames', 1)[0];
    const kidsTop = pickTopPlayers(playersAll, 'kids', 1)[0];
    topHeroes.innerHTML = heroCard(adultTop, 'sundaygames', true) + heroCard(kidsTop, 'kids');
    renderLeagues(data);
  } catch (error) {
    const msg = safeErrorMessage(error, 'Дані тимчасово недоступні');
    stateBox.textContent = msg;
    topHeroes.innerHTML = `<article class="px-card home-card"><p class="px-card__text">${esc(msg)}</p></article>`;
    leagueSections.innerHTML = '';
  }
}
