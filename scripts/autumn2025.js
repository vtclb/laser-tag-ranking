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

const ADULT_LEAGUE_ALIASES = [
  'adult',
  'olds',
  'old',
  'sundaygames',
  'sunday',
  'дорос',
  'старш'
];

const KIDS_LEAGUE_ALIASES = ['kids', 'kid', 'children', 'junior', 'youth', 'дит', 'молод'];

function normalizeLeagueName(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const lookup = trimmed.toLowerCase();
  if (KIDS_LEAGUE_ALIASES.some((token) => lookup.includes(token))) {
    return 'kids';
  }
  if (ADULT_LEAGUE_ALIASES.some((token) => lookup.includes(token))) {
    return 'adult';
  }
  return lookup;
}

function resolvePlayerLeague(entry, fallback) {
  const leagueFields = ['league', 'League', 'leagueName', 'league_name'];
  for (const field of leagueFields) {
    const value = typeof entry?.[field] === 'string' ? entry[field].trim() : '';
    if (value) {
      return value;
    }
  }
  return typeof fallback === 'string' && fallback.trim() ? fallback.trim() : '';
}

function getLeagueLabel(value) {
  const normalized = normalizeLeagueName(value);
  if (normalized === 'kids') {
    return 'Дитяча ліга';
  }
  if (normalized === 'adult') {
    return 'Доросла ліга';
  }
  return value || FALLBACK;
}

function isAdminPlayer(entry, aliasMap = {}) {
  if (!entry) {
    return false;
  }
  const adminFlag = entry?.is_admin === true || entry?.isAdmin === true;
  if (adminFlag) {
    return true;
  }
  const normalizedName = normalizeNickname(entry?.player ?? entry?.nickname ?? '', aliasMap);
  return normalizedName ? ADMIN_BLOCKLIST.has(normalizedName) : false;
}

function mergePlayerRecords(allPlayers = [], topList = [], aliasMap = {}) {
  const detailedIndex = new Map();
  topList.forEach((entry) => {
    const normalized = normalizeNickname(entry?.player, aliasMap);
    if (normalized) {
      detailedIndex.set(normalized, entry);
    }
  });

  const merged = allPlayers.map((entry) => {
    const normalized = normalizeNickname(entry?.player, aliasMap);
    const detailed = normalized ? detailedIndex.get(normalized) : null;
    return detailed ? { ...detailed, ...entry } : entry;
  });

  detailedIndex.forEach((entry, normalized) => {
    const alreadyExists = merged.some((player) => normalizeNickname(player?.player, aliasMap) === normalized);
    if (!alreadyExists) {
      merged.push(entry);
    }
  });

  return merged;
}

function buildLeagueOptions(players = [], fallbackLeague) {
  const unique = new Set();
  players.forEach((player) => {
    const leagueName = resolvePlayerLeague(player, fallbackLeague);
    const normalized = normalizeLeagueName(leagueName);
    if (normalized) {
      unique.add(normalized);
    }
  });

  const buttonTargets = leagueButtons
    .map((button) => button.dataset.leagueTarget || button.dataset.leagueValue)
    .filter(Boolean)
    .map((value) => normalizeLeagueName(value))
    .filter(Boolean);

  buttonTargets.forEach((target) => unique.add(target));

  const normalizedFallback = normalizeLeagueName(fallbackLeague);
  if (normalizedFallback) {
    unique.add(normalizedFallback);
  }

  const priority = ['kids', 'adult'];
  return Array.from(unique.values()).sort((a, b) => priority.indexOf(a) - priority.indexOf(b));
}

