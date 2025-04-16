let players = [];
let lobby = [];
let teamCount = 2;

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
      displayPlayerSelection();
    })
    .catch(err => alert("Помилка при завантаженні: " + err));
}

function displayPlayerSelection() {
  const list = document.getElementById("players-list");
  list.innerHTML = "<h3>Оберіть гравців у лоббі:</h3>";
  list.innerHTML += players.map((p, i) =>
    `<label style="display:block;">
      <input type="checkbox" value="${i}"> ${p.nickname} (${p.points})
    </label>`
  ).join("") +
  `<br><button onclick="addToLobby()">Додати в лоббі</button>`;
}

function addToLobby() {
  lobby = Array.from(document.querySelectorAll("#players-list input:checked"))
    .map(input => players[parseInt(input.value)]);
  document.getElementById("lobby").innerHTML =
    lobby.map(p => `<span style="display:inline-block; margin:5px;">${p.nickname} (${p.points})</span>`).join("");
}

function autoBalance() {
  if (lobby.length < 2) {
    alert("Недостатньо гравців у лоббі!");
    return;
  }

  teamCount = parseInt(document.getElementById("team-count").value);
  const sorted = [...lobby].sort((a, b) => b.points - a.points);
  const teams = Array.from({ length: teamCount }, () => []);

  sorted.forEach((p, i) => {
    teams[i % teamCount].push(p);
  });

  displayTeams(teams);
}

function displayTeams(teams) {
  const container = document.getElementById("teams-display");
  container.innerHTML = teams.map((team, i) => {
    const sum = team.reduce((a, p) => a + p.points, 0);
    return `<h3>Команда ${i + 1} (∑ ${sum})</h3><ul>${
      team.map(p => `<li>${p.nickname} (${p.points})</li>`).join("")
    }</ul>`;
  }).join("");

  const mvp = document.getElementById("mvp");
  mvp.innerHTML = lobby.map(p => `<option value="${p.nickname}">${p.nickname}</option>`).join("");

  document.getElementById("results").style.display = "block";
}

function manualAssign() {
  const manual = document.getElementById("manual-assign-area");
  manual.innerHTML = "<h3>Ручне призначення</h3>";
  manual.innerHTML += lobby.map((p, i) => `
    <label>${p.nickname} (${p.points}) → Команда:
      <select data-index="${i}" onchange="applyManualAssignment()">
        ${[...Array(teamCount)].map((_, idx) =>
          `<option value="${idx}">${idx + 1}</option>`
        ).join("")}
      </select>
    </label><br>
  `).join("");
}

function applyManualAssignment() {
  const selects = document.querySelectorAll("#manual-assign-area select");
  const teams = Array.from({ length: teamCount }, () => []);

  selects.forEach(sel => {
    const teamIdx = parseInt(sel.value);
    const playerIdx = parseInt(sel.dataset.index);
    teams[teamIdx].push(lobby[playerIdx]);
  });

  displayTeams(teams);
}

function exportResults() {
  const winner = document.getElementById("winner").value || "Нічия";
  const mvp = document.getElementById("mvp").value;
  const penaltyRaw = document.getElementById("penalty").value;

  alert(`Збережено результат:\nПереможець: ${winner}\nMVP: ${mvp}\nШтрафи: ${penaltyRaw}`);
}
