let players = [];
let lobbyPlayers = [];
let lastTeam1 = [], lastTeam2 = [];

const sheetUrls = {
  kids: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1648067737&single=true&output=csv",
  sunday: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1286735969&single=true&output=csv"
};

document.getElementById("loadBtn").addEventListener("click", loadPlayers);
document.getElementById("autoBtn").addEventListener("click", autoBalance);
document.getElementById("exportBtn").addEventListener("click", exportResults);

function loadPlayers() {
  const league = document.getElementById("league").value;
  fetch(sheetUrls[league])
    .then(res => res.text())
    .then(data => {
      const rows = data.split("\n").slice(1);
      players = rows.map(row => {
        const cols = row.includes(",") ? row.split(",") : row.split(";");
        return { nickname: cols[1]?.trim(), points: parseInt(cols[2]) };
      }).filter(p => p.nickname && !isNaN(p.points));
      renderPlayerList();
    })
    .catch(err => alert("❌ Помилка: " + err));
}

function renderPlayerList() {
  const div = document.getElementById("players-list");
  div.innerHTML = players.map((p, i) => `
    <label style="display:block">
      <input type="checkbox" value="${i}" onchange="updateLobby()"> ${p.nickname} (${p.points})
    </label>
  `).join("");
}

function updateLobby() {
  const checks = document.querySelectorAll("#players-list input:checked");
  lobbyPlayers = Array.from(checks).map(cb => players[parseInt(cb.value)]);
  document.getElementById("lobby").innerHTML = lobbyPlayers.map(p => `${p.nickname} (${p.points})`).join(", ");
}

function autoBalance() {
  if (lobbyPlayers.length < 2) return alert("Мінімум 2 гравці для балансу!");

  const best = getBestBalanceForTwoTeams(lobbyPlayers);
  lastTeam1 = best.team1;
  lastTeam2 = best.team2;
  displayTeams(best.team1, best.team2);
}

function getBestBalanceForTwoTeams(players) {
  const totalCombinations = 1 << players.length;
  let minDiff = Infinity;
  let bestCombos = [];

  for (let i = 1; i < totalCombinations - 1; i++) {
    const t1 = [], t2 = [];
    for (let j = 0; j < players.length; j++) {
      if (i & (1 << j)) t1.push(players[j]);
      else t2.push(players[j]);
    }
    if (Math.abs(t1.length - t2.length) > 1) continue;
    const sum1 = t1.reduce((s, p) => s + p.points, 0);
    const sum2 = t2.reduce((s, p) => s + p.points, 0);
    const diff = Math.abs(sum1 - sum2);
    if (diff < minDiff) {
      minDiff = diff;
      bestCombos = [{ team1: t1, team2: t2 }];
    } else if (diff === minDiff) {
      bestCombos.push({ team1: t1, team2: t2 });
    }
  }

  return bestCombos[Math.floor(Math.random() * bestCombos.length)];
}

function displayTeams(team1, team2) {
  const sum1 = team1.reduce((s, p) => s + p.points, 0);
  const sum2 = team2.reduce((s, p) => s + p.points, 0);
  const div = document.getElementById("teams-display");
  div.innerHTML = `
    <div style="display:flex; justify-content: space-around;">
      <div><h3>Команда 1 (∑ ${sum1})</h3><ul>${team1.map(p => `<li>${p.nickname} (${p.points})</li>`).join("")}</ul></div>
      <div><h3>Команда 2 (∑ ${sum2})</h3><ul>${team2.map(p => `<li>${p.nickname} (${p.points})</li>`).join("")}</ul></div>
    </div>
  `;

  const mvp = document.getElementById("mvp");
  mvp.innerHTML = [...team1, ...team2].map(p => `<option value="${p.nickname}">${p.nickname}</option>`).join("");

  document.getElementById("results").style.display = "block";
}

function exportResults() {
  const payload = {
    league: document.getElementById("league").value,
    team1: lastTeam1.map(p => p.nickname),
    team2: lastTeam2.map(p => p.nickname),
    winner: document.getElementById("winner").value,
    mvp: document.getElementById("mvp").value,
    penalties: document.getElementById("penalty").value
  };

  fetch("https://script.google.com/macros/s/AKfycbx-O8cd8NWEaZbNzV5UrpGpfnZz_qPyQ_EV3roWGLivLDCrlRM72hqGdjUCIBs_tHwZTw/exec", {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: payload })
  }).then(() => {
    alert("✅ Результат збережено!");
    document.getElementById("results").style.display = "none";
  }).catch(err => alert("❌ Помилка: " + err));
}
