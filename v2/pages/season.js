import { listSeasonMasters, getSeasonMaster, rankFromPoints, safeErrorMessage } from '../core/dataHub.js?v=20260715-perf2';
import { leagueLabelUA, normalizeLeague } from '../core/naming.js';
import { renderPageError } from '../core/pageState.js?v=20260715-load1';

const RANK_ORDER = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

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

function valueOf(object = {}, keys = [], fallback = undefined) {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

function titleFromId(id = '') {
  const known = {
    spring_2026: 'Весна 2026',
    winter_2025_2026: 'Зима 2025-2026',
    autumn_2025: 'Осінь 2025',
    summer_2025: 'Літо 2025',
    summer_2026: 'Літо 2026'
  };
  return known[id] || String(id || 'Сезон').replaceAll('_', ' ');
}

function seasonTone(seasonId = '') {
  const value = String(seasonId);
  if (value.includes('spring')) return 'spring';
  if (value.includes('summer')) return 'summer';
  if (value.includes('autumn')) return 'autumn';
  if (value.includes('winter')) return 'winter';
  return 'neutral';
}

function seasonStartKey(seasonId = '') {
  const fallbackOrder = {
    summer_2025: 1,
    autumn_2025: 2,
    winter_2025_2026: 3,
    spring_2026: 4,
    summer_2026: 5
  };
  return fallbackOrder[seasonId] || 9999;
}

function sortSeasonIds(seasons = []) {
  return [...seasons].sort((a, b) => seasonStartKey(a) - seasonStartKey(b));
}

function seasonNumber(seasons = [], seasonId = '') {
  const index = Math.max(0, seasons.indexOf(seasonId));
  return `S${String(index + 1).padStart(2, '0')}`;
}

function seasonSymbol(tone = 'neutral') {
  const glyphs = {
    spring: '<circle cx="12" cy="12" r="7"/><path d="M12 5v14M5 12h14M12 15c-2-3-1-6 0-8M12 15c3-2 5-2 7-1M12 15c-3-2-5-2-7-1"/>',
    summer: '<path d="M4 12h16M12 4v16M7 7l10 10M17 7 7 17"/><circle cx="12" cy="12" r="4"/>',
    autumn: '<path d="M6 7h12v7c0 4-3 6-6 7-3-1-6-3-6-7z"/><path d="M8 16l8-8M10 8c4 1 6 3 6 7M8 13h8"/>',
    winter: '<path d="M12 4v16M5 8l14 8M19 8 5 16M8 5l4 4 4-4M8 19l4-4 4 4"/>'
  };
  return `<svg class="sd-season-symbol sd-season-symbol-${esc(tone)}" viewBox="0 0 24 24" aria-hidden="true">${glyphs[tone] || glyphs.spring}</svg>`;
}

function leagueTone(league = '') {
  return normalizeLeague(league) === 'kids' ? 'kids' : 'adult';
}

function signed(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'немає даних';
  return `${n > 0 ? '+' : ''}${n}`;
}

function pct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : 'немає даних';
}

function periodText(meta = {}) {
  const start = valueOf(meta, ['dateStart', 'date_start', 'Date_start', 'start'], '');
  const end = valueOf(meta, ['dateEnd', 'date_end', 'Date_end', 'end'], '');
  if (start && end) return `${start} - ${end}`;
  return valueOf(meta, ['period', 'date_range', 'dateRange'], 'Архівний сезон');
}

function playerName(player = {}) {
  return valueOf(player, ['nickname', 'Nickname', 'nick', 'Nick'], 'немає даних');
}

function playerLeague(player = {}) {
  return normalizeLeague(valueOf(player, ['league', 'League'], ''));
}

function playerGames(player = {}) {
  return num(valueOf(player, ['matches', 'Matches', 'games', 'Games'], 0), 0);
}

function ratingEnd(player = {}) {
  return num(valueOf(player, ['rating_end', 'Rating_end', 'ratingEnd', 'points', 'Points'], 0), 0);
}

function ratingDelta(player = {}) {
  return num(valueOf(player, ['rating_delta', 'Rating_delta', 'ratingDelta', 'delta', 'Delta'], 0), 0);
}

function mvp1(player = {}) {
  return num(valueOf(player, ['mvp1', 'MVP1'], 0), 0);
}

function mvp2(player = {}) {
  return num(valueOf(player, ['mvp2', 'MVP2'], 0), 0);
}

