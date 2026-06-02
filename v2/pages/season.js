import { listSeasonMasters, getSeasonMaster, safeErrorMessage } from '../core/dataHub.js';
import { leagueLabelUA, normalizeLeague } from '../core/naming.js';

const RANK_ORDER = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function signed(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n}`;
}

function pct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : '—';
}

function titleFromId(id = '') {
  const known = {
    spring_2026: 'Весна 2026',
    winter_2025_2026: 'Зима 2025–2026',
    autumn_2025: 'Осінь 2025',
    summer_2025: 'Літо 2025'
  };
  return known[id] || String(id || 'Сезон').replaceAll('_', ' ');
}

function periodText(meta = {}) {
  const start = meta.dateStart || meta.date_start || meta.Date_start || meta.start || '';
  const end = meta.dateEnd || meta.date_end || meta.Date_end || meta.end || '';
  if (start && end) return `${start} - ${end}`;
  return meta.period || meta.date_range || meta.dateRange || 'Архівний сезон';
}

function playerName(player = {}) {
  return player.nickname || player.nick || player.Nickname || '—';
}

function ratingEnd(player = {}) {
  return num(player.rating_end ?? player.ratingEnd ?? player.points, 0);
}

function ratingDelta(player = {}) {
  return num(player.rating_delta ?? player.ratingDelta ?? player.delta, 0);
}

function mvpTotal(player = {}) {
  return num(player.mvp_total ?? player.mvpTotal ?? player.mvp, 0);
}

function rank(player = {}) {
  return String(player.rank_final || player.rankLetter || player.Rank || player.rank?.label || 'F').toUpperCase();
}

function sortByRating(players = []) {
  return [...players].sort((a, b) => ratingEnd(b) - ratingEnd(a) || num(b.wins) - num(a.wins) || playerName(a).localeCompare(playerName(b), 'uk'));
}

function sortBy(players = [], key = 'rating') {
  const getters = {
    rating: ratingEnd,
    delta: ratingDelta,
    mvp: mvpTotal,
    games: (p) => num(p.matches ?? p.games, 0),
    wr: (p) => num(p.win_rate ?? p.winRate ?? p.winrate, 0)
  };
  const getter = getters[key] || ratingEnd;
  return [...players].sort((a, b) => getter(b) - getter(a) || ratingEnd(b) - ratingEnd(a));
}

function profileLink(league, player) {
  return `#player?league=${encodeURIComponent(league)}&nick=${encodeURIComponent(playerName(player))}`;
}

function kpi(label, value, meta = '', tone = 'neutral') {
  return `<article class="season-kpi season-kpi--${esc(tone)}">
    <span>${esc(label)}</span>
    <strong>${esc(value)}</strong>
    ${meta ? `<em>${esc(meta)}</em>` : ''}
  </article>`;
}

function awardCard(label, player, value, meta = '', tone = 'cyan') {
  return `<article class="season-award season-award--${esc(tone)}">
    <span>${esc(label)}</span>
    <strong>${esc(player || '—')}</strong>
    <em>${esc(value || '—')}${meta ? ` · ${esc(meta)}` : ''}</em>
  </article>`;
}

function rankStrip(players = []) {
  const total = Math.max(players.length, 1);
  return `<div class="season-rank-strip">
    ${RANK_ORDER.map((rankName) => {
      const count = players.filter((player) => rank(player) === rankName).length;
      const width = Math.max(4, Math.round((count / total) * 100));
      return `<span class="season-rank-strip__seg season-rank-strip__seg--${rankName.toLowerCase()}" style="width:${width}%">
        <b>${rankName}</b><small>${count}</small>
      </span>`;
    }).join('')}
  </div>`;
}

