// -------------------------------------------------------------
// CLEAN, STABLE, CONFLICT-FREE TOURNAMENT ENGINE FOR ARCHIVE #01
// -------------------------------------------------------------

import { loadPlayers, normalizeLeague } from './api.js';
import { rankLetterForPoints } from './rankUtils.js';

const DEFAULT_AVATAR = 'assets/default_avatars/av0.png';

// ---------- Нікнейми → API ----------
const PLAYER_MAP = {
  "Юра": "Morti",
  "Морті": "Morti",
  "Morti": "Morti",

  "Ворон": "Voron",
  "Voron": "Voron",

  "Оксана": "Оксанка",
  "Оксанка": "Оксанка",

  "Даня": "hAppser",
  "hAppser": "hAppser",

  "Ластон": "Laston",
  "Laston": "Laston",

  "Лерес": "Leres",
  "Leres": "Leres",

  "Кицюня": "Кицюня",
  "Кіцюня": "Кицюня",

  "Кокосік": "Cocosik",
  "Cocosik": "Cocosik",

  "Sem": "Sem",
  "Justy": "Justy",
  "Олег": "Олег",
  "Темофій": "Temostar",
  "Temostar": "Temostar"
};

function mapNick(name) {
  return PLAYER_MAP[name] || name;
}

// ---------- Турнір ----------
const TOURNAMENT = {
  league: 'olds',
  meta: {
    title: 'Турнір VARTA — Архів #01',
    date: '15 грудня 2024',
    format: '3×4 · DM · KT · TDM',
    map: 'Pixel-arena · Neon Raid',
    modes: ['DM', 'KT', 'TDM'],
  },
  teams: {
    green: {
      name: 'Команда 1',
      color: 'var(--team-green)',
      players: ['Морті', 'Ворон', 'Оксанка', 'hAppser'],
    },
    blue: {
      name: 'Команда 2',
      color: 'var(--team-blue)',
      players: ['Laston', 'Leres', 'Кицюня', 'Cocosik'],
    },
    red: {
      name: 'Команда 3',
      color: 'var(--team-red)',
      players: ['Sem', 'Justy', 'Олег', 'Temostar'],
    },
  },
  modes: {
    dm: [
      {
        label: 'Раундовий DM',
        teamA: 'green',
        teamB: 'blue',
        results: ['2', '=', '2', '=', '2', '2', '2'],
        mvp: ['Laston', 'Leres', 'Morti'],
      },
      {
        label: 'Раундовий DM',
        teamA: 'blue',
        teamB: 'red',
        results: ['2', '3', '2', '2', '2', '2'],
        mvp: ['Leres', 'Laston', 'Sem'],
      },
      {
        label: 'Раундовий DM',
        teamA: 'red',
        teamB: 'green',
        results: ['3', '=', '3', '3', '1', '3', '1', '3'],
        mvp: ['Morti', 'Temostar', 'Олег'],
      },
    ],
    kt: [
      {
        label: 'Control Point',
        teamA: 'blue',
        teamB: 'green',
        rounds: [
          { winner: 'green', time: '4:07', points: 1 },
          { winner: 'blue', time: '3:56', points: 2 },
        ],
        mvp: ['Morti', 'Laston', 'Leres'],
      },
      {
        label: 'Control Point',
        teamA: 'blue',
        teamB: 'red',
        rounds: [
          { winner: 'blue', time: '3:52', points: 2 },
          { winner: 'red', time: '3:13', points: 3 },
        ],
        mvp: ['Morti', 'Laston', 'Temostar'],
      },
      {
        label: 'Control Point',
        teamA: 'red',
        teamB: 'green',
        rounds: [
          { winner: 'red', time: '3:06', points: 3 },
          { winner: 'red', time: '3:09', points: 3 },
        ],
        mvp: ['Morti', 'Justy', 'Temostar'],
      },
    ],
    tdm: [
      { label: 'TDM', teamA: 'green', teamB: 'blue', scores: { green: 1, blue: 4 } },
      { label: 'TDM', teamA: 'blue', teamB: 'red', scores: { blue: 4, red: 2 } },
      { label: 'TDM', teamA: 'green', teamB: 'red', scores: { green: 3, red: 5 } },
    ],
  },
};

// ---------- Player Index ----------
function buildPlayerIndex(players) {
  const index = new Map();
  players.forEach((p) => index.set(p.nick.toLowerCase(), p));
  return index;
}

function getProfile(displayNick, playerIndex) {
  const apiNick = mapNick(displayNick);
  const p = playerIndex.get(apiNick.toLowerCase());
  const pts = Number(p?.pts ?? 0);

  return {
    displayNick,
    apiNick,
    points: pts,
    rank: p?.rank || rankLetterForPoints(pts),
    avatar: p?.avatar || DEFAULT_AVATAR,
    league: normalizeLeague(TOURNAMENT.league),
  };
}

// ---------- Icons ----------
function resultIcon(code) {
  if (code === '=') return '⚪';
  if (code === '1') return '🟢';
  if (code === '2') return '🔵';
  return '🔴';
}

// ---------- Render Hero ----------
function renderHero() {
  document.getElementById('tournament-title').textContent = TOURNAMENT.meta.title;
  document.getElementById('tournament-meta').textContent =
    `${TOURNAMENT.meta.date} · ${TOURNAMENT.meta.format} · ${TOURNAMENT.meta.map}`;
}

