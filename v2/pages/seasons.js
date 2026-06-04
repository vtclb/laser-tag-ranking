import { listSeasonMasters, getSeasonMaster, safeErrorMessage } from '../core/dataHub.js';
import { debugWarn } from '../core/debug.js';
import { leagueLabelUA, normalizeLeague } from '../core/naming.js';
import { rankFromPoints } from '../core/rankRules.js';

const LEAGUES = ['sundaygames', 'kids'];
const NO_DATA = 'Немає даних';
const SEASON_MATCH_OVERRIDES = {
  summer_2025: { total: 322, sundaygames: 322 },
  autumn_2025: { total: 486, sundaygames: 486 }
};

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function signed(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n}`;
}

function titleFromId(id = '') {
  const known = {
    summer_2025: 'Літо 2025',
    autumn_2025: 'Осінь 2025',
    winter_2025_2026: 'Зима 2025–2026',
    spring_2026: 'Весна 2026'
  };
  return known[id] || String(id || 'Сезон').replaceAll('_', ' ');
}

function seasonTone(seasonId = '') {
  const value = String(seasonId);
  if (value.includes('summer')) return 'summer';
  if (value.includes('autumn')) return 'autumn';
  if (value.includes('winter')) return 'winter';
  if (value.includes('spring')) return 'spring';
  return 'neutral';
}

function seasonStartKey([seasonId, master]) {
  const meta = master?.sections?.season_meta || {};
  const raw = meta.dateStart || meta.date_start || meta.Date_start || meta.start || '';
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return parsed;
  const fallbackOrder = {
    summer_2025: 1,
    autumn_2025: 2,
    winter_2025_2026: 3,
    spring_2026: 4
  };
  return fallbackOrder[seasonId] || 9999;
}

function sortSeasonEntries(entries = []) {
  return [...entries].sort((a, b) => seasonStartKey(a) - seasonStartKey(b));
}

function seasonNumber(index = 0) {
  return `S${String(index + 1).padStart(2, '0')}`;
}

function periodText(meta = {}) {
  const start = meta.dateStart || meta.date_start || meta.Date_start || meta.start || '';
  const end = meta.dateEnd || meta.date_end || meta.Date_end || meta.end || '';
  if (start && end) return `${start} — ${end}`;
  return meta.period || meta.date_range || meta.dateRange || 'Архівний сезон';
}

function allPlayers(master = {}) {
  return Array.isArray(master?.sections?.players) ? master.sections.players : [];
}

function playerName(player = {}) {
  player = player || {};
  return player.nickname || player.nick || player.Nickname || NO_DATA;
}

function playerLeague(player = {}) {
  player = player || {};
  return normalizeLeague(player.league ?? player.League ?? '');
}

function leaguePlayers(master = {}, league = 'sundaygames') {
  return allPlayers(master).filter((player) => playerLeague(player) === league);
}

function leagueSummary(master = {}, league = 'sundaygames') {
  const raw = master?.sections?.league_summary || {};
  if (Array.isArray(raw)) {
    return raw.find((item) => normalizeLeague(item.league ?? item.League ?? '') === league) || {};
  }
  return raw?.[league] || {};
}

function ratingEnd(player = {}) {
  player = player || {};
  return num(player.rating_end ?? player.ratingEnd ?? player.points ?? player.Points, 0);
}

function ratingDelta(player = {}) {
  player = player || {};
  return num(player.rating_delta ?? player.ratingDelta ?? player.delta ?? player.Rating_delta, 0);
}

function mvpTotal(player = {}) {
  player = player || {};
  return num(player.mvp_total ?? player.mvpTotal ?? player.mvp ?? player.MVP_total, 0);
}

function rankOf(player = {}) {
  player = player || {};
  const raw = player.rank?.label || player.rankLetter || player.rank || player.Rank || player.rank_final || '';
  const value = String(raw || '').trim().toUpperCase().slice(0, 1);
  if ('SABCDEF'.includes(value)) return value;
  return rankFromPoints(ratingEnd(player));
}

function playerGames(player = {}) {
  player = player || {};
  return num(player.matches ?? player.games ?? player.Games, 0);
}

function playerVolume(players = []) {
  return players.reduce((sum, player) => sum + playerGames(player), 0);
}

function realNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function confirmedLeagueMatches(summary = {}) {
  const explicit = realNumber(summary.matches ?? summary.Matches);
  if (Number.isFinite(explicit)) return { value: explicit, source: 'league_summary.matches', trusted: true };
  const legacyGames = realNumber(summary.games ?? summary.Games);
  const rounds = realNumber(summary.rounds ?? summary.Rounds);
  if (Number.isFinite(legacyGames) && (!Number.isFinite(rounds) || legacyGames === rounds)) {
    return { value: legacyGames, source: 'league_summary.games', trusted: true };
  }
  return { value: null, source: 'missing', trusted: false };
}

function activePlayers(players = []) {
  return players.filter((player) => playerGames(player) > 0);
}

function uniqueCount(players = []) {
  const names = new Set();
  players.forEach((player) => {
    const key = String(playerName(player)).trim().toLowerCase();
    if (key && key !== NO_DATA.toLowerCase()) names.add(key);
  });
  return names.size;
}

function topBy(players = [], getter = ratingEnd) {
  return [...players].sort((a, b) => getter(b) - getter(a) || ratingEnd(b) - ratingEnd(a))[0] || null;
}

function normalizeLeagueStats(master = {}, league = 'sundaygames') {
  const players = leaguePlayers(master, league);
  const active = activePlayers(players);
  const summary = leagueSummary(master, league);
  const leader = topBy(players, ratingEnd);
  const mvp = topBy(players, mvpTotal);
  const seasonId = master?.seasonId || master?.season || '';
  const matchesOverride = realNumber(SEASON_MATCH_OVERRIDES[seasonId]?.[league]);
  const matches = Number.isFinite(matchesOverride)
    ? { value: matchesOverride, source: 'archive_match_override', trusted: true }
    : confirmedLeagueMatches(summary);

  return {
    label: leagueLabelUA(league),
    active: active.length,
    records: players.length,
    playerVolume: playerVolume(active),
    matches: matches.value,
    matchesTrusted: matches.trusted,
    leaderName: playerName(leader),
    leaderRank: rankOf(leader),
    mvpName: playerName(mvp),
    mvpRank: rankOf(mvp),
    delta: active.reduce((sum, player) => sum + ratingDelta(player), 0)
  };
}

function normalizeSeasonStats([seasonId, master], index = 0) {
  const sections = master?.sections || {};
  const meta = sections.season_meta || {};
  const adult = normalizeLeagueStats(master, 'sundaygames');
  const kids = normalizeLeagueStats(master, 'kids');
  const overrideTotal = realNumber(SEASON_MATCH_OVERRIDES[seasonId]?.total);
  const confirmedMatches = [adult.matches, kids.matches].filter(Number.isFinite);
  const totalMatches = Number.isFinite(overrideTotal)
    ? overrideTotal
    : confirmedMatches.length > 0
    ? confirmedMatches.reduce((sum, value) => sum + value, 0)
    : null;
  const active = activePlayers(allPlayers(master));

  return {
    id: seasonId,
    number: seasonNumber(index),
    title: meta.title || meta.seasonTitle || titleFromId(seasonId),
    period: periodText(meta),
    theme: seasonTone(seasonId),
    totalMatches,
    totalMatchesTrusted: Number.isFinite(totalMatches),
    totalActive: active.length,
    totalPlayers: uniqueCount(active),
    totalRecords: allPlayers(master).length,
    totalPlayerVolume: playerVolume(active),
    totalRatingDelta: active.reduce((sum, player) => sum + ratingDelta(player), 0),
    leagues: { adult, kids }
  };
}

function hasSeasonData(master) {
  const players = allPlayers(master);
  if (players.length > 0) return true;
  const summary = master?.sections?.league_summary || {};
  return Boolean(summary && Object.keys(summary).length);
}

function validateSeasonStats(stats) {
  if (!stats) return;
  if (!stats.totalMatchesTrusted && stats.totalPlayerVolume > 1000) {
    debugWarn('[season stats warning] totalMatches not confirmed; participation records skipped as match count', {
      season: stats.id,
      participationRecords: stats.totalPlayerVolume
    });
  }
  Object.entries(stats.leagues || {}).forEach(([key, league]) => {
    if (!league.leaderName || league.leaderName === NO_DATA) {
      debugWarn('[season stats warning] missing leader', { season: stats.id, league: key });
    }
  });
}

function buildArchiveTotals(statsList = []) {
  return statsList.reduce((acc, stats) => {
    if (!stats) return acc;
    acc.seasons += 1;
    if (stats.totalMatchesTrusted) {
      acc.matches += stats.totalMatches;
      acc.confirmedMatchSeasons += 1;
    }
    acc.active += stats.totalActive;
    acc.delta += stats.totalRatingDelta;
    return acc;
  }, { seasons: 0, matches: 0, confirmedMatchSeasons: 0, active: 0, delta: 0 });
}

function leagueShare(stats = {}, field = 'active') {
  const adult = stats.leagues?.adult?.[field] || 0;
  const kids = stats.leagues?.kids?.[field] || 0;
  const total = Math.max(adult + kids, 1);
  return { adult, kids, adultPct: Math.round((adult / total) * 100), kidsPct: Math.round((kids / total) * 100) };
}

function seasonSymbol(tone = 'neutral') {
  return `<svg class="sx-season-symbol sx-season-symbol-${esc(tone)}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M6 18 18 6"/></svg>`;
}

function previewMetric(stats = {}) {
  if (stats.totalMatchesTrusted) {
    return { value: stats.totalMatches, label: 'ігор' };
  }
  return { value: '—', label: 'ігор' };
}

function previewRankBadge(rank = '') {
  const value = String(rank || '?').trim().toUpperCase().slice(0, 1) || '?';
  const tone = 'SABCDEF'.includes(value) ? value.toLowerCase() : 'unknown';
  return `<i class="sx-rank sx-rank-${esc(tone)}">${esc(value)}</i>`;
}

function previewMainPlayer(leagueStats = {}) {
  const leaderName = leagueStats.leaderName && leagueStats.leaderName !== NO_DATA ? leagueStats.leaderName : '';
  const fallbackName = leagueStats.mvpName && leagueStats.mvpName !== NO_DATA ? leagueStats.mvpName : '';
  const name = leaderName || fallbackName;
  const rank = leaderName ? leagueStats.leaderRank : leagueStats.mvpRank;
  if (!name) return { name: 'немає даних', rank: '' };
  return { name, rank };
}

function renderLeaguePreviewLine(leagueStats = {}, label = 'Ліга', tone = 'adult') {
  const player = previewMainPlayer(leagueStats);
  return `<div class="sx-league-line sx-league-${esc(tone)}">
    <span>${esc(label)}</span>
    <strong>${esc(player.name)}</strong>
    ${player.rank ? previewRankBadge(player.rank) : ''}
  </div>`;
}

function renderArchiveSummary(statsList = []) {
  const totals = buildArchiveTotals(statsList);
  const first = statsList[0];
  const last = statsList[statsList.length - 1];
  const period = first && last ? `${first.title} — ${last.title}` : 'архів сезонів';
  const gamesTotal = statsList.reduce((sum, stats) => sum + (stats.totalMatchesTrusted ? stats.totalMatches : 0), 0);

  return `<section class="sx-archive-summary">
    <strong>${totals.seasons} сезони</strong>
    <span>${esc(period)}</span>
    <p class="sx-archive-numbers">
      <span><b>${gamesTotal}</b> ігор</span>
      <span><b>${totals.active}</b> активні</span>
      <span><b>${signed(totals.delta)}</b> рейтинг</span>
    </p>
  </section>`;
}

function buildYearTop(visibleMasters = []) {
  const map = new Map();
  visibleMasters.forEach(([seasonId, master]) => {
    leaguePlayers(master, 'sundaygames').forEach((player) => {
      const name = playerName(player);
      if (!name || name === NO_DATA) return;
      const key = name.trim().toLowerCase();
      const current = map.get(key) || {
        name,
        seasons: new Set(),
        games: 0,
        rating: 0,
        delta: 0,
        mvp: 0,
        bestPoints: 0,
        bestRank: 'F'
      };
      current.seasons.add(seasonId);
      current.games += playerGames(player);
      current.rating += ratingEnd(player);
      current.delta += ratingDelta(player);
      current.mvp += mvpTotal(player);
      current.bestPoints = Math.max(current.bestPoints, ratingEnd(player));
      current.bestRank = rankFromPoints(current.bestPoints);
      map.set(key, current);
    });
  });

  return [...map.values()]
    .sort((a, b) => b.rating - a.rating || b.delta - a.delta || b.games - a.games)
    .slice(0, 10)
    .map((player, index) => ({ ...player, place: index + 1, seasonsCount: player.seasons.size }));
}

function renderYearTop(topPlayers = []) {
  if (!topPlayers.length) return '';
  return `<section class="sx-year-top" aria-label="Топ-10 за всі сезони">
    <header>
      <span>Підсумок року</span>
      <strong>Топ-10 гравців</strong>
    </header>
    <div class="sx-year-top-list">
      ${topPlayers.map((player) => `<div class="sx-year-player">
        <b>#${player.place}</b>
        <strong>${esc(player.name)} ${previewRankBadge(player.bestRank)}</strong>
        <span>${player.rating} оч · ${player.games} ігор · ${signed(player.delta)}</span>
      </div>`).join('')}
    </div>
  </section>`;
}

function renderSeasonPreviewItem(stats = {}) {
  const metric = previewMetric(stats);
  const split = leagueShare(stats, 'active');
  const href = `#season?season=${encodeURIComponent(stats.id)}&league=sundaygames`;
  const metricValue = typeof metric.value === 'number' ? metric.value : esc(metric.value);

  return `<article class="sx-season-item sx-theme-${esc(stats.theme)}" data-season-id="${esc(stats.id)}">
    <a class="sx-season-node" href="${href}" aria-label="Відкрити ${esc(stats.title)}">
      ${seasonSymbol(stats.theme)}
    </a>
    <div class="sx-season-body">
      <header class="sx-season-head">
        <div class="sx-season-title-wrap">
          <span class="sx-season-number">${esc(stats.number)}</span>
          <span class="sx-season-icon">${seasonSymbol(stats.theme)}</span>
          <h2 class="sx-season-title">${esc(stats.title)}</h2>
        </div>
        <strong class="sx-season-delta">${signed(stats.totalRatingDelta)}</strong>
      </header>
      <p class="sx-season-meta">${esc(stats.period)} · Архів</p>
      <div class="sx-season-metrics">
        <span><strong>${stats.totalActive}</strong> активні</span>
        <span><strong>${metricValue}</strong>${metric.label ? ` ${esc(metric.label)}` : ''}</span>
      </div>
      <div class="sx-season-leagues">
        ${renderLeaguePreviewLine(stats.leagues.adult, 'Доросла', 'adult')}
        ${renderLeaguePreviewLine(stats.leagues.kids, 'Дитяча', 'kids')}
      </div>
      <div class="sx-season-split" aria-label="Активність дорослої та дитячої ліги">
        <div class="sx-split-label">
          <span>Доросла ${split.adult}</span>
          <span>Дитяча ${split.kids}</span>
        </div>
        <div class="sx-split-track">
          <span class="sx-split-adult" style="width:${split.adultPct}%"></span>
          <span class="sx-split-kids" style="width:${split.kidsPct}%"></span>
        </div>
      </div>
      <a class="sx-season-open" href="${href}">Відкрити</a>
    </div>
  </article>`;
}

