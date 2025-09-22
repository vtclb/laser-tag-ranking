'use strict';

const topPlayers = [
  {
    rank: 1,
    nickname: 'Photon',
    realName: 'Дмитро "Photon" Рубін',
    team: 'Orion Syndicate',
    totalPoints: 21540,
    averagePoints: 513,
    games: 42,
    wins: 33,
    winRate: 0.786,
    accuracy: 0.46,
    bestStreak: 11,
    tagsPerGame: 35,
    assistsPerGame: 12,
    clutchPlays: 18,
    disarms: 7,
    rankTier: 'S',
    role: 'Штурмовик',
    loadout: 'Phaser XR · Shieldwave',
    favoriteArena: 'Неонова арена',
    highlights: [
      '3 хедшоти поспіль у фіналі туру #10',
      'Врятований контроль центру за 7 секунд до завершення',
      'Рекорд сезону: 560 очок за гру'
    ],
    story:
      'Капітан Orion Syndicate повернув собі корону після зимового простою, поєднавши агресивний пуш із точним контролем зон.',
    recentScores: [540, 522, 508, 531, 517, 549, 560, 518],
    recentAccuracy: [0.45, 0.46, 0.47, 0.44, 0.46, 0.48, 0.49, 0.45]
  },
  {
    rank: 2,
    nickname: 'Vega',
    realName: 'Марія "Vega" Литвин',
    team: 'Nebula Owls',
    totalPoints: 19870,
    averagePoints: 523,
    games: 38,
    wins: 29,
    winRate: 0.763,
    accuracy: 0.44,
    bestStreak: 9,
    tagsPerGame: 33,
    assistsPerGame: 14,
    clutchPlays: 15,
    disarms: 9,
    rankTier: 'S',
    role: 'Плеймейкер',
    loadout: 'Nova Pulse · D-Tec Beacon',
    favoriteArena: 'Кібер-купол',
    highlights: [
      'Найкраща серія асистів: 11 за гру проти Skyline',
      'Командний рекорд точності 52% у плей-офф',
      'Три MVP поспіль у турах #4-#6'
    ],
    story:
      'Vega звикла будувати атаки з глибини, читаючи ротації суперника та миттєво підлаштовуючись до змін на мапі.',
    recentScores: [488, 505, 522, 531, 507, 518, 536, 511],
    recentAccuracy: [0.41, 0.42, 0.45, 0.47, 0.44, 0.45, 0.48, 0.43]
  },
  {
    rank: 3,
    nickname: 'ShadowFox',
    realName: 'Олег "ShadowFox" Сич',
    team: 'Night Parade',
    totalPoints: 19210,
    averagePoints: 480,
    games: 40,
    wins: 27,
    winRate: 0.675,
    accuracy: 0.41,
    bestStreak: 8,
    tagsPerGame: 31,
    assistsPerGame: 9,
    clutchPlays: 13,
    disarms: 6,
    rankTier: 'S',
    role: 'Розвідник',
    loadout: 'Stealth Carbine · Echo Cloak',
    favoriteArena: 'Люмінаріум',
    highlights: [
      '7 перехоплень сигналу на турі #7',
      'Крадуча перемога 3v5 у додатковому часі',
      'Серія із 6 ігор без жодного вибування'
    ],
    story:
      'ShadowFox працює тінню для команди: мінімум шуму, максимум інформації про позиції суперників.',
    recentScores: [462, 470, 498, 505, 477, 489, 501, 493],
    recentAccuracy: [0.38, 0.39, 0.41, 0.43, 0.4, 0.41, 0.42, 0.4]
  },
  {
    rank: 4,
    nickname: 'Aurora',
    realName: 'Ірина "Aurora" Мельник',
    team: 'Starlight Syndicate',
    totalPoints: 18540,
    averagePoints: 501,
    games: 37,
    wins: 26,
    winRate: 0.703,
    accuracy: 0.45,
    bestStreak: 7,
    tagsPerGame: 30,
    assistsPerGame: 10,
    clutchPlays: 12,
    disarms: 5,
    rankTier: 'A',
    role: 'Сапорт',
    loadout: 'Solar Rifle · Prism Shield',
    favoriteArena: 'Зоряний док',
    highlights: [
      'Перший у сезоні хет-трик у зоні Альфа',
      'Сейв раунду з точністю 58% у фіналі групи',
      'Понад 100 корисних сигналів команді'
    ],
    story:
      'Aurora — серце підтримки: закриває беклайн та заряджає всю команду, коли потрібно переломити гру.',
    recentScores: [472, 498, 506, 489, 501, 495, 518, 507],
    recentAccuracy: [0.42, 0.43, 0.44, 0.46, 0.45, 0.44, 0.47, 0.45]
  },
  {
    rank: 5,
    nickname: 'Tempest',
    realName: 'Роман "Tempest" Коваль',
    team: 'Voltage Crew',
    totalPoints: 18010,
    averagePoints: 500,
    games: 36,
    wins: 25,
    winRate: 0.694,
    accuracy: 0.39,
    bestStreak: 9,
    tagsPerGame: 29,
    assistsPerGame: 8,
    clutchPlays: 10,
    disarms: 4,
    rankTier: 'A',
    role: 'Брейкер ліній',
    loadout: 'Ion Blaster · Temp Shield',
    favoriteArena: 'Станція Вектор',
    highlights: [
      'Фінальний пуш 8-0 проти Neon Flux',
      'Серія з 14 вибивань у турі #3',
      'Перший у сезоні capture з лінії бури'
    ],
    story:
      'Tempest розриває позиції суперника різкими ривками і не боїться брати дуелі 1v2, якщо це дає імпульс команді.',
    recentScores: [455, 468, 496, 503, 488, 507, 499, 514],
    recentAccuracy: [0.36, 0.37, 0.38, 0.4, 0.39, 0.4, 0.41, 0.38]
  },
  {
    rank: 6,
    nickname: 'Quasar',
    realName: 'Антон "Quasar" Демчук',
    team: 'Nebula Owls',
    totalPoints: 17490,
    averagePoints: 514,
    games: 34,
    wins: 24,
    winRate: 0.706,
    accuracy: 0.43,
    bestStreak: 8,
    tagsPerGame: 28,
    assistsPerGame: 11,
    clutchPlays: 9,
    disarms: 6,
    rankTier: 'A',
    role: 'Інженер',
    loadout: 'Pulse SMG · Flux Core',
    favoriteArena: 'Кібер-купол',
    highlights: [
      'Перша в історії клубу серія з 5 активних маяків',
      '95% успішності підриву периметра',
      'Віддача 6000+ очок партнерам через підтримку'
    ],
    story:
      'Quasar вибудовує технологічну перевагу: ставить маяки, блокує сканери та створює чудові умови для Vega.',
    recentScores: [468, 481, 512, 523, 495, 508, 517, 514],
    recentAccuracy: [0.4, 0.41, 0.44, 0.45, 0.43, 0.44, 0.46, 0.42]
  },
  {
    rank: 7,
    nickname: 'Rogue',
    realName: 'Ілля "Rogue" Савчук',
    team: 'Night Parade',
    totalPoints: 16980,
    averagePoints: 486,
    games: 35,
    wins: 23,
    winRate: 0.657,
    accuracy: 0.4,
    bestStreak: 7,
    tagsPerGame: 27,
    assistsPerGame: 7,
    clutchPlays: 8,
    disarms: 3,
    rankTier: 'A',
    role: 'Фланкер',
    loadout: 'Vector Lance · Pulse Mine',
    favoriteArena: 'Лабіринт Sigma',
    highlights: [
      'Перехоплення трьох прапорів за вечір',
      'Соло-відбиття 4х пушів поспіль',
      'Середній час на точці — рекорд клубу'
    ],
    story:
      'Rogue розбиває оборону обходами, змушуючи команди повертатися й залишати ключові точки без прикриття.',
    recentScores: [438, 452, 479, 487, 498, 476, 492, 494],
    recentAccuracy: [0.37, 0.38, 0.4, 0.41, 0.4, 0.39, 0.41, 0.39]
  },
  {
    rank: 8,
    nickname: 'Nyx',
    realName: 'Оксана "Nyx" Верба',
    team: 'Lunar Unit',
    totalPoints: 16420,
    averagePoints: 498,
    games: 33,
    wins: 21,
    winRate: 0.636,
    accuracy: 0.42,
    bestStreak: 6,
    tagsPerGame: 26,
    assistsPerGame: 9,
    clutchPlays: 7,
    disarms: 4,
    rankTier: 'B',
    role: 'Контролер зони',
    loadout: 'Aurora Beam · Gravity Net',
    favoriteArena: 'Неонова арена',
    highlights: [
      'Найкраща середня точність у жіночому дивізіоні',
      'Серія з 5 ігор без втрати контрольної точки',
      '42 блокування ульти суперника'
    ],
    story:
      'Nyx створює пастки та змушує суперника витрачати ресурси на обхід, перш ніж атакувати ключові напрямки.',
    recentScores: [452, 461, 487, 502, 489, 501, 508, 494],
    recentAccuracy: [0.4, 0.41, 0.42, 0.44, 0.43, 0.42, 0.44, 0.41]
  },
  {
    rank: 9,
    nickname: 'Volt',
    realName: 'Андрій "Volt" Нестеров',
    team: 'Voltage Crew',
    totalPoints: 16075,
    averagePoints: 502,
    games: 32,
    wins: 20,
    winRate: 0.625,
    accuracy: 0.38,
    bestStreak: 5,
    tagsPerGame: 25,
    assistsPerGame: 6,
    clutchPlays: 6,
    disarms: 2,
    rankTier: 'B',
    role: 'Штурмовий саппорт',
    loadout: 'Arc Blaster · Tesla Drones',
    favoriteArena: 'Станція Вектор',
    highlights: [
      'Два камбеки 1v3 у турі #8',
      'Перша сотня добивань у клубі за сезон',
      'Запустив дрони, що зірвали фінальний пуш суперника'
    ],
    story:
      'Volt підхоплює ініціативу Tempest, підчищаючи коридори та не залишаючи супернику шансів відновити позиції.',
    recentScores: [430, 447, 478, 492, 505, 498, 512, 489],
    recentAccuracy: [0.35, 0.36, 0.38, 0.39, 0.37, 0.38, 0.4, 0.37]
  },
  {
    rank: 10,
    nickname: 'Glitch',
    realName: 'Лев "Glitch" Богданов',
    team: 'Pixel Raiders',
    totalPoints: 15460,
    averagePoints: 515,
    games: 30,
    wins: 18,
    winRate: 0.6,
    accuracy: 0.37,
    bestStreak: 6,
    tagsPerGame: 24,
    assistsPerGame: 7,
    clutchPlays: 5,
    disarms: 3,
    rankTier: 'B',
    role: 'Аналітик',
    loadout: 'Binary Rifle · Jammer Field',
    favoriteArena: 'Лабіринт Sigma',
    highlights: [
      'Відкрив нову лінію для проходу у фіналі плей-офф',
      '33 зламані маяки суперника',
      'Перший у клубі, хто використав тріпл-комбо з Jammer Field'
    ],
    story:
      'Glitch розкладає гру на патерни, знаходить слабкі місця у схемах та миттєво їх експлуатує для Pixel Raiders.',
    recentScores: [402, 425, 456, 498, 487, 512, 505, 489],
    recentAccuracy: [0.33, 0.34, 0.36, 0.38, 0.37, 0.39, 0.4, 0.36]
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
