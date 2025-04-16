
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
  list.innerHTML = "<h3>Оберіть гравців:</h3>";
  list.innerHTML += players.map((p, i) =>
    \`<label style="display:block; margin: 3px 0;">
      <input type="checkbox" value="\${i}"> \${p.nickname} (\${p.points} балів)
    </label>\`
  ).join("");
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
  sorted.forEach((p, i) => {
    teams[i % teamCount].push(p);
  });

  displayTeams(teams);
  renderManualForm(teams);
}

function displayTeams(teams) {
  const div = document.getElementById("teams-display");
  div.innerHTML = teams.map((team, i) => {
    const sum = team.reduce((acc, p) => acc + p.points, 0);
    return \`
      <div style="margin-bottom:20px;">
        <h3>Команда \${i + 1} (∑ \${sum})</h3>
        <ul>\${team.map(p => "<li>" + p.nickname + " (" + p.points + ")</li>").join("")}</ul>
      </div>\`;
  }).join("");

  const mvpSelect = document.getElementById("mvp");
  const penaltySelect = document.getElementById("penalty");
  mvpSelect.innerHTML = "";
  penaltySelect.innerHTML = "";
  selectedPlayers.forEach(p => {
    const opt1 = document.createElement("option");
    opt1.value = p.nickname;
    opt1.innerText = p.nickname;
    mvpSelect.appendChild(opt1);

    const opt2 = opt1.cloneNode(true);
    penaltySelect.appendChild(opt2);
  });

  document.getElementById("results").style.display = "block";
}

function renderManualForm(teams) {
  const container = document.getElementById("manual-teams-container");
  container.innerHTML = "";
  selectedPlayers.forEach((p, i) => {
    container.innerHTML += \`
      <div>
        <label>\${p.nickname} (\${p.points}) → Команда:
          <select data-index="\${i}" onchange="manualAssignTeams()">
            \${teams.map((_, t) => \`<option value="\${t}">\${t + 1}</option>\`).join("")}
          </select>
        </label>
      </div>
    \`;
  });
}

function manualAssignTeams() {
  const assignments = document.querySelectorAll("#manual-teams-container select");
  const teamMap = Array.from({ length: teamCount }, () => []);
  assignments.forEach(sel => {
    const i = parseInt(sel.dataset.index);
    const team = parseInt(sel.value);
    teamMap[team].push(selectedPlayers[i]);
  });
  displayTeams(teamMap);
}

function exportResults() {
  const winner = document.getElementById("winner").value || "Нічия";
  const mvp = document.getElementById("mvp").value;
  const penalties = Array.from(document.getElementById("penalty").selectedOptions).map(o => o.value);
  const penaltyPoints = parseInt(document.getElementById("penalty-points").value) || 0;

  alert(\`Збережено результат:\nПереможець: \${winner}\nMVP: \${mvp}\nШтраф: \${penalties.join(", ")} (-\${penaltyPoints})\`);
}
