const TEAMS = {
  green: {
    name: "Green Team",
    color: "#33ff77",
    players: ["Morti", "Voron", "Оксанка", "hAppser"]
  },
  blue: {
    name: "Blue Team",
    color: "#4faaff",
    players: ["Laston", "Leres", "Кицюня", "Cocosik"]
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
      { winner: "Blue",  time: "3:56", points: 2 }
    ],
    mvp: ["Morti", "Laston", "Leres"]
  },
  {
    match: "Blue vs Red",
    rounds: [
      { winner: "Blue", time: "3:52", points: 2 },
      { winner: "Red",  time: "3:13", points: 3 }
    ],
    mvp: ["Остап", "Laston", "Temostar"]
  },
  {
    match: "Red vs Green",
    rounds: [
      { winner: "Red", time: "3:06", points: 3 },
      { winner: "Red", time: "3:09", points: 3 }
    ],
    mvp: ["Morti", "Остап", "Temostar"]
  }
];

const TDM = [
  { match: "Green vs Blue", green: 1, blue: 4 },
  { match: "Blue vs Red",   blue: 4, red: 2 },
  { match: "Green vs Red",  green: 3, red: 5 }
];

const NICK_FIX = {
  "Юра": "Morti",
  "Сегедин": "Morti",
  "Морті": "Morti",
  "Ворон": "Voron",
  "Даня": "hAppser",
  "Happser": "hAppser",
  "Вова": "Leres",
  "Ластон": "Laston",
  "Лерес": "Leres",
  "Кіцюня": "Кицюня",
  "Валя": "Cocosik",
  "Кокосік": "Cocosik",
  "Сем": "Sem",
  "Джасті": "Justy",
  "Темофій": "Temostar"
};

const TEAM_CODE = { 1: "green", 2: "blue", 3: "red" };
const DEFAULT_AVATAR = "assets/default_avatars/av0.png";
const profileCache = new Map();

const uniquePlayers = Object.values(TEAMS).flatMap((team) => team.players);
const uniquePlayerSet = Array.from(new Set(uniquePlayers));

function normalizeNick(nick) {
  return NICK_FIX[nick] || nick;
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

async function fetchProfile(nick) {
  if (profileCache.has(nick)) return profileCache.get(nick);

  const normalized = normalizeNick(nick);
  const url = `/api?action=getProfile&nick=${encodeURIComponent(normalized)}`;
  const fallback = { nick, displayNick: normalized, avatar: DEFAULT_AVATAR, rank: "—", points: 0, league: "—" };

  let data;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText || "HTTP error");
    data = await res.json();
  } catch (err) {
    const profile = { ...fallback, error: true };
    profileCache.set(nick, profile);
    return profile;
  }

  const profile = data?.profile || data || {};
  const league = (data?.league || profile.league || "").toString().trim() || "—";
  const points = Number(profile.points ?? data?.points ?? 0) || 0;
  const rank = profile.rank || rankFromPoints(points);
  const avatar = profile.avatarUrl || profile.avatar || profile.photo || DEFAULT_AVATAR;

  const normalizedProfile = { nick, displayNick: normalized, avatar, rank, points, league, status: data?.status || "OK" };
  profileCache.set(nick, normalizedProfile);
  return normalizedProfile;
}

function teamForPlayer(nick) {
  return Object.entries(TEAMS).find(([, team]) => team.players.includes(nick))?.[0] || null;
}

