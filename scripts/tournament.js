// -------------------------------------------------------------
// VARTA TOURNAMENT VIEW · ARCHIVE #01
// Новий монолітний tournament.js з покращеною логікою та UX
// -------------------------------------------------------------

import { loadPlayers, normalizeLeague } from './api.js';
import { rankLetterForPoints } from './rankUtils.js';

const DEFAULT_AVATAR = 'assets/default_avatars/av0.png';

// ---------- Нікнейми → API ----------
const PLAYER_MAP = {
  'Юра': 'Morti',
  'Морті': 'Morti',
  'Morti': 'Morti',

  'Ворон': 'Voron',
  'Voron': 'Voron',

  'Оксана': 'Оксанка',
  'Оксанка': 'Оксанка',

  'Даня': 'hAppser',
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
  'Justy': 'Justy',
  'Олег': 'Олег',
  'Темофій': 'Temostar',
  'Temostar': 'Temostar'
};

function mapNick(name) {
  return PLAYER_MAP[name] || name;
}

// DM-код → команда
const TEAM_BY_CODE = {
  '1': 'green',
  '2': 'blue',
  '3': 'red'
};

// ---------- Турнір ----------
const TOURNAMENT = {
  league: 'olds',
  meta: {
    title: 'Турнір VARTA — Архів #01',
    date: '15 грудня 2024',
    format: '3×4 · DM · KT · TDM',
    map: 'Pixel-arena · Neon Raid',
    modes: ['DM', 'KT', 'TDM']
  },
  teams: {
    green: {
      name: 'Зелена команда',
      color: 'var(--team-green)',
      players: ['Морті', 'Ворон', 'Оксанка', 'hAppser']
    },
    blue: {
      name: 'Синя команда',
      color: 'var(--team-blue)',
      players: ['Laston', 'Leres', 'Кицюня', 'Cocosik']
    },
    red: {
      name: 'Червона команда',
      color: 'var(--team-red)',
      players: ['Sem', 'Justy', 'Олег', 'Temostar']
    }
  },
  modes: {
    dm: [
      {
        label: 'Раундовий DM',
        teamA: 'green',
        teamB: 'blue',
        results: ['2', '=', '2', '=', '2', '2', '2'],
        mvp: ['Laston', 'Leres', 'Morti']
      },
      {
        label: 'Раундовий DM',
        teamA: 'blue',
        teamB: 'red',
        results: ['2', '3', '2', '2', '2', '2'],
        mvp: ['Leres', 'Laston', 'Sem']
      },
      {
        label: 'Раундовий DM',
        teamA: 'red',
        teamB: 'green',
        results: ['3', '=', '3', '3', '1', '3', '1', '3'],
        mvp: ['Morti', 'Temostar', 'Олег']
      }
    ],
    kt: [
      {
        label: 'Control Point',
        teamA: 'blue',
        teamB: 'green',
        rounds: [
          { winner: 'green', time: '4:07', points: 1 },
          { winner: 'blue', time: '3:56', points: 2 }
        ],
        mvp: ['Morti', 'Laston', 'Leres']
      },
      {
        label: 'Control Point',
        teamA: 'blue',
        teamB: 'red',
        rounds: [
          { winner: 'blue', time: '3:52', points: 2 },
          { winner: 'red', time: '3:13', points: 3 }
        ],
        mvp: ['Morti', 'Laston', 'Temostar']
      },
      {
        label: 'Control Point',
        teamA: 'red',
        teamB: 'green',
        rounds: [
          { winner: 'red', time: '3:06', points: 3 },
          { winner: 'red', time: '3:09', points: 3 }
        ],
        mvp: ['Morti', 'Justy', 'Temostar']
      }
    ],
    tdm: [
      { label: 'TDM', teamA: 'green', teamB: 'blue', scores: { green: 1, blue: 4 } },
      { label: 'TDM', teamA: 'blue', teamB: 'red', scores: { blue: 4, red: 2 } },
      { label: 'TDM', teamA: 'green', teamB: 'red', scores: { green: 3, red: 5 } }
    ]
  }
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
    league: normalizeLeague(TOURNAMENT.league)
  };
}

// ---------- Icons (DM/TDM вьювер) ----------
function resultIcon(code) {
  if (code === '=') return '⚪';
  if (code === '1') return '🟢';
  if (code === '2') return '🔵';
  return '🔴';
}

// ---------- Допоміжні структури ----------
function initTeamStats(playerIndex) {
  const stats = {};

  Object.entries(TOURNAMENT.teams).forEach(([id, team]) => {
    const avg =
      team.players.reduce((acc, nick) => acc + getProfile(nick, playerIndex).points, 0) /
      team.players.length || 0;

    stats[id] = {
      id,
      name: team.name,
      color: team.color,
      players: [...team.players],
      // турнірна сітка
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      points: 0, // турнірні (3 за W, 1 за D)
      place: 0,
      // режимні метрики
      dmRoundsWon: 0,
      ktPoints: 0,
      tdmScore: 0,
      avgMMR: avg,
      secondPlacesDM: 0,
      thirdPlacesDM: 0
    };
  });

  return stats;
}

