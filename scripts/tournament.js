// scripts/tournament.js
// -------------------------------------------------------------
// VARTA · Tournament View (frontend)
// Працює з реальним backend API (listTournaments / getTournamentData)
// -------------------------------------------------------------

import { fetchTournaments, fetchTournamentData, loadPlayers, normalizeLeague } from './api.js';
import { rankLetterForPoints } from './rankUtils.js';

const DEFAULT_AVATAR = 'assets/default_avatars/av0.png';

// Мапа псевдо → основний нік (щоб підтягувати аватар/ранг з основного рейтингу)
const NICK_MAP = {
  'Юра': 'Morti',
  'Морті': 'Morti',
  'Сегедин': 'Morti',
  'Morti': 'Morti',

  'Ворон': 'Voron',
  'Voron': 'Voron',

  'Оксана': 'Оксанка',
  'Оксанка': 'Оксанка',

  'Даня': 'hAppser',
  'Happser': 'hAppser',
  'hAppser': 'hAppser',

  'Ластон': 'Laston',
  'Laston': 'Laston',

  'Лерес': 'Leres',
  'Leres': 'Leres',

  'Кицюня': 'Кицюня',
  'Кіцюня': 'Кицюня',

  'Кокосік': 'Cocosik',
  'Cocosik': 'Cocosik',

  'Sem': 'Sem',
  'Сем': 'Sem',

  'Justy': 'Justy',
  'Джасті': 'Justy',

  'Темофій': 'Temostar',
  'Темостар': 'Temostar',
  'Temostar': 'Temostar',

  'Олег': 'Олег',
  'Остап': 'Остап',
  'Вова': 'Вова'
};

// Фіксовані кольори команд
const TEAM_COLORS = {
  green: 'var(--team-green)',
  blue: 'var(--team-blue)',
  red: 'var(--team-red)'
};

const state = {
  tournaments: [],
  currentId: null,
  currentRecord: null,
  currentData: null,
  league: null,
  baseLeague: null,
  basePlayers: [],
  baseIndex: new Map(),
  playerVMs: []
};

// ------------------------ helpers ------------------------

function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.tournaments)) return value.tournaments;
  if (value && Array.isArray(value.games)) return value.games;
  return [];
}

function upper(str) {
  return String(str || '').toUpperCase();
}

function buildBaseIndex(players) {
  const index = new Map();
  players.forEach((p) => {
    const nicks = [p.nick, p.apiNick, p.name, p.Nickname, p.nickname]
      .map((v) => (v == null ? '' : String(v).trim()))
      .filter(Boolean);
    nicks.forEach((n) => {
      const key = n.toLowerCase();
      if (!index.has(key)) index.set(key, p);
    });
  });
  return index;
}

function mapNickForBase(nick) {
  const raw = String(nick || '').trim();
  const mapped = NICK_MAP[raw] || raw;
  return mapped.toLowerCase();
}

function rankClass(rank) {
  const letter = String(rank || '').trim().toLowerCase();
  if (!letter) return 'rank-chip rank-xs';
  return `rank-chip rank-xs rank-${letter}`;
}

function getTeamName(teamId, teamsById) {
  return teamsById[teamId]?.teamName || teamId || '';
}

function formatDateRange(t) {
  const start = t?.dateStart || '';
  const end = t?.dateEnd || '';
  if (start && end && start !== end) return `${start} — ${end}`;
  return start || end || 'Дата не вказана';
}

// ------------------------ DOM helpers ------------------------

function $(selector) {
  return document.querySelector(selector);
}

function clearEl(el) {
  if (el) el.innerHTML = '';
}

function show(el) {
  if (el) el.classList.remove('hidden');
}

function hide(el) {
  if (el) el.classList.add('hidden');
}

// ------------------------ HERO + заголовок ------------------------

