import {
  buildPlayerCareer,
  getCurrentLeagueLiveStats,
  getCurrentSeason,
  getPlayerSeasonLogs,
  getSeasonsList,
  safeErrorMessage
} from '../core/dataHub.js';
import { normalizeLeague, normalizeLeagueKey, leagueLabelUA } from '../core/naming.js';
import { decodeParam, getRouteState, normalizePlayerKey } from '../core/utils.js';

const placeholder = '../assets/default-avatar.svg';
const RANK_ORDER = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
const RANK_MIN_POINTS = { F: 0, E: 200, D: 400, C: 600, B: 800, A: 1000, S: 1200 };

function esc(v) {
  return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function isMissing(v) {
  if (v === null || v === undefined) return true;
  const raw = String(v).trim().toLowerCase();
  return raw === '' || raw === 'null' || raw === '#null' || raw === 'undefined' || raw === 'nan';
}

function val(v, fallback = '—') {
  if (isMissing(v)) return fallback;
  if (typeof v === 'number' && Number.isNaN(v)) return fallback;
  return String(v);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pct(v) {
  const n = num(v);
  return n === null ? '—' : `${n.toFixed(1)}%`;
}

function signed(v) {
  const n = num(v);
  if (n === null) return '—';
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
    if (!isMissing(value)) query.set(key, String(value));
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

function wrTone(winRate) {
  const wr = num(winRate);
  if (wr === null) return 'is-neutral';
  if (wr >= 60) return 'is-good';
  if (wr >= 48) return 'is-mid';
  return 'is-bad';
}

function deltaTone(delta) {
  const n = num(delta);
  if (n === null || n === 0) return 'is-neutral';
  return n > 0 ? 'is-positive' : 'is-negative';
}

function formatSeasonTitleUA(raw = '') {
  const value = String(raw || '').trim();
  if (!value) return '—';

  const known = {
    spring: 'Весна',
    summer: 'Літо',
    autumn: 'Осінь',
    fall: 'Осінь',
    winter: 'Зима'
  };

  const lower = value.toLowerCase().replace(/[–—]/g, '-').replace(/\//g, '-').replace(/\s+/g, '_');
  const direct = Object.keys(known).find((key) => lower.startsWith(key));
  if (direct) {
    const years = lower.match(/(20\d{2})(?:[-_](20\d{2}|\d{2}))?/);
    if (years) {
      const y1 = years[1];
      const y2 = years[2];
      if (y2) {
        const fullY2 = y2.length === 2 ? `${String(y1).slice(0, 2)}${y2}` : y2;
        return `${known[direct]} ${y1}–${fullY2}`;
      }
      return `${known[direct]} ${y1}`;
    }
  }

  return value
    .replace(/summer/ig, 'Літо')
    .replace(/autumn/ig, 'Осінь')
    .replace(/fall/ig, 'Осінь')
    .replace(/winter/ig, 'Зима')
    .replace(/spring/ig, 'Весна')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function seasonOrderKey(label = '') {
  const map = {
    'Літо 2025': 0,
    'Осінь 2025': 1,
    'Зима 2025–2026': 2,
    'Весна 2026': 3
  };
  return map[label] ?? 100;
}

function getRankProgress(points, rankLetter) {
  const rank = String(rankLetter || 'F').toUpperCase();
  const index = RANK_ORDER.indexOf(rank);
  const currentMin = RANK_MIN_POINTS[rank] ?? 0;
  const pointsValue = num(points);

  if (pointsValue === null) {
    return { percent: 0, currentMin, nextMin: null, remain: null, nextRank: null, isMax: rank === 'S' };
  }

  if (index === -1 || rank === 'S') {
    return { percent: 100, currentMin, nextMin: null, remain: 0, nextRank: null, isMax: true };
  }

  const nextRank = RANK_ORDER[index + 1];
  const nextMin = RANK_MIN_POINTS[nextRank];
  const span = Math.max(1, nextMin - currentMin);
  const percent = Math.max(0, Math.min(100, ((pointsValue - currentMin) / span) * 100));

  return {
    percent,
    currentMin,
    nextMin,
    remain: Math.max(0, nextMin - pointsValue),
    nextRank,
    isMax: false
  };
}

function metricMini({ label, value, tone = '' }) {
  return `<article class="profile-mini-card ${tone}"><strong>${esc(val(value))}</strong><span>${esc(label)}</span></article>`;
}

function renderCareerHighlights(highlights = {}) {
  const cards = [];
  const bestPoints = highlights.bestSeasonByPoints;
  const biggestDelta = highlights.bestSeasonByDelta;
  const bestWr = highlights.bestWinrateSeason;
  const mostActive = highlights.mostActiveSeason;
  const mvpRecord = highlights.bestMvpSeason;

  if (bestPoints?.seasonTitle && num(bestPoints.ratingEnd) !== null) cards.push({ icon: '🏆', label: 'Найкращий сезон', value: String(bestPoints.ratingEnd), season: formatSeasonTitleUA(bestPoints.seasonTitle) });
  if (biggestDelta?.seasonTitle && num(biggestDelta.ratingDelta) !== null) cards.push({ icon: '📈', label: 'Найбільший прогрес', value: signed(biggestDelta.ratingDelta), season: formatSeasonTitleUA(biggestDelta.seasonTitle) });
  if (bestWr?.seasonTitle && num(bestWr.winrate) !== null) cards.push({ icon: '🎯', label: 'Найкращий WR', value: `${Number(bestWr.winrate).toFixed(1)}%`, season: formatSeasonTitleUA(bestWr.seasonTitle) });
  if (mostActive?.seasonTitle && num(mostActive.matches) !== null) cards.push({ icon: '🔥', label: 'Найбільша активність', value: `${mostActive.matches} ігор`, season: formatSeasonTitleUA(mostActive.seasonTitle) });
  if (mvpRecord?.seasonTitle && num(mvpRecord.mvpTotal) !== null) cards.push({ icon: '⭐', label: 'Рекорд MVP', value: String(mvpRecord.mvpTotal), season: formatSeasonTitleUA(mvpRecord.seasonTitle) });

  if (!cards.length) return '';
  return `<section class="px-card profile-section profile-achievements"><h2 class="profile-section__title">Досягнення карʼєри</h2><div class="profile-achievement-grid">${cards.map((item) => `<article class="profile-achievement-card"><span class="profile-achievement-card__icon">${item.icon}</span><p class="profile-achievement-card__label">${esc(item.label)}</p><p class="profile-achievement-card__value">${esc(item.value)}</p><p class="profile-achievement-card__season">${esc(item.season)}</p></article>`).join('')}</div></section>`;
}

function resolveGameplayInsights({ wins, losses, draws, wr, mvp, delta, place, games }) {
  const w = num(wins) ?? 0;
  const l = num(losses) ?? 0;
  const d = num(draws) ?? 0;
  const winrate = num(wr) ?? 0;
  const mvpTotal = num(mvp) ?? 0;
  const rankDelta = num(delta) ?? 0;
  const currentPlace = num(place) ?? 999;
  const totalMatches = num(games) ?? (w + l + d);
  const wlBalance = w - l;

  let stabilityScore = 15;
  if (winrate >= 60) stabilityScore += 35;
  else if (winrate >= 50) stabilityScore += 20;
  if (wlBalance >= 8) stabilityScore += 30;
  else if (wlBalance >= 2) stabilityScore += 15;
  if (totalMatches >= 24) stabilityScore += 15;

  let impactScore = 15;
  if (mvpTotal >= 9) impactScore += 35;
  else if (mvpTotal >= 4) impactScore += 20;
  if (rankDelta >= 140) impactScore += 30;
  else if (rankDelta >= 45) impactScore += 15;
  if (currentPlace > 0 && currentPlace <= 5) impactScore += 15;

  const stabilityLevel = stabilityScore >= 70 ? 'high' : stabilityScore >= 45 ? 'medium' : 'low';
  const impactLevel = impactScore >= 70 ? 'high' : impactScore >= 45 ? 'medium' : 'low';

  const strengths = [];
  const growth = [];

  if (winrate >= 58) strengths.push('Висока реалізація матчів');
  if (mvpTotal >= 7) strengths.push('Сильний персональний вплив');
  if (rankDelta >= 90) strengths.push('Швидко набирає рейтинг');
  if (totalMatches >= 26) strengths.push('Тримає хороший темп сезону');

  if (winrate < 50 && totalMatches >= 18) growth.push('Потрібна краща конверсія матчів');
  if (l > w) growth.push('Потрібно зменшити серії поразок');
  if (mvpTotal <= 2 && totalMatches >= 14) growth.push('Додати ініціативу в ключових раундах');
  if (rankDelta <= 0) growth.push('Важливо повернути позитивний приріст');

  const formScore =
    (winrate >= 57 ? 2 : winrate >= 49 ? 1 : 0)
    + (rankDelta >= 60 ? 2 : rankDelta >= 1 ? 1 : 0)
    + (currentPlace <= 7 ? 1 : 0)
    + (mvpTotal >= 6 ? 1 : 0)
    + (totalMatches >= 14 ? 1 : 0);

  const formLabel = formScore >= 5 ? 'Сильна' : formScore >= 3 ? 'Стабільна' : 'Нестабільна';
  const playStyle = mvpTotal >= 8 ? 'Агресивний' : winrate >= 57 ? 'Результативний' : stabilityLevel === 'high' ? 'Дисциплінований' : 'Балансний';
  const activityLevel = totalMatches >= 28 ? 'Висока' : totalMatches >= 14 ? 'Середня' : 'Низька';
  const keyAdvantage = mvpTotal >= 8 ? 'MVP' : rankDelta >= 90 ? 'Прогрес' : winrate >= 58 ? 'Winrate' : 'Стабільність';

  return {
    totalMatches,
    stabilityScore: Math.min(100, stabilityScore),
    impactScore: Math.min(100, impactScore),
    stabilityLevel,
    impactLevel,
    formLabel,
    strengths: strengths.slice(0, 2),
    growth: growth.slice(0, 2),
    playStyle,
    activityLevel,
    keyAdvantage
  };
}

function meterLabel(level) {
  if (level === 'high') return 'Високий';
  if (level === 'medium') return 'Середній';
  return 'Низький';
}

function renderHero({ profileLeagueContext, livePlayer, currentSeason, displayNick, currentRank, topSeason }) {
  const points = livePlayer?.points ?? topSeason?.ratingEnd ?? topSeason?.points;
  const place = livePlayer?.place ?? topSeason?.place ?? topSeason?.finalPlace;
  const progress = getRankProgress(points, currentRank);
  const seasonLabel = formatSeasonTitleUA(currentSeason?.uiLabel || topSeason?.seasonTitle || 'Поточний сезон');
  const leagueLabel = leagueLabelUA(profileLeagueContext);

  return `
    <article class="px-card profile-hero ${rankClass(currentRank)}">
      <a class="btn btn--secondary profile-hero__back" href="${buildHash('league-stats', { league: normalizeLeagueKey(profileLeagueContext) })}">← До ліги</a>
      <div class="profile-hero__top">
        <div class="profile-avatar-frame ${rankClass(currentRank)}">
          <img src="${esc(topSeason?.avatar || livePlayer?.avatarUrl || placeholder)}" alt="${esc(displayNick)}" onerror="this.src='${placeholder}'">
        </div>
        <div class="profile-hero__identity">
          <h1>${esc(displayNick)}</h1>
          <p class="profile-hero__meta">${esc(leagueLabel)} · ${esc(seasonLabel)}</p>
          <div class="profile-hero__status">
            <span class="profile-status-badge profile-status-badge--place">${num(place) !== null ? `#${place} місце` : 'Місце —'}</span>
            <span class="profile-status-badge profile-status-badge--rank">Ранг ${esc(val(currentRank))}</span>
          </div>
        </div>
        <div class="profile-rank-card ${rankClass(currentRank)}">
          <p class="profile-rank-card__label">Поточний ранг</p>
          <strong class="profile-rank-card__value">${esc(val(currentRank))}</strong>
        </div>
      </div>
      <div class="profile-rank-progress-wrap">
        <div class="profile-rank-progress__labels">
          <span>Прогрес до наступного рангу</span>
          <strong>${progress.isMax ? 'Максимальний ранг досягнуто' : `${progress.percent.toFixed(0)}% до ${progress.nextRank}`}</strong>
        </div>
        <div class="profile-rank-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress.percent)}">
          <span style="width:${progress.percent.toFixed(1)}%"></span>
        </div>
        <p class="profile-note">${progress.isMax ? 'Максимальний ранг досягнуто' : `Ще ${val(progress.remain)} очок до рангу ${val(progress.nextRank)}.`}</p>
      </div>
    </article>
  `;
}

function renderCompactStats({ livePlayer, topSeason }) {
  const wr = livePlayer?.winRate ?? topSeason?.winRate ?? topSeason?.winrate;
  const delta = livePlayer?.delta ?? topSeason?.delta ?? topSeason?.ratingDelta;
  return `
    <section class="px-card profile-section profile-priority-main">
      <h2 class="profile-section__title">Ключові метрики</h2>
      <div class="profile-key-grid">
        ${metricMini({ label: 'Очки', value: livePlayer?.points ?? topSeason?.ratingEnd ?? topSeason?.points, tone: 'is-accent' })}
        ${metricMini({ label: 'WR', value: pct(wr), tone: wrTone(wr) })}
        ${metricMini({ label: 'MVP', value: livePlayer?.mvpTotal ?? topSeason?.mvpTotal })}
        ${metricMini({ label: 'Δ рейтингу', value: signed(delta), tone: deltaTone(delta) })}
      </div>
    </section>
  `;
}

function renderGameAnalysis({ livePlayer, topSeason }) {
  const wins = livePlayer?.wins ?? topSeason?.wins;
  const losses = livePlayer?.losses ?? topSeason?.losses;
  const draws = livePlayer?.draws ?? topSeason?.draws;
  const wr = livePlayer?.winRate ?? topSeason?.winRate ?? topSeason?.winrate;
  const games = livePlayer?.matches ?? topSeason?.matches;

  const insights = resolveGameplayInsights({
    wins,
    losses,
    draws,
    wr,
    mvp: livePlayer?.mvpTotal ?? topSeason?.mvpTotal,
    delta: livePlayer?.delta ?? topSeason?.delta ?? topSeason?.ratingDelta,
    place: livePlayer?.place ?? topSeason?.place ?? topSeason?.finalPlace,
    games
  });

  return `
    <section class="px-card profile-section profile-priority-analytics">
      <h2 class="profile-section__title">Аналіз гри</h2>
      <article class="profile-wr-panel">
        <div class="profile-wr-panel__head">
          <p>Winrate</p>
          <strong class="${wrTone(wr)}">${pct(wr)}</strong>
        </div>
        <div class="profile-wr-bar ${wrTone(wr)}"><span style="width:${Math.max(0, Math.min(100, num(wr) ?? 0))}%"></span></div>
      </article>

      <div class="profile-analysis-row3">
        ${metricMini({ label: 'Перемоги', value: wins, tone: 'is-good' })}
        ${metricMini({ label: 'Поразки', value: losses, tone: 'is-bad' })}
        ${metricMini({ label: 'Нічиї', value: draws, tone: 'is-mid' })}
      </div>

      <div class="profile-analysis-row3">
        ${metricMini({ label: 'Ігри', value: games ?? insights.totalMatches })}
        ${metricMini({ label: 'Бої', value: livePlayer?.battles ?? topSeason?.rounds })}
        ${metricMini({ label: 'MVP', value: livePlayer?.mvpTotal ?? topSeason?.mvpTotal })}
      </div>

      <div class="profile-indicator-grid">
        <article class="profile-indicator-card">
          <p>Стабільність</p>
          <strong>${meterLabel(insights.stabilityLevel)}</strong>
          <div class="profile-meter ${insights.stabilityLevel}"><span style="width:${insights.stabilityScore}%"></span></div>
        </article>
        <article class="profile-indicator-card">
          <p>Вплив</p>
          <strong>${meterLabel(insights.impactLevel)}</strong>
          <div class="profile-meter ${insights.impactLevel}"><span style="width:${insights.impactScore}%"></span></div>
        </article>
        <article class="profile-indicator-card profile-indicator-card--form">
          <p>Поточна форма</p>
          <strong>${esc(insights.formLabel)}</strong>
        </article>
      </div>

      <div class="profile-insights-grid">
        <article class="profile-insights-card">
          <h3>Сильні сторони</h3>
          <ul>${(insights.strengths.length ? insights.strengths : ['Стабільна база для подальшого росту']).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
        </article>
        <article class="profile-insights-card">
          <h3>Зони росту</h3>
          <ul>${(insights.growth.length ? insights.growth : ['Підтримувати поточний темп гри']).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
        </article>
      </div>

      <article class="profile-player-type">
        <h3>Профіль гравця</h3>
        <div class="profile-player-type__grid">
          ${metricMini({ label: 'Стиль гри', value: `🎮 ${insights.playStyle}` })}
          ${metricMini({ label: 'Активність', value: `⚡ ${insights.activityLevel}` })}
          ${metricMini({ label: 'Перевага', value: `🏅 ${insights.keyAdvantage}`, tone: 'is-accent' })}
        </div>
      </article>
    </section>
  `;
}

function renderSeasonTabs(container, tabs, selectedId) {
  container.innerHTML = tabs.map((tab) => `
    <button type="button" class="profile-season-tab ${tab.id === selectedId ? 'is-active' : ''}" data-season-id="${esc(tab.id)}">
      <span>${esc(tab.label)}</span>
      ${tab.current ? '<em>поточний</em>' : ''}
    </button>
  `).join('');
}

function renderSeasonSummary(season, allTime) {
  if (!season) {
    return '<section class="profile-season-summary"><h3>Сезон</h3><p class="profile-muted">Немає даних сезону.</p></section>';
  }

  const seasonWr = season.winRate ?? season.winrate;
  const seasonDelta = season.delta ?? season.ratingDelta;
  const start = season.ratingStart;
  const finish = season.ratingEnd ?? season.points;
  const trendWidth = Math.min(100, Math.max(8, num(seasonDelta) === null ? 8 : Math.abs(Number(seasonDelta)) / 2));

  return `
      <section class="profile-season-summary">
        <h3>${esc(formatSeasonTitleUA(season.seasonTitle || season.id))}</h3>
        <p class="profile-muted">${esc(leagueLabelUA(season.league || 'kids'))}</p>

        <div class="profile-season-kpis">
          ${metricMini({ label: 'Старт', value: start })}
          ${metricMini({ label: 'Фініш', value: finish, tone: 'is-accent' })}
          ${metricMini({ label: 'Δ', value: signed(seasonDelta), tone: deltaTone(seasonDelta) })}
          ${metricMini({ label: 'WR', value: pct(seasonWr), tone: wrTone(seasonWr) })}
          ${metricMini({ label: 'Ігри', value: season.matches ?? season.games })}
          ${metricMini({ label: 'MVP', value: season.mvpTotal })}
          ${metricMini({ label: 'Ранг', value: season.rank, tone: 'is-accent' })}
          ${metricMini({ label: 'Місце', value: num(season.place ?? season.finalPlace) !== null ? `#${season.place ?? season.finalPlace}` : '—' })}
        </div>

        <div class="profile-season-wld-grid">
          ${metricMini({ label: 'Перемоги', value: season.wins, tone: 'is-good' })}
          ${metricMini({ label: 'Поразки', value: season.losses, tone: 'is-bad' })}
          ${metricMini({ label: 'Нічиї', value: season.draws, tone: 'is-mid' })}
        </div>

        <div class="profile-season-trend">
          <div class="profile-season-trend__head"><span>Прогрес сезону</span><strong>${esc(val(start))} → ${esc(val(finish))}</strong></div>
          <div class="profile-season-trend__bar ${deltaTone(seasonDelta)}"><span style="width:${trendWidth}%"></span></div>
          <p class="profile-note">${num(seasonDelta) > 0 ? 'Рейтинг росте стабільно.' : num(seasonDelta) < 0 ? 'Є просідання, варто підсилити гру.' : 'Рейтинг без помітних змін.'}</p>
        </div>

        <div class="profile-season-career-row">
          ${metricMini({ label: 'Матчів за карʼєру', value: allTime.totalMatches ?? allTime.matches })}
          ${metricMini({ label: 'Карʼєрний WR', value: pct(allTime.careerWR ?? allTime.winrate), tone: wrTone(allTime.careerWR ?? allTime.winrate) })}
        </div>
      </section>
  `;
}

function renderLogs(logData) {
  if (!logData?.groups?.length) {
    return '<section class="profile-log-empty"><h3>Логи сезону</h3><p>Для цього сезону немає записів матчів або логів рейтингу.</p></section>';
  }

  return `<details class="profile-logs-wrap">
    <summary>Логи сезону (${logData.groups.length} днів)</summary>
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
                  <span>Переможець: ${esc(winnerText(entry.winnerLabel))}</span>
                  <span>MVP: ${esc(val(entry.mvp1))} / ${esc(val(entry.mvp2))} / ${esc(val(entry.mvp3))}</span>
                  <span>Раунди: ${esc(val(entry.rounds))}</span>
                </div>
              </li>
            `).join('')}</ul>`
    : '<p class="profile-muted">Матчі за дату відсутні, є лише зміни рейтингу.</p>'}
      </article>
    `).join('')}
  </details>`;
}

function sortTabsByChronology(tabs = []) {
  return [...tabs].sort((a, b) => {
    const aOrder = seasonOrderKey(a.label);
    const bOrder = seasonOrderKey(b.label);
    if (aOrder !== bOrder) return aOrder - bOrder;

    const aTime = Number.isFinite(Date.parse(a.dateFrom || '')) ? Date.parse(a.dateFrom) : 0;
    const bTime = Number.isFinite(Date.parse(b.dateFrom || '')) ? Date.parse(b.dateFrom) : 0;
    return aTime - bTime;
  });
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
    const [profile, liveStats, currentSeason, seasonOptions] = await Promise.all([
      buildPlayerCareer(nick, { profileLeagueContext: routeLeagueContext }),
      getCurrentLeagueLiveStats(league),
      getCurrentSeason(),
      getSeasonsList()
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
    const topSeason = seasonRows[0] || {};
    const currentRank = String(livePlayer?.rankLetter || topSeason?.rank || profile?.allTime?.bestRank || 'F').toUpperCase();

    root.innerHTML = `
      <section class="profile-page-v2">
        ${renderHero({ profileLeagueContext, livePlayer: livePlayer || {}, currentSeason, displayNick, currentRank, topSeason })}
        ${renderCompactStats({ livePlayer: livePlayer || {}, topSeason })}
        ${renderGameAnalysis({ livePlayer: livePlayer || {}, topSeason })}
        ${renderCareerHighlights(profile?.highlights || {})}

        <section class="px-card profile-section profile-priority-history">
          <h2 class="profile-section__title">Сезони</h2>
          <div class="profile-season-tabs" id="seasonTabs"></div>
          <div id="seasonSummaryHost"></div>
          <div id="seasonLogsHost"></div>
        </section>
      </section>
    `;

    const seasonTabsEl = root.querySelector('#seasonTabs');
    const summaryEl = root.querySelector('#seasonSummaryHost');
    const logsEl = root.querySelector('#seasonLogsHost');

    const available = seasonRows
      .map((season) => {
        const meta = (seasonOptions || []).find((item) => item.id === season.seasonId);
        return {
          id: season.seasonId,
          label: formatSeasonTitleUA(meta?.title || season.seasonTitle || season.seasonId),
          current: season.seasonId === currentSeason?.id,
          dateFrom: meta?.dateFrom
        };
      })
      .filter((tab) => !isMissing(tab.id));

    const tabs = sortTabsByChronology(available);
    const fallbackSeasonId = tabs[tabs.length - 1]?.id || tabs[0]?.id || null;
    const state = {
      seasonId: currentSeason?.id && seasonRowsById.has(currentSeason.id)
        ? currentSeason.id
        : fallbackSeasonId
    };

    const renderState = async () => {
      renderSeasonTabs(seasonTabsEl, tabs, state.seasonId);
      const selectedSeason = seasonRowsById.get(state.seasonId);
      summaryEl.innerHTML = renderSeasonSummary(selectedSeason, profile?.allTime || {});

      if (!state.seasonId) {
        logsEl.innerHTML = '<section class="profile-log-empty"><h3>Логи сезону</h3><p>Немає доступних сезонів для цього гравця.</p></section>';
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
