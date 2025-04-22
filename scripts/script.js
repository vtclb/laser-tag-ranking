window.addEventListener('DOMContentLoaded', () => {
  const proxyUrl = 'https://laser-proxy.vartaclub.workers.dev';
  function makeCsvUrl(league) {
    return `${proxyUrl}?league=${league}&t=${Date.now()}`;
  }

  let players = [];
  let lobby = [];

  // DOM
  const btnLoad      = document.getElementById('btn-load');
  const lobbyArea    = document.getElementById('lobby-area');
  const list         = document.getElementById('lobby-list');
  const cntEl        = document.getElementById('lobby-count');
  const sumEl        = document.getElementById('lobby-sum');
  const avgEl        = document.getElementById('lobby-avg');
  const btnAddAll    = document.getElementById('btn-add-all');
  const btnClear     = document.getElementById('btn-clear-lobby');
  const btnBalance   = document.getElementById('btn-balance');
  const sizeSelect   = document.getElementById('teamsize');
  const teamsArea    = document.getElementById('teams-area');
  const team1List    = document.getElementById('team1-list');
  const team2List    = document.getElementById('team2-list');
  const team1Sum     = document.getElementById('team1-sum');
  const team2Sum     = document.getElementById('team2-sum');
  const resultArea   = document.getElementById('result-area');
  const winnerSel    = document.getElementById('winner');
  const mvpSel       = document.getElementById('mvp');
  const penaltiesInp = document.getElementById('penalties');
  const btnSave      = document.getElementById('btn-save');
  const btnRefresh   = document.getElementById('btn-refresh');

  // Завантажити гравців
  btnLoad.onclick = () => {
    const league = document.getElementById('league').value;
    fetch(makeCsvUrl(league))
      .then(r => r.text())
      .then(txt => {
        players = txt.trim().split('\n').slice(1).map(line => {
          const [ , nick, pts ] = line.split(',');
          const p = +pts || 0;
          let rank;
          if (p < 200) rank = 'D';
          else if (p < 500) rank = 'C';
          else if (p < 800) rank = 'B';
          else if (p < 1200) rank = 'A';
          else rank = 'S';
          return { nick: nick.trim(), pts: p, rank };
        });
        lobby = [];
        renderLobby();
      })
      .catch(e => console.error('Load error:', e));
  };

  function renderLobby() {
    lobbyArea.style.display = 'block';
    document.getElementById('control-area').style.display = 'flex';
    teamsArea.style.display = 'none';
    resultArea.style.display = 'none';

    list.innerHTML = players.map((p,i) =>
      `<li><label><input type="checkbox" data-idx="${i}" /> ${p.nick} (${p.pts}) – ${p.rank}</label></li>`
    ).join('');

    cntEl.textContent = lobby.length;
    sumEl.textContent = lobby.reduce((s,p)=>s+p.pts,0);
    avgEl.textContent = lobby.length ? (sumEl.textContent/lobby.length).toFixed(1) : 0;

    list.querySelectorAll('input').forEach(cb => {
      cb.onchange = e => {
        const idx = +e.target.dataset.idx;
        if (e.target.checked) lobby.push(players[idx]);
        else lobby = lobby.filter(p=>p!==players[idx]);
        cntEl.textContent = lobby.length;
        sumEl.textContent = lobby.reduce((s,p)=>s+p.pts,0);
        avgEl.textContent = lobby.length ? (sumEl.textContent/lobby.length).toFixed(1) : 0;
      };
    });
  }

  // Автобаланс
  btnBalance.onclick = () => {
    teamsArea.style.display = 'block';
    resultArea.style.display = 'none';
    let subset = [...lobby];
    if (sizeSelect.value !== 'all') subset = subset.slice(0, sizeSelect.value*2);

    const combos = []; let md = Infinity;
    const total = 1 << subset.length;
    for (let m=1; m<total-1; m++) {
      const t1=[], t2=[];
      subset.forEach((p,i)=>(m&(1<<i)?t1:t2).push(p));
      if (Math.abs(t1.length-t2.length)>1) continue;
      const d = Math.abs(sum(t1)-sum(t2));
      if (d<md) { md=d; combos.length=0; combos.push({t1,t2}); }
      else if (d===md) combos.push({t1,t2});
    }
    const {t1,t2} = combos[Math.floor(Math.random()*combos.length)];
    displayTeams(t1,t2);
  };

  function displayTeams(t1,t2) {
    team1List.innerHTML = t1.map(p=>`<li>${p.nick} (${p.pts})</li>`).join('');
    team2List.innerHTML = t2.map(p=>`<li>${p.nick} (${p.pts})</li>`).join('');
    team1Sum.textContent = sum(t1);
    team2Sum.textContent = sum(t2);

    // результати
    mvpSel.innerHTML = [...t1,...t2].map(p=>`<option value="${p.nick}">${p.nick}</option>`).join('');
    resultArea.style.display = 'block';
  }

  function sum(arr){return arr.reduce((s,p)=>s+p.pts,0)}

  // Збереження
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
      .then(r=>r.text()).then(t=>{alert(t);btnLoad.click();});
  };

  btnRefresh.onclick = () => btnLoad.click();
});
