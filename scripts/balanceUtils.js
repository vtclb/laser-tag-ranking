/** Авто-баланс для 2 команд */
export function autoBalance2(lobby) {
  const n = lobby.length, total = 1<<n;
  let best=[], minDiff=Infinity;
  for(let m=1; m<total-1; m++){
    const A=[], B=[];
    lobby.forEach((p,i) => (m&(1<<i) ? A : B).push(p));
    if(Math.abs(A.length-B.length)>1) continue;
    const sumA=A.reduce((s,p)=>s+p.pts,0),
          sumB=B.reduce((s,p)=>s+p.pts,0),
          diff=Math.abs(sumA-sumB);
    if(diff<minDiff){ minDiff=diff; best=[{A,B}]; }
    else if(diff===minDiff) best.push({A,B});
  }
  return best[Math.floor(Math.random()*best.length)];
}
/** Auto-баланс для N команд (3 або 4) */
export function autoBalanceN(lobby,N){
  const teams=Array.from({length:N},()=>[]);
  const sorted=[...lobby].sort((a,b)=>b.pts-a.pts);
  sorted.forEach(p=>{
    teams.sort((t1,t2)=>t1.reduce((s,x)=>s+x.pts,0)-t2.reduce((s,x)=>s+x.pts,0));
    teams[0].push(p);
  });
  return teams;
}
