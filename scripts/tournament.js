// scripts/tournament.js
// Монолітний турнірний в’ювер для Архіву #01

import { loadPlayers, normalizeLeague } from './api.js';
import { rankLetterForPoints } from './rankUtils.js';

const DEFAULT_AVATAR = 'assets/default_avatars/av0.png';

// ---------- Мапа нікнеймів → нік з таблиці ----------
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

// ---------- Статичний турнір (Архів #01) ----------
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
      color: 'var(--green)',
      players: ['Морті', 'Ворон', 'Оксанка', 'hAppser'],
    },
    blue: {
      name: 'Команда 2',
      color: 'var(--blue)',
      players: ['Laston', 'Leres', 'Кицюня', 'Cocosik'],
    },
    red: {
      name: 'Команда 3',
      color: 'var(--red)',
      players: ['Sem', 'Justy', 'Олег', 'Temostar'],
    },
  },
  modes: {
    dm: [
      {
        label: 'Раундовий DM',
        teamA: 'green',
        teamB: 'blue',
        // 1 – green, 2 – blue, 3 – red, "=" – нічия раунду
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
      { label: 'TDM', teamA: 'blue', teamB: 'red',  scores: { blue: 4, red: 2 } },
      { label: 'TDM', teamA: 'green', teamB: 'red', scores: { green: 3, red: 5 } },
    ],
  },
};

// ---------- Хелпери по гравцях ----------

