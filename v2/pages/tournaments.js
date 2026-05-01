import { loadSeasonsConfig } from '../core/dataHub.js';
import { debugLog } from '../core/debug.js';
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

function parseTeamPlayers(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (value == null) return [];
  if (typeof value !== 'string') return [String(value).trim()].filter(Boolean);
  const raw = value.trim();
  if (!raw) return [];
  if (raw.startsWith('[') || raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item || '').trim()).filter(Boolean);
      if (parsed && typeof parsed === 'object') {
        const nested = Array.isArray(parsed.players) ? parsed.players : [];
        if (nested.length) return nested.map((item) => String(item || '').trim()).filter(Boolean);
      }
    } catch {
      // noop
    }
  }
  return raw
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
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
      playersList: parseTeamPlayers(getCell(row, 'players'))
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
  const unavailableSheets = [];

  const unwrapRows = (result, sheetName, required = false) => {
    if (result.status === 'fulfilled') return normalizeRawRows(result.value);
    if (required) throw result.reason;
    unavailableSheets.push(sheetName);
    debugLog('[tournaments] optional sheet unavailable', sheetName, result.reason);
    return [];
  };

  const tournamentsRows = unwrapRows(tournamentsRaw, 'tournaments', true);
  const teamsRows = unwrapRows(teamsRaw, 'tournament_teams');
  const gamesRows = unwrapRows(gamesRaw, 'tournament_games');
  const playersRows = unwrapRows(playersRaw, 'tournament_players');
  const configRows = unwrapRows(configRaw, 'tournament_config');

  debugLog('[tournaments] raw sheets loaded', {
    tournaments: tournamentsRows.length,
    teams: teamsRows.length,
    games: gamesRows.length,
    players: playersRows.length
  });

  const model = normalizeTournamentSheets({ tournamentsRows, teamsRows, gamesRows, playersRows, configRows });
  model.unavailableSheets = unavailableSheets;
  if (unavailableSheets.includes('tournament_games')) {
    Object.values(model.byId || {}).forEach((bucket) => {
      bucket.gamesUnavailable = true;
    });
  }
  debugLog('[tournaments] normalized tournaments', model.tournaments);
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

function createSimpleLine(text) {
  return createElement('p', 'tournament-simple-line', text);
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

function isCompletedTournamentGame(game = {}) {
  return Boolean(
    String(game?.winnerTeamId || '').trim()
    || isTruthy(game?.isDraw)
    || getMatchScoreLabel(game)
    || String(game?.timestamp || '').trim()
  );
}

function getTournamentProgressLabel(teams = [], games = []) {
  const teamCount = Array.isArray(teams) ? teams.length : 0;
  const totalGames = teamCount > 1 ? (teamCount * (teamCount - 1)) / 2 : 0;
  const playedGames = Array.isArray(games) ? games.filter(isCompletedTournamentGame).length : 0;
  return `${playedGames}/${totalGames || playedGames}`;
}

function getTeamStatus(index = 0, total = 0) {
  if (index === 0) return { key: 'leader', label: 'Leader' };
  if (index === 1) return { key: 'qualified', label: 'Qualified' };
  if (total > 2 && index === total - 1) return { key: 'eliminated', label: 'Eliminated' };
  return { key: 'neutral', label: '' };
}

function getTeamGameResult(game = {}, teamId = '') {
  const currentTeamId = String(teamId || '').trim();
  const winnerTeamId = String(game?.winnerTeamId || '').trim();
  if (isTruthy(game?.isDraw)) return 'D';
  if (!winnerTeamId || !currentTeamId) return '';
  return winnerTeamId === currentTeamId ? 'W' : 'L';
}

function getTeamGames(games = [], teamId = '') {
  const currentTeamId = String(teamId || '').trim();
  if (!currentTeamId) return [];
  return [...games]
    .filter((game) => String(game?.teamAId || '').trim() === currentTeamId || String(game?.teamBId || '').trim() === currentTeamId)
    .sort((a, b) => {
      const byDate = Date.parse(b?.timestamp || 0) - Date.parse(a?.timestamp || 0);
      if (Number.isFinite(byDate) && byDate) return byDate;
      return String(b?.gameId || '').localeCompare(String(a?.gameId || ''), undefined, { numeric: true });
    });
}

function getTeamForm(games = [], teamId = '') {
  const form = getTeamGames(games, teamId)
    .filter(isCompletedTournamentGame)
    .map((game) => getTeamGameResult(game, teamId))
    .filter(Boolean)
    .slice(0, 3);
  return form.length ? form : ['-', '-', '-'];
}

function formatTeamMatchLine(game = {}, teamId = '', teamMap) {
  const teamA = getTeamName(game?.teamAId, teamMap);
  const teamB = getTeamName(game?.teamBId, teamMap);
  const result = getTeamGameResult(game, teamId) || '-';
  const score = getMatchScoreLabel(game) || '-';
  return `${result} · ${teamA} ${score.replace(':', ' : ')} ${teamB}`;
}

function formatShortMatchTime(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return 'час не вказано';
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  }
  return formatTournamentDate(raw);
}

