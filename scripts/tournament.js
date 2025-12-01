import { loadPlayers, normalizeLeague } from './api.js';
import { rankLetterForPoints } from './rankUtils.js';

const PLAYER_MAP = {
  "Юра": "Morti",
  "Морті": "Morti",
  "Morti": "Morti",
  "Морті": "Morti",
  "Сегедин": "Morti",
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
  "Temostar": "Temostar",
};

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

const DEFAULT_AVATAR = 'assets/default_avatars/av0.png';

function mapNick(name) {
  return PLAYER_MAP[name] || name;
}

function buildPlayerIndex(players) {
  const index = new Map();
  players.forEach((p) => index.set(p.nick.toLowerCase(), p));
  return index;
}

function getProfile(displayNick, playerIndex) {
  const apiNick = mapNick(displayNick);
  const leaguePlayer = playerIndex.get(apiNick.toLowerCase());
  const points = Number(leaguePlayer?.pts ?? 0);
  return {
    displayNick,
    apiNick,
    rank: leaguePlayer?.rank || rankLetterForPoints(points) || '—',
    points,
    avatar: leaguePlayer?.avatar || DEFAULT_AVATAR,
    league: normalizeLeague(TOURNAMENT.league),
  };
}

function iconForResult(code) {
  if (code === '=') return '<span class="result-icon badge-draw">⚪ ≡</span>';
  const key = code === '1' || code === 1 ? 'green' : code === '2' || code === 2 ? 'blue' : 'red';
  const badge = key === 'green' ? '🟢 ⬆' : key === 'blue' ? '🔵 ⬆' : '🔴 ⬆';
  return `<span class="result-icon badge-win">${badge}</span>`;
}

function computeMatchOutcome(teamA, teamB, winnerKey, teamStats, timeline, mode) {
  if (winnerKey === 'draw') {
    teamStats[teamA].draws += 1;
    teamStats[teamB].draws += 1;
    teamStats[teamA].points += 1;
    teamStats[teamB].points += 1;
  } else {
    const loser = winnerKey === teamA ? teamB : teamA;
    teamStats[winnerKey].wins += 1;
    teamStats[winnerKey].points += 3;
    teamStats[loser].losses += 1;
  }
  timeline.push({ mode, teamA, teamB, winner: winnerKey });
}

