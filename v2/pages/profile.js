import { getCurrentLeagueLiveStats, getCurrentSeason, getPlayerAllTimeProfile, getPlayerSeasonLogs, getSeasonsList, safeErrorMessage } from '../core/dataHub.js';
import { normalizeLeague, leagueLabelUA } from '../core/naming.js';
import { decodeParam, getRouteState, normalizeNickname } from '../core/utils.js';

const placeholder = '../assets/default-avatar.svg';
const RANK_SCORE = { S: 7, A: 6, B: 5, C: 4, D: 3, E: 2, F: 1 };

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
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
  return {
    league: normalizeLeague(params.league || qp.get('league') || 'kids') || 'kids',
    nick: decodeParam(rawNick)
  };
}

function renderSkeleton(root) {
  root.innerHTML = '<section class="px-card profile-loading-shell"><h1 class="px-card__title">Профіль гравця</h1><p class="px-card__text">Завантаження профілю…</p><div class="profile-loading-bar" aria-hidden="true"></div></section>';
}

function rankClass(rank = 'F') {
  return `rank-${String(rank || 'F').toLowerCase()}`;
}

function chooseBestRank(ranks = []) {
  return ranks.reduce((best, current) => ((RANK_SCORE[current] || 0) > (RANK_SCORE[best] || 0) ? current : best), 'F');
}

function buildHighlights(profile, livePlayer, currentSeasonId) {
  const items = [];
  const bestPoints = profile?.highlights?.bestSeasonByPoints;
  const bestDelta = profile?.highlights?.bestSeasonByDelta;
  const mostActive = profile?.highlights?.mostActiveSeason;
  const bestMvpSeason = profile?.highlights?.bestMvpSeason;

  if (bestPoints?.seasonTitle && Number.isFinite(bestPoints.points)) {
    items.push({ label: 'Найкращий сезон за очками', value: `${bestPoints.seasonTitle} · ${bestPoints.points}` });
  }
  if (bestDelta?.seasonTitle && Number.isFinite(bestDelta.ratingDelta)) {
    items.push({ label: 'Найбільший приріст', value: `${bestDelta.seasonTitle} · ${signed(bestDelta.ratingDelta)}` });
  }
  if (mostActive?.seasonTitle && Number.isFinite(mostActive.games)) {
    items.push({ label: 'Найактивніший сезон', value: `${mostActive.seasonTitle} · ${mostActive.games} матчів` });
  }
  if (bestMvpSeason?.seasonTitle && Number.isFinite(bestMvpSeason.mvpTotal)) {
    items.push({ label: 'MVP-пік сезону', value: `${bestMvpSeason.seasonTitle} · ${bestMvpSeason.mvpTotal} MVP` });
  }
  if (profile?.allTime?.bestRank) {
    items.push({ label: 'Найвищий ранг', value: profile.allTime.bestRank });
  }
  if (livePlayer?.place) {
    items.push({ label: 'Поточна позиція в live', value: `#${livePlayer.place}` });
  }
  if (currentSeasonId) {
    items.push({ label: 'Актуальний сезон', value: currentSeasonId });
  }

  return items.slice(0, 6);
}

function renderStatGrid(items = []) {
  return `<div class="profile-stats-grid">${items
    .map((item) => `<article class="profile-stat-card"><div class="profile-stat-card__label">${esc(item.label)}</div><div class="profile-stat-card__value">${esc(item.value)}</div></article>`)
    .join('')}</div>`;
}

function renderAllTimeSection(profile) {
  const allTime = profile?.allTime || {};
  const seasons = profile?.seasons || [];
  const bestRank = chooseBestRank([allTime.bestRank, ...seasons.map((s) => s.rank)]);
  return `
    <section class="px-card profile-section">
      <h2 class="profile-section__title">All-time кар’єра</h2>
      ${renderStatGrid([
    { label: 'Сезонів зіграно', value: val(allTime.seasonsPlayed ?? seasons.length) },
    { label: 'Матчі', value: val(allTime.matches ?? allTime.games) },
    { label: 'Бої / Раунди', value: `${val(allTime.battles)} / ${val(allTime.rounds)}` },
    { label: 'W / L / D', value: `${val(allTime.wins)} / ${val(allTime.losses)} / ${val(allTime.draws)}` },
    { label: 'WR', value: pct(allTime.winrate) },
    { label: 'MVP1 / MVP2 / MVP3', value: `${val(allTime.top1)} / ${val(allTime.top2)} / ${val(allTime.top3)}` },
    { label: 'Total MVP', value: val(allTime.mvpTotal) },
    { label: 'Пікові очки', value: val(allTime.peakPoints) },
    { label: 'Кумулятивна Δ', value: signed(allTime.cumulativeDelta) },
    { label: 'Найкращий ранг', value: bestRank }
  ])}
    </section>
  `;
}

