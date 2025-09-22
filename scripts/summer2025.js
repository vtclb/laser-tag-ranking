'use strict';

const topPlayers = [
  {
    rank: 1,
    nickname: "Laston",
    realName: "Laston",
    team: "Sunday League",
    totalPoints: 1180,
    averagePoints: Math.round(1180/136),
    games: 136,
    wins: 81,
    winRate: 0.5956,
    bestStreak: 7,
    lossStreak: 5,
    MVP: 45,
    rankTier: "S",
    role: "Гравець",
    // опціональні поля, щоб нічого не ламалось
    accuracy: null, tagsPerGame: null, assistsPerGame: null, clutchPlays: null, disarms: null,
    highlights: [], story: "", recentScores: [], recentAccuracy: [],
    teammateTop: [], opponentTop: [], winWith: [], loseWith: [],
    mostLostTo: { name: "—", count: 0 }, dangerous: { name: "—", meetings: 0, wr: "—" }
  },
  {
    rank: 2,
    nickname: "Leres",
    realName: "Leres",
    team: "Sunday League",
    totalPoints: 1099,
    averagePoints: Math.round(1099/136),
    games: 136,
    wins: 85,
    winRate: 0.6250,
    bestStreak: 7,
    lossStreak: 4,
    MVP: 17,
    rankTier: "S", role: "Гравець",
    accuracy: null, tagsPerGame: null, assistsPerGame: null, clutchPlays: null, disarms: null,
    highlights: [], story: "", recentScores: [], recentAccuracy: [],
    teammateTop: [], opponentTop: [], winWith: [], loseWith: [],
    mostLostTo: { name: "—", count: 0 }, dangerous: { name: "—", meetings: 0, wr: "—" }
  },
  {
    rank: 3,
    nickname: "Zavodchanyn",
    realName: "Zavodchanyn",
    team: "Sunday League",
    totalPoints: 995,
    averagePoints: Math.round(995/137),
    games: 137,
    wins: 73,
    winRate: 0.5328,
    bestStreak: 7,
    lossStreak: 6,
    MVP: 31,
    rankTier: "S", role: "Гравець",
    accuracy: null, tagsPerGame: null, assistsPerGame: null, clutchPlays: null, disarms: null,
    highlights: [], story: "", recentScores: [], recentAccuracy: [],
    teammateTop: [], opponentTop: [], winWith: [], loseWith: [],
    mostLostTo: { name: "—", count: 0 }, dangerous: { name: "—", meetings: 0, wr: "—" }
  },
  {
    rank: 4,
    nickname: "Justy",
    realName: "Justy",
    team: "Sunday League",
    totalPoints: 965,
    averagePoints: Math.round(965/151),
    games: 151,
    wins: 78,
    winRate: 0.5166,
    bestStreak: 6,
    lossStreak: 6,
    MVP: 27,
    rankTier: "A", role: "Гравець",
    accuracy: null, tagsPerGame: null, assistsPerGame: null, clutchPlays: null, disarms: null,
    highlights: [], story: "", recentScores: [], recentAccuracy: [],
    teammateTop: [], opponentTop: [], winWith: [], loseWith: [],
    mostLostTo: { name: "—", count: 0 }, dangerous: { name: "—", meetings: 0, wr: "—" }
  },
  {
    rank: 5,
    nickname: "Slavon",
    realName: "Slavon",
    team: "Sunday League",
    totalPoints: 955,
    averagePoints: Math.round(955/167),
    games: 167,
    wins: 85,
    winRate: 0.5090,
    bestStreak: 5,
    lossStreak: 4,
    MVP: 17,
    rankTier: "A", role: "Гравець",
    accuracy: null, tagsPerGame: null, assistsPerGame: null, clutchPlays: null, disarms: null,
    highlights: [], story: "", recentScores: [], recentAccuracy: [],
    teammateTop: [], opponentTop: [], winWith: [], loseWith: [],
    mostLostTo: { name: "—", count: 0 }, dangerous: { name: "—", meetings: 0, wr: "—" }
  },
  {
    rank: 6,
    nickname: "Kumar",
    realName: "Kumar",
    team: "Sunday League",
    totalPoints: 920,
    averagePoints: Math.round(920/185),
    games: 185,
    wins: 91,
    winRate: 0.4919,
    bestStreak: 5,
    lossStreak: 7,
    MVP: 12,
    rankTier: "A", role: "Гравець",
    accuracy: null, tagsPerGame: null, assistsPerGame: null, clutchPlays: null, disarms: null,
    highlights: [], story: "", recentScores: [], recentAccuracy: [],
    teammateTop: [], opponentTop: [], winWith: [], loseWith: [],
    mostLostTo: { name: "—", count: 0 }, dangerous: { name: "—", meetings: 0, wr: "—" }
  },
  {
    rank: 7,
    nickname: "Кицюня",
    realName: "Кицюня",
    team: "Sunday League",
    totalPoints: 895,
    averagePoints: Math.round(895/124),
    games: 124,
    wins: 59,
    winRate: 0.4758,
    bestStreak: 7,
    lossStreak: 7,
    MVP: 8,
    rankTier: "A", role: "Гравець",
    accuracy: null, tagsPerGame: null, assistsPerGame: null, clutchPlays: null, disarms: null,
    highlights: [], story: "", recentScores: [], recentAccuracy: [],
    teammateTop: [], opponentTop: [], winWith: [], loseWith: [],
    mostLostTo: { name: "—", count: 0 }, dangerous: { name: "—", meetings: 0, wr: "—" }
  },
  {
    rank: 8,
    nickname: "RuBisCo",
    realName: "RuBisCo",
    team: "Sunday League",
    totalPoints: 851,
    averagePoints: Math.round(851/71),
    games: 71,
    wins: 40,
    winRate: 0.5634,
    bestStreak: 8,
    lossStreak: 6,
    MVP: 18,
    rankTier: "B", role: "Гравець",
    accuracy: null, tagsPerGame: null, assistsPerGame: null, clutchPlays: null, disarms: null,
    highlights: [], story: "", recentScores: [], recentAccuracy: [],
    teammateTop: [], opponentTop: [], winWith: [], loseWith: [],
    mostLostTo: { name: "—", count: 0 }, dangerous: { name: "—", meetings: 0, wr: "—" }
  },
  {
    rank: 9,
    nickname: "Оксанка",
    realName: "Оксанка",
    team: "Sunday League",
    totalPoints: 850,
    averagePoints: Math.round(850/197),
    games: 197,
    wins: 74,
    winRate: 0.3756,
    bestStreak: 5,
    lossStreak: 9,
    MVP: 7,
    rankTier: "B", role: "Гравець",
    accuracy: null, tagsPerGame: null, assistsPerGame: null, clutchPlays: null, disarms: null,
    highlights: [], story: "", recentScores: [], recentAccuracy: [],
    teammateTop: [], opponentTop: [], winWith: [], loseWith: [],
    mostLostTo: { name: "—", count: 0 }, dangerous: { name: "—", meetings: 0, wr: "—" }
  },
  {
    rank: 10,
    nickname: "Voron",
    realName: "Voron",
    team: "Sunday League",
    totalPoints: 830,
    averagePoints: Math.round(830/118),
    games: 118,
    wins: 63,
    winRate: 0.5339,
    bestStreak: 7,
    lossStreak: 4,
    MVP: 16,
    rankTier: "B", role: "Гравець",
    accuracy: null, tagsPerGame: null, assistsPerGame: null, clutchPlays: null, disarms: null,
    highlights: [], story: "", recentScores: [], recentAccuracy: [],
    teammateTop: [], opponentTop: [], winWith: [], loseWith: [],
    mostLostTo: { name: "—", count: 0 }, dangerous: { name: "—", meetings: 0, wr: "—" }
  }
];

