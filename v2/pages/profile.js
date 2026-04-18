import { buildPlayerCareer, getCurrentLeagueLiveStats, getCurrentSeason, getPlayerSeasonLogs, safeErrorMessage } from '../core/dataHub.js';
import { normalizeLeague, normalizeLeagueKey, leagueLabelUA } from '../core/naming.js';
import { decodeParam, getRouteState, normalizePlayerKey } from '../core/utils.js';

const placeholder = '../assets/default-avatar.svg';

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function val(v, fallback = '—') {
  return v === null || v === undefined || v === '' || Number.isNaN(v) ? fallback : String(v);
}
function pct(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : '—';
}
function signed(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n}`;
}
function winnerText(winner = '') {
  if (winner === 'tie') return 'Нічия';
  if (!winner) return '—';
  return winner;
}

function seasonTabLabel(label = '') {
  return String(label || '').toUpperCase();
}

function buildHash(route, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') query.set(key, String(value));
  });
  const qs = query.toString();
  return `#${route}${qs ? `?${qs}` : ''}`;
}

function resolveParams(params = {}) {
  const { query: qp } = getRouteState();
  const rawNick = params.nick ?? qp.get('nick') ?? '';
  const profileLeagueContext = normalizeLeagueKey(normalizeLeague(params.league || qp.get('league') || 'kids') || 'kids') || 'kids';
  return {
    league: profileLeagueContext,
    profileLeagueContext,
    nick: decodeParam(rawNick)
  };
}

function renderSkeleton(root) {
  root.innerHTML = '<section class="px-card profile-loading-shell"><h1 class="px-card__title">Профіль гравця</h1><p class="px-card__text">Завантаження профілю…</p><div class="profile-loading-bar" aria-hidden="true"></div></section>';
}

function rankClass(rank = 'F') {
  return `rank-${String(rank || 'F').toLowerCase()}`;
}

function metricCard({ label, value, accent = false, mono = false }) {
  return `<article class="profile-metric-card ${accent ? 'is-accent' : ''} ${mono ? 'is-mono' : ''}"><strong class="profile-metric-card__value">${esc(value)}</strong><span class="profile-metric-card__label">${esc(label)}</span></article>`;
}

function metricsGrid(items = [], classes = '') {
  return `<div class="profile-metrics-grid ${classes}">${items.map(metricCard).join('')}</div>`;
}

function renderCareerHighlights(highlights = {}) {
  const cards = [];
  const bestPoints = highlights.bestSeasonByPoints;
  const biggestDelta = highlights.bestSeasonByDelta;
  const bestWr = highlights.bestWinrateSeason;
  const mostActive = highlights.mostActiveSeason;
  const mvpRecord = highlights.bestMvpSeason;

  if (bestPoints?.seasonTitle && Number.isFinite(bestPoints.ratingEnd)) cards.push({ label: 'BEST SEASON', value: `${bestPoints.seasonTitle} • ${bestPoints.ratingEnd}` });
  if (biggestDelta?.seasonTitle && Number.isFinite(biggestDelta.ratingDelta)) cards.push({ label: 'BIGGEST GROWTH', value: `${biggestDelta.seasonTitle} • ${signed(biggestDelta.ratingDelta)}` });
  if (bestWr?.seasonTitle && Number.isFinite(bestWr.winrate)) cards.push({ label: 'BEST WR', value: `${bestWr.seasonTitle} • ${bestWr.winrate.toFixed(1)}%` });
  if (mostActive?.seasonTitle && Number.isFinite(mostActive.matches)) cards.push({ label: 'MOST ACTIVE', value: `${mostActive.seasonTitle} • ${mostActive.matches}` });
  if (mvpRecord?.seasonTitle && Number.isFinite(mvpRecord.mvpTotal)) cards.push({ label: 'MVP RECORD', value: `${mvpRecord.seasonTitle} • ${mvpRecord.mvpTotal}` });

  if (!cards.length) return '';
  return `<section class="px-card profile-section"><h2 class="profile-section__title">Відзнаки кар'єри</h2><div class="profile-highlight-grid">${cards.map((item) => `<article class="profile-highlight-card"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></article>`).join('')}</div></section>`;
}