function playersTable(players = [], league = 'sundaygames', limit = null) {
  const rows = (limit ? players.slice(0, limit) : players);
  if (!rows.length) return '<div class="season-empty">Немає даних по гравцях.</div>';
  return `<div class="season-table-wrap">
    <table class="season-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Гравець</th>
          <th>Очки</th>
          <th>Δ</th>
          <th>Ігри</th>
          <th>W/L</th>
          <th>WR</th>
          <th>MVP</th>
          <th>Ранг</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((player, index) => {
          const place = num(player.place ?? player.finalPlace, index + 1);
          const delta = ratingDelta(player);
          const deltaClass = delta >= 0 ? 'is-positive' : 'is-negative';
          return `<tr>
            <td class="season-table__place">#${place}</td>
            <td class="season-table__player"><a href="${profileLink(league, player)}">${esc(playerName(player))}</a></td>
            <td class="season-table__points">${ratingEnd(player)}</td>
            <td class="season-table__delta ${deltaClass}">${signed(delta)}</td>
            <td>${num(player.matches ?? player.games, 0)}</td>
            <td>${num(player.wins, 0)} / ${num(player.losses, 0)}</td>
            <td>${pct(player.win_rate ?? player.winRate ?? player.winrate)}</td>
            <td>${mvpTotal(player)} <small>${num(player.mvp1, 0)}/${num(player.mvp2, 0)}/${num(player.mvp3, 0)}</small></td>
            <td><span class="season-rank season-rank--${rank(player).toLowerCase()}">${esc(rank(player))}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

function auditBlock(master = {}, league = 'sundaygames') {
  const warnings = (master.audit?.warnings || []).filter((item) => !item.league || normalizeLeague(item.league) === league);
  if (!warnings.length) return '';
  return `<section class="season-audit">
    <h2>Audit сезону</h2>
    ${warnings.map((item) => {
      if (item.type === 'player_has_games_without_logs') {
        return `<p><strong>${esc(item.nick)}</strong>: є ${num(item.games)} ігор без записаних логів, архів дорахував ${signed(item.computedDelta)} за результатами матчів.</p>`;
      }
      return `<p>${esc(item.type || 'warning')}: ${esc(item.nick || '')}</p>`;
    }).join('')}
  </section>`;
}

function renderSeason(root, { seasonId, league, master, seasons }) {
  const sections = master?.sections || {};
  const meta = sections.season_meta || {};
  const title = meta.title || meta.seasonTitle || titleFromId(seasonId);
  const players = sortByRating((Array.isArray(sections.players) ? sections.players : [])
    .filter((player) => normalizeLeague(player.league) === league));
  const summary = sections.league_summary?.[league] || {};
  const activePlayers = players.filter((player) => num(player.matches ?? player.games, 0) > 0);
  const leader = players[0];
  const impact = sortBy(players, 'delta')[0];
  const mvp = sortBy(players, 'mvp')[0];
  const wr = sortBy(activePlayers.filter((p) => num(p.matches ?? p.games, 0) >= 5), 'wr')[0];
  const totalGames = num(summary.matches ?? summary.games, activePlayers.reduce((sum, p) => sum + num(p.matches ?? p.games, 0), 0));
  const totalMvp = activePlayers.reduce((sum, player) => sum + mvpTotal(player), 0);

  root.innerHTML = `<section class="season-detail-page">
    <header class="season-detail-hero">
      <a href="#seasons" class="season-back">← Всі сезони</a>
      <p>АРХІВ СЕЗОНУ</p>
      <h1>${esc(title)}</h1>
      <span>${esc(periodText(meta))} · ${esc(leagueLabelUA(league))}</span>
      <div class="season-detail-switchers">
        <select id="seasonArchiveSelect" aria-label="Сезон">
          ${seasons.map((id) => `<option value="${esc(id)}" ${id === seasonId ? 'selected' : ''}>${esc(titleFromId(id))}</option>`).join('')}
        </select>
        <div class="season-league-tabs">
          <a href="#season?season=${encodeURIComponent(seasonId)}&league=sundaygames" class="${league === 'sundaygames' ? 'is-active' : ''}">Доросла</a>
          <a href="#season?season=${encodeURIComponent(seasonId)}&league=kids" class="${league === 'kids' ? 'is-active' : ''}">Дитяча</a>
        </div>
      </div>
    </header>

    <section class="season-kpi-grid">
      ${kpi('Матчів', totalGames, 'за сезон', 'cyan')}
      ${kpi('Активних', activePlayers.length, `${players.length} записів`, 'green')}
      ${kpi('MVP записів', totalMvp, '1/2/3 місця', 'yellow')}
      ${kpi('Лідер', playerName(leader), `${ratingEnd(leader)} очок`, 'blue')}
    </section>

    <section class="season-story">
      <div>
        <h2>Підсумок ліги</h2>
        <p>${esc(playerName(leader))} завершує сезон на першому місці. Найбільший impact: ${esc(playerName(impact))} (${signed(ratingDelta(impact))}). MVP лідер: ${esc(playerName(mvp))} (${mvpTotal(mvp)} записів).</p>
      </div>
      ${rankStrip(players)}
    </section>

    <section class="season-awards-grid">
      ${awardCard('Чемпіон сезону', playerName(leader), `${ratingEnd(leader)} очок`, `#${num(leader?.place, 1)}`, 'green')}
      ${awardCard('Найбільший приріст', playerName(impact), signed(ratingDelta(impact)), `${ratingEnd(impact)} очок`, 'cyan')}
      ${awardCard('MVP сезону', playerName(mvp), `${mvpTotal(mvp)} MVP`, `${num(mvp?.mvp1, 0)} перших`, 'yellow')}
      ${awardCard('Найкращий WR', playerName(wr), pct(wr?.win_rate ?? wr?.winRate ?? wr?.winrate), `${num(wr?.matches ?? wr?.games, 0)} ігор`, 'blue')}
    </section>

    <section class="season-section">
      <div class="season-section__head">
        <h2>Top-10 сезону</h2>
        <span>Фінальний рейтинг</span>
      </div>
      ${playersTable(players, league, 10)}
    </section>

    <section class="season-section">
      <div class="season-section__head">
        <h2>Повна таблиця</h2>
        <span>${activePlayers.length} активних гравців</span>
      </div>
      ${playersTable(players, league)}
    </section>

    ${auditBlock(master, league)}
  </section>`;

  root.querySelector('#seasonArchiveSelect')?.addEventListener('change', (event) => {
    const next = event.currentTarget.value;
    location.hash = `#season?season=${encodeURIComponent(next)}&league=${encodeURIComponent(league)}`;
  });
}

export async function initSeasonPage(params = {}) {
  const root = document.getElementById('seasonPageRoot') || document.getElementById('view');
  if (!root) return;

  root.innerHTML = '<section class="season-detail-loading">Завантаження архіву сезону...</section>';

  try {
    const seasons = await listSeasonMasters();
    const selectedSeason = seasons.includes(params.season) ? params.season : (seasons[0] || 'spring_2026');
    const selectedLeague = normalizeLeague(params.league) || 'sundaygames';
    const master = await getSeasonMaster(selectedSeason);
    renderSeason(root, {
      seasonId: selectedSeason,
      league: selectedLeague,
      master,
      seasons: seasons.length ? seasons : [selectedSeason]
    });
  } catch (error) {
    root.innerHTML = `<section class="season-detail-loading">
      <strong>Архів недоступний</strong>
      <span>${esc(safeErrorMessage(error, 'Не вдалося завантажити сезон'))}</span>
      <a href="#seasons">Повернутися до сезонів</a>
    </section>`;
  }
}
