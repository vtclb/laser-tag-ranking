import { listSeasonMasters, getSeasonMaster, safeErrorMessage } from '../core/dataHub.js';
import { leagueLabelUA, normalizeLeague } from '../core/naming.js';

const HOME_CURRENT_SEASON = { id: 'spring_2026', label: 'Весна 2026' };
const HOME_LEAGUES = ['sundaygames', 'kids'];
const RANK_ORDER = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function toNum(v, fb = null) { const n = Number(v); return Number.isFinite(n) ? n : fb; }
function fmtSigned(v) {
  const n = toNum(v, null);
  if (n === null) return '—';
  return `${n > 0 ? '+' : ''}${n}`;
}

function normalizeHomePlayer(row = {}) {
  const league = normalizeLeague(row.league);
  if (!HOME_LEAGUES.includes(league)) return null;
  const nickname = String(row.nickname || row.nick || '').trim();
  if (!nickname) return null;
  const rankRaw = row.rank_final ?? row.rank;
  const rankFinal = toNum(rankRaw, null);
  return {
    league,
    nickname,
    matches: toNum(row.matches, 0) || 0,
    wins: toNum(row.wins, 0) || 0,
    draws: toNum(row.draws, 0) || 0,
    losses: toNum(row.losses, 0) || 0,
    mvp_total: toNum(row.mvp_total, 0) || 0,
    rating_end: toNum(row.rating_end, null),
    rating_delta: toNum(row.rating_delta, 0) || 0,
    rank_final: rankFinal,
    rank_text: rankRaw
  };
}

function selectBetterPlayer(a, b) {
  const aRanked = Number.isFinite(a.rank_final);
  const bRanked = Number.isFinite(b.rank_final);
  if (aRanked !== bRanked) return aRanked ? a : b;
  const ratingDiff = toNum(a.rating_end, -1e9) - toNum(b.rating_end, -1e9);
  if (ratingDiff !== 0) return ratingDiff > 0 ? a : b;
  const matchesDiff = (a.matches || 0) - (b.matches || 0);
  if (matchesDiff !== 0) return matchesDiff > 0 ? a : b;
  return a;
}

function dedupeHomePlayers(players = []) {
  const map = new Map();
  players.map(normalizeHomePlayer).filter(Boolean).forEach((player) => {
    const key = `${player.league}::${player.nickname.toLowerCase()}`;
    const existing = map.get(key);
    map.set(key, existing ? selectBetterPlayer(existing, player) : player);
  });
  return [...map.values()];
}

function sortForHero(a, b) {
  const aRank = Number.isFinite(a.rank_final) ? a.rank_final : 1e6;
  const bRank = Number.isFinite(b.rank_final) ? b.rank_final : 1e6;
  if (aRank !== bRank) return aRank - bRank;
  const ratingDiff = toNum(b.rating_end, -1e9) - toNum(a.rating_end, -1e9);
  if (ratingDiff !== 0) return ratingDiff;
  return (b.mvp_total || 0) - (a.mvp_total || 0);
}

function pickTopPlayers(players = [], league, limit = 10) {
  return players
    .filter((p) => p.league === league)
    .sort((a, b) => {
      const rankDiff = (Number.isFinite(a.rank_final) ? a.rank_final : 1e6) - (Number.isFinite(b.rank_final) ? b.rank_final : 1e6);
      if (rankDiff !== 0) return rankDiff;
      return (toNum(b.rating_end, -1e9) - toNum(a.rating_end, -1e9)) || ((b.matches || 0) - (a.matches || 0));
    })
    .slice(0, limit);
}

function statValue(value) {
  return value === null || value === undefined || value === '' ? '—' : esc(value);
}

function heroMetrics(player) {
  const metrics = [
    ['Ігри', player.matches],
    ['MVP', player.mvp_total],
    ['Δ', fmtSigned(player.rating_delta)]
  ];
  return metrics
    .filter(([, value]) => !(value === 0 || value === '0' || value === null || value === undefined || value === '—'))
    .map(([label, value]) => `<span>${label} <strong>${statValue(value)}</strong></span>`)
    .join('');
}

