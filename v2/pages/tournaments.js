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
  const wrap = createElement('article', `tournament-empty-state tournament-status tournament-status--${tone}`);
  wrap.append(createElement('h3', 'tournament-status__title', title));
  if (text) wrap.append(createElement('p', 'tournament-status__text', text));
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
    const card = createElement('article', 'tournament-dashboard-preview__card');
    card.append(
      createElement('h3', 'tournament-section-head__title', item.title),
      createElement('p', 'tournament-simple-line', item.text)
    );
    shell.append(card);
  });

  wrap.append(shell);
  return wrap;
}

function createStatInline(label, value) {
  const item = createElement('p', 'tournament-statline');
  item.append(createElement('span', '', label), createElement('strong', '', String(value)));
  return item;
}

function createStatCell(label, value) {
  const item = createElement('div', 'tournament-statcell');
  item.append(createElement('span', '', label), createElement('strong', '', String(value)));
  return item;
}

function createSimpleLine(text) {
  return createElement('p', 'tournament-simple-line', text);
}

function createCountCard(label, value) {
  const item = createElement('div', 'tournament-count-card');
  item.append(createElement('span', '', label), createElement('strong', '', String(value)));
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
  const hasAdults = normalized.includes('sundaygames') || normalized.includes('adult') || normalized.includes('дорос');
  const hasKids = normalized.includes('kids') || normalized.includes('дит');
  return normalized.includes('mixed')
    || normalized.includes('мікс')
    || normalized.includes('змішан')
    || normalized.includes('sundaygames + kids')
    || normalized.includes('kids + sundaygames')
    || (hasAdults && hasKids);
}

function detectLeagueValue(value = '') {
  const normalized = String(value || '').toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('kids') || normalized.includes('дит')) return 'kids';
  if (normalized.includes('sundaygames') || normalized.includes('adult') || normalized.includes('дорос')) return 'sundaygames';
  return '';
}

export function getTournamentFormatLabel(tournament = {}, teams = [], players = []) {
  const notes = String(tournament?.notes || '');
  if (String(tournament?.league || '').trim().toLowerCase() === 'mixed' || hasMixedHint(tournament?.league) || hasMixedHint(notes)) {
    return 'Змішаний формат';
  }

  const flags = new Set();
  const seedLeague = detectLeagueValue(tournament?.league);
  if (seedLeague) flags.add(seedLeague);

  [...teams, ...players, ...(Array.isArray(tournament?.config) ? tournament.config : [])].forEach((row) => {
    const guessed = detectLeagueValue(
      row?.sourceLeague
      || row?.league
      || row?.division
      || row?.category
      || row?.notes
      || row?.teamName
      || row?.teamId
      || row?.playerNick
    );
    if (guessed) flags.add(guessed);
  });

  if (flags.has('kids') && flags.has('sundaygames')) return 'Змішаний формат';
  if (notes.toLowerCase().includes('mixed tournament')) return 'Змішаний формат';
  if (flags.has('kids')) return 'Дитяча ліга';
  if (flags.has('sundaygames')) return 'Доросла ліга';
  return 'Турнір';
}

export function formatTournamentDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Дата уточнюється';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return 'Дата уточнюється';
  const dateLabel = date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  if (!hasTime) return dateLabel;
  const timeLabel = date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  return `${dateLabel} · ${timeLabel}`;
}

