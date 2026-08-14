const TIER_SCORE = {
  bronze: 10,
  silver: 25,
  gold: 50,
  elite: 100
};

const TIER_ORDER = { elite: 4, gold: 3, silver: 2, bronze: 1 };
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

function normalizeStats(allTime = {}, seasons = []) {
  const safeSeasons = Array.isArray(seasons) ? seasons.filter((season) => season && typeof season === 'object') : [];
  const games = firstNumber(allTime, ['games', 'matches', 'totalMatches']);
  const recordedWins = firstNumber(allTime, ['wins', 'totalWins']);
  const mvp1 = firstNumber(allTime, ['top1', 'mvp1']);
  const mvp2 = firstNumber(allTime, ['top2', 'mvp2']);
  const mvp3 = firstNumber(allTime, ['top3', 'mvp3']);
  const mvpTotal = firstNumber(allTime, ['mvpTotal', 'totalMvp'], mvp1 + mvp2 + mvp3);
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
  const bestRank = String(allTime.bestRank || allTime.highestRank || 'F').trim().toUpperCase();

  return {
    games: Math.max(0, games),
    wins: Math.max(0, wins),
    mvp1: Math.max(0, mvp1),
    mvp2: Math.max(0, mvp2),
    mvp3: Math.max(0, mvp3),
    mvpTotal: Math.max(0, mvpTotal),
    winRate: Math.max(0, winRate),
    bestRank,
    seasons: safeSeasons
  };
}

function milestone({ id, title, mark, tier, metric, target, forms }) {
  return {
    id,
    title,
    mark,
    tier,
    score: TIER_SCORE[tier],
    evaluate(stats) {
      const current = number(stats[metric]);
      const remaining = Math.max(0, target - current);
      return {
        unlocked: current >= target,
        current,
        target,
        progress: Math.min(1, current / target),
        detail: `${Math.min(current, target)} / ${target} ${forms[2]}`,
        remainingLabel: remaining > 0 ? `Ще ${countLabel(remaining, forms)}` : 'Відкрито'
      };
    }
  };
}

function seasonPlace(season = {}) {
  return firstNumber(season, ['place', 'finalPlace'], Number.POSITIVE_INFINITY);
}

function seasonDelta(season = {}) {
  return firstNumber(season, ['delta', 'ratingDelta'], Number.NEGATIVE_INFINITY);
}

function seasonLabel(season = {}) {
  return String(season.seasonTitle || season.seasonId || '').trim();
}