function initPlayerStats(playerIndex) {
  const stats = {};

  Object.entries(TOURNAMENT.teams).forEach(([teamId, team]) => {
    team.players.forEach((nick) => {
      const base = getProfile(nick, playerIndex);
      stats[nick] = {
        ...base,
        teamId,
        teamName: team.name,
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        mvps: 0,
        dmRounds: 0,
        ktPoints: 0,
        tdmScore: 0,
        impact: 0,
        mmrDelta: 0,
        secondPlaces: 0,
        thirdPlaces: 0
      };
    });
  });

  return stats;
}

// ---------- Підрахунок всіх статистик турніру ----------
function buildTournamentStats(playerIndex) {
  const teamStats = initTeamStats(playerIndex);
  const playerStats = initPlayerStats(playerIndex);

  let totalMatches = 0;

  const registerGameResult = (participants, outcome) => {
    const { winnerIds, drawIds, loserIds } = outcome;

    participants.forEach((teamId) => {
      const t = teamStats[teamId];
      if (!t) return;
      t.games += 1;
      TOURNAMENT.teams[teamId].players.forEach((nick) => {
        playerStats[nick].games += 1;
      });
    });

    winnerIds.forEach((teamId) => {
      const t = teamStats[teamId];
      if (!t) return;
      t.wins += 1;
      t.points += 3;
      TOURNAMENT.teams[teamId].players.forEach((nick) => {
        playerStats[nick].wins += 1;
      });
    });

    drawIds.forEach((teamId) => {
      const t = teamStats[teamId];
      if (!t) return;
      t.draws += 1;
      t.points += 1;
      TOURNAMENT.teams[teamId].players.forEach((nick) => {
        playerStats[nick].draws += 1;
      });
    });

    loserIds.forEach((teamId) => {
      const t = teamStats[teamId];
      if (!t) return;
      t.losses += 1;
      TOURNAMENT.teams[teamId].players.forEach((nick) => {
        playerStats[nick].losses += 1;
      });
    });

    totalMatches += 1;
  };

  // ---------- DM (FFA 3×3 на раунди) ----------
  TOURNAMENT.modes.dm.forEach((game) => {
    const counters = { green: 0, blue: 0, red: 0 };

    game.results.forEach((code) => {
      if (code === '=') return;
      const teamId = TEAM_BY_CODE[code];
      if (teamId) counters[teamId] += 1;
    });

    // DM-раунди для команд + гравців
    Object.entries(counters).forEach(([teamId, wins]) => {
      const t = teamStats[teamId];
      if (!t) return;
      t.dmRoundsWon += wins;
      TOURNAMENT.teams[teamId].players.forEach((nick) => {
        playerStats[nick].dmRounds += wins;
      });
    });

    const values = Object.values(counters);
    const maxWins = Math.max(...values);

    if (maxWins > 0) {
      const participants = Object.keys(TOURNAMENT.teams);
      const leaders = Object.entries(counters)
        .filter(([, v]) => v === maxWins)
        .map(([id]) => id);

      let winnerIds = [];
      let drawIds = [];
      let loserIds = [];

      if (leaders.length === 1) {
        winnerIds = leaders;
        loserIds = participants.filter((id) => !leaders.includes(id));
      } else {
        drawIds = leaders;
        loserIds = participants.filter((id) => !leaders.includes(id));
      }

      // місця 1/2/3 в DM для 2міс/3міс
      const sorted = Object.entries(counters)
        .sort((a, b) => b[1] - a[1]);

      let lastWins = null;
      let currentPlace = 0;

      sorted.forEach(([teamId, wins]) => {
        if (lastWins === null) {
          currentPlace = 1;
        } else if (wins < lastWins) {
          currentPlace += 1;
        }
        lastWins = wins;

        if (currentPlace === 2) {
          teamStats[teamId].secondPlacesDM += 1;
          TOURNAMENT.teams[teamId].players.forEach((nick) => {
            playerStats[nick].secondPlaces += 1;
          });
        } else if (currentPlace === 3) {
          teamStats[teamId].thirdPlacesDM += 1;
          TOURNAMENT.teams[teamId].players.forEach((nick) => {
            playerStats[nick].thirdPlaces += 1;
          });
        }
      });

      registerGameResult(participants, { winnerIds, drawIds, loserIds });
    }

    // MVP за DM
    game.mvp.forEach((nick) => {
      const apiNick = mapNick(nick);
      const player = Object.values(playerStats).find((p) => p.apiNick === apiNick);
      if (player) player.mvps += 1;
    });
  });

  // ---------- KT (Control Point) ----------
  TOURNAMENT.modes.kt.forEach((game) => {
    const pts = { [game.teamA]: 0, [game.teamB]: 0 };

    game.rounds.forEach((round) => {
      pts[round.winner] = (pts[round.winner] || 0) + round.points;
      const t = teamStats[round.winner];
      if (t) t.ktPoints += round.points;
      TOURNAMENT.teams[round.winner].players.forEach((nick) => {
        playerStats[nick].ktPoints += round.points;
      });
    });

    const aPts = pts[game.teamA] || 0;
    const bPts = pts[game.teamB] || 0;

    let winnerIds = [];
    let drawIds = [];
    let loserIds = [];

    if (aPts === bPts) {
      drawIds = [game.teamA, game.teamB];
    } else if (aPts > bPts) {
      winnerIds = [game.teamA];
      loserIds = [game.teamB];
    } else {
      winnerIds = [game.teamB];
      loserIds = [game.teamA];
    }

    registerGameResult([game.teamA, game.teamB], { winnerIds, drawIds, loserIds });

    game.mvp.forEach((nick) => {
      const apiNick = mapNick(nick);
      const player = Object.values(playerStats).find((p) => p.apiNick === apiNick);
      if (player) player.mvps += 1;
    });
  });

  // ---------- TDM ----------
  TOURNAMENT.modes.tdm.forEach((game) => {
    const scoreA = game.scores[game.teamA] || 0;
    const scoreB = game.scores[game.teamB] || 0;

    const teamAStats = teamStats[game.teamA];
    const teamBStats = teamStats[game.teamB];

    if (teamAStats) teamAStats.tdmScore += scoreA;
    if (teamBStats) teamBStats.tdmScore += scoreB;

    TOURNAMENT.teams[game.teamA].players.forEach((nick) => {
      playerStats[nick].tdmScore += scoreA;
    });
    TOURNAMENT.teams[game.teamB].players.forEach((nick) => {
      playerStats[nick].tdmScore += scoreB;
    });

    let winnerIds = [];
    let drawIds = [];
    let loserIds = [];

    if (scoreA === scoreB) {
      drawIds = [game.teamA, game.teamB];
    } else if (scoreA > scoreB) {
      winnerIds = [game.teamA];
      loserIds = [game.teamB];
    } else {
      winnerIds = [game.teamB];
      loserIds = [game.teamA];
    }

    registerGameResult([game.teamA, game.teamB], { winnerIds, drawIds, loserIds });
  });

  // ---------- Фінальні підрахунки ----------
  const teamArray = Object.values(teamStats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.avgMMR - a.avgMMR;
  });

  teamArray.forEach((t, i) => {
    t.place = i + 1;
  });

  // Impact для гравців: на основі реальних цифр (MVP, DM, KT, TDM)
  Object.values(playerStats).forEach((p) => {
    const impact =
      p.mvps * 5 +
      p.dmRounds * 1 +
      p.ktPoints * 2 +
      p.tdmScore * 0.3;

    p.impact = Math.round(impact * 10) / 10;
  });

  const playerArray = Object.values(playerStats).sort((a, b) => b.impact - a.impact);

  const topMvp = playerArray.reduce(
    (best, p) => (p.mvps > (best?.mvps || 0) ? p : best),
    null
  );

  const podiumPlayers = playerArray.slice(0, 3);

  return {
    teamStats: teamArray,
    playerStats: playerArray,
    podiumPlayers,
    topMvp,
    totalPlayers: playerArray.length,
    totalMatches
  };
}