function mvp3(player = {}) {
  return num(valueOf(player, ['mvp3', 'MVP3'], 0), 0);
}

function mvpTotal(player = {}) {
  return num(valueOf(player, ['mvp_total', 'MVP_total', 'mvpTotal', 'mvp', 'MVP'], mvp1(player) + mvp2(player) + mvp3(player)), 0);
}

function wins(player = {}) {
  return num(valueOf(player, ['wins', 'Wins'], 0), 0);
}

function losses(player = {}) {
  return num(valueOf(player, ['losses', 'Losses'], 0), 0);
}

function draws(player = {}) {
  return num(valueOf(player, ['draws', 'Draws'], 0), 0);
}

function winRate(player = {}) {
  return num(valueOf(player, ['win_rate', 'Winrate', 'winRate', 'winrate'], 0), 0);
}

function rank(player = {}) {
  const raw = valueOf(player, ['rank_final', 'Rank', 'rankLetter', 'rank'], '');
  const value = raw && typeof raw === 'object'
    ? valueOf(raw, ['label', 'rank', 'value'], '')
    : raw;
  const letter = String(value || '').trim().toUpperCase().match(/[SABCDEF]/)?.[0];
  return letter || rankFromPoints(ratingEnd(player)) || 'F';
}

function playerPlace(player = {}, index = 0) {
  const place = num(valueOf(player, ['place', 'Place', 'finalPlace'], null), null);
  return Number.isFinite(place) && place > 0 ? place : index + 1;
}

function sortByRating(players = []) {
  return [...players].sort((a, b) => (
    ratingEnd(b) - ratingEnd(a)
    || wins(b) - wins(a)
    || playerName(a).localeCompare(playerName(b), 'uk')
  ));
}

function sortBy(players = [], getter = ratingEnd) {
  return [...players].sort((a, b) => getter(b) - getter(a) || ratingEnd(b) - ratingEnd(a));
}

function secondBy(players = [], getter = ratingEnd) {
  return sortBy(players, getter)[1] || {};
}

function profileLink(league, player) {
  return `#player?league=${encodeURIComponent(league)}&nick=${encodeURIComponent(playerName(player))}`;
}

function leagueSummary(sections = {}, league = 'sundaygames') {
  const raw = sections.league_summary || {};
  if (Array.isArray(raw)) {
    return raw.find((item) => normalizeLeague(valueOf(item, ['league', 'League'], '')) === league) || {};
  }
  return raw?.[league] || {};
}

function rankDistribution(players = []) {
  return RANK_ORDER.map((rankName) => ({
    rank: rankName,
    count: players.filter((player) => rank(player) === rankName).length
  }));
}

function rankMark(value) {
  const letter = String(value || 'F').toLowerCase();
  return `<span class="sd-rank sd-rank-${esc(letter)}">${esc(String(value || 'F').toUpperCase())}</span>`;
}

function kpi(label, value, meta = '', mark = '01') {
  return `<article class="sd-kpi">
    <i aria-hidden="true">${esc(mark)}</i>
    <strong>${esc(value)}</strong>
    <span>${esc(label)}</span>
    ${meta ? `<small>${esc(meta)}</small>` : ''}
  </article>`;
}

function highlight(label, player, value, meta = '') {
  return `<article class="sd-highlight">
    <span>${esc(label)}</span>
    <strong>${esc(player || 'немає даних')}</strong>
    <small>${esc(value || 'немає даних')}${meta ? ` · ${esc(meta)}` : ''}</small>
  </article>`;
}

function gapNote(gap = 0) {
  if (!Number.isFinite(gap) || gap <= 0) return 'відрив не визначено';
  return `лідер випередив #2 на ${gap} очок`;
}

function seasonStory({ leader, runnerUp, impact, mvp, gapToSecond }) {
  const secondName = playerName(runnerUp);
  const secondPart = secondName && secondName !== '—'
    ? `Другим фінішує ${secondName}; ${gapNote(gapToSecond)}.`
    : 'Другого місця для порівняння ще немає.';
  return `${playerName(leader)} завершує сезон першим. ${secondPart} Найбільший impact: ${playerName(impact)} ${signed(ratingDelta(impact))}. MVP-лідер: ${playerName(mvp)} — ${mvpTotal(mvp)} записів.`;
}

