let players = [];
let lobbyPlayers = [];
let selectedTeams = [];
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
      showPlayersList();
    })
    .catch(err => alert("Помилка при завантаженні гравців: " + err));
}

function showPlayersList() {
  const container = document.getElementById("players-list");
  container.innerHTML = "<h3>Гравці ліги:</h3>";
  container.innerHTML += players.map((p, i) =>
    `<label style="display:block;">
      <input type="checkbox" value="${i}"> ${p.nickname} (${p.points})
    </label>`
  ).join("");
  document.getElementById("lobby-section").style.display = "block";
}

function addToLobby() {
  const selected = Array.from(document.querySelectorAll("#players-list input:checked"))
    .map(input => players[parseInt(input.value)]);
  lobbyPlayers = selected.slice(0, 16);
  updateLobby();
}

function updateLobby() {
  const lobbyDiv = document.getElementById("lobby-players");
  lobbyDiv.innerHTML = lobbyPlayers.map((p, i) =>
    `<div>${p.nickname} (${p.points})</div>`
  ).join("");
}

function balanceTeams() {
  teamCount = parseInt(document.getElementById("team-count").value);
  if (lobbyPlayers.length < teamCount * 2) {
    alert("Недостатньо гравців для балансування.");
    return;
  }

  const sorted = [...lobbyPlayers].sort((a, b) => b.points - a.points);
  selectedTeams = Array.from({ length: teamCount }, () => []);
  sorted.forEach((p, i) => {
    selectedTeams[i % teamCount].push(p);
  });
  displayTeams(selectedTeams);
}

function displayTeams(teams) {
  const div = document.getElementById("teams-display");
  div.innerHTML = teams.map((team, i) => {
    const sum = team.reduce((acc, p) => acc + p.points, 0);
    return `<div>
      <h3>Команда ${i + 1} (∑ ${sum})</h3>
      <ul>${team.map(p => `<li>${p.nickname} (${p.points})</li>`).join("")}</ul>
    </div>`;
  }).join("");

  const mvpSelect = document.getElementById("mvp");
  mvpSelect.innerHTML = "";
  lobbyPlayers.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.nickname;
    opt.textContent = p.nickname;
    mvpSelect.appendChild(opt);
  });

  document.getElementById("results-section").style.display = "block";
}

function exportResults() {
  const winner = document.getElementById("winner").value || "Нічия";
  const mvp = document.getElementById("mvp").value;
  const penaltyRaw = document.getElementById("penalty").value;
  alert(`Результати збережено:\nПереможець: ${winner}\nMVP: ${mvp}\nШтрафи: ${penaltyRaw}`);
}
