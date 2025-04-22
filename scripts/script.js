const sheetUrls = {
  kids: "https://docs.google.com/spreadsheets/d/e/.../pub?gid=1648067737&single=true&output=csv",
  sunday: "https://docs.google.com/spreadsheets/d/e/.../pub?gid=1286735969&single=true&output=csv"
};

let players = [];
let lobbyPlayers = [];

// Завантаження гравців із кеш-бастером
function loadPlayers() {
  const league = document.getElementById('league').value;
  fetch(sheetUrls[league] + '?t=' + Date.now())
    .then(r => r.text())
    .then(txt => {
      const rows = txt.split('\n').slice(1);
      players = rows.map(r => {
        const cols = r.split(',');
        return { nickname: cols[1]?.trim(), points: +cols[2] || 0 };
      }).filter(p => p.nickname);
      showLobby();
    });
}

// Показ лоббі
function showLobby() {
  document.getElementById('lobby-area').style.display = 'block';
  const list = document.getElementById('players-list');
  list.innerHTML = players.map((p,i) =>
    `<label><input type="checkbox" value="${i}" onchange="selectLobby()"> ${p.nickname} (${p.points})</label>`
  ).join('');
  document.getElementById('team-control').style.display = 'block';
}

function selectLobby() {
  lobbyPlayers = Array.from(
    document.querySelectorAll('#players-list input:checked')
  ).map(cb => players[+cb.value]);
}

// Запуск балансу (auto/manual)
function runBalance() {
  const mode = document.getElementById('balance-mode').value;
  const sizeOpt = document.getElementById('team-size').value;
  if (mode === 'auto') autoBalance(sizeOpt);
  else manualAssign();
}

// Автобаланс із вибраним розміром
function autoBalance(opt) {
  let countPerTeam;
  if (opt === 'all') countPerTeam = Math.floor(lobbyPlayers.length/2);
  else countPerTeam = +opt;
  // Беремо перші countPerTeam*2 гравців + решта і балансуємо
  const subset = lobbyPlayers.slice(0, countPerTeam*2);
  const best = getBestBalanceForTwoTeams(subset);
  displayTeams({ team1: best.team1, team2: best.team2 });
}

// ... getBestBalanceForTwoTeams та displayTeams без змін ...

// --- Ручний розподіл через селект ---
function manualAssign() {
  document.getElementById('manual-assign-area').style.display = 'block';
  const tbody = document.querySelector('#manual-table tbody');
  tbody.innerHTML = lobbyPlayers.map((p,i) =>
    `<tr>
      <td>${p.nickname}</td>
      <td>${p.points}</td>
      <td>
        <select class="team-select" data-index="${i}">
          <option value="">–</option>
          <option value="1">Команда 1</option>
          <option value="2">Команда 2</option>
        </select>
      </td>
    </tr>`
  ).join('');
  document.getElementById('sum-team1').textContent = '0';
  document.getElementById('sum-team2').textContent = '0';
}

function updateManualTeams() {
  const team1 = [], team2 = [];
  document.querySelectorAll('.team-select').forEach(sel => {
    const idx = +sel.dataset.index;
    if (sel.value === '1') team1.push(lobbyPlayers[idx]);
    if (sel.value === '2') team2.push(lobbyPlayers[idx]);
  });
  document.getElementById('sum-team1').textContent = team1.reduce((s,p)=>s+p.points,0);
  document.getElementById('sum-team2').textContent = team2.reduce((s,p)=>s+p.points,0);
  window.lastTeam1 = team1;
  window.lastTeam2 = team2;
}

function confirmManual() {
  updateManualTeams();
  displayTeams({ team1: window.lastTeam1, team2: window.lastTeam2 });
}

// --- Збереження результатів ---
function exportResults() {
  const data = {
    league: document.getElementById('league').value,
    team1: window.lastTeam1.map(p=>p.nickname).join(', '),
    team2: window.lastTeam2.map(p=>p.nickname).join(', '),
    winner: document.getElementById('winner').value||'Нічия',
    mvp: document.getElementById('mvp').value,
    penalties: document.getElementById('penalty').value
  };
  const body = Object.entries(data).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  fetch('https://laser-proxy.vartaclub.workers.dev',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body})
    .then(r=>r.text()).then(txt=>{
      alert(`Результат: ${txt}`);
      if(txt==='OK') loadPlayers();
    });
}
