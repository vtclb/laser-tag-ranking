
import { rankLetterForPoints } from './rankUtils.js';


const NICK_MAP = {
  "Юра": "Morti",
  "Морті": "Morti",
  "Сегедин": "Morti",
  "Ворон": "Voron",
  "Оксана": "Оксанка",
  "Оксанка": "Оксанка",
  "Даня": "hAppser",
  "Happser": "hAppser",
  "happser": "hAppser",
  "Ластон": "Laston",
  "Лерес": "Leres",
  "Вова": "Leres",
  "Кіцюня": "Кицюня",
  "Кокосік": "Сocosik",
  "Валя": "Сocosik",
  "Сем": "Sem",
  "Джасті": "Justy",
  "Олег": "Олег",
  "Темофій": "Temostar",
  "Темостар": "Temostar"
};

function mapNick(tournamentNick) {
  return NICK_MAP[tournamentNick] || tournamentNick;
}

const TOURNAMENT_DATA = {
  meta: {
    title: 'Турнір VARTA — Архів #01',
    date: '15 грудня 2024',
    location: 'Pixel-arena · Neon raid',
    format: '3×4: DM + Control Point + TDM',
    modes: ['DM', 'KT', 'TDM']
  },
  teams: {
    green: {
      name: 'Green Team',
      color: '#14db62',
      players: ['Морті', 'Ворон', 'Оксанка', 'hAppser']
    },
    blue: {
      name: 'Blue Team',
      color: '#4faaff',
      players: ['Laston', 'Leres', 'Кицюня', 'Сocosik']
    },
    red: {
      name: 'Red Team',
      color: '#ff4646',
      players: ['Sem', 'Justy', 'Олег', 'Temostar']
    }
  },
  modes: {
    dm: [
      {
        match: 'Green vs Blue',
        results: ['2', '=', '2', '=', '2', '2', '2'],
        mvp: { first: 'Laston', second: 'Leres', third: 'Morti' }
      },
      {
        match: 'Red vs Blue',
        results: ['2', '3', '2', '2', '2', '2'],
        mvp: { first: 'Leres', second: 'Laston', third: 'Sem' }
      },
      {
        match: 'Red vs Green',
        results: ['3', '=', '3', '3', '1', '3', '1', '3'],
        mvp: { first: 'Morti', second: 'Temostar', third: 'Олег' }
      }
    ],
    kt: [
      {
        match: 'Blue vs Green',
        rounds: [
          { winner: 'Green', time: '4:07', points: 1 },
          { winner: 'Blue', time: '3:56', points: 2 }
        ],
        mvp: ['Morti', 'Laston', 'Leres']
      },
      {
        match: 'Blue vs Red',
        rounds: [
          { winner: 'Blue', time: '3:52', points: 2 },
          { winner: 'Red', time: '3:13', points: 3 }
        ],
        mvp: ['Morti', 'Laston', 'Temostar']
      },
      {
        match: 'Red vs Green',
        rounds: [
          { winner: 'Red', time: '3:06', points: 3 },
          { winner: 'Red', time: '3:09', points: 3 }
        ],
        mvp: ['Morti', 'Justy', 'Temostar']
      }
    ],
    tdm: [
      { match: 'Green vs Blue', green: 1, blue: 4 },
      { match: 'Blue vs Red', blue: 4, red: 2 },
      { match: 'Green vs Red', green: 3, red: 5 }
    ]
  }
};

const TEAM_CODE = { 1: 'green', 2: 'blue', 3: 'red' };
const DEFAULT_AVATAR = 'assets/default_avatars/av0.png';
=======

  "Ворон": "Voron",

  "Оксана": "Оксанка",
  "Оксанка": "Оксанка",

  "Даня": "hAppser",
  "Happser": "hAppser",

  "happser": "hAppser",


  "Ластон": "Laston",

  "Лерес": "Leres",
  "Вова": "Leres",

  "Кіцюня": "Кицюня",

  "Кокосік": "Сocosik",
  "Валя": "Сocosik",

  "Сем": "Sem",

  "Джасті": "Justy",

  "Олег": "Олег",

  "Темофій": "Temostar",
  "Темостар": "Temostar"
};

const TEAMS = {
  green: {
    name: "Green Team",
    color: "#14db62",
    players: ["Морті", "Ворон", "Оксанка", "hAppser"]
  },
  blue: {
    name: "Blue Team",
    color: "#4faaff",
    players: ["Laston", "Leres", "Кицюня", "Сocosik"]
  },
  red: {
    name: "Red Team",
    color: "#ff4646",
    players: ["Sem", "Justy", "Олег", "Temostar"]
  }
};

const DM = [
  {
    match: "Green vs Blue",
    results: ["2", "=", "2", "=", "2", "2", "2"],
    mvp: { first: "Laston", second: "Leres", third: "Morti" }
  },
  {
    match: "Red vs Blue",
    results: ["2", "3", "2", "2", "2", "2"],
    mvp: { first: "Leres", second: "Laston", third: "Sem" }
  },
  {
    match: "Red vs Green",
    results: ["3", "=", "3", "3", "1", "3", "1", "3"],
    mvp: { first: "Morti", second: "Temostar", third: "Олег" }
  }
];

const KT = [
  {
    match: "Blue vs Green",
    rounds: [
      { winner: "Green", time: "4:07", points: 1 },
      { winner: "Blue", time: "3:56", points: 2 }
    ],
    mvp: ["Morti", "Laston", "Leres"]
  },
  {
    match: "Blue vs Red",
    rounds: [
      { winner: "Blue", time: "3:52", points: 2 },
      { winner: "Red", time: "3:13", points: 3 }
    ],
    mvp: ["Morti", "Laston", "Temostar"]
  },
  {
    match: "Red vs Green",
    rounds: [
      { winner: "Red", time: "3:06", points: 3 },
      { winner: "Red", time: "3:09", points: 3 }
    ],
    mvp: ["Morti", "Justy", "Temostar"]
  }
];

const TDM = [
  { match: "Green vs Blue", green: 1, blue: 4 },
  { match: "Blue vs Red", blue: 4, red: 2 },
  { match: "Green vs Red", green: 3, red: 5 }
];

const TEAM_CODE = { 1: "green", 2: "blue", 3: "red" };
const DEFAULT_AVATAR = "assets/default_avatars/av0.png";