function buildPlayerIndex(players) {
  const index = new Map();
  (players || []).forEach((p) => {
    if (p && p.nick) index.set(p.nick.toLowerCase(), p);
  });
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

// ---------- Іконки раундів ----------

function resultIcon(code) {
  if (code === '=') return '⚪';
  if (code === '1') return '🟢';
  if (code === '2') return '🔵';
  return '🔴';
}

function isTournamentPage() {
  return document.body && document.body.dataset.appMode === 'tournament';
}

// ---------- Обчислення статистики ----------

function initTeamStats() {
  const map = {};
  Object.entries(TOURNAMENT.teams).forEach(([key, team]) => {
    map[key] = {
      key,
      name: team.name,
      color: team.color,
      w: 0,
      l: 0,
      d: 0,
      points: 0,
      avgMmr: 0,
      place: 0,
    };
  });
  return map;
}

function initPlayerStats(playerIndex) {
  const map = {};
  Object.entries(TOURNAMENT.teams).forEach(([teamKey, team]) => {
    team.players.forEach((nick) => {
      const profile = getProfile(nick, playerIndex);
      map[nick] = {
        ...profile,
        teamKey,
        teamName: team.name,
        games: 0,
        w: 0,
        l: 0,
        d: 0,
        mvps: 0,
        second: 0,
        third: 0,
        dmRounds: 0,
        ktPoints: 0,
        tdmScore: 0,
        impact: 0,
        mmrDelta: 0, // TODO: можна підв’язати до історії ігор
      };
    });
  });
  return map;
}

function dmGameTeams(game) {
  const set = new Set([game.teamA, game.teamB]);
  (game.results || []).forEach((r) => {
    if (r === '=') return;
    const t = r === '1' ? 'green' : r === '2' ? 'blue' : 'red';
    set.add(t);
  });
  return Array.from(set);
}

function buildStats(playerIndex) {
  const teamStats = initTeamStats();
  const playerStats = initPlayerStats(playerIndex);

  // ----- DM -----
  (TOURNAMENT.modes.dm || []).forEach((game, idx) => {
    const teamsInGame = dmGameTeams(game);
    const roundWins = {};
    teamsInGame.forEach((t) => { roundWins[t] = 0; });

    // dmRounds + підрахунок перемог по раундах
    (game.results || []).forEach((r) => {
      if (r === '=') return;
      const winnerTeam = r === '1' ? 'green' : r === '2' ? 'blue' : 'red';
      if (!roundWins.hasOwnProperty(winnerTeam)) return;
      roundWins[winnerTeam] += 1;

      const winners = TOURNAMENT.teams[winnerTeam]?.players || [];
      winners.forEach((nick) => {
        const ps = playerStats[nick];
        if (ps) ps.dmRounds += 1;
      });
    });

    // MVP (по нікнейму з мапою)
    (game.mvp || []).forEach((nick) => {
      const apiNick = mapNick(nick);
      const target = Object.values(playerStats).find((p) => p.apiNick === apiNick);
      if (target) target.mvps += 1;
    });

    // Позиції команд у матчі
    const anyWins = Object.values(roundWins).some((v) => v > 0);
    if (!anyWins) {
      // повна нічия – всім D + +game
      teamsInGame.forEach((teamKey) => {
        const t = teamStats[teamKey];
        if (!t) return;
        t.d += 1;
        (TOURNAMENT.teams[teamKey].players || []).forEach((nick) => {
          const ps = playerStats[nick];
          if (!ps) return;
          ps.games += 1;
          ps.d += 1;
        });
      });
    } else {
      const ordered = teamsInGame.slice().sort((a, b) => (roundWins[b] || 0) - (roundWins[a] || 0));
      ordered.forEach((teamKey, pos) => {
        const t = teamStats[teamKey];
        if (!t) return;
        const players = TOURNAMENT.teams[teamKey].players || [];

        players.forEach((nick) => {
          const ps = playerStats[nick];
          if (!ps) return;
          ps.games += 1;
        });

        if (pos === 0) {
          t.w += 1;
          players.forEach((nick) => { const ps = playerStats[nick]; if (ps) ps.w += 1; });
        } else if (pos === 1) {
          t.l += 1;
          players.forEach((nick) => {
            const ps = playerStats[nick];
            if (!ps) return;
            ps.l += 1;
            ps.second += 1;
          });
        } else {
          t.l += 1;
          players.forEach((nick) => {
            const ps = playerStats[nick];
            if (!ps) return;
            ps.l += 1;
            ps.third += 1;
          });
        }
      });
    }
  });

  // ----- KT -----
  (TOURNAMENT.modes.kt || []).forEach((game) => {
    const teams = [game.teamA, game.teamB];
    const score = { [game.teamA]: 0, [game.teamB]: 0 };

    // усім гравцям цих двох команд +1 гра
    teams.forEach((teamKey) => {
      const players = TOURNAMENT.teams[teamKey]?.players || [];
      players.forEach((nick) => {
        const ps = playerStats[nick];
        if (ps) ps.games += 1;
      });
    });

    (game.rounds || []).forEach((round) => {
      const wKey = round.winner;
      const pts = Number(round.points) || 0;
      if (!score.hasOwnProperty(wKey)) return;
      score[wKey] += pts;

      const players = TOURNAMENT.teams[wKey]?.players || [];
      players.forEach((nick) => {
        const ps = playerStats[nick];
        if (ps) ps.ktPoints += pts;
      });
    });

    const a = game.teamA;
    const b = game.teamB;
    const sa = score[a];
    const sb = score[b];

    if (sa === sb) {
      // нічия
      [a, b].forEach((teamKey) => {
        const t = teamStats[teamKey];
        if (!t) return;
        t.d += 1;
        (TOURNAMENT.teams[teamKey].players || []).forEach((nick) => {
          const ps = playerStats[nick];
          if (!ps) return;
          ps.d += 1;
        });
      });
    } else {
      const winner = sa > sb ? a : b;
      const loser = sa > sb ? b : a;
      const tw = teamStats[winner];
      const tl = teamStats[loser];

      if (tw) tw.w += 1;
      if (tl) tl.l += 1;

      (TOURNAMENT.teams[winner].players || []).forEach((nick) => {
        const ps = playerStats[nick];
        if (ps) ps.w += 1;
      });
      (TOURNAMENT.teams[loser].players || []).forEach((nick) => {
        const ps = playerStats[nick];
        if (ps) ps.l += 1;
      });
    }

    // MVP
    (game.mvp || []).forEach((nick) => {
      const apiNick = mapNick(nick);
      const target = Object.values(playerStats).find((p) => p.apiNick === apiNick);
      if (target) target.mvps += 1;
    });
  });

  // ----- TDM -----
  (TOURNAMENT.modes.tdm || []).forEach((game) => {
    const a = game.teamA;
    const b = game.teamB;
    const sa = Number(game.scores?.[a] ?? 0);
    const sb = Number(game.scores?.[b] ?? 0);

    // усім цим гравцям +1 гра і накидуємо командний рахунок у tdmScore
    [a, b].forEach((teamKey) => {
      const scoreTeam = Number(game.scores?.[teamKey] ?? 0);
      const players = TOURNAMENT.teams[teamKey]?.players || [];
      players.forEach((nick) => {
        const ps = playerStats[nick];
        if (!ps) return;
        ps.games += 1;
        ps.tdmScore += scoreTeam;
      });
    });

    if (sa === sb) {
      [a, b].forEach((teamKey) => {
        const t = teamStats[teamKey];
        if (!t) return;
        t.d += 1;
        (TOURNAMENT.teams[teamKey].players || []).forEach((nick) => {
          const ps = playerStats[nick];
          if (!ps) return;
          ps.d += 1;
        });
      });
    } else {
      const winner = sa > sb ? a : b;
      const loser = sa > sb ? b : a;
      const tw = teamStats[winner];
      const tl = teamStats[loser];

      if (tw) tw.w += 1;
      if (tl) tl.l += 1;

      (TOURNAMENT.teams[winner].players || []).forEach((nick) => {
        const ps = playerStats[nick];
        if (ps) ps.w += 1;
      });
      (TOURNAMENT.teams[loser].players || []).forEach((nick) => {
        const ps = playerStats[nick];
        if (ps) ps.l += 1;
      });
    }
  });

  // ----- підрахунок командних очок та середнього MMR -----
  Object.values(teamStats).forEach((t) => {
    const players = TOURNAMENT.teams[t.key]?.players || [];
    const mmrArr = players.map((nick) => playerStats[nick]?.points || 0);
    const sum = mmrArr.reduce((a, b) => a + b, 0);
    t.avgMmr = mmrArr.length ? Math.round(sum / mmrArr.length) : 0;
    t.points = t.w * 3 + t.d;
  });

  const teamsArray = Object.values(teamStats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.avgMmr - a.avgMmr;
  });
  teamsArray.forEach((t, i) => { t.place = i + 1; });

  // ----- Impact гравців -----
  const playersArray = Object.values(playerStats);
  playersArray.forEach((p) => {
    const base = p.w * 3 + p.d; // базові турнірні поінти
    const bonus =
      p.mvps * 2 +
      p.second * 1 +
      p.third * 0.5 +
      p.dmRounds * 0.25 +
      p.ktPoints * 0.5 +
      p.tdmScore * 0.15;
    p.impact = Math.round(base + bonus);
  });

  playersArray.sort((a, b) => {
    if (b.impact !== a.impact) return b.impact - a.impact;
    return b.points - a.points;
  });

  // ----- Summary для верхнього блоку -----
  const totalDmRounds = (TOURNAMENT.modes.dm || [])
    .reduce((acc, g) => acc + (g.results?.length || 0), 0);

  const totalGames =
    (TOURNAMENT.modes.dm?.length || 0) +
    (TOURNAMENT.modes.kt?.length || 0) +
    (TOURNAMENT.modes.tdm?.length || 0);

  const totalPlayers = playersArray.length;
  const topMvp =
    playersArray.slice().sort((a, b) => b.mvps - a.mvps || b.impact - a.impact)[0] || null;

  return {
    teams: teamsArray,
    players: playersArray,
    summary: {
      totalDmRounds,
      totalGames,
      totalPlayers,
      topMvp,
    },
  };
}

