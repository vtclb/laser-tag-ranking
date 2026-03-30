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

function render(root, payload, filters) {
  const players = Array.isArray(payload.activePlayers) ? payload.activePlayers : [];
  const matches = Array.isArray(payload.matches) ? payload.matches : [];
  const dates = Array.isArray(payload.availableDates) ? payload.availableDates : [];
  const summary = payload.summary || {};

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
      </div>
    </section>

    <section class="px-card">
      <h2 class="px-card__title">Матчі ігрового дня</h2>
      <div class="gameday-match-list">
        ${matches.map((m) => `
          <article class="gameday-match-card">
            <header class="gameday-match-head">
              <strong>Match #${m.index}</strong>
              <span>${esc(m.date || '')} ${esc(m.timestamp || '')}</span>
              <span>${esc(m.seriesSummary || m.series || '—')}</span>
              <span>Winner: ${esc(m.winner || '—')}</span>
            </header>
            <div class="gameday-match-body">
              <div><b>Team A:</b> ${esc((m.teams?.sideA || []).join(', ') || '—')}</div>
              <div><b>VS</b></div>
              <div><b>Team B:</b> ${esc((m.teams?.sideB || []).join(', ') || '—')}</div>
              ${(m.teams?.sideC || []).length ? `<div><b>Team C:</b> ${esc(m.teams.sideC.join(', '))}</div>` : ''}
              ${(m.teams?.sideD || []).length ? `<div><b>Team D:</b> ${esc(m.teams.sideD.join(', '))}</div>` : ''}
              <div class="gameday-points-row">${(m.pointsChanges || []).map((c) => `<span>${esc(c.nick)}: ${esc(fmtDelta(c.delta))}</span>`).join('') || '<span>Δ недоступний</span>'}</div>
              <div class="gameday-mvp">MVP1: ${esc(m.mvp1 || '—')} · MVP2: ${esc(m.mvp2 || '—')} · MVP3: ${esc(m.mvp3 || '—')}</div>
              ${m.link ? `<a class="btn btn--secondary" href="${esc(m.link)}" target="_blank" rel="noopener">PDF / Log</a>` : ''}
            </div>
          </article>
        `).join('') || '<p class="px-card__text">Немає матчів за цей день.</p>'}
      </div>
    </section>

    <section class="px-card gameday-footer-summary">
      <h3 class="px-card__title">Короткий підсумок дня</h3>
      <div class="league-summary-strip">
        <span>Матчів: ${summary.matches ?? 0}</span>
        <span>Учасників: ${summary.participants ?? 0}</span>
        <span>Розіграно балів: ${summary.totalPointsPlayed ?? 0}</span>
      </div>
      <p class="px-card__text">Топ приріст: <b>${esc(summary.bestGain?.nick || '—')}</b> (${esc(fmtDelta(summary.bestGain?.delta || 0))})</p>
      <p class="px-card__text">MVP дня: <b>${esc(summary.mvpDay?.nick || '—')}</b></p>
      <p class="px-card__text">Кращий winrate: <b>${esc(summary.bestWinRate?.nick || '—')}</b> (${summary.bestWinRate?.winRate ?? 0}%)</p>
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