function renderHero(data) {
  const { tournament, players, teams, games } = data;

  const titleEl = $('#tournament-title');
  const metaEl = $('#tournament-meta');
  const statsEl = $('#tournament-stats');

  if (titleEl) titleEl.textContent = tournament?.name || 'Турнір';
  if (metaEl) {
    const date = formatDateRange(tournament);
    const leagueLabel =
      tournament?.league === 'kids'
        ? 'Молодша ліга'
        : tournament?.league
        ? 'Старша ліга'
        : '';
    metaEl.textContent = [date, leagueLabel, tournament?.notes].filter(Boolean).join(' · ');
  }

  if (!statsEl) return;
  clearEl(statsEl);

  const totalPlayers = players.length;
  const totalTeams = teams.length;
  const totalMatches = games.length;

  const topMvp =
    players.reduce(
      (best, p) => (p.mvpCount > (best?.mvpCount || 0) ? p : best),
      null
    ) || null;

  const podium = [...players]
    .sort((a, b) => (b.impactPoints || 0) - (a.impactPoints || 0))
    .slice(0, 3);

  const cards = [
    { label: 'Гравців', value: totalPlayers },
    { label: 'Команд', value: totalTeams },
    { label: 'Матчів', value: totalMatches }
  ];

  if (topMvp) {
    cards.push({
      label: 'MVP турніру',
      value: `${topMvp.playerNick} (${topMvp.mvpCount})`
    });
  }

  cards.forEach((card) => {
    statsEl.insertAdjacentHTML(
      'beforeend',
      `<div class="stat-card">
         <p class="stat-label">${card.label}</p>
         <p class="stat-value">${card.value}</p>
       </div>`
    );
  });

  if (podium.length) {
    const podiumHtml = podium
      .map((p, i) => {
        const place = i + 1;
        const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉';
        return `<li>${medal} ${p.playerNick}</li>`;
      })
      .join('');

    statsEl.insertAdjacentHTML(
      'beforeend',
      `<div class="stat-card">
         <p class="stat-label">Топ-3 гравців (Impact)</p>
         <ul style="margin:4px 0 0; padding-left:18px;">${podiumHtml}</ul>
       </div>`
    );
  }
}

// ------------------------ ІНФОГРАФІКА ------------------------

function renderInfographic(data) {
  const container = $('#tournament-infographic');
  const section = $('#tournament-infographic-section');
  if (!container || !section) return;

  const { teams, players, games } = data;

  if (!teams.length && !players.length && !games.length) {
    hide(section);
    return;
  }

  show(section);
  clearEl(container);

  const totalWins = teams.reduce((sum, t) => sum + (t.wins || 0), 0);
  const totalDraws = teams.reduce((sum, t) => sum + (t.draws || 0), 0);
  const totalLosses = teams.reduce((sum, t) => sum + (t.losses || 0), 0);

  const modeCounts = games.reduce(
    (acc, g) => {
      const m = upper(g.mode);
      if (m === 'KT') acc.kt += 1;
      else if (m === 'TDM') acc.tdm += 1;
      else acc.dm += 1;
      return acc;
    },
    { dm: 0, kt: 0, tdm: 0 }
  );

  const championTeam =
    [...teams].sort((a, b) => {
      if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
      if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
      return (b.mmrCurrent || 0) - (a.mmrCurrent || 0);
    })[0] || null;

  const topMvp =
    players.reduce(
      (best, p) => (p.mvpCount > (best?.mvpCount || 0) ? p : best),
      null
    ) || null;

  const topImpact =
    players.reduce(
      (best, p) => (p.impactPoints > (best?.impactPoints || 0) ? p : best),
      null
    ) || null;

  // Info chips
  const chips = [
    { label: 'W / D / L', value: `${totalWins} / ${totalDraws} / ${totalLosses}` },
    { label: 'Режими', value: `DM ×${modeCounts.dm} · KT ×${modeCounts.kt} · TDM ×${modeCounts.tdm}` },
    { label: 'Гравців', value: players.length },
    { label: 'Команд', value: teams.length }
  ];

  const chipsHtml = chips
    .map(
      (c) => `
      <div class="info-chip">
        <p class="info-chip__label">${c.label}</p>
        <p class="info-chip__value">${c.value}</p>
      </div>`
    )
    .join('');

  container.insertAdjacentHTML('beforeend', `<div class="infographic-grid">${chipsHtml}</div>`);

  // Awards
  const awardCards = [];

  if (championTeam) {
    awardCards.push({
      icon: '🏆',
      title: 'Champion Team',
      value: championTeam.teamName,
      meta: `W ${championTeam.wins} · D ${championTeam.draws} · L ${championTeam.losses} · Pts ${championTeam.points}`
    });
  }

  if (topMvp) {
    awardCards.push({
      icon: '⭐',
      title: 'MVP турніру',
      value: topMvp.playerNick,
      meta: `${topMvp.mvpCount} MVP`
    });
  }

  if (topImpact) {
    awardCards.push({
      icon: '🔥',
      title: 'Impact King',
      value: topImpact.playerNick,
      meta: `Impact: ${topImpact.impactPoints}`
    });
  }

  if (awardCards.length) {
    const awardHtml = awardCards
      .map(
        (a) => `
      <div class="award-card">
        <div class="award-card__icon">${a.icon}</div>
        <div class="award-card__body">
          <p class="award-card__title">${a.title}</p>
          <p class="award-card__value">${a.value}</p>
          <p class="award-card__meta">${a.meta}</p>
        </div>
      </div>`
      )
      .join('');
    container.insertAdjacentHTML('beforeend', `<div class="award-grid">${awardHtml}</div>`);
  }

  // Team score cards
  const scoreCards = teams
    .map((t) => {
      const total = (t.wins || 0) * 3 + (t.draws || 0);
      const record = `${t.wins || 0}W-${t.draws || 0}D-${t.losses || 0}L`;
      return `
        <div class="score-card team-${t.teamId}-row">
          <div class="score-card__row">
            <span class="team-chip team-chip--${t.teamId}">
              <span class="team-chip__dot"></span>
              <span>${t.teamName}</span>
            </span>
          </div>
          <div class="score-card__stats">${record}</div>
          <div class="score-card__total">${total} очок</div>
          <div class="score-card__meta">MMR: ${t.mmrStart ?? '-'} → ${t.mmrCurrent ?? '-'}</div>
        </div>
      `;
    })
    .join('');

  if (scoreCards) {
    container.insertAdjacentHTML('beforeend', `<div class="score-grid">${scoreCards}</div>`);
  }
}

