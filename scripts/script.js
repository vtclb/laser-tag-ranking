window.addEventListener('DOMContentLoaded', () => {
  const proxyUrl = 'https://laser-proxy.vartaclub.workers.dev';
  const makeCsvUrl = league => `${proxyUrl}?league=${league}&t=${Date.now()}`;

  let players = [], selected = [], lobby = [], team1 = [], team2 = [];
  let combos = [], comboIndex = 0;
  let manualMode = false;

  const el = id => document.getElementById(id);
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

  // Load players and reset all lists
  btnLoad.onclick = () => {
    fetch(makeCsvUrl(el('league').value))
      .then(resp => resp.text())
      .then(txt => {
        const lines = txt.trim().split('\n');
        players = lines.slice(1).map(line => {
          const parts = line.split(',');
          const nick = (parts[1] || '').trim();
          const pts = parseInt(parts[2], 10) || 0;
          const rank = pts < 200 ? 'D' : pts < 500 ? 'C' : pts < 800 ? 'B' : pts < 1200 ? 'A' : 'S';
          return { nick, pts, rank };
        }).filter(p => p.nick);
        selected = []; lobby = []; team1 = []; team2 = []; manualMode = false;
        renderSelect();
      })
      .catch(err => console.error('Load error:', err));
  };

  function renderSelect() {
    selectArea.style.display = 'block';
    ctrlArea.style.display = 'none';
    teamsArea.style.display = 'none';
    resArea.style.display = 'none';

    selectList.innerHTML = players.map((p, i) =>
      `<li><label><input type="checkbox" data-index="${i}" /> ${p.nick} (${p.pts}) – ${p.rank}</label></li>`
    ).join('');

    selectList.querySelectorAll('input').forEach(cb => cb.onchange = e => {
      const p = players[+e.target.dataset.index];
      selected = e.target.checked ? [...selected, p] : selected.filter(x => x !== p);
    });
  }

  btnAddSel.onclick = () => { lobby = [...lobby, ...selected.filter(p => !lobby.includes(p))]; updateLobbyList(); };
  btnClearSel.onclick = () => { selected = []; selectList.querySelectorAll('input').forEach(cb => cb.checked = false); };

  function updateLobbyList() {
    selectArea.style.display = 'none';
    lobbyArea.style.display = 'block';
    ctrlArea.style.display = 'flex';
    teamsArea.style.display = manualMode ? 'block' : 'none';
    resArea.style.display = 'none';

    lobbyList.innerHTML = lobby.map(p => `<li>${p.nick} (${p.pts}) – ${p.rank}</li>`).join('');
    const total = lobby.reduce((s, p) => s + p.pts, 0);
    cntEl.textContent = lobby.length;
    sumEl.textContent = total;
    avgEl.textContent = lobby.length ? (total / lobby.length).toFixed(1) : 0;
    combos = []; comboIndex = 0;
  }

  btnClearL.onclick = () => { lobby = []; updateLobbyList(); };

  btnAuto.onclick = () => {
    manualMode = false;
    updateLobbyList();
    let subset = [...lobby];
    if (sizeSelect.value !== 'all') subset = subset.slice(0, +sizeSelect.value * 2);

    combos = [];
    let minDiff = Infinity;
    const totalComb = 1 << subset.length;
    for (let mask = 1; mask < totalComb - 1; mask++) {
      const a = [], b = [];
      subset.forEach((p, i) => mask & (1 << i) ? a.push(p) : b.push(p));
      if (Math.abs(a.length - b.length) > 1) continue;
      const diff = Math.abs(sum(a) - sum(b));
      if (diff < minDiff) { minDiff = diff; combos = [{ a, b }]; }
      else if (diff === minDiff) combos.push({ a, b });
    }
    if (combos.length === 1) combos.push({ a: combos[0].b, b: combos[0].a });

    const { a, b } = combos[comboIndex % combos.length];
    comboIndex++;
    team1 = a; team2 = b;
    displayTeams();
  };

  btnManual.onclick = () => {
    manualMode = true;
    updateLobbyList();
    team1 = []; team2 = [];
    renderManual();
  };

  function renderManual() {
    lobbyList.innerHTML = lobby.map((p, i) =>
      `<li>${p.nick} (${p.pts}) – ${p.rank} ` +
      `<button data-team="1" data-index="${i}">→1</button> ` +
      `<button data-team="2" data-index="${i}">→2</button></li>`
    ).join('');
    lobbyList.querySelectorAll('button').forEach(btn => btn.onclick = e => {
      const idx = +e.target.dataset.index;
      const t = e.target.dataset.team;
      const player = lobby.splice(idx, 1)[0];
      if (t === '1') team1.push(player); else team2.push(player);
      renderTeams();
    });
  }

  function displayTeams() {
    teamsArea.style.display = 'flex';
    renderTeams();
    resArea.style.display = 'block';
  }

  function renderTeams() {
    team1List.innerHTML = team1.map((p, i) =>
      `<li>${p.nick} (${p.pts}) ` +
      `<button class="remove-team" data-team="1" data-index="${i}">X</button> ` +
      `<button class="swap-team...