// ---------- Teams ----------
function renderTeams(playerIndex) {
  const tbody = document.querySelector('#teams-table tbody');
  tbody.innerHTML = '';

  Object.entries(TOURNAMENT.teams).forEach(([key, team]) => {
    const avg =
      team.players.reduce((acc, nick) => acc + getProfile(nick, playerIndex).points, 0) /
      team.players.length;

    const row = `
      <tr>
        <td><span class="team-chip" style="background:${team.color}"></span> ${team.name}</td>
        <td>${team.players.length}</td>
        <td>${Math.round(avg)}</td>
      </tr>
    `;
    tbody.insertAdjacentHTML('beforeend', row);
  });
}

// ---------- DM / KT / TDM ----------
function renderModes() {
  const container = document.getElementById('matches-container');
  container.innerHTML = '';

  // DM
  TOURNAMENT.modes.dm.forEach((game) => {
    container.insertAdjacentHTML(
      'beforeend',
      `<article class="bal__card match-card">
        <h3>DM · ${TOURNAMENT.teams[game.teamA].name} vs ${TOURNAMENT.teams[game.teamB].name}</h3>
        <p>${game.results.map(resultIcon).join(' ')}</p>
        <p class="muted">MVP: ${game.mvp.join(', ')}</p>
      </article>`
    );
  });

  // KT
  TOURNAMENT.modes.kt.forEach((game) => {
    const rounds = game.rounds
      .map(
        (r, i) =>
          `<div class="round-row">Раунд ${i + 1}: <strong>${r.time}</strong> → ${TOURNAMENT.teams[r.winner].name} (+${r.points})</div>`
      )
      .join('');

    container.insertAdjacentHTML(
      'beforeend',
      `<article class="bal__card match-card">
        <h3>KT · ${TOURNAMENT.teams[game.teamA].name} vs ${TOURNAMENT.teams[game.teamB].name}</h3>
        ${rounds}
        <p class="muted">MVP: ${game.mvp.join(', ')}</p>
      </article>`
    );
  });

  // TDM
  TOURNAMENT.modes.tdm.forEach((game) => {
    container.insertAdjacentHTML(
      'beforeend',
      `<article class="bal__card match-card">
        <h3>TDM · ${TOURNAMENT.teams[game.teamA].name} vs ${TOURNAMENT.teams[game.teamB].name}</h3>
        <p>${game.scores[game.teamA]} — ${game.scores[game.teamB]}</p>
      </article>`
    );
  });
}

// ---------- Players ----------
function renderPlayers(stats) {
  const tbody = document.querySelector('#players-table tbody');
  tbody.innerHTML = '';

  stats.forEach((p, i) => {
    tbody.insertAdjacentHTML(
      'beforeend',
      `<tr>
        <td>${i + 1}</td>
        <td>${p.displayNick}</td>
        <td>${p.rank}</td>
        <td>${p.mvps}</td>
        <td>${p.dmRounds}</td>
        <td>${p.ktPoints}</td>
        <td>${p.tdmScore}</td>
      </tr>`
    );
  });
}

// ---------- Calculate Player Stats ----------
function buildPlayerStats(playerIndex) {
  const stats = {};

  Object.entries(TOURNAMENT.teams).forEach(([key, team]) => {
    team.players.forEach((nick) => {
      stats[nick] = {
        ...getProfile(nick, playerIndex),
        mvps: 0,
        dmRounds: 0,
        ktPoints: 0,
        tdmScore: 0,
      };
    });
  });

  // DM
  TOURNAMENT.modes.dm.forEach((game) => {
    game.results.forEach((r) => {
      if (r === '=') return;
      const winnerTeam = r === '1' ? 'green' : r === '2' ? 'blue' : 'red';
      TOURNAMENT.teams[winnerTeam].players.forEach((nick) => stats[nick].dmRounds++);
    });

    game.mvp.forEach((nick) => {
      const apiNick = mapNick(nick);
      const local = Object.values(stats).find((p) => p.apiNick === apiNick);
      if (local) local.mvps++;
    });
  });

  // KT
  TOURNAMENT.modes.kt.forEach((game) => {
    game.rounds.forEach((round) => {
      TOURNAMENT.teams[round.winner].players.forEach((nick) => {
        stats[nick].ktPoints += round.points;
      });
    });

    game.mvp.forEach((nick) => {
      const apiNick = mapNick(nick);
      const local = Object.values(stats).find((p) => p.apiNick === apiNick);
      if (local) local.mvps++;
    });
  });

  // TDM
  TOURNAMENT.modes.tdm.forEach((game) => {
    const scoreA = game.scores[game.teamA];
    const scoreB = game.scores[game.teamB];

    TOURNAMENT.teams[game.teamA].players.forEach((nick) => (stats[nick].tdmScore += scoreA));
    TOURNAMENT.teams[game.teamB].players.forEach((nick) => (stats[nick].tdmScore += scoreB));
  });

  return Object.values(stats).sort((a, b) => b.points - a.points);
}

// ---------- INIT ----------
async function initPage() {
  renderHero();

  const players = await loadPlayers(TOURNAMENT.league);
  const index = buildPlayerIndex(players);

  renderTeams(index);

  const stats = buildPlayerStats(index);
  renderPlayers(stats);

  renderModes();
}

document.addEventListener('DOMContentLoaded', initPage);