const profileCache = new Map();
let playerStats = {};

const uniquePlayers = Array.from(

  new Set(Object.values(TOURNAMENT_DATA.teams).flatMap((team) => team.players))
);

const state = {
  stats: {},
  summary: {},
  profiles: new Map()
};

function rankTone(rank) {
  return `rank-${(rank || 'F').toString().toUpperCase()}`;

  new Set(Object.values(TEAMS).flatMap((team) => team.players))
);


function getApiNick(displayName) {
  return NICK_MAP[displayName] || displayName;
}



function getApiNick(displayName) {
  return NICK_MAP[displayName] || displayName;
}


function normalizeDisplayNick(name) {
  const apiNick = getApiNick(name);
  return uniquePlayers.find((player) => getApiNick(player) === apiNick) || name;

}

function teamForPlayer(nick) {
  return Object.entries(TOURNAMENT_DATA.teams).find(([, team]) => team.players.includes(nick))?.[0] || null;
}


async function fetchProfile(displayName) {
  if (profileCache.has(displayName)) return profileCache.get(displayName);

  const apiNick = mapNick(displayName);


function rankTone(rank) {
  const key = (rank || "").toString().trim().toUpperCase();
  return `rank-${key || "f"}`;
}


async function fetchProfile(displayName) {
  if (profileCache.has(displayName)) return profileCache.get(displayName);

  const apiNick = getApiNick(displayName);

  const url = `/api?action=getProfile&nick=${encodeURIComponent(apiNick)}`;
  const fallback = {
    nick: displayName,
    apiNick,
    avatar: DEFAULT_AVATAR,
    rank: '—',
    points: 0,
    league: '—'

    rank: "—",
    points: 0,
    league: "—"

  };

  try {
    const res = await fetch(url);

    if (!res.ok) throw new Error(res.statusText || 'HTTP error');
    const data = await res.json();
    const profile = data?.profile || data || {};
    const league = (data?.league || profile.league || '').toString().trim() || '—';
    const points = Number(profile.points ?? data?.points ?? 0) || 0;
    const rank = profile.rank || rankLetterForPoints(points);

    if (!res.ok) throw new Error(res.statusText || "HTTP error");
    const data = await res.json();
    const profile = data?.profile || data || {};
    const league = (data?.league || profile.league || "").toString().trim() || "—";
    const points = Number(profile.points ?? data?.points ?? 0) || 0;
    const rank = profile.rank || rankFromPoints(points);

    const avatar = profile.avatarUrl || profile.avatar || profile.photo || DEFAULT_AVATAR;

    const normalizedProfile = { displayName, apiNick, avatar, rank, points, league };
    profileCache.set(displayName, normalizedProfile);
    return normalizedProfile;
  } catch (err) {
    const profile = { ...fallback, error: true };
    profileCache.set(displayName, profile);
    return profile;
  }
}


async function hydrateProfiles() {
  const profiles = await Promise.all(uniquePlayers.map((nick) => fetchProfile(nick)));
  profiles.forEach((profile) => {
    state.profiles.set(profile.displayName, profile);
  });

function teamForPlayer(nick) {
  return Object.entries(TEAMS).find(([, team]) => team.players.includes(nick))?.[0] || null;
}

function createTeamCard(teamKey, team) {
  const card = document.createElement("article");
  card.className = `team-card team--${teamKey}`;

  const header = document.createElement("header");
  const title = document.createElement("div");
  title.innerHTML = `<p class="eyebrow">${team.name}</p><h3>${teamKey.toUpperCase()}</h3>`;

  const chip = document.createElement("div");
  chip.className = "team-chip";
  chip.innerHTML = `<span class="team-dot"></span><span>${team.players.length} гравців</span>`;
  header.append(title, chip);

  const players = document.createElement("div");
  players.className = "player-list";

  team.players.forEach((nick) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "player-chip";
    btn.dataset.nick = nick;
    btn.dataset.team = teamKey;

    btn.innerHTML = `
      <span class="player-chip__avatar">
        <img alt="${nick}" src="${DEFAULT_AVATAR}" />
      </span>
      <span class="player-chip__info">
        <span class="nick">${nick}</span>
        <span class="meta league">Ліга: —</span>
      </span>
      <span class="rank-badge">…</span>
    `;


    btn.addEventListener("click", (event) => openPopover(nick, event.currentTarget));
    btn.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      openPopover(nick, event.currentTarget);

    btn.addEventListener("click", () => openProfile(nick));
    btn.addEventListener("auxclick", (event) => {
      if (event.button === 1) openProfile(nick, true);
    });
    btn.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      openModal(nick);

    });
    players.append(btn);
  });

  const accent = document.createElement("div");
  accent.className = "team-card__bar";
  card.append(header, players, accent);
  return card;

}

function normalizeDisplayNick(name) {
  const apiNick = mapNick(name);
  return uniquePlayers.find((player) => mapNick(player) === apiNick) || name;
}

function roundBadge(symbol) {
  if (symbol === '=') return '<span class="round-badge neutral" aria-label="Нічия">⬜</span>';
  const teamKey = TEAM_CODE[Number(symbol)] || null;

  const icon = teamKey === 'green' ? '🟩' : teamKey === 'blue' ? '🟦' : '🟥';
  return `<span class="round-badge team--${teamKey}" aria-label="Перемога">${icon}</span>`;

  if (symbol === "=") return `<span class="round-badge equal">=</span>`;
  return `<span class="round-badge team--${teamKey}">${symbol}</span>`;
}