function isTruthy(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function getTeamName(teamId, teamMap) {
  const key = String(teamId || '').trim();
  if (!key) return 'Команда';
  return teamMap?.get(key) || key;
}

function getWinnerLabel(game, teamMap) {
  const winnerTeamId = String(game?.winnerTeamId || '').trim();
  if (isTruthy(game?.isDraw) || !winnerTeamId) return 'Нічия';
  return `${getTeamName(winnerTeamId, teamMap)} перемогла`;
}

function getMatchScoreLabel(game) {
  const scoreA = Number(game?.scoreA);
  const scoreB = Number(game?.scoreB);
  if (Number.isFinite(scoreA) && Number.isFinite(scoreB)) return `${scoreA}:${scoreB}`;
  return '';
}

function getMvpLabel(game) {
  return [game?.mvpNick, game?.secondNick, game?.thirdNick]
    .map((nick) => String(nick || '').trim())
    .filter(Boolean)
    .join(' · ');
}

function formatDelta(value = 0) {
  const num = toNumber(value);
  if (!num) return '0';
  return `${num > 0 ? '+' : ''}${num}`;
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

  const hero = createElement('section', 'tournament-panel tournaments-page-hero');
  hero.append(
    createElement('h1', 'tournament-section-head__title', 'Турніри'),
    createElement('p', 'tournament-section-head__sub', 'Командні битви, таблиця, матчі та статистика')
  );

  const listWrap = createElement('section', 'tournament-panel tournaments-page-active tournament-switcher');
  const listHeading = createElement('div', 'tournaments-page-active__heading tournament-switcher__heading');
  listHeading.append(createElement('h2', 'tournament-section-head__title', 'Обери турнір'));

  const dashboard = createElement('section', 'tournament-dashboard-shell tournaments-dashboard');
  listWrap.append(listHeading, stateCard('Завантаження турнірів...', 'Отримуємо список турнірів', 'loading'));
  root.append(hero, listWrap, dashboard);

  try {
    const tournamentData = await loadTournamentSheets();
    const tournaments = tournamentData.tournaments;

    listWrap.replaceChildren(listHeading);
    if (!tournaments.length) {
      listWrap.append(stateCard('Поки немає активних турнірів', 'Коли турнір стартує, тут з’явиться швидкий доступ до таблиці та матчів.', 'empty'));
      dashboard.replaceChildren(createPreviewSections());
      return;
    }

    const selectedId = String(params.selected || params.id || '').trim();
    const grid = createElement('div', 'tournaments-page-active__list');

    tournaments.forEach((tournament) => {
      const card = createElement('article', 'tournament-card tournament-switcher__item');
      const tournamentId = String(tournament?.tournamentId || '').trim();

      card.setAttribute('data-tournament-id', tournamentId);
      card.append(createElement('h3', 'tournament-card__title', toText(tournament?.name, 'Турнір')));

      const meta = createElement('div', 'tournament-card__meta tournament-statline-group');
      const tournamentDataById = tournamentData.byId?.[tournamentId] || {};
      const teams = Array.isArray(tournamentDataById.teams) ? tournamentDataById.teams : [];
      const games = Array.isArray(tournamentDataById.games) ? tournamentDataById.games : [];
      const players = Array.isArray(tournamentDataById.players) ? tournamentDataById.players : [];
      meta.append(createSimpleLine(`${getTournamentFormatLabel(tournament, teams, players)} · ${statusLabel(tournament?.status)} · ${formatTournamentDate(tournament?.dateStart)}`));
      meta.append(createSimpleLine(`${teams.length} команд · ${games.length} матчів · ${players.length} гравців`));
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

    if (tournaments.length > 1) {
      listWrap.append(grid);
    }
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

  const dashboardCard = createElement('section', 'tournament-panel tournament-dashboard__shell');
  const head = createElement('section', 'tournament-selected tournament-dashboard__head');
  const top = createElement('div', 'tournament-selected__top');
  const topInfo = createElement('div', '');
  topInfo.append(
    createElement('p', 'tournament-selected__kicker', 'ТУРНІР'),
    createElement('h2', 'tournament-selected__title', title),
    createElement('p', 'tournament-selected__sub', `${getTournamentFormatLabel(tournament, teams, players)} · ${statusLabel(tournament?.status || 'ACTIVE')} · ${formatTournamentDate(tournament?.dateStart || tournament?.startDate || tournament?.createdAt)}`)
  );
  top.append(topInfo);
  head.append(top);

  const summaryStrip = createElement('div', 'tournament-summary-row');
  summaryStrip.append(
    createCountCard('Команд', teams.length),
    createCountCard('Матчів', games.length),
    createCountCard('Гравців', players.length)
  );
  head.append(summaryStrip);

  const tabsWrap = createElement('div', 'tournament-tabs');
  const contentWrap = createElement('div', 'tournament-tab-content');

  const tabs = [
    { key: 'result', label: 'Результат' },
    { key: 'games', label: 'Матчі' },
    { key: 'players', label: 'Гравці' },
    { key: 'overview', label: 'Огляд' }
  ];

  const renderers = {
    result: () => renderTeamsTable(contentWrap, teams),
    overview: () => renderOverview(contentWrap, teams, games, players, teamMap),
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

  dashboardCard.append(head, tabsWrap, contentWrap);
  node.append(dashboardCard);
  renderers.result();
}

function renderTeamsTable(node, teams) {
  clear(node);
  if (!teams.length) {
    node.append(stateCard('Команди ще формуються', 'Команди ще формуються'));
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

  const cards = createElement('div', 'tournament-standing-list');

  sorted.forEach((team, index) => {
    const card = createElement('article', `tournament-standing-card${index < 3 ? ` is-top-${index + 1}` : ''}`);
    const header = createElement('div', 'tournament-standing-card__head');
    header.append(
      createElement('span', 'tournament-standing-card__place', `#${index + 1}`),
      createElement('strong', '', toText(team.teamName, toText(team.teamId)))
    );
    const record = createElement('div', 'tournament-standing-card__record');
    record.append(
      createElement('span', '', `${toNumber(team.wins)} В`),
      createElement('span', '', `${toNumber(team.losses)} П`),
      createElement('span', '', `${toNumber(team.draws)} Н`)
    );
    const score = createElement('div', 'tournament-standing-card__score');
    score.append(
      createElement('span', '', `Очки: ${toNumber(team.points)}`),
      createElement('span', '', `MMR: ${toNumber(team.mmrCurrent) || '—'}`)
    );
    card.append(
      header,
      record,
      score
    );
    cards.append(card);
  });
  node.append(cards);
}

function renderGames(node, games, teamMap) {
  clear(node);
  if (!games.length) {
    node.append(stateCard('Матчі з’являться після першого результату', 'Матчі з’являться після першого результату'));
    return;
  }

  const list = createElement('div', 'tournament-games-list');
  games.forEach((game, index) => {
    const teamA = getTeamName(game?.teamAId, teamMap);
    const teamB = getTeamName(game?.teamBId, teamMap);
    const winnerLabel = getWinnerLabel(game, teamMap);
    const scoreLabel = getMatchScoreLabel(game);
    const mvpLabel = getMvpLabel(game);
    const card = createElement('article', 'tournament-match-log');
    const triggerId = `tournamentMatch${index + 1}`;
    const head = createElement('button', 'tournament-match-log__head');
    head.type = 'button';
    head.setAttribute('aria-expanded', 'false');
    head.setAttribute('aria-controls', `${triggerId}Details`);

    const info = createElement('div', 'tournament-match-log__main');
    info.append(
      createElement('span', 'tournament-match-log__kicker', `МАТЧ ${toText(game?.gameId, `G${index + 1}`)}`),
      createElement('strong', '', `${teamA} vs ${teamB}`),
      createElement('small', '', `${toText(game?.mode, 'Режим')} · ${formatTournamentDate(game?.timestamp)}`)
    );

    const result = createElement('span', 'tournament-match-log__score', scoreLabel || winnerLabel);
    head.append(info, result);

    const details = createElement('div', 'tournament-match-log__body');
    details.id = `${triggerId}Details`;
    details.hidden = true;
    const teamGrid = createElement('div', 'tournament-match-log__teams');
    const winnerTeamId = String(game?.winnerTeamId || '').trim();
    [game?.teamAId, game?.teamBId].forEach((teamId) => {
      const box = createElement('section', `tournament-team-box${winnerTeamId && String(teamId) === winnerTeamId ? ' is-winner' : ''}`);
      box.append(
        createElement('strong', '', getTeamName(teamId, teamMap)),
        createElement('span', '', winnerTeamId && String(teamId) === winnerTeamId ? 'Переможець матчу' : 'Учасник матчу')
      );
      teamGrid.append(box);
    });
    details.append(teamGrid);
    if (mvpLabel) {
      const mvpList = createElement('div', 'tournament-mvp-list');
      [game?.mvpNick, game?.secondNick, game?.thirdNick]
        .map((nick) => String(nick || '').trim())
        .filter(Boolean)
        .forEach((nick, mvpIndex) => {
          const mvpItem = createElement('div', `tournament-mvp-item is-mvp${mvpIndex + 1}`);
          mvpItem.append(createElement('span', '', `MVP ${mvpIndex + 1}`), createElement('strong', '', nick));
          mvpList.append(mvpItem);
        });
      details.append(mvpList);
    }
    if (toNumber(game?.teamAMmrDelta) || toNumber(game?.teamBMmrDelta)) {
      details.append(createElement('p', 'tournament-delta-line', `ΔMMR: ${teamA} ${formatDelta(game?.teamAMmrDelta)} · ${teamB} ${formatDelta(game?.teamBMmrDelta)}`));
    }
    head.addEventListener('click', () => {
      const expanded = head.getAttribute('aria-expanded') === 'true';
      head.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      details.hidden = expanded;
      card.classList.toggle('is-open', !expanded);
    });
    card.append(head, details);
    if (index < 2) {
      head.setAttribute('aria-expanded', 'true');
      details.hidden = false;
      card.classList.add('is-open');
    }
    list.append(card);
  });

  node.append(list);
}

function renderPlayers(node, players, teamMap) {
  clear(node);
  if (!players.length) {
    node.append(stateCard('Індивідуальний рейтинг відкриється після матчів', 'Індивідуальний рейтинг відкриється після матчів'));
    return;
  }

  const sorted = [...players].sort((a, b) => {
    const byImpact = toNumber(b.impactPoints) - toNumber(a.impactPoints);
    if (byImpact) return byImpact;
    const byMvp = toNumber(b.mvpCount) - toNumber(a.mvpCount);
    if (byMvp) return byMvp;
    const byWins = toNumber(b.wins) - toNumber(a.wins);
    if (byWins) return byWins;
    const byGames = toNumber(b.games) - toNumber(a.games);
    if (byGames) return byGames;
    return String(a?.playerNick || '').localeCompare(String(b?.playerNick || ''), 'uk');
  });

  const list = createElement('div', 'tournament-players-list');
  sorted.forEach((player, index) => {
    const row = createElement('article', `tournament-player-rank-card${index < 3 ? ` is-top-${index + 1}` : ''}`);
    const teamName = teamMap.get(String(player?.teamId || '')) || toText(player?.teamId);
    const head = createElement('div', 'tournament-player-rank-card__head');
    head.append(createElement('span', '', `#${index + 1}`), createElement('strong', '', toText(player.playerNick, 'Гравець')));
    const stats = createElement('div', 'tournament-player-rank-card__stats');
    stats.append(
      createElement('span', '', `${toNumber(player.games)} гри`),
      createElement('span', '', `${toNumber(player.wins)} перемоги`),
      createElement('span', '', `${toNumber(player.mvpCount)} MVP`)
    );
    const impact = createElement('div', 'tournament-player-rank-card__impact');
    impact.append(
      createElement('strong', '', `Impact ${formatDelta(player.impactPoints)}`),
      createElement('span', '', `MMR ${formatDelta(player.mmrChange)}`)
    );
    row.append(head, createElement('p', 'tournament-player-rank-card__team', teamName), stats, impact);
    list.append(row);
  });
  node.append(list);
}

function renderOverview(node, teams, games, players, teamMap) {
  clear(node);
  const wrap = createElement('div', 'tournament-insight-grid');
  const sortedTeams = [...teams].sort((a, b) => toNumber(b.points) - toNumber(a.points) || toNumber(b.wins) - toNumber(a.wins));
  const leader = sortedTeams[0] || null;
  const latestGame = [...games].sort((a, b) => Date.parse(b?.timestamp || 0) - Date.parse(a?.timestamp || 0))[0] || null;

  const topPlayers = [...players].sort((a, b) => toNumber(b.mvpCount) - toNumber(a.mvpCount) || toNumber(b.impactPoints) - toNumber(a.impactPoints));
  const mvpLeader = topPlayers[0] || null;
  const leaderCard = createElement('article', 'tournament-insight-card');
  leaderCard.append(createElement('h4', '', 'Лідер турніру'));
  if (leader) {
    leaderCard.append(createSimpleLine(`${toText(leader.teamName, toText(leader.teamId))}`), createSimpleLine(`${toNumber(leader.points)} очок · ${toNumber(leader.wins)} перемог`));
  } else {
    leaderCard.append(createSimpleLine('Таблиця ще формується.'));
  }

  const mvpCard = createElement('article', 'tournament-insight-card');
  mvpCard.append(createElement('h4', '', 'MVP турніру'));
  if (mvpLeader) {
    mvpCard.append(createSimpleLine(toText(mvpLeader.playerNick, 'Гравець')), createSimpleLine(`${toNumber(mvpLeader.mvpCount)} MVP · Impact ${formatDelta(mvpLeader.impactPoints)}`));
  } else {
    mvpCard.append(createSimpleLine('Індивідуальний рейтинг ще формується.'));
  }

  const statsCard = createElement('article', 'tournament-insight-card');
  statsCard.append(createElement('h4', '', 'Турнір у цифрах'));
  statsCard.append(
    createStatCell('Команд', teams.length),
    createStatCell('Матчів', games.length),
    createStatCell('Гравців', players.length)
  );
  if (latestGame) {
    const teamA = teamMap.get(String(latestGame?.teamAId || '')) || toText(latestGame?.teamAId);
    const teamB = teamMap.get(String(latestGame?.teamBId || '')) || toText(latestGame?.teamBId);
    statsCard.append(createSimpleLine(`Останній матч: ${teamA} vs ${teamB}`));
  }

  wrap.append(leaderCard, mvpCard, statsCard);
  node.append(wrap);
}
