import { getCurrentLeagueLiveStats, getCurrentSeason } from '../core/dataHub.js';
import { normalizeLeague, leagueLabelUA } from '../core/naming.js';
import { getRouteState } from '../core/utils.js';

const RANKS = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];
const FALLBACK_AVATAR = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22%3E%3Crect width=%2248%22 height=%2248%22 fill=%22%23121a2a%22/%3E%3Ccircle cx=%2224%22 cy=%2218%22 r=%229%22 fill=%22%235b6c89%22/%3E%3Crect x=%2211%22 y=%2230%22 width=%2226%22 height=%2212%22 fill=%22%235b6c89%22/%3E%3C/svg%3E';

function esc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function rankClass(rank) { return `rank-${String(rank || 'F').trim().toLowerCase()}`; }
function winRateText(value) { return value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}%`; }
function fmtSigned(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n}`;
}
function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0%';
  return `${Math.max(0, Math.min(100, n)).toFixed(0)}%`;
}

function isSeasonActive(player = {}) {
  const hasActiveFlag = Object.prototype.hasOwnProperty.call(player || {}, 'active');
  const activeFlag = hasActiveFlag ? Boolean(player.active) : true;
  return activeFlag && Number(player.matches || 0) > 0;
}

const SORTERS = {
  points: (a, b) => (Number(b.points) || 0) - (Number(a.points) || 0),
  matches: (a, b) => (Number(b.matches) || 0) - (Number(a.matches) || 0),
  battles: (a, b) => (Number(b.battles) || 0) - (Number(a.battles) || 0),
  winRate: (a, b) => (Number(b.winRate) || 0) - (Number(a.winRate) || 0),
  mvp1: (a, b) => (Number(b.mvp1) || 0) - (Number(a.mvp1) || 0),
  mvp2: (a, b) => (Number(b.mvp2) || 0) - (Number(a.mvp2) || 0),
  mvp3: (a, b) => (Number(b.mvp3) || 0) - (Number(a.mvp3) || 0),
  mvpTotal: (a, b) => (Number(b.mvpTotal) || 0) - (Number(a.mvpTotal) || 0),
  delta: (a, b) => (Number(b.delta) || 0) - (Number(a.delta) || 0)
};

function playerCountText(count) {
  const n = Number(count) || 0;
  if (n % 10 === 1 && n % 100 !== 11) return 'гравець';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'гравці';
  return 'гравців';
}

function playerProfileHash(league, nickname) {
  return `#player?league=${encodeURIComponent(league)}&nick=${encodeURIComponent(nickname)}`;
}

function rankDistributionTiles(distribution = {}) {
  return RANKS
    .map((rank) => {
      const count = distribution[rank] || 0;
      const rankKey = rank.toLowerCase();
      return `<article class="league-rank-tile rank-card rank-${rankKey} card league-rank-tile--${rankKey}"><div class="league-rank-tile__rank">${rank}</div><div class="league-rank-tile__count">${count}</div><div class="league-rank-tile__label">${playerCountText(count)}</div></article>`;
    })
    .join('');
}