function getMatchOutcomeLabel(game = {}, teamMap) {
  if (isTruthy(game?.isDraw)) return 'Нічия';
  const winnerTeamId = String(game?.winnerTeamId || '').trim();
  if (winnerTeamId) return `Перемога: ${getTeamName(winnerTeamId, teamMap)}`;
  return 'Результат очікується';
}

function getMatchSideState(game = {}, teamId = '') {
  if (isTruthy(game?.isDraw)) return { key: 'draw', label: 'DRAW' };
  const winnerTeamId = String(game?.winnerTeamId || '').trim();
  const currentTeamId = String(teamId || '').trim();
  if (!winnerTeamId || !currentTeamId) return { key: 'pending', label: 'WAIT' };
  return winnerTeamId === currentTeamId
    ? { key: 'win', label: 'WIN' }
    : { key: 'loss', label: 'LOSS' };
}

function formatMmrDeltaSummary(game = {}, teamA = 'Команда A', teamB = 'Команда B') {
  const deltaA = formatDelta(game?.teamAMmrDelta);
  const deltaB = formatDelta(game?.teamBMmrDelta);
  if (deltaA === '0' && deltaB === '0') return 'ΔMMR не вказано';
  return `${teamA} ${deltaA} · ${teamB} ${deltaB}`;
}

function findHeadToHeadGame(games = [], teamAId = '', teamBId = '') {
  const a = String(teamAId || '').trim();
  const b = String(teamBId || '').trim();
  if (!a || !b || a === b) return null;
  return games.find((game) => {
    const gameA = String(game?.teamAId || '').trim();
    const gameB = String(game?.teamBId || '').trim();
    return (gameA === a && gameB === b) || (gameA === b && gameB === a);
  }) || null;
}

