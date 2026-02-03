// VARTA · Tournament view
// -------------------------------------------------------------

import {
  loadPlayers,
  fetchTournamentData,
  fetchTournaments,
  normalizeLeague,
  avatarNickKey,
  fetchAvatarsMap,
  avatarSrcFromRecord
} from './api.js?v=2025-09-19-avatars-2';
import { reloadAvatars } from './avatars.client.js?v=2025-09-19-avatars-2';
import { rankLetterForPoints } from './rankUtils.js?v=2025-09-19-avatars-2';

const DEFAULT_AVATAR = 'assets/default_avatars/av0.png';
const PLAYER_NICK_MAP = {
  'морті': 'Morti',
  morti: 'Morti',
  'лерес': 'Leres',
  leres: 'Leres',
  'темостар': 'Temostar',
  temostar: 'Temostar',
  'ластон': 'Laston',
  laston: 'Laston'
};

const INFOKIT_TOTALS = {
  totalShots: 13829,
  totalHits: 1271,
  totalMisses: 12558,
  totalFrags: 582,
  avgAccuracy: 9.2,
  topAccuracy: { nick: 'Morti', value: '84%' },
  topFrags: { nick: 'Morti', value: 87 },
  topHits: { nick: 'Morti', value: 177 }
};

const INFOGRAPHIC_PLAYERS = [
  {
    nick: 'Morti',
    id: 3,
    teamId: '',
    score: 260,
    efficiency: 1.61,
    frags: 87,
    deactivations: 54,
    shots: 211,
    hits: 177,
    misses: 34,
    accuracyPercent: 84
  },
  {
    nick: 'Leres',
    id: 4,
    teamId: '',
    score: 233,
    efficiency: 1.47,
    frags: 75,
    deactivations: 51,
    shots: 1532,
    hits: 162,
    misses: 1370,
    accuracyPercent: 11
  },
  {
    nick: 'Temostar',
    id: 17,
    teamId: '',
    score: 212,
    efficiency: 1.76,
    frags: 72,
    deactivations: 41,
    shots: 1663,
    hits: 144,
    misses: 1519,
    accuracyPercent: 9
  },
  {
    nick: 'Laston',
    id: 14,
    teamId: '',
    score: 203,
    efficiency: 1.25,
    frags: 69,
    deactivations: 55,
    shots: 634,
    hits: 136,
    misses: 498,
    accuracyPercent: 21
  }
];

const state = {
  tournamentId: '',
  info: null,
  teams: [],
  games: [],
  players: [],
  league: '',
  basePlayers: [],
  playerIndex: new Map()
};

