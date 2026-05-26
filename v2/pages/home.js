import { getCurrentLeagueLiveStats, rankFromPoints, safeErrorMessage } from '../core/dataHub.js';
import { leagueLabelUA } from '../core/naming.js';
import { loadTournamentsList, getTournamentFormatLabel, formatTournamentDate } from './tournaments.js';
import { makeDataStatus, resolveDataStatusTone } from '../core/dataStatus.js';

const FALLBACK_AVATAR = './assets/default-avatar.svg';
const RANKS = [
  ['S', 1200, 'Еліта сезону'],
  ['A', 1000, 'Стабільні лідери'],
  ['B', 800, 'Верхня сітка'],
  ['C', 600, 'Сильна база'],
  ['D', 400, 'Вхід у ритм'],
  ['E', 200, 'Перший досвід'],
  ['F', 0, 'Старт']
];

function esc(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rankKey(rank = 'F') {
  return String(rank || 'F').trim().toUpperCase();
}

function playerRank(player = {}) {
  return rankKey(player.rankLetter || player.rank || rankFromPoints(n(player.points)));
}

function profileHref(league, nickname) {
  const safeLeague = String(league || '').trim();
  const safeNickname = String(nickname || '').trim();
  if (!safeLeague || !safeNickname) return '#main';
  return `#player?league=${encodeURIComponent(safeLeague)}&nick=${encodeURIComponent(safeNickname)}`;
}

function formatDateTime(value = '') {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'оновлення перевіряється';
  return date.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function avatar(player = {}) {
  return esc(player.avatarUrl || player.avatar || FALLBACK_AVATAR);
}

function sortedActive(live = {}) {
  const source = Array.isArray(live.activePlayers) ? live.activePlayers : live.players || [];
  return source
    .filter((player) => player && (player.isSeasonActive !== false || n(player.matches) > 0))
    .sort((a, b) => n(b.points) - n(a.points) || n(b.wins) - n(a.wins) || String(a.nickname || '').localeCompare(String(b.nickname || ''), 'uk'));
}

function getLeagueStatus(...lives) {
  const status = lives
    .map((live) => live?.dataStatus)
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.updatedAt || '') - Date.parse(a.updatedAt || ''))[0];
  return makeDataStatus(status || { source: 'unknown', ok: false, message: 'Дані ще синхронізуються' });
}

function countRanks(players = []) {
  const counts = Object.fromEntries(RANKS.map(([rank]) => [rank, 0]));
  players.forEach((player) => {
    const rank = playerRank(player);
    counts[rank] = (counts[rank] || 0) + 1;
  });
  return counts;
}

