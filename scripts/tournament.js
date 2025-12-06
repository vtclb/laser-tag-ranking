// -------------------------------------------------------------
// VARTA · Tournament view (один турнір, статичні дані + підрахунок)
// -------------------------------------------------------------

import {
  loadPlayers,
  normalizeLeague,
  avatarNickKey,
  fetchAvatarsMap,
  avatarSrcFromRecord
} from './api.js';
import { reloadAvatars } from './avatars.client.js';
import { rankLetterForPoints } from './rankUtils.js';

// Вмикай, якщо треба дебажити
const DEBUG_TOURNAMENT = false;

// Стандартний аватар
const DEFAULT_AVATAR = 'assets/default_avatars/av0.png';


const PLAYER_TOURNAMENT_DETAILS = {
  Morti: {
    id: 3,
    totalScore: 260,
    eff: 1.61,
    frags: 87,
    deacts: 54,
    shots: 211,
    hits: 177,
    accuracy: 84
  },
  Leres: {
    id: 4,
    totalScore: 233,
    eff: 1.47,
    frags: 75,
    deacts: 51,
    shots: 1532,
    hits: 162,
    accuracy: 11
  },
  Temostar: {
    id: 17,
    totalScore: 212,
    eff: 1.76,
    frags: 72,
    deacts: 41,
    shots: 1663,
    hits: 144,
    accuracy: 9
  },
  Laston: {
    id: 14,
    totalScore: 203,
    eff: 1.25,
    frags: 69,
    deacts: 55,
    shots: 634,
    hits: 136,
    accuracy: 21
  }
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

// Мапа "як ми пишемо нік" → "API-нік"
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
  const key = String(name || '').trim();
  return PLAYER_MAP[key] || key;
}

// DM-код → команда
const TEAM_BY_CODE = {
  '1': 'green',
  '2': 'blue',
  '3': 'red'
};

// ---------- ОПИС ТУРНІРУ (можеш редагувати під реальні дані) ----------
const TOURNAMENT = {
  league: 'olds',
  meta: {
    title: 'Турнір VARTA — Сезон Осінь',
    date: 'Старша ліга · жовтень 2024',
    format: '3×4 · DM · KT · TDM',
    map: 'Pixel-arena · Neon Raid',
    modes: ['DM', 'KT', 'TDM']
  },
  teams: {
    green: {
      id: 'green',
      name: 'Зелена команда',
      color: 'var(--team-green)',
      players: ['Морті', 'Ворон', 'Оксанка', 'hAppser']
    },
    blue: {
      id: 'blue',
      name: 'Синя команда',
      color: 'var(--team-blue)',
      players: ['Laston', 'Leres', 'Кицюня', 'Cocosik']
    },
    red: {
      id: 'red',
      name: 'Червона команда',
      color: 'var(--team-red)',
      players: ['Sem', 'Justy', 'Олег', 'Temostar']
    }
  },
  // DM / KT / TDM – сюди ми забиваємо факт ігор,
  // під них автопідрахунок робить підсумки
  modes: {
    dm: [
      {
        label: 'Раундовий DM',
        teamA: 'green',
        teamB: 'blue',
        // 1 → green, 2 → blue, 3 → red, = → нічия
        results: ['2', '=', '2', '=', '2', '2', '2'],
        mvp: ['Laston', 'Leres', 'Морті']
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
        // !!! Тут знову повернувся до явних points, як ти й рахував у своїй табличці
        rounds: [
          { winner: 'green', time: '4:07', points: 1 },
          { winner: 'blue', time: '3:56', points: 2 }
        ],
        mvp: ['Морті', 'Laston', 'Leres']
      },
      {
        label: 'Control Point',
        teamA: 'blue',
        teamB: 'red',
        rounds: [
          { winner: 'blue', time: '3:52', points: 2 },
          { winner: 'red', time: '3:13', points: 3 }
        ],
        mvp: ['Морті', 'Laston', 'Temostar']
      },
      {
        label: 'Control Point',
        teamA: 'red',
        teamB: 'green',
        rounds: [
          { winner: 'red', time: '3:06', points: 3 },
          { winner: 'red', time: '3:09', points: 3 }
        ],
        mvp: ['Морті', 'Justy', 'Temostar']
      }
    ],
    tdm: [
      { label: 'TDM', teamA: 'green', teamB: 'blue', scores: { green: 1, blue: 4 } },
      { label: 'TDM', teamA: 'blue', teamB: 'red', scores: { blue: 4, red: 2 } },
      { label: 'TDM', teamA: 'green', teamB: 'red', scores: { green: 3, red: 5 } }
    ]
  }
};

