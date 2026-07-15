import {
  buildPlayerCareer,
  getCurrentLeagueLiveStats,
  getCurrentSeason,
  getPlayerSeasonLogs,
  getSeasonsList,
  safeErrorMessage
} from '../core/dataHub.js?v=20260715-perf2';
import { normalizeLeague, normalizeLeagueKey, leagueLabelUA } from '../core/naming.js';
import { getNextRankProgress } from '../core/rankRules.js';
import { decodeParam, getRouteState, normalizePlayerKey } from '../core/utils.js';
import { renderPageError } from '../core/pageState.js?v=20260715-load1';

const placeholder = './assets/default-avatar.svg';

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
  if (isMissing(v)) return null;
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

function pointsWord(value) {
  const n = Math.abs(Math.trunc(Number(value)));
  if (!Number.isFinite(n)) return 'очок';
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return 'очок';
  const last = n % 10;
  if (last === 1) return 'очко';
  if (last >= 2 && last <= 4) return 'очки';
  return 'очок';
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
  root.innerHTML = `<section class="profile-page"><div class="profile-shell">
    <section class="profile-section profile-loading-shell" role="status" aria-live="polite">
      <div class="profile-loading-arena" aria-hidden="true">
        <span class="profile-loading-arena__scan"></span>
        <span class="profile-loading-arena__target"></span>
        <span class="profile-loading-arena__blip"></span>
      </div>
      <p class="profile-loading-shell__eyebrow">Профіль гравця</p>
      <h1 class="profile-loading-shell__title">Збираємо бойову історію</h1>
      <p class="profile-muted">Синхронізуємо сезони, ранги та MVP.</p>
      <div class="profile-loading-stages" aria-hidden="true"><span>Сезони</span><span>Рейтинг</span><span>Досягнення</span></div>
    </section>
  </div></section>`;
}

function renderLiveProfilePreview(root, {
  profileLeagueContext,
  livePlayer,
  currentSeason,
  displayNick,
  currentRank
}) {
  const topSeason = buildCurrentSeasonRow(livePlayer, currentSeason, profileLeagueContext) || {};
  const profilePoints = livePlayer?.points ?? topSeason?.ratingEnd ?? topSeason?.points;

  root.innerHTML = `
    <section class="profile-page profile-page--progressive" aria-busy="true">
      <div class="profile-shell">
        ${renderHero({ profileLeagueContext, livePlayer, currentSeason, displayNick, currentRank, topSeason })}
        ${renderRankProgress({ progress: getRankProgress(profilePoints), currentRank })}
        ${renderCompactStats({ livePlayer, topSeason })}
        ${renderPerformanceSnapshot({ livePlayer, topSeason })}
        <section class="profile-section profile-career-loading" role="status" aria-live="polite">
          <div>
            <p class="profile-career-loading__eyebrow">Історія гравця</p>
            <h2 class="profile-section__title">Завантажуємо сезони</h2>
            <p class="profile-muted">Поточні результати вже доступні. Додаємо архів і досягнення.</p>
          </div>
          <div class="profile-career-loading__signal" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
        </section>
      </div>
    </section>`;
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
  const normalized = String(label ?? '').toLowerCase();
  if (normalized.includes('літо')) return 0;
  if (normalized.includes('осінь')) return 1;
  if (normalized.includes('зима')) return 2;
  if (normalized.includes('весна')) return 3;
  return 99;
}

function getRankProgress(points) {
  const pointsValue = num(points);

  if (pointsValue === null) {
    return { percent: 0, currentRank: null, currentMin: 0, nextMin: null, remain: null, nextRank: null, isMax: false, isValid: false };
  }

  const progress = getNextRankProgress(pointsValue);

  return {
    percent: progress.progress * 100,
    currentRank: progress.currentRank,
    currentMin: progress.currentMin,
    nextMin: progress.nextMin,
    remain: progress.pointsToNext,
    nextRank: progress.nextRank,
    isMax: progress.isMaxRank,
    isValid: true
  };
}

function metricMini({ label, value, tone = '' }) {
  return `<article class="profile-metric ${tone}"><strong>${esc(val(value))}</strong><span>${esc(label)}</span></article>`;
}

function renderRankProgress({ progress, currentRank }) {
  const safePercent = Math.max(0, Math.min(100, Number(progress?.percent || 0)));
  const shownCurrentRank = progress?.currentRank || currentRank || '—';

  if (!progress?.isValid) {
    return `<div class="profile-rank-progress-card">
      <div class="profile-rank-progress-card__head">
        <span>Прогрес рангу</span>
        <strong>Дані рейтингу недоступні</strong>
      </div>
      <div class="profile-rank-progress-card__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span style="width:0%"></span></div>
      <p class="profile-note">Потрібні коректні очки, щоб показати прогрес до наступного рангу.</p>
    </div>`;
  }

  if (progress.isMax) {
    return `<div class="profile-rank-progress-card is-max">
      <div class="profile-rank-progress-card__head">
        <span>Прогрес рангу</span>
        <strong>Максимальний ранг</strong>
      </div>
      <div class="profile-rank-progress-card__route"><strong>${esc(val(shownCurrentRank))}</strong><span>100%</span></div>
      <div class="profile-rank-progress-card__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><span style="width:100%"></span></div>
      <p class="profile-note">Максимальний ранг досягнуто.</p>
    </div>`;
  }

  return `<div class="profile-rank-progress-card">
    <div class="profile-rank-progress-card__head">
      <span>Прогрес рангу</span>
      <strong>${safePercent.toFixed(0)}% до ${esc(val(progress.nextRank))}</strong>
    </div>
    <div class="profile-rank-progress-card__route"><strong>${esc(val(shownCurrentRank))} → ${esc(val(progress.nextRank))}</strong><span>${safePercent.toFixed(0)}%</span></div>
    <div class="profile-rank-progress-card__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(safePercent)}"><span style="width:${safePercent.toFixed(1)}%"></span></div>
    <p class="profile-note">Ще ${esc(val(progress.remain))} ${pointsWord(progress.remain)} до рангу ${esc(val(progress.nextRank))}.</p>
  </div>`;
}

