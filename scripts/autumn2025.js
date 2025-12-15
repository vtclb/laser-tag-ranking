'use strict';

const FALLBACK = '—';

function normName(value, aliasMap = {}) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const lookup = trimmed.toLowerCase();
  for (const [canonicalRaw, aliases] of Object.entries(aliasMap ?? {})) {
    const canonical = typeof canonicalRaw === 'string' ? canonicalRaw.trim() : '';
    if (!canonical) {
      continue;
    }
    if (canonical.toLowerCase() === lookup) {
      return canonical;
    }
    if (
      Array.isArray(aliases) &&
      aliases.some((alias) => typeof alias === 'string' && alias.trim().toLowerCase() === lookup)
    ) {
      return canonical;
    }
  }

  return trimmed;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function resolveCanonicalNickname(nickname, aliasMap = {}) {
  const original = typeof nickname === 'string' ? nickname.trim() : '';
  if (!original) {
    return '';
  }

  const lookup = original.toLowerCase();
  for (const [canonicalRaw, aliases] of Object.entries(aliasMap ?? {})) {
    const canonical = typeof canonicalRaw === 'string' ? canonicalRaw.trim() : '';
    if (!canonical) {
      continue;
    }
    if (canonical.toLowerCase() === lookup) {
      return canonical;
    }
    if (
      Array.isArray(aliases) &&
      aliases.some(
        (alias) => typeof alias === 'string' && alias.trim().toLowerCase() === lookup
      )
    ) {
      return canonical;
    }
  }

  return original;
}

function getNicknameVariants(nickname, aliasMap = {}) {
  const variants = new Set();
  const canonical = resolveCanonicalNickname(nickname, aliasMap);
  const aliasList =
    canonical && aliasMap && Array.isArray(aliasMap[canonical]) ? aliasMap[canonical] : [];

  [nickname, canonical, ...(aliasList ?? [])].forEach((value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        variants.add(trimmed);
      }
    }
  });

  return Array.from(variants);
}