function seasonHighlights({ leader, runnerUp, impact, mvp, wr, mostActive, mostWins, consistent, gapToSecond }) {
  return `
    ${highlight('Чемпіон сезону', playerName(leader), `${ratingEnd(leader)} очок`, `#${playerPlace(leader, 0)} · ${gapNote(gapToSecond)}`)}
    ${highlight('Срібло сезону', playerName(runnerUp), `${ratingEnd(runnerUp)} очок`, `#${playerPlace(runnerUp, 1)}`)}
    ${highlight('Найбільший приріст', playerName(impact), signed(ratingDelta(impact)), `${ratingEnd(impact)} очок`)}
    ${highlight('MVP сезону', playerName(mvp), `${mvpTotal(mvp)} MVP`, `${mvp1(mvp)} перших`)}
    ${highlight('Найкращий WR', playerName(wr), pct(winRate(wr)), `${playerGames(wr)} ігор`)}
    ${highlight('Марафонець сезону', playerName(mostActive), `${playerGames(mostActive)} ігор`, `${wins(mostActive)} перемог`)}
    ${highlight('Найбільше перемог', playerName(mostWins), `${wins(mostWins)} перемог`, `WR ${pct(winRate(mostWins))}`)}
    ${highlight('Стабільний темп', playerName(consistent), pct(winRate(consistent)), `${playerGames(consistent)} ігор · ${wins(consistent)} перемог`)}
  `;
}

function rankScale(players = []) {
  if (!players.length) {
    return '<p class="sd-empty">Розподіл рангів недоступний для цього сезону.</p>';
  }
  const distribution = rankDistribution(players);
  const max = Math.max(...distribution.map((item) => item.count), 1);
  return `<div class="sd-rank-scale">
    ${distribution.map((item) => `<div class="sd-rank-row sd-rank-row-${item.rank.toLowerCase()}" title="${esc(item.rank)} rank · ${item.count} гравців">
      ${rankMark(item.rank)}
      <div class="sd-rank-meter"><b style="width:${Math.max(item.count ? 8 : 2, Math.round((item.count / max) * 100))}%"></b></div>
      <strong>${item.count}</strong>
    </div>`).join('')}
  </div>`;
}

function topBars(players = [], getter, labelFormatter) {
  const top = sortBy(players, getter).slice(0, 5);
  const max = Math.max(...top.map(getter), 1);
  if (!top.length) return '<p class="sd-empty">немає даних</p>';
  return `<div class="sd-bars">
    ${top.map((player) => `<a href="${profileLink(playerLeague(player) || 'sundaygames', player)}" class="sd-bar-row" title="${esc(playerName(player))} · ${esc(labelFormatter(player))}">
      <span>${esc(playerName(player))}</span>
      <i><b style="width:${Math.max(4, Math.round((getter(player) / max) * 100))}%"></b></i>
      <strong>${esc(labelFormatter(player))}</strong>
    </a>`).join('')}
  </div>`;
}

function playerCards(players = [], league = 'sundaygames', limit = null) {
  const rows = limit ? players.slice(0, limit) : players;
  if (!rows.length) return '<p class="sd-empty">Немає даних по гравцях.</p>';
  return `<div class="sd-player-list">
    ${rows.map((player, index) => {
      const delta = ratingDelta(player);
      const deltaClass = delta >= 0 ? 'is-positive' : 'is-negative';
      const playerRank = rank(player).toLowerCase();
      return `<a href="${profileLink(league, player)}" class="sd-player sd-player-rank-${esc(playerRank)}">
        <span class="sd-player__place">#${playerPlace(player, index)}</span>
        <div class="sd-player__main">
          <strong>${esc(playerName(player))}</strong>
          <small>${ratingEnd(player)} оч · ${playerGames(player)} ігор · WR ${pct(winRate(player))}</small>
          <em>${wins(player)} пер / ${losses(player)} пор / ${draws(player)} ніч · MVP ${mvpTotal(player)} (${mvp1(player)}/${mvp2(player)}/${mvp3(player)})</em>
        </div>
        <div class="sd-player__side">
          ${rankMark(rank(player))}
          <b class="${deltaClass}">${signed(delta)}</b>
        </div>
      </a>`;
    }).join('')}
  </div>`;
}

function playersTable(players = [], league = 'sundaygames', limit = null) {
  const rows = limit ? players.slice(0, limit) : players;
  if (!rows.length) return '<p class="sd-empty">Немає даних по гравцях.</p>';
  return `<div class="sd-table-wrap">
    <table class="sd-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Гравець</th>
          <th>Ранг</th>
          <th>Очки</th>
          <th>Δ</th>
          <th>Ігри</th>
          <th>W/L/D</th>
          <th>WR</th>
          <th>MVP</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((player, index) => {
          const delta = ratingDelta(player);
          const deltaClass = delta >= 0 ? 'is-positive' : 'is-negative';
          const playerRank = rank(player).toLowerCase();
          return `<tr class="sd-table-rank-${esc(playerRank)}">
            <td>#${playerPlace(player, index)}</td>
            <td><a href="${profileLink(league, player)}">${esc(playerName(player))}</a></td>
            <td>${rankMark(rank(player))}</td>
            <td>${ratingEnd(player)}</td>
            <td class="${deltaClass}">${signed(delta)}</td>
            <td>${playerGames(player)}</td>
            <td>${wins(player)} / ${losses(player)} / ${draws(player)}</td>
            <td>${pct(winRate(player))}</td>
            <td>${mvpTotal(player)} <small>${mvp1(player)}/${mvp2(player)}/${mvp3(player)}</small></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

function auditBlock(master = {}, league = 'sundaygames') {
  const warnings = (master.audit?.warnings || []).filter((item) => !item.league || normalizeLeague(item.league) === league);
  if (!warnings.length) return '';
  return `<section class="sd-section sd-audit">
    <div class="sd-section-head">
      <h2>Audit сезону</h2>
      <span>${warnings.length} попереджень</span>
    </div>
    ${warnings.map((item) => {
      if (item.type === 'player_has_games_without_logs') {
        return `<p><strong>${esc(item.nick)}</strong>: є ${num(item.games)} ігор без записаних логів, архів дорахував ${signed(item.computedDelta)} за результатами матчів.</p>`;
      }
      return `<p>${esc(item.type || 'warning')}: ${esc(item.nick || '')}</p>`;
    }).join('')}
  </section>`;
}

function renderSeason(root, { seasonId, league, master, seasons }) {
  const sections = master?.sections || {};
  const meta = sections.season_meta || {};
  const title = meta.title || meta.seasonTitle || titleFromId(seasonId);
  const selectedLeague = normalizeLeague(league) || 'sundaygames';
  const allLeaguePlayers = (Array.isArray(sections.players) ? sections.players : [])
    .filter((player) => playerLeague(player) === selectedLeague);
  const players = sortByRating(allLeaguePlayers);
  const activePlayers = players.filter((player) => playerGames(player) > 0);
  const summary = leagueSummary(sections, selectedLeague);
  const leader = players[0] || {};
  const runnerUp = players[1] || {};
  const impact = sortBy(players, ratingDelta)[0] || {};
  const mvp = sortBy(players, mvpTotal)[0] || {};
  const wr = sortBy(activePlayers.filter((player) => playerGames(player) >= 5), winRate)[0] || {};
  const mostActive = sortBy(activePlayers, playerGames)[0] || {};
  const mostWins = sortBy(activePlayers, wins)[0] || {};
  const consistent = sortBy(activePlayers.filter((player) => playerGames(player) >= 10), (player) => winRate(player) * playerGames(player))[0] || {};
  const gapToSecond = ratingEnd(leader) - ratingEnd(runnerUp);
  const totalGames = num(valueOf(summary, ['matches', 'games'], activePlayers.reduce((sum, player) => sum + playerGames(player), 0)), 0);
  const totalMvp = activePlayers.reduce((sum, player) => sum + mvpTotal(player), 0);
  const leagueClass = `sd-league-${leagueTone(selectedLeague)}`;
  const tone = seasonTone(seasonId);
  const seasonClass = `sd-theme-${tone}`;
  const archiveLabel = seasonNumber(seasons, seasonId);

  root.innerHTML = `<main class="sd-page ${seasonClass} ${leagueClass}">
    <section class="sd-hero">
      <a class="sd-back" href="#seasons">← Всі сезони</a>
      <div class="sd-hero-title">
        <span class="sd-season-status">${archiveLabel} · Архівний сезон</span>
        <h1>${seasonSymbol(tone)}<span>${esc(title)}</span></h1>
        <p>${esc(leagueLabelUA(selectedLeague))} · ${esc(periodText(meta))}</p>
      </div>
      <div class="sd-controls">
        <select class="sd-season-select" id="seasonArchiveSelect" aria-label="Сезон">
          ${seasons.map((id, index) => `<option value="${esc(id)}" ${id === seasonId ? 'selected' : ''}>${seasonNumber(seasons, id)} · ${esc(titleFromId(id))}</option>`).join('')}
        </select>
        <div class="sd-league-switch" aria-label="Ліга">
          <a href="#season?season=${encodeURIComponent(seasonId)}&league=sundaygames" class="${selectedLeague === 'sundaygames' ? 'is-active' : ''}">Доросла</a>
          <a href="#season?season=${encodeURIComponent(seasonId)}&league=kids" class="${selectedLeague === 'kids' ? 'is-active' : ''}">Дитяча</a>
        </div>
      </div>
    </section>

    <section class="sd-kpi-grid" aria-label="Ключові цифри сезону">
      ${kpi('матчів за сезон', totalGames, 'зіграно у лізі', '01')}
      ${kpi('активних гравців', activePlayers.length, `${players.length} записів`, '02')}
      ${kpi('MVP записів', totalMvp, '1/2/3 місця', '03')}
      ${kpi('лідер сезону', playerName(leader), `${ratingEnd(leader)} очок`, '04')}
    </section>

    <section class="sd-summary-layout">
      <article class="sd-summary">
        <span>Підсумок ліги</span>
        <h2>${esc(playerName(leader))}</h2>
        <p>${esc(seasonStory({ leader, runnerUp, impact, mvp, gapToSecond }))}</p>
        <div class="sd-summary-grid">
          <div><strong>${ratingEnd(leader)}</strong><small>очок лідера</small></div>
          <div><strong>${signed(ratingDelta(impact))}</strong><small>найбільший приріст</small></div>
          <div><strong>${pct(winRate(wr))}</strong><small>найкращий WR</small></div>
        </div>
      </article>
      <article class="sd-ranks">
        <div class="sd-section-head">
          <h2>Ранги</h2>
          <span>фінальний зріз ліги</span>
        </div>
        ${rankScale(players)}
      </article>
    </section>

    <section class="sd-highlights-grid">
      ${seasonHighlights({ leader, runnerUp, impact, mvp, wr, mostActive, mostWins, consistent, gapToSecond })}
    </section>

    <section class="sd-analytics">
      <article>
        <div class="sd-section-head">
          <h2>Активність</h2>
          <span>хто грав найбільше</span>
        </div>
        ${topBars(activePlayers, playerGames, (player) => `${playerGames(player)} ігор`)}
      </article>
      <article>
        <div class="sd-section-head">
          <h2>MVP impact</h2>
          <span>особистий внесок</span>
        </div>
        ${topBars(activePlayers, mvpTotal, (player) => `${mvpTotal(player)} MVP`)}
      </article>
    </section>

    <section class="sd-section">
      <div class="sd-section-head">
        <h2>Top-10 сезону</h2>
        <span>фінальний рейтинг</span>
      </div>
      ${playerCards(players, selectedLeague, 10)}
    </section>

    <section class="sd-section">
      <div class="sd-section-head">
        <h2>Повна таблиця</h2>
        <span>${activePlayers.length} активних гравців</span>
      </div>
      ${playersTable(players, selectedLeague)}
    </section>

    ${auditBlock(master, selectedLeague)}
  </main>`;

  root.querySelector('#seasonArchiveSelect')?.addEventListener('change', (event) => {
    const next = event.currentTarget.value;
    location.hash = `#season?season=${encodeURIComponent(next)}&league=${encodeURIComponent(selectedLeague)}`;
  });
}

export async function initSeasonPage(params = {}) {
  const root = document.getElementById('seasonPageRoot') || document.getElementById('view');
  if (!root) return;

  root.innerHTML = '<section class="sd-page"><div class="sd-loading">Завантаження архіву сезону...</div></section>';

  try {
    const seasons = sortSeasonIds(await listSeasonMasters());
    const selectedSeason = seasons.includes(params.season) ? params.season : (seasons[0] || 'spring_2026');
    const selectedLeague = normalizeLeague(params.league) || 'sundaygames';
    const master = await getSeasonMaster(selectedSeason);
    renderSeason(root, {
      seasonId: selectedSeason,
      league: selectedLeague,
      master,
      seasons: seasons.length ? seasons : [selectedSeason]
    });
  } catch (error) {
    renderPageError(root, {
      eyebrow: 'Архів сезону',
      title: 'Сезон не завантажився',
      message: safeErrorMessage(error, 'Не вдалося завантажити сезон.'),
      backHref: '#seasons',
      backLabel: 'До архіву',
      onRetry: () => initSeasonPage(params)
    });
  }
}
