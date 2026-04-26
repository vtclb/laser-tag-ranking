const TOURNAMENTS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxzIEh2-gluSxvtUqCDmpGodhFntF-t59Q9OSBEjTxqdfURS3MlYwm6vcZ-1s4XPd0kHQ/exec';

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toText(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
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

function stateCard(title, text = '', className = 'px-card') {
  const wrap = createElement('article', `${className} tournament-status`);
  wrap.append(createElement('h3', 'px-card__title', title));
  if (text) wrap.append(createElement('p', 'px-card__text', text));
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
  return 'Спробуй оновити сторінку або перевірити підключення до API';
}

function statusClass(status = '') {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('active')) return 'is-active';
  if (normalized.includes('finished')) return 'is-finished';
  return 'is-neutral';
}

function statusLabel(status = '') {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('active')) return 'Активний';
  if (normalized.includes('finished')) return 'Завершений';
  return toText(status);
}

function actionLabel(status = '') {
  return statusClass(status) === 'is-active' ? 'Відкрити' : 'Переглянути';
}

function shortTimestamp(value) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  return raw.replace('T', ' ').replace('Z', '');
}

function renderRankBadge(rank) {
  const badge = createElement('span', 't-rank-badge', toText(rank, '—'));
  return badge;
}

async function postTournamentJson(payload, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(TOURNAMENTS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    if (json?.status === 'ERR') {
      throw new Error(json?.message || 'Помилка завантаження турнірів');
    }
    return json;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function initTournamentsPage(params = {}) {
  const root = document.getElementById('tournamentsRoot');
  if (!root) return;

  clear(root);

  const hero = createElement('section', 'px-card tournaments-hero');
  hero.append(
    createElement('h1', 'px-card__title', 'Турніри'),
    createElement('p', 'px-card__text', 'Командні битви, результати матчів, MVP і прогрес команд')
  );

  const listWrap = createElement('section', 'px-card tournament-list');
  const listHeading = createElement('div', 'tournament-list__heading');
  listHeading.append(
    createElement('h2', 'px-card__title', 'Активні турніри'),
    createElement('p', 'px-card__text', 'Оберіть турнір, щоб переглянути таблицю, матчі та статистику')
  );

  const dashboard = createElement('section', 'tournament-dashboard');
  listWrap.append(listHeading, stateCard('Завантаження турнірів...', 'Отримуємо список активних ігор'));
  root.append(hero, listWrap, dashboard);

  try {
    const listData = await postTournamentJson({ action: 'listTournaments', mode: 'tournament', status: 'ACTIVE' });
    const tournaments = Array.isArray(listData?.tournaments) ? listData.tournaments : [];

    listWrap.replaceChildren(listHeading);
    if (!tournaments.length) {
      listWrap.append(stateCard('Активних турнірів поки немає', 'Список оновиться, щойно з’явиться новий турнір'));
      dashboard.replaceChildren(stateCard('Оберіть турнір', 'Дані таблиці та матчів з’являться тут'));
      return;
    }

    const selectedId = String(params.selected || params.id || '').trim();
    const grid = createElement('div', 'tournament-list__grid');
    let autoOpenId = '';

    tournaments.forEach((tournament, idx) => {
      const card = createElement('article', 'tournament-card');
      const tournamentId = String(tournament?.tournamentId || tournament?.id || '').trim();
      if (!autoOpenId && selectedId && selectedId === tournamentId) autoOpenId = tournamentId;
      if (!autoOpenId && idx === 0) autoOpenId = tournamentId;

      card.setAttribute('data-tournament-id', tournamentId);
      card.append(createElement('h3', 'tournament-card__title', toText(tournament?.name, `Турнір ${idx + 1}`)));

      const meta = createElement('div', 'tournament-card__meta');
      meta.append(
        createMetaItem('Ліга', toText(tournament?.league)),
        createMetaItem('Статус', statusLabel(tournament?.status || 'ACTIVE'), `status-${statusClass(tournament?.status)}`),
        createMetaItem('Старт', toText(tournament?.startDate, tournament?.createdAt || '—'))
      );
      card.append(meta);

      const actions = createElement('div', 'tournament-card__actions');
      const openBtn = createElement('button', 'btn tournament-open-btn', actionLabel(tournament?.status));
      openBtn.type = 'button';
      openBtn.addEventListener('click', () => openTournament(tournamentId, dashboard, grid));
      actions.append(openBtn);
      card.append(actions);

      card.addEventListener('click', (event) => {
        if (event.target instanceof HTMLElement && event.target.closest('button')) return;
        openTournament(tournamentId, dashboard, grid);
      });

      grid.append(card);
    });

    listWrap.append(grid);
    if (autoOpenId) await openTournament(autoOpenId, dashboard, grid, true);
  } catch (error) {
    console.warn('[tournaments] list failed', error);
    listWrap.replaceChildren(listHeading, stateCard('Не вдалося завантажити турніри', sanitizeErrorMessage(), 'px-card px-card--accent'));
  }
}

function activateTournamentCard(listNode, nextId) {
  listNode?.querySelectorAll('.tournament-card').forEach((card) => {
    const selected = card.getAttribute('data-tournament-id') === nextId;
    card.classList.toggle('is-selected', selected);
  });
}

async function openTournament(tournamentId, dashboardNode, listNode, silentHashUpdate = false) {
  if (!dashboardNode || !tournamentId) return;
  activateTournamentCard(listNode, tournamentId);
  dashboardNode.replaceChildren(stateCard('Завантаження даних турніру...', 'Будь ласка, зачекай'));

  try {
    const data = await postTournamentJson({
      action: 'getTournamentData',
      mode: 'tournament',
      tournamentId
    });

    if (!silentHashUpdate) {
      const nextHash = `#tournaments?selected=${encodeURIComponent(tournamentId)}`;
      if (location.hash !== nextHash) {
        history.replaceState(null, '', nextHash);
      }
    }

    renderTournamentDashboard(dashboardNode, data);
  } catch (error) {
    console.warn('[tournaments] dashboard failed', error);
    dashboardNode.replaceChildren(stateCard('Не вдалося завантажити турнір', sanitizeErrorMessage(), 'px-card px-card--accent'));
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
  meta.append(
    createMetaItem('Ліга', toText(tournament?.league)),
    createMetaItem('Статус', statusLabel(tournament?.status || 'ACTIVE'), `status-${statusClass(tournament?.status)}`),
    createMetaItem('Старт', toText(tournament?.startDate, tournament?.createdAt || '—'))
  );

  const tabsWrap = createElement('div', 'tournament-tabs');
  const contentWrap = createElement('div', 'tournament-tab-content');

  const tabs = [
    { key: 'table', label: 'Таблиця' },
    { key: 'teams', label: 'Команди' },
    { key: 'games', label: 'Матчі' },
    { key: 'players', label: 'Гравці' }
  ];

  const renderers = {
    table: () => renderTeamsTable(contentWrap, teams),
    teams: () => renderTeamsCards(contentWrap, teams),
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

  dashboardCard.append(head, meta, tabsWrap, contentWrap);
  node.append(dashboardCard);
  renderers.table();
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
    const games = toNumber(team.wins) + toNumber(team.losses) + toNumber(team.draws);
    [
      String(index + 1),
      toText(team.teamName, toText(team.teamId)),
      String(games),
      String(toNumber(team.wins)),
      String(toNumber(team.losses)),
      String(toNumber(team.draws)),
      String(toNumber(team.points)),
      String(toNumber(team.mmrCurrent))
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

function renderTeamsCards(node, teams) {
  clear(node);
  if (!teams.length) {
    node.append(stateCard('Команди ще не збережені', 'Склади команд будуть показані після додавання учасників'));
    return;
  }

  const grid = createElement('div', 'tournament-team-grid');
  teams.forEach((team) => {
    const card = createElement('article', 'tournament-team-card');
    const players = String(team?.players || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    card.append(createElement('h3', 'tournament-team-card__title', toText(team.teamName, toText(team.teamId))));

    const stats = createElement('div', 'tournament-team-card__stats');
    stats.append(
      createMetaItem('W/L/D', `${toNumber(team.wins)}/${toNumber(team.losses)}/${toNumber(team.draws)}`),
      createMetaItem('Очки', String(toNumber(team.points))),
      createMetaItem('MMR', String(toNumber(team.mmrCurrent))),
      createMetaItem('Ранг', toText(team.rank))
    );
    card.append(stats);

    if (players.length) {
      const ul = createElement('ul', 'tournament-team-card__players');
      players.forEach((nick) => ul.append(createElement('li', '', nick)));
      card.append(ul);
    }

    grid.append(card);
  });

  node.append(grid);
}

function renderGames(node, games, teamMap) {
  clear(node);
  if (!games.length) {
    node.append(stateCard('Матчі ще не зіграні', 'Лог матчів з’явиться після першої гри'));
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
      createElement('span', 'tournament-match-card__id', `ID: ${toText(game?.gameId)}`),
      createElement('span', 'tournament-match-card__mode', toText(game?.mode)),
      createElement('span', 'tournament-match-card__time', shortTimestamp(game?.timestamp))
    );

    const middle = createElement('div', 'tournament-match-card__middle', `${teamA} vs ${teamB}`);

    const bottom = createElement('div', 'tournament-match-card__bottom');
    bottom.append(
      createMetaItem('Результат', String(game?.winnerTeamId || '').trim() ? winner : 'Нічия'),
      createMetaItem('MVP', `${toText(game?.mvpNick)} / ${toText(game?.secondNick)} / ${toText(game?.thirdNick)}`),
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
    node.append(stateCard('Статистика гравців з’явиться після першого матчу', 'Після матчу тут буде рейтинг гравців'));
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

  const wrap = createElement('div', 'tournament-table-wrap');
  const table = createElement('table', 'tournament-player-table');
  const thead = createElement('thead');
  const tbody = createElement('tbody');

  const headRow = createElement('tr');
  ['Гравець', 'Команда', 'І', 'В', 'П', 'Н', 'MVP', '2', '3', 'Impact', 'MMR +/-'].forEach((title) => {
    headRow.append(createElement('th', '', title));
  });

  sorted.forEach((player) => {
    const tr = createElement('tr');
    const teamName = teamMap.get(String(player?.teamId || '')) || toText(player?.teamId);
    [
      toText(player.playerNick),
      teamName,
      String(toNumber(player.games)),
      String(toNumber(player.wins)),
      String(toNumber(player.losses)),
      String(toNumber(player.draws)),
      String(toNumber(player.mvpCount)),
      String(toNumber(player.secondCount)),
      String(toNumber(player.thirdCount)),
      String(toNumber(player.impactPoints)),
      String(toNumber(player.mmrChange))
    ].forEach((cell) => tr.append(createElement('td', '', cell)));
    tbody.append(tr);
  });

  thead.append(headRow);
  table.append(thead, tbody);
  wrap.append(table);
  node.append(wrap);
}
