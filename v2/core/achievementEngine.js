const TIER_LEVELS = [
  { key: 'bronze', label: 'Бронза', score: 10 },
  { key: 'silver', label: 'Срібло', score: 20 },
  { key: 'gold', label: 'Золото', score: 35 },
  { key: 'platinum', label: 'Платина', score: 55 },
  { key: 'diamond', label: 'Діамант', score: 80 },
  { key: 'legendary', label: 'Легенда', score: 120 }
];

const TIER_ORDER = Object.fromEntries(TIER_LEVELS.map((tier, index) => [tier.key, index + 1]));
const RANK_ORDER = { F: 0, E: 1, D: 2, C: 3, B: 4, A: 5, S: 6 };

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstNumber(source = {}, keys = [], fallback = 0) {
  for (const key of keys) {
    const value = Number(source?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

function clamp(value) {
  return Math.max(0, Math.min(1, number(value)));
}

function countLabel(value, forms) {
  const count = Math.max(0, Math.ceil(number(value)));
  if (!Array.isArray(forms) || forms.length < 3) return `${count}`;
  const lastTwo = count % 100;
  const last = count % 10;
  const form = lastTwo >= 11 && lastTwo <= 14
    ? forms[2]
    : last === 1
      ? forms[0]
      : last >= 2 && last <= 4
        ? forms[1]
        : forms[2];
  return `${count} ${form}`;
}

function seasonPlace(season = {}) {
  return firstNumber(season, ['place', 'finalPlace'], Number.POSITIVE_INFINITY);
}

function seasonDelta(season = {}) {
  return firstNumber(season, ['delta', 'ratingDelta'], Number.NEGATIVE_INFINITY);
}

function normalizeStats(allTime = {}, seasons = [], context = {}) {
  const safeSeasons = Array.isArray(seasons) ? seasons.filter((season) => season && typeof season === 'object') : [];
  const games = Math.max(0, firstNumber(allTime, ['games', 'matches', 'totalMatches']));
  const recordedWins = Math.max(0, firstNumber(allTime, ['wins', 'totalWins']));
  const mvp1 = Math.max(0, firstNumber(allTime, ['top1', 'mvp1']));
  const mvp2 = Math.max(0, firstNumber(allTime, ['top2', 'mvp2']));
  const mvp3 = Math.max(0, firstNumber(allTime, ['top3', 'mvp3']));
  const mvpTotal = Math.max(0, firstNumber(allTime, ['mvpTotal', 'totalMvp'], mvp1 + mvp2 + mvp3));
  const seasonOutcomes = safeSeasons.reduce((acc, season) => {
    const seasonGames = firstNumber(season, ['games', 'matches']);
    const seasonWins = firstNumber(season, ['wins']);
    const seasonWinRate = firstNumber(season, ['winRate', 'winrate'], Number.NaN);
    if (seasonGames <= 0 || !Number.isFinite(seasonWinRate)) return acc;
    acc.games += seasonGames;
    acc.weightedRate += seasonWinRate * seasonGames;
    acc.wins += seasonWins > 0 ? seasonWins : Math.round((seasonGames * seasonWinRate) / 100);
    return acc;
  }, { games: 0, wins: 0, weightedRate: 0 });
  const wins = Math.max(recordedWins, seasonOutcomes.wins);
  const winRate = seasonOutcomes.games > 0
    ? seasonOutcomes.weightedRate / seasonOutcomes.games
    : firstNumber(allTime, ['winrate', 'winRate', 'careerWR'], games ? (wins / games) * 100 : 0);
  const longestStreakRaw = Number(context.longestStreak ?? allTime.longestStreak);

  return {
    games,
    wins,
    mvp1,
    mvp2,
    mvp3,
    mvpTotal,
    winRate: Math.max(0, winRate),
    seasonsPlayed: Math.max(firstNumber(allTime, ['seasonsPlayed']), safeSeasons.length),
    podiums: safeSeasons.filter((season) => seasonPlace(season) <= 3).length,
    titles: safeSeasons.filter((season) => seasonPlace(season) === 1).length,
    bestDelta: Math.max(0, ...safeSeasons.map(seasonDelta).filter(Number.isFinite)),
    bestRank: String(allTime.bestRank || allTime.highestRank || 'F').trim().toUpperCase(),
    longestStreak: Number.isFinite(longestStreakRaw) ? Math.max(0, longestStreakRaw) : null
  };
}

function cumulativeScore(levelIndex) {
  return TIER_LEVELS.slice(0, levelIndex + 1).reduce((sum, tier) => sum + tier.score, 0);
}

function currentLevelIndex(value, thresholds) {
  let found = -1;
  thresholds.forEach((threshold, index) => {
    if (value >= threshold) found = index;
  });
  return found;
}

function numericFamily({ id, title, prefix, metric, thresholds, forms }) {
  return {
    id,
    title,
    evaluate(stats) {
      const current = stats[metric];
      if (!Number.isFinite(current)) return { available: false };
      const levelIndex = currentLevelIndex(current, thresholds);
      const tier = levelIndex >= 0 ? TIER_LEVELS[levelIndex] : null;
      const achievedThreshold = levelIndex >= 0 ? thresholds[levelIndex] : 0;
      const nextIndex = levelIndex + 1;
      const nextTier = TIER_LEVELS[nextIndex] || null;
      const nextTarget = thresholds[nextIndex];
      const unlocked = levelIndex >= 0 ? {
        id,
        familyId: id,
        title,
        mark: `${prefix}${achievedThreshold}`,
        tier: tier.key,
        tierLabel: tier.label,
        level: levelIndex + 1,
        maxLevel: thresholds.length,
        score: cumulativeScore(levelIndex),
        detail: countLabel(current, forms)
      } : null;
      const next = nextTier && Number.isFinite(nextTarget) ? {
        id: `${id}-level-${nextIndex + 1}`,
        familyId: id,
        title,
        mark: `${prefix}${nextTarget}`,
        tier: nextTier.key,
        tierLabel: nextTier.label,
        level: nextIndex + 1,
        maxLevel: thresholds.length,
        score: nextTier.score,
        current,
        target: nextTarget,
        progress: clamp((current - achievedThreshold) / Math.max(1, nextTarget - achievedThreshold)),
        detail: `${Math.floor(current)} / ${nextTarget}`,
        remainingLabel: `Ще ${countLabel(nextTarget - current, forms)}`
      } : null;
      return { available: true, unlocked, next };
    }
  };
}

function stabilityFamily() {
  const requirements = [
    { games: 50, winRate: 50 },
    { games: 100, winRate: 52.5 },
    { games: 200, winRate: 55 },
    { games: 300, winRate: 57.5 },
    { games: 500, winRate: 60 },
    { games: 700, winRate: 65 }
  ];
  return {
    id: 'stability',
    title: 'Стабільний результат',
    evaluate(stats) {
      let levelIndex = -1;
      requirements.forEach((requirement, index) => {
        if (stats.games >= requirement.games && stats.winRate >= requirement.winRate) levelIndex = index;
      });
      const tier = levelIndex >= 0 ? TIER_LEVELS[levelIndex] : null;
      const currentRequirement = levelIndex >= 0 ? requirements[levelIndex] : { games: 0, winRate: 0 };
      const nextIndex = levelIndex + 1;
      const nextTier = TIER_LEVELS[nextIndex] || null;
      const nextRequirement = requirements[nextIndex];
      const unlocked = tier ? {
        id: 'stability',
        familyId: 'stability',
        title: 'Стабільний результат',
        mark: `${Math.round(currentRequirement.winRate)}%`,
        tier: tier.key,
        tierLabel: tier.label,
        level: levelIndex + 1,
        maxLevel: requirements.length,
        score: cumulativeScore(levelIndex),
        detail: `${stats.winRate.toFixed(1)}% WR · ${stats.games} ігор`
      } : null;
      let next = null;
      if (nextTier && nextRequirement) {
        const gamesProgress = (stats.games - currentRequirement.games) / Math.max(1, nextRequirement.games - currentRequirement.games);
        const rateProgress = (stats.winRate - currentRequirement.winRate) / Math.max(.1, nextRequirement.winRate - currentRequirement.winRate);
        const missingGames = Math.max(0, nextRequirement.games - stats.games);
        const missingRate = Math.max(0, nextRequirement.winRate - stats.winRate);
        const missing = [
          missingGames > 0 ? countLabel(missingGames, ['гра', 'гри', 'ігор']) : '',
          missingRate > 0 ? `${missingRate.toFixed(1)} п.п. WR` : ''
        ].filter(Boolean).join(' і ');
        next = {
          id: `stability-level-${nextIndex + 1}`,
          familyId: 'stability',
          title: 'Стабільний результат',
          mark: `${nextRequirement.winRate}%`,
          tier: nextTier.key,
          tierLabel: nextTier.label,
          level: nextIndex + 1,
          maxLevel: requirements.length,
          score: nextTier.score,
          current: stats.winRate,
          target: nextRequirement.winRate,
          progress: clamp(Math.min(gamesProgress, rateProgress)),
          detail: `${stats.winRate.toFixed(1)}% WR · ${stats.games}/${nextRequirement.games} ігор`,
          remainingLabel: missing ? `Ще ${missing}` : 'Умови виконано'
        };
      }
      return { available: true, unlocked, next };
    }
  };
}

function rankFamily() {
  const levels = [
    { rank: 'C', tier: TIER_LEVELS[0] },
    { rank: 'B', tier: TIER_LEVELS[1] },
    { rank: 'A', tier: TIER_LEVELS[2] },
    { rank: 'S', tier: TIER_LEVELS[5] }
  ];
  return {
    id: 'career-rank',
    title: 'Карʼєрний ранг',
    evaluate(stats) {
      const rankValue = RANK_ORDER[stats.bestRank] ?? 0;
      let levelIndex = -1;
      levels.forEach((level, index) => {
        if (rankValue >= RANK_ORDER[level.rank]) levelIndex = index;
      });
      const currentLevel = levelIndex >= 0 ? levels[levelIndex] : null;
      const nextLevel = levels[levelIndex + 1] || null;
      return {
        available: true,
        unlocked: currentLevel ? {
          id: 'career-rank',
          familyId: 'career-rank',
          title: 'Карʼєрний ранг',
          mark: currentLevel.rank,
          tier: currentLevel.tier.key,
          tierLabel: currentLevel.tier.label,
          level: levelIndex + 1,
          maxLevel: levels.length,
          score: levels.slice(0, levelIndex + 1).reduce((sum, level) => sum + level.tier.score, 0),
          detail: `Найвищий ранг: ${stats.bestRank}`
        } : null,
        next: nextLevel ? {
          id: `career-rank-${nextLevel.rank}`,
          familyId: 'career-rank',
          title: 'Карʼєрний ранг',
          mark: nextLevel.rank,
          tier: nextLevel.tier.key,
          tierLabel: nextLevel.tier.label,
          level: levelIndex + 2,
          maxLevel: levels.length,
          score: nextLevel.tier.score,
          current: rankValue,
          target: RANK_ORDER[nextLevel.rank],
          progress: clamp(rankValue / RANK_ORDER[nextLevel.rank]),
          detail: `Поточний максимум: ${stats.bestRank}`,
          remainingLabel: `До рангу ${nextLevel.rank}`
        } : null
      };
    }
  };
}

function allRounderFamily() {
  return {
    id: 'all-rounder',
    title: 'Універсал MVP',
    evaluate(stats) {
      const current = [stats.mvp1, stats.mvp2, stats.mvp3].filter((value) => value > 0).length;
      const unlocked = current === 3;
      return {
        available: true,
        unlocked: unlocked ? {
          id: 'all-rounder',
          familyId: 'all-rounder',
          title: 'Універсал MVP',
          mark: 'III',
          tier: 'gold',
          tierLabel: 'Особлива',
          level: 1,
          maxLevel: 1,
          score: 35,
          detail: 'Усі три позиції MVP'
        } : null,
        next: !unlocked ? {
          id: 'all-rounder-special',
          familyId: 'all-rounder',
          title: 'Універсал MVP',
          mark: 'III',
          tier: 'gold',
          tierLabel: 'Особлива',
          level: 1,
          maxLevel: 1,
          score: 35,
          current,
          target: 3,
          progress: current / 3,
          detail: `${current} / 3 позиції MVP`,
          remainingLabel: `Ще ${3 - current} ${3 - current === 1 ? 'позиція' : 'позиції'} MVP`
        } : null
      };
    }
  };
}

export const ACHIEVEMENT_DEFINITIONS = [
  numericFamily({ id: 'games', title: 'Ветеран арени', prefix: 'G', metric: 'games', thresholds: [100, 200, 300, 500, 700, 1000], forms: ['гра', 'гри', 'ігор'] }),
  numericFamily({ id: 'wins', title: 'Шлях переможця', prefix: 'W', metric: 'wins', thresholds: [25, 50, 100, 150, 200, 300], forms: ['перемога', 'перемоги', 'перемог'] }),
  numericFamily({ id: 'mvp', title: 'Майстер впливу', prefix: 'M', metric: 'mvpTotal', thresholds: [10, 25, 50, 100, 150, 250], forms: ['MVP', 'MVP', 'MVP'] }),
  numericFamily({ id: 'win-streak', title: 'Переможна серія', prefix: 'S', metric: 'longestStreak', thresholds: [3, 5, 7, 10, 15, 20], forms: ['перемога поспіль', 'перемоги поспіль', 'перемог поспіль'] }),
  numericFamily({ id: 'seasons', title: 'Досвід сезонів', prefix: 'Y', metric: 'seasonsPlayed', thresholds: [1, 2, 3, 5, 7, 10], forms: ['сезон', 'сезони', 'сезонів'] }),
  numericFamily({ id: 'podiums', title: 'На пʼєдесталі', prefix: 'P', metric: 'podiums', thresholds: [1, 2, 3, 5, 7, 10], forms: ['пʼєдестал', 'пʼєдестали', 'пʼєдесталів'] }),
  numericFamily({ id: 'titles', title: 'Чемпіон сезонів', prefix: 'C', metric: 'titles', thresholds: [1, 2, 3, 5, 7, 10], forms: ['чемпіонство', 'чемпіонства', 'чемпіонств'] }),
  numericFamily({ id: 'growth', title: 'Ривок сезону', prefix: '+', metric: 'bestDelta', thresholds: [100, 200, 300, 500, 700, 1000], forms: ['очко приросту', 'очки приросту', 'очок приросту'] }),
  stabilityFamily(),
  rankFamily(),
  allRounderFamily()
];

export function buildAchievementProfile({ allTime = {}, seasons = [], longestStreak } = {}) {
  const stats = normalizeStats(allTime, seasons, { longestStreak });
  const evaluated = ACHIEVEMENT_DEFINITIONS.map((definition) => definition.evaluate(stats)).filter((result) => result.available !== false);
  const unlocked = evaluated
    .map((result) => result.unlocked)
    .filter(Boolean)
    .sort((a, b) => (TIER_ORDER[b.tier] || 0) - (TIER_ORDER[a.tier] || 0) || b.level - a.level || a.title.localeCompare(b.title, 'uk'));
  const inProgress = evaluated
    .map((result) => result.next)
    .filter(Boolean)
    .sort((a, b) => b.progress - a.progress || (TIER_ORDER[b.tier] || 0) - (TIER_ORDER[a.tier] || 0))
    .slice(0, 4);

  return {
    unlocked,
    inProgress,
    score: unlocked.reduce((sum, achievement) => sum + achievement.score, 0),
    unlockedCount: unlocked.length,
    totalCount: evaluated.length,
    classCount: TIER_LEVELS.length
  };
}

export { TIER_LEVELS };