function escapeHtml(value) {
  const str = String(value ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mapNick(nick) {
  const key = String(nick || '').trim().toLowerCase();
  return PLAYER_NICK_MAP[key] || nick;
}

function normalizeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function formatDateRange(start, end) {
  if (!start && !end) return '';
  if (start && end) return `${start} — ${end}`;
  return start || end || '';
}

function buildBaseIndex(players) {
  const index = new Map();
  players.forEach((p) => {
    const nick = String(p.nick || p.Nickname || p.nickname || '').trim();
    if (!nick) return;
    index.set(nick.toLowerCase(), p);
  });
  return index;
}

async function enrichPlayersWithAvatars(players) {
  try {
    const mapResult = await fetchAvatarsMap();
    const mapping = (mapResult && mapResult.mapping) || {};
    return players.map((p) => {
      const key = avatarNickKey(p.nick || p.playerNick || '');
      const mappedValue = mapping[key];
      const mappedUrl = typeof mappedValue === 'string'
        ? mappedValue
        : avatarSrcFromRecord(mappedValue);
      if (mappedUrl) return { ...p, avatar: mappedUrl };
      return p;
    });
  } catch (err) {
    console.warn('[tournament] enrichPlayersWithAvatars failed', err);
    return players;
  }
}

function resolveAvatar(nick) {
  if (!nick) return DEFAULT_AVATAR;
  const base = state.playerIndex.get(String(nick).toLowerCase());
  const direct = base?.avatar || base?.avatarUrl || base?.Avatar;
  if (typeof direct === 'string' && direct.length > 4) return direct;
  return DEFAULT_AVATAR;
}

function resolveRank(nick) {
  const base = state.playerIndex.get(String(nick || '').toLowerCase());
  const pts = Number(base?.pts ?? base?.Points ?? base?.points ?? 0);
  return base?.rank || rankLetterForPoints(pts);
}

function buildPlayerIdentity(player, { showTeamChip = true } = {}) {
  const nickShown = player.displayNick || player.nick || player.playerNick;
  const apiNick = player.apiNick || player.nick || player.playerNick;
  const teamClass = player.teamId ? `team-chip team-chip--${player.teamId}` : 'team-chip';
  const rank = player.rank || resolveRank(apiNick) || '';
  const rankBadge = rank
    ? `<span class="${`rank-chip rank-xs rank-${String(rank).toLowerCase()}`}">${rank}</span>`
    : '';
  const avatarSrc = player.avatar || resolveAvatar(apiNick);

  return `
    <div class="player-identity">
      <div class="player-avatar">
        <img class="avatar avatar--sm"
             data-nick="${escapeHtml(apiNick)}"
             src="${escapeHtml(avatarSrc)}"
             alt="${escapeHtml(nickShown)}"
             loading="lazy" />
      </div>
      <div class="player-name-block">
        <div class="player-name-row">
          <span class="player-nick">${escapeHtml(nickShown)}</span>
          ${rankBadge}
        </div>
        <div class="player-meta">
          ${showTeamChip && player.teamName ? `<span class="${teamClass}"><span class="team-chip__dot"></span><span>${escapeHtml(player.teamName)}</span></span>` : ''}
          <span class="player-handle">@${escapeHtml(apiNick)}</span>
        </div>
      </div>
    </div>
  `;
}

function getTournamentIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id') || '';
}

function setTitle(text) {
  const el = document.getElementById('tournament-title');
  if (el) el.textContent = text;
}

function setMeta(text) {
  const el = document.getElementById('tournament-meta');
  if (el) el.textContent = text;
}

function toggleSections(hasId) {
  document.querySelectorAll('[data-requires-id="true"]').forEach((node) => {
    node.classList.toggle('hidden', !hasId);
  });
  const selector = document.getElementById('tournament-selector');
  selector?.classList.toggle('hidden', hasId);
  const backBtn = document.getElementById('back-to-selector');
  backBtn?.classList.toggle('hidden', !hasId);
}

function renderStats({ teams = [], games = [], info = {} }) {
  const container = document.getElementById('tournament-stats');
  if (!container) return;
  container.innerHTML = '';

  const totalTeams = teams.length;
  const totalGames = games.length;
  const playedGames = games.filter((g) => g.winnerTeamId || g.isDraw === 'TRUE' || g.isDraw === true).length;

  const stats = [
    { label: 'Назва турніру', value: info.name || info.tournamentId || '—' },
    { label: 'Ліга', value: info.league || '—' },
    { label: 'Дати', value: formatDateRange(info.dateStart, info.dateEnd) || '—' },
    { label: 'Статус', value: info.status || '—' },
    { label: 'Кількість команд', value: totalTeams },
    { label: 'Матчі зіграно / всього', value: `${playedGames} / ${totalGames}` }
  ];

  stats.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    const label = document.createElement('p');
    label.className = 'stat-label';
    label.textContent = item.label;
    const value = document.createElement('p');
    value.className = 'stat-value';
    value.textContent = item.value;
    card.append(label, value);
    container.appendChild(card);
  });
}

function normalizeTeam(team) {
  const wins = normalizeNumber(team.wins);
  const draws = normalizeNumber(team.draws);
  const losses = normalizeNumber(team.losses);
  const points = team.points != null ? normalizeNumber(team.points) : wins * 3 + draws;
  const mmrCurrent = normalizeNumber(team.mmrCurrent || team.avgPts || team.teamStrengthIndex);
  return { ...team, wins, draws, losses, points, mmrCurrent };
}

function computeTeams(teams = []) {
  return [...teams]
    .map(normalizeTeam)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.mmrCurrent - a.mmrCurrent;
    })
    .map((team, index) => ({ ...team, place: index + 1 }));
}

