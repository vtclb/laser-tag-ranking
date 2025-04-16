let players = [];
let selectedPlayers = [];
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
      displayPlayers();
    })
    .catch(err => alert("Помилка при завантаженні гравців: " + err));
}

function displayPlayers() {
  const list = document.getElementById("players-list");
  list.innerHTML = "<h3>Оберіть гравців (до 16):</h3>" + players.map((p, i) =>
    `<label style="display:block; margin: 3px 0;">
      <input type="checkbox" value="${i}"> ${p.nickname} (${p.points} балів)
    </label>`
  ).join("");
  document.getElementById("lobby-section").classList.remove("hidden");
}

function balanceTeams() {
  selectedPlayers = Array.from(document.querySelectorAll("#players-list input:checked"))
    .map(input => players[parseInt(input.value)]);

  if (selectedPlayers.length < 2 || selectedPlayers.length > 16) {
    alert("Оберіть від 2 до 16 гравців!");
    return;
  }

  teamCount = parseInt(document.getElementById("team-count").value);
  const teams = Array.from({ length: teamCount }, () => []);
  const sorted = [...selectedPlayers].sort((a, b) => b.points - a.points);
  sorted.forEach((p, i) => teams[i % teamCount].push(p));
  displayTeams(teams);
  prepareMVPandPenalty();
  document.getElementById("results-section").classList.remove("hidden");
}

function displayTeams(teams) {
  const div = document.getElementById("teams-display");
  div.innerHTML = teams.map((team, i) => {
    const sum = team.reduce((acc, p) => acc + p.points, 0);
    return `
      <div style="margin-bottom:20px;">
        <h3>Команда ${i + 1} (∑ ${sum})</h3>
        <ul>${team.map(p => `<li>${p.nickname} (${p.points})</li>`).join("")}</ul>
      </div>`;
  }).join("");
  div.classList.remove("hidden");
}

function prepareMVPandPenalty() {
  const mvpSelect = document.getElementById("mvp");
  mvpSelect.innerHTML = "";
  selectedPlayers.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.nickname;
    opt.textContent = p.nickname;
    mvpSelect.appendChild(opt);
  });
}

function exportResults() {
  const winner = document.getElementById("winner").value || "Нічия";
  const mvp = document.getElementById("mvp").value;
  const penaltyInput = document.getElementById("penalty").value;

  let penalties = "Жодного";
  if (penaltyInput.trim()) {
    penalties = penaltyInput;
  }

  alert(`Результат збережено:
• Перемога: ${winner}
• MVP: ${mvp}
• Штрафи: ${penalties}`);
}