// ---------- HERO + загальна панель ----------
function renderHero(totals) {
  const titleEl = document.getElementById('tournament-title');
  const metaEl = document.getElementById('tournament-meta');
  const statsEl = document.getElementById('tournament-stats');

  if (titleEl) titleEl.textContent = TOURNAMENT.meta.title;
  if (metaEl) {
    metaEl.textContent = `${TOURNAMENT.meta.date} · ${TOURNAMENT.meta.format} · ${TOURNAMENT.meta.map}`;
  }

  if (!statsEl) return;

  statsEl.innerHTML = '';

  const cards = [
    {
      label: 'Гравців',
      value: totals.totalPlayers
    },
    {
      label: 'Матчів (DM/KT/TDM)',
      value: totals.totalMatches
    }
  ];

  if (totals.topMvp) {
    cards.push({
      label: 'MVP турніру',
      value: `${totals.topMvp.displayNick} (${totals.topMvp.mvps})`
    });
  }

  cards.forEach((card) => {
    statsEl.insertAdjacentHTML(
      'beforeend',
      `<div class='stat-card'>
         <p class='stat-label'>${card.label}</p>
         <p class='stat-value'>${card.value}</p>
       </div>`
    );
  });

  if (totals.podiumPlayers && totals.podiumPlayers.length) {
    const podium = totals.podiumPlayers
      .map((p, i) => {
        const place = i + 1;
        const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉';
        return `<li>${medal} ${p.displayNick} <span class='muted'>(ранг ${p.rank})</span></li>`;
      })
      .join('');

    statsEl.insertAdjacentHTML(
      'beforeend',
      `<div class='stat-card'>
         <p class='stat-label'>Топ-3 гравців турніру</p>
         <ul style='margin: 4px 0 0; padding-left: 18px;'>${podium}</ul>
       </div>`
    );
  }
}

