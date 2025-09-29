'use strict';

const FALLBACK = '—';

function nameAlias(nickname) {
  return nickname === 'Kуmar' ? 'Kumar' : nickname;
}

function getRankTierByPlace(place) {
  const rank = Number(place);
  if (!Number.isFinite(rank) || rank <= 0) {
    return FALLBACK;
  }
  if (rank <= 3) {
    return 'S';
  }
  if (rank <= 7) {
    return 'A';
  }
  if (rank <= 10) {
    return 'B';
  }
  if (rank <= 15) {
    return 'C';
  }
  return 'D';
}

function toFiniteNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function computeMedian(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function computeStdDev(values, mean) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const variance =
    values.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

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
const pointsPluralRules = new Intl.PluralRules('uk-UA');

function formatNumberValue(value) {
  const numeric = toFiniteNumber(value);
  return numeric === null ? FALLBACK : numberFormatter.format(numeric);
}

function formatDecimalValue(value) {
  const numeric = toFiniteNumber(value);
  return numeric === null ? FALLBACK : decimalFormatter.format(numeric);
}

function formatPercentValue(value, formatter = percentFormatter0) {
  const numeric = toFiniteNumber(value);
  return numeric === null ? FALLBACK : formatter.format(numeric);
}

function formatPointsWord(value) {
  const numeric = toFiniteNumber(value);
  if (numeric === null) {
    return 'очок';
  }
  const rule = pointsPluralRules.select(numeric);
  if (rule === 'one') {
    return 'очко';
  }
  if (rule === 'few') {
    return 'очки';
  }
  return 'очок';
}

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
let PACK = null;
let EVENTS = null;
let topPlayers = [];
let seasonTickerMessages = [];
let metricsSnapshot = null;
let tickerTimer = null;
let controlsBound = false;
let profileBound = false;

function normalizeTopPlayers(top10 = [], meta = {}) {
  const leagueName = typeof meta.league === 'string' && meta.league.trim() ? meta.league : FALLBACK;

  return top10.map((entry, index) => {
    const nickname = typeof entry?.player === 'string' && entry.player.trim() ? entry.player : FALLBACK;
    const rank = toFiniteNumber(entry?.rank) ?? index + 1;
    const games = toFiniteNumber(entry?.games);
    const wins = toFiniteNumber(entry?.wins);
    const totalPoints = toFiniteNumber(entry?.season_points);
    const averagePoints =
      games && games > 0 && totalPoints !== null ? totalPoints / games : null;

    const teammates = Array.isArray(entry?.teammates_most)
      ? entry.teammates_most.map((item) => ({
          name: typeof item?.name === 'string' && item.name.trim() ? item.name : FALLBACK,
          games: toFiniteNumber(item?.count)
        }))
      : [];

    const opponents = Array.isArray(entry?.opponents_most)
      ? entry.opponents_most.map((item) => ({
          name: typeof item?.name === 'string' && item.name.trim() ? item.name : FALLBACK,
          meetings: toFiniteNumber(item?.count)
        }))
      : [];

    const lossesTo = Array.isArray(entry?.opponents_most_losses_to)
      ? entry.opponents_most_losses_to[0]
      : null;

    return {
      rank,
      nickname,
      realName: FALLBACK,
      team: leagueName,
      totalPoints,
      averagePoints,
      games,
      wins,
      winRate: toFiniteNumber(entry?.winRate),
      bestStreak: toFiniteNumber(entry?.win_streak),
      lossStreak: toFiniteNumber(entry?.loss_streak),
      MVP: toFiniteNumber(entry?.MVP),
      rankTier:
        typeof entry?.rankTier === 'string' && entry.rankTier.trim()
          ? entry.rankTier
          : getRankTierByPlace(rank),
      role: FALLBACK,
      accuracy: toFiniteNumber(entry?.accuracy),
      tagsPerGame: toFiniteNumber(entry?.tags_per_game),
      assistsPerGame: toFiniteNumber(entry?.assists_per_game),
      clutchPlays: toFiniteNumber(entry?.clutch_plays),
      disarms: toFiniteNumber(entry?.disarms),
      highlights: [],
      story: FALLBACK,
      recentScores: [],
      recentAccuracy: [],
      teammateTop: teammates,
      opponentTop: opponents,
      winWith: [],
      loseWith: [],
      mostLostTo: lossesTo
        ? {
            name:
              typeof lossesTo?.name === 'string' && lossesTo.name.trim()
                ? lossesTo.name
                : FALLBACK,
            count: toFiniteNumber(lossesTo?.count)
          }
        : { name: FALLBACK, count: null },
      dangerous: null,
      loadout: FALLBACK,
      favoriteArena: FALLBACK,
      timeline: null
    };
  });
}

function buildMetrics(aggregates = {}, players = []) {
  const totalGames = toFiniteNumber(aggregates?.total_games);
  const totalRounds = toFiniteNumber(aggregates?.total_rounds);
  const avgRoundsPerGame = toFiniteNumber(aggregates?.avg_rounds_per_game);
  const avgPlayersPerGame = toFiniteNumber(aggregates?.avg_players_per_game);
  const playersWithGames = toFiniteNumber(aggregates?.players_with_games);
  const playersInRating = toFiniteNumber(aggregates?.players_in_rating);
  const totalPoints = toFiniteNumber(aggregates?.points_total);
  const pointsPositiveOnly = toFiniteNumber(aggregates?.points_positive_only);
  const pointsNegativeOnly = toFiniteNumber(aggregates?.points_negative_only);
  const longestGameRounds = toFiniteNumber(aggregates?.longest_game_rounds);
  const commonScore =
    typeof aggregates?.common_score === 'string' && aggregates.common_score.trim()
      ? aggregates.common_score
      : FALLBACK;

  const podiumPlayers = players.slice(0, 3);
  const pointsValues = players
    .map((player) => toFiniteNumber(player?.totalPoints))
    .filter((value) => value !== null);
  const podiumPoints = podiumPlayers.reduce(
    (sum, player) => sum + (toFiniteNumber(player?.totalPoints) ?? 0),
    0
  );
  const podiumNames = podiumPlayers.map((player) => player.nickname ?? FALLBACK);
  const averageTop10 =
    pointsValues.length > 0
      ? pointsValues.reduce((sum, value) => sum + value, 0) / pointsValues.length
      : null;
  const medianTop10 = computeMedian(pointsValues);
  const standardDeviation =
    pointsValues.length > 0 && averageTop10 !== null
      ? computeStdDev(pointsValues, averageTop10)
      : null;
  const minPoints = pointsValues.length > 0 ? Math.min(...pointsValues) : null;
  const maxPoints = pointsValues.length > 0 ? Math.max(...pointsValues) : null;
  const averagePointsPerGame =
    totalGames && totalPoints !== null && totalGames > 0 ? totalPoints / totalGames : null;
  const podiumShare =
    totalPoints && totalPoints > 0 && podiumPoints > 0 ? podiumPoints / totalPoints : null;

  return {
    totalGames,
    totalRounds,
    avgRoundsPerGame,
    avgPlayersPerGame,
    playersWithGames,
    playersInRating,
    totalPoints,
    pointsPositiveOnly,
    pointsNegativeOnly,
    longestGameRounds,
    commonScore,
    podiumPoints: podiumPlayers.length > 0 ? podiumPoints : null,
    podiumNames,
    podiumShare,
    averagePointsPerGame,
    averageTop10,
    medianTop10,
    standardDeviation,
    minPoints,
    maxPoints
  };
}

function buildTickerMessages(data) {
  return [
    `Матчів: ${formatNumberValue(data.totalGames)} · Раундів: ${formatNumberValue(data.totalRounds)}`,
    `Очки сезону: ${formatNumberValue(data.totalPoints)} (подіум ${formatPercentValue(
      data.podiumShare,
      percentFormatter1
    )})`,
    `Середні очки топ-10: ${formatNumberValue(data.averageTop10)} ±${formatDecimalValue(
      data.standardDeviation
    )}`
  ];
}
function renderMetricsFromAggregates(aggregates = {}, players = []) {
  metricsSnapshot = buildMetrics(aggregates, players);
  const data = metricsSnapshot;

  const cards = [
    {
      label: 'Матчів зіграно',
      value: formatNumberValue(data.totalGames),
      delta:
        data.avgRoundsPerGame !== null
          ? `~${formatDecimalValue(data.avgRoundsPerGame)} раундів/матч`
          : '',
      footnote: `Раундів: ${formatNumberValue(data.totalRounds)}`,
      key: 'games'
    },
    {
      label: 'Активних гравців',
      value: formatNumberValue(data.playersWithGames),
      delta:
        data.playersInRating !== null
          ? `У рейтингу ${formatNumberValue(data.playersInRating)}`
          : '',
      footnote:
        data.avgPlayersPerGame !== null
          ? `Середній склад: ${formatDecimalValue(data.avgPlayersPerGame)} гравця`
          : FALLBACK,
      key: 'players'
    },
    {
      label: 'Сумарні очки',
      value: formatNumberValue(data.totalPoints),
      delta:
        data.pointsPositiveOnly !== null
          ? `Позитивні ${formatNumberValue(data.pointsPositiveOnly)}`
          : '',
      footnote:
        data.pointsNegativeOnly !== null
          ? `Негативні ${formatNumberValue(data.pointsNegativeOnly)}`
          : FALLBACK,
      key: 'points'
    },
    {
      label: 'Подіум',
      value: formatNumberValue(data.podiumPoints),
      delta:
        data.podiumShare !== null
          ? `Частка ${formatPercentValue(data.podiumShare, percentFormatter1)}`
          : '',
      footnote: data.podiumNames.length > 0 ? data.podiumNames.join(' / ') : FALLBACK,
      key: 'podium'
    },
    {
      label: 'Середні очки/матч',
      value: formatDecimalValue(data.averagePointsPerGame),
      delta: data.commonScore !== FALLBACK ? `Типовий рахунок ${data.commonScore}` : '',
      footnote:
        data.longestGameRounds !== null
          ? `Найдовший бій: ${formatNumberValue(data.longestGameRounds)} раундів`
          : FALLBACK,
      key: 'pace'
    },
    {
      label: 'Топ-10',
      value: formatNumberValue(data.averageTop10),
      delta:
        data.standardDeviation !== null ? `σ = ${formatDecimalValue(data.standardDeviation)}` : '',
      footnote:
        data.minPoints !== null && data.maxPoints !== null
          ? `Діапазон: ${formatNumberValue(data.minPoints)}–${formatNumberValue(
              data.maxPoints
            )} · Медіана ${formatNumberValue(data.medianTop10)}`
          : FALLBACK,
      key: 'top10'
    }
  ];

  if (metricsGrid) {
    metricsGrid.innerHTML = '';
    cards.forEach((card) => {
      const article = document.createElement('article');
      article.className = 'metric-card';
      article.dataset.metric = card.key;
      article.innerHTML = `
        <span class="metric-label">${card.label}</span>
        <span class="metric-value">${card.value}</span>
        ${card.delta ? `<span class="metric-delta">${card.delta}</span>` : ''}
        <span class="metric-footnote">${card.footnote}</span>
      `;
      metricsGrid.append(article);
    });
  }

  seasonTickerMessages = buildTickerMessages(data);
  startTicker(seasonTickerMessages);
}

function renderPodium(players = topPlayers) {
  if (!podiumGrid) {
    return;
  }
  podiumGrid.innerHTML = '';
  players.slice(0, 3).forEach((player, index) => {
    const card = document.createElement('article');
    card.className = 'podium-card';
    card.dataset.rank = `#${index + 1}`;
    const rankTier =
      typeof player?.rankTier === 'string' && player.rankTier.trim()
        ? player.rankTier
        : getRankTierByPlace(player?.rank);
    card.innerHTML = `
      <h3>${player?.nickname ?? FALLBACK}</h3>
      <ul>
        <li>${player?.team ?? FALLBACK}</li>
        <li>${formatNumberValue(player?.totalPoints)} очок</li>
        <li>Win rate ${formatPercentValue(player?.winRate)}</li>
        <li>Стрік ${formatNumberValue(player?.bestStreak)}</li>
      </ul>
    `;
    if (rankTier && rankTier !== FALLBACK) {
      card.classList.add(`tier-${rankTier}`);
    }
    podiumGrid.append(card);
  });
}

function getSortValue(player, sortKey) {
  if (!player) {
    return null;
  }
  if (sortKey === 'games') {
    return toFiniteNumber(player.games);
  }
  if (sortKey === 'rank') {
    return toFiniteNumber(player.rank);
  }
  return toFiniteNumber(player[sortKey]);
}

function renderLeaderboard(players = topPlayers) {
  if (!leaderboardBody) {
    return;
  }
  const searchTerm = searchInput?.value.trim().toLowerCase() ?? '';
  const sorted = [...players].sort((a, b) => {
    const valueA = getSortValue(a, currentSort);
    const valueB = getSortValue(b, currentSort);
    const fallbackAsc = Number.POSITIVE_INFINITY;
    const fallbackDesc = Number.NEGATIVE_INFINITY;
    const safeA =
      valueA !== null ? valueA : currentDirection === 'asc' ? fallbackAsc : fallbackDesc;
    const safeB =
      valueB !== null ? valueB : currentDirection === 'asc' ? fallbackAsc : fallbackDesc;
    if (safeA === safeB) {
      return 0;
    }
    return currentDirection === 'asc' ? safeA - safeB : safeB - safeA;
  });

  const filtered = sorted.filter((player) => {
    if (!searchTerm) {
      return true;
    }
    const haystack = [
      player?.nickname ?? '',
      player?.realName ?? '',
      player?.team ?? '',
      player?.role ?? '',
      player?.favoriteArena ?? ''
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
    const rankTier =
      typeof player?.rankTier === 'string' && player.rankTier.trim()
        ? player.rankTier
        : null;
    if (rankTier) {
      row.classList.add(`tier-${rankTier}`);
    } else {
      row.classList.add('tier-none');
    }
    const badgeMarkup = rankTier
      ? `<span class="role-badge tier-${rankTier}" aria-label="Ранг ${rankTier}">${rankTier}</span>`
      : `<span class="role-badge tier-none" aria-label="Ранг відсутній">${FALLBACK}</span>`;

    row.innerHTML = `
      <td><span class="rank-chip">${formatNumberValue(player?.rank)}</span></td>
      <td>
        <div>${player?.nickname ?? FALLBACK}</div>
        <small>${player?.realName ?? FALLBACK}</small>
      </td>
      <td>${formatNumberValue(player?.totalPoints)}</td>
      <td>${formatNumberValue(player?.averagePoints)}</td>
      <td>${formatNumberValue(player?.games)}</td>
      <td>${formatPercentValue(player?.winRate)}</td>
      <td>${formatNumberValue(player?.games)}</td>
      <td>
        <span class="role-cell">
          <span>${player?.role ?? FALLBACK}</span>
          ${badgeMarkup}
        </span>
      </td>
      <td><button type="button" class="pixel-button" data-player="${player?.nickname ?? ''}">Профіль</button></td>
    `;

    const button = row.querySelector('button');
    button?.addEventListener('click', () => renderModal(player));
    leaderboardBody.append(row);
  });
}

function buildPlayerChart(timeline, mode = 'delta') {
  if (!timeline || !Array.isArray(timeline.scores) || timeline.scores.length === 0) {
    return '<p>Немає даних для графіка.</p>';
  }

  const baseValues = timeline.scores.map((value) => toFiniteNumber(value) ?? 0);
  const values =
    mode === 'cum'
      ? baseValues.reduce((acc, value, index) => {
          const previous = index === 0 ? 0 : acc[index - 1];
          acc.push(previous + value);
          return acc;
        }, [])
      : baseValues;

  const width = 360;
  const height = 240;
  const paddingX = 24;
  const paddingY = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const step = values.length > 1 ? (width - paddingX * 2) / (values.length - 1) : 0;

  const points = values.map((value, index) => {
    const x = paddingX + step * index;
    const normalized = (value - min) / range;
    const y = height - paddingY - normalized * (height - paddingY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const fillPoints = [
    `${paddingX},${height - paddingY}`,
    ...points,
    `${width - paddingX},${height - paddingY}`
  ].join(' ');

  const description = values
    .map((value, index) => {
      const label = mode === 'cum' ? 'Сумарно' : 'Раунд';
      return `${label} ${index + 1}: ${formatNumberValue(Math.round(value))}`;
    })
    .join(', ');

  const baselineY = height - paddingY;
  const [lastX = '0', lastY = '0'] = points[points.length - 1]?.split(',') ?? [];
  const modeTitle = mode === 'cum' ? 'Накопичені очки' : 'Очки за матч';

  return `
    <svg class="player-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${modeTitle}">
      <title>${modeTitle}</title>
      <desc>${description}</desc>
      <rect x="${paddingX}" y="${paddingY}" width="${width - paddingX * 2}" height="${
    height - paddingY * 2
  }" fill="rgba(9, 14, 32, 0.65)" stroke="rgba(157, 215, 255, 0.2)"></rect>
      <polyline points="${fillPoints}" fill="rgba(255, 102, 196, 0.15)" stroke="none"></polyline>
      <polyline points="${points.join(' ')}" fill="none" stroke="#ff66c4" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"></polyline>
      <line x1="${paddingX}" y1="${baselineY}" x2="${width - paddingX}" y2="${baselineY}" stroke="rgba(255, 255, 255, 0.2)" stroke-dasharray="6 6"></line>
      <circle cx="${lastX}" cy="${lastY}" r="4.5" fill="#ffd700" stroke="#05070e" stroke-width="2"></circle>
    </svg>
  `;
}

function renderPairList(items, type) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<p class="pair-placeholder">—</p>';
  }

  const markup = items
    .map((item) => {
      const name = typeof item?.name === 'string' && item.name.trim() ? item.name : FALLBACK;
      if (type === 'teammate') {
        const details = [];
        const gamesLabel = formatNumberValue(item?.games);
        const winsLabel = formatNumberValue(item?.wins);
        const wrLabel = formatPercentValue(item?.wr, percentFormatter1);
        if (gamesLabel !== FALLBACK) {
          details.push(`${gamesLabel} боїв`);
        }
        if (winsLabel !== FALLBACK) {
          details.push(`${winsLabel} перемог`);
        }
        if (wrLabel !== FALLBACK) {
          details.push(`WR ${wrLabel}`);
        }
        const detailText = details.length > 0 ? details.join(' · ') : FALLBACK;
        return `<li><strong>${name}</strong><span>${detailText}</span></li>`;
      }

      const details = [];
      const meetingsLabel = formatNumberValue(item?.meetings);
      const wrLabel = formatPercentValue(item?.wr, percentFormatter1);
      if (meetingsLabel !== FALLBACK) {
        details.push(`${meetingsLabel} дуелей`);
      }
      if (wrLabel !== FALLBACK) {
        details.push(`WR ${wrLabel}`);
      }
      const detailText = details.length > 0 ? details.join(' · ') : FALLBACK;
      return `<li><strong>${name}</strong><span>${detailText}</span></li>`;
    })
    .join('');

  return `<ul class="pair-list">${markup}</ul>`;
}

function renderModal(player) {
  if (!modal) {
    return;
  }

  modalTitle.textContent = `${player?.nickname ?? FALLBACK} · ${player?.team ?? FALLBACK}`;
  const battlesLabel = formatNumberValue(player?.games);
  const winsLabel = formatNumberValue(player?.wins);
  const winRateLabel = formatPercentValue(player?.winRate, percentFormatter1);
  const totalPointsLabel = formatNumberValue(player?.totalPoints);
  const averagePointsLabel = formatNumberValue(player?.averagePoints);
  const rankTier =
    typeof player?.rankTier === 'string' && player.rankTier.trim()
      ? player.rankTier
      : getRankTierByPlace(player?.rank);
  const bestStreakLabel = formatNumberValue(player?.bestStreak);
  const tagsLabel = formatDecimalValue(player?.tagsPerGame);
  const assistsLabel = formatDecimalValue(player?.assistsPerGame);
  const clutchLabel = formatNumberValue(player?.clutchPlays);
  const disarmsLabel = formatNumberValue(player?.disarms);
  const roleLabel = player?.role ?? FALLBACK;
  const arenaLabel = player?.favoriteArena ?? FALLBACK;

  const recentScores = Array.isArray(player?.recentScores) ? player.recentScores : [];
  const hasRecentScores = recentScores.length > 0;
  const averageRecent =
    hasRecentScores
      ? recentScores.reduce((sum, score) => sum + (toFiniteNumber(score) ?? 0), 0) /
        recentScores.length
      : null;
  const tempoSummary = hasRecentScores
    ? `Середній темп — ${formatDecimalValue(averageRecent)} очок за ${formatNumberValue(
        recentScores.length
      )} останні бої.`
    : 'Немає даних про останні бої.';
  const recentResultsParagraph = hasRecentScores
    ? `<p>Останні результати: ${recentScores
        .map((value) => `${formatNumberValue(value)} очок`)
        .join(' · ')}.</p>`
    : '';

  const timeline = player?.timeline ?? null;
  const hasTimeline = Array.isArray(timeline?.scores) && timeline.scores.length > 0;
  const defaultChartMode = 'delta';
  const chartControlsMarkup = hasTimeline
    ? `<div class="chart-mode-switch" role="radiogroup" aria-label="Режим графіка">
        <label><input type="radio" name="chart-mode" value="delta" checked /> Δ очки</label>
        <label><input type="radio" name="chart-mode" value="cum" /> Σ очки</label>
      </div>`
    : '';
  const chartMarkup = hasTimeline
    ? buildPlayerChart(timeline, defaultChartMode)
    : '<p>Немає даних для графіка.</p>';

  const highlightsMarkup =
    Array.isArray(player?.highlights) && player.highlights.length > 0
      ? player.highlights.map((item) => `<li>${item}</li>`).join('')
      : '<li>—</li>';

  modalBody.innerHTML = `
    <section>
      <h3>Основні показники</h3>
      <div class="detail-grid">
        <div>
          <strong>Бої (зіграні)</strong>
          ${battlesLabel}
        </div>
        <div>
          <strong>Перемог</strong>
          ${winsLabel} (${winRateLabel})
        </div>
        <div>
          <strong>Очок за сезон</strong>
          ${totalPointsLabel}
        </div>
        <div>
          <strong>Сер. очки</strong>
          ${averagePointsLabel}
        </div>
        <div>
          <strong>Ранг</strong>
          ${rankTier ?? FALLBACK}
        </div>
        <div>
          <strong>Стрік</strong>
          ${bestStreakLabel !== FALLBACK ? `${bestStreakLabel} поспіль` : FALLBACK}
        </div>
        <div>
          <strong>Tags/гра</strong>
          ${tagsLabel}
        </div>
        <div>
          <strong>Асисти/гра</strong>
          ${assistsLabel}
        </div>
        <div>
          <strong>Clutch</strong>
          ${clutchLabel !== FALLBACK ? `${clutchLabel} сейви` : FALLBACK}
        </div>
        <div>
          <strong>Обеззброєнь</strong>
          ${disarmsLabel}
        </div>
        <div>
          <strong>Роль</strong>
          ${roleLabel}
        </div>
        <div>
          <strong>Улюблена арена</strong>
          ${arenaLabel}
        </div>
      </div>
    </section>
    <section>
      <h3>Останні матчі</h3>
      ${chartControlsMarkup}
      <div class="chart-wrapper" data-chart-wrapper>
        ${chartMarkup}
      </div>
      <p>${tempoSummary}</p>
      ${recentResultsParagraph}
    </section>
    <section>
      <h3>Топ напарників</h3>
      ${renderPairList(player?.teammateTop, 'teammate')}
    </section>
    <section>
      <h3>Топ суперників</h3>
      ${renderPairList(player?.opponentTop, 'opponent')}
    </section>
    <section>
      <h3>Фішки гравця</h3>
      <ul class="detail-list">
        ${highlightsMarkup}
      </ul>
      <p>${player?.story ?? FALLBACK}</p>
      <p>Набір: ${player?.loadout ?? FALLBACK}</p>
    </section>
  `;

  if (hasTimeline) {
    const chartWrapper = modalBody.querySelector('[data-chart-wrapper]');
    const modeInputs = modalBody.querySelectorAll('input[name="chart-mode"]');
    modeInputs.forEach((input) => {
      input.addEventListener('change', (event) => {
        if (event.target instanceof HTMLInputElement && event.target.checked) {
          chartWrapper.innerHTML = buildPlayerChart(timeline, event.target.value);
        }
      });
    });
  }

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

function startTicker(messages = []) {
  if (!tickerEl) {
    return;
  }
  if (tickerTimer) {
    clearInterval(tickerTimer);
    tickerTimer = null;
  }
  const list = Array.isArray(messages) && messages.length > 0 ? messages : [FALLBACK];
  let index = 0;
  const update = () => {
    tickerEl.textContent = list[index];
    index = (index + 1) % list.length;
  };
  update();
  if (list.length > 1) {
    tickerTimer = window.setInterval(update, 4600);
  }
}

function updateTabs(targetButton) {
  tabButtons.forEach((button) => {
    const isActive = button === targetButton;
    button.setAttribute('aria-selected', String(isActive));
  });
}

function bindTableControls() {
  if (controlsBound) {
    return;
  }
  controlsBound = true;

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

  updateTabs(tabButtons[0] ?? null);
}

function bindProfile() {
  if (profileBound) {
    return;
  }
  profileBound = true;

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
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  if (!response.ok) {
    throw new Error(`Не вдалося завантажити ${url}: ${response.status}`);
  }
  return response.json();
}

async function boot() {
  try {
    const [packData, eventsData] = await Promise.all([
      fetchJSON('/SL_Summer2025_pack.json'),
      fetchJSON('/sunday_summer_2025_EVENTS.json')
    ]);
    PACK = packData;
    EVENTS = eventsData;
    topPlayers = normalizeTopPlayers(PACK?.top10 ?? [], PACK?.meta ?? {});
    renderMetricsFromAggregates(PACK?.aggregates ?? {}, topPlayers);
    renderPodium(topPlayers);
    renderLeaderboard(topPlayers);
    bindTableControls();
    bindProfile();
  } catch (error) {
    console.error('[summer2025] boot failed', error);
    if (metricsGrid) {
      metricsGrid.innerHTML = '<p class="error">Не вдалося завантажити дані сезону.</p>';
    }
  }
}

boot();
