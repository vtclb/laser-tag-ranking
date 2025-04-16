let players = [];
let lobbyPlayers = [];

const sheetUrls = {
  kids: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1648067737&single=true&output=csv",
  sunday: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSzum1H-NSUejvB_XMMWaTs04SPz7SQGpKkyFwz4NQjsN8hz2jAFAhl-jtRdYVAXgr36sN4RSoQSpEN/pub?gid=1286735969&single=true&output=csv"
};

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
      displayPlayers();
    })
    .catch(err => alert("Помилка при завантаженні гравців: " + err));
}

function displayPlayers() {
  const list = document.getElementById("players-list");
  list.innerHTML = "<h3>Оберіть гравців для лоббі:</h3>";
  list.innerHTML += players.map((p, i) =>
    `<label style="display:block; margin: 3px 0;">
      <input type="checkbox" value="${i}" onchange="updateLobby()"> ${p.nickname} (${p.points} балів)
    </label>`
  ).join("");
}

function updateLobby() {
  const checkboxes = document.querySelectorAll("#players-list input:checked");
  lobbyPlayers = Array.from(checkboxes).map(cb => players[parseInt(cb.value)]);
  const lobby = document.getElementById("lobby");
  lobby.innerHTML = "<strong>У лоббі:</strong><br>" + lobbyPlayers.map(p => `${p.nickname} (${p.points})`).join(", ");
}

function autoBalance() {
  const teamCount = parseInt(document.getElementById("team-count").value);
  if (lobbyPlayers.length < teamCount) {
    alert("Недостатньо гравців для " + teamCount + " команд.");
    return;
  }

  if (teamCount === 2) {
    const best = getBestBalanceForTwoTeams(lobbyPlayers);
    displayTeams(best);
  } else {
    alert("Поки реалізовано лише автобаланс на 2 команди.");
  }
}

function getBestBalanceForTwoTeams(players) {
  const totalCombinations = 1 << players.length;
  let minDiff = Infinity;
  let bestCombos = [];

  for (let i = 1; i < totalCombinations - 1; i++) {
    const team1 = [], team2 = [];
    for (let j = 0; j < players.length; j++) {
      if (i & (1 << j)) team1.push(players[j]);
      else team2.push(players[j]);
    }
    if (Math.abs(team1.length - team2.length) > 1) continue;

    const sum1 = team1.reduce((s, p) => s + p.points, 0);
    const sum2 = team2.reduce((s, p) => s + p.points, 0);
    const diff = Math.abs(sum1 - sum2);

    if (diff < minDiff) {
      minDiff = diff;
      bestCombos = [{ team1, team2 }];
    } else if (diff === minDiff) {
      bestCombos.push({ team1, team2 });
    }
  }

  return bestCombos[Math.floor(Math.random() * bestCombos.length)];
}

function displayTeams({ team1, team2 }) {
  const div = document.getElementById("teams-display");
  const sum1 = team1.reduce((s, p) => s + p.points, 0);
  const sum2 = team2.reduce((s, p) => s + p.points, 0);
  window.lastTeam1 = team1;
  window.lastTeam2 = team2;

  div.innerHTML = `
    <div style="display:flex; justify-content: space-around;">
      <div><h3>Команда 1 (∑ ${sum1})</h3><ul>
        ${team1.map(p => `<li>${p.nickname} (${p.points})</li>`).join("")}
      </ul></div>
      <div><h3>Команда 2 (∑ ${sum2})</h3><ul>
        ${team2.map(p => `<li>${p.nickname} (${p.points})</li>`).join("")}
      </ul></div>
    </div>
  `;

  const mvpSelect = document.getElementById("mvp");
  mvpSelect.innerHTML = [...team1, ...team2]
    .map(p => `<option value="${p.nickname}">${p.nickname}</option>`)
    .join("");

  document.getElementById("results").style.display = "block";
}

function exportResults() {
  const winner = document.getElementById("winner").value || "Нічия";
  const mvp = document.getElementById("mvp").value;
  const penaltyText = document.getElementById("penalty").value;

  const payload = {
    league: document.getElementById("league").value,
    team1: window.lastTeam1.map(p => p.nickname),
    team2: window.lastTeam2.map(p => p.nickname),
    winner: winner,
    mvp: mvp,
    penalties: penaltyText.split(",").map(s => s.trim())
  };

  fetch("https://script.google.com/macros/s/AKfycbx-O8cd8NWEaZbNzV5UrpGpfnZz_qPyQ_EV3roWGLivLDCrlRM72hqGdjUCIBs_tHwZTw/exec", {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ contents: payload })
  })
  .then(() => {
    alert("✅ Результат збережено!");
    document.getElementById("results").style.display = "none";
  })
  .catch(err => alert("❌ Помилка збереження: " + err));
}