function heroCard(player, league, isPrimary = false) {
  if (!player) return `<article class="px-card home-card ${isPrimary ? 'home-hero-card home-hero-card--primary' : 'home-hero-card'}"><h3>${esc(leagueLabelUA(league))}</h3><p class="px-card__text">Немає даних</p></article>`;
  return `<article class="px-card home-card ${isPrimary ? 'home-hero-card home-hero-card--primary' : 'home-hero-card'}">
    <div class="home-hero-card__head">
      <span class="px-badge">${esc(leagueLabelUA(league))}</span>
      <strong class="home-hero-card__place">#1</strong>
    </div>
    <h3 class="home-hero-card__name">${esc(player.nickname)}</h3>
    <p class="home-hero-card__rating">Ранг: <strong>${statValue(Number.isFinite(player.rank_final) ? player.rank_final : player.rank_text)}</strong> · Очки: <strong>${statValue(player.rating_end)}</strong></p>
    <div class="home-stats-strip">${heroMetrics(player) || '<span>Ігри <strong>—</strong></span>'}</div>
  </article>`;
}

function rankDistributionCard(players = []) {
  const dist = RANK_ORDER.reduce((acc, rank) => ({ ...acc, [rank]: 0 }), {});
  players.forEach((player) => {
    const rank = String(player.rank_text || '').trim().toUpperCase();
    if (RANK_ORDER.includes(rank)) dist[rank] += 1;
  });
  return `<div class="home-rank-grid">${RANK_ORDER.map((rank) => `<article class="home-rank-card"><span>${rank}</span><strong>${dist[rank]}</strong></article>`).join('')}</div>`;
}

function progressCard(players = []) {
  const withDelta = players.map((p) => ({ ...p, delta: toNum(p.rating_delta, null) })).filter((p) => p.delta !== null);
  const up = [...withDelta].sort((a, b) => b.delta - a.delta).slice(0, 3);
  const down = [...withDelta].sort((a, b) => a.delta - b.delta).slice(0, 3);
  const mvp = [...players].sort((a, b) => (b.mvp_total || 0) - (a.mvp_total || 0)).slice(0, 3);
  const list = (rows, title, valueKey = 'delta') => `<div><h5>${title}</h5>${rows.length ? `<ul>${rows.map((p) => `<li>${esc(p.nickname)} <strong>${valueKey === 'delta' ? fmtSigned(p.delta) : statValue(p.mvp_total)}</strong></li>`).join('')}</ul>` : '<p class="px-card__text">Немає даних</p>'}</div>`;
  return `<div class="home-progress-grid">${list(up, 'Найкращий приріст')}${list(down, 'Найбільше падіння')}${list(mvp, 'Найбільше MVP', 'mvp')}</div>`;
}