function tableRowMarkup(player, league) {
  const rank = String(player.rankLetter || 'F').toUpperCase();
  const rankKey = rank.toLowerCase();
  const href = playerProfileHash(league, player.nickname);
  const deltaValue = Number(player.delta || 0);
  const deltaClass = deltaValue >= 0 ? 'is-positive' : 'is-negative';
  return `<tr class="league-ranking-table__row league-ranking-table__row--rank-${rankKey}" data-href="${href}" tabindex="0" role="link" aria-label="Профіль ${esc(player.nickname)}">
    <td class="league-ranking-table__cell league-ranking-table__cell--place">${player.place ? `#${player.place}` : '—'}</td>
    <td class="league-ranking-table__cell league-ranking-table__cell--player">
      <span class="league-player-cell">
        <span class="league-rank-badge ${rankClass(rank)}">${esc(rank)}</span>
        <span class="league-avatar-wrap league-rank-frame ${rankClass(rank)}"><img class="league-avatar" src="${esc(player.avatarUrl || FALLBACK_AVATAR)}" alt="${esc(player.nickname)}"></span>
        <span class="league-player-cell__name">${esc(player.nickname)}</span>
      </span>
    </td>
    <td class="league-ranking-table__cell league-ranking-table__cell--points">${esc(player.points ?? 0)}</td>
    <td class="league-ranking-table__cell league-ranking-table__cell--num">${esc(player.matches ?? 0)}</td>
    <td class="league-ranking-table__cell league-ranking-table__cell--num">${esc(player.battles ?? 0)}</td>
    <td class="league-ranking-table__cell league-ranking-table__cell--num">${esc(winRateText(player.winRate))}</td>
    <td class="league-ranking-table__cell league-ranking-table__cell--num">${esc(player.mvp1 ?? 0)}</td>
    <td class="league-ranking-table__cell league-ranking-table__cell--num">${esc(player.mvp2 ?? 0)}</td>
    <td class="league-ranking-table__cell league-ranking-table__cell--num">${esc(player.mvp3 ?? 0)}</td>
    <td class="league-ranking-table__cell league-ranking-table__cell--num league-ranking-table__cell--delta ${deltaClass}">${esc(fmtSigned(deltaValue))}</td>
  </tr>`;
}

function statCard({ label, value, level = 'secondary', icon = '', divider = false, progress = null }) {
  const progressMarkup = progress
    ? `<div class="winrate-bar" aria-hidden="true"><div class="winrate-fill" style="width:${esc(progress.width)}"></div></div>`
    : '';
  return `<article class="kpi-card kpi-card--${esc(level)} card">
    <div class="kpi-label">${icon ? `<span class="kpi-icon" aria-hidden="true">${icon}</span>` : ''}${esc(label)}</div>
    <div class="kpi-value kpi-${esc(level)}">${esc(value)}</div>
    ${divider ? '<div class="kpi-divider" aria-hidden="true"></div>' : ''}
    ${progressMarkup}
  </article>`;
}

function infographicCard({ label, value, meta = '', icon = '', width = '0%', tone = 'neutral' }) {
  return `<article class="live-card card live-card--${esc(tone)}">
    <div class="live-card__head">
      <span class="live-card__icon" aria-hidden="true">${esc(icon)}</span>
      <span class="live-card__label">${esc(label)}</span>
    </div>
    <div class="live-card__value">${esc(value)}</div>
    <div class="live-card__meta">${esc(meta)}</div>
    <div class="live-card__meter" aria-hidden="true"><span style="width:${esc(width)}"></span></div>
  </article>`;
}

function insightCard({ eyebrow = '', title = '', value = '', meta = '', footer = '', tone = 'neutral' }) {
  return `<article class="live-card card live-card--${esc(tone)}">
    <div class="live-card__kicker">${esc(eyebrow)}</div>
    <div class="live-card__label live-card__label--story">${esc(title)}</div>
    <div class="live-card__value">${esc(value)}</div>
    <div class="live-card__meta">${esc(meta)}</div>
    ${footer ? `<div class="live-card__footer">${esc(footer)}</div>` : ''}
  </article>`;
}

function insightCardRich({ eyebrow = '', title = '', value = '', meta = '', footerHtml = '', tone = 'neutral' }) {
  return `<article class="live-card card live-card--${esc(tone)}">
    <div class="live-card__kicker">${esc(eyebrow)}</div>
    <div class="live-card__label live-card__label--story">${esc(title)}</div>
    <div class="live-card__value">${esc(value)}</div>
    <div class="live-card__meta">${esc(meta)}</div>
    ${footerHtml ? `<div class="live-card__footer">${footerHtml}</div>` : ''}
  </article>`;
}

function seasonStatCard({ label, value, meta = '', width = '0%' }) {
  return `<article class="kpi-card card">
    <div class="kpi-label">${esc(label)}</div>
    <div class="kpi-value">${esc(value)}</div>
    <div class="kpi-meta">${esc(meta)}</div>
    <div class="winrate-bar" aria-hidden="true"><div class="winrate-fill" style="width:${esc(width)}"></div></div>
  </article>`;
}

function rankDistributionBlock(distribution = {}, activePlayersCount = 0) {
  const total = Math.max(Number(activePlayersCount) || 0, 1);
  const segments = RANKS.map((rank) => {
    const count = Number(distribution[rank] || 0);
    const share = total ? Math.round((count / total) * 100) : 0;
    return `<span class="league-rank-segment league-rank-segment--${rank.toLowerCase()}" style="width:${share}%">${esc(rank)}</span>`;
  }).join('');

  const chips = RANKS.map((rank) => {
    const count = Number(distribution[rank] || 0);
    return `<span class="league-rank-chip league-rank-chip--${rank.toLowerCase()}"><span class="league-rank-chip__rank">${esc(rank)}</span><span class="league-rank-chip__count">${count}</span></span>`;
  }).join('');

  return `<div class="league-rank-summary">
    <div class="league-rank-summary__bar" aria-hidden="true">${segments}</div>
    <div class="league-rank-summary__caption">Частка активних гравців у кожному ранзі</div>
    <div class="league-rank-chip-list">${chips}</div>
  </div>`;
}

function calculateRemainingGameDays(data, currentSeason) {
  const seasonStartRaw = String(currentSeason?.dateStart || '').slice(0, 10);
  const seasonEndRaw = String(currentSeason?.dateEnd || '').slice(0, 10);
  if (!seasonStartRaw || !seasonEndRaw) return '—';

  const seasonStart = new Date(`${seasonStartRaw}T00:00:00Z`);
  const seasonEnd = new Date(`${seasonEndRaw}T00:00:00Z`);
  if (Number.isNaN(seasonStart.getTime()) || Number.isNaN(seasonEnd.getTime())) return '—';
  if (seasonEnd < seasonStart) return '0';

  const todayRaw = new Date().toISOString().slice(0, 10);
  const today = new Date(`${todayRaw}T00:00:00Z`);
  if (Number.isNaN(today.getTime())) return '—';

  const seasonAnchor = today < seasonStart ? seasonStart : today;
  if (seasonAnchor > seasonEnd) return '0';

  // Базова оцінка розкладу: 3 ігрові дні щотижня (вт/чт/сб).
  const scheduleDays = new Set([2, 4, 6]);
  let remaining = 0;
  const cursor = new Date(seasonAnchor);
  while (cursor <= seasonEnd) {
    if (scheduleDays.has(cursor.getUTCDay())) {
      remaining += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return `${remaining}`;
}


function getSmallestPositiveGrowth(players = []) {
  const candidates = (Array.isArray(players) ? players : [])
    .filter((player) => Number.isFinite(Number(player?.delta)) && Number(player.delta) > 0)
    .sort((a, b) => Number(a.delta) - Number(b.delta));
  return candidates[0] || null;
}

function renderHero(root, league, data) {
  root.innerHTML = `<div class="league-hero__eyebrow">\u0416\u0438\u0432\u0438\u0439 \u0441\u0435\u0437\u043e\u043d</div>
  <h1 class="px-card__title league-section-title">${esc(leagueLabelUA(league))}</h1>
  <p class="px-card__text league-season-title">\u041f\u043e\u0442\u043e\u0447\u043d\u0438\u0439 \u0441\u0435\u0437\u043e\u043d: <strong>${esc(data.seasonLabel)}</strong></p>`;
}

function renderGameDaySection(lastGameDay, league) {
  const day = lastGameDay || { date: '', matchesCount: 0, battlesCount: 0, mvp: null };
  const gameDayHref = `#gameday?league=${encodeURIComponent(league)}${day.date ? `&date=${encodeURIComponent(day.date)}` : ''}`;
  return `<section class="league-dashboard-group league-dashboard-group--gameday">
    <h3 class="league-subtitle">\u041e\u0441\u0442\u0430\u043d\u043d\u0456\u0439 \u0456\u0433\u0440\u043e\u0432\u0438\u0439 \u0434\u0435\u043d\u044c</h3>
    <article class="league-game-day-card card league-game-day-card--summary">
      <div class="league-game-day-card__stack">
        <div class="league-game-day-card__label">\u041e\u0441\u0442\u0430\u043d\u043d\u0454 \u043e\u043d\u043e\u0432\u043b\u0435\u043d\u043d\u044f</div>
        <div class="league-game-day-card__value">${esc(day.date || '\u2014')}</div>
        <div class="league-game-day-card__headline">${day.matchesCount || day.battlesCount ? `\u0417\u0456\u0433\u0440\u0430\u043d\u043e ${esc(day.matchesCount || 0)} \u0456\u0433\u043e\u0440` : '\u0414\u0430\u043d\u0456 \u0434\u043d\u044f \u0449\u0435 \u043d\u0435 \u0437\u0456\u0431\u0440\u0430\u043d\u0456'}</div>
        <div class="league-game-day-stats">
          <div class="league-game-day-stat">
            <span class="league-game-day-stat__label">\u0406\u0433\u0440\u0438</span>
            <span class="league-game-day-stat__value">${esc(day.matchesCount || 0)}</span>
          </div>
          <div class="league-game-day-stat">
            <span class="league-game-day-stat__label">\u0411\u043e\u0457</span>
            <span class="league-game-day-stat__value">${esc(day.battlesCount || 0)}</span>
          </div>
        </div>
        <div class="league-game-day-card__mvp">
          <span class="league-game-day-card__mvp-label">MVP дня</span>
          <strong class="league-game-day-card__mvp-value">${esc(day.mvp || '\u2014')}</strong>
        </div>
      </div>
    </article>
    <a class="button-primary league-game-day-cta-button" href="${gameDayHref}">\u0412\u0456\u0434\u043a\u0440\u0438\u0442\u0438 \u0434\u0435\u043d\u044c</a>
  </section>`;
}