const numberFormatter = new Intl.NumberFormat('uk-UA');
const percentFormatter0 = new Intl.NumberFormat('uk-UA', {
  style: 'percent',
  maximumFractionDigits: 0
});
const percentFormatter1 = new Intl.NumberFormat('uk-UA', {
  style: 'percent',
  maximumFractionDigits: 1
});
const decimalFormatter = new Intl.NumberFormat('uk-UA', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

const metricsGrid = document.getElementById('metrics-grid');
const podiumGrid = document.getElementById('podium-grid');
const leaderboardBody = document.getElementById('leaderboard-body');
const tickerEl = document.getElementById('season-ticker');
const searchInput = document.getElementById('player-search');
const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
const modal = document.getElementById('player-modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const closeButton = modal?.querySelector('[data-close]');

let currentSort = 'rank';
let currentDirection = 'asc';

function formatPercent(value, formatter = percentFormatter0) {
  return formatter.format(value);
}

function calculateMetrics() {
  const totalGames = topPlayers.reduce((sum, player) => sum + player.games, 0);
  const totalPoints = topPlayers.reduce((sum, player) => sum + player.totalPoints, 0);
  const averageWinRate = topPlayers.reduce((sum, player) => sum + player.winRate, 0) / topPlayers.length;
  const averageAccuracy = topPlayers.reduce((sum, player) => sum + player.accuracy, 0) / topPlayers.length;
  const longestStreakPlayer = topPlayers.reduce((best, player) =>
    player.bestStreak > best.bestStreak ? player : best
  );
  const mostAccurate = topPlayers.reduce((best, player) =>
    player.accuracy > best.accuracy ? player : best
  );
  const strongestWinRate = topPlayers.reduce((best, player) =>
    player.winRate > best.winRate ? player : best
  );
  const uniqueTeams = new Set(topPlayers.map((player) => player.team)).size;
  const podiumPoints = topPlayers.slice(0, 3).reduce((sum, player) => sum + player.totalPoints, 0);

  return {
    totalGames,
    totalPoints,
    averageWinRate,
    averageAccuracy,
    longestStreakPlayer,
    mostAccurate,
    strongestWinRate,
    uniqueTeams,
    podiumPoints
  };
}

function renderMetrics() {
  const data = calculateMetrics();
  const cards = [
    {
      label: 'Матчів зіграно',
      value: numberFormatter.format(data.totalGames),
      footnote: '12 турів + фінал та шоу-матч',
      key: 'games'
    },
    {
      label: 'Унікальних гравців',
      value: numberFormatter.format(topPlayers.length),
      footnote: `Команди: ${data.uniqueTeams}`,
      key: 'players'
    },
    {
      label: 'Сумарні очки',
      value: numberFormatter.format(data.totalPoints),
      footnote: `Подіум тримає ${numberFormatter.format(data.podiumPoints)} очок`,
      key: 'points'
    },
    {
      label: 'Середній win rate',
      value: formatPercent(data.averageWinRate, percentFormatter1),
      footnote: `Найвищий у ${data.strongestWinRate.nickname}: ${formatPercent(data.strongestWinRate.winRate, percentFormatter1)}`,
      key: 'winrate'
    },
    {
      label: 'Середня точність',
      value: formatPercent(data.averageAccuracy, percentFormatter1),
      footnote: `Найточніша — ${data.mostAccurate.nickname}`,
      key: 'accuracy'
    },
    {
      label: 'Найдовша серія',
      value: `${numberFormatter.format(data.longestStreakPlayer.bestStreak)} перемог`,
      footnote: `${data.longestStreakPlayer.nickname} з ${data.longestStreakPlayer.team}`,
      key: 'streak'
    }
  ];

  metricsGrid.innerHTML = '';
  cards.forEach((card) => {
    const article = document.createElement('article');
    article.className = 'metric-card';
    article.dataset.metric = card.key;
    article.innerHTML = `
      <span class="metric-label">${card.label}</span>
      <span class="metric-value">${card.value}</span>
      <span class="metric-footnote">${card.footnote}</span>
    `;
    metricsGrid.append(article);
  });
}

function renderPodium() {
  podiumGrid.innerHTML = '';
  topPlayers.slice(0, 3).forEach((player, index) => {
    const card = document.createElement('article');
    card.className = 'podium-card';
    card.dataset.rank = `#${index + 1}`;
    card.innerHTML = `
      <h3>${player.nickname}</h3>
      <ul>
        <li>${player.team}</li>
        <li>${numberFormatter.format(player.totalPoints)} очок</li>
        <li>Win rate ${formatPercent(player.winRate)}</li>
        <li>Стрік ${player.bestStreak}</li>
      </ul>
    `;
    podiumGrid.append(card);
  });
}

function renderSparkline(values, label) {
  const width = 320;
  const height = 120;
  const paddingX = 14;
  const paddingY = 18;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  const points = values
    .map((value, index) => {
      const x =
        paddingX + (index / Math.max(values.length - 1, 1)) * (width - paddingX * 2);
      const normalized = (value - min) / range;
      const y = height - paddingY - normalized * (height - paddingY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const fillPoints = `${paddingX},${height - paddingY} ${points} ${
    width - paddingX
  },${height - paddingY}`;

  const description = values
    .map((value, index) => `Раунд ${index + 1}: ${value}`)
    .join(', ');

  return `
    <svg class="sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="Динаміка очок ${label}">
      <title>Очки ${label}</title>
      <desc>${description}</desc>
      <polyline points="${fillPoints}" fill="rgba(255, 102, 196, 0.15)" stroke="none"></polyline>
      <polyline points="${points}" fill="none" stroke="#ff66c4" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"></polyline>
      <line x1="${paddingX}" y1="${height - paddingY}" x2="${width - paddingX}" y2="${height - paddingY}" stroke="rgba(255, 255, 255, 0.2)" stroke-dasharray="6 6"></line>
      <circle cx="${points.split(' ').slice(-1)[0].split(',')[0]}" cy="${
    points.split(' ').slice(-1)[0].split(',')[1]
  }" r="5" fill="#ffd700" stroke="#05070e" stroke-width="2"></circle>
    </svg>
  `;
}

function renderModal(player) {
  if (!modal) {
    return;
  }

  modalTitle.textContent = `${player.nickname} · ${player.team}`;
  const averageRecent = player.recentScores.reduce((sum, score) => sum + score, 0) /
    player.recentScores.length;
  const lastAccuracy = player.recentAccuracy[player.recentAccuracy.length - 1];
  const accuracyTrend =
    lastAccuracy - player.recentAccuracy[0] >= 0 ? 'зростає' : 'спадає';

  modalBody.innerHTML = `
    <section>
      <h3>Основні показники</h3>
      <div class="detail-grid">
        <div>
          <strong>Матчів</strong>
          ${numberFormatter.format(player.games)}
        </div>
        <div>
          <strong>Перемог</strong>
          ${numberFormatter.format(player.wins)} (${formatPercent(player.winRate, percentFormatter1)})
        </div>
        <div>
          <strong>Очок за сезон</strong>
          ${numberFormatter.format(player.totalPoints)}
        </div>
        <div>
          <strong>Сер. очки</strong>
          ${numberFormatter.format(player.averagePoints)}
        </div>
        <div>
          <strong>Точність</strong>
          ${formatPercent(player.accuracy, percentFormatter1)}
        </div>
        <div>
          <strong>Стрік</strong>
          ${player.bestStreak} поспіль
        </div>
        <div>
          <strong>Tags/гра</strong>
          ${decimalFormatter.format(player.tagsPerGame)}
        </div>
        <div>
          <strong>Асисти/гра</strong>
          ${decimalFormatter.format(player.assistsPerGame)}
        </div>
        <div>
          <strong>Clutch</strong>
          ${numberFormatter.format(player.clutchPlays)} сейви
        </div>
        <div>
          <strong>Обеззброєнь</strong>
          ${numberFormatter.format(player.disarms)}
        </div>
        <div>
          <strong>Роль</strong>
          ${player.role}
        </div>
        <div>
          <strong>Улюблена арена</strong>
          ${player.favoriteArena}
        </div>
      </div>
    </section>
    <section>
      <h3>Останні матчі</h3>
      ${renderSparkline(player.recentScores, player.nickname)}
      <p>Середній темп — ${decimalFormatter.format(averageRecent)} очок, точність ${formatPercent(
    lastAccuracy,
    percentFormatter1
  )} (${accuracyTrend}).</p>
      <p>Останні показники точності: ${player.recentAccuracy
        .map((value) => formatPercent(value, percentFormatter1))
        .join(' · ')}.</p>
    </section>
    <section>
      <h3>Фішки гравця</h3>
      <ul class="detail-list">
        ${player.highlights.map((item) => `<li>${item}</li>`).join('')}
      </ul>
      <p>${player.story}</p>
      <p>Набір: ${player.loadout}</p>
    </section>
  `;

  if (typeof modal.showModal === 'function') {
    modal.showModal();
  } else {
    modal.setAttribute('open', 'true');
  }
}

function closeModal() {
  if (!modal) {
    return;
  }
  if (typeof modal.close === 'function') {
    modal.close();
  } else {
    modal.removeAttribute('open');
  }
}

function renderLeaderboard() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const sorted = [...topPlayers].sort((a, b) => {
    const direction = currentDirection === 'asc' ? 1 : -1;
    if (currentSort === 'rank') {
      return direction * (a.rank - b.rank);
    }
    const valueA = a[currentSort];
    const valueB = b[currentSort];
    if (valueA === valueB) {
      return a.rank - b.rank;
    }
    return direction * (valueA > valueB ? 1 : -1);
  });

  const filtered = sorted.filter((player) => {
    if (!searchTerm) {
      return true;
    }
    const haystack = [
      player.nickname,
      player.realName,
      player.team,
      player.role,
      player.favoriteArena
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(searchTerm);
  });

  leaderboardBody.innerHTML = '';

  if (filtered.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `<td colspan="9">Немає гравців за цим запитом</td>`;
    leaderboardBody.append(emptyRow);
    return;
  }

  filtered.forEach((player) => {
    const row = document.createElement('tr');
    row.classList.add(`tier-${player.rankTier}`);
    row.innerHTML = `
      <td><span class="rank-chip">${player.rank}</span></td>
      <td>
        <div>${player.nickname}</div>
        <small>${player.realName}</small>
      </td>
      <td>${numberFormatter.format(player.totalPoints)}</td>
      <td>${numberFormatter.format(player.averagePoints)}</td>
      <td>${numberFormatter.format(player.games)}</td>
      <td>${formatPercent(player.winRate)}</td>
      <td>${formatPercent(player.accuracy)}</td>
      <td>${player.role}</td>
      <td><button type="button" class="pixel-button" data-player="${player.nickname}">Профіль</button></td>
    `;

    const button = row.querySelector('button');
    button?.addEventListener('click', () => renderModal(player));
    leaderboardBody.append(row);
  });
}

function startTicker() {
  if (!tickerEl) {
    return;
  }
  const metrics = calculateMetrics();
  const podiumNames = topPlayers
    .slice(0, 3)
    .map((player) => player.nickname)
    .join(' / ');
  const messages = [
    `Подіум сезону: ${podiumNames}`,
    `Найточніший — ${metrics.mostAccurate.nickname} (${formatPercent(
      metrics.mostAccurate.accuracy,
      percentFormatter1
    )})`,
    `Найдовший стрік: ${metrics.longestStreakPlayer.bestStreak} від ${metrics.longestStreakPlayer.nickname}`,
    `Сумарні очки: ${numberFormatter.format(metrics.totalPoints)}`
  ];

  let index = 0;
  const update = () => {
    tickerEl.textContent = messages[index];
    index = (index + 1) % messages.length;
  };
  update();
  if (messages.length > 1) {
    setInterval(update, 4600);
  }
}

function updateTabs(targetButton) {
  tabButtons.forEach((button) => {
    const isActive = button === targetButton;
    button.setAttribute('aria-selected', String(isActive));
  });
}

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const sortKey = button.dataset.sort;
    if (!sortKey) {
      return;
    }
    if (currentSort === sortKey) {
      currentDirection = currentDirection === 'asc' ? 'desc' : 'asc';
    } else {
      currentSort = sortKey;
      currentDirection = sortKey === 'rank' ? 'asc' : 'desc';
    }
    updateTabs(button);
    renderLeaderboard();
  });
});

searchInput?.addEventListener('input', () => {
  renderLeaderboard();
});

closeButton?.addEventListener('click', () => {
  closeModal();
});

modal?.addEventListener('click', (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

modal?.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeModal();
});

updateTabs(tabButtons[0] ?? null);
renderMetrics();
renderPodium();
renderLeaderboard();
startTicker();