function buildTeamStats(playerIndex) {
  const teamStats = {};
  const timeline = [];

  Object.entries(TOURNAMENT.teams).forEach(([key, team]) => {
    const avg =
      team.players.reduce((acc, nick) => acc + getProfile(nick, playerIndex).points, 0) / team.players.length || 0;
    teamStats[key] = { key, name: team.name, color: team.color, wins: 0, draws: 0, losses: 0, points: 0, avg }; 
  });

  TOURNAMENT.modes.dm.forEach((game) => {
    const counts = { [game.teamA]: 0, [game.teamB]: 0 };
    game.results.forEach((res) => {
      if (res === '=') return;
      const teamKey = res === '1' ? 'green' : res === '2' ? 'blue' : 'red';
      if (counts[teamKey] != null) counts[teamKey] += 1;
    });
    const [winner, winCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const draw = Object.values(counts).every((c) => c === winCount);
    computeMatchOutcome(game.teamA, game.teamB, draw ? 'draw' : winner, teamStats, timeline, 'DM');
  });

  TOURNAMENT.modes.kt.forEach((game) => {
    const totals = { [game.teamA]: 0, [game.teamB]: 0 };
    game.rounds.forEach((round) => {
      if (totals[round.winner] != null) totals[round.winner] += Number(round.points) || 0;
    });
    const [winner, winPts] = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
    const draw = Object.values(totals).every((c) => c === winPts);
    computeMatchOutcome(game.teamA, game.teamB, draw ? 'draw' : winner, teamStats, timeline, 'KT');
  });

  TOURNAMENT.modes.tdm.forEach((game) => {
    const scoreA = game.scores[game.teamA] || 0;
    const scoreB = game.scores[game.teamB] || 0;
    let winner = 'draw';
    if (scoreA > scoreB) winner = game.teamA;
    else if (scoreB > scoreA) winner = game.teamB;
    computeMatchOutcome(game.teamA, game.teamB, winner, teamStats, timeline, 'TDM');
  });

  return { teamStats, timeline };
}

function buildPlayerStats(playerIndex) {
  const stats = {};
  Object.values(TOURNAMENT.teams).forEach((team) => {
    team.players.forEach((nick) => {
      const profile = getProfile(nick, playerIndex);
      stats[nick] = {
        ...profile,
        team: team.name,
        teamKey: Object.entries(TOURNAMENT.teams).find(([, t]) => t.players.includes(nick))?.[0] || 'green',
        dmRounds: 0,
        ktPoints: 0,
        tdmScore: 0,
        mvps: 0,
        modes: new Set(),
      };
    });
  });

  TOURNAMENT.modes.dm.forEach((game) => {
    game.results.forEach((res) => {
      const key = res === '1' ? 'green' : res === '2' ? 'blue' : 'red';
      if (res !== '=' && TOURNAMENT.teams[key]) {
        TOURNAMENT.teams[key].players.forEach((nick) => {
          stats[nick].dmRounds += 1;
          stats[nick].modes.add('DM');
        });
      }
    });
    game.mvp.forEach((nick) => {
      const display = Object.keys(stats).find((name) => mapNick(name) === mapNick(nick)) || nick;
      if (stats[display]) stats[display].mvps += 1;
    });
  });

  TOURNAMENT.modes.kt.forEach((game) => {
    game.rounds.forEach((round) => {
      const players = TOURNAMENT.teams[round.winner]?.players || [];
      players.forEach((nick) => {
        stats[nick].ktPoints += Number(round.points) || 0;
        stats[nick].modes.add('KT');
      });
    });
    game.mvp.forEach((nick) => {
      const display = Object.keys(stats).find((name) => mapNick(name) === mapNick(nick)) || nick;
      if (stats[display]) stats[display].mvps += 1;
    });
  });

  TOURNAMENT.modes.tdm.forEach((game) => {
    const scoreA = Number(game.scores[game.teamA] || 0);
    const scoreB = Number(game.scores[game.teamB] || 0);
    TOURNAMENT.teams[game.teamA].players.forEach((nick) => {
      stats[nick].tdmScore += scoreA;
      stats[nick].modes.add('TDM');
    });
    TOURNAMENT.teams[game.teamB].players.forEach((nick) => {
      stats[nick].tdmScore += scoreB;
      stats[nick].modes.add('TDM');
    });
  });

  return Object.values(stats).sort((a, b) => b.mvps - a.mvps || b.points - a.points);
}

function renderHero() {
  document.getElementById('tournament-title').textContent = TOURNAMENT.meta.title;
  document.getElementById('tournament-date').textContent = TOURNAMENT.meta.date;
  document.getElementById('tournament-format').textContent = TOURNAMENT.meta.format;
  document.getElementById('tournament-map').textContent = TOURNAMENT.meta.map;
  const modes = document.getElementById('mode-badges');
  modes.innerHTML = TOURNAMENT.meta.modes
    .map((mode) => `<span class="pill">${mode}</span>`)
    .join('');
}

function renderInfoGrid(teamStats) {
  const grid = document.getElementById('info-grid');
  const teams = Object.keys(TOURNAMENT.teams).length;
  const players = Object.values(TOURNAMENT.teams).reduce((acc, t) => acc + t.players.length, 0);
  const matches = TOURNAMENT.modes.dm.length + TOURNAMENT.modes.kt.length + TOURNAMENT.modes.tdm.length;
  const cards = [
    { label: 'Команди', value: teams },
    { label: 'Учасники', value: players },
    { label: 'Матчі', value: matches },
    { label: 'Ліга', value: normalizeLeague(TOURNAMENT.league) },
    { label: 'Середній рейтинг', value: `${Math.round(teamStats.reduce((a, t) => a + t.avg, 0) / teamStats.length)}` },
  ];
  grid.innerHTML = cards
    .map((c) => `<div class="info-card"><span class="label">${c.label}</span><strong>${c.value}</strong></div>`)
    .join('');
}

function renderTeams(playerIndex) {
  const grid = document.getElementById('team-grid');
  grid.innerHTML = '';
  Object.entries(TOURNAMENT.teams).forEach(([key, team]) => {
    const card = document.createElement('article');
    card.className = `bal__card team-card ${key}`;
    card.style.borderLeftColor = team.color;

    const header = document.createElement('div');
    header.className = 'bal__row';
    header.innerHTML = `<h3>${team.name}</h3><span class="team-chip">${team.players.length} гравців</span>`;
    const list = document.createElement('div');
    list.className = 'player-list';

    team.players.forEach((nick) => {
      const profile = getProfile(nick, playerIndex);
      const row = document.createElement('a');
      row.href = '#';
      row.dataset.nick = nick;
      row.className = 'player-row player-link';
      row.innerHTML = `
        <img src="${profile.avatar}" alt="${nick}" />
        <div class="meta">
          <span class="nick">${nick}</span>
          <p class="muted">${profile.league.toUpperCase()}</p>
        </div>
        <span class="rank-pill">${profile.rank}</span>
      `;
      row.addEventListener('click', (e) => {
        e.preventDefault();
        openPopover(nick, profile, playerIndex);
      });
      list.appendChild(row);
    });

    card.append(header, list);
    grid.append(card);
  });
}

function renderStandings(teamStats) {
  const table = document.getElementById('standings-table');
  const rows = teamStats
    .sort((a, b) => b.points - a.points || b.avg - a.avg)
    .map((team, index) => `
      <tr>
        <td>${index + 1}</td>
        <td><span class="team-chip">${TOURNAMENT.teams[team.key].name}</span></td>
        <td>${team.wins}</td>
        <td>${team.draws}</td>
        <td>${team.losses}</td>
        <td>${team.points}</td>
        <td>${Math.round(team.avg)}</td>
      </tr>
    `)
    .join('');
  table.innerHTML = `
    <thead>
      <tr><th>#</th><th>Команда</th><th>W</th><th>D</th><th>L</th><th>Очки</th><th>AVG рейтинг</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  `;
}

function renderModes(playerIndex) {
  const grid = document.getElementById('modes-grid');
  const dmTable = TOURNAMENT.modes.dm
    .map((game) => {
      const rounds = game.results.map((r) => iconForResult(r)).join(' ');
      const mvp = game.mvp.map((nick, i) => `<span class="team-chip">MVP ${i + 1}: ${nick}</span>`).join(' ');
      return `
        <tr>
          <td>${TOURNAMENT.teams[game.teamA].name} vs ${TOURNAMENT.teams[game.teamB].name}</td>
          <td>${rounds}</td>
          <td>${mvp}</td>
        </tr>
      `;
    })
    .join('');

  const ktTable = TOURNAMENT.modes.kt
    .map((game) => {
      const body = game.rounds
        .map((round, idx) => `
          <tr>
            ${idx === 0 ? `<td rowspan="${game.rounds.length}">${TOURNAMENT.teams[game.teamA].name} vs ${TOURNAMENT.teams[game.teamB].name}</td>` : ''}
            <td>${idx + 1}</td>
            <td>${round.time}</td>
            <td>${round.points}</td>
            <td><span class="team-chip">${TOURNAMENT.teams[round.winner].name}</span></td>
            ${idx === 0 ? `<td rowspan="${game.rounds.length}">${game.mvp.map((nick, i) => `MVP ${i + 1}: ${nick}`).join('<br>')}</td>` : ''}
          </tr>
        `)
        .join('');
      return body;
    })
    .join('');

  const tdmTable = TOURNAMENT.modes.tdm
    .map((game) => `
      <tr>
        <td>${TOURNAMENT.teams[game.teamA].name} vs ${TOURNAMENT.teams[game.teamB].name}</td>
        <td>${game.scores[game.teamA] ?? 0} — ${game.scores[game.teamB] ?? 0}</td>
        <td>${game.scores[game.teamA] === game.scores[game.teamB] ? '<span class="badge-draw">⚪ ≡</span>' : game.scores[game.teamA] > game.scores[game.teamB] ? '<span class="badge-win">🟢 ⬆</span>' : '<span class="badge-loss">🔴 ⬇</span>'}</td>
      </tr>
    `)
    .join('');

  grid.innerHTML = `
    <article class="bal__card mode-card">
      <h3><span class="pill">DM</span> Deathmatch</h3>
      <div class="table-responsive">
        <table class="table">
          <thead><tr><th>Матч</th><th>Раунди</th><th>MVP</th></tr></thead>
          <tbody>${dmTable}</tbody>
        </table>
      </div>
    </article>
    <article class="bal__card mode-card">
      <h3><span class="pill">KT</span> Control Point</h3>
      <div class="table-responsive">
        <table class="table">
          <thead><tr><th>Матч</th><th>Раунд</th><th>Час</th><th>Очки</th><th>Переможець</th><th>MVP</th></tr></thead>
          <tbody>${ktTable}</tbody>
        </table>
      </div>
    </article>
    <article class="bal__card mode-card">
      <h3><span class="pill">TDM</span> Team Deathmatch</h3>
      <div class="table-responsive">
        <table class="table">
          <thead><tr><th>Матч</th><th>Рахунок</th><th>Результат</th></tr></thead>
          <tbody>${tdmTable}</tbody>
        </table>
      </div>
    </article>
  `;
}

function renderPlayers(players, playerIndex) {
  const table = document.getElementById('players-table');
  const rows = players
    .map((p, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><a href="#" class="player-link" data-nick="${p.displayNick}">${p.displayNick}</a></td>
        <td>${p.rank}</td>
        <td>${p.mvps}</td>
        <td>${p.dmRounds}</td>
        <td>${p.ktPoints}</td>
        <td>${p.tdmScore}</td>
      </tr>
    `)
    .join('');
  table.innerHTML = `
    <thead><tr><th>#</th><th>Гравець</th><th>Ранг</th><th>MVP</th><th>DM раунди</th><th>KT очки</th><th>TDM</th></tr></thead>
    <tbody>${rows}</tbody>
  `;
  table.querySelectorAll('.player-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const nick = link.dataset.nick;
      const profile = getProfile(nick, playerIndex);
      openPopover(nick, profile, playerIndex);
    });
  });
}

function renderTimeline(timeline) {
  const container = document.getElementById('match-list');
  container.innerHTML = timeline
    .map((item, idx) => {
      const a = TOURNAMENT.teams[item.teamA].name;
      const b = TOURNAMENT.teams[item.teamB].name;
      const result = item.winner === 'draw'
        ? '<span class="result-icon badge-draw">⚪ ≡ Нічия</span>'
        : `<span class="result-icon badge-win">${item.winner === item.teamA ? '🟢 ⬆' : '🔴 ⬇'} ${TOURNAMENT.teams[item.winner].name}</span>`;
      return `
        <article class="bal__card match-card">
          <p class="muted">Матч ${idx + 1} · ${item.mode}</p>
          <h4>${a} vs ${b}</h4>
          <p class="result-icon">${result}</p>
        </article>
      `;
    })
    .join('');
}

function openPopover(nick, profile, playerIndex) {
  const pop = document.getElementById('player-popover');
  document.getElementById('popover-avatar').src = profile.avatar;
  document.getElementById('popover-nick').textContent = nick;
  document.getElementById('popover-league').textContent = profile.league.toUpperCase();
  const teamKey = Object.entries(TOURNAMENT.teams).find(([, t]) => t.players.includes(nick))?.[0];
  document.getElementById('popover-team').textContent = teamKey ? TOURNAMENT.teams[teamKey].name : '';
  document.getElementById('popover-rank').textContent = profile.rank;

  const stats = buildPlayerStats(playerIndex).find((p) => p.displayNick === nick);
  const grid = document.getElementById('popover-stats');
  grid.innerHTML = '';
  const statItems = [
    { label: 'MVP', value: stats?.mvps ?? 0 },
    { label: 'DM раунди', value: stats?.dmRounds ?? 0 },
    { label: 'KT очки', value: stats?.ktPoints ?? 0 },
    { label: 'TDM', value: stats?.tdmScore ?? 0 },
  ];
  statItems.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'info-card';
    div.innerHTML = `<span class="label">${item.label}</span><strong>${item.value}</strong>`;
    grid.append(div);
  });

  const apiNick = mapNick(nick);
  const profileLink = document.getElementById('popover-profile');
  profileLink.href = `profile.html?nick=${encodeURIComponent(apiNick)}`;

  pop.classList.add('active');
}

function attachPopoverControls() {
  const pop = document.getElementById('player-popover');
  document.getElementById('popover-close').addEventListener('click', () => pop.classList.remove('active'));
  pop.addEventListener('click', (e) => {
    if (e.target === pop) pop.classList.remove('active');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') pop.classList.remove('active');
  });
}

async function initPage() {
  renderHero();
  const players = await loadPlayers(TOURNAMENT.league);
  const playerIndex = buildPlayerIndex(players);
  const { teamStats, timeline } = buildTeamStats(playerIndex);
  const teamStatsArr = Object.values(teamStats);

  renderInfoGrid(teamStatsArr);
  renderTeams(playerIndex);
  renderStandings(teamStatsArr);
  renderModes(playerIndex);
  renderPlayers(buildPlayerStats(playerIndex), playerIndex);
  renderTimeline(timeline);
  attachPopoverControls();
}

document.addEventListener('DOMContentLoaded', initPage);