function renderSeasonPreviewList(statsList = []) {
  return `<section class="sx-season-list" aria-label="Список сезонів">
    ${statsList.map(renderSeasonPreviewItem).join('')}
  </section>`;
}

export async function initSeasonsPage() {
  const root = document.getElementById('seasonsRoot') || document.getElementById('view');
  if (!root) return;

  root.innerHTML = `<section id="seasons" class="sx-page sx-page--catalog">
    <header class="sx-hero">
      <p class="sx-eyebrow">Архів рейтингу</p>
      <h1>Сезони</h1>
      <p class="sx-hero-subtitle">Архів клубного рейтингу.</p>
    </header>
    <section class="sx-loading">Завантаження архівів...</section>
  </section>`;

  try {
    const seasons = await listSeasonMasters();
    if (!Array.isArray(seasons) || !seasons.length) {
      root.querySelector('.sx-loading').textContent = 'Архіви сезонів поки недоступні.';
      return;
    }

    const masters = await Promise.all(seasons.map(async (seasonId) => {
      const master = await getSeasonMaster(seasonId).catch(() => null);
      return [seasonId, master];
    }));
    const visibleMasters = sortSeasonEntries(masters.filter(([, master]) => hasSeasonData(master)));
    const seasonStats = visibleMasters.map((entry, index) => normalizeSeasonStats(entry, index));
    seasonStats.forEach(validateSeasonStats);

    if (!seasonStats.length) {
      root.querySelector('.sx-loading').textContent = 'Архіви сезонів поки не мають підключених даних.';
      return;
    }

    root.innerHTML = `<section id="seasons" class="sx-page sx-page--catalog">
      <header class="sx-hero">
        <p class="sx-eyebrow">Архів рейтингу</p>
        <h1>Сезони</h1>
      <p class="sx-hero-subtitle">Архів клубного рейтингу.</p>
      </header>
      ${renderArchiveSummary(seasonStats)}
      ${renderSeasonPreviewList(seasonStats)}
      ${renderYearTop(buildYearTop(visibleMasters))}
    </section>`;
  } catch (error) {
    root.innerHTML = `<section id="seasons" class="sx-page sx-page--catalog">
      <header class="sx-hero">
        <p class="sx-eyebrow">Архів рейтингу</p>
        <h1>Сезони</h1>
        <p class="sx-hero-subtitle">${esc(safeErrorMessage(error, 'Не вдалося завантажити архіви сезонів'))}</p>
      </header>
    </section>`;
  }
}