function sortPlayersForLeaderboard(a, b) {
  const rankA = toFiniteNumber(a?.rank);
  const rankB = toFiniteNumber(b?.rank);
  if (rankA !== null && rankB !== null && rankA !== rankB) {
    return rankA - rankB;
  }

  const pointsA = toFiniteNumber(a?.season_points ?? a?.totalPoints);
  const pointsB = toFiniteNumber(b?.season_points ?? b?.totalPoints);
  if (pointsA !== null && pointsB !== null && pointsA !== pointsB) {
    return pointsB - pointsA;
  }

  const winRateA = toFiniteNumber(a?.winRate);
  const winRateB = toFiniteNumber(b?.winRate);
  if (winRateA !== null && winRateB !== null && winRateA !== winRateB) {
    return winRateB - winRateA;
  }

  const gamesA = toFiniteNumber(a?.games);
  const gamesB = toFiniteNumber(b?.games);
  if (gamesA !== null && gamesB !== null && gamesA !== gamesB) {
    return gamesB - gamesA;
  }

  const nameA = normalizeNickname(a?.nickname ?? a?.player ?? '', PACK?.aliases ?? {});
  const nameB = normalizeNickname(b?.nickname ?? b?.player ?? '', PACK?.aliases ?? {});
  return nameA.localeCompare(nameB);
}

function buildProfileLookup(players = [], aliasMap = {}) {
  const map = new Map();
  players.forEach((player) => {
    const variants = getNicknameVariants(player?.nickname ?? player?.player ?? '', aliasMap);
    variants.forEach((variant) => {
      const normalized = normalizeNickname(variant, aliasMap);
      if (normalized) {
        map.set(normalized, player);
      }
    });
  });
  return map;
}