// ---------- Рендер ----------

function renderHero() {
  const titleEl = document.getElementById('tournament-title');
  const metaEl = document.getElementById('tournament-meta');

  if (!titleEl || !metaEl) return;

  titleEl.textContent = TOURNAMENT.meta.title;
  metaEl.textContent = `${TOURNAMENT.meta.date} · ${TOURNAMENT.meta.format} · ${TOURNAMENT.meta.map}`;
}

function renderStatsSummary(summary) {
  const box = document.getElementById('tournament-stats');
  if (!box) return;

  const parts = [];

  parts.push(`
    <article class="stat-card">
      <p class="stat-label">Учасників</p>
      <p class="stat-value">${summary.totalPlayers}</p>
    </article>
  `);

  parts.push(`
    <article class="stat-card">
      <p class="stat-label">Матчів</p>
      <p class="stat-value">${summary.totalGames}</p>
    </article>
  `);

  parts.push(`
    <article class="stat-card">
      <p class="stat-label">Раундів DM</p>
      <p class="stat-value">${summary.totalDmRounds}</p>
    </article>
  `);

  if (summary.topMvp) {
    parts.push(`
      <article class="stat-card">
        <p class="stat-label">MVP турніру</p>
        <p class="stat-value">${summary.topMvp.displayNick}</p>
      </article>
    `);
  }

  box.innerHTML = parts.join('');
}