// ------------------------ Команди ------------------------

function renderTeams(teams) {
  const tbody = $('#teams-table tbody');
  if (!tbody) return;
  clearEl(tbody);

  const sorted = [...teams].sort((a, b) => {
    if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
    if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
    return (b.mmrCurrent || 0) - (a.mmrCurrent || 0);
  });

  sorted.forEach((team, index) => {
    const tr = document.createElement('tr');
    const place = index + 1;
    tr.classList.add(`team-${team.teamId}-row`);

    const teamChip = `
      <span class="team-chip team-chip--${team.teamId}">
        <span class="team-chip__dot"></span>
        <span>${team.teamName}</span>
      </span>
    `;

    tr.innerHTML = `
      <td>${teamChip}</td>
      <td>${team.wins ?? 0}</td>
      <td>${team.losses ?? 0}</td>
      <td>${team.draws ?? 0}</td>
      <td>${team.points ?? 0}</td>
      <td>${Math.round(team.mmrCurrent ?? team.mmrStart ?? 0)}</td>
      <td>${place}</td>
    `;

    tbody.appendChild(tr);
  });
}

// ------------------------ Гравці + модалка ------------------------

function buildPlayerIdentity(p) {
  const avatar = p.avatar || DEFAULT_AVATAR;
  const rank = p.rank || '-';
  const rankHtml = `<span class="${rankClass(rank)}">${rank}</span>`;

  return `
    <div class="player-identity">
      <div class="player-avatar">
        <img src="${avatar}" alt="${p.displayNick}" loading="lazy"
             onerror="this.src='${DEFAULT_AVATAR}'">
      </div>
      <div class="player-name-block">
        <div class="player-name-row">${p.displayNick} ${rankHtml}</div>
        <div class="player-meta">@${p.apiNick}</div>
      </div>
    </div>
  `;
}

function toPlayerVM(playerRow, teamsById, baseIndex, league) {
  const displayNick = playerRow.playerNick;
  const mappedNick = NICK_MAP[displayNick] || displayNick;
  const baseKey = mapNickForBase(displayNick);
  const base = baseIndex.get(baseKey) || baseIndex.get(mappedNick.toLowerCase()) || null;

  const basePoints = base?.pts ?? base?.points ?? null;
  const rank = base?.rank || (basePoints != null ? rankLetterForPoints(basePoints) : null);

  return {
    displayNick,
    apiNick: mappedNick,
    teamId: playerRow.teamId,
    teamName: getTeamName(playerRow.teamId, teamsById),
    league,
    avatar: base?.avatar || base?.avatar_url || DEFAULT_AVATAR,
    rank,
    basePoints,
    baseRaw: base || null,
    games: playerRow.games ?? 0,
    wins: playerRow.wins ?? 0,
    losses: playerRow.losses ?? 0,
    draws: playerRow.draws ?? 0,
    mvps: playerRow.mvpCount ?? 0,
    secondPlaces: playerRow.secondCount ?? 0,
    thirdPlaces: playerRow.thirdCount ?? 0,
    impact: playerRow.impactPoints ?? 0,
    mmrDelta: playerRow.mmrChange ?? 0
  };
}

