window.addEventListener('DOMContentLoaded', () => {
  const proxyUrl = 'https://laser-proxy.vartaclub.workers.dev';
  const makeCsvUrl = league => `${proxyUrl}?league=${league}&t=${Date.now()}`;

  let players = [], selected = [], lobby = [], team1 = [], team2 = [];
  let combos = [], comboIndex = 0;

  // Helper
  const el = id => document.getElementById(id);

  // DOM elements
  const btnLoad = el('btn-load');
  const selectArea = el('select-area');
  const selectList = el('select-list');
  const btnAddSel = el('btn-add-selected');
  const btnClearSel = el('btn-clear-selected');
  const lobbyArea = el('lobby-area');
  const lobbyList = el('lobby-list');
  const cntEl = el('lobby-count');
  const sumEl = el('lobby-sum');
  const avgEl = el('lobby-avg');
  const btnClearL = el('btn-clear-lobby');
  const ctrlArea = el('control-area');
  const btnAuto = el('btn-auto');
  const btnManual = el('btn-manual');
  const sizeSelect = el('teamsize');
  const teamsArea = el('teams-area');
  const team1List = el('team1-list');
  const team2List = el('team2-list');
  const team1Sum = el('team1-sum');
  const team2Sum = el('team2-sum');
  const resArea = el('result-area');
  const winnerSel = el('winner');
  const mvpSel = el('mvp');
  const penaltiesInp = el('penalties');
  const btnSave = el('btn-save');
  const btnRefresh = el('btn-refresh');

  // Load players
  btnLoad.onclick = () => {
    fetch(makeCsvUrl(el('league').value))
      .then(r => r.text())
      .then(txt => {
        players = txt.trim().split('\n').slice(1).map(line => {
          const parts = line.split(',');
          const nick = parts[1]?.trim();
          const pts = parseInt(parts[2], 10) || 0;
          const rank = pts < 200 ? 'D' : pts < 500 ? 'C' : pts < 800 ? 'B' : pts < 1200 ? 'A' : 'S';
          return { nick, pts, rank };
        }).filter(p => p.nick);
        selected = []; lobby = []; team1 = []; team2 = [];
        renderSelect();
      })
      .catch(e => console.error('Load error:', e));
  };

  function renderSelect() {
    selectArea.style.display = 'block';
    ctrlArea.style.display = 'none';
    teamsArea.style.display = 'none';
    resArea.style.display = 'none';
    selectList.innerHTML = players.map((p,i) =>
      `<li><label><input type="checkbox" data-index="${i}" /> ${p.nick} (${p.pts}) – ${p.rank}</label></li>`
    ).join('');
    selectList.querySelectorAll('input').forEach(cb => cb.onchange = e => {
      const p = players[+e.target.dataset.index];
      selected = e.target.checked ? [...selected, p] : selected.filter(x => x !== p);
    });
  }

  btnAddSel.onclick = () => { lobby = [...lobby, ...selected.filter(p => !lobby.includes(p))]; renderLobby(); };
  btnClearSel.onclick = () => { selected = []; selectList.querySelectorAll('input').forEach(cb => cb.checked = false); };

  function renderLobby() {
    lobbyArea.style.display = 'block';
    ctrlArea.style.display = 'flex';
    teamsArea.style.display = 'none';
    resArea.style.display = 'none';
    lobbyList.innerHTML = lobby.map((p,i) => `<li>${p.nick} (${p.pts}) – ${p.rank}</li>`).join('');
    const total = lobby.reduce((s,p) => s + p.pts, 0);
    cntEl.textContent = lobby.length;
    sumEl.textContent = total;
    avgEl.textContent = lobby.length ? (total / lobby.length).toFixed(1) : 0;
    combos = []; comboIndex = 0;
  }
  btnClearL.onclick = () => { lobby = []; renderLobby(); };

  // Auto-balance with new combos on each click
  btnAuto.onclick = () => {
    teamsArea.style.display = 'block';
    resArea.style.display = 'none';
    let subset = [...lobby];
    if (sizeSelect.value !== 'all') subset = subset.slice(0, +sizeSelect.value * 2);

    // Recompute combos always to get fresh arrangements
    combos = [];
    let md = Infinity;
    const tot = 1 << subset.length;
    for (let m = 1; m < tot - 1; m++) {
      const a = [], b = [];
      subset.forEach((p,i) => m & (1<<i) ? a.push(p) : b.push(p));
      if (Math.abs(a.length - b.length) > 1) continue;
      const d = Math.abs(sum(a) - sum(b));
      if (d < md) { md = d; combos = [{a,b}]; }
      else if (d === md) combos.push({a,b});
    }
    if (combos.length === 1) combos.push({a:combos[0].b, b:combos[0].a});

    const {a, b} = combos[comboIndex % combos.length];
    comboIndex++;
    team1 = a; team2 = b;
    displayTeams();
  };

  // Manual assignment
  btnManual.onclick = () => {
    teamsArea.style.display = 'block';
    resArea.style.display = 'none';
    team1 = []; team2 = [];
    renderManual();
  };

  function renderManual() {
    lobbyList.innerHTML = lobby.map((p,i) =>
      `<li>${p.nick} (${p.pts}) – ${p.rank}
         <button data-team="1" data-index="${i}">→1</button>
         <button data-team="2" data-index="${i}">→2</button>
       </li>`
    ).join('');
    lobbyList.querySelectorAll('button').forEach(btn => btn.onclick = e => {
      const idx = +e.target.dataset.index;
      const t = e.target.dataset.team;
      const p = lobby[idx];
      lobby.splice(idx,1);
      if (t === '1') team1.push(p);
      else team2.push(p);
      renderManual(); renderTeams();
    });
  }

  function displayTeams() {
    renderTeams();
    resArea.style.display = 'block';
  }

  function renderTeams() {
    team1List.innerHTML = team1.map((p,i) =>
      `<li>${p.nick} (${p.pts}) <button class="remove-team" data-team="1" data-index="${i}">X</button></li>`
    ).join('');
    team2List.innerHTML = team2.map((p,i) =>
      `<li>${p.nick} (${p.pts}) <button class="remove-team" data-team="2" data-index="${i}">X</button></li>`
    ).join('');
    team1Sum.textContent = sum(team1);
    team2Sum.textContent = sum(team2);
    document.querySelectorAll('.remove-team').forEach(btn => btn.onclick = e => {
      const t = e.target.dataset.team;
      const i = +e.target.dataset.index;
      const p = t === '1' ? team1.splice(i,1)[0] : team2.splice(i,1)[0];
      lobby.push(p);
      renderLobby(); renderTeams();
    });
    mvpSel.innerHTML = [...team1, ...team2].map(p => `<option>${p.nick}</option>`).join('');
  }

  // Save results
  btnSave.onclick = () => {
    const data = {
      league: el('league').value,
      team1: team1.map(p => p.nick).join(', '),
      team2: team2.map(p => p.nick).join(', '),
      winner: winnerSel.value,
      mvp: mvpSel.value,
      penalties: penaltiesInp.value
    };
    const body = Object.entries(data)
      .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    fetch(proxyUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
      .then(r => r.text()).then(t => { alert(t); btnLoad.click(); });
  };
  btnRefresh.onclick = () => btnLoad.click();

  function sum(arr) { return arr.reduce((s,p) => s + p.pts, 0); }
});
