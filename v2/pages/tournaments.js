import { loadSeasonsConfig } from '../core/dataHub.js';
import { jsonp } from '../core/utils.js';

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toText(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeHeaderKey(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function normalizeStatusValue(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isActiveStatus(value = '') {
  const normalized = normalizeStatusValue(value);
  return normalized === 'active' || normalized === 'активний';
}

function isEmptyStatus(value = '') {
  return String(value || '').trim() === '';
}

function parsePlayersList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  const raw = value.trim();
  if (!raw) return [];
  if (raw.startsWith('[') || raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item || '').trim()).filter(Boolean);
    } catch {
      // noop
    }
  }
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeObjectRow(row = {}) {
  const source = (row && typeof row === 'object') ? row : {};
  return Object.entries(source).reduce((acc, [key, value]) => {
    acc[normalizeHeaderKey(key)] = value;
    return acc;
  }, {});
}

function getCell(row, ...keys) {
  const normalized = normalizeObjectRow(row);
  for (const key of keys) {
    const value = normalized[normalizeHeaderKey(key)];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
}

function normalizeRawRows(payload) {
  if (Array.isArray(payload)) {
    if (payload.length && Array.isArray(payload[0])) {
      const header = payload[0].map((value) => normalizeHeaderKey(value));
      return payload.slice(1).map((line) => {
        const row = {};
        header.forEach((head, idx) => {
          if (head) row[head] = Array.isArray(line) ? line[idx] : null;
        });
        return row;
      });
    }
    return payload.filter((item) => item && typeof item === 'object').map(normalizeObjectRow);
  }

  if (!payload || typeof payload !== 'object') return [];

  const container = payload.data || payload.result || payload;
  if (Array.isArray(container?.rows)) {
    if (container.rows.length && Array.isArray(container.rows[0])) {
      const header = Array.isArray(container.header)
        ? container.header.map((value) => normalizeHeaderKey(value))
        : [];
      return container.rows.map((line) => {
        const row = {};
        header.forEach((head, idx) => {
          if (head) row[head] = Array.isArray(line) ? line[idx] : null;
        });
        return row;
      });
    }
    return container.rows.filter((item) => item && typeof item === 'object').map(normalizeObjectRow);
  }

  if (Array.isArray(container?.values)) {
    return normalizeRawRows(container.values);
  }

  if (Array.isArray(container?.data)) {
    return normalizeRawRows(container.data);
  }

  return [];
}

async function getSheetRaw(sheetName, timeoutMs = 12_000) {
  const config = await loadSeasonsConfig();
  const gasUrl = config?.gasEndpoint || config?.endpoints?.gasUrl;
  if (!gasUrl) throw new Error('GAS endpoint не налаштований');
  return jsonp(gasUrl, { action: 'getSheetRaw', sheet: sheetName, limitRows: 5000 }, timeoutMs);
}

function normalizeTournamentSheets({ tournamentsRows, teamsRows, gamesRows, playersRows, configRows }) {
  const tournaments = tournamentsRows.map((row, idx) => {
    const tournamentId = String(getCell(row, 'tournamentid', 'tournamentId', 'id') || '').trim();
    return {
      tournamentId,
      name: toText(getCell(row, 'name', 'title'), tournamentId || `Турнір ${idx + 1}`),
      league: toText(getCell(row, 'league'), ''),
      dateStart: toText(getCell(row, 'datestart', 'startdate', 'createdat'), ''),
      dateEnd: toText(getCell(row, 'dateend', 'enddate'), ''),
      status: toText(getCell(row, 'status'), ''),
      notes: toText(getCell(row, 'notes'), '')
    };
  }).filter((item) => item.tournamentId || item.name);

  const byId = {};
  tournaments.forEach((tournament, index) => {
    const fallbackId = String(tournament.tournamentId || `tournament-${index + 1}`);
    const tid = fallbackId;
    tournament.tournamentId = tid;
    byId[tid] = { tournament, teams: [], games: [], players: [], config: [] };
  });

  teamsRows.forEach((row) => {
    const tid = String(getCell(row, 'tournamentid', 'tournamentId') || '').trim();
    if (!tid || !byId[tid]) return;
    byId[tid].teams.push({
      tournamentId: tid,
      teamId: toText(getCell(row, 'teamid', 'teamId'), ''),
      teamName: toText(getCell(row, 'teamname', 'name'), ''),
      players: toText(getCell(row, 'players'), ''),
      mmrStart: toNumber(getCell(row, 'mmrstart')),
      mmrCurrent: toNumber(getCell(row, 'mmrcurrent', 'mmrCurrent')),
      wins: toNumber(getCell(row, 'wins')),
      losses: toNumber(getCell(row, 'losses')),
      draws: toNumber(getCell(row, 'draws')),
      points: toNumber(getCell(row, 'points')),
      rank: toText(getCell(row, 'rank'), ''),
      playersList: parsePlayersList(getCell(row, 'players'))
    });
  });

  gamesRows.forEach((row) => {
    const tid = String(getCell(row, 'tournamentid', 'tournamentId') || '').trim();
    if (!tid || !byId[tid]) return;
    byId[tid].games.push({
      tournamentId: tid,
      gameId: toText(getCell(row, 'gameid', 'gameId'), ''),
      mode: toText(getCell(row, 'mode'), ''),
      teamAId: toText(getCell(row, 'teamaid', 'teamAId'), ''),
      teamBId: toText(getCell(row, 'teambid', 'teamBId'), ''),
      winnerTeamId: toText(getCell(row, 'winnerteamid', 'winnerTeamId'), ''),
      isDraw: toText(getCell(row, 'isdraw', 'draw'), ''),
      mvpNick: toText(getCell(row, 'mvpnick', 'mvpNick'), ''),
      secondNick: toText(getCell(row, 'secondnick', 'secondNick'), ''),
      thirdNick: toText(getCell(row, 'thirdnick', 'thirdNick'), ''),
      teamAMmrDelta: toNumber(getCell(row, 'teamammrdelta', 'teamAMmrDelta')),
      teamBMmrDelta: toNumber(getCell(row, 'teambmmrdelta', 'teamBMmrDelta')),
      timestamp: toText(getCell(row, 'timestamp', 'createdat'), '')
    });
  });

  playersRows.forEach((row) => {
    const tid = String(getCell(row, 'tournamentid', 'tournamentId') || '').trim();
    if (!tid || !byId[tid]) return;
    byId[tid].players.push({
      tournamentId: tid,
      playerNick: toText(getCell(row, 'playernick', 'playerNick', 'nick'), ''),
      teamId: toText(getCell(row, 'teamid', 'teamId'), ''),
      games: toNumber(getCell(row, 'games')),
      wins: toNumber(getCell(row, 'wins')),
      losses: toNumber(getCell(row, 'losses')),
      draws: toNumber(getCell(row, 'draws')),
      mvpCount: toNumber(getCell(row, 'mvpcount')),
      secondCount: toNumber(getCell(row, 'secondcount')),
      thirdCount: toNumber(getCell(row, 'thirdcount')),
      impactPoints: toNumber(getCell(row, 'impactpoints')),
      mmrChange: toNumber(getCell(row, 'mmrchange'))
    });
  });

  configRows.forEach((row) => {
    const tid = String(getCell(row, 'tournamentid', 'tournamentId') || '').trim();
    if (!tid || !byId[tid]) return;
    byId[tid].config.push(row);
  });

  return { tournaments, byId };
}

export async function loadTournamentSheets() {
  const sheets = ['tournaments', 'tournament_teams', 'tournament_games', 'tournament_players', 'tournament_config'];
  const [tournamentsRaw, teamsRaw, gamesRaw, playersRaw, configRaw] = await Promise.allSettled(
    sheets.map((sheetName) => getSheetRaw(sheetName))
  );

  const unwrapRows = (result, sheetName, required = false) => {
    if (result.status === 'fulfilled') return normalizeRawRows(result.value);
    if (required) throw result.reason;
    console.warn('[tournaments] sheet unavailable', sheetName, result.reason);
    return [];
  };

  const tournamentsRows = unwrapRows(tournamentsRaw, 'tournaments', true);
  const teamsRows = unwrapRows(teamsRaw, 'tournament_teams');
  const gamesRows = unwrapRows(gamesRaw, 'tournament_games');
  const playersRows = unwrapRows(playersRaw, 'tournament_players');
  const configRows = unwrapRows(configRaw, 'tournament_config');

  console.debug('[tournaments] raw sheets loaded', {
    tournaments: tournamentsRows.length,
    teams: teamsRows.length,
    games: gamesRows.length,
    players: playersRows.length
  });

  const model = normalizeTournamentSheets({ tournamentsRows, teamsRows, gamesRows, playersRows, configRows });
  console.debug('[tournaments] normalized tournaments', model.tournaments);
  return model;
}

export async function loadTournamentsList() {
  const model = await loadTournamentSheets();
  const withSummary = model.tournaments.map((item) => {
    const tid = String(item?.tournamentId || '');
    const bucket = model.byId?.[tid] || {};
    return {
      ...item,
      teamsCount: Array.isArray(bucket.teams) ? bucket.teams.length : 0,
      gamesCount: Array.isArray(bucket.games) ? bucket.games.length : 0,
      playersCount: Array.isArray(bucket.players) ? bucket.players.length : 0
    };
  });
  const active = withSummary.filter((item) => isActiveStatus(item.status));
  if (active.length) return active;
  if (withSummary.length === 1 && isEmptyStatus(withSummary[0]?.status)) return withSummary;
  return withSummary.length ? [withSummary[0]] : [];
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function clear(node) {
  if (node) node.replaceChildren();
}

function stateCard(title, text = '', tone = 'empty') {
  const wrap = createElement('article', `px-card tournament-status tournament-status--${tone}`);
  wrap.append(createElement('h3', 'px-card__title tournament-status__title', title));
  if (text) wrap.append(createElement('p', 'px-card__text', text));
  return wrap;
}

function createPreviewSections() {
  const wrap = createElement('section', 'tournament-dashboard-preview');
  const shell = createElement('div', 'tournament-dashboard-preview__grid');
  const items = [
    {
      title: 'Таблиця команд',
      text: 'Тут буде турнірна таблиця з очками, перемогами та MMR'
    },
    {
      title: 'Матчі',
      text: 'Тут з’явиться список матчів, результатів і MVP'
    },
    {
      title: 'Гравці',
      text: 'Тут буде статистика учасників турніру'
    }
  ];

  items.forEach((item) => {
    const card = createElement('article', 'px-card tournament-dashboard-preview__card');
    card.append(
      createElement('h3', 'px-card__title', item.title),
      createElement('p', 'px-card__text', item.text)
    );
    shell.append(card);
  });

  wrap.append(shell);
  return wrap;
}

function createMetaItem(label, value, className = '') {
  const item = createElement('div', `tournament-meta-item${className ? ` ${className}` : ''}`);
  item.append(
    createElement('span', 'tournament-meta-item__label', label),
    createElement('strong', 'tournament-meta-item__value', value)
  );
  return item;
}

function sanitizeErrorMessage() {
  return 'Спробуй оновити сторінку пізніше';
}

function statusClass(status = '') {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('active') || normalized.includes('актив')) return 'is-active';
  if (normalized.includes('finished')) return 'is-finished';
  return 'is-neutral';
}

function statusLabel(status = '') {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('active') || normalized.includes('актив')) return 'Активний';
  if (normalized.includes('finished')) return 'Завершений';
  if (!String(status || '').trim()) return 'Планується';
  return toText(status);
}

