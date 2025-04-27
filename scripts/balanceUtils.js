// scripts/balanceUtils.js

/**
 * Автобаланс для двох команд
 */
export function autoBalance2(arr) {
  const sorted = [...arr].sort((a, b) => b.pts - a.pts);
  const A = [], B = [];
  sorted.forEach(p => {
    const sumA = A.reduce((s, x) => s + x.pts, 0);
    const sumB = B.reduce((s, x) => s + x.pts, 0);
    (sumA <= sumB ? A : B).push(p);
  });
  return { A, B };
}

/**
 * Автобаланс для N команд:
 * – Перш за все розраховуємо цільовий розмір кожної команди
 * – Потім, в порядку спадання балів, кладемо гравця у ту команду,
 *   де зараз найменша сума та є вільне місце
 */
export function autoBalanceN(arr, n) {
  const total = arr.length;
  const base = Math.floor(total / n);
  const rem  = total % n;
  // цільові розміри: перші rem команд отримають +1
  const targetSizes = Array.from({ length: n }, (_, i) =>
    base + (i < rem ? 1 : 0)
  );

  const sorted = [...arr].sort((a, b) => b.pts - a.pts);
  const out = Array.from({ length: n }, () => []);

  sorted.forEach(p => {
    // шукаємо команду з найменшою сумою, але ще не заповнену до targetSizes
    let bestIdx = -1, bestSum = Infinity;
    for (let i = 0; i < n; i++) {
      if (out[i].length < targetSizes[i]) {
        const sum = out[i].reduce((s, x) => s + x.pts, 0);
        if (sum < bestSum) {
          bestSum = sum;
          bestIdx = i;
        }
      }
    }
    // якщо чомусь вільні місця скінчилися (не має бути), кидаємо в першу
    if (bestIdx < 0) bestIdx = 0;
    out[bestIdx].push(p);
  });

  // повертаємо об’єкт {1: [...], 2: [...], ...}
  return out.reduce((o, team, i) => ((o[i + 1] = team), o), {});
}