// ---------- Допоміжні штуки ----------

function resultIcon(code) {
  if (code === '=') return '⚪';
  if (code === '1') return '🟢';
  if (code === '2') return '🔵';
  return '🔴'; // '3'
}

function rankClass(rank) {
  const letter = String(rank || '').trim();
  return `rank-chip rank-xs rank-${letter.toLowerCase()}`;
}

// пробуємо знайти правильне поле з аватаркою,
// щоб воно збігалось з тим, як уже працює на рейтинговій сторінці
function pickAvatarFromPlayerObj(base) {
  if (!base) return null;

  const direct = base.avatar || base.avatarUrl || base.avatarURL || base.photo || base.photoUrl || base.photoURL;
  if (typeof direct === 'string' && direct.length > 4) return direct;

  // fallback: шукаємо будь-який рядок, схожий на URL / шлях до зображення
  const key = Object.keys(base).find((k) => {
    const v = base[k];
    return (
      typeof v === 'string' &&
      /(http(s)?:\/\/|avatars?\/|\.png|\.jpg|\.jpeg|\.webp)/i.test(v)
    );
  });

  return key ? base[key] : null;
}

// ---------- Player Index ----------

function buildPlayerIndex(players) {
  const index = new Map();

  players.forEach((p) => {
    const aliases = [p.nick, p.apiNick, p.name, p.Nickname, p.nickname, p.playerNick];
    aliases
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      .forEach((alias) => {
        const key = alias.toLowerCase();
        if (!index.has(key)) index.set(key, p);
      });
  });

  return index;
}

async function enrichPlayersWithAvatars(players) {
  try {
    const mapResult = await fetchAvatarsMap();
    const mapping = (mapResult && mapResult.mapping) || {};
    const out = [];

    for (const p of players) {
      const nick = p.nick || p.Nickname || p.nickname;
      if (!nick) {
        out.push(p);
        continue;
      }

      const key = avatarNickKey(nick);
      const mappedValue = mapping[key];
      const mappedUrl = typeof mappedValue === 'string'
        ? mappedValue
        : avatarSrcFromRecord(mappedValue);

      if (mappedUrl && typeof mappedUrl === 'string') {
        out.push({ ...p, avatar: mappedUrl });
      } else {
        out.push(p);
      }
    }

    return out;
  } catch (err) {
    console.warn('[tournament] enrichPlayersWithAvatars failed', err);
    return players;
  }
}

function getProfile(displayNick, playerIndex) {
  const apiNick = mapNick(displayNick);
  const key = String(apiNick || '').toLowerCase();
  const base = key ? playerIndex.get(key) : null;

  const pts = Number(base?.pts ?? base?.points ?? base?.mmr ?? base?.rating ?? 0);
  const rank = base?.rank || rankLetterForPoints(pts);
  const avatar = pickAvatarFromPlayerObj(base) || DEFAULT_AVATAR;
  const seasonGames = Number(base?.games ?? base?.Games ?? base?.gameCount ?? base?.count ?? 0) || null;

  if (DEBUG_TOURNAMENT && !base) {
    console.warn('[tournament] no base player found for', apiNick);
  }

  return {
    displayNick,
    apiNick,
    points: pts,
    rank,
    avatar,
    seasonGames,
    league: normalizeLeague(TOURNAMENT.league)
  };
}