// ---------- Команди (таблиця з W/L/D/Очки) ----------
function renderTeams(teamStats) {
  const tbody = document.querySelector('#teams-table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  teamStats.forEach((t) => {
    const nameCell = `
      <span class='team-chip' style='background:${t.color}'></span>
      <span>${t.name}</span>
    `;

    tbody.insertAdjacentHTML(
      'beforeend',
      `<tr>
         <td>${nameCell}</td>
         <td>${t.wins}</td>
         <td>${t.losses}</td>
         <td>${t.draws}</td>
         <td>${t.points}</td>
         <td>${Math.round(t.avgMMR)}</td>
         <td>${t.place}</td>
       </tr>`
    );
  });
}

// ---------- Гравці (таблиця з рангами та Impact) ----------
function renderPlayers(playerStats) {
  const tbody = document.querySelector('#players-table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  playerStats.forEach((p) => {
    const teamLabel = TOURNAMENT.teams[p.teamId]?.name || p.teamName || '';

    const nickCell = `
      <div>
        <span>${p.displayNick}</span>
        <span class='badge status' style='margin-left:6px;'>${p.rank}</span>
      </div>
      <div class='muted' style='font-size:11px;'>@${p.apiNick}</div>
    `;

    const mmrDelta = p.mmrDelta === 0 ? '—' : (p.mmrDelta > 0 ? `+${p.mmrDelta}` : String(p.mmrDelta));

    tbody.insertAdjacentHTML(
      'beforeend',
      `<tr>
         <td>${nickCell}</td>
         <td>${teamLabel}</td>
         <td>${p.games}</td>
         <td>${p.wins}</td>
         <td>${p.losses}</td>
         <td>${p.draws}</td>
         <td>${p.mvps}</td>
         <td>${p.secondPlaces}</td>
         <td>${p.thirdPlaces}</td>
         <td>${p.impact}</td>
         <td>${mmrDelta}</td>
       </tr>`
    );
  });
}

// ---------- Матчі (DM / KT / TDM cards) ----------
function renderModes() {
  const container = document.getElementById('matches-container');
  if (!container) return;

  container.innerHTML = '';

  // DM
  TOURNAMENT.modes.dm.forEach((game) => {
    container.insertAdjacentHTML(
      'beforeend',
      `<article class='bal__card match-card'>
         <h3>DM · всі команди</h3>
         <p>${game.results.map(resultIcon).join(' ')}</p>
         <p class='muted'>MVP: ${game.mvp.join(', ')}</p>
       </article>`
    );
  });

  // KT
  TOURNAMENT.modes.kt.forEach((game) => {
    const rounds = game.rounds
      .map(
        (r, i) =>
          `<div class='round-row'>Раунд ${i + 1}: <strong>${r.time}</strong> → ${TOURNAMENT.teams[r.winner].name} (+${r.points})</div>`
      )
      .join('');

    container.insertAdjacentHTML(
      'beforeend',
      `<article class='bal__card match-card'>
         <h3>KT · ${TOURNAMENT.teams[game.teamA].name} vs ${TOURNAMENT.teams[game.teamB].name}</h3>
         ${rounds}
         <p class='muted'>MVP: ${game.mvp.join(', ')}</p>
       </article>`
    );
  });

  // TDM
  TOURNAMENT.modes.tdm.forEach((game) => {
    container.insertAdjacentHTML(
      'beforeend',
      `<article class='bal__card match-card'>
         <h3>TDM · ${TOURNAMENT.teams[game.teamA].name} vs ${TOURNAMENT.teams[game.teamB].name}</h3>
         <p>${game.scores[game.teamA]} — ${game.scores[game.teamB]}</p>
       </article>`
    );
  });
}

// ---------- INIT ----------
async function initPage() {
  const players = await loadPlayers(TOURNAMENT.league);
  const index = buildPlayerIndex(players);

  const totals = buildTournamentStats(index);

  renderHero(totals);
  renderTeams(totals.teamStats);
  renderPlayers(totals.playerStats);
  renderModes();
}

document.addEventListener('DOMContentLoaded', initPage);
