import { getGameDay } from '../core/dataHub.js';
import { normalizeLeague, leagueLabelUA } from '../core/naming.js';
import { getRouteState } from '../core/utils.js';

function esc(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function fmtDelta(v) {
  const n = Number(v) || 0;
  return `${n > 0 ? '+' : ''}${n}`;
}

function fmtRank(value = '') {
  return String(value || '—').trim() || '—';
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

function buildPlayersTable(players = [], league = 'sundaygames') {
  if (!players.length) {
    return '<p class="px-card__text">Немає гравців для цієї дати.</p>';
  }

  return `
    <div class="gameday-table-wrap">
      <table class="gameday-table gameday-table--players">
        <thead>
          <tr>
            <th>#</th>
            <th>Гравець</th>
            <th>Ранг</th>
            <th>Очки</th>
            <th>Δ</th>
            <th>Іг / Пер</th>
            <th>MVP</th>
          </tr>
        </thead>
        <tbody>
          ${players.map((p, idx) => `
            <tr>
              <td>#${idx + 1}</td>
              <td>
                <a class="gameday-table__player-link" href="#player?league=${encodeURIComponent(league)}&nick=${encodeURIComponent(p.nick || '')}">
                  <img class="gameday-avatar" src="${esc(p.avatarUrl || '../assets/default-avatar.svg')}" alt="${esc(p.nick || '')}">
                  <span>${esc(p.nick || 'Гравець')}</span>
                </a>
              </td>
              <td><span class="gameday-rank-letter ${rankClass(p.rankAfter || p.rankLetter)}">${esc(fmtRank(p.rankAfter || p.rankLetter))}</span></td>
              <td>${esc(String(p.pointsAfter ?? 0))}</td>
              <td class="${Number(p.delta || 0) > 0 ? 'pos' : Number(p.delta || 0) < 0 ? 'neg' : 'neu'}">${esc(fmtDelta(p.delta))}</td>
              <td>${esc(`${p.matches ?? 0} / ${p.wins ?? 0}`)}</td>
              <td>${esc(`${p.mvp1 || 0}/${p.mvp2 || 0}/${p.mvp3 || 0}`)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
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
  const summaryLine = [match.date, match.timestamp].filter(Boolean).join(' · ');
  const versusLine = teams.map(([, members]) => compactTeamPreview(members)).join(' vs ');
  const teamsLine = teams.map(([key]) => {
    const isWinner = key === winnerKey;
    return `<span class="gameday-match-head__team ${isWinner ? 'is-winner' : ''}">${esc(teamLabel(key))}</span>`;
  }).join('<span class="gameday-match-head__vs">vs</span>');
  const mvpRows = [
    { label: 'MVP 1', nick: match.mvp1, tone: 'gold' },
    { label: 'MVP 2', nick: match.mvp2, tone: 'silver' },
    { label: 'MVP 3', nick: match.mvp3, tone: 'bronze' }
  ].filter((item) => item.nick);

  return `
    <article class="gameday-match-card ${winnerKey ? `gameday-match-card--winner-${winnerKey}` : ''}" data-match-id="${matchId}">
      <button class="gameday-match-head" type="button" aria-expanded="false" aria-controls="${matchId}Details" id="${matchId}Trigger">
        <div class="gameday-match-head__top">
          <span class="gameday-match-head__eyebrow">Матч #${match.index}</span>
          <span class="gameday-match-head__score">${esc(scoreLabel)}</span>
        </div>
        <div class="gameday-match-head__title">${teamsLine || 'Склади команд'}</div>
        <div class="gameday-match-head__subline">${esc(versusLine || 'Склади команд')}</div>
        <div class="gameday-match-head__meta">
          <span>${esc(summaryLine || 'Ігровий лог')}</span>
        </div>
      </button>

      <div class="gameday-match-details" id="${matchId}Details" role="region" aria-labelledby="${matchId}Trigger" hidden>
        <div class="gameday-match-teams">
          ${teams.map(([key, members]) => {
            const stats = computeTeamStats(members, match.pointsChanges || [], roster);
            const isWinner = key === winnerKey;
            return `
              <section class="gameday-team-box ${isWinner ? 'is-winner' : ''}">
                <div class="gameday-team-box__head">
                  <div class="gameday-team-box__title-wrap">
                    <h3>${teamLabel(key)}</h3>
                    ${isWinner ? '<span class="gameday-team-box__winner-badge">переможець</span>' : ''}
                  </div>
                  <span class="gameday-team-box__delta ${stats.totalDelta > 0 ? 'pos' : stats.totalDelta < 0 ? 'neg' : 'neu'}">${esc(fmtDelta(stats.totalDelta))}</span>
                </div>
                <ul>
                  ${members.map((nick) => `<li>${esc(nick)}</li>`).join('')}
                </ul>
                <div class="gameday-team-box__foot">${stats.totalRating || 0} pts сумарно</div>
              </section>`;
          }).join('')}
        </div>

        ${mvpRows.length ? `
          <section class="gameday-match-awards">
            ${mvpRows.map((row) => `<div class="gameday-award-chip gameday-award-chip--${row.tone}"><span>${row.label}</span><b>${esc(row.nick)}</b></div>`).join('')}
          </section>` : ''}

        ${(match.pointsChanges || []).length ? `
          <section class="gameday-delta-list">
            ${(match.pointsChanges || []).map((c) => `<span class="${Number(c.delta || 0) > 0 ? 'pos' : Number(c.delta || 0) < 0 ? 'neg' : 'neu'}">${esc(c.nick)} ${esc(fmtDelta(c.delta))}</span>`).join('')}
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
  const rosterMap = new Map(players.map((p) => [String(p.nick || '').trim().toLowerCase(), p]));
  const partialNote = payload.hasLeagueSnapshot
    ? ''
    : '<p class="px-card__text">Таблиця ліги зараз недоступна, тому показуємо лише базовий лог ігрового дня.</p>';

  root.classList.add('gameday-v2');
  root.innerHTML = `
    <section class="px-card gameday-hero">
      <div class="gameday-hero__eyebrow">Ігровий день</div>
      <h1 class="px-card__title">${esc(leagueLabelUA(payload.league))}</h1>
      <div class="gameday-hero__date">${esc(payload.date || '—')}</div>
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
      <div class="gameday-summary-grid">
        <div class="gameday-summary-card"><span>Матчів</span><b>${summary.matches ?? payload.gamesCount ?? 0}</b></div>
        <div class="gameday-summary-card"><span>Найбільший приріст</span><b>${esc(summary.bestDelta?.nick ? `${summary.bestDelta.nick} ${fmtDelta(summary.bestDelta.delta)}` : '—')}</b></div>
        <div class="gameday-summary-card"><span>Гравців</span><b>${summary.participants ?? players.length}</b></div>
        <div class="gameday-summary-card"><span>MVP дня</span><b>${esc(summary.mvpDay?.nick || '—')}</b></div>
      </div>
      ${partialNote}
    </section>

    <section class="px-card gameday-players-block">
      <div class="gameday-section-head">
        <h2 class="px-card__title">Таблиця гравців дня</h2>
        <p class="px-card__text">Компактна зведена таблиця за день: очки, приріст, матчі, перемоги та MVP.</p>
      </div>
      ${buildPlayersTable(players, payload.league)}
    </section>

    <section class="px-card gameday-matches-block">
      <div class="gameday-section-head">
        <h2 class="px-card__title">Лог матчів</h2>
        <p class="px-card__text">Кожен матч згорнутий. У шапці одразу видно рахунок, склади та переможця.</p>
      </div>
      <div class="gameday-match-list">
        ${(matches || []).map((m) => buildMatchCard(m, rosterMap)).join('') || '<p class="px-card__text">Немає матчів за цей день.</p>'}
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
  console.log('[gameday] init start');
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
  console.log('[gameday] data loaded', payload);
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
