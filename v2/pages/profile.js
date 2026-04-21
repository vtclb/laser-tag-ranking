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

function wrTone(winRate) {
  const wr = Number(winRate);
  if (!Number.isFinite(wr)) return 'is-neutral';
  if (wr > 60) return 'is-good';
  if (wr >= 45) return 'is-mid';
  return 'is-bad';
}

function deltaTone(delta) {
  const n = Number(delta);
  if (!Number.isFinite(n) || n === 0) return 'is-neutral';
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

function getRankProgress(points, rankLetter) {
  const rank = String(rankLetter || 'F').toUpperCase();
  const index = RANK_ORDER.indexOf(rank);
  const currentMin = RANK_MIN_POINTS[rank] ?? 0;

  if (!Number.isFinite(Number(points))) {
    return { percent: 0, currentMin, nextMin: null, remain: null, nextRank: null, isMax: rank === 'S' };
  }

  if (index === -1 || rank === 'S') {
    return { percent: 100, currentMin, nextMin: null, remain: 0, nextRank: null, isMax: true };
  }

  const nextRank = RANK_ORDER[index + 1];
  const nextMin = RANK_MIN_POINTS[nextRank];
  const value = Number(points);
  const span = Math.max(1, nextMin - currentMin);
  const percent = Math.max(0, Math.min(100, ((value - currentMin) / span) * 100));

  return {
    percent,
    currentMin,
    nextMin,
    remain: Math.max(0, nextMin - value),
    nextRank,
    isMax: false
  };
}

function metricMini({ label, value, tone = '' }) {
  return `<article class="profile-mini-card ${tone}"><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`;
}

function renderCareerHighlights(highlights = {}) {
  const cards = [];
  const bestPoints = highlights.bestSeasonByPoints;
  const biggestDelta = highlights.bestSeasonByDelta;
  const bestWr = highlights.bestWinrateSeason;
  const mostActive = highlights.mostActiveSeason;
  const mvpRecord = highlights.bestMvpSeason;

  if (bestPoints?.seasonTitle && Number.isFinite(bestPoints.ratingEnd)) cards.push({ icon: '🏆', label: 'Найкращий сезон', value: String(bestPoints.ratingEnd), season: formatSeasonTitleUA(bestPoints.seasonTitle) });
  if (biggestDelta?.seasonTitle && Number.isFinite(biggestDelta.ratingDelta)) cards.push({ icon: '📈', label: 'Найбільший прогрес', value: signed(biggestDelta.ratingDelta), season: formatSeasonTitleUA(biggestDelta.seasonTitle) });
  if (bestWr?.seasonTitle && Number.isFinite(bestWr.winrate)) cards.push({ icon: '🎯', label: 'Найкращий WR', value: `${bestWr.winrate.toFixed(1)}%`, season: formatSeasonTitleUA(bestWr.seasonTitle) });
  if (mostActive?.seasonTitle && Number.isFinite(mostActive.matches)) cards.push({ icon: '🔥', label: 'Найбільша активність', value: `${mostActive.matches} ігор`, season: formatSeasonTitleUA(mostActive.seasonTitle) });
  if (mvpRecord?.seasonTitle && Number.isFinite(mvpRecord.mvpTotal)) cards.push({ icon: '⭐', label: 'Рекорд MVP', value: String(mvpRecord.mvpTotal), season: formatSeasonTitleUA(mvpRecord.seasonTitle) });

  if (!cards.length) return '';
  return `<section class="px-card profile-section profile-achievements"><h2 class="profile-section__title">Досягнення карʼєри</h2><div class="profile-achievement-grid">${cards.map((item) => `<article class="profile-achievement-card"><div class="profile-achievement-card__head"><span class="profile-achievement-card__icon">${item.icon}</span><strong>${esc(item.label)}</strong></div><p class="profile-achievement-card__value">${esc(item.value)}</p><p class="profile-achievement-card__season">${esc(item.season)}</p></article>`).join('')}</div></section>`;
}

function resolveGameplayInsights({ wins, losses, draws, wr, mvp, delta, place, games }) {
  const w = Number(wins);
  const l = Number(losses);
  const d = Number(draws);
  const winrate = Number(wr);
  const mvpTotal = Number(mvp);
  const rankDelta = Number(delta);
  const currentPlace = Number(place);
  const matches = Number(games);
  const totalMatches = Number.isFinite(matches)
    ? matches
    : [w, l, d].reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const wlBalance = Number.isFinite(w) && Number.isFinite(l) ? w - l : 0;

  let stabilityScore = 0;
  if (winrate >= 60) stabilityScore += 2;
  else if (winrate >= 48) stabilityScore += 1;
  if (wlBalance >= 6) stabilityScore += 2;
  else if (wlBalance >= 1) stabilityScore += 1;
  if (totalMatches >= 28) stabilityScore += 1;
  const stabilityLevel = stabilityScore >= 4 ? 'high' : stabilityScore >= 2 ? 'medium' : 'low';

  let impactScore = 0;
  if (mvpTotal >= 9) impactScore += 2;
  else if (mvpTotal >= 4) impactScore += 1;
  if (rankDelta >= 140) impactScore += 2;
  else if (rankDelta >= 45) impactScore += 1;
  if (currentPlace > 0 && currentPlace <= 5) impactScore += 1;
  const impactLevel = impactScore >= 4 ? 'high' : impactScore >= 2 ? 'medium' : 'low';

  const strengths = [];
  const growth = [];
  if (winrate >= 58) strengths.push('Сильна реалізація матчів');
  if (mvpTotal >= 7) strengths.push('Часто впливає на гру');
  if (rankDelta >= 90) strengths.push('Швидкий прогрес у сезоні');
  if (totalMatches >= 26) strengths.push('Висока ігрова активність');
  if (winrate < 50 && totalMatches >= 24) growth.push('Висока активність, але є простір для стабільності');
  if (losses > wins) growth.push('Потрібно покращити стабільність гри');
  if (mvpTotal <= 2 && totalMatches >= 18) growth.push('Можна частіше брати ключову роль у матчах');
  if (rankDelta <= 0) growth.push('Важливо посилити прогрес за очками');

  const formScore = (winrate >= 57 ? 2 : winrate >= 49 ? 1 : 0)
    + (rankDelta >= 60 ? 2 : rankDelta >= 1 ? 1 : 0)
    + (currentPlace > 0 && currentPlace <= 7 ? 1 : 0)
    + (mvpTotal >= 6 ? 1 : 0)
    + (totalMatches >= 14 ? 1 : 0);
  const formLabel = formScore >= 5 ? 'сильна' : formScore >= 3 ? 'стабільна' : 'нестабільна';

  const playStyle = mvpTotal >= 8 ? 'Агресивний' : winrate >= 57 ? 'Результативний' : stabilityLevel === 'high' ? 'Дисциплінований' : 'Стабільний';
  const activityLevel = totalMatches >= 28 ? 'Висока' : totalMatches >= 14 ? 'Середня' : 'Низька';
  const keyAdvantage = mvpTotal >= 8 ? 'MVP' : rankDelta >= 90 ? 'Прогрес' : winrate >= 58 ? 'WR' : 'Стабільність';

  return {
    totalMatches,
    stabilityScore: Math.min(100, stabilityScore * 20 + 20),
    impactScore: Math.min(100, impactScore * 20 + 20),
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
  const points = Number(livePlayer?.points ?? topSeason?.ratingEnd ?? topSeason?.points);
  const place = Number(livePlayer?.place ?? topSeason?.place ?? topSeason?.finalPlace);
  const progress = getRankProgress(points, currentRank);
  const seasonLabel = formatSeasonTitleUA(currentSeason?.uiLabel || topSeason?.seasonTitle || 'Поточний сезон');
  const leagueLabel = leagueLabelUA(profileLeagueContext);

  return `
    <article class="px-card profile-hero ${rankClass(currentRank)}">
      <div class="profile-avatar-frame ${rankClass(currentRank)}">
        <img src="${esc(topSeason?.avatar || livePlayer?.avatarUrl || placeholder)}" alt="${esc(displayNick)}" onerror="this.src='${placeholder}'">
      </div>
      <div class="profile-hero__main">
        <div class="profile-hero__head">
          <h1>${esc(displayNick)}</h1>
          <span class="profile-rank-badge ${rankClass(currentRank)}">${esc(currentRank)}</span>
        </div>
        <p class="profile-hero__meta">${esc(leagueLabel)} • ${esc(seasonLabel)}</p>
        <div class="profile-hero__badges">
          <span class="profile-place-badge">${Number.isFinite(place) ? `Місце #${place}` : 'Місце —'}</span>
          <span class="profile-subtle-badge">Ліга: ${esc(leagueLabel)}</span>
        </div>
        <div class="profile-rank-progress-wrap">
          <div class="profile-rank-progress__labels">
            <span>Прогрес рангу</span>
            <strong>${progress.isMax ? 'Максимальний ранг' : `${progress.percent.toFixed(0)}% до ${progress.nextRank}`}</strong>
          </div>
          <div class="profile-rank-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress.percent)}">
            <span style="width:${progress.percent.toFixed(1)}%"></span>
          </div>
          <p class="profile-note">${progress.isMax ? 'Максимальний ранг досягнуто' : `Залишилось ${val(progress.remain, '—')} очок до рангу ${val(progress.nextRank, '—')}.`}</p>
        </div>
      </div>
      <div class="profile-hero__actions">
        <a class="btn btn--secondary" href="${buildHash('league-stats', { league: normalizeLeagueKey(profileLeagueContext) })}">Назад до ліги</a>
      </div>
    </article>
  `;
}

function renderCompactStats({ livePlayer, topSeason }) {
  const wr = livePlayer?.winRate ?? topSeason?.winRate ?? topSeason?.winrate;
  const delta = livePlayer?.delta ?? topSeason?.delta ?? topSeason?.ratingDelta;
  return `
    <section class="px-card profile-section">
      <h2 class="profile-section__title">Ключові метрики</h2>
      <div class="profile-mini-grid">
        ${metricMini({ label: 'Очки', value: val(livePlayer?.points ?? topSeason?.ratingEnd ?? topSeason?.points), tone: 'is-accent' })}
        ${metricMini({ label: 'WR', value: pct(wr), tone: wrTone(wr) })}
        ${metricMini({ label: 'MVP', value: val(livePlayer?.mvpTotal ?? topSeason?.mvpTotal) })}
        ${metricMini({ label: 'Δ рейтингу', value: signed(delta), tone: deltaTone(delta) })}
      </div>
    </section>
  `;
}

function renderGameAnalysis({ livePlayer, topSeason }) {
  const wins = Number(livePlayer?.wins ?? topSeason?.wins);
  const losses = Number(livePlayer?.losses ?? topSeason?.losses);
  const draws = Number(livePlayer?.draws ?? topSeason?.draws);
  const wr = Number(livePlayer?.winRate ?? topSeason?.winRate ?? topSeason?.winrate);
  const total = [wins, losses, draws].reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const insights = resolveGameplayInsights({
    wins,
    losses,
    draws,
    wr,
    mvp: livePlayer?.mvpTotal ?? topSeason?.mvpTotal,
    delta: livePlayer?.delta ?? topSeason?.delta ?? topSeason?.ratingDelta,
    place: livePlayer?.place ?? topSeason?.place ?? topSeason?.finalPlace,
    games: livePlayer?.matches ?? topSeason?.matches ?? total
  });

  return `
    <section class="px-card profile-section profile-analysis">
      <h2 class="profile-section__title">Аналіз гри</h2>
      <div class="profile-analysis__row">
        <div>
          <p class="profile-analysis__label">Winrate</p>
          <div class="profile-wr-bar ${wrTone(wr)}"><span style="width:${Number.isFinite(wr) ? Math.max(0, Math.min(100, wr)) : 0}%"></span></div>
          <strong class="profile-analysis__value">${pct(wr)}</strong>
        </div>
        <div class="profile-analysis__compact-grid">
          ${metricMini({ label: 'Перемоги', value: val(wins), tone: 'is-good' })}
          ${metricMini({ label: 'Поразки', value: val(losses), tone: 'is-bad' })}
          ${metricMini({ label: 'Нічиї', value: val(draws), tone: 'is-mid' })}
          ${metricMini({ label: 'Ігри', value: val(livePlayer?.matches ?? topSeason?.matches ?? total) })}
          ${metricMini({ label: 'Бої', value: val(livePlayer?.battles ?? topSeason?.rounds) })}
          ${metricMini({ label: 'MVP', value: val(livePlayer?.mvpTotal ?? topSeason?.mvpTotal) })}
        </div>
      </div>
      <div class="profile-indicator-grid">
        <article class="profile-indicator-card">
          <p>Стабільність гри</p>
          <strong>${meterLabel(insights.stabilityLevel)}</strong>
          <div class="profile-meter ${insights.stabilityLevel}"><span style="width:${insights.stabilityScore}%"></span></div>
        </article>
        <article class="profile-indicator-card">
          <p>Вплив на гру</p>
          <strong>${meterLabel(insights.impactLevel)}</strong>
          <div class="profile-meter ${insights.impactLevel}"><span style="width:${insights.impactScore}%"></span></div>
        </article>
      </div>
      <article class="profile-form-card">
        <p>Поточна форма</p>
        <strong>Форма: ${esc(insights.formLabel)}</strong>
      </article>
      <div class="profile-insights-grid">
        <article class="profile-insights-card">
          <h3>Сильні сторони</h3>
          <ul>${(insights.strengths.length ? insights.strengths : ['База для стабільного росту']).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
        </article>
        <article class="profile-insights-card">
          <h3>Зони росту</h3>
          <ul>${(insights.growth.length ? insights.growth : ['Продовжувати поточний темп сезону']).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
        </article>
      </div>
      <article class="profile-player-type">
        <h3>Профіль гравця</h3>
        <div class="profile-player-type__grid">
          ${metricMini({ label: 'Стиль гри', value: insights.playStyle })}
          ${metricMini({ label: 'Рівень активності', value: insights.activityLevel })}
          ${metricMini({ label: 'Ключова перевага', value: insights.keyAdvantage, tone: 'is-accent' })}
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
  if (!season || season.id === 'all') {
    return `
      <section class="profile-season-summary">
        <h3>Уся карʼєра</h3>
        <p class="profile-muted">Зведені показники за всі сезони.</p>
        <div class="profile-mini-grid">
          ${metricMini({ label: 'Ігри', value: val(allTime.totalMatches ?? allTime.matches) })}
          ${metricMini({ label: 'Раунди', value: val(allTime.totalRounds ?? allTime.rounds) })}
          ${metricMini({ label: 'WR', value: pct(allTime.careerWR ?? allTime.winrate), tone: wrTone(allTime.careerWR ?? allTime.winrate) })}
          ${metricMini({ label: 'MVP', value: val(allTime.totalMvp ?? allTime.mvpTotal) })}
          ${metricMini({ label: 'Пік рейтингу', value: val(allTime.peakRating ?? allTime.peakPoints), tone: 'is-accent' })}
          ${metricMini({ label: 'Найкращий ранг', value: val(allTime.bestRank), tone: 'is-accent' })}
        </div>
      </section>
    `;
  }

  const seasonWr = season.winRate ?? season.winrate;
  const seasonDelta = season.delta ?? season.ratingDelta;

  return `
      <section class="profile-season-summary">
        <h3>${esc(formatSeasonTitleUA(season.seasonTitle || season.id))}</h3>
        <p class="profile-muted">${esc(leagueLabelUA(season.league || 'kids'))}</p>
        <div class="profile-mini-grid">
          ${metricMini({ label: 'Старт', value: val(season.ratingStart) })}
          ${metricMini({ label: 'Фініш', value: val(season.ratingEnd ?? season.points), tone: 'is-accent' })}
          ${metricMini({ label: 'Δ', value: signed(seasonDelta), tone: deltaTone(seasonDelta) })}
          ${metricMini({ label: 'WR', value: pct(seasonWr), tone: wrTone(seasonWr) })}
          ${metricMini({ label: 'Ігри', value: val(season.matches ?? season.games) })}
          ${metricMini({ label: 'MVP', value: val(season.mvpTotal) })}
          ${metricMini({ label: 'Місце', value: Number.isFinite(Number(season.place ?? season.finalPlace)) ? `#${season.place ?? season.finalPlace}` : '—' })}
          ${metricMini({ label: 'Ранг', value: val(season.rank), tone: 'is-accent' })}
        </div>
        <div class="profile-season-wld-grid">
          ${metricMini({ label: 'Перемоги', value: val(season.wins), tone: 'is-good' })}
          ${metricMini({ label: 'Поразки', value: val(season.losses), tone: 'is-bad' })}
          ${metricMini({ label: 'Нічиї', value: val(season.draws), tone: 'is-mid' })}
        </div>
        <div class="profile-season-trend">
          <div class="profile-season-trend__head"><span>Прогрес сезону</span><strong>${esc(val(season.ratingStart))} → ${esc(val(season.ratingEnd ?? season.points))}</strong></div>
          <div class="profile-season-trend__bar ${deltaTone(seasonDelta)}"><span style="width:${Math.min(100, Math.max(8, Number.isFinite(Number(seasonDelta)) ? Math.min(100, Math.abs(Number(seasonDelta)) / 2) : 8))}%"></span></div>
          <p class="profile-note">${Number(seasonDelta) > 0 ? 'Сезон із зростанням рейтингу' : Number(seasonDelta) < 0 ? 'Є просідання, є куди додати' : 'Рейтинг тримається стабільно'}</p>
        </div>
      </section>
  `;
}

function renderLogs(logData) {
  if (!logData?.groups?.length) {
    return '<section class="profile-log-empty"><h3>Логи сезону</h3><p>Для цього сезону немає записів матчів або логів рейтингу.</p></section>';
  }

  return `<details class="profile-logs-wrap">
    <summary>Матч-логи (${logData.groups.length} днів)</summary>
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
                  <span>MVP: ${esc(entry.mvp1 || '—')} / ${esc(entry.mvp2 || '—')} / ${esc(entry.mvp3 || '—')}</span>
                  <span>Раунди: ${esc(val(entry.rounds))}</span>
                </div>
              </li>
            `).join('')}</ul>`
    : '<p class="profile-muted">Матчів за дату не знайдено, доступні лише зміни рейтингу.</p>'}
      </article>
    `).join('')}
  </details>`;
}

function sortTabsByChronology(tabs = []) {
  return [...tabs].sort((a, b) => {
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

        <section class="px-card profile-section">
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
      });

    const tabs = [{ id: 'all', label: 'Усі сезони', current: false }].concat(sortTabsByChronology(available));

    const state = { seasonId: currentSeason?.id && seasonRowsById.has(currentSeason.id) ? currentSeason.id : 'all' };

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