function buildPlayerIdentity(player, options = {}) {
  const { showTeamChip = true } = options;

function buildPlayerIdentity(player) {

  const nickShown = player.displayNick || player.nick || player.playerNick;
  const apiNick = player.apiNick || player.nick || player.playerNick;
  const teamClass = player.teamId ? `team-chip team-chip--${player.teamId}` : 'team-chip';
  const rank = player.rank || player.rankLetter || '';
  const rankBadge = rank
    ? `<span class="${rankClass(rank)}">${rank}</span>`
    : '';

  return `
    <div class="player-identity">
      <div class="player-avatar">
        <img class="avatar avatar--sm"
             data-nick="${escapeHtml(apiNick)}"
             alt="${escapeHtml(nickShown)}"
             loading="lazy" />
      </div>
      <div class="player-name-block">
        <div class="player-name-row">
          <span class="player-nick">${escapeHtml(nickShown)}</span>
          ${rankBadge}
        </div>
        <div class="player-meta">
          ${showTeamChip && player.teamName ? `<span class="${teamClass}">${escapeHtml(player.teamName)}</span>` : ''}
          <span class="player-handle">@${escapeHtml(apiNick)}</span>
        </div>
      </div>
    </div>
  `;
}


// ---------- Стартові структури ----------

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
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      points: 0, // 3 за W, 1 за D
      place: 0,
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

// ---------- Підрахунок усіх статистик ----------

function buildTournamentStats(playerIndex) {
  // NOTE: ручний оверрайд очок для турніру #1 (див. блок нижче). Для інших турнірів цей блок можна буде вимкнути/замінити.
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

  // ---- DM ----
  TOURNAMENT.modes.dm.forEach((game) => {
    const counters = { green: 0, blue: 0, red: 0 };

    totalDmRounds += game.results.length;

    game.results.forEach((code) => {
      if (code === '=') return;
      const teamId = TEAM_BY_CODE[code];
      if (teamId) counters[teamId] += 1;
    });

    // раунди DM
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

      const sorted = Object.entries(counters).sort((a, b) => b[1] - a[1]);

      const winnerIds = [];
      const drawIds = [];
      const loserIds = [];

      sorted.forEach(([teamId, v], idx) => {
        const currentPlace = idx + 1;
        if (v === maxWins) {
          winnerIds.push(teamId);
        } else if (v === sorted[1][1] && winnerIds.length === 1) {
          // друге місце
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

    // MVP
    game.mvp.forEach((nick) => {
      const apiNick = mapNick(nick);
      const player = Object.values(playerStats).find((p) => p.apiNick === apiNick);
      if (player) player.mvps += 1;
    });
  });

  // ---- KT ----
  TOURNAMENT.modes.kt.forEach((game) => {
    const pts = { [game.teamA]: 0, [game.teamB]: 0 };

    game.rounds.forEach((round) => {
      const roundPoints = Number.isFinite(Number(round.points))
        ? Number(round.points)
        : 1; // дефолт, якщо хтось забуде points

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

  // ---- TDM ----
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

   // ---- Фінальна агрегація по командах ----
  const teamArray = Object.values(teamStats);

  // 🔴 РУЧНИЙ ОВЕРРАЙД ПІД КОНКРЕТНИЙ ТУРНІР (Сині/Червоні/Зелені)
  // Значення взяті з твого перерахунку:
  // DM:  Сині 10, Червоні 6, Зелені 2
  // KT:  Сині 4,  Червоні 9, Зелені 1
  // TDM: Сині 8,  Червоні 7, Зелені 4
  const overrideModePoints = {
    blue:  { dm: 10, kt: 4, tdm: 8 },
    red:   { dm: 6,  kt: 9, tdm: 7 },
    green: { dm: 2,  kt: 1, tdm: 4 },
  };

  for (const team of teamArray) {
    const o = overrideModePoints[team.id];
    if (!o) continue;

    team.dmRoundsWon = o.dm;
    team.ktPoints    = o.kt;
    team.tdmScore    = o.tdm;
    team.points      = o.dm + o.kt + o.tdm; // Разом очок = DM + KT + TDM
  }

  // Сортування турнірної таблиці за оновленими очками
  teamArray.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.dmRoundsWon !== a.dmRoundsWon) return b.dmRoundsWon - a.dmRoundsWon;
    if (b.ktPoints !== a.ktPoints) return b.ktPoints - a.ktPoints;
    return b.tdmScore - a.tdmScore;
  });


  teamArray.forEach((t, i) => {
    t.place = i + 1;
  });

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

  const dmBeast = playerArray.reduce(
    (best, p) => (p.dmRounds > (best?.dmRounds || 0) ? p : best),
    null
  );
  const ktKing = playerArray.reduce(
    (best, p) => (p.ktPoints > (best?.ktPoints || 0) ? p : best),
    null
  );
  const baseBreaker = playerArray.reduce(
    (best, p) => (p.tdmScore > (best?.tdmScore || 0) ? p : best),
    null
  );

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
    },
    teamTotals: teamArray.map((t) => ({
      id: t.id,
      name: t.name,
      dm: t.dmRoundsWon,
      kt: t.ktPoints,
      tdm: t.tdmScore,
      total: t.dmRoundsWon + t.ktPoints + t.tdmScore,
      record: `${t.wins}W-${t.draws}D-${t.losses}L`
    })),
    awards: {
      championTeam: teamArray[0] || null,
      topMvp,
      dmBeast,
      ktKing,
      baseBreaker
    }
  };

  return {
    teamStats: teamArray,
    playerStats: playerArray,
    podiumPlayers: playerArray.slice(0, 3),
    topMvp,
    totalPlayers: playerArray.length,
    totalMatches,
    summary
  };
}

// ---------- HERO ----------

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
    { label: 'Гравців', value: totals.totalPlayers },
    { label: 'Команд', value: totals.summary?.totalTeams ?? Object.keys(TOURNAMENT.teams).length },
    { label: 'Матчів (DM/KT/TDM)', value: totals.totalMatches }
  ];

  if (totals.topMvp) {
    cards.push({
      label: 'MVP турніру',
      value: `${totals.topMvp.displayNick} (${totals.topMvp.mvps})`,
      detail: PLAYER_TOURNAMENT_DETAILS[mapNick(totals.topMvp.apiNick)]
    });
  }

  cards.forEach((card) => {
    const detail = card.detail
      ? `<p class="stat-subline">Бали: ${card.detail.totalScore} · Еф: ${card.detail.eff}</p>
         <p class="stat-subline">Фраги/деактив: ${card.detail.frags} / ${card.detail.deacts}</p>
         <p class="stat-subline">Постріли/влучення: ${card.detail.shots} / ${card.detail.hits} · Точність: ${card.detail.accuracy}%</p>`
      : '';

    statsEl.insertAdjacentHTML(
      'beforeend',
      `<div class="stat-card">
        <p class="stat-label">${card.label}</p>
        <p class="stat-value">${card.value}</p>
        ${detail}
      </div>`
    );
  });

  if (totals.podiumPlayers && totals.podiumPlayers.length) {
    const podium = totals.podiumPlayers
      .map((p, i) => {
        const place = i + 1;
        const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉';

        const detail = PLAYER_TOURNAMENT_DETAILS[mapNick(p.apiNick)] || null;
        const detailLines = detail
          ? `<div class="podium-lines">
              <div class="podium-line">${p.displayNick} (ID ${detail.id})</div>
              <div class="podium-line">Бали: ${detail.totalScore} · Еф: ${detail.eff}</div>
              <div class="podium-line">Фраги/деактив: ${detail.frags} / ${detail.deacts}</div>
              <div class="podium-line">Постріли/влучення: ${detail.shots} / ${detail.hits}</div>
              <div class="podium-line">Точність: ${detail.accuracy}%</div>
            </div>`
          : '';

        return `<li>
          <div class="podium-row">
            <div class="podium-main">${medal} ${p.displayNick} <span class='muted'>(ранг ${p.rank} · Impact ${p.impact} · MVP ${p.mvps})</span></div>
            ${detailLines}
          </div>
        </li>`;

        return `<li>${medal} ${p.displayNick} <span class='muted'>(ранг ${p.rank} · Impact ${p.impact} · MVP ${p.mvps})</span></li>`;

      })
      .join('');

    statsEl.insertAdjacentHTML(
      'beforeend',
      `<div class="stat-card stat-card--podium">
        <p class="stat-label">Топ-3 гравців турніру</p>
        <ul class="podium-list">${podium}</ul>
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

  const awards = summary.awards || {};
  const awardCards = [];

  if (awards.championTeam) {
    awardCards.push({
      icon: '🏆',
      title: 'Champion Team',
      value: awards.championTeam.name,
      meta: `DM ${awards.championTeam.dm} · KT ${awards.championTeam.kt} · TDM ${awards.championTeam.tdm} = ${
        awards.championTeam.dm + awards.championTeam.kt + awards.championTeam.tdm
      }`
    });
  }
  if (awards.topMvp) awardCards.push({ icon: '⭐', title: 'MVP турніру', value: awards.topMvp.displayNick, meta: `${awards.topMvp.mvps} MVP` });
  if (awards.dmBeast) awardCards.push({ icon: '💥', title: 'DM Beast', value: awards.dmBeast.displayNick, meta: `${awards.dmBeast.dmRounds} раундів` });
  if (awards.ktKing) awardCards.push({ icon: '🎯', title: 'KT King', value: awards.ktKing.displayNick, meta: `${awards.ktKing.ktPoints} очок` });
  if (awards.baseBreaker) awardCards.push({ icon: '🚩', title: 'Base Breaker', value: awards.baseBreaker.displayNick, meta: `${awards.baseBreaker.tdmScore} баз` });

  if (awardCards.length) {
    const awardGrid = awardCards
      .map(
        (card) => `
        <div class="award-card">
          <div class="award-card__icon">${card.icon}</div>
          <div class="award-card__body">
            <p class="award-card__title">${card.title}</p>
            <p class="award-card__value">${card.value}</p>
            <p class="award-card__meta">${card.meta}</p>
          </div>
        </div>`
      )
      .join('');
    container.insertAdjacentHTML('beforeend', `<div class="award-grid">${awardGrid}</div>`);
  }

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

  const infoGrid = cards
    .map(
      (card) => `
      <div class="info-chip">
        <p class="info-chip__label">${card.label}</p>
        <p class="info-chip__value">${card.value}</p>
      </div>`
    )
    .join('');

  container.insertAdjacentHTML('beforeend', `<div class="infographic-grid">${infoGrid}</div>`);

  const scoreCards = (summary.teamTotals || [])
    .map(
      (t) => `
      <div class="score-card team-${t.id}-row">
        <div class="score-card__row">
          <span class="team-chip team-chip--${t.id}">
            <span class="team-chip__dot"></span><span>${t.name}</span>
          </span>
        </div>
        <div class="score-card__stats">DM ${t.dm} · KT ${t.kt} · TDM ${t.tdm}</div>
        <div class="score-card__total">${t.total} очок</div>
        <div class="score-card__meta">${t.record}</div>
      </div>`
    )
    .join('');

  if (scoreCards) {
    container.insertAdjacentHTML('beforeend', `<div class="score-grid">${scoreCards}</div>`);
  }
}

// ---------- Таблиця команд ----------

function renderTeams(teamStats) {
  const tbody = document.querySelector('#teams-table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  teamStats.forEach((t) => {
    const nameCell = `
      <span class="team-chip team-chip--${t.id}">
        <span class="team-chip__dot"></span>
        <span>${t.name}</span>
      </span>`;

    const total = t.dmRoundsWon + t.ktPoints + t.tdmScore;
    const wdl = `${t.wins} / ${t.draws} / ${t.losses}`;

    tbody.insertAdjacentHTML(
      'beforeend',
      `<tr class="team-${t.id}-row">
        <td>${nameCell}</td>
        <td>${wdl}</td>
        <td>${t.dmRoundsWon}</td>
        <td>${t.ktPoints}</td>
        <td>${t.tdmScore}</td>
        <td><strong>${total}</strong></td>
        <td>${Math.round(t.avgMMR)}</td>
        <td>${t.place}</td>
      </tr>`
    );
  });
}

function buildPlayerStatsMap(playerStats) {
  const map = new Map();
  playerStats.forEach((p) => map.set(p.displayNick, p));
  return map;
}

function renderTeamCards(teamStats, playerStatsMap, playerIndex) {
  const grid = document.getElementById('teams-cards-grid');
  if (!grid) return;

  grid.innerHTML = '';

  teamStats.forEach((team) => {
    const teamPlayers = TOURNAMENT.teams[team.id]?.players || [];
    const rows = teamPlayers
      .map((nick) => {
        const stats = playerStatsMap.get(nick) || getProfile(nick, playerIndex);
        const winRate = stats.games > 0 ? `${Math.round((stats.wins / stats.games) * 100)}%` : '—';
        return `
          <tr>

            <td>${buildPlayerIdentity({ ...stats, displayNick: nick, teamId: team.id, teamName: team.name }, { showTeamChip: false })}</td>

            <td>${buildPlayerIdentity({ ...stats, displayNick: nick, teamId: team.id, teamName: team.name })}</td>

            <td>${stats.points ?? '—'}</td>
            <td>${stats.rank ?? '—'}</td>
            <td>${stats.games ?? 0}</td>
            <td>${winRate}</td>
            <td>${stats.mvps ?? 0}</td>
            <td>${stats.impact ?? 0}</td>
          </tr>`;
      })
      .join('');

    const total = team.dmRoundsWon + team.ktPoints + team.tdmScore;

    grid.insertAdjacentHTML(
      'beforeend',
      `<article class="team-card team-${team.id}-row">
        <div class="team-card__header">
          <span class="team-chip team-chip--${team.id}"><span class="team-chip__dot"></span><span>${team.name}</span></span>
          <div class="team-card__score">${total} очок</div>
        </div>
        <div class="team-card__meta">DM ${team.dmRoundsWon} · KT ${team.ktPoints} · TDM ${team.tdmScore} · Avg MMR ${Math.round(team.avgMMR)}</div>
        <div class="team-card__players">
          <table>
            <thead><tr><th>Гравець</th><th>Points</th><th>Ранг</th><th>Ігор</th><th>Win%</th><th>MVP</th><th>Impact</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </article>`
    );
  });
}

// ---------- Таблиця гравців ----------

function statItem(label, value) {
  return `
    <div class="stat-item">
      <span class="label">${label}</span>
      <span class="value">${value}</span>
    </div>`;
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
    </div>`;
}

function renderSeasonBlock(p) {
  if (!p.points && !p.rank && !p.seasonGames) return '';

  const seasonGames = Number.isFinite(p.seasonGames) ? p.seasonGames : '—';

  return `
    <div class="info-card">
      <h3>Сезонна статистика</h3>
      <div class="stat-list">
        ${statItem('Ранг', p.rank || '—')}
        ${statItem('Сезонні очки', p.points ?? '—')}
        ${statItem('Ігор у сезоні', seasonGames)}
      </div>
    </div>`;
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

  const header = `
    <div class="player-modal__header">
      <div class="player-modal__avatar">
        <img class="avatar" data-nick="${escapeHtml(player.apiNick)}" alt="${escapeHtml(player.displayNick)}"
             loading="lazy">
      </div>
      <div class="player-modal__title">
        <div class="player-name-row" style="font-size:1.1rem;">
          ${player.displayNick}
          <span class="${rankClass(player.rank)}">${player.rank}</span>
        </div>
        <div class="modal-sub">@${player.apiNick} · ${player.teamName}</div>
      </div>
      <span class="tag">MMR: ${player.points}</span>
  </div>`;

  const tournamentBlock = renderTournamentBlock(player);
  const seasonBlock = renderSeasonBlock(player);

  content.innerHTML = `${header}<div class="player-modal__grid">${seasonBlock}${tournamentBlock}</div>`;

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

  reloadAvatars(modal).catch((err) => console.warn('[tournament] modal avatars failed', err));
}

function renderPlayers(playerStats) {
  const tbody = document.querySelector('#players-table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  playerStats.forEach((p) => {
    const teamLabel = TOURNAMENT.teams[p.teamId]?.name || p.teamName || '';
    const teamChip = `<span class="team-chip team-chip--${p.teamId}">
      <span class="team-chip__dot"></span>
      <span>${teamLabel}</span>
    </span>`;

    const nickCell = buildPlayerIdentity(p);
    const mmrDelta = p.mmrDelta === 0 ? '—' : p.mmrDelta > 0 ? `+${p.mmrDelta}` : String(p.mmrDelta);

    const row = document.createElement('tr');
    row.classList.add('player-row', `team-${p.teamId}-row`);
    row.dataset.nick = p.displayNick;
    row.dataset.apiNick = p.apiNick;

    row.innerHTML = `
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

    row.addEventListener('click', () => openPlayerModal(p));
    tbody.appendChild(row);
  });
}

// ---------- Матчі (більш наочно) ----------

function renderModes() {
  const container = document.getElementById('matches-container');
  if (!container) return;

  container.innerHTML = '';

  container.insertAdjacentHTML('beforeend', '<h2 class="section-title mode-divider">Deathmatch</h2>');

  // DM
  TOURNAMENT.modes.dm.forEach((game, idx) => {
    const counters = { green: 0, blue: 0, red: 0 };
    const participants = new Set();
    game.results.forEach((code) => {
      if (code === '=') return;
      const teamId = TEAM_BY_CODE[code];
      if (teamId) {
        counters[teamId] += 1;
        participants.add(teamId);
      }
    });

    if (participants.size === 0) {
      if (game.teamA) participants.add(game.teamA);
      if (game.teamB) participants.add(game.teamB);
    }

    const line = game.results.map(resultIcon).join(' ');
    const summary = Array.from(participants)
      .map((teamId) => {
        const teamName = TOURNAMENT.teams[teamId]?.name || '';
        return `
        <div class="result-line">
          <span class="team-chip team-chip--${teamId}"><span class="team-chip__dot"></span><span>${teamName}</span></span>
          <span><strong>${counters[teamId] || 0}</strong> раундів</span>
        </div>`;
      })
      .join('');

    const participantNames = Array.from(participants)
      .map((id) => TOURNAMENT.teams[id]?.name)
      .filter(Boolean)
      .join(' vs ');

    container.insertAdjacentHTML(
      'beforeend',
      `<article class="bal__card match-card match-card--mode-dm">
        <h3 class="match-title">DM · Раунд ${idx + 1}</h3>
        <p class="match-meta">${participantNames || 'Всі три команди'}</p>
        <div class="round-row">${line}</div>
        ${summary}
        <p class="match-meta">MVP: ${game.mvp.join(', ')}</p>
      </article>`
    );
  });

  container.insertAdjacentHTML('beforeend', '<h2 class="section-title mode-divider">King of the Hill</h2>');

  // KT
  TOURNAMENT.modes.kt.forEach((game) => {
    const pts = { [game.teamA]: 0, [game.teamB]: 0 };

    const roundsHtml = game.rounds
      .map((r, i) => {
        const roundPoints = Number.isFinite(Number(r.points)) ? Number(r.points) : 1;
        pts[r.winner] = (pts[r.winner] || 0) + roundPoints;
        const teamName = TOURNAMENT.teams[r.winner].name;
        return `<div class="round-row">Раунд ${i + 1}: <strong>${r.time}</strong> → ${teamName} (+${roundPoints})</div>`;
      })
      .join('');

    const aPts = pts[game.teamA] || 0;
    const bPts = pts[game.teamB] || 0;

    const aName = TOURNAMENT.teams[game.teamA].name;
    const bName = TOURNAMENT.teams[game.teamB].name;

    const winnerLine =
      aPts === bPts
        ? 'Нічия'
        : aPts > bPts
        ? `Переміг: ${aName}`
        : `Переміг: ${bName}`;

    container.insertAdjacentHTML(
      'beforeend',
      `<article class="bal__card match-card match-card--mode-kt">
        <div class="match-card__header">
          <div>
            <h3 class="match-title">King of the Hill</h3>
            <p class="match-meta">${aName} vs ${bName}</p>
          </div>
          <div class="match-card__mode">KT</div>
        </div>
        <div class="result-line">
          <span class="team-chip team-chip--${game.teamA}"><span class="team-chip__dot"></span><span>${aName}</span></span>
          <strong>${aPts} : ${bPts}</strong>
          <span class="team-chip team-chip--${game.teamB}"><span class="team-chip__dot"></span><span>${bName}</span></span>
        </div>
        ${roundsHtml}
        <p class="match-meta">${winnerLine}</p>
        <p class="match-meta">MVP: ${game.mvp.join(', ')}</p>
      </article>`
    );
  });

  container.insertAdjacentHTML('beforeend', '<h2 class="section-title mode-divider">Team Deathmatch</h2>');

  // TDM
  TOURNAMENT.modes.tdm.forEach((game) => {
    const aName = TOURNAMENT.teams[game.teamA].name;
    const bName = TOURNAMENT.teams[game.teamB].name;
    const scoreA = game.scores[game.teamA] || 0;
    const scoreB = game.scores[game.teamB] || 0;
    const winner =
      scoreA === scoreB ? 'Нічия' : scoreA > scoreB ? `Переміг: ${aName}` : `Переміг: ${bName}`;

    container.insertAdjacentHTML(
      'beforeend',
      `<article class="bal__card match-card match-card--mode-tdm">
        <h3 class="match-title">TDM · ${aName} vs ${bName}</h3>
        <div class="result-line">
          <span class="team-chip team-chip--${game.teamA}">
            <span class="team-chip__dot"></span><span>${aName}</span>
          </span>
          <strong>${scoreA} : ${scoreB}</strong>
          <span class="team-chip team-chip--${game.teamB}">
            <span class="team-chip__dot"></span><span>${bName}</span>
          </span>
        </div>
        <p class="match-meta">${winner}</p>
      </article>`
    );
  });
}

// ---------- INIT ----------

async function initPage() {
  try {
    const rawPlayers = await loadPlayers(TOURNAMENT.league);
    const playersWithAvatars = await enrichPlayersWithAvatars(rawPlayers);
    const index = buildPlayerIndex(playersWithAvatars);

    const totals = buildTournamentStats(index);

    const playerStatsMap = buildPlayerStatsMap(totals.playerStats);

    renderHero(totals);
    renderTeams(totals.teamStats);
    renderTeamCards(totals.teamStats, playerStatsMap, index);
    renderPlayers(totals.playerStats);
    renderModes();
    renderInfographic(totals.summary);
    await reloadAvatars(document);

    if (DEBUG_TOURNAMENT) {
      window.tournamentTotals = totals;
      console.log('[tournament] totals', totals);
    }
  } catch (err) {
    console.error('[tournament] init error', err);
  }
}

document.addEventListener('DOMContentLoaded', initPage);