function actionLabel(status = '') {
  return statusClass(status) === 'is-active' ? 'Відкрити' : 'Переглянути';
}

function hasMixedHint(value = '') {
  const normalized = String(value || '').toLowerCase();
  return normalized.includes('mixed') || normalized.includes('мікс') || normalized.includes('змішан');
}

function detectLeagueValue(value = '') {
  const normalized = String(value || '').toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('kids') || normalized.includes('дит')) return 'kids';
  if (normalized.includes('sundaygames') || normalized.includes('adult') || normalized.includes('дорос')) return 'sundaygames';
  return '';
}

export function getTournamentFormatLabel(tournament = {}, teams = [], players = []) {
  if (hasMixedHint(tournament?.league) || hasMixedHint(tournament?.notes)) return 'Змішаний формат';

  const flags = new Set();
  const seedLeague = detectLeagueValue(tournament?.league);
  if (seedLeague) flags.add(seedLeague);

  [...teams, ...players].forEach((row) => {
    const guessed = detectLeagueValue(row?.league || row?.division || row?.category || row?.teamName || row?.teamId || row?.playerNick);
    if (guessed) flags.add(guessed);
  });

  if (flags.has('kids') && flags.has('sundaygames')) return 'Змішаний формат';
  if (flags.has('kids')) return 'Дитяча ліга';
  if (flags.has('sundaygames')) return 'Доросла ліга';
  return 'Турнір';
}