function normalizeNickname(nickname, aliasMap = {}) {
  const canonical = resolveCanonicalNickname(nickname, aliasMap);
  return normalizeString(canonical || nickname);
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

function normalizeTopPlayers(top10 = [], meta = {}, aliasMap = {}) {
  const leagueName = typeof meta.league === 'string' && meta.league.trim() ? meta.league : FALLBACK;

  return top10.map((entry, index) => {
    const nicknameRaw =
      typeof entry?.player === 'string' && entry.player.trim() ? entry.player.trim() : '';
    const nickname = nicknameRaw || FALLBACK;
    const canonicalNickname = nicknameRaw ? resolveCanonicalNickname(nicknameRaw, aliasMap) : '';
    const nicknameAliases = nicknameRaw ? getNicknameVariants(nicknameRaw, aliasMap) : [];
    const normalizedNickname = nicknameRaw ? normalizeNickname(nicknameRaw, aliasMap) : '';
    const rank = toFiniteNumber(entry?.rank) ?? index + 1;
    const games = toFiniteNumber(entry?.games);
    const wins = toFiniteNumber(entry?.wins);
    const losses = toFiniteNumber(entry?.losses);
    const draws = toFiniteNumber(entry?.draws);
    const totalPoints = toFiniteNumber(entry?.season_points);
    const averagePoints =
      games && games > 0 && totalPoints !== null ? totalPoints / games : null;
    const rounds = toFiniteNumber(entry?.rounds);
    const roundWins = toFiniteNumber(entry?.round_wins);
    const roundLosses = toFiniteNumber(entry?.round_losses);
    const roundWinRate = toFiniteNumber(entry?.roundWR);
    const winStreak = toFiniteNumber(entry?.win_streak);
    const lossStreak = toFiniteNumber(entry?.loss_streak);
    const mvpCount = toFiniteNumber(entry?.MVP);

    const teammatesMost = Array.isArray(entry?.teammates_most)
      ? entry.teammates_most
          .map((item) => ({
            name: typeof item?.name === 'string' ? item.name.trim() : '',
            count: toFiniteNumber(item?.count)
          }))
          .filter((item) => item.name && item.count !== null)
      : [];

    const teammatesMostWins = Array.isArray(entry?.teammates_most_wins)
      ? entry.teammates_most_wins
          .map((item) => ({
            name: typeof item?.name === 'string' ? item.name.trim() : '',
            count: toFiniteNumber(item?.count)
          }))
          .filter((item) => item.name && item.count !== null)
      : [];

    const opponentsMost = Array.isArray(entry?.opponents_most)
      ? entry.opponents_most
          .map((item) => ({
            name: typeof item?.name === 'string' ? item.name.trim() : '',
            count: toFiniteNumber(item?.count)
          }))
          .filter((item) => item.name && item.count !== null)
      : [];

    const opponentsMostLosses = Array.isArray(entry?.opponents_most_losses_to)
      ? entry.opponents_most_losses_to
          .map((item) => ({
            name: typeof item?.name === 'string' ? item.name.trim() : '',
            count: toFiniteNumber(item?.count)
          }))
          .filter((item) => item.name && item.count !== null)
      : [];

    const lossesTo = opponentsMostLosses.length > 0 ? opponentsMostLosses[0] : null;

    return {
      rank,
      nickname,
      canonicalNickname: canonicalNickname || nickname,
      normalizedNickname,
      aliases: nicknameAliases,
      realName: FALLBACK,
      team: leagueName,
      season_points: totalPoints,
      totalPoints,
      averagePoints,
      games,
      wins,
      losses,
      draws,
      winRate: toFiniteNumber(entry?.winRate),
      roundWR: roundWinRate,
      rounds,
      round_wins: roundWins,
      round_losses: roundLosses,
      win_streak: winStreak,
      loss_streak: lossStreak,
      MVP: mvpCount,
      bestStreak: winStreak,
      lossStreak,
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
      teammatesMost,
      teammatesMostWins,
      opponentsMost,
      opponentsMostLosses,
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
  if (!player || !sortKey) {
    return null;
  }

  switch (sortKey) {
    case 'rank':
      return toFiniteNumber(player.rank);
    case 'season_points':
      return toFiniteNumber(player.season_points ?? player.totalPoints);
    case 'games':
      return toFiniteNumber(player.games);
    case 'wins':
      return toFiniteNumber(player.wins);
    case 'losses':
      return toFiniteNumber(player.losses);
    case 'rounds':
      return toFiniteNumber(player.rounds);
    case 'winRate':
    case 'roundWR':
      return toFiniteNumber(player[sortKey]);
    case 'MVP':
      return toFiniteNumber(player.MVP);
    case 'rankTier': {
      const tier = typeof player.rankTier === 'string' ? player.rankTier.trim() : '';
      return tier ? tier.charCodeAt(0) : null;
    }
    default:
      return toFiniteNumber(player[sortKey]);
  }
}

function renderLeaderboard(players = topPlayers) {
  if (!leaderboardBody) {
    return;
  }
  const rawSearch = searchInput?.value ?? '';
  const searchTerm = rawSearch.trim();
  const searchTermLower = searchTerm.toLowerCase();
  const aliasMap = PACK?.aliases ?? {};
  const normalizedSearch = normalizeNickname(searchTerm, aliasMap);
  const hasNormalizedSearch = Boolean(normalizedSearch);
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

    const aliasList = Array.isArray(player?.aliases) ? player.aliases : [];
    const textFields = [
      player?.nickname ?? '',
      player?.canonicalNickname ?? '',
      player?.realName ?? '',
      player?.team ?? '',
      player?.role ?? '',
      player?.favoriteArena ?? '',
      ...aliasList
    ].filter(Boolean);

    const plainMatch = textFields.some((value) =>
      value.toLowerCase().includes(searchTermLower)
    );
    if (plainMatch) {
      return true;
    }

    if (!hasNormalizedSearch) {
      return false;
    }

    const normalizedNicknameValue = normalizeNickname(player?.nickname ?? '', aliasMap);
    if (normalizedNicknameValue && normalizedNicknameValue === normalizedSearch) {
      return true;
    }

    return aliasList.some(
      (alias) => normalizeNickname(alias, aliasMap) === normalizedSearch
    );
  });

  leaderboardBody.innerHTML = '';

  if (filtered.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `<td colspan="10">Немає гравців за цим запитом</td>`;
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

    const seasonPointsLabel = formatNumberValue(player?.season_points ?? player?.totalPoints);
    const gamesLabel = formatNumberValue(player?.games);
    const winsLabel = formatNumberValue(player?.wins);
    const lossesLabel = formatNumberValue(player?.losses);
    const drawsLabel = formatNumberValue(player?.draws);
    const winRateLabel = formatPercentValue(player?.winRate, percentFormatter1);
    const roundsLabel = formatNumberValue(player?.rounds);
    const roundWinsLabel = formatNumberValue(player?.round_wins);
    const roundLossesLabel = formatNumberValue(player?.round_losses);
    const winStreakLabel = formatNumberValue(player?.win_streak);
    const lossStreakLabel = formatNumberValue(player?.loss_streak);
    const mvpLabel = formatNumberValue(player?.MVP);

    const gamesTooltipParts = [];
    if (winsLabel !== FALLBACK) {
      gamesTooltipParts.push(`Перемоги: ${winsLabel}`);
    }
    if (lossesLabel !== FALLBACK) {
      gamesTooltipParts.push(`Поразки: ${lossesLabel}`);
    }
    if (drawsLabel !== FALLBACK) {
      gamesTooltipParts.push(`Нічиї: ${drawsLabel}`);
    }
    const gamesTooltip = gamesTooltipParts.join(' · ');

    const roundsTooltipParts = [];
    if (roundWinsLabel !== FALLBACK) {
      roundsTooltipParts.push(`Перемоги: ${roundWinsLabel}`);
    }
    if (roundLossesLabel !== FALLBACK) {
      roundsTooltipParts.push(`Поразки: ${roundLossesLabel}`);
    }
    const roundsTooltip = roundsTooltipParts.join(' · ');

    const winRateTooltipParts = [];
    if (winStreakLabel !== FALLBACK) {
      winRateTooltipParts.push(`Стрік перемог: ${winStreakLabel}`);
    }
    if (lossStreakLabel !== FALLBACK) {
      winRateTooltipParts.push(`Стрік поразок: ${lossStreakLabel}`);
    }
    const winRateTooltip = winRateTooltipParts.join(' · ');

    const playerNickname = typeof player?.nickname === 'string' ? player.nickname : '';

    row.innerHTML = `
      <td><span class="rank-chip">${formatNumberValue(player?.rank)}</span></td>
      <td>
        <div>${player?.nickname ?? FALLBACK}</div>
        <small>${player?.realName ?? FALLBACK}</small>
        <button type="button" class="pixel-button" data-player="${playerNickname}">Профіль</button>
      </td>
      <td>${seasonPointsLabel}</td>
      <td>
        <span ${gamesTooltip ? `title="${gamesTooltip}"` : ''}>${gamesLabel}</span>
      </td>
      <td>${winsLabel}</td>
      <td>${lossesLabel}</td>
      <td>
        <span ${winRateTooltip ? `title="${winRateTooltip}"` : ''}>${winRateLabel}</span>
      </td>
      <td>
        <span ${roundsTooltip ? `title="${roundsTooltip}"` : ''}>${roundsLabel}</span>
      </td>
      <td>${mvpLabel}</td>
      <td>
        <span class="role-cell">
          ${badgeMarkup}
        </span>
      </td>
    `;

    const button = row.querySelector('button');
    button?.addEventListener('click', () => renderModal(player));
    leaderboardBody.append(row);
  });
}

function buildPlayerTimelineData(player, events, aliasMap = {}) {
  const empty = { delta: [], cumulative: [] };
  if (!player || !events) {
    return empty;
  }

  const candidateNames = new Set();
  const addCandidate = (value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        candidateNames.add(trimmed);
      }
    }
  };

  addCandidate(player?.nickname);
  addCandidate(player?.canonicalNickname);
  const aliases = Array.isArray(player?.aliases) ? player.aliases : [];
  aliases.forEach(addCandidate);

  if (candidateNames.size === 0) {
    return empty;
  }

  const normalizedCandidates = new Set();
  candidateNames.forEach((name) => {
    const normalized = normName(name, aliasMap);
    if (normalized) {
      normalizedCandidates.add(normalized);
    }
  });

  if (normalizedCandidates.size === 0) {
    return empty;
  }

  const pointsLog = Array.isArray(events?.pointsLog) ? events.pointsLog : [];
  const entries = pointsLog
    .map((entry, index) => {
      const normalizedPlayer = normName(entry?.player, aliasMap);
      if (!normalizedPlayer || !normalizedCandidates.has(normalizedPlayer)) {
        return null;
      }

      const dateRaw = typeof entry?.date === 'string' ? entry.date.trim() : '';
      const deltaValue = toFiniteNumber(entry?.delta);
      if (!dateRaw || deltaValue === null) {
        return null;
      }

      const timestamp = Date.parse(dateRaw);
      return {
        x: dateRaw,
        y: deltaValue,
        timestamp: Number.isFinite(timestamp) ? timestamp : null,
        order: index
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        if (a.timestamp === null) {
          return 1;
        }
        if (b.timestamp === null) {
          return -1;
        }
        return a.timestamp - b.timestamp;
      }
      return a.order - b.order;
    });

  if (entries.length === 0) {
    return empty;
  }

  const deltaSeries = entries.map(({ x, y }) => ({ x, y }));
  const cumulativeSeries = [];
  let runningTotal = 0;
  for (const point of entries) {
    runningTotal += point.y;
    cumulativeSeries.push({ x: point.x, y: runningTotal });
  }

  return { delta: deltaSeries, cumulative: cumulativeSeries };
}