export const ACHIEVEMENT_DEFINITIONS = [
  milestone({ id: 'debut', title: 'Перший вихід', mark: '01', tier: 'bronze', metric: 'games', target: 1, forms: ['гра', 'гри', 'ігор'] }),
  milestone({ id: 'regular-25', title: 'Постійний гравець', mark: '25', tier: 'silver', metric: 'games', target: 25, forms: ['гра', 'гри', 'ігор'] }),
  milestone({ id: 'veteran-100', title: 'Ветеран арени', mark: '100', tier: 'gold', metric: 'games', target: 100, forms: ['гра', 'гри', 'ігор'] }),
  milestone({ id: 'iron-200', title: 'Залізна витримка', mark: '200', tier: 'elite', metric: 'games', target: 200, forms: ['гра', 'гри', 'ігор'] }),
  milestone({ id: 'first-win', title: 'Перша перемога', mark: 'W', tier: 'bronze', metric: 'wins', target: 1, forms: ['перемога', 'перемоги', 'перемог'] }),
  milestone({ id: 'winner-25', title: 'Переможний темп', mark: 'W25', tier: 'silver', metric: 'wins', target: 25, forms: ['перемога', 'перемоги', 'перемог'] }),
  milestone({ id: 'winner-100', title: 'Сотня перемог', mark: 'W100', tier: 'elite', metric: 'wins', target: 100, forms: ['перемога', 'перемоги', 'перемог'] }),
  milestone({ id: 'first-mvp', title: 'Помітний внесок', mark: 'M', tier: 'bronze', metric: 'mvpTotal', target: 1, forms: ['MVP', 'MVP', 'MVP'] }),
  milestone({ id: 'mvp-10', title: 'Гравець моменту', mark: 'M10', tier: 'silver', metric: 'mvpTotal', target: 10, forms: ['MVP', 'MVP', 'MVP'] }),
  milestone({ id: 'mvp-50', title: 'Майстер впливу', mark: 'M50', tier: 'elite', metric: 'mvpTotal', target: 50, forms: ['MVP', 'MVP', 'MVP'] }),
  {
    id: 'all-rounder',
    title: 'Універсал',
    mark: 'III',
    tier: 'gold',
    score: TIER_SCORE.gold,
    evaluate(stats) {
      const current = [stats.mvp1, stats.mvp2, stats.mvp3].filter((value) => value > 0).length;
      const remaining = 3 - current;
      return { unlocked: current === 3, current, target: 3, progress: current / 3, detail: `${current} / 3 позиції MVP`, remainingLabel: remaining > 0 ? `Ще ${remaining} позиції MVP` : 'Відкрито' };
    }
  },
  {
    id: 'stable-55',
    title: 'Стабільний результат',
    mark: '55%',
    tier: 'gold',
    score: TIER_SCORE.gold,
    evaluate(stats) {
      const gamesProgress = Math.min(1, stats.games / 50);
      const rateProgress = Math.min(1, stats.winRate / 55);
      const unlocked = stats.games >= 50 && stats.winRate >= 55;
      return {
        unlocked,
        current: stats.winRate,
        target: 55,
        progress: Math.min(gamesProgress, rateProgress),
        detail: `${stats.winRate.toFixed(1)}% WR · ${stats.games} ігор`,
        remainingLabel: unlocked ? 'Відкрито' : stats.games < 50 ? `Ще ${countLabel(50 - stats.games, ['гра', 'гри', 'ігор'])}` : `Ще ${(55 - stats.winRate).toFixed(1)} п.п. WR`
      };
    }
  },
  {
    id: 'elite-60',
    title: 'Елітна стабільність',
    mark: '60%',
    tier: 'elite',
    score: TIER_SCORE.elite,
    evaluate(stats) {
      const gamesProgress = Math.min(1, stats.games / 100);
      const rateProgress = Math.min(1, stats.winRate / 60);
      const unlocked = stats.games >= 100 && stats.winRate >= 60;
      return {
        unlocked,
        current: stats.winRate,
        target: 60,
        progress: Math.min(gamesProgress, rateProgress),
        detail: `${stats.winRate.toFixed(1)}% WR · ${stats.games} ігор`,
        remainingLabel: unlocked ? 'Відкрито' : stats.games < 100 ? `Ще ${countLabel(100 - stats.games, ['гра', 'гри', 'ігор'])}` : `Ще ${(60 - stats.winRate).toFixed(1)} п.п. WR`
      };
    }
  },
  {
    id: 'podium',
    title: 'На пʼєдесталі',
    mark: 'TOP3',
    tier: 'gold',
    score: TIER_SCORE.gold,
    evaluate(stats) {
      const season = [...stats.seasons].sort((a, b) => seasonPlace(a) - seasonPlace(b))[0];
      const place = seasonPlace(season);
      return {
        unlocked: place <= 3,
        current: Number.isFinite(place) ? place : 0,
        target: 3,
        progress: place <= 3 ? 1 : 0,
        detail: place <= 3 ? `${place} місце · ${seasonLabel(season)}` : 'Фінішувати у топ-3',
        remainingLabel: place <= 3 ? 'Відкрито' : 'До топ-3 сезону'
      };
    }
  },
  {
    id: 'champion',
    title: 'Чемпіон сезону',
    mark: '#1',
    tier: 'elite',
    score: TIER_SCORE.elite,
    evaluate(stats) {
      const season = stats.seasons.find((entry) => seasonPlace(entry) === 1);
      return {
        unlocked: Boolean(season),
        current: season ? 1 : 0,
        target: 1,
        progress: season ? 1 : 0,
        detail: season ? seasonLabel(season) : 'Посісти 1 місце в сезоні',
        remainingLabel: season ? 'Відкрито' : 'До 1 місця сезону'
      };
    }
  },
  {
    id: 'climber-100',
    title: 'Ривок сезону',
    mark: '+100',
    tier: 'gold',
    score: TIER_SCORE.gold,
    evaluate(stats) {
      const season = [...stats.seasons].sort((a, b) => seasonDelta(b) - seasonDelta(a))[0];
      const delta = Math.max(0, seasonDelta(season));
      return {
        unlocked: delta >= 100,
        current: delta,
        target: 100,
        progress: Math.min(1, delta / 100),
        detail: delta > 0 ? `+${delta} · ${seasonLabel(season)}` : 'Набрати +100 за сезон',
        remainingLabel: delta >= 100 ? 'Відкрито' : `Ще +${Math.ceil(100 - delta)} за сезон`
      };
    }
  },
  {
    id: 'rank-s',
    title: 'S-ранг',
    mark: 'S',
    tier: 'elite',
    score: TIER_SCORE.elite,
    evaluate(stats) {
      const current = RANK_ORDER[stats.bestRank] ?? 0;
      const remaining = Math.max(0, RANK_ORDER.S - current);
      return { unlocked: current >= RANK_ORDER.S, current, target: RANK_ORDER.S, progress: current / RANK_ORDER.S, detail: `Найвищий ранг: ${stats.bestRank}`, remainingLabel: remaining > 0 ? `Ще ${remaining} ${remaining === 1 ? 'ранг' : 'ранги'}` : 'Відкрито' };
    }
  }
];

export function buildAchievementProfile({ allTime = {}, seasons = [] } = {}) {
  const stats = normalizeStats(allTime, seasons);
  const evaluated = ACHIEVEMENT_DEFINITIONS.map((definition) => ({
    id: definition.id,
    title: definition.title,
    mark: definition.mark,
    tier: definition.tier,
    score: definition.score,
    ...definition.evaluate(stats)
  })).map((achievement) => ({
    ...achievement,
    progress: Math.max(0, Math.min(1, number(achievement.progress)))
  }));

  const unlocked = evaluated
    .filter((achievement) => achievement.unlocked)
    .sort((a, b) => TIER_ORDER[b.tier] - TIER_ORDER[a.tier] || b.score - a.score || a.title.localeCompare(b.title, 'uk'));
  const inProgress = evaluated
    .filter((achievement) => !achievement.unlocked && achievement.progress > 0)
    .sort((a, b) => b.progress - a.progress || b.score - a.score)
    .slice(0, 3);

  return {
    unlocked,
    inProgress,
    score: unlocked.reduce((sum, achievement) => sum + achievement.score, 0),
    unlockedCount: unlocked.length,
    totalCount: evaluated.length
  };
}
