import { getGameDay } from '../core/dataHub.js';
import { DEBUG, debugLog } from '../core/debug.js';
import { normalizeLeague, leagueLabelUA } from '../core/naming.js';
import { getRouteState } from '../core/utils.js';

const DEFAULT_AVATAR_URL = './assets/default-avatar.svg';

function esc(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderDataQualityPanel(dataQuality) {
  const warnings = Array.isArray(dataQuality?.warnings) ? dataQuality.warnings : [];
  if (!DEBUG || warnings.length === 0) return '';
  const visible = warnings.slice(0, 5);
  const more = warnings.length - visible.length;
  return `<section class="admin-quality-panel" aria-label="Data quality warnings">
    <h3>Data quality warnings</h3>
    <div class="admin-quality-panel__list">
      ${visible.map((warning) => `<div class="admin-quality-panel__item admin-quality-panel__item--${esc(warning.severity || 'warning')}">
        <strong>${esc(warning.severity || 'warning')} · ${esc(warning.type || 'UNKNOWN')}</strong>
        <span>${esc(warning.message || '')}</span>
      </div>`).join('')}
    </div>
    ${more > 0 ? `<div class="admin-quality-panel__more">+${more} ще</div>` : ''}
  </section>`;
}

function fmtDelta(v) {
  const n = Number(v) || 0;
  return `${n > 0 ? '+' : ''}${n}`;
}

function fmtRank(value = '') {
  return String(value || '—').trim() || '—';
}

function avatarUrl(player = {}) {
  const value = player?.avatarUrl || player?.avatar || player?.photo || '';
  return String(value || '').trim() || DEFAULT_AVATAR_URL;
}

function avatarFallbackAttr() {
  return `onerror="this.onerror=null;this.src='${DEFAULT_AVATAR_URL}';"`;
}

function rankClass(value = '') {
  const rank = String(value || '').trim().toLowerCase();
  return rank ? `rank-${rank}` : 'rank-f';
}

function resolveParams(params = {}) {
  const { query } = getRouteState();
  return {
    league: normalizeLeague(params.league || query.get('league') || 'sundaygames') || 'sundaygames',
    date: String(params.date || query.get('date') || '').trim()
  };
}

function buildHash(route, params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') q.set(k, String(v));
  });
  const qs = q.toString();
  return `#${route}${qs ? `?${qs}` : ''}`;
}

function canonicalNick(value = '') {
  return String(value || '').trim().toLowerCase();
}

function toSafeCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

function readPlayerMvpCount(player = {}) {
  const directFields = [player?.mvpCount, player?.mvpTotal, player?.mvp, player?.mvp1, player?.mvp2, player?.mvp3];
  for (const value of directFields) {
    if (value === undefined || value === null || value === '') continue;
    const count = toSafeCount(value);
    if (count > 0 || Number(value) === 0) return count;
  }
  return null;
}

function countPlayerMvpFromMatches(player = {}, matches = []) {
  const nickKey = canonicalNick(player?.nick);
  if (!nickKey) return 0;
  let count = 0;
  (Array.isArray(matches) ? matches : []).forEach((match) => {
    ['mvp1', 'mvp2', 'mvp3'].forEach((key) => {
      if (canonicalNick(match?.[key]) === nickKey) count += 1;
    });
  });
  return count;
}

function getPlayerMvpCount(player = {}, matches = []) {
  const directCount = readPlayerMvpCount(player);
  return directCount !== null ? directCount : countPlayerMvpFromMatches(player, matches);
}

function teamLabel(teamKey = 'team1') {
  const n = Number(String(teamKey).replace('team', ''));
  return Number.isFinite(n) && n > 0 ? `Команда ${n}` : 'Команда';
}

function compactTeamPreview(members = []) {
  const clean = (Array.isArray(members) ? members : [])
    .map((nick) => String(nick || '').trim())
    .filter(Boolean);
  if (!clean.length) return 'Без складу';
  if (clean.length <= 2) return clean.join(', ');
  return `${clean.slice(0, 2).join(', ')} +${clean.length - 2}`;
}

function prettyWinner(winner = '') {
  if (winner === 'tie') return 'Нічия';
  if (/^team\d$/.test(String(winner))) return `${teamLabel(winner)} перемогла`;
  return 'Переможця не визначено';
}

