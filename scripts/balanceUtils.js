// scripts/balanceUtils.js

/**
 * Автобаланс для двох команд із рівною кількістю гравців та мінімальною різницею балів
 * Повертає два масиви A та B.
 */
export function autoBalance2(arr) {
  const n = arr.length;
  if (n === 0) return { A: [], B: [] };
  // цільовий розмір першої команди (друга отримає n - size1)
  const size1 = Math.floor(n / 2);
  // використовуємо перебір усіх розбиттів розміру size1
  let minDiff = Infinity;
  const best = [];
  // попофункція для підрахунку бітів
  const popcount = x => {
    let c = 0;
    while (x) {
      x &= x - 1;
      c++;
    }
    return c;
  };
  // перебираємо усі маски
  const total = 1 << n;
  for (let mask = 0; mask < total; mask++) {
    if (popcount(mask) !== size1) continue;
    const team1 = [];
    const team2 = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) team1.push(arr[i]);
      else team2.push(arr[i]);
    }
    const sum1 = team1.reduce((s, p) => s + p.pts, 0);
    const sum2 = team2.reduce((s, p) => s + p.pts, 0);
    const diff = Math.abs(sum1 - sum2);
    if (diff < minDiff) {
      minDiff = diff;
      best.length = 0;
      best.push({ A: team1, B: team2 });
    } else if (diff === minDiff) {
      best.push({ A: team1, B: team2 });
    }
  }
  // випадково вибираємо одну з кращих комбінацій
  const pick = best[Math.floor(Math.random() * best.length)];
  return pick;
}

/**
 * Автобаланс для N команд:
 * – Визначаємо цільовий розмір кожної команди (рівномірно)
 * – Розподіляємо гравців у порядку спадання балів,
 *   завжди в команду з найменшою сумою та свободним місцем.
 */
export function autoBalanceN(arr, n) {
  const totalPlayers = arr.length;
  const base = Math.floor(totalPlayers / n);
  const rem  = totalPlayers % n;
  const targetSizes = Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));

  const sorted = [...arr].sort((a, b) => b.pts - a.pts);
  const teams = Array.from({ length: n }, () => []);

  sorted.forEach(p => {
    let bestIdx = -1;
    let bestSum = Infinity;
    for (let i = 0; i < n; i++) {
      if (teams[i].length < targetSizes[i]) {
        const sum = teams[i].reduce((s, x) => s + x.pts, 0);
        if (sum < bestSum) {
          bestSum = sum;
          bestIdx = i;
        }
      }
    }
    if (bestIdx < 0) bestIdx = 0;
    teams[bestIdx].push(p);
  });

  // повертаємо об'єкт {1: [...], 2: [...], ...}
  return teams.reduce((o, teamArr, idx) => {
    o[idx + 1] = teamArr;
    return o;
  }, {});
}