function renderPlayers(data) {
  const tbody = $('#players-table tbody');
  if (!tbody) return;
  clearEl(tbody);

  const { players, teams, league } = data;
  const teamsById = {};
  teams.forEach((t) => {
    teamsById[t.teamId] = t;
  });

  const baseIndex = state.baseIndex;
  const leagueNorm = normalizeLeague ? normalizeLeague(league) : league;

  const vms = players.map((row) => toPlayerVM(row, teamsById, baseIndex, leagueNorm));

  // Сортуємо по impact
  vms.sort((a, b) => (b.impact || 0) - (a.impact || 0));

  state.playerVMs = vms;

  vms.forEach((p, index) => {
    const tr = document.createElement('tr');
    tr.classList.add('player-row', `team-${p.teamId}-row`);
    tr.dataset.playerIndex = String(index);

    const nickCell = buildPlayerIdentity(p);
    const teamChip = `
      <span class="team-chip team-chip--${p.teamId}">
        <span class="team-chip__dot"></span>
        <span>${p.teamName}</span>
      </span>
    `;
    const mmrDelta =
      p.mmrDelta === 0
        ? '—'
        : p.mmrDelta > 0
        ? `+${p.mmrDelta}`
        : String(p.mmrDelta);

    tr.innerHTML = `
      <td>${nickCell}</td>
      <td>${teamChip}</td>
      <td>${p.games}</td>
      <td>${p.wins}</td>
      <td>${p.losses}</td>
      <td>${p.draws}</td>
      <td>${p.mvps}</td>
      <td>${p.secondPlaces}</td>
      <td>${p.thirdPlaces}</td>
      <td>${p.impact}</td>
      <td>${mmrDelta}</td>
    `;

    tr.addEventListener('click', () => openPlayerModal(p));
    tbody.appendChild(tr);
  });
}

function statItem(label, value) {
  return `
    <div class="stat-item">
      <span class="label">${label}</span>
      <span class="value">${value}</span>
    </div>
  `;
}

function openPlayerModal(p) {
  const modal = $('#player-modal');
  const content = $('#player-modal-content');
  const closeBtn = modal?.querySelector('.player-modal__close');
  if (!modal || !content || !closeBtn) return;

  const avatar = p.avatar || DEFAULT_AVATAR;
  const rank = p.rank || '-';

  const header = `
    <div class="player-modal__header">
      <div class="player-modal__avatar">
        <img src="${avatar}" alt="${p.displayNick}" loading="lazy"
             onerror="this.src='${DEFAULT_AVATAR}'">
      </div>
      <div class="player-modal__title">
        <div class="player-name-row" style="font-size:1.1rem;">
          ${p.displayNick} <span class="${rankClass(rank)}">${rank}</span>
        </div>
        <div class="modal-sub">@${p.apiNick} · ${p.teamName}</div>
      </div>
      <span class="tag">MMR: ${p.basePoints ?? '—'}</span>
    </div>
  `;

  const tournamentBlock = `
    <div class="info-card">
      <h3>Статистика турніру</h3>
      <div class="stat-list">
        ${statItem('Ігор', p.games)}
        ${statItem('W', p.wins)}
        ${statItem('L', p.losses)}
        ${statItem('D', p.draws)}
        ${statItem('MVP', p.mvps)}
        ${statItem('2 місце', p.secondPlaces)}
        ${statItem('3 місце', p.thirdPlaces)}
        ${statItem('Impact', p.impact)}
        ${statItem('MMR Δ', p.mmrDelta === 0 ? '—' : p.mmrDelta > 0 ? `+${p.mmrDelta}` : String(p.mmrDelta))}
      </div>
    </div>
  `;

  const baseBlock =
    p.baseRaw != null
      ? `
    <div class="info-card">
      <h3>Рейтинг VARTA (основний)</h3>
      <div class="stat-list">
        ${statItem('Нік у рейтингу', p.baseRaw.nick || p.apiNick)}
        ${statItem('Ліга', p.league || '—')}
        ${statItem('Ранг', p.baseRaw.rank || rank || '—')}
        ${statItem('MMR', p.basePoints ?? '—')}
      </div>
    </div>
  `
      : `
    <div class="info-card">
      <h3>Рейтинг VARTA</h3>
      <p class="empty-note">
        Гравця не знайдено у поточній рейтинговій таблиці. Можливо, інший нік або ще не доданий.
      </p>
    </div>
  `;

  content.innerHTML = `
    ${header}
    <div class="player-modal__grid">
      ${tournamentBlock}
      ${baseBlock}
    </div>
  `;

  const hideModal = () => {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    modal.removeEventListener('click', onBackdrop);
    document.removeEventListener('keydown', onKey);
    closeBtn.removeEventListener('click', hideModal);
  };

  const onBackdrop = (e) => {
    if (e.target === modal) hideModal();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') hideModal();
  };

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  modal.addEventListener('click', onBackdrop);
  document.addEventListener('keydown', onKey);
  closeBtn.addEventListener('click', hideModal);
}

