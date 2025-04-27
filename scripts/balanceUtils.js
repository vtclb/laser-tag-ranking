// scripts/balanceUtils.js
export function autoBalance2(arr) {
  const sorted = [...arr].sort((a,b)=>b.pts - a.pts);
  const A = [], B = [];
  sorted.forEach(p=>{
    const sumA = A.reduce((s,x)=>s+x.pts,0);
    const sumB = B.reduce((s,x)=>s+x.pts,0);
    (sumA <= sumB ? A : B).push(p);
  });
  return { A, B };
}

export function autoBalanceN(arr, n) {
  const sorted = [...arr].sort((a,b)=>b.pts - a.pts);
  const out = Array.from({length:n}, ()=>[]);
  sorted.forEach(p => {
    // шукаємо індекс команди з мінімальною сумою
    let minIdx = 0, minSum = out[0].reduce((s,x)=>s+x.pts,0);
    for (let i = 1; i < n; i++) {
      const sum = out[i].reduce((s,x)=>s+x.pts,0);
      if (sum < minSum) { minSum = sum; minIdx = i; }
    }
    out[minIdx].push(p);
  });
  // повертаємо об’єкт {1: [...], 2: [...], ...}
  return out.reduce((o, team, i) => (o[i+1]=team, o), {});
}