function createTeamCard(teamKey, team) {
  const card = document.createElement("article");
  card.className = "team-card";
  card.style.borderColor = `${team.color}55`;
  card.style.boxShadow = `0 0 0 1px ${team.color}22, 0 0 24px ${team.color}22`;

  const header = document.createElement("header");
  const title = document.createElement("div");
  title.innerHTML = `<p class="eyebrow">${team.name}</p><h3>${teamKey.toUpperCase()}</h3>`;
  const chip = document.createElement("div");
  chip.className = "team-chip";
  chip.innerHTML = `<span class="team-dot" style="background:${team.color}"></span><span>${team.players.length} гравців</span>`;
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
      <span class="player-chip__avatar" style="border-color:${team.color}44">
        <img alt="${nick}" src="${DEFAULT_AVATAR}" />
      </span>
      <span class="player-chip__info">
        <span class="nick">${nick}</span>
        <span class="meta league">Ліга: —</span>
      </span>
      <span class="rank-badge">...</span>
    `;

    btn.addEventListener("click", () => openModal(nick));
    players.append(btn);
  });

  card.append(header, players);
  card.appendChild(Object.assign(document.createElement("div"), { className: "team-card__bar" }));
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
  const color = teamKey ? TEAMS[teamKey].color : "#8f9bbd";
  return `<span class="round-badge" style="background:${color}22;border-color:${color}55">${symbol}</span>`;
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
      .map(([k, count]) => `<span class="team-chip"><span class="team-dot" style="background:${TEAMS[k].color}"></span>${TEAMS[k].name}: ${count}</span>`) 
      .join(" ");

    return `
      <tr>
        <td>${game.match}</td>
        <td>${game.results.map(roundBadge).join(" ")}</td>
        <td>
          <span class="mvp-pill"><strong>1</strong> ${game.mvp.first}</span>
          <span class="mvp-pill"><strong>2</strong> ${game.mvp.second}</span>
          <span class="mvp-pill"><strong>3</strong> ${game.mvp.third}</span>
        </td>
        <td>${totals || "—"}</td>
      </tr>
    `;
  }).join("");

  const totalsRow = `
    <tr class="tr-muted">
      <td colspan="4">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <span class="muted">Підсумок раундів:</span>
          ${Object.entries(summary.dmRounds).map(([team, count]) => `<span class="team-chip"><span class="team-dot" style="background:${TEAMS[team].color}"></span>${TEAMS[team].name}: ${count}</span>`).join(" ")}
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
    const roundsHtml = game.rounds.map((r, idx) => {
      const colorKey = r.winner.toLowerCase();
      const color = TEAMS[colorKey]?.color || "#8f9bbd";
      return `
        <tr>
          ${idx === 0 ? `<td rowspan="${game.rounds.length}">${game.match}</td>` : ""}
          <td>${idx + 1}</td>
          <td>${r.time}</td>
          <td>${r.points}</td>
          <td><span class="team-chip"><span class="team-dot" style="background:${color}"></span>${r.winner}</span></td>
          ${idx === 0 ? `<td rowspan="${game.rounds.length}">${game.mvp.map((nick, i) => `<span class="mvp-pill"><strong>${i + 1}</strong> ${nick}</span>`).join(" ")}</td>` : ""}
        </tr>`;
    }).join("");
    return roundsHtml;
  }).join("");

  const totalsRow = `
    <tr class="tr-muted">
      <td colspan="6">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <span class="muted">Сума очок:</span>
          ${Object.entries(summary.ktPoints).map(([team, pts]) => `<span class="team-chip"><span class="team-dot" style="background:${TEAMS[team].color}"></span>${TEAMS[team].name}: ${pts}</span>`).join(" ")}
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
    const color = TEAMS[team].color;
    const width = maxScore ? Math.round((score / maxScore) * 100) : 0;
    return `
      <div class="chart-row">
        <div class="chart-label">${TEAMS[team].name}</div>
        <div class="chart-bar"><span style="width:${width}%;background:${color}66"></span></div>
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
    const color = TEAMS[winner.toLowerCase()]?.color || "#8f9bbd";
    return `
      <tr>
        <td>${game.match}</td>
        <td>${game.green ?? "—"}</td>
        <td>${game.blue ?? "—"}</td>
        <td>${game.red ?? "—"}</td>
        <td><span class="team-chip"><span class="team-dot" style="background:${color}"></span>${winner}</span></td>
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
  uniquePlayerSet.forEach((nick) => {
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
      const st = stats[nick];
      if (st) st.mvpScore += (3 - idx);
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
      const st = stats[nick];
      if (st) st.mvpScore += (idx === 0 ? 2 : 1);
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

function renderPlayers(stats) {
  const grid = document.getElementById("player-grid");
  grid.innerHTML = "";

  const topMvp = Object.values(stats)
    .sort((a, b) => b.mvpScore - a.mvpScore)
    .slice(0, 3)
    .map((st) => st.nick);

  Object.values(stats).forEach((st) => {
    const card = document.createElement("article");
    card.className = "player-card";
    card.dataset.nick = st.nick;
    card.dataset.team = st.team || "";
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
        <div class="rank-badge">...</div>
      </div>
      <div class="progress-row">
        <div class="label">DM раунди: <strong>${st.dmRounds}</strong></div>
        <div class="progress-bar"><span style="width:${Math.min(100, st.dmRounds * 12)}%;background:${TEAMS[st.team]?.color || "#8f9bbd"}55"></span></div>
      </div>
      <div class="progress-row">
        <div class="label">Control Point очки: <strong>${st.ktPoints}</strong></div>
        <div class="progress-bar"><span style="width:${Math.min(100, st.ktPoints * 10)}%;background:${TEAMS[st.team]?.color || "#8f9bbd"}55"></span></div>
      </div>
      <div class="progress-row">
        <div class="label">TDM очки: <strong>${st.tdmScore}</strong></div>
        <div class="progress-bar"><span style="width:${Math.min(100, st.tdmScore * 8)}%;background:${TEAMS[st.team]?.color || "#8f9bbd"}55"></span></div>
      </div>
      <div class="badge" style="margin-top:8px;${topMvp.includes(st.nick) ? "border-color:var(--yellow);color:var(--yellow);" : ""}">
        MVP: ${st.mvpScore}
      </div>
    `;
    card.addEventListener("click", () => openModal(st.nick));
    grid.append(card);
  });
}

