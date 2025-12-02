// -------------------------------------------------------------
// VARTA TOURNAMENT VIEW · ARCHIVE #01
// Новий монолітний tournament.js з покращеною логікою та UX
// -------------------------------------------------------------

import { loadPlayers, normalizeLeague, fetchPlayerGames } from './api.js';
import { rankLetterForPoints } from './rankUtils.js';

const DEFAULT_AVATAR = 'assets/default_avatars/av0.png';
const MVP_FIELDS = ['MVP', 'Mvp', 'mvp', 'MVP2', 'mvp2', 'MVP 2', 'mvp 2', 'MVP3', 'mvp3', 'MVP 3', 'mvp 3'];
const TEAM_FIELDS = ['Team1', 'Team 1', 'team1', 'team 1', 'Team2', 'Team 2', 'team2', 'team 2'];
const seasonStatsCache = new Map();
let lastPlayerStats = [];

// ---------- Нікнейми → API ----------
const PLAYER_MAP = {
  'Юра': 'Morti',
  'Морті': 'Morti',
  'Morti': 'Morti',
  'Сегедин': 'Morti',

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
  'Олег': 'Олег',
  'Темофій': 'Temostar',
  'Темостар': 'Temostar',
  'Temostar': 'Temostar',

  'Остап': 'Остап',
  'Вова': 'Вова'
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

function ktPointsForTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [mPart, sPart] = timeStr.split(':');
  const minutes = Number(mPart);
  const seconds = Number(sPart);
  const totalSeconds = Number.isFinite(minutes) && Number.isFinite(seconds) ? minutes * 60 + seconds : 999;

  if (totalSeconds <= 2 * 60 + 29) return 5;
  if (totalSeconds <= 3 * 60) return 4;
  if (totalSeconds <= 3 * 60 + 29) return 3;
  if (totalSeconds <= 4 * 60) return 2;
  return 1;
}

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
        mvp: ['Laston', 'Leres', 'Сегедин']
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
        mvp: ['Морті', 'Temostar', 'Олег']
      }
    ],
    kt: [
      {
        label: 'Control Point',
        teamA: 'blue',
        teamB: 'green',
        rounds: [
          { winner: 'green', time: '4:07' },
          { winner: 'blue', time: '3:56' }
        ],
        mvp: ['Юра', 'Laston', 'Вова']
      },
      {
        label: 'Control Point',
        teamA: 'blue',
        teamB: 'red',
        rounds: [
          { winner: 'blue', time: '3:52' },
          { winner: 'red', time: '3:13' }
        ],
        mvp: ['Остап', 'Laston', 'Темофій']
      },
      {
        label: 'Control Point',
        teamA: 'red',
        teamB: 'green',
        rounds: [
          { winner: 'red', time: '3:06' },
          { winner: 'red', time: '3:09' }
        ],
        mvp: ['Юра', 'Остап', 'Темофій']
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

function rankClass(rank) {
  const letter = String(rank || '').trim();
  return `rank-chip rank-xs rank-${letter.toLowerCase()}`;
}

function buildPlayerIdentity(player) {
  const nick = player.displayNick;
  const apiNick = player.apiNick;
  const teamClass = player.teamId ? `team--${player.teamId}` : '';
  const rankBadge = `<span class="${rankClass(player.rank)} ${teamClass}" ${player.teamColor ? `style="--team-color:${player.teamColor}"` : ''}>${player.rank || '—'}</span>`;
  const avatar = player.avatar || DEFAULT_AVATAR;

  return `
    <div class="player-identity">
      <div class="player-avatar">
        <img src="${avatar}" alt="${nick}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='${DEFAULT_AVATAR}'" />
      </div>
      <div class="player-name-block">
        <div class="player-name-row">${nick} ${rankBadge}</div>
        <div class="player-meta">@${apiNick}</div>
      </div>
    </div>
  `;
}

function containsNick(value, targetNick) {
  if (!value) return false;
  return String(value)
    .split(/[;,]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .some((name) => name === targetNick.toLowerCase());
}

function detectTeamSide(game, targetNick) {
  let isTeam1 = false;
  let isTeam2 = false;

  TEAM_FIELDS.forEach((field, idx) => {
    const val = game[field];
    if (!val) return;
    if (idx < 4) {
      isTeam1 = isTeam1 || containsNick(val, targetNick);
    } else {
      isTeam2 = isTeam2 || containsNick(val, targetNick);
    }
  });

  if (isTeam1) return 'team1';
  if (isTeam2) return 'team2';
  return null;
}

function deriveSeasonKey(game) {
  const seasonField = game.Season || game.season || game.seasonId || game.SeasonId || game.season_id;
  if (seasonField) return String(seasonField);

  const ts = new Date(game.Timestamp || game.Date || game.date || game.time).getTime();
  if (Number.isFinite(ts)) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  return 'current';
}

function aggregateSeasonStats(games, targetNick) {
  const map = new Map();

  games.forEach((game) => {
    const side = detectTeamSide(game, targetNick);
    if (!side) return;

    const key = deriveSeasonKey(game);
    if (!map.has(key)) {
      map.set(key, {
        key,
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        mvps: 0,
        mmrSamples: [],
        lastTs: 0
      });
    }

    const rec = map.get(key);
    rec.games += 1;

    const winner = String(game.Winner || game.winner || '').toLowerCase();
    const drawValues = ['draw', 'tie', 'ничья', 'нічию'];

    if (!winner || drawValues.includes(winner)) {
      rec.draws += 1;
    } else if (['team1', 'team 1', '1'].includes(winner)) {
      if (side === 'team1') rec.wins += 1; else rec.losses += 1;
    } else if (['team2', 'team 2', '2'].includes(winner)) {
      if (side === 'team2') rec.wins += 1; else rec.losses += 1;
    }

    const ts = new Date(game.Timestamp || game.Date || game.date || game.time).getTime();
    if (Number.isFinite(ts) && ts > rec.lastTs) rec.lastTs = ts;

    const isMvp = MVP_FIELDS.some((field) => containsNick(game[field], targetNick));
    if (isMvp) rec.mvps += 1;

    const mmrField = ['PointsDelta', 'points_delta', 'MMRΔ', 'mmr_delta', 'MMR', 'mmr', 'MMRDelta', 'rating_change']
      .map((f) => Number(game[f]))
      .find((val) => Number.isFinite(val));

    if (Number.isFinite(mmrField)) rec.mmrSamples.push(mmrField);
  });

  return Array.from(map.values()).map((rec) => ({
    ...rec,
    avgMmrChange: rec.mmrSamples.length
      ? Math.round((rec.mmrSamples.reduce((a, b) => a + b, 0) / rec.mmrSamples.length) * 10) / 10
      : null
  }));
}

function pickSeasonSnapshots(games, nick) {
  const aggregated = aggregateSeasonStats(games, nick);
  aggregated.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
  return {
    current: aggregated[0] || null,
    previous: aggregated[1] || null
  };
}

async function loadSeasonSnapshots(apiNick, league) {
  const cacheKey = `${league}:${apiNick}`;
  if (seasonStatsCache.has(cacheKey)) return seasonStatsCache.get(cacheKey);

  try {
    const games = await fetchPlayerGames(apiNick, league);
    const snapshots = pickSeasonSnapshots(games, apiNick);
    seasonStatsCache.set(cacheKey, snapshots);
    return snapshots;
  } catch (err) {
    console.error('[tournament] season stats error', err);
    const empty = { current: null, previous: null };
    seasonStatsCache.set(cacheKey, empty);
    return empty;
  }
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
        teamColor: team.color || '',
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
  let totalDmRounds = 0;
  let totalKtRounds = 0;
  let totalTdmCaptures = 0;

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

    totalDmRounds += game.results.length;

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
      const roundPoints = ktPointsForTime(round.time);
      pts[round.winner] = (pts[round.winner] || 0) + roundPoints;
      const t = teamStats[round.winner];
      if (t) t.ktPoints += roundPoints;
      TOURNAMENT.teams[round.winner].players.forEach((nick) => {
        playerStats[nick].ktPoints += roundPoints;
      });
      totalKtRounds += 1;
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

    totalTdmCaptures += scoreA + scoreB;

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
      p.secondPlaces * 2 +
      p.thirdPlaces * 1 +
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

  const summary = {
    totalPlayers: playerArray.length,
    totalTeams: Object.keys(teamStats).length,
    totalMatches,
    totalDmRounds,
    totalKtRounds,
    totalTdmCaptures,
    totalWins: Object.values(teamStats).reduce((acc, t) => acc + t.wins, 0),
    totalDraws: Object.values(teamStats).reduce((acc, t) => acc + t.draws, 0),
    totalLosses: Object.values(teamStats).reduce((acc, t) => acc + t.losses, 0),
    modeBreakdown: {
      dm: TOURNAMENT.modes.dm.length,
      kt: TOURNAMENT.modes.kt.length,
      tdm: TOURNAMENT.modes.tdm.length
    }
  };

  return {
    teamStats: teamArray,
    playerStats: playerArray,
    podiumPlayers,
    topMvp,
    totalPlayers: playerArray.length,
    totalMatches,
    summary
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
      label: 'Команд',
      value: totals.summary?.totalTeams ?? Object.keys(TOURNAMENT.teams).length
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

// ---------- Інфографіка ----------
function renderInfographic(summary) {
  const container = document.getElementById('tournament-infographic');
  const section = document.getElementById('tournament-infographic-section');
  if (!container || !section) return;

  if (!summary) {
    section.classList.add('hidden');
    return;
  }

  container.innerHTML = '';
  section.classList.remove('hidden');

  const cards = [
    { label: 'DM раундів', value: summary.totalDmRounds },
    { label: 'KT раундів', value: summary.totalKtRounds },
    { label: 'Знищених баз (TDM)', value: summary.totalTdmCaptures },
    { label: 'W / D / L', value: `${summary.totalWins} / ${summary.totalDraws} / ${summary.totalLosses}` },
    { label: 'Унікальних гравців', value: summary.totalPlayers },
    {
      label: 'Режими',
      value: `DM ×${summary.modeBreakdown.dm} · KT ×${summary.modeBreakdown.kt} · TDM ×${summary.modeBreakdown.tdm}`
    }
  ];

  cards.forEach((card) => {
    container.insertAdjacentHTML(
      'beforeend',
      `<div class="info-chip">
         <p class="info-chip__label">${card.label}</p>
         <p class="info-chip__value">${card.value}</p>
       </div>`
    );
  });
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

  lastPlayerStats = [...playerStats];

  playerStats.forEach((p) => {
    const teamLabel = TOURNAMENT.teams[p.teamId]?.name || p.teamName || '';
    const nickCell = buildPlayerIdentity(p);
    const mmrDelta = p.mmrDelta === 0 ? '—' : p.mmrDelta > 0 ? `+${p.mmrDelta}` : String(p.mmrDelta);
    const row = document.createElement('tr');
    row.classList.add('player-row', `team-${p.teamId}-row`);
    row.dataset.nick = p.displayNick;
    row.dataset.apiNick = p.apiNick;

    row.innerHTML = `
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
    `;

    row.addEventListener('click', () => openPlayerModal(p));
    tbody.appendChild(row);
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

function renderSeasonSection(title, stats) {
  if (!stats) {
    return `<div class="empty-note">Дані відсутні</div>`;
  }

  const mmr = stats.avgMmrChange === null || Number.isNaN(stats.avgMmrChange)
    ? '—'
    : `${stats.avgMmrChange > 0 ? '+' : ''}${stats.avgMmrChange}`;

  return `
    <div>
      <h4 style="margin:0 0 8px;">${title}</h4>
      <div class="stat-list">
        ${statItem('Ігор', stats.games)}
        ${statItem('W', stats.wins)}
        ${statItem('L', stats.losses)}
        ${statItem('D', stats.draws)}
        ${statItem('MVP', stats.mvps)}
        ${statItem('MMR Δ (avg)', mmr)}
      </div>
    </div>
  `;
}

function renderTournamentBlock(p) {
  const mmrDelta = p.mmrDelta === 0 ? '—' : p.mmrDelta > 0 ? `+${p.mmrDelta}` : String(p.mmrDelta);

  return `
    <div class="info-card">
      <h3>Статистика турніру</h3>
      <div class="stat-list">
        ${statItem('Ігор', p.games)}
        ${statItem('W', p.wins)}
        ${statItem('L', p.losses)}
        ${statItem('D', p.draws)}
        ${statItem('MVP', p.mvps)}
        ${statItem('2 місце (DM)', p.secondPlaces)}
        ${statItem('3 місце (DM)', p.thirdPlaces)}
        ${statItem('DM раунди', p.dmRounds)}
        ${statItem('KT очки', p.ktPoints)}
        ${statItem('TDM рахунок', p.tdmScore)}
        ${statItem('Impact', p.impact)}
        ${statItem('MMR Δ', mmrDelta)}
      </div>
    </div>
  `;
}

function ensurePlayerModal() {
  const modal = document.getElementById('player-modal');
  const content = document.getElementById('player-modal-content');
  const closeBtn = modal?.querySelector('.player-modal__close');
  return { modal, content, closeBtn };
}

async function openPlayerModal(player) {
  const { modal, content, closeBtn } = ensurePlayerModal();
  if (!modal || !content) return;

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  content.innerHTML = '<p class="muted">Завантаження…</p>';

  const seasonSnapshots = await loadSeasonSnapshots(player.apiNick, player.league);

  const header = `
    <div class="player-modal__header">
      <div class="player-modal__avatar"><img src="${player.avatar || DEFAULT_AVATAR}" alt="${player.displayNick}" loading="lazy" onerror="this.src='${DEFAULT_AVATAR}'"></div>
      <div class="player-modal__title">
        <div class="player-name-row" style="font-size:1.1rem;">${player.displayNick} <span class="${rankClass(player.rank)}">${player.rank}</span></div>
        <div class="modal-sub">@${player.apiNick} · ${player.teamName}</div>
      </div>
      <span class="tag">MMR: ${player.points}</span>
    </div>
  `;

  const tournamentBlock = renderTournamentBlock(player);
  const seasonBlocks = `
    <div class="info-card">
      <h3>Сезонна статистика</h3>
      <div class="player-modal__grid">
        ${renderSeasonSection('Цей сезон', seasonSnapshots.current)}
        ${renderSeasonSection('Попередній сезон', seasonSnapshots.previous)}
      </div>
    </div>
  `;

  content.innerHTML = `${header}<div class="player-modal__grid">${tournamentBlock}${seasonBlocks}</div>`;

  const onBackdrop = (e) => {
    if (e.target === modal) hide();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') hide();
  };

  const hide = () => {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    modal.removeEventListener('click', onBackdrop);
    document.removeEventListener('keydown', onKey);
    if (closeBtn) closeBtn.removeEventListener('click', hide);
  };

  modal.addEventListener('click', onBackdrop);
  document.addEventListener('keydown', onKey);
  if (closeBtn) closeBtn.addEventListener('click', hide);
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
        (r, i) => {
          const points = ktPointsForTime(r.time);
          return `<div class='round-row'>Раунд ${i + 1}: <strong>${r.time}</strong> → ${TOURNAMENT.teams[r.winner].name} (+${points})</div>`;
        }
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
  renderInfographic(totals.summary);
}

document.addEventListener('DOMContentLoaded', initPage);
