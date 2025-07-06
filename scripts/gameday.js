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

  leagueSel.addEventListener('change', loadData);
  dateInput.addEventListener('change', loadData);
  if(loadBtn) loadBtn.addEventListener('click', loadData);
  document.addEventListener('DOMContentLoaded', loadData);

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
      players[name] = {pts:+r.Points||0, delta:0};
    });

    const filtered = games.filter(g=>g.League===leagueSel.value)
      .filter(g=>parseDate(g.Timestamp)===dateInput.value);

    const matchRows = [];
    filtered.forEach(g=>{
      const t1 = g.Team1.split(',').map(s=>normName(s.trim()));
      const t2 = g.Team2.split(',').map(s=>normName(s.trim()));
      const winner = g.Winner;
      const mvp = normName(g.MVP);
      const s1 = parseInt(g.Score1,10);
      const s2 = parseInt(g.Score2,10);

      const team1Pts=[];
      const team2Pts=[];
      t1.forEach(n=>{
        players[n] = players[n]||{pts:0,delta:0};
        let d = partPoints(getRankLetter(players[n].pts));
        if(winner==='team1') d+=20;
        if(mvp===n) d+=10;
        players[n].delta += d;
        team1Pts.push(n+' ('+(d>0?'+':'')+d+')');
      });
      t2.forEach(n=>{
        players[n] = players[n]||{pts:0,delta:0};
        let d = partPoints(getRankLetter(players[n].pts));
        if(winner==='team2') d+=20;
        if(mvp===n) d+=10;
        players[n].delta += d;
        team2Pts.push(n+' ('+(d>0?'+':'')+d+')');
      });
      matchRows.push({
        team1: team1Pts.join(', '),
        team2: team2Pts.join(', '),
        score: (!isNaN(s1)&&!isNaN(s2))?`${s1}:${s2}`:'-',
        mvp
      });
    });

    const all = Object.keys(players).map(n=>({
      nick:n,
      pts:players[n].pts + players[n].delta,
      delta:players[n].delta
    }));

    const sortedNew = [...all].sort((a,b)=>b.pts-a.pts);
    const sortedOld = [...all].sort((a,b)=>(b.pts - b.delta)-(a.pts - a.delta));

    const posMap = {}; sortedNew.forEach((p,i)=>{posMap[p.nick]=i+1;});
    const prevMap = {}; sortedOld.forEach((p,i)=>{prevMap[p.nick]=i+1;});

    const list = sortedNew.filter(p=>p.delta!==0);

    playersTb.innerHTML='';
    list.forEach(p=>{
      const tr=document.createElement('tr');
      const cls=p.delta>=0?'up':'down';
      const arrow=p.delta>0?'▲':p.delta<0?'▼':'';
      const now=posMap[p.nick];
      const prev=prevMap[p.nick];
      const rank=getRankLetter(p.pts);
      tr.innerHTML=`<td>#${now} (#${prev})</td>`+
        `<td class="nick-${rank}">${p.nick}</td>`+
        `<td>${p.pts}</td>`+
        `<td class="${cls}">${arrow} ${(p.delta>0?'+':'')+p.delta}</td>`;
      playersTb.appendChild(tr);
    });

    matchesTb.innerHTML='';
    matchRows.forEach(m=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${m.team1}</td><td>${m.score}</td><td>${m.team2}</td><td>${m.mvp}</td>`;
      matchesTb.appendChild(tr);
    });
  }
})();