function findProfilePlayer(nickname) {
  const aliasMap = PACK?.aliases ?? {};
  const normalized = normalizeNickname(nickname, aliasMap);
  if (!normalized) {
    return null;
  }

  if (profileLookupCurrent.has(normalized)) {
    return profileLookupCurrent.get(normalized);
  }

  if (profileLookupAll.has(normalized)) {
    return profileLookupAll.get(normalized);
  }

  if (profileLookupTop.has(normalized)) {
    return profileLookupTop.get(normalized);
  }

  return null;
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
const leagueButtons = Array.from(document.querySelectorAll('[data-league-target]'));
const modal = document.getElementById('player-modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const closeButton = modal?.querySelector('[data-close]');

const TOP_LIMIT = 10;
const ADMIN_BLOCKLIST = new Set(['pantazi_ko']);

let currentSort = 'rank';
let currentDirection = 'asc';
let PACK = null;
let EVENTS = null;
let topPlayers = [];
let allPlayersNormalized = [];

let topPlayersNormalized = [];
let profileLookupAll = new Map();
let profileLookupTop = new Map();
let profileLookupCurrent = new Map();

let leagueOptions = [];
let currentLeague = '';
let currentLeaguePlayers = [];
let seasonTickerMessages = [];
let metricsSnapshot = null;
let tickerTimer = null;
let controlsBound = false;
let profileBound = false;
let leagueBound = false;

function normalizeTopPlayers(top10 = [], meta = {}, aliasMap = {}) {
  return top10.map((entry, index) => {
    const nameField =
      (typeof entry?.player === 'string' && entry.player.trim() && entry.player.trim()) ||
      (typeof entry?.nickname === 'string' && entry.nickname.trim() && entry.nickname.trim()) ||
      (typeof entry?.name === 'string' && entry.name.trim() && entry.name.trim()) ||
      '';
    const nickname = nameField || FALLBACK;
    const canonicalNickname = nameField ? resolveCanonicalNickname(nameField, aliasMap) : '';
    const nicknameAliases = nameField ? getNicknameVariants(nameField, aliasMap) : [];
    const normalizedNickname = nameField ? normalizeNickname(nameField, aliasMap) : '';
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

    const playerLeague = resolvePlayerLeague(entry, meta.league);
    const leagueKey = normalizeLeagueName(playerLeague || meta.league);
    const leagueName = getLeagueLabel(playerLeague || meta.league || FALLBACK);

    return {
      rank,
      nickname,
      canonicalNickname: canonicalNickname || nickname,
      normalizedNickname,
      aliases: nicknameAliases,
      realName: FALLBACK,
      team: leagueName,
      leagueKey,
      isAdmin: isAdminPlayer(entry, aliasMap),
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
  const sourcePlayers = searchTerm ? currentLeaguePlayers : players;
  const rowsSource = Array.isArray(sourcePlayers) ? sourcePlayers : [];
  const sorted = [...rowsSource].sort((a, b) => {
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

  const filtered = rowsSource.filter((player) => {
    if (!searchTerm) {
      return sorted.includes(player);
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

    const displayName =
      (typeof player?.nickname === 'string' && player.nickname.trim()) ||
      (typeof player?.canonicalNickname === 'string' && player.canonicalNickname.trim()) ||
      FALLBACK;
    const playerNickname = displayName !== FALLBACK ? displayName : '';

    row.innerHTML = `
      <td><span class="rank-chip">${formatNumberValue(player?.rank)}</span></td>
      <td>
        <div>${displayName}</div>
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
    button?.addEventListener('click', () => {
      const profile = findProfilePlayer(playerNickname) ?? player;
      renderModal(profile);
    });
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

function updateLeagueButtons(activeValue = currentLeague) {
  if (!leagueButtons || leagueButtons.length === 0) {
    return;
  }

  const normalizedActive = normalizeLeagueName(activeValue);
  leagueButtons.forEach((button) => {
    const targetValue = normalizeLeagueName(
      button.dataset.leagueTarget || button.dataset.leagueValue
    );
    const isAvailable = targetValue && leagueOptions.includes(targetValue);

    button.disabled = !isAvailable;
    button.dataset.leagueValue = targetValue;
    button.textContent = getLeagueLabel(targetValue);
    const isActive = isAvailable && targetValue === normalizedActive;
    button.setAttribute('aria-pressed', String(isActive));
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

function getEffectiveLeague(targetLeague) {
  if (!Array.isArray(leagueOptions) || leagueOptions.length === 0) {
    return targetLeague ?? '';
  }

  const normalizedTarget = normalizeLeagueName(targetLeague);
  if (normalizedTarget && leagueOptions.includes(normalizedTarget)) {
    return normalizedTarget;
  }

  return leagueOptions[0] ?? normalizedTarget ?? targetLeague ?? '';
}

function filterPlayersByLeague(players = [], leagueValue, fallbackLeague) {
  const normalizedTarget =
    normalizeLeagueName(leagueValue) || normalizeLeagueName(fallbackLeague);
  if (!normalizedTarget) {
    return players;
  }

  return players.filter((player) => {
    const leagueName =
      (typeof player?.team === 'string' && player.team.trim() ? player.team : '') ||
      resolvePlayerLeague(player, fallbackLeague);
    const normalizedLeague = normalizeLeagueName(leagueName);
    return normalizedLeague === normalizedTarget;
  });
}

function refreshLeagueData(targetLeague = currentLeague) {
  const aliasMap = PACK?.aliases ?? {};
  const fallbackLeague = PACK?.meta?.league;
  const effectiveLeague = getEffectiveLeague(targetLeague || fallbackLeague);
  currentLeague = effectiveLeague;

  const normalizedTarget = normalizeLeagueName(effectiveLeague || fallbackLeague);
  const leagueLabel = getLeagueLabel(normalizedTarget || fallbackLeague || FALLBACK);

  const basePlayers = allPlayersNormalized.map((player) => {
    const leagueKey = normalizeLeagueName(player?.leagueKey || fallbackLeague);
    return { ...player, leagueKey: leagueKey || normalizedTarget || '' };
  });

  const filteredPlayers = basePlayers.filter((player) => {
    const leagueKey = normalizeLeagueName(player?.leagueKey || fallbackLeague);
    return normalizedTarget ? leagueKey === normalizedTarget : true;
  });

  const sortedByPoints = filteredPlayers
    .slice()
    .sort((a, b) => (toFiniteNumber(b?.season_points) ?? 0) - (toFiniteNumber(a?.season_points) ?? 0));

  const rankedNonAdmins = sortedByPoints
    .filter((entry) => !entry?.isAdmin)
    .map((entry, idx) => ({ ...entry, rank: idx + 1, team: leagueLabel }));

  const rankIndex = new Map();
  rankedNonAdmins.forEach((player) => {
    const normalizedNickname = normalizeNickname(player?.nickname ?? player?.player ?? '', aliasMap);
    if (normalizedNickname) {
      rankIndex.set(normalizedNickname, player.rank);
    }
  });

  currentLeaguePlayers = sortedByPoints.map((player) => {
    const normalizedNickname = normalizeNickname(player?.nickname ?? player?.player ?? '', aliasMap);
    const rank = normalizedNickname ? rankIndex.get(normalizedNickname) ?? null : null;
    return { ...player, rank, team: leagueLabel };
  });

  topPlayers = rankedNonAdmins.slice(0, TOP_LIMIT);
  profileLookupCurrent = buildProfileLookup(currentLeaguePlayers, aliasMap);

  renderMetricsFromAggregates(PACK?.aggregates ?? {}, rankedNonAdmins);
  renderPodium(topPlayers);
  renderLeaderboard();
  updateLeagueButtons(currentLeague);
}

function bindLeagueSwitch() {
  if (leagueBound) {
    return;
  }
  leagueBound = true;

  leagueButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetLeague = button.dataset.leagueValue || button.dataset.leagueTarget || '';
      const effectiveLeague = getEffectiveLeague(targetLeague);
      if (!effectiveLeague) {
        return;
      }

      if (normalizeLeagueName(effectiveLeague) === normalizeLeagueName(currentLeague)) {
        return;
      }

      refreshLeagueData(effectiveLeague);
    });
  });
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



// ===== FETCHERS (single source of truth) =====
async function fetchJSON(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  if (!response.ok) {
    throw new Error(`Не вдалося завантажити ${url}: ${response.status}`);
  }
  return response.json();
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

// ===== BOOT (single source of truth) =====
async function boot() {
  try {
    const [packData, eventsData] = await Promise.all([
      fetchJSON(resolveSeasonAsset('ocinb2025_pack.json')),
      fetchJSON(resolveSeasonAsset('sunday_autumn_2025_EVENTS.json'))
    ]);

    PACK = packData;
    EVENTS = eventsData;

    const aliasMap = PACK?.aliases ?? {};

    const baseAllPlayers = Array.isArray(PACK?.allPlayers) ? PACK.allPlayers : [];
    const baseTopPlayers = Array.isArray(PACK?.top10) ? PACK.top10 : [];
    const mergedPlayers = mergePlayerRecords(baseAllPlayers, baseTopPlayers, aliasMap);

    allPlayersNormalized = normalizeTopPlayers(mergedPlayers, PACK?.meta ?? {}, aliasMap);
    topPlayersNormalized = normalizeTopPlayers(baseTopPlayers, PACK?.meta ?? {}, aliasMap);
    profileLookupAll = buildProfileLookup(allPlayersNormalized, aliasMap);
    profileLookupTop = buildProfileLookup(topPlayersNormalized, aliasMap);
    leagueOptions = buildLeagueOptions(mergedPlayers, PACK?.meta?.league);
    currentLeague =
      getEffectiveLeague(PACK?.meta?.league ?? leagueOptions[0] ?? '') || 'adult';

    updateLeagueButtons(currentLeague);
    refreshLeagueData(currentLeague);

    bindLeagueSwitch();
    bindTableControls();
    bindProfile();
  } catch (error) {
    console.error('[autumn2025] boot failed', error);
    if (metricsGrid) {
      metricsGrid.innerHTML =
        '<p class="error">Не вдалося завантажити дані осіннього сезону.</p>';
    }
  }
}

boot();



