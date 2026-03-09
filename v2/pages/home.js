import { getLeagueSnapshot, rankFromPoints, safeErrorMessage } from '../core/dataHub.js';
import { leagueLabelUA, normalizeLeague } from '../core/naming.js';

const HOME_CURRENT_SEASON = { id: 'spring_2026', label: 'Весна 2026' };
const HOME_LEAGUES = ['sundaygames', 'kids'];
const RANK_ORDER = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function toNum(v, fb = null) { const n = Number(v); return Number.isFinite(n) ? n : fb; }
function fmtSigned(v) { const n = toNum(v, null); return n === null ? '—' : `${n > 0 ? '+' : ''}${n}`; }
function hasValue(v) { return !(v === null || v === undefined || v === '' || Number.isNaN(v)); }

function normalizeSnapshotPlayers(snapshot, league) {
  const rows = Array.isArray(snapshot?.table) ? snapshot.table : [];
  return rows
    .map((row) => ({
      league,
      nickname: String(row.nick || row.nickname || '').trim(),
      matches: Number(row.games || row.matches || 0) || 0,
      wins: Number(row.wins || 0) || 0,
      draws: Number(row.draws || 0) || 0,
      losses: Number(row.losses || 0) || 0,
      mvp_total: Number(row.mvp || row.mvp_total || 0) || 0,
      rating_end: Number(row.points || row.rating_end || 0) || 0,
      rating_delta: Number(row.pointsDelta || row.rating_delta || 0) || 0,
      rank_final: null,
      rank_text: row.rankLetter || rankFromPoints(Number(row.points || 0) || 0)
    }))
    .filter((p) => p.nickname);
}

function normalizeSnapshotSummary(snapshot) {
  const stats = snapshot?.seasonStats || {};
  return {
    matches: Number(stats.games || 0) || 0,
    players: Number(stats.players || 0) || 0,
    avg_rating: null
  };
}

function dedupeHomePlayers(players = []) {
  const map = new Map();
  (Array.isArray(players) ? players : []).forEach((player) => {
    const league = normalizeLeague(player?.league || 'kids') || 'kids';
    const nickname = String(player?.nickname || '').trim();
    if (!nickname) return;
    const key = `${league}::${nickname.toLowerCase()}`;
    const normalized = {
      ...player,
      league,
      nickname,
      points: toNum(player?.points ?? player?.rating_end, null),
      games: toNum(player?.games ?? player?.matches, null),
      matches: toNum(player?.matches ?? player?.games, null),
      winrate: toNum(player?.winrate, null),
      mvp_total: toNum(player?.mvp_total, null),
      rating_delta: toNum(player?.rating_delta, null)
    };
    const existing = map.get(key);
    if (!existing) { map.set(key, normalized); return; }
    const pointsDiff = toNum(normalized.points, -1e9) - toNum(existing.points, -1e9);
    if (pointsDiff > 0) { map.set(key, normalized); return; }
    if (pointsDiff < 0) return;
    const matchesDiff = toNum(normalized.matches ?? normalized.games, 0) - toNum(existing.matches ?? existing.games, 0);
    if (matchesDiff > 0) map.set(key, normalized);
  });
  return [...map.values()];
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
  const adultSnap = await getLeagueSnapshot('sundaygames', 'spring_2026');
  const kidsSnap = await getLeagueSnapshot('kids', 'spring_2026');
  const playersAll = dedupeHomePlayers([
    ...normalizeSnapshotPlayers(adultSnap, 'sundaygames'),
    ...normalizeSnapshotPlayers(kidsSnap, 'kids')
  ]);
  const playersByLeague = {
    sundaygames: playersAll
      .filter((player) => player.league === 'sundaygames')
      .sort((a, b) => toNum(b.points, -1e9) - toNum(a.points, -1e9)),
    kids: playersAll
      .filter((player) => player.league === 'kids')
      .sort((a, b) => toNum(b.points, -1e9) - toNum(a.points, -1e9))
  };

  return {
    playersAll,
    playersByLeague,
    leagueSummary: {
      sundaygames: normalizeSnapshotSummary(adultSnap),
      kids: normalizeSnapshotSummary(kidsSnap)
    },
    seriesSummary: {
      sundaygames: adultSnap.matches || [],
      kids: kidsSnap.matches || []
    },
    updatedAt: new Date().toISOString()
  };
}

export async function initHomePage() {
  const root = document.getElementById('view');
  if (!root) return;
  root.classList.add('home-v2');
  root.innerHTML = `<section class="hero home-hero"><span class="hero__kicker">HOME V2</span><h1 class="hero__title">LaserTag Ranking</h1><p class="hero__subtitle">Актуальний live-рейтинг і лідери ліг прямо зараз.</p><p class="home-current-season">Актуальний сезон: ${HOME_CURRENT_SEASON.label}</p><p class="px-card__text" id="stateBox" aria-live="polite" hidden></p><div class="hero__actions"><a class="btn btn--primary" href="#seasons">Сезони</a><a class="btn btn--secondary" href="#rules">Правила</a></div></section>
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
    stateBox.hidden = true;
    stateBox.textContent = '';

    const adultTop = data.playersByLeague.sundaygames[0] || null;
    const kidsTop = data.playersByLeague.kids[0] || null;
    topHeroes.innerHTML = heroCard(adultTop, 'sundaygames', true) + heroCard(kidsTop, 'kids');

    renderHome(data);
  } catch (error) {
    const msg = safeErrorMessage(error, 'Дані тимчасово недоступні');
    stateBox.hidden = false;
    stateBox.textContent = msg;
    topHeroes.innerHTML = `<article class="px-card home-card"><p class="px-card__text">${esc(msg)}</p></article>`;
    currentRankingAdults.classList.remove('home-skeleton');
    currentRankingKids.classList.remove('home-skeleton');
    currentRankingAdults.innerHTML = `<p class="px-card__text">${esc(msg)}</p>`;
    currentRankingKids.innerHTML = `<p class="px-card__text">${esc(msg)}</p>`;
    leagueSections.innerHTML = '';
  }
}