function buildPlayerChart(dataset, mode = 'delta') {
  if (!dataset || typeof dataset !== 'object') {
    return '<p>ще немає змін очок за датами</p>';
  }

  const series = mode === 'cum' ? dataset.cumulative : dataset.delta;
  if (!Array.isArray(series) || series.length === 0) {
    return '<p>ще немає змін очок за датами</p>';
  }

  const values = series.map((point) => toFiniteNumber(point?.y) ?? 0);

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

  const description = series
    .map((point, index) => {
      const label = mode === 'cum' ? 'Сумарно' : 'Δ';
      return `${label} ${point.x}: ${formatNumberValue(values[index])}`;
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
      const name = typeof item?.name === 'string' && item.name.trim() ? item.name.trim() : FALLBACK;
      const countLabel = formatNumberValue(item?.count);

      if (type === 'teammates-most') {
        const detailText = countLabel !== FALLBACK ? `${countLabel} ігор` : FALLBACK;
        return `<li><strong>${name}</strong><span>${detailText}</span></li>`;
      }

      if (type === 'teammates-wins') {
        const detailText = countLabel !== FALLBACK ? `${countLabel} перемог` : FALLBACK;
        return `<li><strong>${name}</strong><span>${detailText}</span></li>`;
      }

      if (type === 'opponents-most') {
        const detailText = countLabel !== FALLBACK ? `${countLabel} дуелей` : FALLBACK;
        return `<li><strong>${name}</strong><span>${detailText}</span></li>`;
      }

      if (type === 'opponents-losses') {
        const detailText = countLabel !== FALLBACK ? `${countLabel} поразок` : FALLBACK;
        return `<li><strong>${name}</strong><span>${detailText}</span></li>`;
      }

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
  const gamesLabel = formatNumberValue(player?.games);
  const winsLabel = formatNumberValue(player?.wins);
  const lossesLabel = formatNumberValue(player?.losses);
  const winRateLabel = formatPercentValue(player?.winRate, percentFormatter1);
  const seasonPointsLabel = formatNumberValue(player?.season_points ?? player?.totalPoints);
  const mvpLabel = formatNumberValue(player?.MVP);
  const rankTier =
    typeof player?.rankTier === 'string' && player.rankTier.trim()
      ? player.rankTier
      : getRankTierByPlace(player?.rank);
  const winStreakLabel = formatNumberValue(player?.win_streak ?? player?.bestStreak);
  const lossStreakLabel = formatNumberValue(player?.loss_streak ?? player?.lossStreak);
  const roundsLabel = formatNumberValue(player?.rounds);
  const roundWinsLabel = formatNumberValue(player?.round_wins);
  const roundLossesLabel = formatNumberValue(player?.round_losses);
  const roundWinRateLabel = formatPercentValue(player?.roundWR, percentFormatter1);
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

  const timeline = buildPlayerTimelineData(player, EVENTS, PACK?.aliases ?? {});
  const hasTimeline = Array.isArray(timeline?.delta) && timeline.delta.length > 0;
  const defaultChartMode = 'cum';
  const chartControlsMarkup = hasTimeline
    ? `<div class="chart-mode-switch" role="radiogroup" aria-label="Режим графіка">
        <label><input type="radio" name="chart-mode" value="delta" /> Δ очки</label>
        <label><input type="radio" name="chart-mode" value="cum" checked /> Σ очки</label>
      </div>`
    : '';
  const chartMarkup = hasTimeline
    ? buildPlayerChart(timeline, defaultChartMode)
    : '<p>ще немає змін очок за датами</p>';

  modalBody.innerHTML = `
    <section>
      <h3>Основні показники</h3>
      <div class="detail-grid">
        <div>
          <strong>Ігор</strong>
          ${gamesLabel}
        </div>
        <div>
          <strong>Перемог</strong>
          ${winsLabel}
        </div>
        <div>
          <strong>Поразок</strong>
          ${lossesLabel}
        </div>
        <div>
          <strong>Win rate</strong>
          ${winRateLabel}
        </div>
        <div>
          <strong>Очок сезону</strong>
          ${seasonPointsLabel}
        </div>
        <div>
          <strong>Ранг</strong>
          ${rankTier ?? FALLBACK}
        </div>
        <div>
          <strong>Win стрик</strong>
          ${winStreakLabel !== FALLBACK ? `${winStreakLabel} перемог` : FALLBACK}
        </div>
        <div>
          <strong>Loss стрик</strong>
          ${lossStreakLabel !== FALLBACK ? `${lossStreakLabel} поразок` : FALLBACK}
        </div>
        <div>
          <strong>Раундів</strong>
          ${roundsLabel}
        </div>
        <div>
          <strong>Перемог у раундах</strong>
          ${roundWinsLabel}
        </div>
        <div>
          <strong>Поразок у раундах</strong>
          ${roundLossesLabel}
        </div>
        <div>
          <strong>WR раундів</strong>
          ${roundWinRateLabel}
        </div>
        <div>
          <strong>MVP</strong>
          ${mvpLabel}
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
      <div>
        <h4>Найчастіше разом</h4>
        ${renderPairList(player?.teammatesMost, 'teammates-most')}
      </div>
      <div>
        <h4>Перемог разом</h4>
        ${renderPairList(player?.teammatesMostWins, 'teammates-wins')}
      </div>
    </section>
    <section>
      <h3>Топ суперників</h3>
      <div>
        <h4>Найчастіші дуелі</h4>
        ${renderPairList(player?.opponentsMost, 'opponents-most')}
      </div>
      <div>
        <h4>Поразок від</h4>
        ${renderPairList(player?.opponentsMostLosses, 'opponents-losses')}
      </div>
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


function normalizeKey(key) {
  return typeof key === 'string'
    ? key
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9а-яіїєґё]+/giu, '')
    : '';
}


function parseCsvRows(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return [];
  }

  const rows = [];
  let current = [];
  let value = '';
  let inQuotes = false;

  const flush = () => {
    current.push(value);
    value = '';
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (current.length > 0 || value) {
        flush();
        rows.push(current);
        current = [];
      }
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      flush();
      continue;
    }

    value += char;
  }

  if (current.length > 0 || value) {
    flush();
    rows.push(current);
  }

  return rows.filter((row) => row.some((cell) => (cell ?? '').toString().trim()));
}

function buildPackFromCsv(text) {
  const rows = parseCsvRows(text);
  if (!rows.length) {
    return null;
  }

  const headers = rows[0];

  const normalizedHeaders = headers.map((key) => normalizeKey(key) || key.trim());

  const records = rows.slice(1).map((row) => {
    const record = {};
    row.forEach((value, index) => {
      const headerKey = headers[index] ?? `col_${index}`;

      record[headerKey] = value;

      const normalizedKey = normalizedHeaders[index] ?? headerKey;
      record[headerKey] = value;
      record[normalizedKey] = value;

    });
    return record;
  });


  const entries = records
    .map((record, index) => {
      const nickname = (record?.Nickname ?? '').toString().trim();

  const getValue = (record, keys) => {
    for (const key of keys) {
      const normalized = normalizeKey(key);
      for (const candidate of Object.keys(record)) {
        if (normalizeKey(candidate) === normalized) {
          return record[candidate];
        }
      }
    }
    return undefined;
  };

  const entries = records
    .map((record, index) => {
      const nickname = (getValue(record, ['nickname', 'player', 'нік', 'гравець']) ?? '')
        .toString()
        .trim();
if (!nickname) {
  return null;
}

// ===== ADMIN CHECK (single source of truth) =====
const adminValue = (getValue(record, ['admin', 'administrator', 'адмін', 'роль']) ?? '')
  .toString()
  .toLowerCase();

const isAdmin = ['admin', 'yes', 'true', 'адмін', 'адміністратор']
  .some(mark => adminValue.includes(mark));

// ===== BASIC STATS =====
const rankRaw = toFiniteNumber(record?.Rank ?? index + 1);
const games = toFiniteNumber(record?.Games);
const wins = toFiniteNumber(record?.Wins);
const losses = toFiniteNumber(record?.Losses);
const draws = toFiniteNumber(record?.Draws);
const seasonPoints = toFiniteNumber(record?.Points);

const rounds = toFiniteNumber(record?.Rounds);
const roundWins = toFiniteNumber(record?.['Round wins']);
const roundLosses = toFiniteNumber(record?.['Round losses']);

const winRate = toFiniteNumber(record?.WinRate);
const roundWR = toFiniteNumber(record?.['Round WR']);

const mvpCount = toFiniteNumber(record?.MVP);


      const adminValue = (getValue(record, ['admin', 'administrator', 'адмін', 'роль']) ?? '')
        .toString()
        .toLowerCase();
      const isAdmin = ['admin', 'yes', 'true', 'адмін', 'адміністратор'].some((mark) =>
        adminValue.includes(mark)
      );

      const rankRaw = toFiniteNumber(
        getValue(record, ['rank', 'place', '№', 'позиція']) ?? index + 1
      );
      const games = toFiniteNumber(getValue(record, ['games', 'матчів', 'игры', 'games_played']));
      const wins = toFiniteNumber(getValue(record, ['wins', 'перемоги', 'победы']));
      const losses = toFiniteNumber(getValue(record, ['losses', 'поразки', 'поражения']));
      const draws = toFiniteNumber(getValue(record, ['draws', 'нічії', 'ничьи']));
      const seasonPoints = toFiniteNumber(
        getValue(record, ['season_points', 'points', 'очків', 'очки', 'total_points'])
      );
      const rounds = toFiniteNumber(getValue(record, ['rounds', 'раунди', 'раунды']));
      const roundWins = toFiniteNumber(getValue(record, ['round_wins', 'виграні раунди']));
      const roundLosses = toFiniteNumber(getValue(record, ['round_losses', 'програні раунди']));
      const winRate = toFiniteNumber(getValue(record, ['winrate', 'wr', 'відсоток перемог']));
      const roundWR = toFiniteNumber(getValue(record, ['roundwr', 'round_wr']));
      const mvpCount = toFiniteNumber(getValue(record, ['mvp']));


      return {
        rank: rankRaw ?? index + 1,
        player: nickname,
        season_points: seasonPoints,
        games,
        wins,
        losses,
        draws,
        winRate,
        rounds,
        round_wins: roundWins,
        round_losses: roundLosses,
        roundWR,
        MVP: mvpCount,
        is_admin: isAdmin
      };
    })
    .filter(Boolean);

  const sortedEntries = entries
    .slice()
    .sort((a, b) => (toFiniteNumber(b.season_points) ?? 0) - (toFiniteNumber(a.season_points) ?? 0))
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

  const top10 = sortedEntries.filter((entry) => !entry.is_admin).slice(0, 10);

  const aggregates = {
    players_with_games: entries.length || null,
    players_in_rating: entries.length || null,
    points_total: entries.reduce((sum, entry) => sum + (toFiniteNumber(entry.season_points) ?? 0), 0)
  };

  return {
    meta: { season: 'Осінній сезон 2025', league: 'Sunday League' },
    aggregates,
    top10,
    aliases: {}
  };
}

async function fetchSeasonPack(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  if (!response.ok) {
    throw new Error(`Не вдалося завантажити ${url}: ${response.status}`);
  }

  const text = await response.text();

  const pack = buildPackFromCsv(text);
  if (!pack) {
    throw new Error(`Невідомий формат даних за адресою ${url}`);
  }
  return pack;
}


  try {
    return JSON.parse(text);
  } catch (error) {
    const pack = buildPackFromCsv(text);
    if (!pack) {
      throw new Error(`Невідомий формат даних за адресою ${url}`);
    }
    return pack;
  }
}


function resolveSeasonAsset(pathname) {
  if (typeof pathname !== 'string' || !pathname) {
    return pathname;
  }

  if (typeof window !== 'undefined') {
    const directoryHref = (() => {
      if (typeof document !== 'undefined' && document.baseURI) {
        try {
          return new URL('.', document.baseURI).href;
        } catch (error) {
          console.warn('[autumn2025] failed to resolve document.baseURI', error);
        }
      }

      const { origin, pathname: currentPath } = window.location ?? {};
      if (origin) {
        try {
          const base = currentPath ? `${origin}${currentPath}` : origin;
          return new URL('.', base).href;
        } catch (error) {
          console.warn('[autumn2025] failed to resolve window.location', error);
          return `${origin}/`;
        }
      }

      return undefined;
    })();

    if (directoryHref) {
      try {
        return new URL(pathname, directoryHref).href;
      } catch (error) {
        console.warn('[autumn2025] failed to resolve asset URL', pathname, error);
      }
    }
  }

  return pathname;
}

async function boot() {
  try {

    const packData = await fetchSeasonPack(
      resolveSeasonAsset('https://laser-proxy.vartaclub.workers.dev/?league=ocinb2025')
    );
    PACK = packData;
    EVENTS = [];


    const packPromise = fetchSeasonPack(
      resolveSeasonAsset(
        'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=234914774&single=true&output=csv'
      )
    );
    const eventsPromise = fetchJSON(
      resolveSeasonAsset('https://laser-proxy.vartaclub.workers.dev/events?tab=ocinb2025')
    ).catch((error) => {
      console.warn('[autumn2025] events load failed, continuing without events', error);
      return [];
    });


    const [packData, eventsData] = await Promise.all([
      fetchJSON(resolveSeasonAsset('https://laser-proxy.vartaclub.workers.dev/json?tab=ocinb2025')),
      fetchJSON(resolveSeasonAsset('https://laser-proxy.vartaclub.workers.dev/events?tab=ocinb2025'))
    ]);

    PACK = packData;
    EVENTS = eventsData;

    topPlayers = normalizeTopPlayers(PACK?.top10 ?? [], PACK?.meta ?? {}, PACK?.aliases ?? {});
    renderMetricsFromAggregates(PACK?.aggregates ?? {}, topPlayers);
    renderPodium(topPlayers);
    renderLeaderboard(topPlayers);
    bindTableControls();
    bindProfile();
  } catch (error) {
    console.error('[autumn2025] boot failed', error);
    if (metricsGrid) {
      metricsGrid.innerHTML = '<p class="error">Не вдалося завантажити дані сезону.</p>';
    }
  }
}

boot();