function renderDmTable(summary) {
  const container = document.getElementById("dm-table");
  const rows = DM.map((game) => {
    const roundCounts = { green: 0, blue: 0, red: 0 };
    game.results.forEach((res) => {
      const key = TEAM_CODE[Number(res)];
      if (key) roundCounts[key] += 1;
    });
    const totals = Object.entries(roundCounts)
      .filter(([, count]) => count > 0)
      .map(([k, count]) => `<span class="team-chip team--${k}"><span class="team-dot"></span>${TEAMS[k].name}: ${count}</span>`)
      .join(" ");

    return `
      <tr>
        <td>${game.match}</td>
        <td>${game.results.map(roundBadge).join(" ")}</td>
        <td>
          <span class="mvp-pill"><strong>1</strong> ${normalizeDisplayNick(game.mvp.first)}</span>
          <span class="mvp-pill"><strong>2</strong> ${normalizeDisplayNick(game.mvp.second)}</span>
          <span class="mvp-pill"><strong>3</strong> ${normalizeDisplayNick(game.mvp.third)}</span>
        </td>
        <td>${totals || "—"}</td>
      </tr>
    `;
  }).join("");

  const totalsRow = `
    <tr class="tr-muted">
      <td colspan="4">
        <div class="inline-row">
          <span class="muted">Підсумок раундів:</span>
          ${Object.entries(summary.dmRounds)
            .map(([team, count]) => `<span class="team-chip team--${team}"><span class="team-dot"></span>${TEAMS[team].name}: ${count}</span>`)
            .join(" ")}
        </div>
      </td>
    </tr>`;

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Матч</th>
          <th>Раунди</th>
          <th>MVP</th>
          <th>Підрахунок перемог</th>
        </tr>
      </thead>
      <tbody>${rows}${totalsRow}</tbody>
    </table>
  `;
}

function renderKtTable(summary) {
  const container = document.getElementById("kt-table");
  const rows = KT.map((game) => {
    const roundsHtml = game.rounds.map((round, idx) => {
      const colorKey = round.winner.toLowerCase();
      return `
        <tr>
          ${idx === 0 ? `<td rowspan="${game.rounds.length}">${game.match}</td>` : ""}
          <td>${idx + 1}</td>
          <td>${round.time}</td>
          <td>${round.points}</td>
          <td><span class="team-chip team--${colorKey}"><span class="team-dot"></span>${round.winner}</span></td>
          ${idx === 0 ? `<td rowspan="${game.rounds.length}">${game.mvp.map((nick, i) => `<span class="mvp-pill"><strong>${i + 1}</strong> ${normalizeDisplayNick(nick)}</span>`).join(" ")}</td>` : ""}
        </tr>`;
    }).join("");
    return roundsHtml;
  }).join("");

  const totalsRow = `
    <tr class="tr-muted">
      <td colspan="6">
        <div class="inline-row">
          <span class="muted">Сума очок:</span>
          ${Object.entries(summary.ktPoints)
            .map(([team, pts]) => `<span class="team-chip team--${team}"><span class="team-dot"></span>${TEAMS[team].name}: ${pts}</span>`)
            .join(" ")}
        </div>
      </td>
    </tr>`;

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Матч</th>
          <th>Раунд</th>
          <th>Час</th>
          <th>Очки</th>
          <th>Переможець</th>
          <th>MVP</th>
        </tr>
      </thead>
      <tbody>${rows}${totalsRow}</tbody>
    </table>
  `;
}

