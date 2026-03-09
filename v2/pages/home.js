import { getLiveLeagueSnapshot, rankFromPoints, safeErrorMessage } from '../core/dataHub.js';
import { leagueLabelUA, normalizeLeague } from '../core/naming.js';

const HOME_CURRENT_SEASON = { id: 'spring_2026', label: 'Весна 2026' };
const HOME_LEAGUES = ['sundaygames', 'kids'];
const RANK_ORDER = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function toNum(v, fb = null) { const n = Number(v); return Number.isFinite(n) ? n : fb; }
function fmtSigned(v) { const n = toNum(v, null); return n === null ? '—' : `${n > 0 ? '+' : ''}${n}`; }
function hasValue(v) { return !(v === null || v === undefined || v === '' || Number.isNaN(v)); }

function normalizeLiveLeaguePlayers(rows = [], leagueId = 'kids') {
  const league = normalizeLeague(leagueId);
  const normalized = (Array.isArray(rows) ? rows : []).map((row = {}) => {
    const rowLeague = normalizeLeague(row.league || row.league_id || row.lg) || league;
    if (rowLeague !== league) return null;
    const nickname = String(row.nickname || row.nick || row.player || '').trim();
    if (!nickname) return null;
    const points = toNum(row.points ?? row.rating_end ?? row.rating ?? row.Points, null);
    const rankTextRaw = row.rankLetter || row.rank_letter || row.rank || row.Rank || row.rank_text;
    const rankText = String(rankTextRaw || (hasValue(points) ? rankFromPoints(points) : '')).trim().toUpperCase() || null;
    const rankValue = toNum(row.Rank ?? row.place ?? row.position ?? row.rank_final, null);
    return {
      league,
      nickname,
      points,
      rank_text: rankText,
      rank_value: rankValue,
      games: toNum(row.games ?? row.matches, null),
      matches: toNum(row.matches ?? row.games, null),
      winrate: toNum(row.winRate ?? row.winrate ?? row.wr, null),
      mvp_total: toNum(row.mvp ?? row.mvp_total ?? row.MVP, null),
      rating_delta: toNum(row.delta ?? row.rating_delta, null)
    };
  }).filter(Boolean);

  const map = new Map();
  normalized.forEach((player) => {
    const key = player.nickname.toLowerCase().trim();
    const existing = map.get(key);
    if (!existing) { map.set(key, player); return; }
    const pointsDiff = toNum(player.points, -1e9) - toNum(existing.points, -1e9);
    if (pointsDiff > 0) { map.set(key, player); return; }
    if (pointsDiff < 0) return;
    const matchesDiff = toNum(player.matches ?? player.games, 0) - toNum(existing.matches ?? existing.games, 0);
    if (matchesDiff > 0) map.set(key, player);
  });

  return [...map.values()].sort((a, b) => {
    const byPoints = toNum(b.points, -1e9) - toNum(a.points, -1e9);
    if (byPoints !== 0) return byPoints;
    return toNum(b.matches ?? b.games, 0) - toNum(a.matches ?? a.games, 0);
  });
}

function heroMetrics(player) {
  const metrics = [
    hasValue(player.games ?? player.matches) ? ['Ігри', player.games ?? player.matches] : null,
    hasValue(player.winrate) ? ['WR', `${player.winrate}%`] : null,
    hasValue(player.mvp_total) ? ['MVP', player.mvp_total] : null
  ].filter(Boolean);
  return metrics.map(([label, value]) => `<span>${label} <strong>${esc(value)}</strong></span>`).join('');
}

