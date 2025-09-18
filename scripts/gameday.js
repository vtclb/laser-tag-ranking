import { log } from './logger.js?v=2025-09-12-1';
import { getPdfLinks, fetchOnce, CSV_URLS } from "./api.js?v=2025-09-12-1";
import { rankLetterForPoints } from './rankUtils.js?v=2025-09-12-1';
import { renderAllAvatars, reloadAvatars } from './avatars.client.js?v=2025-09-12-1';
(function () {
  const CSV_TTL = 60 * 1000;


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
    if(e.key === 'avatarRefresh') reloadAvatars();
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

  function partPoints(rank){
    return {S:-14,A:-12,B:-10,C:-8,D:-6,E:-4,F:0}[rank] || 0;
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

  function normalizeLeagueForFilter(v){
    return String(v || '').toLowerCase() === 'kids' ? 'kids' : 'sundaygames';
  }

  async function loadData(){
    if(!dateInput.value) return; // require date
    const rURL = CSV_URLS[leagueSel.value].ranking;
    const gURL = CSV_URLS[leagueSel.value].games;
    let rText, gText;
    try {
      [rText, gText] = await Promise.all([
        fetchOnce(rURL, CSV_TTL),
        fetchOnce(gURL, CSV_TTL),
      ]);
    }catch(err){
      playersTb.innerHTML = '';
      matchesTb.innerHTML = '';
      log('[ranking]', err);
      const msg = 'Failed to load gameday data. Please try again later.';
      if (typeof showToast === 'function') showToast(msg); else alert(msg);
      return;
    }
    const ranking = Papa.parse(rText,{header:true,skipEmptyLines:true}).data;
    const games   = Papa.parse(gText,{header:true,skipEmptyLines:true}).data;
    let pdfLinks = {};
    try{
      pdfLinks = await getPdfLinks({ league: leagueSel.value, date: dateInput.value });
    }catch(err){
      log('[ranking]', err);
    }

    const players = {};
    const rankMap = {};
    ranking.forEach(r=>{
      const name = normName(r.Nickname?.trim());
      if(!name) return;
      players[name] = {pts:0, delta:0, wins:0, games:0};
      rankMap[name] = +r.Points || 0;
    });

    const allGames = games.filter(
      g => normalizeLeagueForFilter(g.League) === leagueSel.value
    );
    allGames.sort((a,b)=>{
      const tDiff = new Date(a.Timestamp) - new Date(b.Timestamp);
      if(tDiff) return tDiff;
      return (+a.ID || 0) - (+b.ID || 0);
    });

    const preDayPts = {};
    let captured = false;
    const matchRows = [];
    allGames.forEach(g=>{
      const date = parseDate(g.Timestamp);
      const t1 = g.Team1.split(',').map(s=>normName(s.trim()));
      const t2 = g.Team2.split(',').map(s=>normName(s.trim()));
      const winner = g.Winner;
      const mvpList = [g.MVP, g.mvp2, g.mvp3]
        .flatMap(v => String(v || '').split(/[;,]/))
        .map(s => normName(s.trim()))
        .filter(Boolean);

      let s1 = parseInt(g.Score1, 10);
      let s2 = parseInt(g.Score2, 10);
      if(isNaN(s1) || isNaN(s2)){
        const mScore = (g.Series || g.series || '').match(/(\d+)\D+(\d+)/);
        if(mScore){
          s1 = parseInt(mScore[1], 10);
          s2 = parseInt(mScore[2], 10);
        }
      }

      function apply(team, isWin, store, arr){
        team.forEach(n=>{
          players[n] = players[n]||{pts:0,delta:0,wins:0,games:0};
          const rankBefore = rankLetterForPoints(players[n].pts);
          let d = partPoints(rankBefore);
          if(isWin) d+=20;
          const idx = mvpList.indexOf(n);
          if(idx > -1) d += [12,7,3][idx] || 0;
          players[n].pts += d;
          if(store){
            players[n].games++;
            if(isWin) players[n].wins++;
            players[n].delta += d;
            arr.push({nick:n,rank:rankBefore,delta:d});
          }
        });
      }

      if(date < dateInput.value){
        apply(t1, winner==='team1', false, []);
        apply(t2, winner==='team2', false, []);
      }else if(date === dateInput.value){
        if(!captured){
          Object.keys(players).forEach(n=>{ preDayPts[n] = players[n].pts; });
          captured = true;
        }
        const t1sum = t1.reduce((s,n)=>s+(players[n]?.pts||0),0);
        const t2sum = t2.reduce((s,n)=>s+(players[n]?.pts||0),0);
        const team1Pts=[];
        const team2Pts=[];
        apply(t1, winner==='team1', true, team1Pts);
        apply(t2, winner==='team2', true, team2Pts);
        matchRows.push({
          id: g.ID,
          timestamp: g.Timestamp,
          team1: team1Pts,
          team2: team2Pts,
          t1sum,
          t2sum,
          score1: s1,
          score2: s2,
          winner,
          mvp: mvpList.map(n => ({nick:n,rank:rankLetterForPoints(players[n]?.pts||0)}))
        });
      }else{
        apply(t1, winner==='team1', false, []);
        apply(t2, winner==='team2', false, []);
      }
    });

    const arr = Object.keys(players).map(n=>{
      const finalPts = rankMap[n] ?? players[n].pts;
      const prev = preDayPts[n] ?? (finalPts - players[n].delta);
      return {
        nick: n,
        pts: finalPts,
        delta: players[n].delta,
        wins: players[n].wins,
        games: players[n].games,
        prevPts: prev
      };
    });

    // sort by previous points to calculate prior ranking
    arr.slice().sort((a,b)=>b.prevPts - a.prevPts)
      .forEach((p,i)=>{ p.prevRank = i+1; });

    // sort by current points for global ranking
    arr.slice().sort((a,b)=>b.pts - a.pts)
      .forEach((p,i)=>{ p.currRank = i+1; });

    const list = arr.filter(p=>p.games>0)
      .sort((a,b)=>a.currRank - b.currRank);

    playersTb.innerHTML='';
    list.forEach(p=>{
      const tr=document.createElement('tr');
      const cls=p.delta>=0?'up':'down';
      const arrow=p.delta>0?'▲':p.delta<0?'▼':'';
      const nClass='nick-'+rankLetterForPoints(p.pts);

      const rank=document.createElement('td');
      rank.textContent=`${p.currRank} (${p.prevRank})`;

      const tdAvatar=document.createElement('td');
      const img=document.createElement('img');
      img.className='avatar-img';
      img.alt=p.nick;
      img.dataset.nick = p.nick;
      tdAvatar.appendChild(img);

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

      [rank,tdAvatar,nick,pts,games,wins,delta].forEach(td=>tr.appendChild(td));
      playersTb.appendChild(tr);
    });

    renderAllAvatars();

    const displayMatches = matchRows.slice().sort((a,b)=>{
      const tDiff = new Date(b.timestamp) - new Date(a.timestamp);
      if(tDiff) return tDiff;
      return (+b.id || 0) - (+a.id || 0);
    });

    matchesTb.innerHTML='';
    displayMatches.forEach(m=>{
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
      function addMvp(label, mv){
        if(!mv) return;
        const div=document.createElement('div');
        div.textContent=label+' ';
        const span=document.createElement('span');
        span.className='nick-'+mv.rank;
        span.textContent=mv.nick;
        div.appendChild(span);
        tdMvp.appendChild(div);
      }
      addMvp('🏅 MVP:', m.mvp[0]);
      addMvp('⭐ Срібна зірка:', m.mvp[1]);
      addMvp('⭐ Бронзова зірка:', m.mvp[2]);

      const pdfTd=document.createElement('td');
      const pdfUrl = pdfLinks[m.id];
      if(pdfUrl){
        const a=document.createElement('a');
        a.href=pdfUrl;
        a.textContent='PDF';
        a.target='_blank';
        pdfTd.appendChild(a);
      }

      [td1,tdScore,td2,tdMvp,pdfTd].forEach(td=>tr.appendChild(td));
      matchesTb.appendChild(tr);
    });
  }
})();