function renderTdmBlock(summary) {
  const container = document.getElementById("tdm-block");
  const totals = summary.tdmScore;
  const maxScore = Math.max(...Object.values(totals));

  const charts = Object.entries(totals).map(([team, score]) => {
    const width = maxScore ? Math.round((score / maxScore) * 100) : 0;
    return `
      <div class="chart-row">
        <div class="chart-label">${TEAMS[team].name}</div>
        <div class="chart-bar"><span class="team--${team}" style="width:${width}%"></span></div>
        <div><strong>${score}</strong> очок</div>
      </div>
    `;
  }).join("");

  const tableRows = TDM.map((game) => {
    const entries = [
      ["Green", Number(game.green) || 0],
      ["Blue", Number(game.blue) || 0],
      ["Red", Number(game.red) || 0]
    ];
    const winner = entries.sort((a, b) => b[1] - a[1])[0][0];
    const colorKey = winner.toLowerCase();
    return `
      <tr>
        <td>${game.match}</td>
        <td>${game.green ?? "—"}</td>
        <td>${game.blue ?? "—"}</td>
        <td>${game.red ?? "—"}</td>
        <td><span class="team-chip team--${colorKey}"><span class="team-dot"></span>${winner}</span></td>
      </tr>
    `;
  }).join("");

  container.innerHTML = `
    <div class="progress-row">
      <div class="label">Графік очок</div>
      <div>${charts}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Матч</th>
          <th>Green</th>
          <th>Blue</th>
          <th>Red</th>
          <th>Переможець</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;

}

function buildStats() {
  const stats = {};
  uniquePlayers.forEach((nick) => {
    stats[nick] = {
      nick,
      team: teamForPlayer(nick),
      dmRounds: 0,
      dmMatchWins: 0,
      ktPoints: 0,
      ktRoundWins: 0,
      tdmScore: 0,
      tdmWins: 0,
      tdmMatches: 0,
      mvpScore: 0,
      mvpCount: 0,
      modes: new Set()
    };
  });

  TOURNAMENT_DATA.modes.dm.forEach((game) => {
    const roundCounts = { green: 0, blue: 0, red: 0 };
    game.results.forEach((res) => {
      const teamKey = TEAM_CODE[Number(res)];
      if (teamKey) {
        roundCounts[teamKey] += 1;
        TOURNAMENT_DATA.teams[teamKey].players.forEach((p) => {
          const st = stats[p];
          if (st) st.dmRounds += 1;
        });
      }
    });

    const sorted = Object.entries(roundCounts).sort((a, b) => b[1] - a[1]);
    const [winner, winCount] = sorted[0];
    if (winCount > 0 && winCount !== sorted[1][1]) {
      TOURNAMENT_DATA.teams[winner].players.forEach((p) => {
        const st = stats[p];
        if (st) st.dmMatchWins += 1;
      });
    }

    Object.values(stats).forEach((st) => {
      if (st.team && game.match.toLowerCase().includes(st.team)) st.modes.add('DM');
    });

    const mvpWeights = [game.mvp.first, game.mvp.second, game.mvp.third];
    mvpWeights.forEach((nick, idx) => {
      if (!nick) return;
      const displayNick = normalizeDisplayNick(nick);
      const st = stats[displayNick];
      if (st) {
        st.mvpCount += 1;
        st.mvpScore += 3 - idx;
      }
    });
  });

  TOURNAMENT_DATA.modes.kt.forEach((game) => {
    game.rounds.forEach((round) => {
      const teamKey = round.winner.toLowerCase();
      const players = TOURNAMENT_DATA.teams[teamKey]?.players;
      if (players) {
        players.forEach((p) => {
          const st = stats[p];
          if (st) {
            st.ktPoints += Number(round.points) || 0;
            st.ktRoundWins += 1;
            st.modes.add('KT');
          }
        });
      }
    });

    game.mvp.forEach((nick, idx) => {
      const displayNick = normalizeDisplayNick(nick);
      const st = stats[displayNick];
      if (st) {
        st.mvpCount += 1;
        st.mvpScore += 2 - idx * 0.25;
      }
    });
  });

  TOURNAMENT_DATA.modes.tdm.forEach((game) => {
    const scores = { green: game.green ?? 0, blue: game.blue ?? 0, red: game.red ?? 0 };
    const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
    Object.entries(scores).forEach(([teamKey, score]) => {
      const players = TOURNAMENT_DATA.teams[teamKey]?.players;
      if (!players) return;
      players.forEach((p) => {
        const st = stats[p];
        if (st) {
          st.tdmScore += Number(score) || 0;
          st.tdmMatches += 1;
          st.modes.add('TDM');
        }
      });
    });
    TOURNAMENT_DATA.teams[winner].players.forEach((p) => {
      const st = stats[p];
      if (st) st.tdmWins += 1;
    });
  });

  return stats;
}


function buildSummary() {
  const dmRounds = { green: 0, blue: 0, red: 0 };
  const ktPoints = { green: 0, blue: 0, red: 0 };
  const tdmScore = { green: 0, blue: 0, red: 0 };

  TOURNAMENT_DATA.modes.dm.forEach((game) => {
    game.results.forEach((res) => {
      const teamKey = TEAM_CODE[Number(res)];
      if (teamKey) dmRounds[teamKey] += 1;
    });
  });

  TOURNAMENT_DATA.modes.kt.forEach((game) => {
    game.rounds.forEach((round) => {
      const teamKey = round.winner.toLowerCase();
      if (teamKey in ktPoints) ktPoints[teamKey] += Number(round.points) || 0;
    });
  });

  TOURNAMENT_DATA.modes.tdm.forEach((game) => {
    tdmScore.green += Number(game.green) || 0;
    tdmScore.blue += Number(game.blue) || 0;
    tdmScore.red += Number(game.red) || 0;
  });

  return { dmRounds, ktPoints, tdmScore };
}

function updateHero(meta) {
  const title = document.getElementById('hero-title');
  const dateEl = document.getElementById('hero-date');
  const formatEl = document.getElementById('hero-format');
  const locationEl = document.getElementById('hero-location');
  const modeBadges = document.getElementById('mode-badges');

  if (title) title.textContent = meta.title;
  if (dateEl) dateEl.textContent = meta.date;
  if (formatEl) formatEl.textContent = meta.format;
  if (locationEl) locationEl.textContent = meta.location;
  if (modeBadges) {
    modeBadges.innerHTML = meta.modes
      .map((m) => `<span class="mode-pill">${m}</span>`)
      .join('');
  }

  const teamsCount = Object.keys(TOURNAMENT_DATA.teams).length;
  const playersCount = uniquePlayers.length;
  const matchesCount = TOURNAMENT_DATA.modes.dm.length + TOURNAMENT_DATA.modes.kt.length + TOURNAMENT_DATA.modes.tdm.length;

  const teamsCounter = document.getElementById('teams-count');
  const playersCounter = document.getElementById('players-count');
  const matchesCounter = document.getElementById('matches-count');

  if (teamsCounter) teamsCounter.textContent = teamsCount;
  if (playersCounter) playersCounter.textContent = playersCount;
  if (matchesCounter) matchesCounter.textContent = matchesCount;
}

function createTeamCard(teamKey, team) {
  const card = document.createElement('article');
  card.className = `team-card team--${teamKey}`;

  const header = document.createElement('header');
  const title = document.createElement('div');
  title.innerHTML = `<p class="eyebrow">${team.name}</p><h3>${teamKey.toUpperCase()}</h3>`;

  const chip = document.createElement('div');
  chip.className = 'team-chip';
  chip.innerHTML = `<span class="team-dot"></span><span>${team.players.length} гравців</span>`;
  header.append(title, chip);

  const players = document.createElement('div');
  players.className = 'player-list';

  team.players.forEach((nick) => {
    const profile = state.profiles.get(nick) || {};
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `player-chip ${rankTone(profile.rank)}`;
    btn.dataset.nick = nick;
    btn.dataset.team = teamKey;

    btn.innerHTML = `
      <span class="player-chip__avatar">
        <img alt="${nick}" src="${profile.avatar || DEFAULT_AVATAR}" />
      </span>
      <span class="player-chip__info">
        <span class="nick">${nick}</span>
        <span class="meta league">${profile.league || 'Ліга: —'}</span>
      </span>
      <span class="rank-badge">${profile.rank ? `${profile.rank}-rank` : '…'}</span>
    `;

    btn.addEventListener('click', (event) => openPopover(nick, event.currentTarget));
    btn.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openPopover(nick, event.currentTarget);
    });
    players.append(btn);
  });

  const accent = document.createElement('div');
  accent.className = 'team-card__bar';
  card.append(header, players, accent);
  return card;
}

function renderTeams() {
  const grid = document.getElementById('team-grid');
  grid.innerHTML = '';
  Object.entries(TOURNAMENT_DATA.teams).forEach(([key, team]) => grid.append(createTeamCard(key, team)));
}

function renderDmTable(summary) {
  const container = document.getElementById('dm-table');
  const rows = TOURNAMENT_DATA.modes.dm
    .map((game) => {
      const roundCounts = { green: 0, blue: 0, red: 0 };
      game.results.forEach((res) => {
        const key = TEAM_CODE[Number(res)];
        if (key) roundCounts[key] += 1;
      });
      const totals = Object.entries(roundCounts)
        .filter(([, count]) => count > 0)
        .map(([k, count]) => `<span class="team-chip team--${k}"><span class="team-dot"></span>${TOURNAMENT_DATA.teams[k].name}: ${count}</span>`)
        .join(' ');

      return `
        <tr>
          <td>${game.match}</td>
          <td class="round-seq">${game.results.map(roundBadge).join(' ')}</td>
          <td>
            <span class="mvp-pill"><strong>1</strong> ${normalizeDisplayNick(game.mvp.first)}</span>
            <span class="mvp-pill"><strong>2</strong> ${normalizeDisplayNick(game.mvp.second)}</span>
            <span class="mvp-pill"><strong>3</strong> ${normalizeDisplayNick(game.mvp.third)}</span>
          </td>
          <td>${totals || '—'}</td>
        </tr>
      `;
    })
    .join('');

  const totalsRow = `
    <tr class="tr-muted">
      <td colspan="4">
        <div class="inline-row">
          <span class="muted">Підсумок раундів:</span>
          ${Object.entries(summary.dmRounds)
            .map(
              ([team, count]) =>
                `<span class="team-chip team--${team}"><span class="team-dot"></span>${TOURNAMENT_DATA.teams[team].name}: ${count}</span>`
            )
            .join(' ')}
        </div>
      </td>
    </tr>`;

  container.innerHTML = `
    <div class="mode-toolbar"><button class="ghost-btn" data-toggle="dm">Згорнути / розгорнути</button></div>
    <div class="table-shell__body" data-mode="dm">
      <table>
        <thead>
          <tr>
            <th>Матч</th>
            <th>Раунди</th>
            <th>MVP</th>
            <th>Підрахунок перемог</th>
          </tr>
        </thead>
        <tbody>${rows}${totalsRow}</tbody>
      </table>
    </div>
  `;
}

function renderKtTable(summary) {
  const container = document.getElementById('kt-table');
  const rows = TOURNAMENT_DATA.modes.kt
    .map((game) => {
      const roundsHtml = game.rounds
        .map((round, idx) => {
          const colorKey = round.winner.toLowerCase();
          return `
            <tr>
              ${idx === 0 ? `<td rowspan="${game.rounds.length}">${game.match}</td>` : ''}
              <td>${idx + 1}</td>
              <td>${round.time}</td>
              <td>${round.points}</td>
              <td><span class="team-chip team--${colorKey}"><span class="team-dot"></span>${round.winner}</span></td>
              ${
                idx === 0
                  ? `<td rowspan="${game.rounds.length}">${game.mvp
                      .map((nick, i) => `<span class="mvp-pill"><strong>${i + 1}</strong> ${normalizeDisplayNick(nick)}</span>`)
                      .join(' ')}</td>`
                  : ''
              }
            </tr>`;
        })
        .join('');
      return roundsHtml;
    })
    .join('');

  const totalsRow = `
    <tr class="tr-muted">
      <td colspan="6">
        <div class="inline-row">
          <span class="muted">Сума очок:</span>
          ${Object.entries(summary.ktPoints)
            .map(
              ([team, pts]) =>
                `<span class="team-chip team--${team}"><span class="team-dot"></span>${TOURNAMENT_DATA.teams[team].name}: ${pts}</span>`
            )
            .join(' ')}
        </div>
      </td>
    </tr>`;

  container.innerHTML = `
    <div class="mode-toolbar"><button class="ghost-btn" data-toggle="kt">Згорнути / розгорнути</button></div>
    <div class="table-shell__body" data-mode="kt">
      <table>
        <thead>
          <tr>
            <th>Матч</th>
            <th>Раунд</th>
            <th>Час</th>
            <th>Очки</th>
            <th>Переможець</th>
            <th>MVP</th>
          </tr>
        </thead>
        <tbody>${rows}${totalsRow}</tbody>
      </table>
    </div>
  `;
}

function renderTdmBlock(summary) {
  const container = document.getElementById('tdm-block');
  const totals = summary.tdmScore;
  const maxScore = Math.max(...Object.values(totals));

  const charts = Object.entries(totals)
    .map(([team, score]) => {
      const width = maxScore ? Math.round((score / maxScore) * 100) : 0;
      return `
        <div class="chart-row">
          <div class="chart-label">${TOURNAMENT_DATA.teams[team].name}</div>
          <div class="chart-bar"><span class="team--${team}" style="width:${width}%"></span></div>
          <div class="chart-score">${score} pts</div>
        </div>
      `;
    })
    .join('');

  const tableRows = TOURNAMENT_DATA.modes.tdm
    .map((game) => {
      const entries = [
        ['Green', Number(game.green) || 0],
        ['Blue', Number(game.blue) || 0],
        ['Red', Number(game.red) || 0]
      ];
      const winner = entries.sort((a, b) => b[1] - a[1])[0][0];
      const colorKey = winner.toLowerCase();
      return `
        <tr>
          <td>${game.match}</td>
          <td>${game.green ?? '—'}</td>
          <td>${game.blue ?? '—'}</td>
          <td>${game.red ?? '—'}</td>
          <td><span class="team-chip team--${colorKey}"><span class="team-dot"></span>${winner}</span></td>
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="mode-toolbar"><button class="ghost-btn" data-toggle="tdm">Згорнути / розгорнути</button></div>
    <div class="table-shell__body" data-mode="tdm">
      <div class="progress-row">
        <div class="label">Графік очок</div>
        <div>${charts}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Матч</th>
            <th>Green</th>
            <th>Blue</th>
            <th>Red</th>
            <th>Переможець</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `;
}

function podiumClass(nick, leaderboard) {
  const pos = leaderboard.indexOf(nick);
  if (pos === 0) return 'podium-1';
  if (pos === 1) return 'podium-2';
  if (pos === 2) return 'podium-3';
  return '';
}

function renderPlayers(stats) {
  const grid = document.getElementById('player-grid');
  grid.innerHTML = '';

  const topMvp = Object.values(stats)
    .sort((a, b) => b.mvpScore - a.mvpScore || b.mvpCount - a.mvpCount)
    .slice(0, 3)
    .map((st) => st.nick);

  Object.values(stats)
    .sort((a, b) => b.mvpScore - a.mvpScore || b.tdmScore - a.tdmScore)
    .forEach((st) => {
      const profile = state.profiles.get(st.nick) || {};
      const card = document.createElement('article');
      const podium = podiumClass(st.nick, topMvp);
      card.className = `player-card ${podium}`.trim();
      card.dataset.nick = st.nick;
      card.dataset.team = st.team || '';

      card.innerHTML = `
        <div class="player-card__header">
          <div class="avatar-frame ${rankTone(profile.rank)}">
            <img src="${profile.avatar || DEFAULT_AVATAR}" alt="${st.nick}" />
          </div>
          <div>
            <p class="eyebrow">${profile.league || 'Ліга'}</p>
            <h3>${st.nick}</h3>
            <p class="muted">${TOURNAMENT_DATA.teams[st.team]?.name || ''}</p>
          </div>
          <div class="rank-chip">${profile.rank ? `${profile.rank}-rank` : '—'}</div>
        </div>
        <div class="player-card__stats">
          <div><span class="label">DM wins</span><strong>${st.dmMatchWins}</strong></div>
          <div><span class="label">KT points</span><strong>${st.ktPoints}</strong></div>
          <div><span class="label">TDM points</span><strong>${st.tdmScore}</strong></div>
          <div><span class="label">MVP</span><strong>${st.mvpCount}</strong></div>
        </div>
      `;

      card.addEventListener('click', (event) => openPopover(st.nick, event.currentTarget));
      grid.append(card);

function podiumClass(nick, leaderboard) {
  const pos = leaderboard.indexOf(nick);
  if (pos === 0) return "podium-1";
  if (pos === 1) return "podium-2";
  if (pos === 2) return "podium-3";
  return "";
}

function renderPlayers(stats) {
  const grid = document.getElementById("player-grid");
  grid.innerHTML = "";

  const topMvp = Object.values(stats)
    .sort((a, b) => b.mvpScore - a.mvpScore || b.mvpCount - a.mvpCount)
    .slice(0, 3)
    .map((st) => st.nick);

  Object.values(stats)
    .sort((a, b) => b.mvpScore - a.mvpScore || b.tdmScore - a.tdmScore)
    .forEach((st) => {
      const card = document.createElement("article");
      const podium = podiumClass(st.nick, topMvp);
      card.className = `player-card ${podium}`.trim();
      card.dataset.nick = st.nick;
      card.dataset.team = st.team || "";

      const apiNick = getApiNick(st.nick);
      const profileUrl = `profile.html?nick=${encodeURIComponent(apiNick)}`;

      card.innerHTML = `
        <div class="player-card__header">
          <div class="player-card__avatar"><img alt="${st.nick}" src="${DEFAULT_AVATAR}" /></div>
          <div>
            <div class="nick">${st.nick}</div>
            <div class="player-card__meta">
              <span>Команда: ${st.team ? TEAMS[st.team].name : "—"}</span>
              <span class="league">Ліга: —</span>
              <span>Режими: ${st.modes.size}</span>
            </div>
          </div>
          <div class="rank-badge">…</div>
        </div>
        <div class="progress-row">
          <div class="label">DM раунди: <strong>${st.dmRounds}</strong> · перемоги: <strong>${st.dmMatchWins}</strong></div>
          <div class="progress-bar"><span class="team--${st.team}" style="width:${Math.min(100, st.dmRounds * 12)}%"></span></div>
        </div>
        <div class="progress-row">
          <div class="label">Control Point: <strong>${st.ktPoints}</strong> балів</div>
          <div class="progress-bar"><span class="team--${st.team}" style="width:${Math.min(100, st.ktPoints * 10)}%"></span></div>
        </div>
        <div class="progress-row">
          <div class="label">TDM очки: <strong>${st.tdmScore}</strong> · перемоги: <strong>${st.tdmWins}/${st.tdmMatches}</strong></div>
          <div class="progress-bar"><span class="team--${st.team}" style="width:${Math.min(100, st.tdmScore * 8)}%"></span></div>
        </div>
        <div class="badge ${podium}">MVP: ${st.mvpCount}</div>
        <div class="card-actions">
          <a class="btn ghost" href="${profileUrl}">Профіль</a>

          <button type="button" class="btn" data-popover="${st.nick}">Статистика</button>
        </div>
      `;

      card.querySelector("[data-popover]").addEventListener("click", (event) => {
        event.stopPropagation();
        openPopover(st.nick, card);
      });

      card.addEventListener("click", (event) => openPopover(st.nick, event.currentTarget));
      card.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        openPopover(st.nick, event.currentTarget);

          <button type="button" class="btn" data-modal="${st.nick}">Деталі</button>
        </div>
      `;

      card.querySelector("[data-modal]").addEventListener("click", (event) => {
        event.stopPropagation();
        openModal(st.nick);
      });

      card.addEventListener("click", () => openProfile(st.nick));
      card.addEventListener("auxclick", (event) => {
        if (event.button === 1) openProfile(st.nick, true);

      });
      grid.append(card);
    });
}


