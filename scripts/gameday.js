import { uploadAvatar, getAvatarURL } from "./api.js";
(function(){
  function isAdminMode(){
    return localStorage.getItem('admin') === 'true';
  }
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
  document.addEventListener('DOMContentLoaded', () => {
    dateInput.value = new Date().toISOString().slice(0,10);
    loadData();
  });
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
    let rText, gText;
    try{
      [rText, gText] = await Promise.all([
        fetch(rURL).then(r=>r.text()),
        fetch(gamesURL).then(r=>r.text())
      ]);
    }catch(err){
      playersTb.innerHTML = '';
      matchesTb.innerHTML = '';
      console.error('Failed to load gameday data', err);
      if(typeof alert === 'function'){
        alert('Failed to load gameday data. Please try again later.');
      }
      return;
    }
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

      let s1 = parseInt(g.Score1, 10);
      let s2 = parseInt(g.Score2, 10);
      if(isNaN(s1) || isNaN(s2)){
        const mScore = (g.Series || g.series || '').match(/(\d+)\D+(\d+)/);
        if(mScore){
          s1 = parseInt(mScore[1], 10);
          s2 = parseInt(mScore[2], 10);
        }
      }


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
        team1Pts.push({nick:n,rank:getRankLetter(players[n].pts),delta:d});
      });
      t2.forEach(n=>{
        players[n] = players[n]||{pts:0,delta:0,wins:0,games:0};
        players[n].games++;
        if(winner==='team2') players[n].wins++;
        let d = partPoints(getRankLetter(players[n].pts));
        if(winner==='team2') d+=20;
        if(mvp===n) d+=10;
        players[n].delta += d;
        team2Pts.push({nick:n,rank:getRankLetter(players[n].pts),delta:d});
      });
      matchRows.push({
        team1: team1Pts,
        team2: team2Pts,
        t1sum,
        t2sum,
        score1: s1,
        score2: s2,
        winner,
        mvp: {nick:mvp,rank:getRankLetter(players[mvp]?.pts||0)}
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

      const rank=document.createElement('td');
      rank.textContent=`${p.currRank} (${p.prevRank})`;

      const tdAvatar=document.createElement('td');
      const img=document.createElement('img');
      img.className='avatar-img';
      img.src=getAvatarURL(p.nick);
      img.onerror=()=>{img.src='https://via.placeholder.com/40';};
      tdAvatar.appendChild(img);
      if(isAdminMode()){
        const input=document.createElement('input');
        input.type='file';
        input.accept='image/*';
        input.addEventListener('change',e=>{
          const file=e.target.files[0];
          if(!file) return;
          img.src=URL.createObjectURL(file);
          uploadAvatar(p.nick,file).then(()=>{
            img.src=getAvatarURL(p.nick);
          });
        });
        tdAvatar.appendChild(input);
      }

      const nick=document.createElement('td');
      nick.className=nClass;
      nick.textContent=p.nick;

      const pts=document.createElement('td');
      pts.textContent=p.pts;

      const wins=document.createElement('td');
      wins.textContent=p.wins;

      const games=document.createElement('td');
      games.textContent=p.games;

      const delta=document.createElement('td');
      delta.className=cls;
      delta.textContent=`${arrow} ${(p.delta>0?'+':'')+p.delta}`;

      [rank,tdAvatar,nick,pts,wins,games,delta].forEach(td=>tr.appendChild(td));
      playersTb.appendChild(tr);
    });

    matchesTb.innerHTML='';
    matchRows.forEach(m=>{
      const tr=document.createElement('tr');
      const cls1=m.winner==='team1'?'team-win':m.winner==='team2'?'team-loss':'';
      const cls2=m.winner==='team2'?'team-win':m.winner==='team1'?'team-loss':'';
      const score=formatScore(m.score1,m.score2);

      const td1=document.createElement('td');
      td1.className='team-label '+cls1;
      td1.textContent='🛡️ ';
      m.team1.forEach((p,i)=>{
        const span=document.createElement('span');
        span.className='nick-'+p.rank;
        span.textContent=p.nick;
        td1.appendChild(span);
        td1.appendChild(document.createTextNode(` (${p.delta>0?'+':''}${p.delta})`));
        if(i<m.team1.length-1) td1.appendChild(document.createTextNode(', '));
      });
      const total1=document.createElement('span');
      total1.className='team-total';
      total1.textContent='['+m.t1sum+']';
      td1.appendChild(total1);

      const tdScore=document.createElement('td');
      const vs=document.createElement('span');
      vs.className='vs';
      vs.textContent=score;
      tdScore.appendChild(vs);

      const td2=document.createElement('td');
      td2.className='team-label '+cls2;
      td2.textContent='🚀 ';
      m.team2.forEach((p,i)=>{
        const span=document.createElement('span');
        span.className='nick-'+p.rank;
        span.textContent=p.nick;
        td2.appendChild(span);
        td2.appendChild(document.createTextNode(` (${p.delta>0?'+':''}${p.delta})`));
        if(i<m.team2.length-1) td2.appendChild(document.createTextNode(', '));
      });
      const total2=document.createElement('span');
      total2.className='team-total';
      total2.textContent='['+m.t2sum+']';
      td2.appendChild(total2);

      const tdMvp=document.createElement('td');
      const mvpSpan=document.createElement('span');
      mvpSpan.className='nick-'+m.mvp.rank;
      mvpSpan.textContent=m.mvp.nick;
      tdMvp.appendChild(mvpSpan);

      [td1,tdScore,td2,tdMvp].forEach(td=>tr.appendChild(td));
      matchesTb.appendChild(tr);
    });
  }
})();
