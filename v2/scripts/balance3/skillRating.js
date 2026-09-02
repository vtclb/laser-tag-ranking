const DEFAULT_RATING = 1000;
const MIN_RATING = 400;
const MAX_RATING = 1800;
const PROVISIONAL_GAMES = 12;
const CONFIDENT_GAMES = 24;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeNick(value) {
  return String(value || '').trim();
}

function uniqueTeam(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(normalizeNick).filter(Boolean))];
}

function expectedScore(left, right) {
  return 1 / (1 + (10 ** ((right - left) / 400)));
}

function reliability(games) {
  return Math.sqrt(clamp(Number(games) || 0, 0, CONFIDENT_GAMES) / CONFIDENT_GAMES);
}

function effectiveRating(player) {
  return DEFAULT_RATING + ((player.rating - DEFAULT_RATING) * reliability(player.games));
}

function kFactor(games) {
  return 42 - (18 * clamp(Number(games) || 0, 0, CONFIDENT_GAMES) / CONFIDENT_GAMES);
}

function winnerScore(value) {
  const winner = String(value || '').trim().toLowerCase();
  if (['team1', '1', 'a'].includes(winner)) return 1;
  if (['team2', '2', 'b'].includes(winner)) return 0;
  if (['draw', 'tie', '0', 'нічия'].includes(winner)) return 0.5;
  return null;
}

function ensurePlayer(players, nick) {
  if (!players.has(nick)) players.set(nick, { nick, rating: DEFAULT_RATING, games: 0 });
  return players.get(nick);
}

function teamAverage(players, roster) {
  return roster.reduce((total, nick) => total + effectiveRating(ensurePlayer(players, nick)), 0) / roster.length;
}

function awardWeights(match, participants) {
  const weights = new Map(participants.map((nick) => [nick, 0]));
  [[match.mvp1 || match.mvp, 1], [match.mvp2, 0.55], [match.mvp3, 0.25]].forEach(([rawNick, weight]) => {
    const nick = normalizeNick(rawNick);
    if (weights.has(nick)) weights.set(nick, Math.max(weights.get(nick), weight));
  });
  const average = [...weights.values()].reduce((sum, value) => sum + value, 0) / Math.max(weights.size, 1);
  return new Map([...weights].map(([nick, value]) => [nick, value - average]));
}

export function calculateSkillRatings(matches = [], { initialRatings = {} } = {}) {
  const players = new Map();
  const metrics = { matches: 0, decisions: 0, skipped: 0, correct: 0, brier: 0 };

  Object.entries(initialRatings && typeof initialRatings === 'object' ? initialRatings : {}).forEach(([rawNick, seed]) => {
    const nick = normalizeNick(seed?.nick || rawNick);
    if (!nick) return;
    const rawRating = Number(seed?.rawSkillRating ?? seed?.rating);
    players.set(nick, {
      nick,
      rating: clamp(Number.isFinite(rawRating) ? rawRating : DEFAULT_RATING, MIN_RATING, MAX_RATING),
      games: Math.max(0, Number(seed?.skillGames ?? seed?.games) || 0),
    });
  });

  for (const match of Array.isArray(matches) ? matches : []) {
    const team1 = uniqueTeam(match?.team1);
    const team2 = uniqueTeam(match?.team2);
    const actual1 = winnerScore(match?.winner);
    const overlap = new Set(team1.filter((nick) => team2.includes(nick)));
    if (!team1.length || !team2.length || overlap.size || actual1 === null) {
      metrics.skipped += 1;
      continue;
    }

    const expected1 = expectedScore(teamAverage(players, team1), teamAverage(players, team2));
    const expected2 = 1 - expected1;
    const actual2 = 1 - actual1;
    const participants = [...team1, ...team2];
    const awards = awardWeights(match, participants);

    metrics.matches += 1;
    if (actual1 !== 0.5) {
      metrics.decisions += 1;
      metrics.correct += (expected1 >= 0.5) === (actual1 === 1) ? 1 : 0;
    }
    metrics.brier += (expected1 - actual1) ** 2;

    const deltas = new Map();
    [[team1, actual1, expected1], [team2, actual2, expected2]].forEach(([team, actual, expected]) => {
      team.forEach((nick) => {
        const player = ensurePlayer(players, nick);
        const resultDelta = kFactor(player.games) * (actual - expected);
        const impactDelta = (awards.get(nick) || 0) * 6;
        deltas.set(nick, resultDelta + impactDelta);
      });
    });
    const meanDelta = [...deltas.values()].reduce((sum, value) => sum + value, 0) / deltas.size;
    deltas.forEach((delta, nick) => {
      const player = ensurePlayer(players, nick);
      player.rating = clamp(player.rating + delta - meanDelta, MIN_RATING, MAX_RATING);
      player.games += 1;
    });
  }

  const ratings = Object.fromEntries([...players].map(([nick, player]) => {
    const skillRating = Math.round(effectiveRating(player));
    const uncertainty = Math.round(60 + (290 * (1 - reliability(player.games))));
    return [nick, {
      nick,
      skillRating,
      rawSkillRating: Math.round(player.rating),
      skillGames: player.games,
      skillUncertainty: uncertainty,
      provisional: player.games < PROVISIONAL_GAMES,
    }];
  }));

  return {
    ratings,
    metrics: {
      ...metrics,
      accuracy: metrics.decisions ? metrics.correct / metrics.decisions : 0,
      brier: metrics.matches ? metrics.brier / metrics.matches : 0,
      players: Object.keys(ratings).length,
    },
  };
}

export function normalizeSkillMatch(row = {}) {
  const splitTeam = (value) => Array.isArray(value)
    ? uniqueTeam(value)
    : uniqueTeam(String(value || '').replace(/\r?\n/g, ',').split(/[;,]/));
  return {
    team1: splitTeam(row.team1 ?? row.Team1),
    team2: splitTeam(row.team2 ?? row.Team2),
    winner: row.winner ?? row.Winner,
    mvp1: row.mvp1 ?? row.mvp ?? row.MVP,
    mvp2: row.mvp2 ?? row.MVP2,
    mvp3: row.mvp3 ?? row.MVP3,
  };
}

export const SKILL_RATING_VERSION = 'skill-v2-shadow-1';
