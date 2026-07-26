function sum(arr) {
  return arr.reduce((s, p) => s + (Number(p.pts ?? p.points) || 0), 0);
}

export function autoBalance2(players) {
  const teams = balanceIntoNTeams(players, 2);
  return { team1: teams.team1, team2: teams.team2 };
}

export function balanceIntoNTeams(players, n) {
  const teamCount = Math.min(12, Math.max(2, Number(n) || 2));
  const sorted = [...players].sort((a, b) => ((Number(b.pts ?? b.points) || 0) - (Number(a.pts ?? a.points) || 0)) || a.nick.localeCompare(b.nick, 'uk'));
  const teams = Object.fromEntries(Array.from({ length: 12 }, (_, idx) => [`team${idx + 1}`, []]));
  const targets = Array.from({ length: teamCount }, (_, i) => Math.floor(players.length / teamCount) + (i < players.length % teamCount ? 1 : 0));

  for (const player of sorted) {
    const idx = Array.from({ length: teamCount }, (_, i) => i)
      .filter((i) => teams[`team${i + 1}`].length < targets[i])
      .sort((a, b) => sum(teams[`team${a + 1}`]) - sum(teams[`team${b + 1}`]))[0] ?? 0;
    teams[`team${idx + 1}`].push(player);
  }

  // Improve the greedy result with bounded pair swaps while preserving team sizes.
  let improved = true;
  let passes = 0;
  const maxPasses = Math.min(20, Math.max(2, players.length));
  while (improved && passes < maxPasses) {
    improved = false;
    passes += 1;
    const totals = Array.from({ length: teamCount }, (_, idx) => sum(teams[`team${idx + 1}`]));
    const currentSpread = Math.max(...totals) - Math.min(...totals);
    let bestSwap = null;

    for (let a = 0; a < teamCount; a += 1) {
      for (let b = a + 1; b < teamCount; b += 1) {
        const teamA = teams[`team${a + 1}`];
        const teamB = teams[`team${b + 1}`];
        for (let i = 0; i < teamA.length; i += 1) {
          for (let j = 0; j < teamB.length; j += 1) {
            const pointsA = Number(teamA[i].pts ?? teamA[i].points) || 0;
            const pointsB = Number(teamB[j].pts ?? teamB[j].points) || 0;
            const nextTotals = [...totals];
            nextTotals[a] = totals[a] - pointsA + pointsB;
            nextTotals[b] = totals[b] - pointsB + pointsA;
            const nextSpread = Math.max(...nextTotals) - Math.min(...nextTotals);
            if (nextSpread < currentSpread && (!bestSwap || nextSpread < bestSwap.spread)) {
              bestSwap = { a, b, i, j, spread: nextSpread };
            }
          }
        }
      }
    }

    if (bestSwap) {
      const teamA = teams[`team${bestSwap.a + 1}`];
      const teamB = teams[`team${bestSwap.b + 1}`];
      [teamA[bestSwap.i], teamB[bestSwap.j]] = [teamB[bestSwap.j], teamA[bestSwap.i]];
      improved = true;
    }
  }

  return teams;
}

export function autoBalance3(players) {
  return balanceIntoNTeams(players, 3);
}