function renderShareProfileBlock({ displayNick, currentRank, points, profileLeagueContext }) {
  const safePoints = num(points);
  const leagueLabel = leagueLabelUA(profileLeagueContext);
  return `<section class="profile-section profile-share">
    <div class="profile-share__content">
      <div>
        <h2 class="profile-section__title">Поділитися профілем</h2>
        <p class="profile-muted">Коротке посилання на поточний профіль гравця.</p>
      </div>
      <div class="profile-share__summary" aria-label="Коротке резюме профілю">
        <span><small>Гравець</small><b>${esc(displayNick || 'Гравець')}</b></span>
        <span><small>Ранг</small><b>${esc(val(currentRank))}</b></span>
        <span><small>Очки</small><b>${safePoints === null ? '—' : esc(String(safePoints))}</b></span>
        <span><small>Ліга</small><b>${esc(leagueLabel)}</b></span>
      </div>
    </div>
    <div class="profile-share__actions">
      <button type="button" class="btn profile-share__copy" id="profileCopyLinkBtn">Скопіювати посилання</button>
      <p class="profile-share__status" id="profileShareStatus" aria-live="polite"></p>
    </div>
  </section>`;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const input = document.createElement('input');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  input.style.top = '0';
  document.body.append(input);
  input.select();
  input.setSelectionRange(0, input.value.length);
  const ok = document.execCommand('copy');
  input.remove();
  return ok;
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
  return `<section class="profile-section profile-achievements"><h2 class="profile-section__title">Досягнення карʼєри</h2><div class="profile-achievement-grid">${cards.map((item) => `<article class="profile-achievement"><div class="profile-achievement__icon">${item.icon}</div><div class="profile-achievement__value">${esc(item.value)}</div><div class="profile-achievement__label">${esc(item.label)}</div><div class="profile-achievement__season">${esc(item.season)}</div></article>`).join('')}</div></section>`;
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
  const seasonLabel = formatSeasonTitleUA(currentSeason?.uiLabel ?? topSeason?.seasonTitle ?? 'Поточний сезон');
  const leagueLabel = leagueLabelUA(profileLeagueContext);
  const safePoints = num(points);

  return `
    <article class="profile-section profile-hero ${rankClass(currentRank)}">
      <a class="btn btn--secondary profile-hero__back" href="${buildHash('league-stats', { league: normalizeLeagueKey(profileLeagueContext) })}">← До ліги</a>
      <div class="profile-hero__top">
        <div class="profile-avatar-frame ${rankClass(currentRank)}">
          <img class="avatar" src="${esc(topSeason?.avatar ?? livePlayer?.avatarUrl ?? placeholder)}" alt="${esc(displayNick || 'Аватар гравця')}" onerror="this.onerror=null;this.src='${placeholder}'">
        </div>
        <div class="profile-meta">
          <h1 class="name">${esc(displayNick)}</h1>
          <p class="profile-hero__meta">${esc(leagueLabel)} · ${esc(seasonLabel)}</p>
          <div class="profile-hero__status">
            <span class="profile-status-badge profile-status-badge--place">${num(place) !== null ? `#${place} місце` : 'Місце —'}</span>
            <span class="profile-status-badge profile-status-badge--rank">Ранг ${esc(val(currentRank))}</span>
          </div>
        </div>
        <div class="profile-hero__score">
          <strong>${safePoints === null ? '—' : esc(String(safePoints))}</strong>
          <span>очок</span>
        </div>
      </div>
    </article>
  `;
}

function renderCompactStats({ livePlayer, topSeason }) {
  const wr = livePlayer?.winRate ?? topSeason?.winRate ?? topSeason?.winrate;
  const delta = livePlayer?.delta ?? topSeason?.delta ?? topSeason?.ratingDelta;
  return `
    <section class="profile-section profile-priority-main">
      <h2 class="profile-section__title">Ключові метрики</h2>
      <div class="profile-metrics-grid">
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
    <section class="profile-section profile-analytics profile-priority-analytics">
      <h2 class="profile-section__title">Аналіз гри</h2>
      <article class="profile-wr-panel">
        <div class="profile-wr-panel__head">
          <p>Winrate</p>
          <strong class="${wrTone(wr)}">${pct(wr)}</strong>
        </div>
        <div class="profile-wr-bar ${wrTone(wr)}"><span style="width:${Math.max(0, Math.min(100, num(wr) ?? 0))}%"></span></div>
      </article>

      <div class="profile-analytics-grid">
        ${metricMini({ label: 'Перемоги', value: wins, tone: 'is-good' })}
        ${metricMini({ label: 'Поразки', value: losses, tone: 'is-bad' })}
        ${metricMini({ label: 'Нічиї', value: draws, tone: 'is-mid' })}
      </div>

      <div class="profile-analytics-grid">
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

      <div class="profile-insights">
        <article class="profile-insight">
          <h3>Сильні сторони</h3>
          <ul>${(insights.strengths.length ? insights.strengths : ['Стабільна база для подальшого росту']).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
        </article>
        <article class="profile-insight">
          <h3>Зони росту</h3>
          <ul>${(insights.growth.length ? insights.growth : ['Підтримувати поточний темп гри']).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
        </article>
      </div>

      <article class="profile-insight profile-profile-card">
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

function mvpRoleLabel(mvpTotal, games) {
  const mvp = num(mvpTotal) ?? 0;
  const totalGames = num(games) ?? 0;
  const ratio = totalGames > 0 ? mvp / totalGames : 0;
  if (mvp >= 10 || ratio >= .35) return 'Перша роль';
  if (mvp >= 4 || ratio >= .15) return 'Стабільний impact';
  return 'Рідко MVP';
}

function renderPerformanceSnapshot({ livePlayer, topSeason }) {
  const wins = livePlayer?.wins ?? topSeason?.wins;
  const losses = livePlayer?.losses ?? topSeason?.losses;
  const draws = livePlayer?.draws ?? topSeason?.draws;
  const wr = livePlayer?.winRate ?? topSeason?.winRate ?? topSeason?.winrate;
  const games = livePlayer?.matches ?? topSeason?.matches;
  const battles = livePlayer?.battles ?? topSeason?.rounds;
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

  return `<section class="profile-section profile-performance">
    <h2 class="profile-section__title">Форма гравця</h2>
    <div class="profile-performance-grid">
      <article class="profile-performance-card">
        <span>Форма</span>
        <strong>${esc(insights.formLabel)}</strong>
      </article>
      <article class="profile-performance-card">
        <span>Баланс</span>
        <strong>${esc(val(wins, '0'))}В · ${esc(val(losses, '0'))}П · ${esc(val(draws, '0'))}Н</strong>
      </article>
      <article class="profile-performance-card">
        <span>Активність</span>
        <strong>${esc(val(games ?? insights.totalMatches, '0'))} ігор · ${esc(val(battles, '0'))} боїв</strong>
      </article>
      <article class="profile-performance-card">
        <span>Вплив</span>
        <strong>${meterLabel(insights.impactLevel)}</strong>
      </article>
    </div>
  </section>`;
}

function renderPlayerAnalysis({ livePlayer, topSeason }) {
  const games = livePlayer?.matches ?? topSeason?.matches;
  const wr = livePlayer?.winRate ?? topSeason?.winRate ?? topSeason?.winrate;
  const mvpTotal = livePlayer?.mvpTotal ?? topSeason?.mvpTotal;
  const delta = livePlayer?.delta ?? topSeason?.delta ?? topSeason?.ratingDelta;
  const insights = resolveGameplayInsights({
    wins: livePlayer?.wins ?? topSeason?.wins,
    losses: livePlayer?.losses ?? topSeason?.losses,
    draws: livePlayer?.draws ?? topSeason?.draws,
    wr,
    mvp: mvpTotal,
    delta,
    place: livePlayer?.place ?? topSeason?.place ?? topSeason?.finalPlace,
    games
  });
  const analysisText = insights.impactLevel === 'high'
    ? 'Гравець тримає сильний темп сезону: помітний вплив у MVP, хороший приріст і стабільна присутність у грі.'
    : 'Гравець має базу для росту: варто тримати ритм і збільшувати вплив у ключових матчах.';
  const strengths = insights.strengths.length ? insights.strengths : ['Підтримує стабільну базу для росту'];
  const growth = insights.growth.length ? insights.growth : ['Підтримувати поточний темп гри'];

  return `<section class="profile-section profile-analysis-v3">
    <h2 class="profile-section__title">Профіль гравця</h2>
    <p class="profile-analysis-line">${esc(insights.playStyle)} стиль · ${esc(insights.activityLevel.toLowerCase())} активність · ${esc(mvpRoleLabel(mvpTotal, games))}</p>
    <p class="profile-analysis-note">${esc(analysisText)}</p>
    <div class="profile-analysis-lists">
      <div>
        <h3>Сильні сторони</h3>
        <ul>${strengths.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
      </div>
      <div>
        <h3>Зони росту</h3>
        <ul>${growth.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
      </div>
    </div>
  </section>`;
}

function seasonChronologyKey(season = {}) {
  const source = `${season.seasonId || ''} ${season.seasonTitle || ''}`.toLowerCase();
  const yearMatch = source.match(/20\d{2}/);
  const year = yearMatch ? Number(yearMatch[0]) : 9999;
  let order = 9;
  if (source.includes('spring') || source.includes('весна')) order = 1;
  else if (source.includes('summer') || source.includes('літо')) order = 2;
  else if (source.includes('autumn') || source.includes('fall') || source.includes('осінь')) order = 3;
  else if (source.includes('winter') || source.includes('зима')) order = 4;
  return (year * 10) + order;
}

function renderCareerMetricChart(rows = [], metric = 'points') {
  const configs = {
    points: { key: 'points', label: 'Рейтинг', suffix: ' очок', invert: false },
    place: { key: 'place', label: 'Місце', suffix: ' місце', invert: true },
    delta: { key: 'delta', label: 'Приріст', suffix: ' рейтингу', invert: false }
  };
  const config = configs[metric] || configs.points;
  const chartRows = rows.filter((row) => Number.isFinite(row[config.key]) && (!config.invert || row[config.key] > 0));
  if (!chartRows.length) return '<p class="profile-career-empty">Для цього показника ще немає даних.</p>';

  const values = chartRows.map((row) => row[config.key]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const width = 320;
  const height = 104;
  const padX = 18;
  const padTop = 14;
  const padBottom = 22;
  const usableHeight = height - padTop - padBottom;
  const points = chartRows.map((row, index) => {
    const value = row[config.key];
    const x = chartRows.length === 1
      ? width / 2
      : padX + (index * ((width - (padX * 2)) / (chartRows.length - 1)));
    const ratio = maxValue === minValue
      ? .5
      : (config.invert ? (value - minValue) : (maxValue - value)) / (maxValue - minValue);
    const y = padTop + (ratio * usableHeight);
    return { ...row, value, x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ');
  const areaPath = `M ${points[0].x} ${height - padBottom} L ${polyline.replaceAll(',', ' ')} L ${points[points.length - 1].x} ${height - padBottom} Z`;
  const gradientId = `profileCareerArea-${config.key}`;

  return `<svg class="profile-career-chart profile-career-chart--${config.key}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${esc(config.label)} за сезонами">
    <defs>
      <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#72ff9a" stop-opacity=".28"></stop>
        <stop offset="1" stop-color="#55d8ff" stop-opacity=".02"></stop>
      </linearGradient>
    </defs>
    <path class="profile-career-chart__area" style="fill:url(#${gradientId})" d="${areaPath}"></path>
    ${points.length > 1 ? `<polyline class="profile-career-chart__line" points="${polyline}"></polyline>` : ''}
    ${points.map((point) => `<g class="profile-career-chart__point ${point.current ? 'is-current' : ''}">
      <circle cx="${point.x}" cy="${point.y}" r="${point.current ? 4.4 : 3.4}"><title>${esc(point.label)}: ${esc(String(point.value))}${esc(config.suffix)}</title></circle>
      <text x="${point.x}" y="${height - 6}" text-anchor="middle">${esc(String(point.label).replace(/\s*20\d{2}(?:[–-]20\d{2})?/, ''))}</text>
    </g>`).join('')}
  </svg>`;
}

function careerMetricInsight(rows = [], metric = 'points') {
  const available = rows.filter((row) => Number.isFinite(row[metric]) && (metric !== 'place' || row.place > 0));
  if (!available.length) return 'Для цього показника ще немає даних.';
  if (metric === 'place') {
    const best = [...available].sort((a, b) => a.place - b.place)[0];
    return `Найкращий фініш: ${best.label}, #${best.place}.`;
  }
  if (metric === 'delta') {
    const best = [...available].sort((a, b) => b.delta - a.delta)[0];
    return `Найсильніший ривок: ${best.label}, ${signed(best.delta)} рейтингу.`;
  }
  const best = [...available].sort((a, b) => b.points - a.points)[0];
  return `Піковий рейтинг: ${best.label}, ${best.points} очок.`;
}

function bindCareerMetricSwitch(root) {
  const section = root?.querySelector('.profile-career-dynamics');
  const chartHost = section?.querySelector('[data-career-chart]');
  const insight = section?.querySelector('[data-career-insight]');
  const buttons = section?.querySelectorAll('[data-career-metric]');
  if (!section || !chartHost || !insight || !buttons?.length) return;

  const rows = [...section.querySelectorAll('.profile-career-season')].map((item) => ({
    label: item.dataset.careerLabel || '',
    points: num(item.dataset.careerPoints),
    place: num(item.dataset.careerPlace),
    delta: num(item.dataset.careerDelta),
    current: item.classList.contains('is-current')
  }));

  buttons.forEach((button) => button.addEventListener('click', () => {
    const metric = button.dataset.careerMetric || 'points';
    buttons.forEach((item) => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    chartHost.innerHTML = renderCareerMetricChart(rows, metric);
    insight.textContent = careerMetricInsight(rows, metric);
  }));
}

function renderCareerDynamics({ seasons = [], allTime = {}, currentSeasonId = '' } = {}) {
  const rows = (Array.isArray(seasons) ? seasons : [])
    .map((season) => ({
      id: String(season.seasonId || ''),
      label: formatSeasonTitleUA(season.seasonTitle || season.seasonId),
      points: num(season.ratingEnd ?? season.points),
      delta: num(season.delta ?? season.ratingDelta),
      matches: num(season.matches ?? season.games),
      winRate: num(season.winRate ?? season.winrate),
      mvp: num(season.mvpTotal),
      place: num(season.place ?? season.finalPlace),
      rank: String(season.rank || '').trim().toUpperCase(),
      order: seasonChronologyKey(season),
      current: Boolean(currentSeasonId && season.seasonId === currentSeasonId)
    }))
    .filter((row) => [row.points, row.delta, row.matches, row.winRate, row.mvp, row.place].some((value) => value !== null))
    .sort((a, b) => a.order - b.order);

  if (!rows.length) return '';

  const chartRows = rows.filter((row) => row.points !== null);
  const chartValues = chartRows.map((row) => row.points);
  const minValue = chartValues.length ? Math.min(...chartValues) : 0;
  const maxValue = chartValues.length ? Math.max(...chartValues) : 0;
  const chartWidth = 320;
  const chartHeight = 104;
  const padX = 18;
  const padTop = 14;
  const padBottom = 22;
  const usableHeight = chartHeight - padTop - padBottom;
  const chartPoints = chartRows.map((row, index) => {
    const x = chartRows.length === 1
      ? chartWidth / 2
      : padX + (index * ((chartWidth - (padX * 2)) / (chartRows.length - 1)));
    const y = maxValue === minValue
      ? padTop + (usableHeight / 2)
      : padTop + (((maxValue - row.points) / (maxValue - minValue)) * usableHeight);
    return { ...row, x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });
  const polyline = chartPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const areaPath = chartPoints.length
    ? `M ${chartPoints[0].x} ${chartHeight - padBottom} L ${polyline.replaceAll(',', ' ')} L ${chartPoints[chartPoints.length - 1].x} ${chartHeight - padBottom} Z`
    : '';
  const totalMatches = num(allTime.totalMatches ?? allTime.matches ?? allTime.games)
    ?? rows.reduce((sum, row) => sum + (row.matches ?? 0), 0);
  const cumulativeDelta = num(allTime.cumulativeDelta)
    ?? rows.reduce((sum, row) => sum + (row.delta ?? 0), 0);
  const bestPlace = rows.reduce((best, row) => {
    if (row.place === null || row.place <= 0) return best;
    return best === null || row.place < best ? row.place : best;
  }, null);
  const insight = careerMetricInsight(rows, 'points');

  const chartMarkup = chartPoints.length
    ? `<svg class="profile-career-chart" viewBox="0 0 ${chartWidth} ${chartHeight}" preserveAspectRatio="none" role="img" aria-label="Фінішний рейтинг за сезонами">
        <defs>
          <linearGradient id="profileCareerArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#72ff9a" stop-opacity=".28"></stop>
            <stop offset="1" stop-color="#55d8ff" stop-opacity=".02"></stop>
          </linearGradient>
        </defs>
        <path class="profile-career-chart__area" d="${areaPath}"></path>
        ${chartPoints.length > 1 ? `<polyline class="profile-career-chart__line" points="${polyline}"></polyline>` : ''}
        ${chartPoints.map((point) => `<g class="profile-career-chart__point ${point.current ? 'is-current' : ''}">
          <circle cx="${point.x}" cy="${point.y}" r="${point.current ? 4.4 : 3.4}"><title>${esc(point.label)}: ${point.points} очок</title></circle>
          <text x="${point.x}" y="${chartHeight - 6}" text-anchor="middle">${esc(String(point.label).replace(/\s*20\d{2}(?:[–-]20\d{2})?/, ''))}</text>
        </g>`).join('')}
      </svg>`
    : '<p class="profile-career-empty">Фінішний рейтинг з’явиться після завершення сезону.</p>';

  return `<section class="profile-section profile-career-dynamics">
    <div class="profile-career-dynamics__head">
      <div>
        <h2 class="profile-section__title">Динаміка кар’єри</h2>
        <p>Фінішний рейтинг і результат кожного сезону</p>
      </div>
      <strong class="${deltaTone(cumulativeDelta)}">${esc(signed(cumulativeDelta))}</strong>
    </div>

    <div class="profile-career-overview" aria-label="Підсумок кар’єри">
      <span><b>${rows.length}</b><small>сезонів</small></span>
      <span><b>${esc(String(totalMatches))}</b><small>ігор</small></span>
      <span><b>${bestPlace === null ? '—' : `#${bestPlace}`}</b><small>краще місце</small></span>
      <span><b>${esc(signed(cumulativeDelta))}</b><small>рух рейтингу</small></span>
    </div>

    <div class="profile-career-metric-switch" role="group" aria-label="Показник графіка">
      <button type="button" class="is-active" data-career-metric="points" aria-pressed="true">Рейтинг</button>
      <button type="button" data-career-metric="place" aria-pressed="false">Місце</button>
      <button type="button" data-career-metric="delta" aria-pressed="false">Приріст</button>
    </div>

    <div class="profile-career-visual">
      <div data-career-chart>${chartMarkup}</div>
      <p class="profile-career-insight" data-career-insight>${esc(insight)}</p>
    </div>

    <div class="profile-career-timeline" aria-label="Результати за сезонами">
      ${rows.map((row, index) => `<article class="profile-career-season ${row.current ? 'is-current' : ''}" data-career-label="${esc(row.label)}" data-career-points="${row.points ?? ''}" data-career-place="${row.place ?? ''}" data-career-delta="${row.delta ?? ''}">
        <div class="profile-career-season__identity">
          <span>${String(index + 1).padStart(2, '0')}</span>
          <div><strong>${esc(row.label)}</strong>${row.current ? '<small>поточний сезон</small>' : ''}</div>
        </div>
        <div class="profile-career-season__result">
          <strong>${row.points === null ? '—' : esc(String(row.points))}</strong><small>очок</small>
        </div>
        <div class="profile-career-season__meta">
          <span class="${deltaTone(row.delta)}">${esc(signed(row.delta))} Δ</span>
          <span>${row.place === null ? 'місце —' : `#${row.place} місце`}</span>
          <span>${row.winRate === null ? 'WR —' : `${row.winRate.toFixed(1)}% WR`}</span>
          <span>${row.matches === null ? 'ігри —' : `${row.matches} ігор`}</span>
          <span>${row.mvp === null ? 'MVP —' : `${row.mvp} MVP`}</span>
          ${row.rank ? `<b class="profile-career-rank ${rankClass(row.rank)}">${esc(row.rank)}</b>` : ''}
        </div>
      </article>`).join('')}
    </div>
  </section>`;
}

function renderSeasonTabs(container, tabs, selectedId) {
  const tabsMarkup = tabs.map((tab) => `
    <button
      type="button"
      class="profile-season-tab ${tab.id === selectedId ? 'is-active' : ''}"
      data-season-id="${esc(tab.id)}"
      role="tab"
      aria-selected="${tab.id === selectedId ? 'true' : 'false'}"
    >
      <span class="profile-season-tab__title">${esc(tab.label)}</span>
      ${tab.current ? '<em class="profile-season-tab__meta">поточний</em>' : ''}
    </button>
  `).join('');

  container.innerHTML = `<div class="profile-season-tabs__track" role="tablist" aria-label="Сезони">${tabsMarkup}</div>`;

  const activeTab = container.querySelector('.profile-season-tab.is-active');
  activeTab?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function renderSeasonSummary(season, allTime) {
  if (!season) {
    return '<section class="profile-season-panel"><h3>Сезон</h3><p class="profile-muted">Немає даних сезону.</p></section>';
  }

  const seasonWr = season.winRate ?? season.winrate;
  const seasonDelta = season.delta ?? season.ratingDelta;
  const start = season.ratingStart;
  const finish = season.ratingEnd ?? season.points;
  const trendWidth = Math.min(100, Math.max(8, num(seasonDelta) === null ? 8 : Math.abs(Number(seasonDelta)) / 2));

  return `
      <section class="profile-season-panel">
        <h3>${esc(formatSeasonTitleUA(season.seasonTitle ?? season.id))}</h3>
        <p class="profile-muted">${esc(leagueLabelUA(season.league ?? 'kids'))}</p>

        <div class="profile-season-grid">
          ${metricMini({ label: 'Старт', value: start })}
          ${metricMini({ label: 'Фініш', value: finish, tone: 'is-accent' })}
          ${metricMini({ label: 'Δ', value: signed(seasonDelta), tone: deltaTone(seasonDelta) })}
          ${metricMini({ label: 'WR', value: pct(seasonWr), tone: wrTone(seasonWr) })}
          ${metricMini({ label: 'Ігри', value: season.matches ?? season.games })}
          ${metricMini({ label: 'MVP', value: season.mvpTotal })}
          ${metricMini({ label: 'Ранг', value: season.rank, tone: 'is-accent' })}
          ${metricMini({ label: 'Місце', value: num(season.place ?? season.finalPlace) !== null ? `#${season.place ?? season.finalPlace}` : '—' })}
        </div>

        <div class="profile-season-grid profile-season-grid--compact">
          ${metricMini({ label: 'Перемоги', value: season.wins, tone: 'is-good' })}
          ${metricMini({ label: 'Поразки', value: season.losses, tone: 'is-bad' })}
          ${metricMini({ label: 'Нічиї', value: season.draws, tone: 'is-mid' })}
        </div>

        <div class="profile-season-progress">
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
    return '';
  }

  return `<details class="profile-logs">
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
                <div class="profile-log-item__teams">${entry.teams.map((team, idx) => `<span>К${idx + 1}: ${esc(team.join(', ') ?? '—')}</span>`).join('')}</div>
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
    const aParsed = Date.parse(a.dateFrom || '');
    const bParsed = Date.parse(b.dateFrom || '');
    const hasADate = Number.isFinite(aParsed);
    const hasBDate = Number.isFinite(bParsed);
    if (hasADate && hasBDate && aParsed !== bParsed) return aParsed - bParsed;
    if (hasADate !== hasBDate) return hasADate ? -1 : 1;
    return seasonOrderKey(a.label) - seasonOrderKey(b.label);
  });
}

function buildCurrentSeasonRow(livePlayer, currentSeason, league) {
  if (!livePlayer || !currentSeason?.id) return null;
  const matches = num(livePlayer.matches) ?? 0;
  const battles = num(livePlayer.battles) ?? 0;
  if (matches <= 0 && battles <= 0 && livePlayer.isSeasonActive !== true) return null;

  const ratingEnd = num(livePlayer.points);
  const delta = num(livePlayer.delta);
  const mvp1 = num(livePlayer.mvp1) ?? 0;
  const mvp2 = num(livePlayer.mvp2) ?? 0;
  const mvp3 = num(livePlayer.mvp3) ?? 0;

  return {
    seasonId: currentSeason.id,
    seasonTitle: currentSeason.uiLabel || currentSeason.label || currentSeason.id,
    league,
    leagueLabel: leagueLabelUA(league),
    ratingStart: ratingEnd !== null && delta !== null ? ratingEnd - delta : null,
    ratingEnd,
    points: ratingEnd,
    delta,
    ratingDelta: delta,
    matches,
    games: matches,
    wins: num(livePlayer.wins) ?? 0,
    losses: num(livePlayer.losses) ?? 0,
    draws: num(livePlayer.draws) ?? 0,
    winRate: num(livePlayer.winRate),
    winrate: num(livePlayer.winRate),
    mvp1,
    mvp2,
    mvp3,
    top1: mvp1,
    top2: mvp2,
    top3: mvp3,
    mvpTotal: num(livePlayer.mvpTotal) ?? (mvp1 + mvp2 + mvp3),
    rank: livePlayer.rankLetter || null,
    place: num(livePlayer.place),
    finalPlace: num(livePlayer.place),
    rounds: battles
  };
}

function addCurrentSeasonToAllTime(allTime = {}, currentSeasonRow = null, alreadyIncluded = false) {
  if (!currentSeasonRow || alreadyIncluded) return allTime || {};
  const base = allTime || {};
  const matches = (num(base.totalMatches ?? base.matches ?? base.games) ?? 0) + (num(currentSeasonRow.matches) ?? 0);
  const wins = (num(base.totalWins ?? base.wins) ?? 0) + (num(currentSeasonRow.wins) ?? 0);
  const losses = (num(base.totalLosses ?? base.losses) ?? 0) + (num(currentSeasonRow.losses) ?? 0);
  const draws = (num(base.totalDraws ?? base.draws) ?? 0) + (num(currentSeasonRow.draws) ?? 0);
  const top1 = (num(base.top1) ?? 0) + (num(currentSeasonRow.mvp1) ?? 0);
  const top2 = (num(base.top2) ?? 0) + (num(currentSeasonRow.mvp2) ?? 0);
  const top3 = (num(base.top3) ?? 0) + (num(currentSeasonRow.mvp3) ?? 0);
  const mvpTotal = top1 + top2 + top3;
  const winrate = matches > 0 ? Number(((wins / matches) * 100).toFixed(1)) : null;

  return {
    ...base,
    games: matches,
    matches,
    totalMatches: matches,
    wins,
    totalWins: wins,
    losses,
    totalLosses: losses,
    draws,
    totalDraws: draws,
    top1,
    top2,
    top3,
    mvpTotal,
    totalMvp: mvpTotal,
    winrate,
    careerWR: winrate,
    cumulativeDelta: (num(base.cumulativeDelta) ?? 0) + (num(currentSeasonRow.delta) ?? 0),
    seasonsPlayed: (num(base.seasonsPlayed) ?? 0) + 1
  };
}

export async function initProfilePage(params = {}) {
  const root = document.getElementById('profileRoot') || document.getElementById('view');
  if (!root) return;

  const { nick, league, profileLeagueContext: routeLeagueContext } = resolveParams(params);
  if (!nick) {
    root.innerHTML = `<section class="profile-page"><div class="profile-shell"><section class="profile-section"><h1 class="profile-section__title">Профіль гравця</h1><p class="profile-muted">Не вказано нікнейм гравця.</p><div class="profile-actions"><a class="btn btn--secondary" href="${buildHash('league-stats', { league })}">Назад до ліги</a></div></section></div></section>`;
    return;
  }

  renderSkeleton(root);

  try {
    const profilePromise = buildPlayerCareer(nick, { profileLeagueContext: routeLeagueContext });
    const liveStatsPromise = getCurrentLeagueLiveStats(league);
    const currentSeasonPromise = getCurrentSeason();
    const seasonOptionsPromise = getSeasonsList();
    const [liveStatsResult, currentSeasonResult] = await Promise.allSettled([
      liveStatsPromise,
      currentSeasonPromise
    ]);
    const liveStats = liveStatsResult.status === 'fulfilled' ? liveStatsResult.value : null;
    const currentSeason = currentSeasonResult.status === 'fulfilled' ? currentSeasonResult.value : null;
    const normalizedNick = normalizePlayerKey(nick);
    const livePlayer = (liveStats?.players || []).find((player) => normalizePlayerKey(player.nickname) === normalizedNick) || null;

    if (livePlayer) {
      const previewLeagueContext = normalizeLeague(
        routeLeagueContext
        || livePlayer.league
        || league
      ) || 'kids';
      const previewRank = String(livePlayer.rankLetter || 'F').toUpperCase();
      renderLiveProfilePreview(root, {
        profileLeagueContext: previewLeagueContext,
        livePlayer,
        currentSeason,
        displayNick: livePlayer.nickname || nick,
        currentRank: previewRank
      });
    }

    const [profileResult, seasonOptionsResult] = await Promise.allSettled([
      profilePromise,
      seasonOptionsPromise
    ]);
    const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
    const seasonOptions = seasonOptionsResult.status === 'fulfilled' ? seasonOptionsResult.value : [];

    if (!profile && !livePlayer) {
      root.innerHTML = `<section class="profile-page"><div class="profile-shell"><section class="profile-section"><h1 class="profile-section__title">Профіль гравця</h1><p class="profile-muted">Гравця не знайдено.</p><div class="profile-actions"><a class="btn btn--secondary" href="${buildHash('league-stats', { league })}">Назад до ліги</a></div></section></div></section>`;
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
    const archivedSeasonRows = profile?.seasons || [];
    const currentSeasonRow = buildCurrentSeasonRow(livePlayer, currentSeason, profileLeagueContext);
    const currentSeasonAlreadyArchived = archivedSeasonRows.some((row) => row.seasonId === currentSeasonRow?.seasonId);
    const seasonRows = currentSeasonRow
      ? [currentSeasonRow, ...archivedSeasonRows.filter((row) => row.seasonId !== currentSeasonRow.seasonId)]
      : archivedSeasonRows;
    const allTimeStats = addCurrentSeasonToAllTime(profile?.allTime || {}, currentSeasonRow, currentSeasonAlreadyArchived);
    const seasonRowsById = new Map(seasonRows.map((row) => [row.seasonId, row]));
    const topSeason = seasonRows[0] || {};
    const currentRank = String(livePlayer?.rankLetter || topSeason?.rank || profile?.allTime?.bestRank || 'F').toUpperCase();
    const profilePoints = livePlayer?.points ?? topSeason?.ratingEnd ?? topSeason?.points;
    const rankProgress = getRankProgress(profilePoints);

    root.innerHTML = `
      <section class="profile-page">
        <div class="profile-shell">
        ${renderHero({ profileLeagueContext, livePlayer: livePlayer || {}, currentSeason, displayNick, currentRank, topSeason })}
        ${renderRankProgress({ progress: rankProgress, currentRank })}
        ${renderCompactStats({ livePlayer: livePlayer || {}, topSeason })}
        ${renderCareerDynamics({ seasons: seasonRows, allTime: allTimeStats, currentSeasonId: currentSeason?.id })}
        ${renderPerformanceSnapshot({ livePlayer: livePlayer || {}, topSeason })}
        ${renderPlayerAnalysis({ livePlayer: livePlayer || {}, topSeason })}
        ${renderCareerHighlights(profile?.highlights || {})}

        <section class="profile-section profile-priority-history">
          <h2 class="profile-section__title">Детальна статистика</h2>
          <div class="profile-season-tabs" id="seasonTabs"></div>
          <div id="seasonSummaryHost"></div>
          <div id="seasonLogsHost"></div>
        </section>
        ${renderShareProfileBlock({
    displayNick,
    currentRank,
    points: profilePoints,
    profileLeagueContext
  })}
        </div>
      </section>
    `;

    const seasonTabsEl = root.querySelector('#seasonTabs');
    const summaryEl = root.querySelector('#seasonSummaryHost');
    const logsEl = root.querySelector('#seasonLogsHost');
    const copyLinkBtn = root.querySelector('#profileCopyLinkBtn');
    const shareStatus = root.querySelector('#profileShareStatus');
    bindCareerMetricSwitch(root);

    copyLinkBtn?.addEventListener('click', async () => {
      const shareUrl = window.location.href;
      try {
        const copied = await copyTextToClipboard(shareUrl);
        if (!copied) throw new Error('copy failed');
        if (shareStatus) shareStatus.textContent = 'Посилання скопійовано';
      } catch {
        if (shareStatus) shareStatus.textContent = 'Не вдалося скопіювати посилання';
      }
    });

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

    let renderToken = 0;
    const renderState = async () => {
      const token = ++renderToken;
      renderSeasonTabs(seasonTabsEl, tabs, state.seasonId);
      const selectedSeason = seasonRowsById.get(state.seasonId);
      summaryEl.innerHTML = renderSeasonSummary(selectedSeason, allTimeStats);

      if (!state.seasonId) {
        logsEl.innerHTML = '<section class="profile-logs"><h3>Логи сезону</h3><p>Немає доступних сезонів для цього гравця.</p></section>';
        return;
      }

      logsEl.innerHTML = '<p class="profile-muted">Завантаження логів сезону…</p>';
      try {
        const logData = await getPlayerSeasonLogs({ nick: displayNick, seasonId: state.seasonId });
        if (token === renderToken) logsEl.innerHTML = renderLogs(logData);
      } catch (error) {
        if (token === renderToken) {
          logsEl.innerHTML = `<p class="profile-muted">${esc(safeErrorMessage(error, 'Логи сезону тимчасово недоступні'))}</p>`;
        }
      }
    };

    seasonTabsEl.addEventListener('click', (event) => {
      const tab = event.target.closest('button[data-season-id]');
      if (!tab) return;
      state.seasonId = tab.dataset.seasonId;
      renderState();
    });

    renderState();
  } catch (error) {
    renderPageError(root, {
      eyebrow: 'Профіль гравця',
      title: nick,
      message: safeErrorMessage(error, 'Дані гравця тимчасово недоступні.'),
      backHref: buildHash('league-stats', { league }),
      backLabel: 'До ліги',
      onRetry: () => initProfilePage(params)
    });
  }
}