function renderCurrentSummary({ league, livePlayer, currentSeason }) {
  const currentRank = String(livePlayer?.rankLetter || livePlayer?.rankText || 'F').toUpperCase();
  return `
    <section class="px-card profile-section">
      <h2 class="profile-section__title">Поточний стан</h2>
      ${metricsGrid([
    { label: 'POINTS', value: val(livePlayer?.points), accent: true, mono: true },
    { label: 'RANK', value: currentRank, accent: true },
    { label: 'PLACE', value: Number.isFinite(Number(livePlayer?.place)) ? `#${livePlayer.place}` : '—', mono: true },
    { label: 'WR', value: pct(livePlayer?.winRate), accent: true, mono: true },
    { label: 'MVP', value: val(livePlayer?.mvpTotal), accent: true, mono: true },
    { label: 'DELTA', value: signed(livePlayer?.delta), accent: true, mono: true },
    { label: 'MATCHES', value: val(livePlayer?.matches), mono: true },
    { label: 'BATTLES', value: val(livePlayer?.battles), mono: true },
    { label: 'LEAGUE', value: leagueLabelUA(league) },
    { label: 'SEASON', value: currentSeason?.uiLabel || '—' }
  ])}
    </section>
  `;
}

function renderCareerSummary(profile) {
  const allTime = profile?.allTime || {};
  return `
    <section class="px-card profile-section">
      <h2 class="profile-section__title">Загальна статистика</h2>
      ${metricsGrid([
    { label: 'SEASONS', value: val(allTime.seasonsPlayed), mono: true },
    { label: 'MATCHES', value: val(allTime.totalMatches ?? allTime.matches), accent: true, mono: true },
    { label: 'ROUNDS', value: val(allTime.totalRounds ?? allTime.rounds), mono: true },
    { label: 'TOTAL MVP', value: val(allTime.totalMvp ?? allTime.mvpTotal), accent: true, mono: true },
    { label: 'CAREER WR', value: pct(allTime.careerWR ?? allTime.winrate), accent: true, mono: true },
    { label: 'PEAK RATING', value: val(allTime.peakRating ?? allTime.peakPoints), accent: true, mono: true },
    { label: 'CUMULATIVE Δ', value: signed(allTime.cumulativeDelta), accent: true, mono: true },
    { label: 'BEST RANK', value: val(allTime.bestRank), accent: true },
    { label: 'WINS', value: val(allTime.totalWins ?? allTime.wins), mono: true },
    { label: 'LOSSES', value: val(allTime.totalLosses ?? allTime.losses), mono: true },
    { label: 'DRAWS', value: val(allTime.totalDraws ?? allTime.draws), mono: true }
  ])}
    </section>
  `;
}

function renderSeasonTabs(container, tabs, selectedId) {
  container.innerHTML = tabs.map((tab) => `
    <button type="button" class="profile-season-tab ${tab.id === selectedId ? 'is-active' : ''}" data-season-id="${esc(tab.id)}">
      <span>${esc(tab.label)}</span>
      ${tab.current ? '<em>CURRENT</em>' : ''}
    </button>
  `).join('');
}

function renderSeasonSummary(season, allTime) {
  if (!season || season.id === 'all') {
    return `
      <section class="profile-season-summary">
        <h3>Усі сезони</h3>
        <p class="profile-muted">Повний зріз карʼєри по всіх сезонах.</p>
        ${metricsGrid([
      { label: 'MATCHES', value: val(allTime.totalMatches ?? allTime.matches), mono: true },
      { label: 'ROUNDS', value: val(allTime.totalRounds ?? allTime.rounds), mono: true },
      { label: 'WR', value: pct(allTime.careerWR ?? allTime.winrate), accent: true, mono: true },
      { label: 'MVP', value: val(allTime.totalMvp ?? allTime.mvpTotal), accent: true, mono: true },
      { label: 'PEAK', value: val(allTime.peakRating ?? allTime.peakPoints), accent: true, mono: true },
      { label: 'BEST RANK', value: val(allTime.bestRank), accent: true }
    ])}
      </section>
    `;
  }

  return `
      <section class="profile-season-summary">
        <h3>${esc(season.seasonTitle || season.id)}</h3>
      <p class="profile-muted">${esc(leagueLabelUA(season.league || 'kids'))}</p>
      ${metricsGrid([
    { label: 'RATING START', value: val(season.ratingStart), mono: true },
    { label: 'RATING END', value: val(season.ratingEnd ?? season.points), accent: true, mono: true },
    { label: 'DELTA', value: signed(season.delta ?? season.ratingDelta), accent: true, mono: true },
    { label: 'MATCHES', value: val(season.matches ?? season.games), mono: true },
    { label: 'WR', value: pct(season.winRate ?? season.winrate), accent: true, mono: true },
    { label: 'MVP', value: val(season.mvpTotal), accent: true, mono: true },
    { label: 'PLACE', value: Number.isFinite(Number(season.place ?? season.finalPlace)) ? `#${season.place ?? season.finalPlace}` : '—', mono: true },
    { label: 'RANK', value: val(season.rank), accent: true, mono: true },
    { label: 'ROUNDS', value: val(season.rounds), mono: true },
    { label: 'W/L/D', value: `${val(season.wins)} / ${val(season.losses)} / ${val(season.draws)}`, mono: true }
  ])}
    </section>
  `;
}

function renderLogs(logData) {
  if (!logData?.groups?.length) {
    return '<section class="profile-log-empty"><h3>Логи сезону</h3><p>Для цього сезону немає записів матчів або логів рейтингу.</p></section>';
  }

  return `<details class="profile-logs-wrap">
    <summary>Match logs (${logData.groups.length} днів)</summary>
    ${logData.groups.map((group) => `
      <article class="profile-log-day">
        <header class="profile-log-day__head">
          <strong>${esc(group.date)}</strong>
          <span>Δ ${esc(signed(group.delta))} · Очки ${esc(val(group.closingPoints))}</span>
        </header>
        ${group.entries.length
    ? `<ul class="profile-log-list">${group.entries.map((entry) => `
              <li class="profile-log-item">
                <div class="profile-log-item__teams">${entry.teams.map((team, idx) => `<span>К${idx + 1}: ${esc(team.join(', ') || '—')}</span>`).join('')}</div>
                <div class="profile-log-item__meta">
                  <span>Winner: ${esc(winnerText(entry.winnerLabel))}</span>
                  <span>MVP: ${esc(entry.mvp1 || '—')} / ${esc(entry.mvp2 || '—')} / ${esc(entry.mvp3 || '—')}</span>
                  <span>Rounds: ${esc(val(entry.rounds))}</span>
                </div>
              </li>
            `).join('')}</ul>`
    : '<p class="profile-muted">Матчів за дату не знайдено, доступні лише зміни рейтингу.</p>'}
      </article>
    `).join('')}
  </details>`;
}

export async function initProfilePage(params = {}) {
  const root = document.getElementById('profileRoot') || document.getElementById('view');
  if (!root) return;

  const { nick, league, profileLeagueContext: routeLeagueContext } = resolveParams(params);
  if (!nick) {
    root.innerHTML = `<section class="px-card"><h1 class="px-card__title">Профіль гравця</h1><p class="px-card__text">Не вказано нікнейм гравця.</p><div class="px-card__actions"><a class="btn btn--secondary" href="${buildHash('league-stats', { league })}">Назад до ліги</a></div></section>`;
    return;
  }

  renderSkeleton(root);

  try {
    const [profile, liveStats, currentSeason] = await Promise.all([
      buildPlayerCareer(nick, { profileLeagueContext: routeLeagueContext }),
      getCurrentLeagueLiveStats(league),
      getCurrentSeason()
    ]);

    const normalizedNick = normalizePlayerKey(nick);
    const livePlayer = (liveStats?.players || []).find((player) => normalizePlayerKey(player.nickname) === normalizedNick) || null;

    if (!profile && !livePlayer) {
      root.innerHTML = `<section class="px-card"><h1 class="px-card__title">Профіль гравця</h1><p class="px-card__text">Гравця не знайдено.</p><div class="px-card__actions"><a class="btn btn--secondary" href="${buildHash('league-stats', { league })}">Назад до ліги</a></div></section>`;
      return;
    }

    const profileLeagueContext = normalizeLeague(
      routeLeagueContext
      || livePlayer?.league
      || profile?.profileLeagueContext
      || profile?.league
      || league
    ) || 'kids';
    const displayNick = livePlayer?.nickname || profile?.nick || nick;
    const seasonRows = profile?.seasons || [];
    const seasonRowsById = new Map(seasonRows.map((row) => [row.seasonId, row]));
    const currentRank = String(livePlayer?.rankLetter || seasonRows[0]?.rank || profile?.allTime?.bestRank || 'F').toUpperCase();
    const statusLine = [
      livePlayer?.place ? `#${livePlayer.place}` : '—',
      currentSeason?.uiLabel || 'Поточний сезон',
      leagueLabelUA(profileLeagueContext)
    ].join(' • ');

    root.innerHTML = `
      <section class="profile-page-v2">
        <article class="px-card profile-hero ${rankClass(currentRank)}">
          <div class="profile-hero__left">
            <div class="profile-avatar-frame ${rankClass(currentRank)}">
              <img src="${esc(profile?.avatar || livePlayer?.avatarUrl || placeholder)}" alt="${esc(displayNick)}" onerror="this.src='${placeholder}'">
            </div>
            <span class="profile-rank-badge ${rankClass(currentRank)}">${esc(currentRank)}</span>
          </div>
          <div class="profile-hero__main">
            <div class="profile-hero__head">
              <h1>${esc(displayNick)}</h1>
            </div>
            <p class="profile-hero__meta">${esc(statusLine)}</p>
            ${metricsGrid([
      { label: 'POINTS', value: val(livePlayer?.points ?? seasonRows[0]?.ratingEnd ?? seasonRows[0]?.points), accent: true, mono: true },
      { label: 'RANK', value: currentRank, accent: true },
      { label: 'WR', value: pct(livePlayer?.winRate ?? seasonRows[0]?.winRate ?? seasonRows[0]?.winrate), accent: true, mono: true },
      { label: 'MVP', value: val(livePlayer?.mvpTotal ?? seasonRows[0]?.mvpTotal), accent: true, mono: true },
      { label: 'DELTA', value: signed(livePlayer?.delta ?? seasonRows[0]?.delta ?? seasonRows[0]?.ratingDelta), accent: true, mono: true }
    ], 'is-hero')}
          </div>
          <div class="profile-hero__actions">
            <a class="btn btn--secondary" href="${buildHash('league-stats', { league: normalizeLeagueKey(profileLeagueContext) })}">Назад до ліги</a>
          </div>
        </article>

        ${renderCurrentSummary({ league: profileLeagueContext, livePlayer: livePlayer || {}, currentSeason })}
        ${renderCareerSummary(profile || { allTime: {} })}
        ${renderCareerHighlights(profile?.highlights || {})}

        <section class="px-card profile-section">
          <h2 class="profile-section__title">Вибір сезону</h2>
          <div class="profile-season-tabs" id="seasonTabs"></div>
          <div id="seasonSummaryHost"></div>
          <div id="seasonLogsHost"></div>
        </section>
      </section>
    `;

    const seasonTabsEl = root.querySelector('#seasonTabs');
    const summaryEl = root.querySelector('#seasonSummaryHost');
    const logsEl = root.querySelector('#seasonLogsHost');
    const tabs = [{ id: 'all', label: 'ALL', current: false }]
      .concat(
        seasonRows
          .map((season) => ({ id: season.seasonId, label: seasonTabLabel(season.seasonTitle || season.seasonId), current: season.seasonId === currentSeason?.id }))
      );

    const state = { seasonId: 'all' };

    const renderState = async () => {
      renderSeasonTabs(seasonTabsEl, tabs, state.seasonId);
      const selectedSeason = state.seasonId === 'all' ? { id: 'all' } : seasonRowsById.get(state.seasonId);
      summaryEl.innerHTML = renderSeasonSummary(selectedSeason, profile?.allTime || {});

      if (state.seasonId === 'all') {
        logsEl.innerHTML = '<section class="profile-log-empty"><h3>Логи сезону</h3><p>Оберіть сезон у селекторі, щоб подивитися детальні матчі.</p></section>';
        return;
      }

      logsEl.innerHTML = '<p class="profile-muted">Завантаження логів сезону…</p>';
      const logData = await getPlayerSeasonLogs({ nick: displayNick, seasonId: state.seasonId });
      logsEl.innerHTML = renderLogs(logData);
    };

    seasonTabsEl.addEventListener('click', (event) => {
      const tab = event.target.closest('button[data-season-id]');
      if (!tab) return;
      state.seasonId = tab.dataset.seasonId;
      renderState();
    });

    await renderState();
  } catch (error) {
    root.innerHTML = `<section class="px-card"><h1 class="px-card__title">Профіль гравця</h1><p class="px-card__text">${esc(safeErrorMessage(error, 'Дані тимчасово недоступні'))}</p></section>`;
  }
}