function matchOutcomeLabel(winner = '') {
  if (winner === 'tie') return 'НІЧИЯ';
  if (/^team\d$/.test(String(winner))) return 'ПЕРЕМОГА';
  return 'ОЧІКУЄ РЕЗУЛЬТАТ';
}

function sideOutcomeClass(teamKey = '', winnerKey = '', winner = '') {
  if (winner === 'tie') return 'is-draw';
  if (!winnerKey) return 'is-pending';
  return teamKey === winnerKey ? 'is-win' : 'is-loss';
}

function sideOutcomeShort(teamKey = '', winnerKey = '', winner = '') {
  if (winner === 'tie') return 'D';
  if (!winnerKey) return '—';
  return teamKey === winnerKey ? 'W' : 'L';
}

function cleanDateLabel(date = '', timestamp = '') {
  const fromDate = String(date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) return fromDate;
  const fromTimestamp = String(timestamp || '').trim();
  const match = fromTimestamp.match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  return fromDate || fromTimestamp || '—';
}

function parseSeries(series = '') {
  const res = { team1: 0, team2: 0, team3: 0, team4: 0, draws: 0 };
  (String(series || '').match(/[0-4]/g) || []).forEach((token) => {
    if (token === '0') res.draws += 1;
    else res[`team${token}`] += 1;
  });
  return res;
}

function computeTeamStats(team = [], pointsChanges = [], roster = new Map()) {
  const keys = new Set(team.map((nick) => canonicalNick(nick)));
  let totalRating = 0;
  let totalDelta = 0;

  team.forEach((nick) => {
    const p = roster.get(canonicalNick(nick));
    totalRating += Number(p?.pointsAfter) || 0;
  });

  pointsChanges.forEach((item) => {
    if (keys.has(canonicalNick(item.nick))) totalDelta += Number(item.delta) || 0;
  });

  return { totalRating, totalDelta };
}

function getPlayerGameDelta(nick = '', pointsChanges = []) {
  const key = canonicalNick(nick);
  if (!key) return 0;
  const item = (Array.isArray(pointsChanges) ? pointsChanges : [])
    .find((change) => canonicalNick(change?.nick) === key);
  return Number(item?.delta) || 0;
}

function buildPlayersTable(players = [], league = 'sundaygames', matches = []) {
  if (!players.length) {
    return '<p class="px-card__text">Для цього дня гравців ще немає.</p>';
  }

  return `
    <div class="gameday-player-list">
      ${players.map((p, idx) => {
        const delta = Number(p.delta || 0);
        const tone = delta > 0 ? 'pos' : delta < 0 ? 'neg' : 'neu';
        const mvpCount = getPlayerMvpCount(p, matches);
        const mvpTone = mvpCount > 0 ? 'is-accent' : 'is-muted';
        return `
          <a class="gameday-player-row" href="#player?league=${encodeURIComponent(league)}&nick=${encodeURIComponent(p.nick || '')}">
            <span class="gameday-player-row__place">#${idx + 1}</span>
            <img class="gameday-player-row__avatar" src="${esc(avatarUrl(p))}" alt="${esc(p.nick || 'Аватар гравця')}" loading="lazy" ${avatarFallbackAttr()}>
            <span class="gameday-player-row__main">
              <strong>${esc(p.nick || 'Гравець')}</strong>
              <span><b class="gameday-rank-letter ${rankClass(p.rankAfter || p.rankLetter)}">${esc(fmtRank(p.rankAfter || p.rankLetter))}</b> · ${esc(String(p.pointsAfter ?? 0))} очок · ${esc(`${p.matches ?? 0} іг / ${p.wins ?? 0} пер`)} · <b class="gameday-player-row__mvp ${mvpTone}">MVP ${esc(String(mvpCount))}</b></span>
            </span>
            <span class="gameday-player-row__delta ${tone}">${esc(fmtDelta(delta))}</span>
          </a>`;
      }).join('')}
    </div>`;
}

