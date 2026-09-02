import { createEmptyTeams, normalizeTeamCount, playerBalanceRating } from './domain.js';
import { TEAM_IDS } from './config.js';

function hashText(value = '') {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rating(player, ratingModel) {
  return playerBalanceRating(player, ratingModel);
}

function teamTotal(players = [], ratingModel) {
  return players.reduce((total, player) => total + rating(player, ratingModel), 0);
}

function spread(teams, teamCount, ratingModel) {
  const totals = TEAM_IDS.slice(0, teamCount).map((teamId) => teamTotal(teams[teamId], ratingModel));
  return Math.max(...totals) - Math.min(...totals);
}

export function balancePlayers(players = [], rawTeamCount = 2, seed = 1, { ratingModel = 'skill_v2' } = {}) {
  const teamCount = normalizeTeamCount(rawTeamCount);
  if (!Array.isArray(players) || players.length < teamCount) {
    throw new Error('Недостатньо гравців для обраної кількості команд');
  }
  const unique = new Map();
  players.forEach((player) => {
    if (player?.key && !unique.has(player.key)) unique.set(player.key, player);
  });
  if (unique.size < teamCount) throw new Error('Недостатньо унікальних гравців');

  const sorted = [...unique.values()].sort((a, b) => {
    const delta = rating(b, ratingModel) - rating(a, ratingModel);
    if (delta) return delta;
    return hashText(`${seed}:${a.key}`) - hashText(`${seed}:${b.key}`);
  });
  const targets = Array.from({ length: teamCount }, (_, index) => (
    Math.floor(sorted.length / teamCount) + (index < sorted.length % teamCount ? 1 : 0)
  ));
  const teams = Object.fromEntries(TEAM_IDS.map((teamId) => [teamId, []]));

  sorted.forEach((player) => {
    const candidate = TEAM_IDS.slice(0, teamCount)
      .map((teamId, index) => ({ teamId, index, total: teamTotal(teams[teamId], ratingModel), size: teams[teamId].length }))
      .filter((team) => team.size < targets[team.index])
      .sort((a, b) => a.total - b.total || a.size - b.size || hashText(`${seed}:${player.key}:${a.teamId}`) - hashText(`${seed}:${player.key}:${b.teamId}`))[0];
    teams[candidate.teamId].push(player);
  });

  let pass = 0;
  let improved = true;
  while (improved && pass < Math.min(24, sorted.length * 2)) {
    pass += 1;
    improved = false;
    const currentSpread = spread(teams, teamCount, ratingModel);
    let best = null;
    for (let a = 0; a < teamCount; a += 1) {
      for (let b = a + 1; b < teamCount; b += 1) {
        const left = teams[TEAM_IDS[a]];
        const right = teams[TEAM_IDS[b]];
        for (let i = 0; i < left.length; i += 1) {
          for (let j = 0; j < right.length; j += 1) {
            [left[i], right[j]] = [right[j], left[i]];
            const nextSpread = spread(teams, teamCount, ratingModel);
            [left[i], right[j]] = [right[j], left[i]];
            if (nextSpread < currentSpread && (!best || nextSpread < best.nextSpread)) {
              best = { a, b, i, j, nextSpread };
            }
          }
        }
      }
    }
    if (best) {
      const left = teams[TEAM_IDS[best.a]];
      const right = teams[TEAM_IDS[best.b]];
      [left[best.i], right[best.j]] = [right[best.j], left[best.i]];
      improved = true;
    }
  }

  return {
    teams: Object.fromEntries(TEAM_IDS.map((teamId) => [teamId, teams[teamId].map((player) => player.key)])),
    metrics: {
      spread: spread(teams, teamCount, ratingModel),
      totals: TEAM_IDS.slice(0, teamCount).map((teamId) => teamTotal(teams[teamId], ratingModel)),
      sizes: TEAM_IDS.slice(0, teamCount).map((teamId) => teams[teamId].length),
      ratingModel,
    },
  };
}

export function emptyManualTeams() {
  return createEmptyTeams();
}