function heroCard(player, league, isPrimary = false) {
  if (!player) return `<article class="px-card home-card ${isPrimary ? 'home-hero-card home-hero-card--primary' : 'home-hero-card'}"><h3>${esc(leagueLabelUA(league))}</h3><p class="px-card__text">Немає даних</p></article>`;
  const rankDisplay = hasValue(player.rank_text) ? player.rank_text : (hasValue(player.points) ? rankFromPoints(player.points) : null);
  const ratingLine = [
    rankDisplay ? `Ранг: <strong>${esc(rankDisplay)}</strong>` : '',
    hasValue(player.points) ? `Очки: <strong>${esc(player.points)}</strong>` : ''
  ].filter(Boolean).join(' · ');
  return `<article class="px-card home-card ${isPrimary ? 'home-hero-card home-hero-card--primary' : 'home-hero-card'}">
    <div class="home-hero-card__head"><span class="px-badge">${esc(leagueLabelUA(league))}</span><strong class="home-hero-card__place">#1</strong></div>
    <h3 class="home-hero-card__name">${esc(player.nickname)}</h3>
    ${ratingLine ? `<p class="home-hero-card__rating">${ratingLine}</p>` : ''}
    ${heroMetrics(player) ? `<div class="home-stats-strip">${heroMetrics(player)}</div>` : ''}
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
  const withDelta = players.filter((p) => hasValue(p.rating_delta));
  const up = [...withDelta].sort((a, b) => b.rating_delta - a.rating_delta).slice(0, 3);
  const mvp = players.filter((p) => hasValue(p.mvp_total)).sort((a, b) => b.mvp_total - a.mvp_total).slice(0, 3);
  const list = (rows, title, valueKey) => `<div><h5>${title}</h5>${rows.length ? `<ul>${rows.map((p) => `<li>${esc(p.nickname)} <strong>${valueKey === 'delta' ? fmtSigned(p.rating_delta) : esc(p.mvp_total)}</strong></li>`).join('')}</ul>` : '<p class="px-card__text">Немає даних</p>'}</div>`;
  return `<div class="home-progress-grid">${list(up, 'Топ +3 по приросту', 'delta')}${list(mvp, 'Топ +3 по MVP', 'mvp')}</div>`;
}

function currentRankingCard(players = [], league) {
  if (!players.length) return '<p class="px-card__text">Немає даних</p>';
  const rows = players.slice(0, 10).map((p, idx) => {
    const rank = hasValue(p.rank_text) ? p.rank_text : (hasValue(p.points) ? rankFromPoints(p.points) : null);
    const cells = [
      `<span>#${idx + 1}</span>`,
      `<strong>${esc(p.nickname)}</strong>`,
      rank ? `<span>${esc(rank)}</span>` : '',
      hasValue(p.points) ? `<span>${esc(p.points)}</span>` : '',
      hasValue(p.games ?? p.matches) ? `<span>${esc(p.games ?? p.matches)}</span>` : '',
      hasValue(p.mvp_total) ? `<span>${esc(p.mvp_total)}</span>` : ''
    ].filter(Boolean).join('');
    return `<div class="home-current-row">${cells}</div>`;
  }).join('');
  return `<div class="home-current-table">${rows}</div><p class="px-card__text">Активна ліга: ${esc(leagueLabelUA(league))}</p>`;
}

function renderLeagueSection({ league, players, expanded }) {
  return `<section class="px-card home-card home-league" data-league="${league}">
    <div class="home-league__head"><h3>${esc(leagueLabelUA(league))}</h3><button type="button" class="btn btn--secondary home-expand-btn ${expanded ? 'is-active' : ''}" data-toggle-league="${league}">Розгорнути статистику</button></div>
    <div class="home-expanded ${expanded ? 'is-open' : ''}" id="expanded-${league}">
      <article class="home-panel"><h4>Поточний топ-10</h4>${currentRankingCard(players, league)}</article>
      <article class="home-panel"><h4>Розподіл по рангах</h4>${rankDistributionCard(players)}</article>
      <article class="home-panel"><h4>Прогрес</h4>${progressCard(players)}</article>
    </div>
  </section>`;
}

async function loadHomeLiveData() {
  const [adultSnap, kidsSnap] = await Promise.all([
    getLiveLeagueSnapshot('sundaygames'),
    getLiveLeagueSnapshot('kids')
  ]);

  const playersByLeague = {
    sundaygames: normalizeLiveLeaguePlayers(adultSnap?.table || [], 'sundaygames'),
    kids: normalizeLiveLeaguePlayers(kidsSnap?.table || [], 'kids')
  };

  return {
    playersByLeague,
    updatedAt: adultSnap?.updatedAt || kidsSnap?.updatedAt || ''
  };
}