function buildMatchCard(match = {}, roster = new Map()) {
  const rawTeams = {
    team1: match.teams?.sideA || [],
    team2: match.teams?.sideB || [],
    team3: match.teams?.sideC || [],
    team4: match.teams?.sideD || []
  };
  const teams = Object.entries(rawTeams).filter(([, members]) => Array.isArray(members) && members.length);
  const series = parseSeries(match.series);
  const scoreParts = teams.map(([key]) => Number(series[key] || 0));
  const scoreLabel = scoreParts.length ? scoreParts.join(' : ') : (match.seriesSummary || '—');
  const winnerKey = /^team\d$/.test(String(match.winner || '')) ? String(match.winner) : '';
  const matchId = `gamedayMatch${match.index}`;
  const summaryLine = cleanDateLabel(match.date, match.timestamp);
  const matchupTeams = teams.slice(0, 2);
  const versusLine = matchupTeams.map(([, members]) => compactTeamPreview(members)).join(' vs ');
  const teamSideMarkup = ([key, members], side = 'left') => {
    const outcome = sideOutcomeClass(key, winnerKey, match.winner);
    return `<div class="gameday-matchup-side gameday-matchup-side--${side} ${outcome}">
      <span class="gameday-matchup-side__status">${sideOutcomeShort(key, winnerKey, match.winner)}</span>
      <strong>${esc(teamLabel(key))}</strong>
      <span>${esc(compactTeamPreview(members))}</span>
    </div>`;
  };
  const mvpRows = [
    { label: 'MVP 1', nick: match.mvp1, tone: 'gold' },
    { label: 'MVP 2', nick: match.mvp2, tone: 'silver' },
    { label: 'MVP 3', nick: match.mvp3, tone: 'bronze' }
  ].filter((item) => item.nick);
  const mvpLabel = mvpRows.length
    ? mvpRows.map((row) => row.nick).filter(Boolean).join(' · ')
    : 'MVP ще не визначено';
  const teamTotals = teams.map(([key, members]) => {
    const stats = computeTeamStats(members, match.pointsChanges || [], roster);
    return `${teamLabel(key)}: ${fmtDelta(stats.totalDelta)}`;
  }).join(' · ');

  return `
    <article class="gameday-match-card ${winnerKey ? `gameday-match-card--winner-${winnerKey}` : ''}" data-match-id="${matchId}">
      <button class="gameday-match-head" type="button" aria-expanded="false" aria-controls="${matchId}Details" id="${matchId}Trigger">
        <div class="gameday-match-head__topline">
          <span class="gameday-match-head__eyebrow">ГРА #${match.index}</span>
          <span class="gameday-match-head__mode">${esc(match.mode || match.type || 'Матч дня')}</span>
          <span class="gameday-match-head__chevron" aria-hidden="true">⌄</span>
        </div>
        <div class="gameday-matchup">
          ${matchupTeams[0] ? teamSideMarkup(matchupTeams[0], 'left') : '<div class="gameday-matchup-side is-pending"><strong>Команда 1</strong><span>Склад ще не визначено</span></div>'}
          <div class="gameday-matchup-score">
            <span>${esc(matchOutcomeLabel(match.winner))}</span>
            <strong>${esc(scoreLabel)}</strong>
            <em>VS</em>
          </div>
          ${matchupTeams[1] ? teamSideMarkup(matchupTeams[1], 'right') : '<div class="gameday-matchup-side gameday-matchup-side--right is-pending"><strong>Команда 2</strong><span>Склад ще не визначено</span></div>'}
        </div>
        <div class="gameday-match-head__meta">
          <span>${esc(summaryLine || 'Ігровий лог')}</span>
          <span>MVP: ${esc(mvpLabel)}</span>
        </div>
      </button>

      <div class="gameday-match-details" id="${matchId}Details" role="region" aria-labelledby="${matchId}Trigger" hidden>
        <div class="gameday-match-teams">
          ${teams.map(([key, members]) => {
            const stats = computeTeamStats(members, match.pointsChanges || [], roster);
            const isWinner = key === winnerKey;
            const isDraw = match.winner === 'tie';
            const teamTone = isWinner ? 'is-winner' : isDraw ? 'is-draw' : winnerKey ? 'is-loser' : '';
            return `
              <section class="gameday-team-box ${teamTone}">
                <div class="gameday-team-box__head">
                  <div class="gameday-team-box__title-wrap">
                    <h3>${teamLabel(key)}</h3>
                    ${isWinner ? '<span class="gameday-team-box__winner-badge">переможець</span>' : isDraw ? '<span class="gameday-team-box__winner-badge">нічия</span>' : winnerKey ? '<span class="gameday-team-box__winner-badge">поразка</span>' : ''}
                  </div>
                  <span class="gameday-team-box__delta ${stats.totalDelta > 0 ? 'pos' : stats.totalDelta < 0 ? 'neg' : 'neu'}">${esc(fmtDelta(stats.totalDelta))}</span>
                </div>
                <ul class="gameday-team-player-list">
                  ${members.map((nick) => {
                    const delta = getPlayerGameDelta(nick, match.pointsChanges || []);
                    const tone = delta > 0 ? 'pos' : delta < 0 ? 'neg' : 'neu';
                    return `<li><span>${esc(nick)}</span><b class="${tone}">${esc(fmtDelta(delta))}</b></li>`;
                  }).join('')}
                </ul>
                <div class="gameday-team-box__foot">${stats.totalRating || 0} pts сумарно</div>
              </section>`;
          }).join('')}
        </div>

        <section class="gameday-match-summary">
          <div><span>Підсумок</span><strong>${esc(prettyWinner(match.winner))}</strong></div>
          <div><span>Рахунок</span><strong>${esc(scoreLabel)}</strong></div>
          <div><span>Бали команд</span><strong>${esc(teamTotals || '—')}</strong></div>
        </section>

        ${mvpRows.length ? `
          <section class="gameday-match-awards">
            ${mvpRows.map((row) => `<div class="gameday-award-chip gameday-award-chip--${row.tone}"><span>${row.label}</span><b>${esc(row.nick)}</b></div>`).join('')}
          </section>` : ''}

        ${match.link ? `<a class="btn btn--secondary gameday-log-link" href="${esc(match.link)}" target="_blank" rel="noopener">Відкрити лог / PDF</a>` : ''}
      </div>
    </article>`;
}

