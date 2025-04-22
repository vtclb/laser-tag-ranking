window.addEventListener('DOMContentLoaded', () => {
  const sheetUrls = {
    kids: 'https://docs.google.com/spreadsheets/d/e/.../pub?gid=1648067737&single=true&output=csv',
    sunday: 'https://docs.google.com/spreadsheets/d/e/.../pub?gid=1286735969&single=true&output=csv'
  };

  let players = [];
  let lobby = [];

  const btnLoad     = document.getElementById('btn-load');
  const lobbyArea   = document.getElementById('lobby-area');
  const lobbyList   = document.getElementById('lobby-list');
  const controlArea = document.getElementById('control-area');
  const modeSelect  = document.getElementById('mode');
  const sizeSelect  = document.getElementById('teamsize');
  const btnBalance  = document.getElementById('btn-balance');
  const teamsArea   = document.getElementById('teams-area');
  const team1List   = document.getElementById('team1-list');
  const team2List   = document.getElementById('team2-list');
  const team1Sum    = document.getElementById('team1-sum');
  const team2Sum    = document.getElementById('team2-sum');
  const winnerSel   = document.getElementById('winner');
  const mvpSel      = document.getElementById('mvp');
  const penaltyInput= document.getElementById('penalty');
  const btnSave     = document.getElementById('btn-save');
  const btnRefresh  = document.getElementById('btn-refresh');

  btnLoad.addEventListener('click', loadPlayers);
  btnBalance.addEventListener('click', runBalance);
  btnSave.addEventListener('click', exportResults);
  btnRefresh.addEventListener('click', loadPlayers);

  function loadPlayers() {
    const league = document.getElementById('league').value;
    const url = sheetUrls[league] + '&t=' + Date.now();
    fetch(url)
      .then(r => r.ok ? r.text() : Promise.reject('Status ' + r.status))
      .then(txt => {
        players = txt.trim().split('\n').slice(1)
          .map(line => {
            const [ , nick, pts] = line.split(',');
            return { nick: nick.trim(), pts: +pts || 0 };
          });
        renderLobby();
      })
      .catch(err => console.error('Load error:', err));
  }

  function renderLobby() {
    lobbyArea.style.display = 'block';
    controlArea.style.display = 'block';
    teamsArea.style.display = 'none';
    lobby = [];
    lobbyList.innerHTML = players.map((p, i) =>
      `<li><label><input type="checkbox" data-idx="${i}" /> ${p.nick} (${p.pts})</label></li>`
    ).join('');
    lobbyList.querySelectorAll('input').forEach(cb =>
      cb.addEventListener('change', e => {
        const idx = +e.target.dataset.idx;
        lobby = e.target.checked
          ? [...lobby, players[idx]]
          : lobby.filter(pl => pl !== players[idx]);
      })
    );
  }

  function runBalance() {
    modeSelect.value === 'auto' ? autoBalance() : manualBalance();
  }

  function autoBalance() {
    let subset = lobby.slice();
    if (sizeSelect.value !== 'all') subset = subset.slice(0, sizeSelect.value * 2);
    const combos = [];
    let md = Infinity;
    const total = 1 << subset.length;
    for (let m = 1; m < total - 1; m++) {
      const t1 = [], t2 = [];
      subset.forEach((p, i) => (m & (1 << i) ? t1.push(p) : t2.push(p)));
      if (Math.abs(t1.length - t2.length) > 1) continue;
      const d = Math.abs(sum(t1) - sum(t2));
      if (d < md) { md = d; combos.length = 0; combos.push({ t1, t2 }); }
      else if (d === md) combos.push({ t1, t2 });
    }
    const { t1, t2 } = combos[Math.floor(Math.random() * combos.length)];
    displayTeams(t1, t2);
  }

  function manualBalance() {
    const mid = Math.ceil(lobby.length / 2);
    displayTeams(lobby.slice(0, mid), lobby.slice(mid));
  }

  function sum(arr) { return arr.reduce((s, p) => s + p.pts, 0); }

  function displayTeams(t1, t2) {
    teamsArea.style.display = 'block';
    team1List.innerHTML = t1.map(p => `<li>${p.nick} (${p.pts})</li>`).join('');
    team2List.innerHTML = t2.map(p => `<li>${p.nick} (${p.pts})</li>`).join('');
    team1Sum.textContent = sum(t1);
    team2Sum.textContent = sum(t2);

    winnerSel.innerHTML = `
      <option value="team1">Команда 1</option>
      <option value="team2">Команда 2</option>
      <option value="tie">Дружба</option>
    `;
    mvpSel.innerHTML = [...t1, ...t2]
      .map(p => `<option value="${p.nick}">${p.nick}</option>`)
      .join('');
  }

  function exportResults() {
    const data = {
      league: document.getElementById('league').value,
      team1: [...team1List.children].map(li => li.textContent).join(', '),
      team2: [...team2List.children].map(li => li.textContent).join(', '),
      winner: winnerSel.value,
      mvp: mvpSel.value,
      penalties: penaltyInput.value
    };
    const body = Object.entries(data)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    fetch('https://laser-proxy.vartaclub.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })
      .then(r => r.text())
      .then(t => alert('Result: ' + t));
  }
});