// ------------------------ Матчі ------------------------

function renderMatches(data) {
  const container = $('#matches-container');
  if (!container) return;
  clearEl(container);

  const { games, teams } = data;
  const teamsById = {};
  teams.forEach((t) => {
    teamsById[t.teamId] = t;
  });

  games.forEach((g) => {
    const mode = upper(g.mode || 'DM');
    const teamAName = getTeamName(g.teamAId, teamsById);
    const teamBName = getTeamName(g.teamBId, teamsById);

    let titleMode = mode;
    if (mode === 'KT') titleMode = 'KT · Точка';
    else if (mode === 'TDM') titleMode = 'TDM';
    else titleMode = 'DM';

    const isDraw = String(g.isDraw || '').toUpperCase() === 'TRUE' || !g.winnerTeamId;
    let resultText;

    if (isDraw) {
      resultText = 'Нічия';
    } else {
      const winnerName = getTeamName(g.winnerTeamId, teamsById);
      resultText = `Перемога: ${winnerName}`;
    }

    const mmrLine =
      g.teamAMmrDelta != null && g.teamBMmrDelta != null
        ? `MMR: ${g.teamAId}: ${g.teamAMmrBefore} → ${g.teamAMmrBefore + g.teamAMmrDelta}, `
          + `${g.teamBId}: ${g.teamBMmrBefore} → ${g.teamBMmrBefore + g.teamBMmrDelta}`
        : '';

    const mvpLine = [g.mvpNick, g.secondNick, g.thirdNick]
      .filter(Boolean)
      .join(', ');

    const ts = g.timestamp ? new Date(g.timestamp) : null;
    const timeLabel = ts && !Number.isNaN(ts.getTime()) ? ts.toLocaleString('uk-UA') : '';

    container.insertAdjacentHTML(
      'beforeend',
      `
      <article class="match-card">
        <h3 class="match-title">${titleMode} · ${teamAName} vs ${teamBName}</h3>
        ${timeLabel ? `<p class="match-meta">${timeLabel}</p>` : ''}
        <p class="result-line"><strong>${resultText}</strong></p>
        ${mvpLine ? `<p class="match-meta">Top-3: ${mvpLine}</p>` : ''}
        ${mmrLine ? `<p class="match-meta">${mmrLine}</p>` : ''}
        ${g.notes ? `<p class="match-meta">Примітка: ${g.notes}</p>` : ''}
      </article>
    `
    );
  });
}

// ------------------------ Список турнірів ------------------------

