import { getGameDay, safeErrorMessage } from '../core/dataHub.js';
import { normalizeLeague, leagueLabelUA } from '../core/naming.js';
import { getRouteState } from '../core/utils.js';

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function fmtDelta(v) { const n = Number(v) || 0; return `${n > 0 ? '+' : ''}${n}`; }
function fmtShift(v) {
  if (!Number.isFinite(v) || v === 0) return '→ 0';
  return v > 0 ? `↑ ${v}` : `↓ ${Math.abs(v)}`;
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

function teamLabel(teamKey = 'team1') {
  const n = Number(String(teamKey).replace('team', ''));
  return Number.isFinite(n) && n > 0 ? `Команда ${n}` : 'Команда';
}

function prettyWinner(winner = '') {
  if (winner === 'tie') return 'Нічия';
  if (/^team\d$/.test(String(winner))) return `${teamLabel(winner)} перемогла`;
  return 'Переможець не визначений';
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
  const keys = new Set(team.map((nick) => String(nick || '').trim().toLowerCase()));
  let totalRating = 0;
  let totalDelta = 0;

  team.forEach((nick) => {
    const p = roster.get(String(nick || '').trim().toLowerCase());
    totalRating += Number(p?.pointsAfter) || 0;
  });

  pointsChanges.forEach((item) => {
    if (keys.has(String(item.nick || '').trim().toLowerCase())) totalDelta += Number(item.delta) || 0;
  });

  return { totalRating, totalDelta };
}

function buildPlayersTable(players = []) {
  return `
    <div class="gameday-table-wrap">
      <table class="gameday-table">
        <thead>
          <tr>
            <th>ΔPlace</th><th>ΔRank</th><th>Avatar</th><th>Nick</th><th>Before</th><th>After</th><th>Δ</th><th>M</th><th>W</th><th>L</th><th>MVP1</th><th>MVP2</th><th>MVP3</th>
          </tr>
        </thead>
        <tbody>
          ${players.map((p) => {
            const placeShift = (p.placeBefore && p.placeAfter) ? (p.placeBefore - p.placeAfter) : 0;
            const rankShift = String(p.rankBefore || '') === String(p.rankAfter || '') ? 0 : ((String(p.rankAfter || '') < String(p.rankBefore || '')) ? 1 : -1);
            return `<tr>
              <td class="${placeShift > 0 ? 'pos' : placeShift < 0 ? 'neg' : 'neu'}">${esc(fmtShift(placeShift))}</td>
              <td class="${rankShift > 0 ? 'pos' : rankShift < 0 ? 'neg' : 'neu'}">${esc(String(p.rankBefore || '—'))} → ${esc(String(p.rankAfter || '—'))}</td>
              <td><img class="gameday-avatar" src="${esc(p.avatarUrl || '../assets/default-avatar.svg')}" alt="${esc(p.nick)}"></td>
              <td>${esc(p.nick)}</td>
              <td>${p.pointsBefore ?? 0}</td>
              <td>${p.pointsAfter ?? 0}</td>
              <td class="${(Number(p.delta) || 0) > 0 ? 'pos' : (Number(p.delta) || 0) < 0 ? 'neg' : 'neu'}">${esc(fmtDelta(p.delta))}</td>
              <td>${p.matches ?? 0}</td><td>${p.wins ?? 0}</td><td>${p.losses ?? 0}</td>
              <td>${p.mvp1 ?? 0}</td><td>${p.mvp2 ?? 0}</td><td>${p.mvp3 ?? 0}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="13">Немає даних за обрану дату.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function buildMatchCard(match = {}, roster = new Map()) {
  const teams = Object.entries({ team1: match.teams?.sideA || [], team2: match.teams?.sideB || [] }).filter(([, members]) => members.length);
  const series = parseSeries(match.series);
  const scoreboard = teams.map(([key]) => Number(series[key] || 0));
  const scoreLabel = scoreboard.length >= 2 ? `${scoreboard[0]}:${scoreboard[1]}` : (match.seriesSummary || '—');
  const winnerKey = match.winner === 'team1' || match.winner === 'team2' ? match.winner : '';
  const mvpRows = [
    { label: 'MVP 1', nick: match.mvp1 },
    { label: 'MVP 2', nick: match.mvp2 },
    { label: 'MVP 3', nick: match.mvp3 }
  ];

  return `
    <article class="gameday-match-card">
      <header class="gameday-match-head">
        <div class="gameday-match-head__title">Матч #${match.index}</div>
        <div class="gameday-match-head__meta">${esc(match.date || '')} ${esc(match.timestamp || '')}</div>
        <div class="gameday-match-head__sub">${esc(match.seriesSummary || '—')}</div>
      </header>

      <div class="gameday-match-layout">
        ${teams.map(([key, members]) => {
          const stats = computeTeamStats(members, match.pointsChanges || [], roster);
          const winnerClass = key === winnerKey ? ' is-winner' : '';
          return `<section class="gameday-team-box${winnerClass}">
            <h3>${teamLabel(key)} ${key === winnerKey ? '<span class="winner-tag">WINNER</span>' : ''}</h3>
            <ul>${members.map((nick) => `<li>${esc(nick)}</li>`).join('')}</ul>
            <div class="gameday-team-box__stat">Σ рейтинг: <b>${stats.totalRating || 0}</b></div>
            <div class="gameday-team-box__stat">Σ Δ очок: <b class="${stats.totalDelta > 0 ? 'pos' : stats.totalDelta < 0 ? 'neg' : 'neu'}">${esc(fmtDelta(stats.totalDelta))}</b></div>
          </section>`;
        }).join('')}

        <section class="gameday-result-box">
          <div class="gameday-result-box__score">${esc(scoreLabel)}</div>
          <div class="gameday-result-box__draws">Нічиї: ${series.draws}</div>
          <div class="gameday-result-box__winner">${esc(prettyWinner(match.winner))}</div>
        </section>
      </div>

      <section class="gameday-mvp-box">
        <h4>MVP матчу</h4>
        <div class="gameday-mvp-box__grid">
          ${mvpRows.map((row) => `<div class="gameday-mvp-item"><span>${row.label}</span><b>${esc(row.nick || '—')}</b></div>`).join('')}
        </div>
      </section>

      <section class="gameday-delta-list">
        ${(match.pointsChanges || []).map((c) => `<span class="${(Number(c.delta) || 0) > 0 ? 'pos' : (Number(c.delta) || 0) < 0 ? 'neg' : 'neu'}">${esc(c.nick)} ${esc(fmtDelta(c.delta))}</span>`).join('') || '<span class="neu">Δ недоступний</span>'}
      </section>

      ${match.link ? `<a class="btn btn--secondary" href="${esc(match.link)}" target="_blank" rel="noopener">PDF / Log</a>` : ''}
    </article>`;
}

function render(root, payload, filters) {
  const players = Array.isArray(payload.activePlayers) ? payload.activePlayers : [];
  const matches = Array.isArray(payload.matches) ? payload.matches : [];
  const dates = Array.isArray(payload.availableDates) ? payload.availableDates : [];
  const summary = payload.summary || {};
  const rosterMap = new Map(players.map((p) => [String(p.nick || '').trim().toLowerCase(), p]));

  root.classList.add('gameday-v2');
  root.innerHTML = `
    <section class="px-card gameday-hero">
      <h1 class="px-card__title">Ігровий день</h1>
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
        <button id="gamedayLoad" class="btn">Завантажити</button>
      </div>
      <div class="league-summary-strip">
        <span>${esc(leagueLabelUA(payload.league))}</span>
        <span>Матчів: ${payload.gamesCount ?? 0}</span>
        <span>Раундів: ${payload.roundsCount ?? 0}</span>
        <span>Гравців: ${players.length}</span>
      </div>
    </section>

    <section class="px-card">
      <h2 class="px-card__title">Гравці ігрового дня</h2>
      ${buildPlayersTable(players)}
    </section>

    <section class="px-card">
      <h2 class="px-card__title">Матчі ігрового дня</h2>
      <div class="gameday-match-list">
        ${matches.map((m) => buildMatchCard(m, rosterMap)).join('') || '<p class="px-card__text">Немає матчів за цей день.</p>'}
      </div>
    </section>

    <section class="px-card gameday-footer-summary">
      <h3 class="px-card__title">Короткий підсумок дня</h3>
      <div class="gameday-footer-grid">
        <div class="gameday-footer-item"><span>Матчів</span><b>${summary.matches ?? 0}</b></div>
        <div class="gameday-footer-item"><span>Учасників</span><b>${summary.participants ?? 0}</b></div>
        <div class="gameday-footer-item"><span>Розіграно балів</span><b>${summary.totalPointsPlayed ?? 0}</b></div>
        <div class="gameday-footer-item"><span>Топ приріст</span><b>${esc(summary.bestGain?.nick || '—')} (${esc(fmtDelta(summary.bestGain?.delta || 0))})</b></div>
        <div class="gameday-footer-item"><span>MVP дня</span><b>${esc(summary.mvpDay?.nick || '—')}</b></div>
        <div class="gameday-footer-item"><span>Кращий winrate</span><b>${esc(summary.bestWinRate?.nick || '—')} (${summary.bestWinRate?.winRate ?? 0}%)</b></div>
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
}

export async function initGameDayPage(params = {}) {
  const root = document.getElementById('gamedayRoot') || document.getElementById('view');
  if (!root) return;
  root.innerHTML = '<section class="px-card"><h1 class="px-card__title">Ігровий день</h1><p class="px-card__text">Завантаження…</p></section>';
  try {
    const filters = resolveParams(params);
    const payload = await getGameDay({ league: filters.league, date: filters.date });
    render(root, payload, filters);
  } catch (error) {
    root.innerHTML = `<section class="px-card"><h1 class="px-card__title">Ігровий день</h1><p class="px-card__text">${esc(safeErrorMessage(error, 'Помилка завантаження'))}</p></section>`;
  }
}