function updateCounters() {
  document.getElementById("teams-count").textContent = Object.keys(TEAMS).length;
  document.getElementById("players-count").textContent = uniquePlayers.length;
  document.getElementById("matches-count").textContent = DM.length + KT.length + TDM.length;
}

function applyProfiles() {
  profileCache.forEach((profile, displayName) => {
    const teamKey = teamForPlayer(displayName);
    const colorClass = teamKey ? `team--${teamKey}` : "";

    document.querySelectorAll(`[data-nick="${displayName}"] .player-card__avatar img`).forEach((img) => {
      img.src = profile.avatar;
    });

    document.querySelectorAll(`[data-nick="${displayName}"] .player-chip__avatar`).forEach((wrap) => {
      wrap.innerHTML = `<img alt="${displayName}" src="${profile.avatar}" />`;
    });

    document.querySelectorAll(`[data-nick="${displayName}"] .rank-badge`).forEach((badge) => {

      badge.textContent = `${profile.rank}-rank${Number.isFinite(profile.points) ? " · " + profile.points : ""}`;
      badge.className = `rank-badge ${rankTone(profile.rank)} ${colorClass}`;

      badge.textContent = `${profile.rank}${Number.isFinite(profile.points) ? " · " + profile.points : ""}`;
      badge.classList.add(colorClass);


    });
}


function renderTopBlock(stats) {
  const topContainer = document.getElementById('players-section');
  const podium = Object.values(stats)
    .sort((a, b) => b.mvpScore - a.mvpScore || b.mvpCount - a.mvpCount)
    .slice(0, 3);

  const existing = topContainer.querySelector('.podium-grid');
  if (existing) existing.remove();

  const grid = document.createElement('div');
  grid.className = 'podium-grid';
  podium.forEach((st, idx) => {
    const profile = state.profiles.get(st.nick) || {};
    const tile = document.createElement('article');
    tile.className = `podium-card podium-${idx + 1} team--${st.team}`;
    tile.innerHTML = `
      <div class="podium-rank">${idx + 1}</div>
      <div class="podium-body">
        <div class="podium-name">${st.nick}</div>
        <div class="podium-meta">MVP: ${st.mvpCount} · TDM: ${st.tdmScore}</div>
        <div class="rank-chip">${profile.rank ? `${profile.rank}-rank` : '—'}</div>
      </div>
    `;
    tile.addEventListener('click', (event) => openPopover(st.nick, event.currentTarget));
    grid.append(tile);

    document.querySelectorAll(`[data-nick="${displayName}"] .league`).forEach((el) => {
      el.textContent = `Ліга: ${profile.league || "—"}`;
    });

  });

  topContainer.insertBefore(grid, topContainer.querySelector('.player-grid'));
}


function renderMvpTable(stats) {
  const container = document.getElementById('mvp-table');
  const leaderboard = Object.values(stats).sort((a, b) => b.mvpScore - a.mvpScore || b.mvpCount - a.mvpCount);
  const rows = leaderboard
    .map((st, idx) => {
      const profile = state.profiles.get(st.nick) || {};
      return `
        <tr>
          <td>${idx + 1}</td>
          <td><button class="link-btn" data-nick="${st.nick}">${st.nick}</button></td>
          <td>${profile.rank || '—'}</td>
          <td>${st.mvpCount}</td>
          <td>${st.dmMatchWins}</td>
          <td>${st.ktPoints}</td>
          <td>${st.tdmScore}</td>
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Місце</th>
          <th>Гравець</th>
          <th>Ранг</th>
          <th>MVP</th>
          <th>DM wins</th>
          <th>KT points</th>
          <th>TDM</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  container.querySelectorAll('button[data-nick]').forEach((btn) => {
    btn.addEventListener('click', (event) => openPopover(event.currentTarget.dataset.nick, event.currentTarget));
  });
}

function popoverStat(label, value) {
  const div = document.createElement('div');
  div.className = 'popover-stat';
  div.innerHTML = `<span class="label">${label}</span><strong>${value}</strong>`;
  return div;
}

function openPopover(nick, anchor) {
  const profile = state.profiles.get(nick) || {};
  const apiNick = profile.apiNick || mapNick(nick);
  const st = state.stats[nick];
  const teamKey = st?.team;
  const pop = document.getElementById('player-popover');
  const card = pop.querySelector('.player-popover__card');
  const avatar = document.getElementById('popover-avatar');
  const nickEl = document.getElementById('popover-nick');
  const leagueEl = document.getElementById('popover-league');
  const teamEl = document.getElementById('popover-team');
  const rankEl = document.getElementById('popover-rank');
  const statsBox = document.getElementById('popover-stats');

  avatar.src = profile.avatar || DEFAULT_AVATAR;
  avatar.alt = nick;
  nickEl.textContent = nick;
  leagueEl.textContent = profile.league || 'Ліга';
  teamEl.innerHTML = teamKey
    ? `<span class="team-chip team--${teamKey}"><span class="team-dot"></span>${TOURNAMENT_DATA.teams[teamKey].name}</span>`
    : '';
  rankEl.textContent = profile.rank ? `${profile.rank}-rank` : '—';
  rankEl.className = `rank-chip ${rankTone(profile.rank)}`;

  statsBox.innerHTML = '';
  if (st) {
    statsBox.append(
      popoverStat('DM wins', st.dmMatchWins),
      popoverStat('KT points', st.ktPoints),
      popoverStat('TDM points', st.tdmScore),
      popoverStat('MVP', st.mvpCount)
    );
  }

  const profileLink = document.getElementById('popover-profile');
  profileLink.href = `profile.html?nick=${encodeURIComponent(apiNick)}`;

  card.className = `player-popover__card ${teamKey ? `team--${teamKey}` : ''}`;
  pop.hidden = false;

  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const spacing = 8;
    const preferredLeft = rect.left + rect.width / 2 - cardRect.width / 2;
    const maxLeft = window.innerWidth - cardRect.width - 12;
    const left = Math.max(12, Math.min(preferredLeft, maxLeft));
    let top = rect.bottom + spacing;
    if (top + cardRect.height > window.innerHeight) {
      top = rect.top - cardRect.height - spacing;
    }
    if (window.innerWidth <= 640) {
      card.style.left = `12px`;
      card.style.right = `12px`;
      card.style.top = `${Math.max(12, rect.bottom + spacing)}px`;
    } else {
      card.style.left = `${left}px`;
      card.style.right = 'auto';
      card.style.top = `${Math.max(12, top)}px`;
    }
  }
}

function closePopover() {
  const pop = document.getElementById('player-popover');
  pop.hidden = true;
}

function attachPopoverHandlers() {
  document.addEventListener('click', (event) => {
    const pop = document.getElementById('player-popover');
    const card = pop.querySelector('.player-popover__card');
    if (pop.hidden) return;
    if (card.contains(event.target)) return;
    closePopover();
  });

async function hydrateProfiles() {
  for (const nick of uniquePlayers) {
    await fetchProfile(nick);
  }
  applyProfiles();
}

function popoverStat(label, value) {
  const div = document.createElement("div");
  div.className = "modal-stat";
  div.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
  return div;
}

function closePopover() {
  const pop = document.getElementById("player-popover");
  pop.hidden = true;
}

async function openPopover(nick, anchor) {
  const pop = document.getElementById("player-popover");
  const card = pop.querySelector(".player-popover__card");
  const st = playerStats[nick];
  const profile = await fetchProfile(nick);
  const teamKey = st?.team;

  const apiNick = getApiNick(nick);

  document.getElementById("popover-nick").textContent = nick;
  document.getElementById("popover-team").textContent = teamKey ? TEAMS[teamKey].name : "Гість";
  document.getElementById("popover-league").textContent = profile.league ? `Ліга: ${profile.league}` : "Ліга: —";
  document.getElementById("popover-avatar").src = profile.avatar;

  const rankLabel = `${profile.rank}-rank`;
  const rankEl = document.getElementById("popover-rank");
  rankEl.textContent = `${rankLabel} · ${profile.points}`;
  rankEl.className = `rank-chip ${rankTone(profile.rank)}`;

  const colorClass = teamKey ? `team--${teamKey}` : "";
  const apiNick = getApiNick(nick);

  document.getElementById("modal-nick").textContent = nick;
  document.getElementById("modal-team").textContent = teamKey ? TEAMS[teamKey].name : "Гість";
  document.getElementById("modal-league").textContent = profile.league ? `Ліга: ${profile.league}` : "Ліга: —";
  document.getElementById("modal-avatar").src = profile.avatar;
  document.getElementById("modal-rank").textContent = `${profile.rank} · ${profile.points} очок`;
  document.getElementById("modal-rank").className = `rank-chip ${colorClass}`;


  const statsBox = document.getElementById("popover-stats");
  statsBox.innerHTML = "";
  if (st) {
    statsBox.append(

      popoverStat("DM wins", st.dmMatchWins),
      popoverStat("KT points", st.ktPoints),
      popoverStat("TDM points", st.tdmScore),
      popoverStat("MVP", st.mvpCount)
    );
  }

  const profileLink = document.getElementById("popover-profile");
  profileLink.href = `profile.html?nick=${encodeURIComponent(apiNick)}`;

  card.className = `player-popover__card ${teamKey ? `team--${teamKey}` : ""}`;
  pop.hidden = false;

  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const spacing = 8;
    const preferredLeft = rect.left + rect.width / 2 - cardRect.width / 2;
    const maxLeft = window.innerWidth - cardRect.width - 12;
    const left = Math.max(12, Math.min(preferredLeft, maxLeft));
    let top = rect.bottom + spacing;
    if (top + cardRect.height > window.innerHeight) {
      top = rect.top - cardRect.height - spacing;
    }
    if (window.innerWidth <= 640) {
      card.style.left = `12px`;
      card.style.right = `12px`;
      card.style.top = `${Math.max(12, rect.bottom + spacing)}px`;
    } else {
      card.style.left = `${left}px`;
      card.style.right = "auto";
      card.style.top = `${Math.max(12, top)}px`;
    }
  }
}

function attachPopoverHandlers() {
  document.addEventListener("click", (event) => {
    const pop = document.getElementById("player-popover");
    const card = pop.querySelector(".player-popover__card");
    if (pop.hidden) return;
    if (card.contains(event.target)) return;
    closePopover();
  });

  window.addEventListener("resize", closePopover);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePopover();

      modalStat("DM", `Раунди: ${st.dmRounds}, перемоги: ${st.dmMatchWins}`),
      modalStat("Control Point", `Очки: ${st.ktPoints}, раунди: ${st.ktRoundWins}`),
      modalStat("TDM", `Очки: ${st.tdmScore}, перемоги: ${st.tdmWins}/${st.tdmMatches}`),
      modalStat("MVP", `Нагороди: ${st.mvpCount}`),
      modalStat("Профіль", `<a href="profile.html?nick=${encodeURIComponent(apiNick)}" class="link">Відкрити сторінку</a>`)
    );
  }

  modal.querySelector(".player-modal__card").className = `player-modal__card ${colorClass}`;
  modal.hidden = false;
}

function attachModalHandlers() {
  const modal = document.getElementById("player-modal");
  modal.addEventListener("click", (event) => {
    if (event.target.dataset.close === "true") {
      modal.hidden = true;
    }

  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") modal.hidden = true;
  });
}

function openProfile(nick, newTab = false) {
  const apiNick = getApiNick(nick);
  const url = `profile.html?nick=${encodeURIComponent(apiNick)}`;
  if (newTab) {
    window.open(url, "_blank");
  } else {
    window.location.href = url;
  }
}

function buildSummary() {
  const dmRounds = { green: 0, blue: 0, red: 0 };
  const ktPoints = { green: 0, blue: 0, red: 0 };
  const tdmScore = { green: 0, blue: 0, red: 0 };


  window.addEventListener('resize', closePopover);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePopover();
  });
}

function attachToggles() {
  document.querySelectorAll('.mode-toolbar [data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.toggle;
      const body = document.querySelector(`.table-shell__body[data-mode="${mode}"]`);
      if (body) body.classList.toggle('collapsed');
    });
  });
}

function renderAll() {
  updateHero(TOURNAMENT_DATA.meta);
  state.stats = buildStats();
  state.summary = buildSummary();
  renderTeams();
  renderDmTable(state.summary);
  renderKtTable(state.summary);
  renderTdmBlock(state.summary);
  renderTopBlock(state.stats);
  renderPlayers(state.stats);
  renderMvpTable(state.stats);
  attachToggles();
}

function markReady() {
  document.body.classList.remove('loading-state');
}


document.addEventListener('DOMContentLoaded', async () => {
  document.body.classList.add('loading-state');

function renderTopBlock(stats) {
  const topContainer = document.getElementById("players-section");
  const podium = Object.values(stats)
    .sort((a, b) => b.mvpScore - a.mvpScore || b.mvpCount - a.mvpCount)
    .slice(0, 3);

  const existing = topContainer.querySelector(".podium-grid");
  if (existing) existing.remove();

  const grid = document.createElement("div");
  grid.className = "podium-grid";
  podium.forEach((st, idx) => {
    const apiNick = getApiNick(st.nick);
    const tile = document.createElement("article");
    tile.className = `podium-card podium-${idx + 1} team--${st.team}`;
    tile.innerHTML = `
      <div class="podium-rank">${idx + 1}</div>
      <div class="podium-body">
        <div class="podium-name">${st.nick}</div>
        <div class="podium-meta">MVP: ${st.mvpCount} · Очки TDM: ${st.tdmScore}</div>
        <a class="btn ghost" href="profile.html?nick=${encodeURIComponent(apiNick)}">Профіль</a>
      </div>
    `;
    grid.append(tile);
  });

  topContainer.insertBefore(grid, topContainer.querySelector(".player-grid"));
}

document.addEventListener("DOMContentLoaded", async () => {
  playerStats = buildStats();
  renderTeams();

  const stats = buildStats();

  const summary = buildSummary();
  renderDmTable(summary);
  renderKtTable(summary);
  renderTdmBlock(summary);

  renderTopBlock(playerStats);
  renderPlayers(playerStats);

  renderTopBlock(stats);
  renderPlayers(stats);

  updateCounters();

  attachPopoverHandlers();
  await hydrateProfiles();
  renderAll();
  markReady();
});