function getMatrixResult(game, rowTeamId = '') {
  if (!game) return { label: '-', tone: 'pending' };
  const rowId = String(rowTeamId || '').trim();
  const winnerId = String(game?.winnerTeamId || '').trim();
  const isDraw = isTruthy(game?.isDraw) || (!winnerId && String(game?.isDraw || '').trim() !== '');
  const score = getMatchScoreLabel(game);

  if (isDraw) return { label: score || 'D', tone: 'draw' };
  if (!winnerId) return { label: score || '-', tone: 'pending' };
  if (winnerId === rowId) return { label: score || 'W', tone: 'win' };
  return { label: score || 'L', tone: 'loss' };
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

function getTournamentMatchFocus(games = [], teamMap) {
  const sortedGames = [...games]
    .filter((game) => game && (game.teamAId || game.teamBId))
    .sort((a, b) => {
      const byDate = Date.parse(b?.timestamp || 0) - Date.parse(a?.timestamp || 0);
      if (Number.isFinite(byDate) && byDate) return byDate;
      return String(b?.gameId || '').localeCompare(String(a?.gameId || ''), undefined, { numeric: true });
    });
  const current = sortedGames[0] || null;
  return {
    current,
    next: null,
    currentLabel: current ? `${getTeamName(current.teamAId, teamMap)} vs ${getTeamName(current.teamBId, teamMap)}` : 'Матчі ще не зіграні',
    nextLabel: 'Очікує календаря',
  };
}

function renderLatestMatchLine(games = [], teamMap) {
  const focus = getTournamentMatchFocus(games, teamMap);
  const line = createElement('p', 'tournament-event__latest');
  line.textContent = focus.current ? `Останній матч: ${focus.currentLabel}` : 'Матчі ще не зіграні';
  return line;
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
  const gamesUnavailable = Boolean(data?.gamesUnavailable);
  const players = Array.isArray(data?.players) ? [...data.players] : [];
  const tournament = data?.tournament || data || {};
  const title = toText(tournament?.name, toText(tournament?.tournamentId, 'Турнір'));
  const teamMap = new Map(teams.map((team) => [String(team?.teamId || ''), toText(team?.teamName, String(team?.teamId || '—'))]));
  const expandedTeams = new Set();
  const sortedTeams = [...teams].sort((a, b) => toNumber(b.points) - toNumber(a.points) || toNumber(b.wins) - toNumber(a.wins));
  const leader = sortedTeams[0] || null;
  const statusText = statusLabel(tournament?.status || 'ACTIVE');

  clear(node);

  const dashboardCard = createElement('section', 'tournament-panel tournament-dashboard__shell');
  const head = createElement('section', 'tournament-event');
  const headWrap = createElement('header', 'tournament-event__header');
  headWrap.append(
    createElement('h1', 'tournament-event__title', title),
    createElement('p', 'tournament-event__meta', `${statusText} · Лідер: ${leader ? toText(leader.teamName, toText(leader.teamId)) : 'ще немає'} · Прогрес ${getTournamentProgressLabel(teams, games)}`)
  );
  headWrap.append(renderLatestMatchLine(games, teamMap));
  head.append(headWrap);

  const standingsWrap = createElement('section', 'tournament-standings-section');
  const standingsHead = createElement('div', 'tournament-section-head tournament-section-head--compact');
  standingsHead.append(
    createElement('h2', 'tournament-section-head__title', 'Таблиця команд'),
    createElement('p', 'tournament-section-head__sub', `${teams.length} команд · натисни команду, щоб побачити склад`)
  );
  const standingsContent = createElement('div', 'tournament-standings-content');
  standingsWrap.append(standingsHead, standingsContent);

  const tabsWrap = createElement('div', 'tournament-tabs');
  const contentWrap = createElement('div', 'tournament-tab-content');

  const tabs = [
    { key: 'matrix', label: 'Матриця' },
    { key: 'games', label: 'Матчі' },
    { key: 'players', label: 'Гравці' },
    { key: 'overview', label: 'Огляд' }
  ];

  const renderers = {
    matrix: () => renderMatchMatrix(contentWrap, teams, games, teamMap),
    overview: () => renderOverview(contentWrap, teams, games, players, teamMap, { gamesUnavailable }),
    games: () => renderTournamentMatchCards(contentWrap, games, teamMap, { gamesUnavailable, teams }),
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

  dashboardCard.append(head, standingsWrap, tabsWrap, contentWrap);
  node.append(dashboardCard);
  renderTeamsTable(standingsContent, teams, games, teamMap, expandedTeams);
  renderers.matrix();
}

function renderScoreboardPreview(teams, games, players, teamMap) {
  const board = createElement('section', 'tournament-scoreboard');
  const sortedTeams = [...teams].sort((a, b) => toNumber(b.points) - toNumber(a.points) || toNumber(b.wins) - toNumber(a.wins));
  const leader = sortedTeams[0] || null;
  const latestGame = [...games].sort((a, b) => Date.parse(b?.timestamp || 0) - Date.parse(a?.timestamp || 0))[0] || null;

  const leaderBlock = createElement('div', 'tournament-scoreboard__leader');
  leaderBlock.append(createElement('span', '', 'Лідер турніру'));
  if (leader) {
    leaderBlock.append(
      createElement('strong', '', toText(leader?.teamName, toText(leader?.teamId))),
      createElement('b', '', formatPointsLabel(leader?.points)),
      createElement('small', '', formatRecordLabel(leader))
    );
  } else {
    leaderBlock.append(createElement('strong', '', 'Команди ще формуються'));
  }

  const topBlock = createElement('div', 'tournament-scoreboard__top');
  const second = sortedTeams[1] || null;
  const third = sortedTeams[2] || null;
  if (second) topBlock.append(createElement('div', '', `#2 ${toText(second?.teamName, toText(second?.teamId))} — ${formatPointsLabel(second?.points)}`));
  if (third) topBlock.append(createElement('div', '', `#3 ${toText(third?.teamName, toText(third?.teamId))} — ${formatPointsLabel(third?.points)}`));
  if (!second && !third) topBlock.append(createElement('div', '', 'Топ-3 буде після старту матчів'));

  const latestBlock = createElement('div', 'tournament-scoreboard__latest');
  latestBlock.append(createElement('span', '', 'Останній матч'));
  if (latestGame) {
    const teamA = teamMap.get(String(latestGame?.teamAId || '')) || toText(latestGame?.teamAId);
    const teamB = teamMap.get(String(latestGame?.teamBId || '')) || toText(latestGame?.teamBId);
    const score = getMatchScoreLabel(latestGame) || '—';
    latestBlock.append(
      createElement('strong', '', `${teamA} ${score.replace(':', ' : ')} ${teamB}`),
      createElement('small', '', `MVP: ${getMvpLabel(latestGame) || '—'}`)
    );
  } else {
    latestBlock.append(createElement('strong', '', 'Матчі з’являться після першого результату'));
  }

  board.append(leaderBlock, topBlock, latestBlock);
  return board;
}

function pluralizeUa(value, one, few, many) {
  const n = Math.abs(toNumber(value));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function formatPointsLabel(value) {
  const points = toNumber(value);
  return `${points} ${pluralizeUa(points, 'очко', 'очки', 'очок')}`;
}

function formatRecordLabel(record = {}, compact = false) {
  const wins = toNumber(record?.wins);
  const losses = toNumber(record?.losses);
  const draws = toNumber(record?.draws);
  if (compact) return `${wins}В · ${losses}П · ${draws}Н`;
  return [
    `${wins} ${pluralizeUa(wins, 'перемога', 'перемоги', 'перемог')}`,
    `${losses} ${pluralizeUa(losses, 'поразка', 'поразки', 'поразок')}`,
    `${draws} ${pluralizeUa(draws, 'нічия', 'нічиї', 'нічиїх')}`
  ].join(' · ');
}

function renderTeamsTable(node, teams, games = [], teamMap = new Map(), expandedTeams = new Set()) {
  clear(node);
  if (!teams.length) {
    node.append(stateCard('Команди ще формуються', 'Після збереження команд тут з’явиться результат турніру.'));
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

  const wrap = createElement('section', 'tournament-result-view');
  const standings = createElement('div', 'tournament-standings-table');
  standings.setAttribute('role', 'table');
  const header = createElement('div', 'tournament-standings-table__head');
  header.setAttribute('role', 'row');
  ['#', 'Команда', 'В', 'Н', 'П', 'Очки', 'MMR', 'Форма', ''].forEach((label) => {
    header.append(createElement('span', '', label));
  });
  standings.append(header);

  sorted.forEach((team, index) => {
    const teamKey = String(team?.teamId || team?.teamName || `team-${index}`);
    const teamId = String(team?.teamId || '').trim();
    const isExpanded = expandedTeams.has(teamKey);
    const status = getTeamStatus(index, sorted.length);
    const row = createElement('article', `tournament-table-row tournament-standings-row is-${status.key}`);
    row.classList.add('tournament-standings-row');
    row.classList.toggle('is-expanded', isExpanded);

    const topLine = createElement('button', 'tournament-standings-main');
    topLine.type = 'button';
    topLine.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    const teamCell = createElement('span', 'tournament-team-name');
    teamCell.append(createElement('strong', '', toText(team.teamName, toText(team.teamId))));
    if (status.label) teamCell.append(createElement('span', `tournament-team-status tournament-team-status--${status.key}`, status.label));
    const formCell = createElement('span', 'tournament-team-form');
    getTeamForm(games, teamId).forEach((result) => {
      formCell.append(createElement('span', `tournament-form tournament-form--${result.toLowerCase()}`, result));
    });
    topLine.append(
      createElement('span', 'place', `#${index + 1}`),
      teamCell,
      createElement('span', '', String(toNumber(team.wins))),
      createElement('span', '', String(toNumber(team.draws))),
      createElement('span', '', String(toNumber(team.losses))),
      createElement('span', 'points', String(toNumber(team.points))),
      createElement('span', '', String(toNumber(team.mmrCurrent) || '—')),
      formCell,
      createElement('span', 'tournament-team-toggle', isExpanded ? '−' : '+')
    );

    const players = parseTeamPlayers(team?.playersList?.length ? team.playersList : team?.players);
    const roster = createElement('div', 'tournament-team-roster');
    const rosterHead = createElement('div', 'tournament-team-roster__head');
    const playersCount = players.length;
    rosterHead.append(
      createElement('span', '', 'Склад'),
      createElement('span', '', `${playersCount} ${pluralizeUa(playersCount, 'гравець', 'гравці', 'гравців')}`)
    );
    roster.append(rosterHead);

    if (playersCount) {
      const rosterList = createElement('ul', 'tournament-team-roster__list');
      players.forEach((player) => {
        rosterList.append(createElement('li', '', player));
      });
      roster.append(rosterList);
    } else {
      roster.append(createElement('p', 'tournament-team-roster__empty', 'Склад команди ще не збережено'));
    }
    const teamGames = getTeamGames(games, teamId).filter(isCompletedTournamentGame);
    if (teamGames.length) {
      const matchList = createElement('div', 'tournament-team-matches');
      matchList.append(createElement('strong', '', 'Матчі команди'));
      teamGames.slice(0, 5).forEach((game) => {
        matchList.append(createElement('span', '', formatTeamMatchLine(game, teamId, teamMap)));
      });
      roster.append(matchList);
    }

    topLine.addEventListener('click', () => {
      if (expandedTeams.has(teamKey)) expandedTeams.delete(teamKey);
      else expandedTeams.add(teamKey);
      row.classList.toggle('is-expanded', expandedTeams.has(teamKey));
      topLine.setAttribute('aria-expanded', expandedTeams.has(teamKey) ? 'true' : 'false');
      const toggle = topLine.querySelector('.tournament-team-toggle');
      if (toggle) toggle.textContent = expandedTeams.has(teamKey) ? '−' : '+';
    });

    row.append(
      topLine,
      roster
    );
    standings.append(row);
  });
  wrap.append(standings);
  node.append(wrap);
}

function renderMatchMatrix(node, teams, games, teamMap) {
  clear(node);
  if (!Array.isArray(teams) || teams.length < 2) {
    node.append(stateCard('Матриця з’явиться після формування команд', 'Потрібно щонайменше дві команди.'));
    return;
  }

  const sortedTeams = [...teams].sort((a, b) => {
    const byPoints = toNumber(b.points) - toNumber(a.points);
    if (byPoints) return byPoints;
    return String(toText(a.teamName, a.teamId)).localeCompare(String(toText(b.teamName, b.teamId)), 'uk');
  });

  const wrap = createElement('section', 'tournament-matrix-wrap');
  const table = createElement('table', 'tournament-match-matrix');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.append(createElement('th', 'tournament-match-matrix__corner', 'Команди'));
  sortedTeams.forEach((team) => {
    headRow.append(createElement('th', '', toText(team.teamName, toText(team.teamId))));
  });
  thead.append(headRow);

  const tbody = document.createElement('tbody');
  sortedTeams.forEach((rowTeam) => {
    const row = document.createElement('tr');
    const rowTeamId = String(rowTeam?.teamId || '').trim();
    row.append(createElement('th', 'tournament-match-matrix__team', toText(rowTeam.teamName, toText(rowTeam.teamId))));

    sortedTeams.forEach((colTeam) => {
      const cell = document.createElement('td');
      const colTeamId = String(colTeam?.teamId || '').trim();
      if (!rowTeamId || rowTeamId === colTeamId) {
        cell.className = 'tournament-match-matrix__cell tournament-match-matrix__cell--self';
        cell.textContent = '—';
      } else {
        const game = findHeadToHeadGame(games, rowTeamId, colTeamId);
        const result = getMatrixResult(game, rowTeamId);
        cell.className = `tournament-match-matrix__cell tournament-match-matrix__cell--${result.tone}`;
        cell.textContent = result.label;
        if (game) {
          const teamA = getTeamName(game.teamAId, teamMap);
          const teamB = getTeamName(game.teamBId, teamMap);
          const score = getMatchScoreLabel(game) || result.label;
          const mvp = getMvpLabel(game) || '—';
          cell.title = `${teamA} vs ${teamB} · ${score} · MVP: ${mvp}`;
        }
      }
      row.append(cell);
    });
    tbody.append(row);
  });

  table.append(thead, tbody);
  wrap.append(table);
  node.append(wrap);
}

function renderGames(node, games, teamMap, options = {}) {
  clear(node);
  if (options?.gamesUnavailable) {
    node.append(stateCard('Матчі тимчасово недоступні', 'Таблиця команд доступна. Спробуй оновити сторінку пізніше.'));
    return;
  }
  if (!games.length) {
    node.append(stateCard('Матчі з’являться після першого результату'));
    return;
  }

  const sortedGames = [...games].sort((a, b) => {
    const byDate = Date.parse(a?.timestamp || 0) - Date.parse(b?.timestamp || 0);
    if (Number.isFinite(byDate) && byDate) return byDate;
    return String(a?.gameId || '').localeCompare(String(b?.gameId || ''), undefined, { numeric: true });
  });
  const pendingGames = sortedGames.filter((game) => !isCompletedTournamentGame(game));
  const currentGame = pendingGames[0] || null;
  const nextGames = currentGame ? pendingGames.slice(1) : [];
  const playedGames = sortedGames.filter(isCompletedTournamentGame).reverse();
  const recentGames = playedGames.slice(0, 3);
  const olderGames = playedGames.slice(3);

  const renderMatchCard = (game, index) => {
    const teamA = getTeamName(game?.teamAId, teamMap);
    const teamB = getTeamName(game?.teamBId, teamMap);
    const scoreLabel = getMatchScoreLabel(game) || '—';
    const mvpLabel = getMvpLabel(game) || '—';
    const card = createElement('article', 'tournament-match-log');
    const head = createElement('div', 'tournament-match-log__top');
    head.append(
      createElement('span', 'tournament-match-log__id', toText(game?.gameId, `G${index + 1}`)),
      createElement('strong', 'tournament-match-log__teams', `${teamA} vs ${teamB}`),
      createElement('b', '', scoreLabel.replace(':', ' : '))
    );
    const summary = createElement('p', 'tournament-match-log__line tournament-match-log__summary');
    summary.append(
      createElement('span', 'tournament-match-outcome', getMatchOutcomeLabel(game, teamMap)),
      createElement('span', '', formatShortMatchTime(game?.timestamp))
    );
    const details = document.createElement('details');
    details.className = 'tournament-match-details';
    details.append(
      createElement('summary', '', 'Деталі'),
      createElement('p', 'tournament-match-log__line', `MVP: ${mvpLabel}`),
      createElement('p', 'tournament-match-log__line', `ΔMMR: ${teamA} ${formatDelta(game?.teamAMmrDelta)} · ${teamB} ${formatDelta(game?.teamBMmrDelta)}`)
    );
    card.append(
      head,
      summary,
      details
    );
    return card;
  };

  const wrap = createElement('div', 'tournament-match-sections');
  if (currentGame) {
    const section = createElement('section', 'tournament-match-section tournament-match-section--current');
    section.append(createElement('h3', 'tournament-match-section__title', 'Поточний матч'), renderMatchCard(currentGame, 0));
    wrap.append(section);
  }
  if (nextGames.length) {
    const section = createElement('section', 'tournament-match-section');
    const list = createElement('div', 'tournament-match-list');
    nextGames.forEach((game, index) => list.append(renderMatchCard(game, index)));
    section.append(createElement('h3', 'tournament-match-section__title', 'Наступні матчі'), list);
    wrap.append(section);
  }

  if (recentGames.length) {
    const recentSection = createElement('section', 'tournament-match-section tournament-match-section--recent');
    const recentList = createElement('div', 'tournament-match-list');
    recentGames.forEach((game, index) => recentList.append(renderMatchCard(game, index)));
    recentSection.append(createElement('h3', 'tournament-match-section__title', 'Останні 3 матчі'), recentList);
    wrap.append(recentSection);
  }

  if (olderGames.length) {
    const playedSection = createElement('section', 'tournament-match-section');
    const playedList = createElement('div', 'tournament-match-list');
    olderGames.forEach((game, index) => playedList.append(renderMatchCard(game, index)));
    playedSection.append(createElement('h3', 'tournament-match-section__title', 'Всі матчі'), playedList);
    wrap.append(playedSection);
  }

  node.append(wrap);
}

function renderTournamentMatchCards(node, games, teamMap, options = {}) {
  clear(node);
  if (options?.gamesUnavailable) {
    node.append(stateCard('Матчі тимчасово недоступні', 'Таблиця команд доступна. Спробуй оновити сторінку пізніше.'));
    return;
  }
  if (!games.length) {
    node.append(stateCard('Матчі з’являться після першого результату'));
    return;
  }

  const sortedGames = [...games].sort((a, b) => {
    const byDate = Date.parse(a?.timestamp || 0) - Date.parse(b?.timestamp || 0);
    if (Number.isFinite(byDate) && byDate) return byDate;
    return String(a?.gameId || '').localeCompare(String(b?.gameId || ''), undefined, { numeric: true });
  });
  const pendingGames = sortedGames.filter((game) => !isCompletedTournamentGame(game));
  const currentGame = pendingGames[0] || null;
  const nextGames = currentGame ? pendingGames.slice(1) : [];
  const playedGames = sortedGames.filter(isCompletedTournamentGame).reverse();
  const recentGames = playedGames.slice(0, 3);
  const olderGames = playedGames.slice(3);
  const teamById = new Map((options?.teams || []).map((team) => [String(team?.teamId || '').trim(), team]));

  const renderTeamRoster = (teamId = '') => {
    const team = teamById.get(String(teamId || '').trim());
    const players = parseTeamPlayers(team?.playersList?.length ? team.playersList : team?.players);
    return players.length ? players.join(' · ') : 'Склад не вказано';
  };

  const renderDetailBlock = (title, lines = []) => {
    const block = createElement('div', 'tournament-match-detail-block');
    block.append(createElement('h4', '', title));
    lines.filter(Boolean).forEach((line) => block.append(createElement('p', '', line)));
    return block;
  };

  const renderMatchCard = (game, index) => {
    const teamAId = String(game?.teamAId || '').trim();
    const teamBId = String(game?.teamBId || '').trim();
    const teamA = getTeamName(game?.teamAId, teamMap);
    const teamB = getTeamName(game?.teamBId, teamMap);
    const scoreLabel = getMatchScoreLabel(game);
    const displayScore = scoreLabel ? scoreLabel.replace(':', ' : ') : 'VS';
    const mvpLabel = getMvpLabel(game) || 'MVP не вказано';
    const mmrSummary = formatMmrDeltaSummary(game, teamA, teamB);
    const stateA = getMatchSideState(game, teamAId);
    const stateB = getMatchSideState(game, teamBId);
    const card = createElement('article', `tournament-match-log tournament-match-log--hud is-${stateA.key}-${stateB.key}`);

    const top = createElement('div', 'tournament-match-log__top tournament-match-log__top--hud');
    top.append(
      createElement('span', 'tournament-match-log__id', toText(game?.gameId, `G${index + 1}`)),
      createElement('span', 'tournament-match-log__time', formatShortMatchTime(game?.timestamp)),
      createElement('span', 'tournament-match-log__mode', toText(game?.mode, 'Турнірний матч'))
    );

    const matchup = createElement('div', 'tournament-matchup');
    const sideA = createElement('div', `tournament-matchup__side tournament-matchup__side--${stateA.key}`);
    sideA.append(createElement('strong', '', teamA), createElement('span', '', stateA.label));
    const center = createElement('div', 'tournament-matchup__center');
    center.append(createElement('span', '', scoreLabel ? 'SCORE' : 'VS'), createElement('strong', '', displayScore));
    const sideB = createElement('div', `tournament-matchup__side tournament-matchup__side--${stateB.key}`);
    sideB.append(createElement('strong', '', teamB), createElement('span', '', stateB.label));
    matchup.append(sideA, center, sideB);

    const summary = createElement('div', 'tournament-match-log__summary tournament-match-log__summary--hud');
    summary.append(
      createElement('span', 'tournament-match-outcome', getMatchOutcomeLabel(game, teamMap)),
      createElement('span', '', `MVP: ${mvpLabel}`),
      createElement('span', '', `ΔMMR: ${mmrSummary}`)
    );

    const details = document.createElement('details');
    details.className = 'tournament-match-details';
    const detailsGrid = createElement('div', 'tournament-match-details__grid');
    detailsGrid.append(
      renderDetailBlock('Підсумок', [
        getMatchOutcomeLabel(game, teamMap),
        `Час: ${formatTournamentDate(game?.timestamp)}`,
        scoreLabel ? `Рахунок: ${displayScore}` : '',
        toText(game?.mode, '') ? `Режим: ${toText(game?.mode)}` : ''
      ]),
      renderDetailBlock('MVP', [mvpLabel]),
      renderDetailBlock('MMR зміни', [mmrSummary]),
      renderDetailBlock('Склади команд', [
        `${teamA}: ${renderTeamRoster(teamAId)}`,
        `${teamB}: ${renderTeamRoster(teamBId)}`
      ])
    );
    details.append(createElement('summary', '', 'Деталі'), detailsGrid);

    card.append(top, matchup, summary, details);
    return card;
  };

  const wrap = createElement('div', 'tournament-match-sections');
  if (currentGame) {
    const section = createElement('section', 'tournament-match-section tournament-match-section--current');
    section.append(createElement('h3', 'tournament-match-section__title', 'Поточний матч'), renderMatchCard(currentGame, 0));
    wrap.append(section);
  }
  if (nextGames.length) {
    const section = createElement('section', 'tournament-match-section');
    const list = createElement('div', 'tournament-match-list');
    nextGames.forEach((game, index) => list.append(renderMatchCard(game, index)));
    section.append(createElement('h3', 'tournament-match-section__title', 'Наступні матчі'), list);
    wrap.append(section);
  }

  if (recentGames.length) {
    const recentSection = createElement('section', 'tournament-match-section tournament-match-section--recent');
    const recentList = createElement('div', 'tournament-match-list');
    recentGames.forEach((game, index) => recentList.append(renderMatchCard(game, index)));
    recentSection.append(createElement('h3', 'tournament-match-section__title', 'Останні 3 матчі'), recentList);
    wrap.append(recentSection);
  }

  if (olderGames.length) {
    const playedSection = createElement('section', 'tournament-match-section');
    const playedList = createElement('div', 'tournament-match-list');
    olderGames.forEach((game, index) => playedList.append(renderMatchCard(game, index)));
    playedSection.append(createElement('h3', 'tournament-match-section__title', 'Всі матчі'), playedList);
    wrap.append(playedSection);
  }

  node.append(wrap);
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

  const list = createElement('div', 'tournament-player-list');
  sorted.forEach((player, index) => {
    const row = createElement('article', `tournament-player-row${index === 0 ? ' is-leader' : ''}`);
    const teamName = teamMap.get(String(player?.teamId || '')) || toText(player?.teamId);
    const topLine = createElement('div', 'tournament-player-row__top');
    const identity = createElement('div', 'tournament-player-row__identity');
    identity.append(createElement('strong', '', toText(player.playerNick, 'Гравець')), createElement('small', '', teamName));
    const impact = createElement('div', 'tournament-player-row__impact');
    impact.append(createElement('b', '', formatDelta(player.impactPoints)), createElement('small', '', 'Impact'));
    topLine.append(createElement('span', '', `#${index + 1}`), identity, impact);
    row.append(topLine, createElement('p', 'tournament-player-row__meta', `${toNumber(player.games)} гри · ${toNumber(player.wins)} перемоги · ${toNumber(player.mvpCount)} MVP · MMR ${formatDelta(player.mmrChange)}`));
    list.append(row);
  });
  node.append(list);
}

function renderOverview(node, teams, games, players, teamMap, options = {}) {
  clear(node);
  const sortedTeams = [...teams].sort((a, b) => toNumber(b.points) - toNumber(a.points) || toNumber(b.wins) - toNumber(a.wins));
  const leader = sortedTeams[0] || null;
  const topPlayers = [...players].sort((a, b) => toNumber(b.mvpCount) - toNumber(a.mvpCount) || toNumber(b.impactPoints) - toNumber(a.impactPoints));
  const mvpLeader = topPlayers[0] || null;
  const impactLeader = [...players].sort((a, b) => toNumber(b.impactPoints) - toNumber(a.impactPoints) || toNumber(b.mmrChange) - toNumber(a.mmrChange))[0] || null;
  const playedGames = games.filter(isCompletedTournamentGame).length;
  const totalGames = teams.length > 1 ? (teams.length * (teams.length - 1)) / 2 : games.length;
  const safeTotalGames = totalGames || 0;
  const progressPercent = safeTotalGames ? Math.min(100, Math.round((playedGames / safeTotalGames) * 100)) : 0;
  const mvpRecords = players.reduce((sum, player) => sum + toNumber(player?.mvpCount), 0);
  const draws = games.filter((game) => isTruthy(game?.isDraw)).length;
  const gamesUnavailable = Boolean(options?.gamesUnavailable);

  const wrap = createElement('div', 'tournament-overview');

  const statsSection = createElement('section', 'tournament-overview-section');
  statsSection.append(createElement('h3', 'tournament-overview-section__title', 'Турнір у цифрах'));
  const statsGrid = createElement('div', 'tournament-overview-stats');
  [
    ['Команд', teams.length],
    ['Матчів зіграно', gamesUnavailable ? 'Дані тимчасово недоступні' : playedGames],
    ['Усього матчів', safeTotalGames || games.length],
    ['Прогрес', gamesUnavailable ? 'Дані тимчасово недоступні' : `${playedGames}/${safeTotalGames || games.length || 0}`],
    ['MVP записів', mvpRecords],
    ['Нічиїх', gamesUnavailable ? '—' : draws]
  ].forEach(([label, value]) => {
    const card = createElement('article', 'tournament-overview-stat');
    card.append(createElement('span', '', label), createElement('strong', '', String(value ?? 0)));
    statsGrid.append(card);
  });
  statsSection.append(statsGrid);

  const progressSection = createElement('section', 'tournament-overview-section tournament-overview-progress');
  progressSection.append(createElement('h3', 'tournament-overview-section__title', 'Прогрес турніру'));
  progressSection.append(createElement('p', '', gamesUnavailable ? 'Дані матчів тимчасово недоступні' : (safeTotalGames ? `${playedGames} / ${safeTotalGames}` : 'Дані накопичуються')));
  const progressTrack = createElement('div', 'tournament-overview-progress__track');
  const progressFill = createElement('span', 'tournament-overview-progress__fill');
  progressFill.style.width = `${progressPercent}%`;
  progressTrack.append(progressFill);
  progressSection.append(progressTrack);

  const leadersSection = createElement('section', 'tournament-overview-section');
  leadersSection.append(createElement('h3', 'tournament-overview-section__title', 'Лідери турніру'));
  const leadersGrid = createElement('div', 'tournament-insight-grid');
  const createLeaderCard = (title, main, meta, tone = '') => {
    const card = createElement('article', `tournament-overview-card${tone ? ` tournament-overview-card--${tone}` : ''}`);
    card.append(createElement('h4', '', title), createElement('strong', 'tournament-overview-card__main', main || 'Ще немає даних'), createSimpleLine(meta || 'Дані накопичуються'));
    return card;
  };
  leadersGrid.append(
    createLeaderCard('Лідер турніру', leader ? toText(leader.teamName, toText(leader.teamId)) : '', leader ? `${toNumber(leader.points)} очок · ${toNumber(leader.wins)} перемог` : '', 'leader'),
    createLeaderCard('MVP турніру', mvpLeader ? toText(mvpLeader.playerNick, 'Гравець') : '', mvpLeader ? `${toNumber(mvpLeader.mvpCount)} MVP · Impact ${formatDelta(mvpLeader.impactPoints)}` : '', 'mvp'),
    createLeaderCard('Impact player', impactLeader ? toText(impactLeader.playerNick, 'Гравець') : '', impactLeader ? `Impact ${formatDelta(impactLeader.impactPoints)} · MMR ${formatDelta(impactLeader.mmrChange)}` : '', 'impact')
  );
  leadersSection.append(leadersGrid);

  const barsSection = createElement('section', 'tournament-overview-section tournament-overview-bars');
  barsSection.append(createElement('h3', 'tournament-overview-section__title', 'Топ-3 у русі'));
  const createBars = (items, getLabel, getValue, emptyText) => {
    const list = createElement('div', 'tournament-overview-bars__list');
    const maxValue = Math.max(...items.map(getValue), 0);
    if (!items.length || !maxValue) {
      list.append(createSimpleLine(emptyText));
      return list;
    }
    items.forEach((item) => {
      const value = getValue(item);
      const row = createElement('div', 'tournament-overview-bar');
      const fill = createElement('span', 'tournament-overview-bar__fill');
      fill.style.width = `${Math.max(6, Math.round((value / maxValue) * 100))}%`;
      row.append(createElement('span', 'tournament-overview-bar__label', getLabel(item)), fill, createElement('strong', '', String(value)));
      list.append(row);
    });
    return list;
  };
  const teamBars = createElement('article', 'tournament-overview-card tournament-overview-card--leader');
  teamBars.append(createElement('h4', '', 'Топ команд за очками'), createBars(sortedTeams.slice(0, 3), (team) => toText(team.teamName, toText(team.teamId)), (team) => toNumber(team.points), 'Команди ще формуються'));
  const playerBars = createElement('article', 'tournament-overview-card tournament-overview-card--mvp');
  playerBars.append(createElement('h4', '', 'Топ гравців за impact'), createBars([...players].sort((a, b) => toNumber(b.impactPoints) - toNumber(a.impactPoints)).slice(0, 3), (player) => toText(player.playerNick, 'Гравець'), (player) => Math.max(0, toNumber(player.impactPoints)), 'Гравці ще накопичують статистику'));
  const barsGrid = createElement('div', 'tournament-insight-grid');
  barsGrid.append(teamBars, playerBars);
  barsSection.append(barsGrid);

  wrap.append(statsSection, progressSection, leadersSection, barsSection);
  node.append(wrap);
}