export function formatTournamentDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  const dateLabel = date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  if (!hasTime) return dateLabel;
  const timeLabel = date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  return `${dateLabel} · ${timeLabel}`;
}

function getMatchResultLabel(game, winner) {
  const isDraw = String(game?.isDraw || '').toLowerCase();
  if (isDraw === 'true' || isDraw === '1' || !String(game?.winnerTeamId || '').trim()) return 'Нічия';
  return `Переможець: ${winner}`;
}

function renderRankBadge(rank) {
  const badge = createElement('span', 't-rank-badge', toText(rank, '—'));
  return badge;
}

function pickAutoOpenTournament(tournaments = [], selectedId = '') {
  const selected = String(selectedId || '').trim();
  if (selected && tournaments.some((item) => String(item.tournamentId) === selected)) return selected;
  const firstActive = tournaments.find((item) => isActiveStatus(item.status));
  if (firstActive) return firstActive.tournamentId;
  return tournaments[0]?.tournamentId || '';
}

export async function initTournamentsPage(params = {}) {
  const root = document.getElementById('tournamentsRoot');
  if (!root) return;

  clear(root);

  root.classList.add('tournaments-page-v2');

  const hero = createElement('section', 'px-card tournaments-page-hero');
  hero.append(
    createElement('h1', 'px-card__title', 'ТУРНІРИ'),
    createElement('p', 'px-card__text', 'Командні битви, матчі, таблиця та статистика')
  );

  const listWrap = createElement('section', 'px-card tournaments-page-active');
  const listHeading = createElement('div', 'tournaments-page-active__heading');
  listHeading.append(
    createElement('h2', 'px-card__title', 'АКТИВНІ ТУРНІРИ'),
    createElement('p', 'px-card__text', 'Обери турнір, щоб переглянути таблицю, матчі та статистику')
  );

  const dashboard = createElement('section', 'tournament-dashboard-shell');
  listWrap.append(listHeading, stateCard('Завантаження турнірів...', 'Отримуємо список турнірів', 'loading'));
  root.append(hero, listWrap, dashboard);

  try {
    const tournamentData = await loadTournamentSheets();
    const tournaments = tournamentData.tournaments;

    listWrap.replaceChildren(listHeading);
    if (!tournaments.length) {
      listWrap.append(stateCard('АКТИВНИХ ТУРНІРІВ ПОКИ НЕМАЄ', 'Коли турнір з’явиться, тут буде доступ до таблиці команд, матчів і статистики', 'empty'));
      dashboard.replaceChildren(createPreviewSections());
      return;
    }

    const selectedId = String(params.selected || params.id || '').trim();
    const grid = createElement('div', 'tournaments-page-active__list');

    tournaments.forEach((tournament) => {
      const card = createElement('article', 'tournament-card');
      const tournamentId = String(tournament?.tournamentId || '').trim();

      card.setAttribute('data-tournament-id', tournamentId);
      card.append(createElement('h3', 'tournament-card__title', toText(tournament?.name, 'Турнір')));

      const meta = createElement('div', 'tournament-card__meta');
      const tournamentDataById = tournamentData.byId?.[tournamentId] || {};
      const teams = Array.isArray(tournamentDataById.teams) ? tournamentDataById.teams : [];
      const games = Array.isArray(tournamentDataById.games) ? tournamentDataById.games : [];
      const players = Array.isArray(tournamentDataById.players) ? tournamentDataById.players : [];
      meta.append(
        createMetaItem('Формат', getTournamentFormatLabel(tournament, teams, players)),
        createMetaItem('Статус', statusLabel(tournament?.status), `status-${statusClass(tournament?.status)}`),
        createMetaItem('Старт', formatTournamentDate(tournament?.dateStart) || 'Дата уточнюється'),
        createMetaItem('Команд', String(teams.length)),
        createMetaItem('Матчів', String(games.length)),
        createMetaItem('Гравців', String(players.length))
      );
      card.append(meta);

      const actions = createElement('div', 'tournament-card__actions');
      const openBtn = createElement('button', 'tournament-open-btn', actionLabel(tournament?.status));
      openBtn.type = 'button';
      openBtn.addEventListener('click', () => openTournament(tournamentId, dashboard, grid, tournamentData.byId));
      actions.append(openBtn);
      card.append(actions);

      card.addEventListener('click', (event) => {
        if (event.target instanceof HTMLElement && event.target.closest('button')) return;
        openTournament(tournamentId, dashboard, grid, tournamentData.byId);
      });

      grid.append(card);
    });

    listWrap.append(grid);
    const autoOpenId = pickAutoOpenTournament(tournaments, selectedId);
    if (autoOpenId) await openTournament(autoOpenId, dashboard, grid, tournamentData.byId, true);
  } catch (err) {
    console.warn('[tournaments] list failed', err);
    listWrap.replaceChildren(listHeading, stateCard('Не вдалося завантажити дані турнірів', sanitizeErrorMessage(), 'error'));
    dashboard.replaceChildren(createPreviewSections());
  }
}

