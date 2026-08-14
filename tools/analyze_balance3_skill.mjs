import fs from 'node:fs/promises';

import { calculateSkillRatings, normalizeSkillMatch } from '../v2/scripts/balance3/skillRating.js';

const archivePath = new URL('../v2/data/seasons/spring_2026.json', import.meta.url);
const archive = JSON.parse(await fs.readFile(archivePath, 'utf8'));

function average(values, points, fallback = 1000) {
  return values.reduce((sum, nick) => sum + (points.get(nick) ?? fallback), 0) / values.length;
}

function probability(left, right) {
  return 1 / (1 + (10 ** ((right - left) / 400)));
}

function rankPenalty(points) {
  if (points >= 1200) return -14;
  if (points >= 1000) return -12;
  if (points >= 800) return -10;
  if (points >= 600) return -8;
  if (points >= 400) return -6;
  if (points >= 200) return -4;
  return 0;
}

function officialMetrics(matches, table) {
  const points = new Map(table.map((player) => [player.nick, Number(player.ratingStart) || 1000]));
  let correct = 0;
  let decisions = 0;
  let brier = 0;
  let used = 0;

  matches.forEach((match) => {
    if (!match.team1.length || !match.team2.length || !['team1', 'team2', 'draw'].includes(match.winner)) return;
    const expected1 = probability(average(match.team1, points), average(match.team2, points));
    const actual1 = match.winner === 'team1' ? 1 : match.winner === 'team2' ? 0 : 0.5;
    used += 1;
    brier += (expected1 - actual1) ** 2;
    if (actual1 !== 0.5) {
      decisions += 1;
      correct += (expected1 >= 0.5) === (actual1 === 1) ? 1 : 0;
    }

    const mvp = new Map([[match.mvp1, 12], [match.mvp2, 7], [match.mvp3, 3]]);
    [['team1', match.team1], ['team2', match.team2]].forEach(([teamId, roster]) => {
      roster.forEach((nick) => {
        const current = points.get(nick) ?? 1000;
        const win = match.winner === teamId ? 20 : 0;
        points.set(nick, current + rankPenalty(current) + win + (mvp.get(nick) || 0));
      });
    });
  });

  return {
    matches: used,
    accuracy: decisions ? correct / decisions : 0,
    brier: used ? brier / used : 0,
  };
}

const report = {};
for (const [league, data] of Object.entries(archive.leagues || {})) {
  const matches = (data.matches || []).map(normalizeSkillMatch);
  const shadow = calculateSkillRatings(matches);
  const official = officialMetrics(matches, data.table || []);
  const topSkill = Object.values(shadow.ratings)
    .sort((a, b) => b.skillRating - a.skillRating)
    .slice(0, 10)
    .map(({ nick, skillRating, skillGames, provisional }) => ({ nick, skillRating, skillGames, provisional }));
  report[league] = {
    matches: matches.length,
    officialPoints: official,
    skillV2: shadow.metrics,
    brierImprovement: official.brier ? (official.brier - shadow.metrics.brier) / official.brier : 0,
    topSkill,
  };
}

console.log(JSON.stringify(report, null, 2));
