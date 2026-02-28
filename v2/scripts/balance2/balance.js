function sum(arr) { return arr.reduce((s, p) => s + (Number(p.pts) || 0), 0); }

export function autoBalance2(players) {
  const n = players.length;
  if (!n) return { team1: [], team2: [] };
  const size = Math.floor(n / 2);
  const total = 1 << n;
  let minDiff = Infinity;
  let best = null;
  const popcount = (x) => { let c = 0; while (x) { x &= x - 1; c++; } return c; };

  for (let mask = 0; mask < total; mask++) {
    if (popcount(mask) !== size) continue;
    const team1 = []; const team2 = [];
    for (let i = 0; i < n; i++) (mask & (1 << i) ? team1 : team2).push(players[i]);
    const diff = Math.abs(sum(team1) - sum(team2));
    if (diff < minDiff) { minDiff = diff; best = { team1, team2 }; }
  }
  return best || { team1: players.slice(0, size), team2: players.slice(size) };
}

export function autoBalance3(players) {
  const sorted = [...players].sort((a, b) => (b.pts || 0) - (a.pts || 0));
  const teams = { team1: [], team2: [], team3: [] };
  const targets = [0, 1, 2].map((i) => Math.floor(players.length / 3) + (i < players.length % 3 ? 1 : 0));
  for (const p of sorted) {
    const idx = [0, 1, 2]
      .filter((i) => teams[`team${i + 1}`].length < targets[i])
      .sort((a, b) => sum(teams[`team${a + 1}`]) - sum(teams[`team${b + 1}`]))[0] ?? 0;
    teams[`team${idx + 1}`].push(p);
  }
  return teams;
}