function activateTournamentCard(listNode, nextId) {
  listNode?.querySelectorAll('.tournament-card').forEach((card) => {
    const selected = card.getAttribute('data-tournament-id') === nextId;
    card.classList.toggle('is-selected', selected);
  });
}

async function openTournament(tournamentId, dashboardNode, listNode, byId, silentHashUpdate = false) {
  if (!dashboardNode || !tournamentId) return;
  activateTournamentCard(listNode, tournamentId);
  dashboardNode.replaceChildren(stateCard('Завантаження даних турніру...', 'Будь ласка, зачекай', 'loading'));

  try {
    const data = byId?.[tournamentId] || null;
    if (!data) throw new Error('Tournament not found');

    if (!silentHashUpdate) {
      const nextHash = `#tournaments?selected=${encodeURIComponent(tournamentId)}`;
      if (location.hash !== nextHash) {
        history.replaceState(null, '', nextHash);
      }
    }

    renderTournamentDashboard(dashboardNode, data);
  } catch (err) {
    console.warn('[tournaments] dashboard failed', err);
    dashboardNode.replaceChildren(stateCard('Не вдалося завантажити турнір', sanitizeErrorMessage(), 'error'));
  }
}

function renderTournamentDashboard(node, data) {
  const teams = Array.isArray(data?.teams) ? [...data.teams] : [];
  const games = Array.isArray(data?.games) ? data.games : [];
  const players = Array.isArray(data?.players) ? [...data.players] : [];
  const tournament = data?.tournament || data || {};
  const title = toText(tournament?.name, toText(tournament?.tournamentId, 'Турнір'));
  const teamMap = new Map(teams.map((team) => [String(team?.teamId || ''), toText(team?.teamName, String(team?.teamId || '—'))]));

  clear(node);

  const dashboardCard = createElement('section', 'px-card tournament-dashboard__shell');
  const head = createElement('div', 'tournament-dashboard__head');
  head.append(createElement('h3', 'px-card__title', title));
  const meta = createElement('div', 'tournament-dashboard__meta');
  const startLabel = formatTournamentDate(tournament?.dateStart || tournament?.startDate || tournament?.createdAt);
  meta.append(
    createMetaItem('Формат', getTournamentFormatLabel(tournament, teams, players)),
    createMetaItem('Статус', statusLabel(tournament?.status || 'ACTIVE'), `status-${statusClass(tournament?.status)}`),
    createMetaItem('Старт', startLabel || 'Дата уточнюється')
  );
  const summaryStrip = createElement('div', 'tournament-dashboard__summary');
  summaryStrip.append(
    createMetaItem('Команд', String(teams.length)),
    createMetaItem('Матчів', String(games.length)),
    createMetaItem('Гравців', String(players.length))
  );

  const tabsWrap = createElement('div', 'tournament-tabs');
  const contentWrap = createElement('div', 'tournament-tab-content');

  const tabs = [
    { key: 'overview', label: 'Огляд' },
    { key: 'table', label: 'Таблиця' },
    { key: 'games', label: 'Матчі' },
    { key: 'players', label: 'Гравці' }
  ];

  const renderers = {
    overview: () => renderOverview(contentWrap, teams, games, players, teamMap),
    table: () => renderTeamsTable(contentWrap, teams),
    games: () => renderGames(contentWrap, games, teamMap),
    players: () => renderPlayers(contentWrap, players, teamMap)
  };

  tabs.forEach((tab, index) => {
    const btn = createElement('button', `tournament-tab${index === 0 ? ' is-active' : ''}`, tab.label);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      tabsWrap.querySelectorAll('.tournament-tab').forEach((el) => el.classList.remove('is-active'));
      btn.classList.add('is-active');
      renderers[tab.key]();
    });
    tabsWrap.append(btn);
  });

  dashboardCard.append(head, meta, summaryStrip, tabsWrap, contentWrap);
  node.append(dashboardCard);
  renderers.overview();
}

