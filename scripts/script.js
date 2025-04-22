const sheetUrls = {
  kids:   "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1648067737&single=true&output=csv",
  sunday: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1286735969&single=true&output=csv"
};

let players = [], lobby = [];

// Елементи сторінки
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

// Прив'язка подій
btnLoad.    addEventListener('click', loadPlayers);
btnBalance. addEventListener('click', runBalance);
btnSave.    addEventListener('click', exportResults);
btnRefresh. addEventListener('click', loadPlayers);

// Функція завантаження гравців
function loadPlayers() {
  const league = document.getElementById('league').value;
  const url = sheetUrls[league] + '&t=' + Date.now();
  console.log('▶️ loadPlayers URL:', url);

  fetch(url)
    .then(r => r.text())
    .then(txt => {
      console.log('📄 CSV data:', txt);
      players = txt.trim().split('\n').slice(1).map(row => {
        const cols = row.split(',');
        return { nick: cols[1]?.trim(), pts: parseInt(cols[2], 10) || 0 };
      }).filter(p => p.nick);
      renderLobby();
    })
    .catch(err => console.error('❌ loadPlayers error:', err));
}

// Рендер лоббі
function renderLobby() {
  console.log('▶️ renderLobby, players:', players);
  lobbyArea.style.display   = 'block';
  controlArea.style.display = 'block';
  teamsArea.style.display   = 'none';
  lobbyList.innerHTML = players.map((p,i) =>
    `<li><label><input type="checkbox" value="${i}" onchange="toggleLobby(${i})"> ${p.nick} (${p.pts})</label></li>`
  ).join('');
  lobby = [];
}

// Вибір гравців у лоббі
function toggleLobby(idx) {
  const p = players[idx];
  const i = lobby.indexOf(p);
  if (i > -1) lobby.splice(i, 1);
  else lobby.push(p);
}

// Запуск балансу
function runBalance() {
  if (modeSelect.value === 'auto') autoBalance();
  else manualBalance();
}

// Автобаланс
function autoBalance() {
  let subset = lobby;
  if (sizeSelect.value !== 'all') subset = lobby.slice(0, sizeSelect.value * 2);
  const { team1, team2 } = getBest(subset);
  displayTeams(team1, team2);
}

// Ручне балансування (поділ навпіл)
function manualBalance() {
  const mid = Math.ceil(lobby.length / 2);
  displayTeams(lobby.slice(0, mid), lobby.slice(mid));
}

// Пошук кращого балансу для two teams
function getBest(arr) {
  let best, md = Infinity;
  const tot = 1 << arr.length;
  for (let m = 1; m < tot - 1; m++) {
    const t1 = [], t2 = [];
    arr.forEach((p, i) => (m & (1 << i)) ? t1.push(p) : t2.push(p));
    if (Math.abs(t1.length - t2.length) > 1) continue;
    const d = Math.abs(sum(t1) - sum(t2));
    if (d < md) { md = d; best = { team1: t1, team2: t2 }; }
  }
  return best;
}

// Сума балів масиву гравців
function sum(arr) { return arr.reduce((s, p) => s + p.pts, 0); }

// Відображення команд
function displayTeams(t1, t2) {
  teamsArea.style.display = 'block';
  team1List.innerHTML = t1.map(p => `<li>${p.nick} (${p.pts})</li>`).join('');
  team2List.innerHTML = t2.map(p => `<li>${p.nick} (${p.pts})</li>`).join('');
  team1Sum.textContent = sum(t1);
  team2Sum.textContent = sum(t2);

  // Оновлення селектів переможця та MVP
  const options = `<option value="">Нічия</option>` +
    [...t1, ...t2].map(p => `<option value="${p.nick}">${p.nick}</option>`).join('');
  winnerSel.innerHTML = options;
  mvpSel.innerHTML    = options;
}

// Відправка результатів
function exportResults() {
  const data = {
    league: document.getElementById('league').value,
    team1: [...team1List.children].map(li => li.textContent).join(', '),
    team2: [...team2List.children].map(li => li.textContent).join(', '),
    winner: winnerSel.value,
    mvp: mvpSel.value,
    penalties: penaltyInput.value
  };
  const body = Object.entries(data).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  fetch('https://laser-proxy.vartaclub.workers.dev', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body
  })
  .then(r => r.text())
  .then(t => alert('Result: ' + t))
  .catch(e => console.error('❌ exportResults error:', e));
}