function render(root, payload, filters) {
  const players = Array.isArray(payload.activePlayers) ? payload.activePlayers : [];
  const matches = Array.isArray(payload.matches) ? payload.matches : [];
  const dates = Array.isArray(payload.availableDates) ? payload.availableDates : [];
  const summary = payload.summary || {};
  const rosterMap = new Map(players.map((p) => [canonicalNick(p.nick), p]));
  const partialNote = payload.hasLeagueSnapshot
    ? ''
    : '<p class="px-card__text">Таблиця ліги зараз недоступна, тому показуємо лише базовий лог ігрового дня.</p>';
  const gamesCount = Number(summary.matches ?? payload.gamesCount ?? matches.length ?? 0);
  const playersCount = Number(summary.participants ?? players.length ?? 0);
  const mvpDay = (typeof summary.mvpDay === 'string' ? summary.mvpDay : summary.mvpDay?.nick) || 'MVP ще не визначено';
  const bestGrowthNick = summary.bestDelta?.nick || summary.bestGain?.nick || '';
  const bestGrowthDelta = summary.bestDelta?.delta ?? summary.bestGain?.delta;
  const bestGrowth = bestGrowthNick ? `${bestGrowthNick} ${fmtDelta(bestGrowthDelta)}` : 'Приріст ще не розраховано';

  root.classList.add('gameday-v2');
  root.innerHTML = `
    <section class="px-card gameday-hero">
      <div class="gameday-hero__eyebrow">Ігровий день</div>
      <h1 class="px-card__title">${esc(payload.date || '—')}</h1>
      <div class="gameday-hero__date">${esc(leagueLabelUA(payload.league))}</div>
    </section>

    <section class="px-card gameday-summary-hero" aria-label="Підсумок ігрового дня">
      <div class="gameday-summary-grid">
        <div class="gameday-summary-card"><span>Ігор</span><b>${esc(String(gamesCount))}</b></div>
        <div class="gameday-summary-card"><span>Гравців</span><b>${esc(String(playersCount))}</b></div>
        <div class="gameday-summary-card gameday-summary-card--mvp"><span>MVP дня</span><b>${esc(mvpDay)}</b></div>
        <div class="gameday-summary-card gameday-summary-card--growth"><span>Найбільший приріст</span><b>${esc(bestGrowth)}</b></div>
      </div>
      ${partialNote}
    </section>

    <section class="px-card gameday-controls-card" aria-label="Фільтри ігрового дня">
      <div class="gameday-toolbar">
        <label>Ліга
          <select id="gamedayLeague" class="search-input">
            <option value="sundaygames" ${filters.league === 'sundaygames' ? 'selected' : ''}>Доросла</option>
            <option value="kids" ${filters.league === 'kids' ? 'selected' : ''}>Дитяча</option>
          </select>
        </label>
        <label>Дата
          <select id="gamedayDate" class="search-input">
            ${dates.map((d) => `<option value="${esc(d)}" ${d === payload.date ? 'selected' : ''}>${esc(d)}</option>`).join('')}
          </select>
        </label>
        <button id="gamedayLoad" class="btn">Оновити</button>
      </div>
    </section>
    ${renderDataQualityPanel(payload.dataQuality)}

    <section class="px-card gameday-players-block">
      <div class="gameday-section-head">
        <h2 class="px-card__title">Таблиця гравців дня</h2>
        <p class="px-card__text">Хто як зіграв: очки, приріст і результат за день.</p>
      </div>
      ${buildPlayersTable(players, payload.league, matches)}
    </section>

    <section class="px-card gameday-matches-block">
      <div class="gameday-section-head">
        <h2 class="px-card__title">Лог ігор</h2>
        <p class="px-card__text">Короткий список матчів дня з рахунком, переможцем і MVP.</p>
      </div>
      <div class="gameday-match-list">
        ${(matches || []).map((m) => buildMatchCard(m, rosterMap)).join('') || '<p class="px-card__text">Для цього дня ігор ще немає.</p>'}
      </div>
    </section>
  `;

  const leagueSelect = root.querySelector('#gamedayLeague');
  const dateSelect = root.querySelector('#gamedayDate');
  const loadBtn = root.querySelector('#gamedayLoad');

  leagueSelect?.addEventListener('change', () => {
    location.hash = buildHash('gameday', { league: normalizeLeague(leagueSelect.value) || 'sundaygames' });
  });

  loadBtn?.addEventListener('click', () => {
    location.hash = buildHash('gameday', { league: normalizeLeague(leagueSelect?.value) || payload.league, date: String(dateSelect?.value || '').trim() });
  });

  const matchCards = Array.from(root.querySelectorAll('.gameday-match-card'));
  const closeCard = (card) => {
    const trigger = card.querySelector('.gameday-match-head');
    const details = card.querySelector('.gameday-match-details');
    card.classList.remove('is-open');
    trigger?.setAttribute('aria-expanded', 'false');
    details?.setAttribute('hidden', '');
  };
  const openCard = (card) => {
    const trigger = card.querySelector('.gameday-match-head');
    const details = card.querySelector('.gameday-match-details');
    card.classList.add('is-open');
    details?.removeAttribute('hidden');
    trigger?.setAttribute('aria-expanded', 'true');
  };

  matchCards.forEach((card, index) => {
    const trigger = card.querySelector('.gameday-match-head');
    trigger?.addEventListener('click', () => {
      const isOpen = card.classList.contains('is-open');
      matchCards.forEach((item) => closeCard(item));
      if (!isOpen) openCard(card);
    });
    if (index === 0) openCard(card);
  });
}