function renderCurrentSummary({ league, livePlayer, currentSeason }) {
  const currentRank = String(livePlayer?.rankLetter || livePlayer?.rankText || 'F').toUpperCase();
  return `
    <section class="px-card profile-section">
      <h2 class="profile-section__title">Поточний live стан</h2>
      ${renderStatGrid([
    { label: 'Ліга', value: leagueLabelUA(league) },
    { label: 'Сезон', value: currentSeason?.uiLabel || '—' },
    { label: 'Місце в live', value: livePlayer?.place ? `#${livePlayer.place}` : '—' },
    { label: 'Ранг', value: currentRank },
    { label: 'Очки', value: val(livePlayer?.points) },
    { label: 'Матчі / Бої', value: `${val(livePlayer?.matches)} / ${val(livePlayer?.battles)}` },
    { label: 'WR', value: pct(livePlayer?.winRate) },
    { label: 'MVP total', value: val(livePlayer?.mvpTotal) },
    { label: 'Δ сезону', value: signed(livePlayer?.delta) }
  ])}
    </section>
  `;
}

function renderSeasonTabs(container, tabs, selectedId) {
  container.innerHTML = tabs.map((tab) => `
    <button type="button" class="profile-season-tab ${tab.id === selectedId ? 'is-active' : ''}" data-season-id="${esc(tab.id)}">
      <span>${esc(tab.label)}</span>
      ${tab.current ? '<em>current</em>' : ''}
    </button>
  `).join('');
}

function renderSeasonSummary(season, livePlayer, allTime) {
  if (!season || season.id === 'all') {
    return `
      <section class="profile-season-summary">
        <h3>All-time огляд</h3>
        <p class="profile-muted">Зведення за всю кар’єру з архівних сезонів і поточних live-даних.</p>
        ${renderStatGrid([
      { label: 'Матчі', value: val(allTime.matches ?? allTime.games) },
      { label: 'Раунди', value: val(allTime.rounds) },
      { label: 'W/L/D', value: `${val(allTime.wins)} / ${val(allTime.losses)} / ${val(allTime.draws)}` },
      { label: 'WR', value: pct(allTime.winrate) },
      { label: 'Total MVP', value: val(allTime.mvpTotal) },
      { label: 'Пікові очки', value: val(allTime.peakPoints) }
    ])}
        ${livePlayer ? `<p class="profile-note">Live позиція: <strong>${livePlayer.place ? `#${livePlayer.place}` : '—'}</strong></p>` : ''}
      </section>
    `;
  }

  return `
    <section class="profile-season-summary">
      <h3>${esc(season.seasonTitle || season.id)}</h3>
      <p class="profile-muted">${esc(leagueLabelUA(season.league || 'kids'))}</p>
      ${renderStatGrid([
    { label: 'Очки / Rating_end', value: val(season.ratingEnd ?? season.points) },
    { label: 'Δ сезону', value: signed(season.ratingDelta) },
    { label: 'Фінальне місце', value: season.finalPlace ? `#${season.finalPlace}` : '—' },
    { label: 'Матчі', value: val(season.matches ?? season.games) },
    { label: 'Бої / Раунди', value: `${val(season.battles)} / ${val(season.rounds)}` },
    { label: 'W/L/D', value: `${val(season.wins)} / ${val(season.losses)} / ${val(season.draws)}` },
    { label: 'WR', value: pct(season.winrate) },
    { label: 'MVP1 / MVP2 / MVP3', value: `${val(season.top1)} / ${val(season.top2)} / ${val(season.top3)}` },
    { label: 'Total MVP', value: val(season.mvpTotal) },
    { label: 'Штрафи', value: val(season.penalties) },
    { label: 'Середній рейтинг', value: val(season.avgRating) },
    { label: 'Матчів/тиждень', value: val(season.matchesPerWeek) },
    { label: 'Активність сезону', value: Number.isFinite(Number(season.activityPct)) ? `${Number(season.activityPct).toFixed(1)}%` : '—' }
  ])}
    </section>
  `;
}

function renderLogs(logData) {
  if (!logData?.groups?.length) {
    return '<section class="profile-log-empty"><h3>Логи сезону</h3><p>Для цього сезону немає записів матчів або логів рейтингу.</p></section>';
  }

  return `<section class="profile-logs-wrap">
    <h3>Логи сезону</h3>
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
  </section>`;
}

export async function initProfilePage(params = {}) {
  const root = document.getElementById('profileRoot') || document.getElementById('view');
  if (!root) return;

  const { nick, league } = resolveParams(params);
  if (!nick) {
    root.innerHTML = `<section class="px-card"><h1 class="px-card__title">Профіль гравця</h1><p class="px-card__text">Не вказано нікнейм гравця.</p><div class="px-card__actions"><a class="btn btn--secondary" href="${buildHash('league-stats', { league })}">Назад до ліги</a></div></section>`;
    return;
  }

  renderSkeleton(root);

  try {
    const [profile, seasons, liveStats, currentSeason] = await Promise.all([
      getPlayerAllTimeProfile(nick),
      getSeasonsList(),
      getCurrentLeagueLiveStats(league),
      getCurrentSeason()
    ]);

    const normalizedNick = normalizeNickname(nick);
    const livePlayer = (liveStats?.players || []).find((player) => normalizeNickname(player.nickname) === normalizedNick) || null;

    if (!profile && !livePlayer) {
      root.innerHTML = `<section class="px-card"><h1 class="px-card__title">Профіль гравця</h1><p class="px-card__text">Гравця не знайдено.</p><div class="px-card__actions"><a class="btn btn--secondary" href="${buildHash('league-stats', { league })}">Назад до ліги</a></div></section>`;
      return;
    }

    const displayNick = livePlayer?.nickname || profile?.nick || nick;
    const seasonRows = profile?.seasons || [];
    const seasonRowsById = new Map(seasonRows.map((row) => [row.seasonId, row]));
    const currentRank = String(livePlayer?.rankLetter || seasonRows[0]?.rank || profile?.allTime?.bestRank || 'F').toUpperCase();
    const statusLabel = livePlayer?.isSeasonActive ? 'Активний у сезоні' : (livePlayer ? 'У live-ростері' : 'Архівний профіль');
    const highlights = buildHighlights(profile, livePlayer, currentSeason?.uiLabel);

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
              <span class="profile-status">${esc(statusLabel)}</span>
            </div>
            <p class="profile-hero__meta">${esc(leagueLabelUA(league))} · ${esc(currentSeason?.uiLabel || 'Поточний сезон')}</p>
            ${renderStatGrid([
      { label: 'Очки', value: val(livePlayer?.points ?? seasonRows[0]?.points) },
      { label: 'Ранг', value: currentRank },
      { label: 'Live місце', value: livePlayer?.place ? `#${livePlayer.place}` : '—' },
      { label: 'Матчі / WR / MVP', value: `${val(livePlayer?.matches ?? seasonRows[0]?.games)} / ${pct(livePlayer?.winRate ?? seasonRows[0]?.winrate)} / ${val(livePlayer?.mvpTotal ?? seasonRows[0]?.mvpTotal)}` }
    ])}
          </div>
          <div class="profile-hero__actions">
            <a class="btn btn--secondary" href="${buildHash('league-stats', { league })}">Назад до ліги</a>
          </div>
        </article>

        ${renderAllTimeSection(profile || { allTime: {}, seasons: [] })}
        ${renderCurrentSummary({ league, livePlayer: livePlayer || {}, currentSeason })}

        ${highlights.length ? `<section class="px-card profile-section"><h2 class="profile-section__title">Ключові досягнення</h2><div class="profile-highlights">${highlights.map((item) => `<article class="profile-highlight-card"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></article>`).join('')}</div></section>` : ''}

        <section class="px-card profile-section">
          <h2 class="profile-section__title">Історія сезонів</h2>
          <div class="profile-season-tabs" id="seasonTabs"></div>
          <div id="seasonSummaryHost"></div>
          <div id="seasonLogsHost"></div>
        </section>
      </section>
    `;

    const seasonTabsEl = root.querySelector('#seasonTabs');
    const summaryEl = root.querySelector('#seasonSummaryHost');
    const logsEl = root.querySelector('#seasonLogsHost');
    const tabs = [{ id: 'all', label: 'All-time', current: false }]
      .concat(seasons
        .filter((season) => seasonRowsById.has(season.id))
        .map((season) => ({ id: season.id, label: season.title, current: season.id === currentSeason?.id })));

    const state = { seasonId: 'all' };

    const renderState = async () => {
      renderSeasonTabs(seasonTabsEl, tabs, state.seasonId);
      const selectedSeason = state.seasonId === 'all' ? { id: 'all' } : seasonRowsById.get(state.seasonId);
      summaryEl.innerHTML = renderSeasonSummary(selectedSeason, livePlayer, profile?.allTime || {});

      if (state.seasonId === 'all') {
        logsEl.innerHTML = '<section class="profile-log-empty"><h3>Логи сезону</h3><p>Оберіть сезон у вкладках вище, щоб подивитися розгорнуту історію матчів.</p></section>';
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
