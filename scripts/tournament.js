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

const uniquePlayers = Array.from(
  new Set(Object.values(TEAMS).flatMap((team) => team.players))
);

function getApiNick(displayName) {
  return NICK_MAP[displayName] || displayName;
}

function normalizeDisplayNick(name) {
  const apiNick = getApiNick(name);
  return uniquePlayers.find((player) => getApiNick(player) === apiNick) || name;
}

function rankFromPoints(points) {
  const p = Number(points) || 0;
  if (p >= 1200) return "S";
  if (p >= 1000) return "A";
  if (p >= 800) return "B";
  if (p >= 600) return "C";
  if (p >= 400) return "D";
  if (p >= 200) return "E";
  return "F";
}

async function fetchProfile(displayName) {
  if (profileCache.has(displayName)) return profileCache.get(displayName);

  const apiNick = getApiNick(displayName);
  const url = `/api?action=getProfile&nick=${encodeURIComponent(apiNick)}`;
  const fallback = {
    nick: displayName,
    apiNick,
    avatar: DEFAULT_AVATAR,
    rank: "—",
    points: 0,
    league: "—"
  };

  try {
    const res = await fetch(url);
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

function renderTeams() {
  const grid = document.getElementById("team-grid");
  grid.innerHTML = "";
  Object.entries(TEAMS).forEach(([key, team]) => grid.append(createTeamCard(key, team)));
}

function roundBadge(symbol) {
  const teamKey = TEAM_CODE[Number(symbol)] || null;
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

  DM.forEach((game) => {
    const roundCounts = { green: 0, blue: 0, red: 0 };
    game.results.forEach((res) => {
      const teamKey = TEAM_CODE[Number(res)];
      if (teamKey) {
        roundCounts[teamKey] += 1;
        TEAMS[teamKey].players.forEach((p) => {
          const st = stats[p];
          if (st) st.dmRounds += 1;
        });
      }
    });

    const sorted = Object.entries(roundCounts).sort((a, b) => b[1] - a[1]);
    const [winner, winCount] = sorted[0];
    if (winCount > 0 && winCount !== sorted[1][1]) {
      TEAMS[winner].players.forEach((p) => {
        const st = stats[p];
        if (st) st.dmMatchWins += 1;
      });
    }

    Object.values(stats).forEach((st) => {
      if (st.team && game.match.toLowerCase().includes(st.team)) st.modes.add("DM");
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

  KT.forEach((game) => {
    game.rounds.forEach((round) => {
      const teamKey = round.winner.toLowerCase();
      const players = TEAMS[teamKey]?.players;
      if (players) {
        players.forEach((p) => {
          const st = stats[p];
          if (st) {
            st.ktPoints += Number(round.points) || 0;
            st.ktRoundWins += 1;
            st.modes.add("KT");
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

  TDM.forEach((game) => {
    const scores = { green: game.green ?? 0, blue: game.blue ?? 0, red: game.red ?? 0 };
    const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
    Object.entries(scores).forEach(([teamKey, score]) => {
      const players = TEAMS[teamKey]?.players;
      if (!players) return;
      players.forEach((p) => {
        const st = stats[p];
        if (st) {
          st.tdmScore += Number(score) || 0;
          st.tdmMatches += 1;
          st.modes.add("TDM");
        }
      });
    });
    TEAMS[winner].players.forEach((p) => {
      const st = stats[p];
      if (st) st.tdmWins += 1;
    });
  });

  return stats;
}

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
      badge.textContent = `${profile.rank}${Number.isFinite(profile.points) ? " · " + profile.points : ""}`;
      badge.classList.add(colorClass);
    });

    document.querySelectorAll(`[data-nick="${displayName}"] .league`).forEach((el) => {
      el.textContent = `Ліга: ${profile.league || "—"}`;
    });
  });
}

async function hydrateProfiles() {
  for (const nick of uniquePlayers) {
    await fetchProfile(nick);
  }
  applyProfiles();
}

function modalStat(label, value) {
  const div = document.createElement("div");
  div.className = "modal-stat";
  div.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
  return div;
}

async function openModal(nick) {
  const modal = document.getElementById("player-modal");
  const stats = buildStats();
  const st = stats[nick];
  const profile = await fetchProfile(nick);
  const teamKey = st?.team;
  const colorClass = teamKey ? `team--${teamKey}` : "";
  const apiNick = getApiNick(nick);

  document.getElementById("modal-nick").textContent = nick;
  document.getElementById("modal-team").textContent = teamKey ? TEAMS[teamKey].name : "Гість";
  document.getElementById("modal-league").textContent = profile.league ? `Ліга: ${profile.league}` : "Ліга: —";
  document.getElementById("modal-avatar").src = profile.avatar;
  document.getElementById("modal-rank").textContent = `${profile.rank} · ${profile.points} очок`;
  document.getElementById("modal-rank").className = `rank-chip ${colorClass}`;

  const statsBox = document.getElementById("modal-stats");
  statsBox.innerHTML = "";
  if (st) {
    statsBox.append(
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

  DM.forEach((game) => {
    game.results.forEach((res) => {
      const teamKey = TEAM_CODE[Number(res)];
      if (teamKey) dmRounds[teamKey] += 1;
    });
  });

  KT.forEach((game) => {
    game.rounds.forEach((round) => {
      const teamKey = round.winner.toLowerCase();
      if (teamKey in ktPoints) ktPoints[teamKey] += Number(round.points) || 0;
    });
  });

  TDM.forEach((game) => {
    tdmScore.green += Number(game.green) || 0;
    tdmScore.blue += Number(game.blue) || 0;
    tdmScore.red += Number(game.red) || 0;
  });

  return { dmRounds, ktPoints, tdmScore };
}

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
  renderTeams();
  const stats = buildStats();
  const summary = buildSummary();
  renderDmTable(summary);
  renderKtTable(summary);
  renderTdmBlock(summary);
  renderTopBlock(stats);
  renderPlayers(stats);
  updateCounters();
  attachModalHandlers();
  await hydrateProfiles();
});