function renderTeamsTable(node, teams) {
  clear(node);
  if (!teams.length) {
    node.append(stateCard('Команди ще не збережені', 'Таблиця зʼявиться після формування складів'));
    return;
  }

  const sorted = [...teams].sort((a, b) => {
    const byPoints = toNumber(b.points) - toNumber(a.points);
    if (byPoints) return byPoints;
    const byWins = toNumber(b.wins) - toNumber(a.wins);
    if (byWins) return byWins;
    const byMmr = toNumber(b.mmrCurrent) - toNumber(a.mmrCurrent);
    if (byMmr) return byMmr;
    return toNumber(a.losses) - toNumber(b.losses);
  });

  const wrap = createElement('div', 'tournament-table-wrap');
  const table = createElement('table', 'tournament-player-table');
  const thead = createElement('thead');
  const tbody = createElement('tbody');
  const headRow = createElement('tr');
  ['#', 'Команда', 'І', 'В', 'П', 'Н', 'Очки', 'MMR', 'Ранг'].forEach((title) => headRow.append(createElement('th', '', title)));
  thead.append(headRow);

  sorted.forEach((team, index) => {
    const tr = createElement('tr');
    if (index < 3) tr.classList.add(`is-top-${index + 1}`);
    const games = toNumber(team.wins) + toNumber(team.losses) + toNumber(team.draws);
    [
      String(index + 1),
      toText(team.teamName, toText(team.teamId)),
      String(games),
      String(toNumber(team.wins)),
      String(toNumber(team.losses)),
      String(toNumber(team.draws)),
      String(toNumber(team.points)),
      toNumber(team.mmrCurrent) ? String(toNumber(team.mmrCurrent)) : '—'
    ].forEach((cell) => tr.append(createElement('td', '', cell)));
    const rankTd = createElement('td');
    rankTd.append(renderRankBadge(team.rank));
    tr.append(rankTd);
    tbody.append(tr);
  });

  table.append(thead, tbody);
  wrap.append(table);
  node.append(wrap);
}