function renderInfographic(root, data, remainingGameDays, league) {
  const activePlayers = Array.isArray(data.activePlayers) ? [...data.activePlayers] : [];
  const playersCount = Number(data.summary.activePlayersCount || activePlayers.length || 0);
  const matchesCount = Number(data.summary.matchesCount || 0);
  const battlesCount = Number(data.summary.battlesCount || 0);
  const avgRating = Number(data.summary.avgRating || 0);
  const totalLeaguePoints = activePlayers.reduce((sum, player) => sum + (Number(player.points) || 0), 0);
  const leaderBoardByPoints = [...activePlayers].sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0));
  const leader = leaderBoardByPoints[0] || null;
  const runnerUp = leaderBoardByPoints[1] || null;
  const leaderGap = leader && runnerUp ? Number(leader.points || 0) - Number(runnerUp.points || 0) : null;
  const battlesPerMatch = matchesCount ? (battlesCount / matchesCount).toFixed(1) : '0.0';
  const bestGrowth = data.progress?.bestGrowth || null;
  const mvpLeader = data.progress?.mostMvp || null;
  const topRank = leader ? String(leader.rankLetter || 'F').toUpperCase() : '—';
  const matchLeaders = [...activePlayers].sort((a, b) => (Number(b.matches) || 0) - (Number(a.matches) || 0));
  const mostActive = matchLeaders[0] || null;
  const secondMostActive = matchLeaders[1] || null;
  const activityLead = mostActive && secondMostActive ? Math.max(0, Number(mostActive.matches || 0) - Number(secondMostActive.matches || 0)) : null;
  const bestWinrateTop10 = [...leaderBoardByPoints]
    .slice(0, 10)
    .filter((player) => Number(player.matches || 0) > 0)
    .sort((a, b) => (Number(b.winRate) || 0) - (Number(a.winRate) || 0))[0] || null;
  const bestWinrateTop10Value = bestWinrateTop10 ? `${Number(bestWinrateTop10.winRate || 0).toFixed(1)}%` : '—';
  const bestWinrateTop10Width = bestWinrateTop10 ? `${Math.max(0, Math.min(100, Number(bestWinrateTop10.winRate || 0))).toFixed(1)}%` : '0%';
  const averageDeltaPerMatchValue = matchesCount
    ? (activePlayers.reduce((sum, player) => sum + (Number(player.delta) || 0), 0) / matchesCount)
    : null;
  const averageDeltaPerMatch = averageDeltaPerMatchValue === null ? '—' : fmtSigned(averageDeltaPerMatchValue.toFixed(1));
  const averageDeltaPerMatchWidth = averageDeltaPerMatchValue === null ? '0%' : clampPercent(Math.min(Math.abs(Number(averageDeltaPerMatchValue || 0)) * 6, 100));
  const mvpBreakdown = mvpLeader
    ? `MVP1 ${mvpLeader.mvp1 || 0} · MVP2 ${mvpLeader.mvp2 || 0} · MVP3 ${mvpLeader.mvp3 || 0}`
    : 'Нагороди ще не зібрали чітку трійку';
  const leaderWins = Number(leader?.wins || 0);
  const activityFooter = mostActive
    ? (activityLead !== null && activityLead > 0
      ? `Відрив від #2: ${activityLead} ігор`
      : 'Ділить лідерство за кількістю ігор')
    : '';
  const growthFooterHtml = bestGrowth
    ? `Ранг зараз: <span class="live-rank-inline ${rankClass(bestGrowth.rankLetter || 'F')}">${esc(bestGrowth.rankLetter || '—')}</span>`
    : '';

  root.innerHTML = `<section class="league-dashboard-group league-dashboard-group--live">
    <h3 class="league-subtitle">\u0412\u0456\u0434\u0437\u043d\u0430\u043a\u0438 \u0441\u0435\u0437\u043e\u043d\u0443</h3>
    <div class="live-grid">
      ${insightCard({
        eyebrow: '\u0427\u0435\u043c\u043f\u0456\u043e\u043d',
        title: leader ? leader.nickname : 'Немає даних',
        value: leader ? `${leader.points || 0} pts` : '—',
        meta: leader ? `${leader.matches || 0} ігор · ${leaderWins} перемог` : '\u0420\u0435\u0439\u0442\u0438\u043d\u0433 \u0449\u0435 \u043d\u0435 \u0437\u0430\u043f\u043e\u0432\u043d\u0435\u043d\u0438\u0439',
        footer: leaderGap === null ? '\u041f\u043e\u043a\u0438 \u0431\u0435\u0437 \u0449\u0456\u043b\u044c\u043d\u043e\u0433\u043e \u0442\u0438\u0441\u043a\u0443 \u0437\u043d\u0438\u0437\u0443' : `\u0412\u0456\u0434\u0440\u0438\u0432 \u0432\u0456\u0434 #2: ${fmtSigned(leaderGap)} pts`,
        tone: 'accent'
      })}
      ${insightCardRich({
        eyebrow: '\u0420\u0438\u0432\u043e\u043a',
        title: bestGrowth?.nickname || '\u0429\u0435 \u0431\u0435\u0437 \u044f\u0441\u043a\u0440\u0430\u0432\u043e\u0433\u043e \u0440\u0438\u0432\u043a\u0430',
        value: bestGrowth ? `${fmtSigned(bestGrowth.delta)} за ${bestGrowth.matches || 0} ігор` : '—',
        meta: bestGrowth ? `${bestGrowth.points || 0} pts на даний момент` : '\u041d\u0435\u043c\u0430\u0454 \u0433\u0440\u0430\u0432\u0446\u044f \u0437 \u043f\u043e\u043c\u0456\u0442\u043d\u0438\u043c \u043f\u0456\u0434\u0439\u043e\u043c\u043e\u043c',
        footerHtml: growthFooterHtml,
        tone: 'cool'
      })}
      ${insightCard({
        eyebrow: 'MVP',
        title: mvpLeader ? mvpLeader.nickname : '\u041f\u043e\u043a\u0438 \u0431\u0435\u0437 \u043b\u0456\u0434\u0435\u0440\u0430',
        value: mvpLeader ? `${mvpLeader.mvpTotal || 0} MVP` : '—',
        meta: mvpBreakdown,
        footer: mvpLeader ? `${mvpLeader.matches || 0} ігор у сезоні` : '\u0421\u0435\u0437\u043e\u043d \u0442\u0456\u043b\u044c\u043a\u0438 \u0440\u043e\u0437\u043a\u0440\u0443\u0447\u0443\u0454\u0442\u044c\u0441\u044f',
        tone: 'neutral'
      })}
      ${insightCard({
        eyebrow: '\u0410\u043a\u0442\u0438\u0432\u043d\u0456\u0441\u0442\u044c',
        title: mostActive ? mostActive.nickname : '\u041d\u0435\u043c\u0430\u0454 \u0434\u0430\u043d\u0438\u0445',
        value: mostActive ? `${mostActive.matches || 0} ігор` : '\u2014',
        meta: mostActive ? `${mostActive.battles || 0} боїв у сезоні` : '\u0410\u043a\u0442\u0438\u0432\u043d\u0430 \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u0449\u0435 \u043d\u0435 \u0437\u0456\u0431\u0440\u0430\u043d\u0430',
        footer: activityFooter,
        tone: 'warm'
      })}
    </div>
  </section>
  <section class="league-dashboard-group league-dashboard-group--kpi">
    <h3 class="league-subtitle">Зріз сезону</h3>
    <div class="league-kpi-grid league-kpi-grid--secondary">
    ${seasonStatCard({ label: 'Середній рейтинг ліги', value: avgRating, meta: `Сумарно ${totalLeaguePoints} pts зараз`, width: clampPercent(avgRating / 14) })}
    ${seasonStatCard({ label: 'Кращий WR у топ-10', value: bestWinrateTop10Value, meta: bestWinrateTop10 ? `${bestWinrateTop10.nickname} · ${bestWinrateTop10.matches || 0} ігор` : 'Топ-10 ще формується', width: bestWinrateTop10Width })}
    </div>
    <div class="league-kpi-grid league-kpi-grid--tertiary">
    ${seasonStatCard({ label: 'Ігри / середні бої', value: `${matchesCount} / ${battlesPerMatch}`, meta: `${playersCount} активних гравців`, width: clampPercent(matchesCount * 3) })}
    ${seasonStatCard({ label: 'Середній приріст за гру', value: averageDeltaPerMatch, meta: leader ? `Лідер ліги зараз у ранзі ${topRank}` : 'Дані ще збираються', width: averageDeltaPerMatchWidth })}
    </div>
  </section>
  <section class="league-dashboard-group league-dashboard-group--ranks">
    <h3 class="league-subtitle">Розподіл за рангами</h3>
    <div class="league-rank-list">${rankDistributionBlock(data.summary.rankDistribution || {}, playersCount)}</div>
  </section>
  ${renderGameDaySection(data.lastGameDay, league)}`;
}

function resolveLeague(params = {}) {
  const { query: qp } = getRouteState();
  return normalizeLeague(params.league || qp.get('league') || 'kids') || 'kids';
}

function renderLoading(root, league) {
  const hero = root.querySelector('#leagueHero');
  const tableTitle = root.querySelector('#leagueTableTitle');
  const rankingTable = root.querySelector('#leagueTableBody');
  const expandBtn = root.querySelector('#leagueExpandBtn');
  const searchInput = root.querySelector('#leagueSearchInput');
  const sortHeaders = root.querySelectorAll('.league-sort-header[data-sort]');
  const infographic = root.querySelector('#leagueInfographic');

  if (hero) {
    hero.classList.remove('league-loading-block');
    hero.innerHTML = `<h1 class="px-card__title league-section-title">${esc(leagueLabelUA(league))}</h1>
    <p class="px-card__text league-season-title">\u0416\u0438\u0432\u0456 \u0434\u0430\u043d\u0456: <strong>\u0417\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0435\u043d\u043d\u044f\u2026</strong></p>`;
  }
  if (tableTitle) tableTitle.textContent = '\u0422\u041e\u041f-10 \u0433\u0440\u0430\u0432\u0446\u0456\u0432';
  if (searchInput) {
    searchInput.value = '';
    searchInput.disabled = true;
    searchInput.placeholder = '\u0417\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0443\u0454\u043c\u043e \u0433\u0440\u0430\u0432\u0446\u0456\u0432\u2026';
  }
  if (sortHeaders.length) {
    sortHeaders.forEach((btn) => {
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
    });
  }
  if (rankingTable) {
    rankingTable.innerHTML = Array.from({ length: 8 }, () => `<tr class="league-loading-row" aria-hidden="true">
      <td class="league-ranking-table__cell league-ranking-table__cell--place"><span class="league-loading-cell league-loading-cell--short"></span></td>
      <td class="league-ranking-table__cell league-ranking-table__cell--player"><span class="league-loading-cell"></span></td>
      <td class="league-ranking-table__cell league-ranking-table__cell--points"><span class="league-loading-cell league-loading-cell--short"></span></td>
      <td class="league-ranking-table__cell league-ranking-table__cell--num"><span class="league-loading-cell league-loading-cell--short"></span></td>
      <td class="league-ranking-table__cell league-ranking-table__cell--num"><span class="league-loading-cell league-loading-cell--short"></span></td>
      <td class="league-ranking-table__cell league-ranking-table__cell--num"><span class="league-loading-cell league-loading-cell--short"></span></td>
      <td class="league-ranking-table__cell league-ranking-table__cell--num"><span class="league-loading-cell league-loading-cell--short"></span></td>
      <td class="league-ranking-table__cell league-ranking-table__cell--num"><span class="league-loading-cell league-loading-cell--short"></span></td>
      <td class="league-ranking-table__cell league-ranking-table__cell--num"><span class="league-loading-cell league-loading-cell--short"></span></td>
      <td class="league-ranking-table__cell league-ranking-table__cell--num"><span class="league-loading-cell league-loading-cell--short"></span></td>
    </tr>`).join('');
    rankingTable.insertAdjacentHTML('beforeend', `<tr class="league-loading-note-row"><td class="league-ranking-table__empty" colspan="10">\u0417\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0443\u0454\u043c\u043e \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0443\u2026</td></tr>`);
  }
  if (expandBtn) {
    expandBtn.disabled = true;
    expandBtn.setAttribute('aria-disabled', 'true');
    expandBtn.textContent = '\u0417\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0435\u043d\u043d\u044f\u2026';
  }
  if (infographic) infographic.innerHTML = '';
}

function sortPlayers(players, sortBy, direction = 'desc') {
  const byName = (a, b) => String(a.nickname || '').localeCompare(String(b.nickname || ''), 'uk');
  if (sortBy === 'default') {
    return [...players].sort((a, b) => (a.place || Number.MAX_SAFE_INTEGER) - (b.place || Number.MAX_SAFE_INTEGER)
      || SORTERS.points(a, b)
      || byName(a, b));
  }

  const sorter = SORTERS[sortBy] || SORTERS.points;
  const sign = direction === 'asc' ? -1 : 1;
  return [...players].sort((a, b) => (sorter(a, b) * sign)
    || SORTERS.points(a, b)
    || byName(a, b));
}

function filterPlayers(players, searchTerm) {
  const term = String(searchTerm || '').trim().toLowerCase();
  if (!term) return [...players];
  return players.filter((player) => String(player.nickname || '').toLowerCase().includes(term));
}

function ensureMvpSortHeaders(tableHead) {
  if (!tableHead) return;
  const mvpSortMap = [
    ['MVP1', 'mvp1', 'Сортувати за MVP1'],
    ['MVP2', 'mvp2', 'Сортувати за MVP2'],
    ['MVP3', 'mvp3', 'Сортувати за MVP3']
  ];
  mvpSortMap.forEach(([label, sortKey, ariaLabel]) => {
    const header = Array.from(tableHead.querySelectorAll('th')).find((th) => th.textContent.trim() === label);
    if (!header || header.querySelector('.league-sort-header[data-sort]')) return;
    header.innerHTML = `<button class="league-sort-header" type="button" data-sort="${sortKey}" aria-label="${ariaLabel}" aria-sort="none">${label}</button>`;
  });
}

export async function initLeagueStatsPage(params = {}) {
  const root = document.getElementById('view');
  if (!root) return;
  await initPage(root, params);
}

export async function initPage(root, params = {}) {
  if (!root) return;
  console.log('[league-stats] init start');
  try {
    await safeInitLeagueStatsPage(root, params);
  } catch (err) {
    console.error('[league-stats] fatal crash:', err);
    root.innerHTML = `
      <div style="padding:20px;color:#fff">
        ❌ Помилка завантаження сторінки
      </div>
    `;
  }
}

async function safeInitLeagueStatsPage(root, params = {}) {
  const league = resolveLeague(params);
  renderLoading(root, league);
  const data = await getCurrentLeagueLiveStats(league);
  console.log('[league-stats] data loaded', data);
  if (!data) {
    console.warn('[league-stats] no data, rendering empty state');
    root.innerHTML = `<section class="px-card league-hero"><h1 class="px-card__title league-section-title">\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u043b\u0456\u0433\u0438</h1><p class="px-card__text">\u041d\u0435\u043c\u0430\u0454 \u0434\u0430\u043d\u0438\u0445 \u0434\u043b\u044f \u0432\u0456\u0434\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f.</p></section>`;
    return;
  }
  const currentSeason = await getCurrentSeason().catch((error) => {
    console.warn('[league-stats] optional season context unavailable', error);
    return null;
  });
  const remainingGameDays = calculateRemainingGameDays(data, currentSeason);
  const safeData = {
    ...data,
    players: Array.isArray(data?.players) ? data.players : [],
    activePlayers: Array.isArray(data?.activePlayers) ? data.activePlayers : [],
    summary: data?.summary || {},
    progress: data?.progress || {},
    lastGameDay: data?.lastGameDay || null
  };

  const hero = root.querySelector('#leagueHero');
  const rankingTable = root.querySelector('#leagueTableBody');
  const tableTitle = root.querySelector('#leagueTableTitle');
  const expandBtn = root.querySelector('#leagueExpandBtn');
  const infographic = root.querySelector('#leagueInfographic');
  const searchInput = root.querySelector('#leagueSearchInput');
  const tableHead = root.querySelector('.league-ranking-table__head');
  ensureMvpSortHeaders(tableHead);
  const sortHeaders = root.querySelectorAll('.league-sort-header[data-sort]');

  if (!hero || !rankingTable || !tableTitle || !expandBtn || !infographic || !searchInput || !sortHeaders.length) {
    console.warn('[league-stats] template nodes missing, rendering empty state');
    root.innerHTML = `<section class="px-card league-hero"><h1 class="px-card__title league-section-title">\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u043b\u0456\u0433\u0438</h1><p class="px-card__text">\u041d\u0435\u043c\u0430\u0454 \u0434\u0430\u043d\u0438\u0445 \u0434\u043b\u044f \u0432\u0456\u0434\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u043d\u044f.</p></section>`;
    return;
  }

  const state = {
    isFullOpen: false,
    searchTerm: '',
    sortBy: 'default',
    sortDirection: 'desc'
  };
  const activePlayersBase = [...(safeData.players || [])].filter((player) => isSeasonActive(player));

  const renderTables = () => {
    const filtered = filterPlayers(activePlayersBase, state.searchTerm);
    const sorted = sortPlayers(filtered, state.sortBy, state.sortDirection);
    const visible = state.isFullOpen ? sorted : sorted.slice(0, 10);
    rankingTable.innerHTML = visible.map((player) => tableRowMarkup(player, league)).join('')
      || '<tr><td class="league-ranking-table__empty" colspan="10">Немає активних гравців за вибраним пошуком.</td></tr>';
    tableTitle.textContent = state.isFullOpen ? 'Усі гравці ліги' : 'ТОП-10 гравців';
  };

  const setSortButtonState = () => {
    sortHeaders.forEach((btn) => {
      const isActive = btn.dataset.sort === state.sortBy;
      const isDesc = isActive && state.sortDirection === 'desc';
      btn.classList.toggle('is-active', isActive);
      btn.dataset.sortDir = isActive ? state.sortDirection : '';
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      const parentHeader = btn.closest('th');
      if (parentHeader) parentHeader.setAttribute('aria-sort', isActive ? (isDesc ? 'descending' : 'ascending') : 'none');
    });
  };

  const setupRowNavigation = (tbody) => {
    tbody.addEventListener('click', (event) => {
      const row = event.target.closest('tr[data-href]');
      if (!row) return;
      window.location.hash = row.dataset.href;
    });
    tbody.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const row = event.target.closest('tr[data-href]');
      if (!row) return;
      event.preventDefault();
      window.location.hash = row.dataset.href;
    });
  };

  renderHero(hero, league, safeData);
  renderInfographic(infographic, safeData, remainingGameDays, league);
  searchInput.disabled = false;
  searchInput.placeholder = '\u041d\u0456\u043a\u043d\u0435\u0439\u043c \u0433\u0440\u0430\u0432\u0446\u044f';
  expandBtn.disabled = false;
  expandBtn.removeAttribute('aria-disabled');
  expandBtn.textContent = '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u0438 \u0432\u0441\u0456\u0445 \u0433\u0440\u0430\u0432\u0446\u0456\u0432';
  sortHeaders.forEach((btn) => {
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
  });
  setSortButtonState();
  renderTables();

  setupRowNavigation(rankingTable);

  expandBtn.addEventListener('click', () => {
    state.isFullOpen = !state.isFullOpen;
    expandBtn.textContent = state.isFullOpen ? '\u0421\u0445\u043e\u0432\u0430\u0442\u0438 \u043f\u043e\u0432\u043d\u0438\u0439 \u0441\u043f\u0438\u0441\u043e\u043a' : '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u0438 \u0432\u0441\u0456\u0445 \u0433\u0440\u0430\u0432\u0446\u0456\u0432';
    renderTables();
  });

  searchInput.addEventListener('input', () => {
    state.searchTerm = searchInput.value || '';
    renderTables();
  });

  root.querySelector('.league-ranking-table__head')?.addEventListener('click', (event) => {
    const button = event.target.closest('.league-sort-header[data-sort]');
    if (!button) return;
    const nextSort = button.dataset.sort || 'default';
    if (state.sortBy === nextSort && nextSort !== 'default') {
      state.sortDirection = state.sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
      state.sortDirection = 'desc';
    }
    state.sortBy = nextSort;
    setSortButtonState();
    renderTables();
  });
}