export async function initGameDayPage(params = {}) {
  const root = document.getElementById('gamedayRoot') || document.getElementById('view');
  if (!root) return;
  await initPage(root, params);
}

export async function initPage(root, params = {}) {
  if (!root) return;
  debugLog('[gameday] init start');
  try {
    await safeInitGameDayPage(root, params);
  } catch (err) {
    console.error('[gameday] fatal crash:', err);
    root.innerHTML = `
      <div style="padding:20px;color:#fff">
        ❌ Помилка завантаження сторінки
      </div>
    `;
  }
}

async function safeInitGameDayPage(root, params = {}) {
  root.innerHTML = `
    <section class="px-card gameday-loading-shell">
      <h1 class="gameday-loading-shell__title">Ігровий день</h1>
      <p class="gameday-loading-shell__text">Завантаження...</p>
    </section>`;
  const filters = resolveParams(params);
  const payload = await getGameDay({ league: filters.league, date: filters.date });
  debugLog('[gameday] data loaded', payload);
  if (!payload) {
    console.warn('[gameday] no data, rendering empty state');
    root.innerHTML = `
      <section class="px-card gameday-loading-shell">
        <h1 class="gameday-loading-shell__title">Ігровий день</h1>
        <p class="gameday-loading-shell__text">Немає даних для відображення.</p>
      </section>`;
    return;
  }
  const safePayload = {
    ...payload,
    activePlayers: Array.isArray(payload?.activePlayers) ? payload.activePlayers : [],
    matches: Array.isArray(payload?.matches) ? payload.matches : [],
    availableDates: Array.isArray(payload?.availableDates) ? payload.availableDates : [],
    summary: payload?.summary || {}
  };
  if (!safePayload?.hasLeagueSnapshot) {
    console.warn('[gameday] rendered in partial mode without league snapshot sheet');
  }
  render(root, safePayload, filters);
}
