(function(){
  const rankingURLs = {
    kids: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1648067737&single=true&output=csv",
    sunday: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1286735969&single=true&output=csv"
  };
  const gamesURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=249347260&single=true&output=csv";

  const alias = {
    "Zavodchanyn": "Romario",
    "Romario": "Zavodchanyn",
    "Mariko": "Gidora",
    "Timabuilding": "Бойбуд"
  };

  const leagueSel = document.getElementById('league');
  const dateInput = document.getElementById('date');
  const loadBtn   = document.getElementById('loadBtn');
  const playersTb = document.getElementById('players');
  const matchesTb = document.getElementById('matches');
  const fullscreenBtn = document.getElementById('fullscreen');

  leagueSel.addEventListener('change', loadData);
  dateInput.addEventListener('change', loadData);
  if(loadBtn) loadBtn.addEventListener('click', loadData);
  document.addEventListener('DOMContentLoaded', loadData);
  window.addEventListener('storage', e => {
    if(e.key === 'gamedayRefresh') loadData();
  });
  if(fullscreenBtn){
    fullscreenBtn.addEventListener('click', () => {
      if(!document.fullscreenElement){
        document.documentElement.requestFullscreen();
      }else{
        document.exitFullscreen();
      }
    });
  }

  function normName(n){ return alias[n] || n; }

  function getRankLetter(pts){
    if(pts>=1200) return 'S';
    if(pts>=800 ) return 'A';
    if(pts>=500 ) return 'B';
    if(pts>=200 ) return 'C';
    return 'D';
  }
  function partPoints(rank){
    return {S:-15,A:-10,B:-5,C:0,D:5}[rank] || 0;
  }

  function parseDate(ts) {
    if (!ts) return '';
    const m = ts.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (m) {
      const [_, d, mon, y] = m;
      return `${y}-${mon.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    const d = new Date(ts);
    return isNaN(d) ? '' : d.toISOString().slice(0,10);
  }

  function vpIcons(n){
    return '★'.repeat(n);
  }

  function formatScore(a,b){
    if(isNaN(a) || isNaN(b)) return '-';
    return `${vpIcons(a)} - ${vpIcons(b)}`;
  }

  async function loadData(){
    if(!dateInput.value) return; // require date
    const rURL = rankingURLs[leagueSel.value];
    const [rText,gText] = await Promise.all([
      fetch(rURL).then(r=>r.text()),
      fetch(gamesURL).then(r=>r.text())
    ]);
    const ranking = Papa.parse(rText,{header:true,skipEmptyLines:true}).data;
    const games   = Papa.parse(gText,{header:true,skipEmptyLines:true}).data;

    const players = {};
    ranking.forEach(r=>{
      const name = normName(r.Nickname?.trim());
      if(!name) return;
      players[name] = {pts:+r.Points||0, delta:0, wins:0, games:0};
    });

    const filtered = games.filter(g=>g.League===leagueSel.value)
      .filter(g=>parseDate(g.Timestamp)===dateInput.value);

    const matchRows = [];
    filtered.forEach(g=>{
      const t1 = g.Team1.split(',').map(s=>normName(s.trim()));
      const t2 = g.Team2.split(',').map(s=>normName(s.trim()));
      const winner = g.Winner;
      const mvp = normName(g.MVP);
      const seriesText = g.Series || '';
      const [s1Ser, s2Ser] = seriesText.split('-').map(v => parseInt(v, 10));
      const score1Val = parseInt(g.Score1,10);
      const score2Val = parseInt(g.Score2,10);
      const s1 = !isNaN(s1Ser) && !isNaN(s2Ser) ? s1Ser : score1Val;
      const s2 = !isNaN(s1Ser) && !isNaN(s2Ser) ? s2Ser : score2Val;

      const team1Pts=[];
      const team2Pts=[];
      const t1sum = t1.reduce((s,n)=>s+(players[n]?.pts||0),0);
      const t2sum = t2.reduce((s,n)=>s+(players[n]?.pts||0),0);
      t1.forEach(n=>{
        players[n] = players[n]||{pts:0,delta:0,wins:0,games:0};
        players[n].games++;
        if(winner==='team1') players[n].wins++;
        let d = partPoints(getRankLetter(players[n].pts));
        if(winner==='team1') d+=20;
        if(mvp===n) d+=10;
        players[n].delta += d;
        const span=`<span class="nick-${getRankLetter(players[n].pts)}">${n}</span>`;
        team1Pts.push(span+' ('+(d>0?'+':'')+d+')');
      });
      t2.forEach(n=>{
        players[n] = players[n]||{pts:0,delta:0,wins:0,games:0};
        players[n].games++;
        if(winner==='team2') players[n].wins++;
        let d = partPoints(getRankLetter(players[n].pts));
        if(winner==='team2') d+=20;
        if(mvp===n) d+=10;
        players[n].delta += d;
        const span=`<span class="nick-${getRankLetter(players[n].pts)}">${n}</span>`;
        team2Pts.push(span+' ('+(d>0?'+':'')+d+')');
      });
      matchRows.push({
        team1: team1Pts.join(', '),
        team2: team2Pts.join(', '),
        t1sum,
        t2sum,
        score1: s1,
        score2: s2,
        winner,
        mvp: `<span class="nick-${getRankLetter(players[mvp]?.pts||0)}">${mvp}</span>`
      });
    });

    const arr = Object.keys(players).map(n=>({
      nick: n,
      pts: players[n].pts,
      delta: players[n].delta,
      wins: players[n].wins,
      games: players[n].games,
      prevPts: players[n].pts - players[n].delta
    }));

    // sort by previous points to calculate prior ranking
    arr.slice().sort((a,b)=>b.prevPts - a.prevPts)
      .forEach((p,i)=>{ p.prevRank = i+1; });

    // sort by current points for global ranking
    arr.slice().sort((a,b)=>b.pts - a.pts)
      .forEach((p,i)=>{ p.currRank = i+1; });

    const list = arr.filter(p=>p.delta!==0)
      .sort((a,b)=>a.currRank - b.currRank);

    playersTb.innerHTML='';
    list.forEach(p=>{
      const tr=document.createElement('tr');
      const cls=p.delta>=0?'up':'down';
      const arrow=p.delta>0?'▲':p.delta<0?'▼':'';
      const nClass='nick-'+getRankLetter(p.pts);
      tr.innerHTML=
        `<td>${p.currRank} (${p.prevRank})</td>`+
        `<td class="${nClass}">${p.nick}</td>`+
        `<td>${p.pts}</td>`+
        `<td>${p.wins}</td>`+
        `<td>${p.games}</td>`+
        `<td class="${cls}">${arrow} ${(p.delta>0?'+':'')+p.delta}</td>`;
      playersTb.appendChild(tr);
    });

    matchesTb.innerHTML='';
    matchRows.forEach(m=>{
      const tr=document.createElement('tr');
      const cls1=m.winner==='team1'?'team-win':m.winner==='team2'?'team-loss':'';
      const cls2=m.winner==='team2'?'team-win':m.winner==='team1'?'team-loss':'';
      const score=formatScore(m.score1,m.score2);
      tr.innerHTML=`<td class="team-label ${cls1}">🛡️ ${m.team1}<span class="team-total">[${m.t1sum}]</span></td>`+
        `<td><span class="vs">${score}</span></td>`+
        `<td class="team-label ${cls2}">🚀 ${m.team2}<span class="team-total">[${m.t2sum}]</span></td>`+
        `<td>${m.mvp}</td>`;
      matchesTb.appendChild(tr);
    });
  }
})();