function pickLatestGameDay(lives = []) {
  return lives
    .map((live) => ({ ...live?.lastGameDay, league: live?.league }))
    .filter((day) => day?.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
}

function aggregate(adultsLive, kidsLive) {
  const adults = sortedActive(adultsLive);
  const kids = sortedActive(kidsLive);
  const players = [...adults, ...kids];
  const summary = [adultsLive, kidsLive].reduce((acc, live) => {
    acc.players += n(live?.summary?.activePlayersCount, sortedActive(live).length);
    acc.matches += n(live?.summary?.matchesCount);
    acc.battles += n(live?.summary?.battlesCount);
    acc.mvp += n(live?.summary?.totalMvp);
    return acc;
  }, { players: 0, matches: 0, battles: 0, mvp: 0 });

  return {
    adults,
    kids,
    players,
    leaders: { adults: adults[0] || null, kids: kids[0] || null },
    summary,
    ranks: countRanks(players),
    latestDay: pickLatestGameDay([adultsLive, kidsLive]),
    status: getLeagueStatus(adultsLive, kidsLive)
  };
}

function rankBadge(rank) {
  const key = rankKey(rank);
  return `<span class="homex-rank homex-rank--${key}">${key}</span>`;
}

function metric(label, value, note = '') {
  return `<article class="homex-metric">
    <span>${esc(label)}</span>
    <strong>${esc(value)}</strong>
    ${note ? `<small>${esc(note)}</small>` : ''}
  </article>`;
}

function renderHero(model) {
  const { leaders, summary, latestDay, status } = model;
  const tone = resolveDataStatusTone(status);
  const lead = leaders.adults || leaders.kids || {};
  const leadRank = playerRank(lead);
  const leadName = lead.nickname || 'сезон триває';
  const latestLabel = latestDay?.date ? `${latestDay.date} / ${leagueLabelUA(latestDay.league)}` : 'ігровий день очікується';

  return `<section class="homex-hero" aria-label="Презентація рейтингової системи">
    <div class="homex-hero__copy">
      <p class="homex-kicker">VARTA CLUB / LIVE RATING</p>
      <h1>Командна гра, де кожен матч рухає рейтинг.</h1>
      <p class="homex-hero__lead">Лазертаг-ліга з живими таблицями, рангами, MVP, ігровими днями та турнірним режимом. Система показує не тільки хто перший, а чому саме він там: перемоги, активність, внесок у команду і форма сезону.</p>
      <div class="homex-actions">
        <a class="homex-btn homex-btn--primary" href="#league-stats?league=sundaygames">Доросла ліга</a>
        <a class="homex-btn" href="#league-stats?league=kids">Дитяча ліга</a>
        <a class="homex-btn" href="#rules">Як рахуються очки</a>
      </div>
    </div>
    <aside class="homex-hero__panel">
      <div class="homex-live-line"><span class="homex-live-dot"></span>${esc(tone.label)} / ${esc(formatDateTime(status.updatedAt))}</div>
      <a class="homex-feature-player homex-card-link" href="${profileHref(lead.league || 'sundaygames', lead.nickname)}">
        <img src="${avatar(lead)}" alt="${esc(leadName)}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_AVATAR}'">
        <span>
          <small>Лідер зараз</small>
          <strong>${esc(leadName)}</strong>
          <em>${n(lead.points)} очок · ${n(lead.matches)} ігор</em>
        </span>
        ${rankBadge(leadRank)}
      </a>
      <div class="homex-hero-metrics">
        ${metric('Активні гравці', summary.players, 'дві ліги')}
        ${metric('Матчі сезону', summary.matches, `${summary.battles} раундів`)}
        ${metric('MVP записів', summary.mvp, 'форма сезону')}
        ${metric('Останній день', latestLabel, latestDay?.mvp ? `MVP: ${latestDay.mvp}` : '')}
      </div>
    </aside>
  </section>`;
}

function renderLeaderCard(league, player, variant) {
  const label = leagueLabelUA(league);
  if (!player) {
    return `<article class="homex-leader homex-leader--${variant}">
      <p>${esc(label)}</p><strong>Дані накопичуються</strong><small>Після першого матчу тут буде лідер ліги.</small>
    </article>`;
  }
  const rank = playerRank(player);
  return `<a class="homex-leader homex-leader--${variant} homex-card-link" href="${profileHref(league, player.nickname)}">
    <p>${esc(label)}</p>
    <div class="homex-leader__main">
      <img src="${avatar(player)}" alt="${esc(player.nickname)}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_AVATAR}'">
      <span>
        <strong>${esc(player.nickname)}</strong>
        <small>${n(player.matches)} ігор · ${n(player.wins)} перемог · ${n(player.mvpTotal)} MVP · WR ${n(player.winRate).toFixed(1)}%</small>
      </span>
      ${rankBadge(rank)}
    </div>
    <b>${n(player.points)}<small> очок</small></b>
  </a>`;
}

function renderLeaders(model) {
  return `<section class="homex-section">
    <div class="homex-section__head">
      <p class="homex-kicker">SEASON FRONT</p>
      <h2>Хто веде гру зараз</h2>
      <span>Два окремі рейтинги, одна логіка сезону.</span>
    </div>
    <div class="homex-leaders">
      ${renderLeaderCard('sundaygames', model.leaders.adults, 'adults')}
      ${renderLeaderCard('kids', model.leaders.kids, 'kids')}
    </div>
  </section>`;
}

function renderLeagueTable(league, players = []) {
  const visible = players.slice(0, 8);
  const rows = visible.map((player, index) => {
    const rank = playerRank(player);
    return `<a class="homex-player-row homex-card-link" href="${profileHref(league, player.nickname)}">
      <span class="homex-place">#${index + 1}</span>
      ${rankBadge(rank)}
      <img src="${avatar(player)}" alt="${esc(player.nickname)}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_AVATAR}'">
      <span class="homex-player-row__name">
        <strong>${esc(player.nickname)}</strong>
        <small>${n(player.matches)} ігор · ${n(player.wins)}-${n(player.losses)} · ${n(player.mvpTotal)} MVP</small>
      </span>
      <b>${n(player.points)}</b>
    </a>`;
  }).join('');

  return `<article class="homex-league-card">
    <header>
      <span>${esc(leagueLabelUA(league))}</span>
      <a href="#league-stats?league=${encodeURIComponent(league)}">Вся таблиця</a>
    </header>
    <div class="homex-player-list">${rows || '<p class="homex-empty">Після синхронізації тут буде топ ліги.</p>'}</div>
  </article>`;
}

function renderLeagues(model) {
  return `<section class="homex-section" id="ratings">
    <div class="homex-section__head">
      <p class="homex-kicker">RATING TABLES</p>
      <h2>Таблиці без зайвого шуму</h2>
      <span>Перший екран захоплює, далі гравець швидко бачить місце, ранг, очки і форму.</span>
    </div>
    <div class="homex-league-grid">
      ${renderLeagueTable('sundaygames', model.adults)}
      ${renderLeagueTable('kids', model.kids)}
    </div>
  </section>`;
}

function renderRanks(model) {
  const max = Math.max(...Object.values(model.ranks), 1);
  const items = RANKS.map(([rank, min, label]) => {
    const count = model.ranks[rank] || 0;
    const width = Math.max(4, Math.round((count / max) * 100));
    return `<article class="homex-rank-row homex-rank-row--${rank}">
      ${rankBadge(rank)}
      <span>
        <strong>${esc(label)}</strong>
        <small>${min}+ очок</small>
      </span>
      <div class="homex-rank-track"><i style="width:${width}%"></i></div>
      <b>${count}</b>
    </article>`;
  }).join('');

  return `<section class="homex-section homex-two-col">
    <div class="homex-section__head">
      <p class="homex-kicker">RANK MAP</p>
      <h2>Кольори рангів працюють як навігація</h2>
      <span>S/A/B/C/D/E/F взяті з палітри рейтингу, але подані стримано, в межах brutalist-стилю.</span>
    </div>
    <div class="homex-rank-map">${items}</div>
  </section>`;
}

function renderSystemBlocks(model) {
  const latest = model.latestDay;
  return `<section class="homex-section">
    <div class="homex-section__head">
      <p class="homex-kicker">HOW IT PLAYS</p>
      <h2>Що показує система</h2>
      <span>Сайт має пояснювати гру для новачка і давати швидкий доступ постійним гравцям.</span>
    </div>
    <div class="homex-info-grid">
      <article>
        <strong>Командний матч</strong>
        <p>Гравці заходять у склад команди, результат матчу змінює рейтинг, а MVP підсвічує особистий внесок.</p>
        <a href="#gameday?league=sundaygames">Останні ігри</a>
      </article>
      <article>
        <strong>Сезонна форма</strong>
        <p>Таблиці показують активних гравців поточного сезону: очки, перемоги, поразки, win rate і MVP.</p>
        <a href="#seasons">Архів сезонів</a>
      </article>
      <article>
        <strong>Ранги</strong>
        <p>Ранг не замінює таблицю, а дає швидкий сигнал рівня: від стартового F до S-рівня на 1200+ очок.</p>
        <a href="#rules">Правила рейтингу</a>
      </article>
      <article>
        <strong>Live day</strong>
        <p>${latest?.date ? `Останній ігровий день: ${latest.date}, ${latest.matchesCount || 0} матчів, MVP: ${latest.mvp || 'ще не визначено'}.` : 'Коли зʼявиться новий ігровий день, блок автоматично покаже дату, матчі й MVP.'}</p>
        <a href="#gameday?league=${encodeURIComponent(latest?.league || 'sundaygames')}${latest?.date ? `&date=${encodeURIComponent(latest.date)}` : ''}">Відкрити день</a>
      </article>
    </div>
  </section>`;
}

function tournamentMeta(item = {}) {
  const format = getTournamentFormatLabel(item) || 'Турнір';
  const status = String(item.status || '').trim() || 'планується';
  const date = formatTournamentDate(item.dateStart);
  return [format, status, date].filter(Boolean).join(' · ');
}

function renderTournaments(items = []) {
  const cards = items.slice(0, 3).map((item) => `<a class="homex-tournament homex-card-link" href="${item.tournamentId ? `#tournaments?selected=${encodeURIComponent(item.tournamentId)}` : '#tournaments'}">
    <span>${esc(tournamentMeta(item))}</span>
    <strong>${esc(item.name || item.tournamentId || 'Турнір')}</strong>
    <small>${n(item.teamsCount)} команд · ${n(item.gamesCount)} матчів · ${n(item.playersCount)} гравців</small>
  </a>`).join('');

  return `<section class="homex-section">
    <div class="homex-section__head">
      <p class="homex-kicker">TOURNAMENT MODE</p>
      <h2>Турніри окремим шаром</h2>
      <span>Коли активний турнір є в листах, головна показує його коротко і веде в детальний режим.</span>
    </div>
    <div class="homex-tournaments">
      ${cards || '<article class="homex-empty">Активний турнір ще не знайдено. Блок готовий під дані з tournament sheets.</article>'}
      <a class="homex-btn homex-btn--wide" href="#tournaments">Відкрити турніри</a>
    </div>
  </section>`;
}

function renderError(message) {
  return `<section class="homex-hero homex-hero--error">
    <div class="homex-hero__copy">
      <p class="homex-kicker">DATA LINK</p>
      <h1>Дані тимчасово не підтягнулися.</h1>
      <p class="homex-hero__lead">${esc(message)}</p>
      <div class="homex-actions">
        <a class="homex-btn homex-btn--primary" href="#main">Спробувати ще раз</a>
        <a class="homex-btn" href="#rules">Подивитись правила</a>
      </div>
    </div>
  </section>`;
}

function renderPage(model, tournaments) {
  return `<div class="homex">
    ${renderHero(model)}
    ${renderLeaders(model)}
    ${renderLeagues(model)}
    ${renderRanks(model)}
    ${renderSystemBlocks(model)}
    ${renderTournaments(tournaments)}
  </div>`;
}

export async function initHomePage() {
  const root = document.getElementById('homeRoot') || document.getElementById('view');
  if (!root) return;
  await initPage(root);
}

export async function initPage(root) {
  if (!root) return;
  root.classList.add('homex-root');
  root.innerHTML = `<section class="homex-loading">
    <p class="homex-kicker">SYNC</p>
    <strong>Підтягуємо рейтинг, ліги та турніри</strong>
    <span>Live sheets / season cache / tournament sheets</span>
  </section>`;

  try {
    const [adultResult, kidsResult, tournamentsResult] = await Promise.allSettled([
      getCurrentLeagueLiveStats('sundaygames'),
      getCurrentLeagueLiveStats('kids'),
      loadTournamentsList()
    ]);

    const adultsLive = adultResult.status === 'fulfilled' ? adultResult.value : null;
    const kidsLive = kidsResult.status === 'fulfilled' ? kidsResult.value : null;
    const tournaments = tournamentsResult.status === 'fulfilled' ? tournamentsResult.value : [];

    if (!adultsLive && !kidsLive) {
      const error = adultResult.reason || kidsResult.reason;
      throw new Error(safeErrorMessage(error, 'Live-дані тимчасово недоступні'));
    }

    root.innerHTML = renderPage(aggregate(adultsLive, kidsLive), Array.isArray(tournaments) ? tournaments : []);
  } catch (error) {
    root.innerHTML = renderError(safeErrorMessage(error, 'Спробуй оновити сторінку за кілька секунд.'));
  }
}