function updateCounters() {
  const teamsCount = Object.keys(TEAMS).length;
  const playersCount = uniquePlayerSet.length;
  const matchesCount = DM.length + KT.length + TDM.length;
  document.getElementById("teams-count").textContent = teamsCount;
  document.getElementById("players-count").textContent = playersCount;
  document.getElementById("matches-count").textContent = matchesCount;
}

function applyProfiles() {
  profileCache.forEach((profile, nick) => {
    const teamKey = teamForPlayer(nick);
    const color = TEAMS[teamKey]?.color || "#fff";

    document.querySelectorAll(`[data-nick="${nick}"] .player-card__avatar img`).forEach((img) => {
      img.src = profile.avatar;
    });

    document.querySelectorAll(`[data-nick="${nick}"] .player-chip__avatar`).forEach((wrap) => {
      wrap.innerHTML = `<img alt="${nick}" src="${profile.avatar}" />`;
    });

    document.querySelectorAll(`[data-nick="${nick}"] .rank-badge`).forEach((badge) => {
      badge.textContent = `${profile.rank}${Number.isFinite(profile.points) ? " · " + profile.points : ""}`;
      badge.style.borderColor = `${color}33`;
    });

    document.querySelectorAll(`[data-nick="${nick}"] .league`).forEach((el) => {
      el.textContent = `Ліга: ${profile.league || "—"}`;
    });
  });
}

async function hydrateProfiles() {
  for (const nick of uniquePlayerSet) {
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
  const color = teamKey ? TEAMS[teamKey].color : "#8f9bbd";

  document.getElementById("modal-nick").textContent = nick;
  document.getElementById("modal-team").textContent = teamKey ? TEAMS[teamKey].name : "Гість";
  document.getElementById("modal-league").textContent = profile.league ? `Ліга: ${profile.league}` : "Ліга: —";
  document.getElementById("modal-avatar").src = profile.avatar;
  document.getElementById("modal-rank").textContent = `${profile.rank} · ${profile.points} очок`;
  document.getElementById("modal-rank").style.borderColor = `${color}55`;

  const statsBox = document.getElementById("modal-stats");
  statsBox.innerHTML = "";
  if (st) {
    statsBox.append(
      modalStat("DM", `Раунди: ${st.dmRounds}, перемоги: ${st.dmMatchWins}`),
      modalStat("Control Point", `Очки: ${st.ktPoints}, раунди: ${st.ktRoundWins}`),
      modalStat("TDM", `Очки: ${st.tdmScore}, перемоги: ${st.tdmWins}/${st.tdmMatches}`),
      modalStat("MVP", `Нагороди: ${st.mvpScore}`)
    );
  }

  modal.querySelector(".player-modal__card").style.borderColor = `${color}55`;
  modal.hidden = false;
}

function attachModalHandlers() {
  const modal = document.getElementById("player-modal");
  modal.addEventListener("click", (e) => {
    if (e.target.dataset.close === "true") {
      modal.hidden = true;
    }
  });
}

function buildSummary(stats) {
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

document.addEventListener("DOMContentLoaded", async () => {
  renderTeams();
  const stats = buildStats();
  const summary = buildSummary(stats);
  renderDmTable(summary);
  renderKtTable(summary);
  renderTdmBlock(summary);
  renderPlayers(stats);
  updateCounters();
  attachModalHandlers();
  await hydrateProfiles();
});