export async function initHomePage() {
  const root = document.getElementById('view');
  if (!root) return;
  root.classList.add('home-v2');
  root.innerHTML = `<section class="hero home-hero"><span class="hero__kicker">HOME V2</span><h1 class="hero__title">LaserTag Ranking</h1><p class="hero__subtitle">Актуальний live-рейтинг і лідери ліг прямо зараз.</p><p class="home-current-season">Актуальний сезон: ${HOME_CURRENT_SEASON.label}</p><p class="px-card__text" id="stateBox" aria-live="polite"></p><div class="hero__actions"><a class="btn btn--primary" href="#seasons">Сезони</a><a class="btn btn--secondary" href="#rules">Правила</a></div></section>
  <div class="px-divider"></div>
  <section class="section"><h2 class="px-card__title">Лідери зараз</h2><div class="home-heroes" id="topHeroes"></div></section>
  <section class="section"><article class="px-card home-card home-panel"><h3>Поточний рейтинг дорослої ліги</h3><div id="currentRankingAdults" class="home-skeleton"></div></article></section>
  <section class="section"><article class="px-card home-card home-panel"><h3>Поточний рейтинг дитячої ліги</h3><div id="currentRankingKids" class="home-skeleton"></div></article></section>
  <section class="section" id="leagueSections"></section>`;

  const stateBox = document.getElementById('stateBox');
  const topHeroes = document.getElementById('topHeroes');
  const leagueSections = document.getElementById('leagueSections');
  const currentRankingAdults = document.getElementById('currentRankingAdults');
  const currentRankingKids = document.getElementById('currentRankingKids');
  if (!stateBox || !topHeroes || !leagueSections || !currentRankingAdults || !currentRankingKids) return;

  const homeState = { activeLeague: 'sundaygames', expandedLeague: 'sundaygames' };

  const renderHome = (data) => {
    currentRankingAdults.classList.remove('home-skeleton');
    currentRankingKids.classList.remove('home-skeleton');
    currentRankingAdults.innerHTML = currentRankingCard(data.playersByLeague.sundaygames, 'sundaygames');
    currentRankingKids.innerHTML = currentRankingCard(data.playersByLeague.kids, 'kids');

    leagueSections.innerHTML = HOME_LEAGUES.map((league) => renderLeagueSection({
      league,
      players: data.playersByLeague[league],
      expanded: homeState.expandedLeague === league
    })).join('');

    leagueSections.querySelectorAll('[data-toggle-league]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const clickedLeague = normalizeLeague(btn.getAttribute('data-toggle-league')) || 'sundaygames';
        homeState.expandedLeague = clickedLeague;
        homeState.activeLeague = clickedLeague;
        renderHome(data);
      });
    });
  };

  try {
    const data = await loadHomeLiveData();
    stateBox.textContent = data.updatedAt ? `Оновлено: ${data.updatedAt}` : '';

    const adultTop = data.playersByLeague.sundaygames[0] || null;
    const kidsTop = data.playersByLeague.kids[0] || null;
    topHeroes.innerHTML = heroCard(adultTop, 'sundaygames', true) + heroCard(kidsTop, 'kids');

    renderHome(data);
  } catch (error) {
    const msg = safeErrorMessage(error, 'Дані тимчасово недоступні');
    stateBox.textContent = msg;
    topHeroes.innerHTML = `<article class="px-card home-card"><p class="px-card__text">${esc(msg)}</p></article>`;
    currentRankingAdults.classList.remove('home-skeleton');
    currentRankingKids.classList.remove('home-skeleton');
    currentRankingAdults.innerHTML = `<p class="px-card__text">${esc(msg)}</p>`;
    currentRankingKids.innerHTML = `<p class="px-card__text">${esc(msg)}</p>`;
    leagueSections.innerHTML = '';
  }
}
