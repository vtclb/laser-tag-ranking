window.addEventListener('DOMContentLoaded', () => {
  const proxyUrl = 'https://laser-proxy.vartaclub.workers.dev';
  function makeCsvUrl(league){
    return `${proxyUrl}?league=${league}&t=${Date.now()}`;
  }

  let players = [], selected = [], lobby = [];

  const btnLoad       = document.getElementById('btn-load');
  const selectArea    = document.getElementById('select-area');
  const selectList    = document.getElementById('select-list');
  const btnAddSel     = document.getElementById('btn-add-selected');
  const btnClearSel   = document.getElementById('btn-clear-selected');
  const lobbyArea     = document.getElementById('lobby-area');
  const lobbyList     = document.getElementById('lobby-list');
  const cntEl         = document.getElementById('lobby-count');
  const sumEl         = document.getElementById('lobby-sum');
  const avgEl         = document.getElementById('lobby-avg');
  const btnClearLobby = document.getElementById('btn-clear-lobby');
  const controlArea   = document.getElementById('control-area');
  const teamsArea     = document.getElementById('teams-area');
  const team1List     = document.getElementById('team1-list');
  const team2List     = document.getElementById('team2-list');
  const team1Sum      = document.getElementById('team1-sum');
  const team2Sum      = document.getElementById('team2-sum');
  const btnBalance    = document.getElementById('btn-balance');
  const sizeSelect    = document.getElementById('teamsize');
  const resultArea    = document.getElementById('result-area');
  const winnerSel     = document.getElementById('winner');
  const mvpSel        = document.getElementById('mvp');
  const penaltiesInp  = document.getElementById('penalties');
  const btnSave       = document.getElementById('btn-save');
  const btnRefresh    = document.getElementById('btn-refresh');

  // 1) Завантаження
  btnLoad.onclick = () => {
    fetch(makeCsvUrl(document.getElementById('league').value))
      .then(r=>r.text())
      .then(txt=>{
        players = txt.split('\n').slice(1).map(l=>{
          const [_,nick,pts] = l.split(',');
          const p = parseInt(pts,10)||0;
          let rank = p<200?'D':p<500?'C':p<800?'B':p<1200?'A':'S';
          return {nick:nick.trim(),pts:p,rank};
        }).filter(x=>x.nick);
        selected = [];
        lobby = [];
        renderSelect();
      })
      .catch(console.error);
  };

  function renderSelect(){
    selectArea.style.display = 'block';
    selectList.innerHTML = players.map((p,i)=>
      `<li><label><input type="checkbox" data-idx="${i}"> ${p.nick} (${p.pts}) – ${p.rank}</label></li>`
    ).join('');
    selectList.querySelectorAll('input').forEach(cb=>cb.onchange = e=>{
      const p = players[+e.target.dataset.idx];
      selected = e.target.checked
        ? [...selected, p]
        : selected.filter(x=>x!==p);
    });
  }

  // 2) Додати у лоббі
  btnAddSel.onclick = () => {
    lobby = [...lobby, ...selected.filter(p=>!lobby.includes(p))];
    renderLobby();
  };
  btnClearSel.onclick = ()=>{ selected=[]; selectList.querySelectorAll('input').forEach(cb=>cb.checked=false); };

  function renderLobby(){
    lobbyArea.style.display = 'block';
    controlArea.style.display = 'flex';
    teamsArea.style.display = 'none';
    resultArea.style.display = 'none';
    lobbyList.innerHTML = lobby.map(p=>`<li>${p.nick} (${p.pts}) – ${p.rank}</li>`).join('');
    const total = lobby.reduce((s,p)=>s+p.pts,0);
    cntEl.textContent = lobby.length;
    sumEl.textContent = total;
    avgEl.textContent = lobby.length ? (total/lobby.length).toFixed(1) : 0;
  }
  btnClearLobby.onclick = ()=>{ lobby=[]; renderLobby(); };

  // 3) Авто-баланс
  btnBalance.onclick = () => {
    teamsArea.style.display = 'block';
    resultArea.style.display = 'none';
    let subset = [...lobby];
    if(sizeSelect.value!=='all') subset=subset.slice(0,sizeSelect.value*2);
    const combos=[]; let md=Infinity;
    const tot = 1<<subset.length;
    for(let m=1; m<tot-1; m++){
      const t1=[],t2=[];
      subset.forEach((p,i)=>(m&(1<<i)?t1:t2).push(p));
      if(Math.abs(t1.length-t2.length)>1) continue;
      const d = Math.abs(sum(t1)-sum(t2));
      if(d<md){md=d; combos.length=0; combos.push({t1,t2});}
      else if(d===md) combos.push({t1,t2});
    }
    const {t1,t2}=combos[Math.floor(Math.random()*combos.length)];
    displayTeams(t1,t2);
  };

  function displayTeams(t1,t2){
    team1List.innerHTML = t1.map(p=>`<li>${p.nick} (${p.pts})</li>`).join('');
    team2List.innerHTML = t2.map(p=>`<li>${p.nick} (${p.pts})</li>`).join('');
    team1Sum.textContent = sum(t1); team2Sum.textContent = sum(t2);
    mvpSel.innerHTML = [...t1,...t2].map(p=>`<option>${p.nick}</option>`).join('');
    resultArea.style.display = 'block';
  }

  function sum(a){return a.reduce((s,p)=>s+p.pts,0)}

  // 4) Save Results
  btnSave.onclick = () => {
    const data = {
      league: document.getElementById('league').value,
      team1: [...team1List.children].map(li=>li.textContent).join(', '),
      team2: [...team2List.children].map(li=>li.textContent).join(', '),
      winner: winnerSel.value,
      mvp: mvpSel.value,
      penalties: penaltiesInp.value
    };
    const body = Object.entries(data).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    fetch(proxyUrl, {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body})
      .then(r=>r.text()).then(t=>{alert(t); btnLoad.click();});
  };
  btnRefresh.onclick = ()=>btnLoad.click();
});