function renderTournamentList(tournaments) {
  const section = $('#tournament-selector');
  const listEl = $('#tournament-list');
  const emptyEl = $('#tournaments-empty');
  const backBtn = $('#back-to-selector');

  if (!section || !listEl || !emptyEl) return;

  clearEl(listEl);

  if (!tournaments.length) {
    show(section);
    show(emptyEl);
    if (backBtn) hide(backBtn);
    return;
  }

  hide(emptyEl);
  show(section);
  if (backBtn) hide(backBtn);

  tournaments.forEach((t) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="t-info">
        <span class="t-name">${t.name}</span>
        <span class="t-meta">${formatDateRange(t)} · ${t.league || ''} · ${t.status || ''}</span>
      </div>
      <button class="btn secondary">Відкрити</button>
    `;
    const btn = li.querySelector('button');
    if (btn) {
      btn.addEventListener('click', () => openTournament(t));
    }
    listEl.appendChild(li);
  });
}

// ------------------------ Завантаження даних ------------------------

async function ensureBasePlayers(league) {
  const normalized = normalizeLeague ? normalizeLeague(league) : league;
  if (state.baseLeague === normalized && state.basePlayers.length) return;

  try {
    const players = await loadPlayers(normalized);
    state.basePlayers = players || [];
    state.baseIndex = buildBaseIndex(state.basePlayers);
    state.baseLeague = normalized;
  } catch (err) {
    // якщо не вдалося — просто працюємо без базового рейтингу
    console.error('[tournament] loadPlayers error', err);
    state.basePlayers = [];
    state.baseIndex = new Map();
    state.baseLeague = normalized;
  }
}

async function loadTournamentList() {
  const headerMeta = $('#tournament-meta');
  const statsEl = $('#tournament-stats');
  if (headerMeta) headerMeta.textContent = 'Завантаження списку турнірів…';
  if (statsEl) clearEl(statsEl);

  try {
    const res = await fetchTournaments();
    const tournaments = safeArray(res);
    state.tournaments = tournaments;
    renderTournamentList(tournaments);

    if (headerMeta) headerMeta.textContent = 'Оберіть турнір зі списку нижче';

    // Якщо є хоча б один — одразу відкриваємо перший
    if (tournaments.length) {
      await openTournament(tournaments[0]);
    }
  } catch (err) {
    console.error('[tournament] fetchTournaments error', err);
    if (headerMeta) headerMeta.textContent = 'Помилка завантаження списку турнірів';
  }
}

async function openTournament(tournamentRecord) {
  const teamsSection = $('#tournament-teams-section');
  const playersSection = $('#tournament-players-section');
  const gamesSection = $('#tournament-games-section');
  const infSection = $('#tournament-infographic-section');
  const selectorSection = $('#tournament-selector');
  const backBtn = $('#back-to-selector');

  if (selectorSection) hide(selectorSection);
  if (teamsSection) show(teamsSection);
  if (playersSection) show(playersSection);
  if (gamesSection) show(gamesSection);
  if (infSection) show(infSection);
  if (backBtn) show(backBtn);

  const metaEl = $('#tournament-meta');
  if (metaEl) metaEl.textContent = 'Завантаження турніру…';

  try {
    const res = await fetchTournamentData(tournamentRecord.tournamentId);
    const payload = res && res.status ? res : { status: 'OK', ...res };

    if (payload.status && payload.status !== 'OK') {
      if (metaEl) metaEl.textContent = payload.message || 'Помилка завантаження турніру';
      return;
    }

    const tournament = payload.tournament || tournamentRecord;
    const teams = safeArray(payload.teams || []);
    const games = safeArray(payload.games || []);
    const players = safeArray(payload.players || []);

    state.currentId = tournament.tournamentId;
    state.currentRecord = tournament;
    state.currentData = { tournament, teams, games, players, config: payload.config || {} };
    state.league = tournament.league || state.league || 'sundaygames';

    await ensureBasePlayers(state.league);

    const dataForRender = {
      tournament,
      teams,
      games,
      players,
      league: state.league
    };

    renderHero(dataForRender);
    renderTeams(teams);
    renderPlayers(dataForRender);
    renderMatches(dataForRender);
    renderInfographic(dataForRender);
  } catch (err) {
    console.error('[tournament] fetchTournamentData error', err);
    if (metaEl) metaEl.textContent = 'Помилка завантаження турніру';
  }
}

// ------------------------ INIT ------------------------

function initTournamentPage() {
  const refreshBtn = $('#refresh-tournament');
  const backBtn = $('#back-to-selector');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (state.currentId && state.currentRecord) {
        openTournament(state.currentRecord);
      } else {
        loadTournamentList();
      }
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      renderTournamentList(state.tournaments || []);
      const selectorSection = $('#tournament-selector');
      const teamsSection = $('#tournament-teams-section');
      const playersSection = $('#tournament-players-section');
      const gamesSection = $('#tournament-games-section');
      const infSection = $('#tournament-infographic-section');

      if (selectorSection) show(selectorSection);
      if (teamsSection) hide(teamsSection);
      if (playersSection) hide(playersSection);
      if (gamesSection) hide(gamesSection);
      if (infSection) hide(infSection);

      const metaEl = $('#tournament-meta');
      if (metaEl) metaEl.textContent = 'Оберіть турнір зі списку нижче';
    });
  }

  loadTournamentList();
}

document.addEventListener('DOMContentLoaded', initTournamentPage);