function renderTeamsTable(teams = []) {
  const tbody = document.querySelector('#teams-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const sorted = computeTeams(teams);
  sorted.forEach((team) => {
    const tr = document.createElement('tr');
    const nameCell = document.createElement('td');
    nameCell.innerHTML = `
      <span class="team-chip team-chip--${escapeHtml(team.teamId || '')}">
        <span class="team-chip__dot"></span>
        <span>${escapeHtml(team.teamName || team.teamId || '—')}</span>
      </span>`;
    tr.appendChild(nameCell);

    const values = [
      `${team.wins} / ${team.draws} / ${team.losses}`,
      team.dmRoundsWon || team.dm || 0,
      team.ktPoints || team.kt || 0,
      team.tdmScore || team.tdm || 0,
      team.points,
      team.mmrCurrent ? team.mmrCurrent.toFixed(1) : '—',
      team.place
    ];

    values.forEach((val) => {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

function buildPlayerMap(players = []) {
  const map = new Map();
  players.forEach((p) => map.set(String(p.playerNick || p.nick).trim(), p));
  return map;
}

function preparePlayers(players = [], teamNames = {}) {
  return players.map((p) => {
    const nick = mapNick(p.playerNick || p.nick || '');
    const apiNick = mapNick(p.apiNick || p.playerNick || p.nick || '');
    const rank = p.rank || resolveRank(apiNick);
    const avatar = p.avatar || resolveAvatar(apiNick);
    return {
      ...p,
      displayNick: nick,
      apiNick,
      teamName: teamNames[p.teamId] || p.teamId || '—',
      games: normalizeNumber(p.games),
      wins: normalizeNumber(p.wins),
      losses: normalizeNumber(p.losses),
      draws: normalizeNumber(p.draws),
      mvpCount: normalizeNumber(p.mvpCount),
      secondCount: normalizeNumber(p.secondCount),
      thirdCount: normalizeNumber(p.thirdCount),
      impactPoints: normalizeNumber(p.impactPoints),
      mmrChange: normalizeNumber(p.mmrChange),
      rank,
      avatar
    };
  });
}

function renderTeamCards(teams = [], players = []) {
  const grid = document.getElementById('teams-cards-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const playerMap = buildPlayerMap(players);

  computeTeams(teams).forEach((team) => {
    const teamPlayers = players.filter((p) => p.teamId === team.teamId);
    const rows = teamPlayers
      .map((p) => {
        const stats = playerMap.get(p.playerNick) || p;
        const winRate = stats.games > 0 ? `${Math.round((stats.wins / stats.games) * 100)}%` : '—';
        const points = stats.points ?? stats.pts ?? stats.Points ?? '—';
        const rankValue = stats.rank || resolveRank(stats.apiNick || stats.playerNick) || '—';
        return `
          <tr>
            <td>${buildPlayerIdentity({ ...stats, teamId: team.teamId, teamName: team.teamName, displayNick: p.displayNick || p.playerNick })}</td>
            <td>${points}</td>
            <td>${rankValue}</td>
            <td>${stats.games}</td>
            <td>${winRate}</td>
            <td>${stats.mvpCount}</td>
            <td>${stats.impactPoints}</td>
          </tr>`;
      })
      .join('');

    const total = (team.dmRoundsWon || team.dm || 0) + (team.ktPoints || team.kt || 0) + (team.tdmScore || team.tdm || 0);

    grid.insertAdjacentHTML(
      'beforeend',
      `<article class="team-card team-${escapeHtml(team.teamId || '')}-row">
        <div class="team-card__header">
          <span class="team-chip team-chip--${escapeHtml(team.teamId || '')}"><span class="team-chip__dot"></span><span>${escapeHtml(team.teamName || team.teamId || '—')}</span></span>
          <div class="team-card__score">${total} очок</div>
        </div>
        <div class="team-card__meta">DM ${team.dmRoundsWon || team.dm || 0} · KT ${team.ktPoints || team.kt || 0} · TDM ${team.tdmScore || team.tdm || 0} · Avg MMR ${team.mmrCurrent ? Math.round(team.mmrCurrent) : '—'}</div>
        <div class="team-card__players">
          <table>
            <thead><tr><th>Гравець</th><th>Ігор</th><th>Win%</th><th>MVP</th><th>Impact</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </article>`
    );
  });
}

function renderPlayersTable(players = [], teams = []) {
  const tbody = document.querySelector('#players-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const teamNames = Object.fromEntries(teams.map((t) => [t.teamId, t.teamName || t.teamId]));
  const prepared = preparePlayers(players, teamNames)
    .sort((a, b) => {
      if (b.impactPoints !== a.impactPoints) return b.impactPoints - a.impactPoints;
      if (b.mvpCount !== a.mvpCount) return b.mvpCount - a.mvpCount;
      return b.games - a.games;
    });

  prepared.forEach((p) => {
    const mmrDelta = p.mmrChange > 0 ? `+${p.mmrChange}` : String(p.mmrChange);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${buildPlayerIdentity({ ...p, teamId: p.teamId, teamName: p.teamName, displayNick: p.displayNick || p.playerNick })}</td>
      <td>${escapeHtml(p.teamName)}</td>
      <td>${p.games}</td>
      <td>${p.wins}</td>
      <td>${p.losses}</td>
      <td>${p.draws}</td>
      <td>${p.mvpCount}</td>
      <td>${p.secondCount}</td>
      <td>${p.thirdCount}</td>
      <td>${p.impactPoints}</td>
      <td>${mmrDelta}</td>
    `;
    tbody.appendChild(tr);
  });
}

function formatWinner(game, teamNames) {
  if (game.isDraw === true || game.isDraw === 'TRUE') return 'Нічия';
  if (game.winnerTeamId) return `Переможець: ${teamNames[game.winnerTeamId] || game.winnerTeamId}`;
  return 'Матч не зіграно';
}

function renderMatches(games = [], teams = []) {
  const container = document.getElementById('matches-container');
  if (!container) return;
  container.innerHTML = '';
  const teamNames = Object.fromEntries(teams.map((t) => [t.teamId, t.teamName || t.teamId]));

  games.forEach((game, idx) => {
    const mode = String(game.mode || game.gameMode || '').toUpperCase();
    const modeLabel = mode || 'TDM';
    const teamA = game.teamAId || game.teamA || '';
    const teamB = game.teamBId || game.teamB || '';
    const aName = teamNames[teamA] || teamA || '—';
    const bName = teamNames[teamB] || teamB || '—';
    const scoreA = normalizeNumber(game.scoreA != null ? game.scoreA : game.teamAScore);
    const scoreB = normalizeNumber(game.scoreB != null ? game.scoreB : game.teamBScore);
    const winnerLine = formatWinner(game, teamNames);
    const scoreLine = Number.isFinite(scoreA) && Number.isFinite(scoreB) ? `${scoreA} : ${scoreB}` : '— : —';

    container.insertAdjacentHTML(
      'beforeend',
      `<article class="bal__card match-card match-card--mode-${modeLabel.toLowerCase()}">
        <div class="match-card__header">
          <div>
            <h3 class="match-title">${escapeHtml(modeLabel)} · Матч ${idx + 1}</h3>
            <p class="match-meta">${escapeHtml(aName)} vs ${escapeHtml(bName)}</p>
          </div>
          <div class="match-card__mode">${escapeHtml(modeLabel)}</div>
        </div>
        <div class="result-line">
          <span class="team-chip team-chip--${escapeHtml(teamA)}"><span class="team-chip__dot"></span><span>${escapeHtml(aName)}</span></span>
          <strong>${scoreLine}</strong>
          <span class="team-chip team-chip--${escapeHtml(teamB)}"><span class="team-chip__dot"></span><span>${escapeHtml(bName)}</span></span>
        </div>
        <p class="match-meta">${escapeHtml(winnerLine)}</p>
      </article>`
    );
  });
}

function renderInfographic(teams = [], players = []) {
  const container = document.getElementById('tournament-infographic');
  const section = document.getElementById('tournament-infographic-section');
  if (!container || !section) return;
  container.innerHTML = '';

  const totals = [
    { label: 'Сумарні постріли', value: INFOKIT_TOTALS.totalShots },
    { label: 'Сумарні влучення', value: INFOKIT_TOTALS.totalHits },
    { label: 'Сумарні промахи', value: INFOKIT_TOTALS.totalMisses },
    { label: 'Сумарні фраги', value: INFOKIT_TOTALS.totalFrags },
    { label: 'Середня точність', value: `${INFOKIT_TOTALS.avgAccuracy}%` },
    { label: 'Кращий по точності', value: `${INFOKIT_TOTALS.topAccuracy.nick} (${INFOKIT_TOTALS.topAccuracy.value})` },
    { label: 'Кращий по фрагам', value: `${INFOKIT_TOTALS.topFrags.nick} (${INFOKIT_TOTALS.topFrags.value})` },
    { label: 'Кращий по влученнях', value: `${INFOKIT_TOTALS.topHits.nick} (${INFOKIT_TOTALS.topHits.value})` }
  ];

  const totalsHtml = totals
    .map(
      (card) => `
      <div class="info-chip">
        <p class="info-chip__label">${card.label}</p>
        <p class="info-chip__value">${card.value}</p>
      </div>`
    )
    .join('');

  container.insertAdjacentHTML('beforeend', `<div class="infographic-grid">${totalsHtml}</div>`);

  const teamNames = Object.fromEntries(teams.map((t) => [t.teamId, t.teamName || t.teamId]));
  const cards = INFOGRAPHIC_PLAYERS.map((p) => {
    const displayNick = mapNick(p.nick);
    const teamName = teamNames[p.teamId] || p.teamName || players.find((pl) => mapNick(pl.playerNick) === displayNick)?.teamName || '—';
    return `
      <article class="player-infocard">
        <div class="player-infocard__header">
          <div class="player-infocard__nick">${escapeHtml(displayNick)}</div>
          <div class="player-infocard__team">${escapeHtml(teamName)}</div>
        </div>
        <div class="player-infocard__stats">
          <div class="infostat"><span>Постріли</span><strong>${p.shots}</strong></div>
          <div class="infostat"><span>Влучень</span><strong>${p.hits}</strong></div>
          <div class="infostat"><span>Промахи</span><strong>${p.misses}</strong></div>
          <div class="infostat"><span>Фраги</span><strong>${p.frags}</strong></div>
          <div class="infostat"><span>Деактивування</span><strong>${p.deactivations}</strong></div>
          <div class="infostat"><span>Точність</span><strong>${p.accuracyPercent}%</strong></div>
        </div>
      </article>`;
  }).join('');

  container.insertAdjacentHTML('beforeend', `<div class="player-infocard-grid">${cards}</div>`);
  section.classList.remove('hidden');
}

async function renderSelector() {
  const listEl = document.getElementById('tournament-list');
  const emptyEl = document.getElementById('tournaments-empty');
  if (!listEl || !emptyEl) return;

  try {
    const tournaments = await fetchTournaments({ status: 'ACTIVE' });
    listEl.innerHTML = '';
    if (!tournaments.length) {
      emptyEl.classList.remove('hidden');
      return;
    }
    emptyEl.classList.add('hidden');
    tournaments.forEach((t) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'btn secondary';
      btn.textContent = t.name || t.tournamentId;
      btn.addEventListener('click', () => {
        const url = new URL(window.location.href);
        url.searchParams.set('id', t.tournamentId);
        window.history.replaceState({}, '', url.toString());
        loadTournament(t.tournamentId);
      });
      li.appendChild(btn);
      listEl.appendChild(li);
    });
  } catch (err) {
    console.error('[tournament] selector error', err);
  }
}

async function loadBasePlayers(league) {
  const effectiveLeague = normalizeLeague(league || 'sundaygames');
  const players = await loadPlayers(effectiveLeague);
  const withAvatars = await enrichPlayersWithAvatars(players);
  state.basePlayers = withAvatars;
  state.playerIndex = buildBaseIndex(withAvatars);
}

async function loadTournament(tournamentId) {
  try {
    state.tournamentId = tournamentId;
    const data = await fetchTournamentData(tournamentId);
    const info = data.tournament || {};
    const teams = Array.isArray(data.teams) ? data.teams : [];
    const games = Array.isArray(data.games) ? data.games : [];
    const players = Array.isArray(data.players) ? data.players : [];
    state.info = info;
    state.teams = teams;
    state.games = games;
    state.players = players;
    state.league = info.league || 'sundaygames';

    await loadBasePlayers(state.league);

    setTitle(info.name || info.tournamentId || 'Турнір');
    setMeta(info.notes || info.description || info.status || '');
    toggleSections(true);
    renderStats({ teams, games, info });
    renderTeamsTable(teams);
    renderTeamCards(teams, players);
    renderPlayersTable(players, teams);
    renderMatches(games, teams);
    renderInfographic(teams, players);
    await reloadAvatars(document);
  } catch (err) {
    console.error('[tournament] init error', err);
  }
}

async function initPage() {
  const backBtn = document.getElementById('back-to-selector');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      toggleSections(false);
      renderSelector();
    });
  }

  const idFromUrl = getTournamentIdFromUrl();
  if (idFromUrl) {
    await loadTournament(idFromUrl);
  } else {
    toggleSections(false);
    await renderSelector();
  }
}

document.addEventListener('DOMContentLoaded', initPage);