function renderGames(node, games, teamMap) {
  clear(node);
  if (!games.length) {
    node.append(stateCard('Матчі ще не додані', 'Після старту турніру тут з’явиться список матчів і результатів.'));
    return;
  }

  const list = createElement('div', 'tournament-games-list');
  games.forEach((game) => {
    const card = createElement('article', 'tournament-match-card');
    const teamA = teamMap.get(String(game?.teamAId || '')) || toText(game?.teamAId);
    const teamB = teamMap.get(String(game?.teamBId || '')) || toText(game?.teamBId);
    const winner = String(game?.winnerTeamId || '').trim()
      ? (teamMap.get(String(game?.winnerTeamId || '')) || toText(game?.winnerTeamId))
      : 'Нічия';

    const top = createElement('div', 'tournament-match-card__top');
    top.append(
      createElement('span', 'tournament-match-card__id', `Матч ${toText(game?.gameId, '—')}`),
      createElement('span', 'tournament-match-card__mode', toText(game?.mode, 'Режим уточнюється')),
      createElement('span', 'tournament-match-card__time', formatTournamentDate(game?.timestamp) || 'Дата уточнюється')
    );

    const middle = createElement('div', 'tournament-match-card__middle', `${teamA} vs ${teamB}`);

    const bottom = createElement('div', 'tournament-match-card__bottom');
    const mvpLabel = [game?.mvpNick, game?.secondNick, game?.thirdNick]
      .map((nick) => String(nick || '').trim())
      .filter(Boolean)
      .join(' / ');
    bottom.append(
      createMetaItem('Результат', getMatchResultLabel(game, winner)),
      createMetaItem('MVP', mvpLabel || '—'),
      createMetaItem('ΔMMR', `${toNumber(game?.teamAMmrDelta)} / ${toNumber(game?.teamBMmrDelta)}`)
    );

    card.append(top, middle, bottom);
    list.append(card);
  });

  node.append(list);
}