function currentRankingCard(players = [], league) {
  if (!players.length) return '<p class="px-card__text">Немає даних</p>';
  return `<div class="home-current-table">${players.slice(0, 10).map((p, idx) => `<div class="home-current-row"><span>#${idx + 1}</span><strong>${esc(p.nickname)}</strong><span>${statValue(Number.isFinite(p.rank_final) ? p.rank_final : p.rank_text)}</span><span>${statValue(p.rating_end)}</span><span>${statValue(p.matches)}</span><span>${statValue(p.mvp_total)}</span><span>${fmtSigned(p.rating_delta)}</span></div>`).join('')}</div>
  <p class="px-card__text">Активна ліга: ${esc(leagueLabelUA(league))}</p>`;
}

function logsCard(series = [], updatedAt = '') {
  const rows = Array.isArray(series) ? series.slice(0, 3) : [];
  return `<div class="home-logs"><p class="px-card__text">Останній ігровий день: ${esc(updatedAt || 'Немає даних')}</p>${rows.length ? `<ul>${rows.map((item) => `<li>${esc(item.format || item.series || 'Оновлення')}: <strong>${esc(item.count ?? item.total ?? '—')}</strong></li>`).join('')}</ul>` : '<p class="px-card__text">Немає даних</p>'}</div>`;
}

function leagueSummary(summary = {}, players = []) {
  const matches = toNum(summary.matches ?? summary.games, players.reduce((s, p) => s + (toNum(p.matches, 0) || 0), 0)) || 0;
  const participants = toNum(summary.players ?? summary.active_players, players.length) || players.length;
  const avgRating = toNum(summary.avg_rating ?? summary.average_rating, null);
  return `<div class="home-summary-strip"><span>Матчі <strong>${matches}</strong></span><span>Гравці <strong>${participants}</strong></span><span>Сер. рейтинг <strong>${avgRating ?? '—'}</strong></span></div>`;
}

function renderLeagueSection({ league, summary, players, series, updatedAt, expanded }) {
  return `<section class="px-card home-card home-league" data-league="${league}">
    <div class="home-league__head"><h3>${esc(leagueLabelUA(league))}</h3><button type="button" class="btn btn--secondary home-expand-btn ${expanded ? 'is-active' : ''}" data-toggle-league="${league}">Розгорнути статистику</button></div>
    ${leagueSummary(summary, players)}
    <div class="home-expanded ${expanded ? 'is-open' : ''}" id="expanded-${league}">
      <article class="home-panel"><h4>Топ-10 ліги</h4>${currentRankingCard(players, league)}</article>
      <article class="home-panel"><h4>Прогрес ліги</h4>${progressCard(players)}</article>
      <article class="home-panel"><h4>Останній ігровий день</h4>${logsCard(series, updatedAt)}</article>
      <article class="home-panel"><h4>Розподіл по рангах</h4>${rankDistributionCard(players)}</article>
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
  <section class="section"><article class="px-card home-card home-panel"><h3>Поточний рейтинг ліги</h3><div id="currentRanking" class="home-skeleton"></div></article></section>
  <section class="section" id="leagueSections"></section>`;

  const stateBox = document.getElementById('stateBox');
  const topHeroes = document.getElementById('topHeroes');
  const leagueSections = document.getElementById('leagueSections');
  const currentRanking = document.getElementById('currentRanking');
  if (!stateBox || !topHeroes || !leagueSections || !currentRanking) return;

  const state = { home: { activeLeague: 'sundaygames', expandedLeague: 'sundaygames' }, sections: null };

  function renderLeagues(data) {
    const leaguePlayers = Object.fromEntries(HOME_LEAGUES.map((league) => [league, pickTopPlayers(data.playersAll, league, 200)]));
    currentRanking.classList.remove('home-skeleton');
    currentRanking.innerHTML = currentRankingCard(leaguePlayers[state.home.activeLeague] || [], state.home.activeLeague);

    leagueSections.innerHTML = HOME_LEAGUES.map((league) => renderLeagueSection({
      league,
      summary: data.leagueSummary[league] || {},
      players: leaguePlayers[league],
      series: data.seriesSummary[league] || [],
      updatedAt: data.updatedAt,
      expanded: state.home.expandedLeague === league
    })).join('');

    leagueSections.querySelectorAll('[data-toggle-league]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const leagueId = btn.getAttribute('data-toggle-league') || 'sundaygames';
        state.home.expandedLeague = leagueId;
        state.home.activeLeague = leagueId;
        renderLeagues(data);
      });
    });
  }

  try {
    const seasons = await listSeasonMasters();
    const fetchSeasonId = seasons.includes(HOME_CURRENT_SEASON.id) ? HOME_CURRENT_SEASON.id : (seasons[0] || HOME_CURRENT_SEASON.id);
    const master = await getSeasonMaster(fetchSeasonId);
    const sections = master?.sections || {};
    const playersAll = dedupeHomePlayers(Array.isArray(sections.players) ? sections.players : []);

    window.__v2LastSeason = { kids: fetchSeasonId, olds: fetchSeasonId, sundaygames: fetchSeasonId };
    stateBox.textContent = sections?.season_meta?.updated_at ? `Оновлено: ${sections.season_meta.updated_at}` : 'Дані сезону оновлюються автоматично.';

    const data = {
      playersAll,
      leagueSummary: sections.league_summary || {},
      seriesSummary: sections.series_summary || {},
      updatedAt: sections?.season_meta?.updated_at || ''
    };

    const adultTop = [...playersAll].filter((p) => p.league === 'sundaygames').sort(sortForHero)[0];
    const kidsTop = [...playersAll].filter((p) => p.league === 'kids').sort(sortForHero)[0];
    topHeroes.innerHTML = heroCard(adultTop, 'sundaygames', true) + heroCard(kidsTop, 'kids');
    renderLeagues(data);
  } catch (error) {
    const msg = safeErrorMessage(error, 'Дані тимчасово недоступні');
    stateBox.textContent = msg;
    topHeroes.innerHTML = `<article class="px-card home-card"><p class="px-card__text">${esc(msg)}</p></article>`;
    currentRanking.classList.remove('home-skeleton');
    currentRanking.innerHTML = `<p class="px-card__text">${esc(msg)}</p>`;
    leagueSections.innerHTML = '';
  }
}