function renderTeams(teams) {
  const tbody = document.querySelector('#teams-table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  teams.forEach((t) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.name}</td>
      <td>${t.w}</td>
      <td>${t.l}</td>
      <td>${t.d}</td>
      <td>${t.points}</td>
      <td>${t.avgMmr}</td>
      <td>${t.place}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderPlayers(players) {
  const tbody = document.querySelector('#players-table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  players.forEach((p) => {
    const tr = document.createElement('tr');
    const mmrDelta = p.mmrDelta > 0 ? `+${p.mmrDelta}` : p.mmrDelta;

    tr.innerHTML = `
      <td>${p.displayNick}</td>
      <td>${p.teamName}</td>
      <td>${p.games}</td>
      <td>${p.w}</td>
      <td>${p.l}</td>
      <td>${p.d}</td>
      <td>${p.mvps}</td>
      <td>${p.second}</td>
      <td>${p.third}</td>
      <td>${p.impact}</td>
      <td>${mmrDelta}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderMatches() {
  const container = document.getElementById('matches-container');
  if (!container) return;

  container.innerHTML = '';

  // DM
  if (TOURNAMENT.modes.dm && TOURNAMENT.modes.dm.length) {
    const section = document.createElement('section');
    section.className = 'match-section';

    const title = document.createElement('h3');
    title.className = 'section-title';
    title.innerHTML = `DM <span class="badge mode-dm">Deathmatch</span>`;
    section.appendChild(title);

    TOURNAMENT.modes.dm.forEach((game, idx) => {
      const card = document.createElement('article');
      card.className = 'match-card';

      const teamA = TOURNAMENT.teams[game.teamA].name;
      const teamB = TOURNAMENT.teams[game.teamB].name;

      const roundIcons = (game.results || [])
        .map((r) => resultIcon(r))
        .join(' ');

      card.innerHTML = `
        <p class="match-title">DM #${idx + 1} — ${teamA} vs ${teamB}</p>
        <p class="match-meta">${game.label}</p>
        <div class="result-line">
          <span>Раунди:</span>
          <span>${roundIcons}</span>
        </div>
        <p class="match-meta">MVP: ${game.mvp.join(', ')}</p>
      `;
      section.appendChild(card);
    });

    container.appendChild(section);
  }

  // KT
  if (TOURNAMENT.modes.kt && TOURNAMENT.modes.kt.length) {
    const section = document.createElement('section');
    section.className = 'match-section';

    const title = document.createElement('h3');
    title.className = 'section-title';
    title.innerHTML = `KT <span class="badge mode-kt">Control Point</span>`;
    section.appendChild(title);

    TOURNAMENT.modes.kt.forEach((game, idx) => {
      const card = document.createElement('article');
      card.className = 'match-card';

      const teamA = TOURNAMENT.teams[game.teamA].name;
      const teamB = TOURNAMENT.teams[game.teamB].name;

      const rounds = (game.rounds || [])
        .map((r, i) => {
          const winnerName = TOURNAMENT.teams[r.winner].name;
          return `Раунд ${i + 1}: ${r.time} → ${winnerName} (+${r.points})`;
        })
        .join('<br>');

      card.innerHTML = `
        <p class="match-title">KT #${idx + 1} — ${teamA} vs ${teamB}</p>
        <p class="match-meta">${game.label}</p>
        <p class="match-meta">${rounds}</p>
        <p class="match-meta">MVP: ${game.mvp.join(', ')}</p>
      `;
      section.appendChild(card);
    });

    container.appendChild(section);
  }

  // TDM
  if (TOURNAMENT.modes.tdm && TOURNAMENT.modes.tdm.length) {
    const section = document.createElement('section');
    section.className = 'match-section';

    const title = document.createElement('h3');
    title.className = 'section-title';
    title.innerHTML = `TDM <span class="badge mode-tr">Team Deathmatch</span>`;
    section.appendChild(title);

    TOURNAMENT.modes.tdm.forEach((game, idx) => {
      const card = document.createElement('article');
      card.className = 'match-card';

      const teamA = TOURNAMENT.teams[game.teamA].name;
      const teamB = TOURNAMENT.teams[game.teamB].name;

      const sa = game.scores[game.teamA];
      const sb = game.scores[game.teamB];

      let meta = `${sa} — ${sb}`;
      if (sa === sb) {
        meta += ' (нічия)';
      } else if (sa > sb) {
        meta += ` · перемога ${teamA}`;
      } else {
        meta += ` · перемога ${teamB}`;
      }

      card.innerHTML = `
        <p class="match-title">TDM #${idx + 1} — ${teamA} vs ${teamB}</p>
        <p class="match-meta">${meta}</p>
      `;
      section.appendChild(card);
    });

    container.appendChild(section);
  }
}

// ---------- INIT ----------

async function loadPlayerIndexSafe() {
  try {
    const league = normalizeLeague(TOURNAMENT.league);
    const players = await loadPlayers(league);
    return buildPlayerIndex(players);
  } catch (err) {
    console.error('[tournament] failed to load league players', err);
    return buildPlayerIndex([]);
  }
}

async function initPage() {
  if (!isTournamentPage()) return;

  const requiredIds = [
    'tournament-title',
    'tournament-meta',
    'tournament-stats',
    'teams-table',
    'players-table',
    'matches-container',
  ];
  const missing = requiredIds.some((id) => !document.getElementById(id) && !document.querySelector(`#${id}`));
  if (missing) return;

  const playerIndex = await loadPlayerIndexSafe();
  const stats = buildStats(playerIndex);

  renderHero();
  renderStatsSummary(stats.summary);
  renderTeams(stats.teams);
  renderPlayers(stats.players);
  renderMatches();
}

function bootstrap() {
  if (!isTournamentPage()) return;

  const refreshBtn = document.getElementById('refresh-tournament');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      initPage();
    });
  }

  initPage();
}

document.addEventListener('DOMContentLoaded', bootstrap);