function renderPlayers(node, players, teamMap) {
  clear(node);
  if (!players.length) {
    node.append(stateCard('Статистика гравців ще не готова', 'Після перших матчів тут з’явиться особиста статистика учасників.'));
    return;
  }

  const sorted = [...players].sort((a, b) => {
    const byImpact = toNumber(b.impactPoints) - toNumber(a.impactPoints);
    if (byImpact) return byImpact;
    const byMvp = toNumber(b.mvpCount) - toNumber(a.mvpCount);
    if (byMvp) return byMvp;
    const byWins = toNumber(b.wins) - toNumber(a.wins);
    if (byWins) return byWins;
    return toNumber(b.mmrChange) - toNumber(a.mmrChange);
  });

  const list = createElement('div', 'tournament-players-list');
  sorted.forEach((player) => {
    const row = createElement('article', 'tournament-player-row');
    const teamName = teamMap.get(String(player?.teamId || '')) || toText(player?.teamId);
    row.append(createElement('h4', 'tournament-player-row__name', toText(player.playerNick, 'Гравець')));
    const stats = createElement('div', 'tournament-player-row__stats');
    stats.append(
      createMetaItem('Команда', teamName),
      createMetaItem('Ігор', String(toNumber(player.games))),
      createMetaItem('Перемог', String(toNumber(player.wins))),
      createMetaItem('MVP', String(toNumber(player.mvpCount))),
      createMetaItem('Impact', String(toNumber(player.impactPoints))),
      createMetaItem('MMR +/-', String(toNumber(player.mmrChange)))
    );
    row.append(stats);
    list.append(row);
  });
  node.append(list);
}

function renderOverview(node, teams, games, players, teamMap) {
  clear(node);
  const wrap = createElement('div', 'tournament-overview-grid');
  const sortedTeams = [...teams].sort((a, b) => toNumber(b.points) - toNumber(a.points) || toNumber(b.wins) - toNumber(a.wins));
  const leader = sortedTeams[0] || null;
  const latestGame = [...games].sort((a, b) => Date.parse(b?.timestamp || 0) - Date.parse(a?.timestamp || 0))[0] || null;

  const leaderCard = createElement('article', 'px-card tournament-overview-card');
  leaderCard.append(createElement('h4', 'px-card__title', 'Лідер турніру'));
  if (leader) {
    leaderCard.append(createElement('p', 'px-card__text', `${toText(leader.teamName, toText(leader.teamId))} · ${toNumber(leader.points)} очок / ${toNumber(leader.wins)} перемог`));
  } else {
    leaderCard.append(createElement('p', 'px-card__text', 'Таблиця ще формується.'));
  }

  const matchCard = createElement('article', 'px-card tournament-overview-card');
  matchCard.append(createElement('h4', 'px-card__title', 'Останній матч'));
  if (latestGame) {
    const teamA = teamMap.get(String(latestGame?.teamAId || '')) || toText(latestGame?.teamAId);
    const teamB = teamMap.get(String(latestGame?.teamBId || '')) || toText(latestGame?.teamBId);
    const winner = String(latestGame?.winnerTeamId || '').trim()
      ? (teamMap.get(String(latestGame?.winnerTeamId || '')) || toText(latestGame?.winnerTeamId))
      : 'Нічия';
    matchCard.append(createElement('p', 'px-card__text', `${teamA} vs ${teamB}`));
    matchCard.append(createElement('p', 'px-card__text', `${getMatchResultLabel(latestGame, winner)}${latestGame?.mvpNick ? ` · MVP: ${toText(latestGame.mvpNick)}` : ''}`));
  } else {
    matchCard.append(createElement('p', 'px-card__text', 'Поки що матчів немає.'));
  }

  const statsCard = createElement('article', 'px-card tournament-overview-card');
  statsCard.append(createElement('h4', 'px-card__title', 'Статистика'));
  statsCard.append(createElement('p', 'px-card__text', `Команд: ${teams.length} · Матчів: ${games.length} · Гравців: ${players.length}`));

  wrap.append(leaderCard, matchCard, statsCard);
  node.append(wrap);
}
