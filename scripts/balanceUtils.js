export function autoBalance2(arr) {
  const sorted = [...arr].sort((a,b)=>b.pts - a.pts);
  const A = [], B = [];
  sorted.forEach(p=>{
    (A.reduce((s,x)=>s+x.pts,0) <= B.reduce((s,x)=>s+x.pts,0) ? A : B).push(p);
  });
  return { A, B };
}

export function autoBalanceN(arr, n) {
  const sorted = [...arr].sort((a,b)=>b.pts - a.pts);
  const out = Array.from({length:n}, ()=>[]);
  sorted.forEach(p=>{
    let idx = out.reduce((min,i,t)=> t.reduce((s,x)=>s+x.pts,0) < min.sum ? {i, sum:t.reduce((s,x)=>s+x.pts,0)} : min
                        , {i:0, sum:out[0].reduce((s,x)=>s+x.pts,0)}).i;
    out[idx].push(p);
  });
  return out;
}
